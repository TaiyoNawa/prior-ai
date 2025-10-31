import { NextResponse } from "next/server";
import { z } from "zod";

import {
  AIResponseParseError,
  analyzeTasksWithAI,
  derivePromptHash,
  type AnalyzeTasksParams,
  type TaskInput,
} from "@/lib/openai";
import { prisma } from "@/lib/prisma";
import { getSupabaseAuthContext } from "@/lib/supabase/server";

import type { AnalyzeTasksResponse } from "@/lib/types";

const CACHE_WINDOW_MS = 1000 * 60 * 60 * 24; // 24時間キャッシュ
const RATE_LIMIT_PER_MINUTE = 5;
const RATE_LIMIT_PER_WEEK = 100;
const FREE_MONTHLY_LIMIT = 15;
const MAX_SUBTASKS_PER_TASK = 10;

const aiActionSchema = z.enum([
  "priority",
  "order",
  "decompose",
  "merge",
  "schedule",
  "estimate",
]);

const taskSchema = z
  .object({
    title: z.string().min(1, "タイトルは必須です").max(120),
    desc: z.string().max(200).optional(),
    description: z.string().max(200).optional(),
    due: z
      .string()
      .optional()
      .refine(
        (value) => !value || !Number.isNaN(Date.parse(value)),
        "dueはISO8601形式で指定してください"
      ),
    aiActions: z.array(aiActionSchema).max(8).optional(),
  })
  .strict();

const requestSchema = z.object({
  tasks: z
    .array(taskSchema)
    .min(1, "最低1件のタスクが必要です")
    .max(50, "タスクは最大50件までです"),
  userConstraints: z.object({}).catchall(z.unknown()).optional(),
  model: z.enum(["default", "high"]).optional(),
  enableLongReason: z.boolean().optional(),
  forceRefresh: z.boolean().optional(),
});

function buildNormalizedTasks(
  rawTasks: z.infer<typeof taskSchema>[]
): TaskInput[] {
  // ユーザー入力をAIラッパー向けの構造に整形しトークン節約のためにトリムする
  return rawTasks.map((task) => ({
    title: task.title.trim(),
    description: (task.desc ?? task.description ?? null)?.slice(0, 200) ?? null,
    due: task.due ?? null,
    aiActions: task.aiActions ?? [],
  }));
}

function parseDueDate(input: string | null | undefined): Date | null {
  if (!input) return null;
  const parsed = new Date(input);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed;
}

