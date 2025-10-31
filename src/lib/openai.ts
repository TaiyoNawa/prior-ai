import { createHash } from "crypto";

import OpenAI from "openai";

import type {
  AnalyzeTasksResponse,
  StructuredSubtask,
  StructuredTask,
} from "./types";

const DEFAULT_MODEL = process.env.OPENAI_MODEL_DEFAULT?.trim() || "gpt-4o-mini";
const PREMIUM_MODEL = process.env.OPENAI_MODEL_PREMIUM?.trim() || "sonnet-4.5";
const CACHE_TTL_MS = 1000 * 60 * 60 * 24; // 24時間キャッシュ
const DEFAULT_MAX_TASKS = 50; // トークン節約を意識したクッション

export type ModelTier = "default" | "premium";

export type AIAction =
  | "priority"
  | "order"
  | "decompose"
  | "merge"
  | "schedule"
  | "estimate"
  | string;

export type TaskInput = {
  title: string;
  description?: string | null;
  due?: string | null;
  aiActions?: AIAction[];
};

export type AnalyzeTasksParams = {
  tasks: TaskInput[];
  userConstraints?: Record<string, unknown> | null;
  modelTier?: ModelTier;
  enableLongReason?: boolean;
  promptHash?: string;
  cache?: CacheAdapter | null;
  retry?: Partial<RetryConfig> | null;
};

export type CacheEntry = {
  result: AnalyzeTasksResponse;
  expiresAt: number;
};

export type CacheAdapter = {
  get: (key: string) => Promise<CacheEntry | null>;
  set: (key: string, value: CacheEntry) => Promise<void>;
};

export class AIResponseParseError extends Error {
  constructor(message: string, public readonly rawContent: string) {
    super(message);
    this.name = "AIResponseParseError";
  }
}

export class OpenAIConfigurationError extends Error {}

const DEFAULT_RETRY: RetryConfig = {
  attempts: 3,
  backoffMs: 1_200,
};

type RetryConfig = {
  attempts: number;
  backoffMs: number;
};

const COST_TABLE: Record<ModelTier, number> = {
  default: 0.02, // TODO: 課金体系が固まったら正確なトークン単価へ更新
  premium: 0.12,
};

const actionHints: Record<string, string> = {
  priority: "優先度を1(最高)〜5(最低)で決定",
  order: "実行順を1から割り振り",
  decompose: "必要な場合のみ3件以内のsubtasksを生成",
  merge: "重複や依存関係があれば統合案を提示",
  schedule: "可能なら予定時間帯を提案",
  estimate: "推定作業時間(分)を60分上限で推定",
};

function ensureEnv() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new OpenAIConfigurationError("OPENAI_API_KEYが設定されていません");
  }
  return apiKey;
}

function createClient() {
  return new OpenAI({ apiKey: ensureEnv() });
}

