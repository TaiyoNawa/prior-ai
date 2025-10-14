import OpenAI from "openai";

import { AnalyzeTasksResponse, StructuredTask } from "./types";

const MODEL_NAME = "gpt-4o-mini"; // GPT-4o-mini
// const MODEL_NAME = "gpt-3.5-turbo"; // gpt-3.5-turbo

const structuredTaskSchema = {
  validate(json: unknown): StructuredTask[] {
    if (!Array.isArray(json)) {
      throw new Error("AIレスポンスが配列形式ではありません");
    }

    return json.map((item) => {
      if (typeof item !== "object" || item === null) {
        throw new Error("タスク要素がオブジェクトではありません");
      }

      const task = String((item as Record<string, unknown>).task ?? "").trim();
      const priority = Number((item as Record<string, unknown>).priority ?? 5);
      const order = Number((item as Record<string, unknown>).order ?? 1);
      const subtasksRaw = (item as Record<string, unknown>).subtasks;
      const category = String(
        (item as Record<string, unknown>).category ?? "未分類"
      ).trim();

      const subtasks = Array.isArray(subtasksRaw)
        ? subtasksRaw.map((subtask) => String(subtask))
        : [];

      if (!task) {
        throw new Error("タスク名が空の要素があります");
      }

      return {
        task,
        priority: Number.isFinite(priority) ? priority : 5,
        order: Number.isFinite(order) ? order : 1,
        subtasks,
        category: category || "未分類",
      } satisfies StructuredTask;
    });
  },
};

export class AIResponseParseError extends Error {
  constructor(message: string, public readonly rawContent: string) {
    super(message);
    this.name = "AIResponseParseError";
  }
}

function sanitizeJsonContent(raw: string): string {
  // Markdownのコードフェンスが含まれている場合は中身だけを抽出する
  const fencedMatch = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fencedMatch) return fencedMatch[1].trim();

  // 先頭や末尾に説明文が付くケースは最初のJSON配列/オブジェクトからを抜き出す
  const match = raw.match(/[\[{][\s\S]*[\]}]/);
  if (match) return match[0].trim();

  return raw.trim();
}

function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error("OPENAI_API_KEYが設定されていません");
  }

  return new OpenAI({ apiKey });
}

export async function analyzeTasksWithAI(
  prompt: string
): Promise<AnalyzeTasksResponse> {
  // タスク群をAIに渡して構造化データを取得する
  const client = getOpenAIClient();

  const completion = await client.chat.completions.create({
    model: MODEL_NAME,
    messages: [
      {
        role: "system",
        content:
          "あなたは生産性コーチです。ユーザーのタスクを整理し、優先順位・実行順・カテゴリを構造化JSONで返してください。必ず有効なJSONのみを出力してください。",
      },
      {
        role: "user",
        content: `以下のタスク群を優先順位・実行順・構造に基づいて整理してください。\n出力は必ずJSON形式で:\n[\n  {\n    "task": "string",\n    "priority": "1〜5 (1が最優先)",\n    "order": "1〜n",\n    "subtasks": ["string"],\n    "category": "string"\n  }\n]\n\nタスク群:\n${prompt}`,
      },
    ],
    temperature: 0.3,
  });

  const rawContent = completion.choices[0]?.message?.content ?? "";

  if (!rawContent) {
    throw new Error("AIレスポンスが空でした");
  }

  let parsed: unknown;

  try {
    const sanitized = sanitizeJsonContent(rawContent);
    parsed = JSON.parse(sanitized);
  } catch (error) {
    // TODO: JSONパース失敗時は再試行する（例: sanitize後に再プロンプト送信）
    // もしくはcompletion.response_format = { type: "json_object" }を利用する

    throw new AIResponseParseError(
      `AIレスポンスのJSON解析に失敗しました: ${(error as Error).message}`,
      rawContent
    );
  }

  const tasks = structuredTaskSchema.validate(parsed);

  return { tasks };
}
