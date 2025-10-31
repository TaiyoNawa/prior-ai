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

  const [logs, taskRecords] = await Promise.all([
    prisma.log.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
    }),
    prisma.task.findMany({
      where: { userId: user.id },
      include: {
        subtasks: {
          orderBy: { order: "asc" },
        },
      },
      orderBy: [{ createdAt: "desc" }, { order: "asc" }],
    }),
  ]);

  type TaskEntity = (typeof taskRecords)[number];

  const tasksByHash = new Map<string, TaskEntity[]>();
  for (const task of taskRecords) {
    const key = task.promptHash ?? `legacy-${task.id}`;
    const list = tasksByHash.get(key);
    if (list) {
      list.push(task);
    } else {
      tasksByHash.set(key, [task]);
    }
  }

  for (const [, list] of tasksByHash) {
    list.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  const history: Array<{
    id: string;
    createdAt: Date;
    tasks: StructuredTask[];
  }> = [];

  function mapStructuredTask(task: TaskEntity): StructuredTask {
    return {
      title: task.title,
      priority: task.priority,
      order: task.order,
      category: task.category ?? "未分類",
      shortReason: task.shortReason ?? undefined,
      longExplanation: task.longExplanation ?? undefined,
      estimatedMinutes: task.estMinutes ?? null,
      dueDate: task.dueDate ? task.dueDate.toISOString() : null,
      subtasks: task.subtasks
        .slice()
        .sort((a, b) => a.order - b.order)
        .map((subtask) => ({
          title: subtask.title,
          priority: subtask.priority,
          order: subtask.order,
          completed: subtask.completed,
          shortReason: subtask.description ?? undefined,
          estimatedMinutes: undefined,
        })),
    };
  }

  for (const log of logs) {
    const key = log.promptHash ?? `legacy-${log.id}`;
    const candidates = tasksByHash.get(key);
    if (!candidates || candidates.length === 0) {
      continue;
    }

    const matched: TaskEntity[] = [];
    while (candidates.length > 0 && candidates[0].createdAt >= log.createdAt) {
      matched.push(candidates.shift()!);
    }

    if (matched.length === 0) {
      continue;
    }

    matched.sort((a, b) => a.order - b.order);
    history.push({
      id: log.id,
      createdAt: log.createdAt,
      tasks: matched.map(mapStructuredTask),
    });
  }

  for (const [key, remaining] of tasksByHash) {
    if (!remaining || remaining.length === 0) {
      continue;
    }

    for (const orphan of remaining) {
      history.push({
        id: `${key}-${orphan.id}`,
        createdAt: orphan.createdAt,
        tasks: [mapStructuredTask(orphan)],
      });
    }
  }

  history.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

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