function currentMonthKey(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(
    2,
    "0"
  )}`;
}

async function ensureUserRecord(user: { id: string; email?: string | null }) {
  const emailFallback = `${user.id}@supabase.local`;
  const email = user.email?.trim() || emailFallback;

  await prisma.user.upsert({
    where: { id: user.id },
    update: user.email ? { email } : {},
    create: { id: user.id, email },
  });
}

async function enforceUsageLimit(params: {
  userId: string;
  monthKey: string;
  isPremium: boolean;
}) {
  let usageRecord = await prisma.usageCounter.findUnique({
    where: { userId: params.userId },
  });

  if (!usageRecord) {
    usageRecord = await prisma.usageCounter.create({
      data: { userId: params.userId, month: params.monthKey, aiCalls: 0 },
    });
  } else if (usageRecord.month !== params.monthKey) {
    usageRecord = await prisma.usageCounter.update({
      where: { userId: params.userId },
      data: { month: params.monthKey, aiCalls: 0 },
    });
  }

  if (!params.isPremium && usageRecord.aiCalls >= FREE_MONTHLY_LIMIT) {
    throw NextResponse.json(
      {
        error: `無料枠のAI利用回数（${FREE_MONTHLY_LIMIT}回/月）を超過しました`,
      },
      { status: 402 }
    );
  }
}

async function applyRateLimit(userId: string, now: Date) {
  const minuteAgo = new Date(now.getTime() - 60_000);
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [lastMinute, lastWeek] = await Promise.all([
    prisma.log.count({
      where: { userId, createdAt: { gte: minuteAgo } },
    }),
    prisma.log.count({
      where: { userId, createdAt: { gte: weekAgo } },
    }),
  ]);

  if (lastMinute >= RATE_LIMIT_PER_MINUTE) {
    const retryAfterSeconds = 60;
    throw NextResponse.json(
      { error: "レート制限: 1分あたり5回までです" },
      { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } }
    );
  }

  if (lastWeek >= RATE_LIMIT_PER_WEEK) {
    throw NextResponse.json(
      { error: "レート制限: 週100回の上限に達しました" },
      { status: 429 }
    );
  }
}

async function findCachedResult(params: {
  userId: string;
  promptHash: string;
}) {
  const recentLogs = await prisma.log.findMany({
    where: {
      userId: params.userId,
      createdAt: {
        gte: new Date(Date.now() - CACHE_WINDOW_MS),
      },
    },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  for (const log of recentLogs) {
    const payload = log.response as Record<string, unknown> | null;
    if (!payload || typeof payload !== "object") continue;
    if ((payload as { promptHash?: string }).promptHash === params.promptHash) {
      return payload;
    }
  }

  return null;
}

type AnalyzeTasksInputResult = AnalyzeTasksResponse & {
  cacheHit?: boolean;
};

export async function POST(request: Request) {
  const { user } = await getSupabaseAuthContext();
  const body = await request.json().catch(() => ({}));
  const parsed = requestSchema.safeParse(body);

  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "入力内容が不正です";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await ensureUserRecord(user);

  const now = new Date();
  const monthKey = currentMonthKey(now);
  const modelTier = parsed.data.model === "high" ? "premium" : "default";
  const enableLongReason =
    modelTier === "premium" ? parsed.data.enableLongReason === true : false;
  const normalizedTasks = buildNormalizedTasks(parsed.data.tasks);

  const promptParams: AnalyzeTasksParams = {
    tasks: normalizedTasks,
    userConstraints: parsed.data.userConstraints ?? null,
    modelTier,
    enableLongReason,
  };

  const promptHash = derivePromptHash(promptParams);

  try {
    await applyRateLimit(user.id, now);
  } catch (response) {
    if (response instanceof NextResponse) {
      return response;
    }
    throw response;
  }

  try {
    await enforceUsageLimit({
      userId: user.id,
      monthKey,
      isPremium: modelTier === "premium",
    });
  } catch (response) {
    if (response instanceof NextResponse) {
      return response;
    }
    throw response;
  }

  if (!parsed.data.forceRefresh) {
    const cached = await findCachedResult({ userId: user.id, promptHash });
    if (cached) {
      const payload = cached as AnalyzeTasksInputResult;
      const fallbackModel =
        process.env.OPENAI_MODEL_DEFAULT?.trim() || "gpt-4o-mini";
      return NextResponse.json({
        tasks: Array.isArray(payload.tasks) ? payload.tasks : [],
        usedModel: payload.usedModel ?? fallbackModel,
        cacheHit: true,
        rawResponse:
          typeof payload.rawResponse === "string" ? payload.rawResponse : "",
        costEstimate: Number(payload.costEstimate ?? 0),
        promptHash,
      });
    }
  }

  try {
    const result = await analyzeTasksWithAI({
      ...promptParams,
      promptHash,
    });

    const logPayload = {
      ...result,
      cacheHit: false,
    } satisfies AnalyzeTasksInputResult;

    await prisma.$transaction(async (tx) => {
      await tx.log.create({
        data: {
          promptHash,
          prompt: {
            tasks: normalizedTasks,
            forceRefresh: parsed.data.forceRefresh ?? false,
            model: modelTier,
          },
          response: logPayload,
          rawResponse: result.rawResponse,
          costEstimate: result.costEstimate,
          modelUsed: result.usedModel,
          userId: user.id,
        },
      });

      for (const [index, task] of result.tasks.entries()) {
        const dueDate = parseDueDate(task.dueDate ?? null);
        await tx.task.create({
          data: {
            userId: user.id,
            title: task.title,
            description: task.longExplanation ?? task.shortReason ?? null,
            dueDate,
            priority: task.priority,
            order: task.order || index + 1,
            category: task.category,
            estMinutes: task.estimatedMinutes ?? null,
            shortReason: task.shortReason ?? null,
            longExplanation: task.longExplanation ?? null,
            promptHash,
            modelUsed: result.usedModel,
            subtasks: {
              create: task.subtasks
                .slice(0, MAX_SUBTASKS_PER_TASK)
                .map((subtask, subIndex) => ({
                  title: subtask.title,
                  description: subtask.shortReason ?? null,
                  priority: subtask.priority,
                  order: subtask.order || subIndex + 1,
                  completed: subtask.completed ?? false,
                })),
            },
          },
        });
      }
    });

    await prisma.usageCounter.update({
      where: { userId: user.id },
      data: { aiCalls: { increment: 1 }, month: monthKey },
    });

    return NextResponse.json(result);
  } catch (error: unknown) {
    console.error("analyze route error", error);

    if (error instanceof AIResponseParseError) {
      const parseError = error as AIResponseParseError;
      return NextResponse.json(
        {
          error: parseError.message,
          aiRawResponse: parseError.rawContent,
          promptHash,
        },
        { status: 502 }
      );
    }

    return NextResponse.json(
      { error: "AI解析中に問題が発生しました" },
      { status: 500 }
    );
  }
}
