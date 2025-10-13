"use client";

import { useMemo, useState, type ChangeEvent } from "react";

import { TaskCard } from "@/components/task/TaskCard";

import type { StructuredTask, TaskSortKey } from "@/lib/types";

interface TaskListProps {
  tasks: StructuredTask[];
  withControls?: boolean;
}

const sortLabels: Record<TaskSortKey, string> = {
  priority: "優先度が高い順",
  order: "実行順",
  category: "カテゴリ別",
};

export function TaskList({ tasks, withControls = true }: TaskListProps) {
  // 表示用の並び替えを管理
  const [sortKey, setSortKey] = useState<TaskSortKey>("priority");

  const sortedTasks = useMemo(() => {
    const copied = [...tasks];

    switch (sortKey) {
      case "priority":
        return copied.sort((a, b) => a.priority - b.priority);
      case "order":
        return copied.sort((a, b) => a.order - b.order);
      case "category":
        return copied.sort((a, b) => a.category.localeCompare(b.category));
      default:
        return copied;
    }
  }, [sortKey, tasks]);

  if (tasks.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-muted-foreground/40 p-12 text-center text-muted-foreground">
        まだAIで整理されたタスクはありません。
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {withControls ? (
        <div className="flex flex-wrap items-center gap-3">
          <label
            className="text-sm text-muted-foreground"
            htmlFor="task-sort-select"
          >
            並び替え
          </label>
          <select
            id="task-sort-select"
            value={sortKey}
            onChange={(event: ChangeEvent<HTMLSelectElement>) =>
              setSortKey(event.target.value as TaskSortKey)
            }
            className="w-fit min-w-48 rounded-md border border-border/60 bg-background px-3 py-2 text-sm shadow-sm"
          >
            {Object.entries(sortLabels).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </div>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2">
        {sortedTasks.map((task) => (
          <TaskCard key={`${task.task}-${task.order}`} task={task} />
        ))}
      </div>
    </div>
  );
}
