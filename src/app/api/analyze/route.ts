import { NextResponse } from "next/server";
import { z } from "zod";

import { AIResponseParseError, analyzeTasksWithAI } from "@/lib/openai";
import { prisma } from "@/lib/prisma";
import { getSupabaseAuthContext } from "@/lib/supabase/server";

const requestSchema = z.object({
  tasks: z.string().min(1, "タスク入力が空です"),
});

export async function POST(request: Request) {
  const { user } = await getSupabaseAuthContext();
  const body = await request.json().catch(() => ({}));
  const parsed = requestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error:
          parsed.error.flatten().fieldErrors.tasks?.[0] ?? "入力内容が不正です",
      },
      { status: 400 }
    );
  }

  // getUserで検証済みのユーザーが取得できなければ即401を返す
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await analyzeTasksWithAI(parsed.data.tasks);

    const tasksJson = JSON.parse(JSON.stringify(result.tasks));

    await prisma.$transaction([
      prisma.log.create({
        data: {
          prompt: parsed.data.tasks,
          response: tasksJson,
          userId: user.id,
        },
      }),
      prisma.task.create({
        data: {
          data: tasksJson,
          userId: user.id,
        },
      }),
    ]);

    return NextResponse.json(result);
  } catch (error) {
    console.error("analyze route error", error);

    if (error instanceof AIResponseParseError) {
      // パース失敗時でもAIの生レスポンスを確認できるよう返却
      return NextResponse.json(
        {
          error: error.message,
          aiRawResponse: error.rawContent,
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
