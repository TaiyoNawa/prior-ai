"use client";
import { useState } from "react";

import { TaskInputForm } from "@/components/task/TaskInputForm";
import { TaskList } from "@/components/task/TaskList";

import type { StructuredTask } from "@/lib/types";

function TaskWorkspace() {
  "use client";

  const [tasks, setTasks] = useState<StructuredTask[]>([]);

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3">
        <h1 className="text-3xl font-bold tracking-tight">PriorAI</h1>
        <p className="text-muted-foreground">
          タスクを入力するだけで、AIが優先順位・実行順・カテゴリを整理し、最適な進め方を提案します。
        </p>
      </section>
      <TaskInputForm onResult={setTasks} />
      {tasks.length > 0 ? <TaskList tasks={tasks} /> : null}
    </div>
  );
}

export default function HomePage() {
  return <TaskWorkspace />;
}