function clampNumber(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function delay(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function sanitizeJsonContent(raw: string): string {
  // Markdownのコードフェンスを除去して純粋なJSONを抜き出す
  const fencedMatch = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fencedMatch) {
    return fencedMatch[1].trim();
  }

  // 冒頭に説明文が入る場合は最初の配列/オブジェクト以降を採用
  const firstJsonIndex = raw.search(/[\[{]/);
  if (firstJsonIndex > 0) {
    return raw.slice(firstJsonIndex).trim();
  }

  return raw.trim();
}

function computeHash(input: string) {
  return createHash("sha256").update(input).digest("hex");
}

export function derivePromptHash(params: AnalyzeTasksParams): string {
  const serialisable = {
    tasks: params.tasks,
    constraints: params.userConstraints ?? null,
    modelTier: params.modelTier ?? "default",
    enableLongReason: !!params.enableLongReason,
  };
  return computeHash(JSON.stringify(serialisable));
}

function formatTasksForPrompt(tasks: TaskInput[]): TaskInput[] {
  return tasks.slice(0, DEFAULT_MAX_TASKS).map((task) => ({
    title: task.title.trim(),
    description: task.description?.slice(0, 120) ?? null,
    due: task.due ?? null,
    aiActions: task.aiActions ?? [],
  }));
}

function buildSystemPrompt(enableLongReason: boolean) {
  // トークン節約のため最小限のschemaを指示
  return (
    "あなたはPriorAIの生産性コーチです。回答は有効なJSON配列のみで返し、日本語の自由記述は避けてください。" +
    "title/priority/order/category/shortReason/estimatedMinutes/dueDate/subtasksのみを含め、" +
    (enableLongReason
      ? "longExplanationは200文字以内で1件のみ追加できます。"
      : "longExplanationは出力しないでください。") +
    "shortReasonは80文字以内で簡潔にまとめてください。" +
    "subtasksはオブジェクト配列で、title/priority/order/completed/estimatedMinutes/shortReasonのみを含めてください。"
  );
}

function buildUserMessage(
  params: AnalyzeTasksParams,
  enableLongReason: boolean
) {
  const trimmedTasks = formatTasksForPrompt(params.tasks);
  const requestedActions = Array.from(
    new Set(trimmedTasks.flatMap((task) => task.aiActions ?? []))
  );

  if (requestedActions.length === 0) {
    requestedActions.push("priority", "order");
  }

  const actionToExplain = requestedActions
    .map((action) => actionHints[action] ?? `${action}を実行`)
    .join(" / ");

  const schemaHint = {
    format: [
      {
        title: "string",
        priority: "1〜5の整数",
        order: "1以上の整数",
        category: "string",
        dueDate: "ISO8601フォーマットまたはnull",
        subtasks: [
          {
            title: "string",
            priority: "0〜5の整数",
            order: "1以上の整数",
            completed: "boolean",
            shortReason: "80文字以内",
            estimatedMinutes: "整数またはnull",
          },
        ],
        shortReason: "80文字以内の説明",
        estimatedMinutes: "整数またはnull",
        ...(enableLongReason ? { longExplanation: "200文字以内の説明" } : {}),
      },
    ],
  };

  const payload = {
    requestedActions,
    actionNotes: actionToExplain,
    constraints: params.userConstraints ?? null,
    tasks: trimmedTasks,
  };

  return JSON.stringify({ instructions: schemaHint, payload });
}

const structuredTaskSchema = {
  validate(json: unknown, enableLongReason: boolean): StructuredTask[] {
    if (!Array.isArray(json)) {
      throw new Error("AIレスポンスが配列形式ではありません");
    }

    return json.map((item, index) => {
      if (typeof item !== "object" || item === null) {
        throw new Error(`タスク要素が無効です(index=${index})`);
      }

      const record = item as Record<string, unknown>;
      const titleRaw = (record.title ?? record.task ?? "") as string;
      const title = String(titleRaw).trim();
      const priority = clampNumber(Number(record.priority ?? 3) || 3, 1, 5);
      const order = Math.max(Number(record.order ?? index + 1) || index + 1, 1);
      const category = String(record.category ?? "未分類").trim() || "未分類";
      const shortReason = record.shortReason
        ? String(record.shortReason).slice(0, 80)
        : undefined;
      const longExplanation = enableLongReason
        ? record.longExplanation
          ? String(record.longExplanation).slice(0, 200)
          : undefined
        : undefined;
      const estimatedMinutes =
        typeof record.estimatedMinutes === "number"
          ? Math.max(0, Math.round(record.estimatedMinutes))
          : null;

      const dueCandidate = record.dueDate ?? record.due ?? null;
      const dueDate =
        typeof dueCandidate === "string" && dueCandidate.trim().length > 0
          ? dueCandidate
          : null;

      const subtasks = normalizeSubtasks(record.subtasks);

      if (!title) {
        throw new Error(`タスク名が空です(index=${index})`);
      }

      return {
        title,
        priority,
        order,
        category,
        subtasks,
        shortReason,
        ...(enableLongReason
          ? { longExplanation: longExplanation ?? undefined }
          : {}),
        estimatedMinutes: estimatedMinutes ?? null,
        dueDate,
      } satisfies StructuredTask;
    });
  },
};

function normalizeSubtasks(raw: unknown): StructuredSubtask[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  const results: StructuredSubtask[] = [];

  raw.some((item, index) => {
    if (results.length >= 10) {
      return true;
    }

    if (typeof item === "string") {
      const title = item.trim();
      if (!title) return false;
      results.push({
        title: title.slice(0, 80),
        priority: 0,
        order: index + 1,
        completed: false,
        estimatedMinutes: null,
      });
      return false;
    }

    if (typeof item === "object" && item !== null) {
      const record = item as Record<string, unknown>;
      const title = String(record.title ?? record.task ?? "").trim();
      if (!title) return false;
      const priority = clampNumber(Number(record.priority ?? 0) || 0, 0, 5);
      const order = Math.max(Number(record.order ?? index + 1) || index + 1, 1);
      const completed = Boolean(record.completed);
      const shortReason = record.shortReason
        ? String(record.shortReason).slice(0, 80)
        : undefined;
      const estimatedMinutes =
        typeof record.estimatedMinutes === "number"
          ? Math.max(0, Math.round(record.estimatedMinutes))
          : null;
      results.push({
        title,
        priority,
        order,
        completed,
        shortReason,
        estimatedMinutes,
      });
      return false;
    }

    return false;
  });

  return results;
}

function resolveModel(params: AnalyzeTasksParams): {
  tier: ModelTier;
  model: string;
  enableLongReason: boolean;
} {
  const tier = params.modelTier === "premium" ? "premium" : "default";
  const model = tier === "premium" ? PREMIUM_MODEL : DEFAULT_MODEL;
  const enableLongReason =
    tier === "premium" && params.enableLongReason === true;
  return { tier, model, enableLongReason };
}

async function analyzeTasksInternal(
  params: AnalyzeTasksParams
): Promise<AnalyzeTasksResponse> {
  if (!Array.isArray(params.tasks) || params.tasks.length === 0) {
    throw new Error("1件以上のタスクが必要です");
  }

  const { tier, model, enableLongReason } = resolveModel(params);
  const cacheKey = params.promptHash ?? derivePromptHash(params);
  const now = Date.now();

  if (params.cache) {
    const cached = await params.cache.get(cacheKey);
    if (cached && cached.expiresAt > now) {
      return {
        ...cached.result,
        cacheHit: true,
      };
    }
  }

  type ChatMessage = OpenAI.Chat.Completions.ChatCompletionMessageParam;
  const messages: ChatMessage[] = [
    { role: "system", content: buildSystemPrompt(enableLongReason) },
    { role: "user", content: buildUserMessage(params, enableLongReason) },
  ];

  const retryPlan: RetryConfig = {
    attempts: Math.max(params.retry?.attempts ?? DEFAULT_RETRY.attempts, 1),
    backoffMs: params.retry?.backoffMs ?? DEFAULT_RETRY.backoffMs,
  };

  let lastError: unknown;
  let rawContent = "";

  for (let attempt = 1; attempt <= retryPlan.attempts; attempt += 1) {
    try {
      const client = createClient();
      const completion = await client.chat.completions.create({
        model,
        messages,
        temperature: 0.15,
        max_tokens: 1_500,
      });

      rawContent = completion.choices[0]?.message?.content ?? "";

      if (!rawContent) {
        throw new Error("AIレスポンスが空でした");
      }

      const sanitized = sanitizeJsonContent(rawContent);
      const parsed = JSON.parse(sanitized);
      const tasks = structuredTaskSchema.validate(parsed, enableLongReason);

      const costEstimate = COST_TABLE[tier];

      const result: AnalyzeTasksResponse = {
        tasks,
        usedModel: model,
        cacheHit: false,
        rawResponse: rawContent,
        costEstimate,
        promptHash: cacheKey,
      };

      if (params.cache) {
        await params.cache.set(cacheKey, {
          result,
          expiresAt: now + CACHE_TTL_MS,
        });
      }

      return result;
    } catch (error) {
      lastError = error;
      if (
        error instanceof SyntaxError ||
        error instanceof AIResponseParseError
      ) {
        throw new AIResponseParseError(
          `AIレスポンスのJSON解析に失敗しました: ${(error as Error).message}`,
          rawContent
        );
      }

      if (attempt === retryPlan.attempts) {
        break;
      }

      await delay(retryPlan.backoffMs * attempt);
    }
  }

  if (lastError instanceof Error) {
    throw lastError;
  }

  throw new Error("OpenAI呼び出しに失敗しました");
}

function convertLegacyPromptToTasks(prompt: string): TaskInput[] {
  // TODO: 旧APIが残っている間だけ利用。将来的に削除予定。
  return prompt
    .split(/\r?\n/) // 1行1タスクとみなす簡易パーサー
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => ({
      title: line.slice(0, 80),
      description: line,
      aiActions: ["priority", "order", "decompose"],
    }));
}

export async function analyzeTasksWithAI(
  input: AnalyzeTasksParams | string
): Promise<AnalyzeTasksResponse> {
  if (typeof input === "string") {
    const legacyTasks = convertLegacyPromptToTasks(input);
    return analyzeTasksInternal({
      tasks: legacyTasks,
      userConstraints: null,
      modelTier: "default",
      enableLongReason: false,
    });
  }

  return analyzeTasksInternal(input);
}
