import { cn } from "@/lib/utils";

import type { StructuredTask } from "@/lib/types";

interface TaskCardProps {
  task: StructuredTask;
}

function getPriorityColor(priority: number) {
  if (priority <= 2) return "bg-red-100 text-red-700 dark:bg-red-500/30";
  if (priority === 3)
    return "bg-yellow-100 text-yellow-700 dark:bg-yellow-500/30";
  return "bg-blue-100 text-blue-700 dark:bg-blue-500/30";
}

export function TaskCard({ task }: TaskCardProps) {
  // AIが整理したタスクの1件分をカード表示する
  return (
    <article className="flex h-full flex-col justify-between rounded-lg border border-border/60 bg-card/80 p-5 shadow-sm transition hover:border-primary/60">
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-lg font-semibold">{task.task}</h3>
          <span
            className={cn(
              "rounded-full px-3 py-1 text-xs font-medium",
              getPriorityColor(task.priority)
            )}
          >
            優先度: {task.priority}
          </span>
        </div>
        <p className="text-sm text-muted-foreground">順番: {task.order}</p>
        <p className="text-sm text-muted-foreground">
          カテゴリ: {task.category}
        </p>
        {task.subtasks.length > 0 ? (
          <div className="rounded-md bg-muted/60 p-3 text-sm">
            <p className="mb-1 font-medium">小タスク</p>
            <ul className="list-disc pl-5 text-muted-foreground">
              {task.subtasks.map((subtask) => (
                <li key={subtask}>{subtask}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </article>
  );
}
