import { redirect } from "next/navigation";

import { TaskList } from "@/components/task/TaskList";

import { prisma } from "@/lib/prisma";
import { getSupabaseAuthContext } from "@/lib/supabase/server";

import type { StructuredTask } from "@/lib/types";

const formatter = new Intl.DateTimeFormat("ja-JP", {
  dateStyle: "medium",
  timeStyle: "short",
});

export default async function TasksPage() {
  const { user } = await getSupabaseAuthContext();

  // 認証が取れなければ直ちにログイン画面へ誘導
  if (!user) {
    redirect("/login");
  }

  // Prisma生成済みの型がまだ利用できない状況でも扱えるよう暫定の型を定義
  type TaskRecord = {
    id: string;
    data: unknown;
    createdAt: Date;
  };

  const taskRecords = (await prisma.task.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
  })) as TaskRecord[];

  const history = taskRecords.map((record: TaskRecord) => ({
    id: record.id,
    createdAt: record.createdAt,
    tasks: (record.data as StructuredTask[]) ?? [],
  }));

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">AI整理履歴</h1>
        <p className="text-muted-foreground">
          過去に整理したタスクセットを参照できます。優先順位やカテゴリで振り返り、次のアクションに活かしましょう。
        </p>
      </section>
      {history.length === 0 ? (
        <div className="rounded-lg border border-dashed border-muted-foreground/40 p-12 text-center text-muted-foreground">
          履歴がまだありません。まずはタスクをAIで整理してみましょう。
        </div>
      ) : (
        <div className="flex flex-col gap-8">
          {history.map((entry) => (
            <section key={entry.id} className="flex flex-col gap-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-xl font-semibold">整理結果</h2>
                <span className="text-sm text-muted-foreground">
                  {entry.createdAt
                    ? formatter.format(new Date(entry.createdAt))
                    : "日時不明"}
                </span>
              </div>
              <TaskList tasks={entry.tasks} />
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
