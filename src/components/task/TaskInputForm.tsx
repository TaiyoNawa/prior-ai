"use client";

import { DndContext, type DragEndEvent } from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { LoadingSpinner } from "@/components/shared/loading-spinner";
import { useSupabase } from "@/components/shared/supabase-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

import { useStandardSortableSensors } from "@/lib/dnd";
import { DRAG_ITEM_Z_INDEX } from "@/lib/dnd";
import { cn } from "@/lib/utils";

import type { StructuredTask } from "@/lib/types";

const MAX_TASKS = 10;
const OPTIONAL_AI_ACTIONS = [
  {
    value: "decompose",
    label: "詳細分解",
    description: "必要なら小タスクに分けます",
  },
  {
    value: "merge",
    label: "重複整理",
    description: "似たタスクをまとめます",
  },
  {
    value: "schedule",
    label: "スケジュール",
    description: "実行時間帯を提案します",
  },
  {
    value: "estimate",
    label: "工数見積もり",
    description: "所要時間を推定します",
  },
];

type DraftTask = {
  id: string;
  title: string;
  notes: string;
  due: string;
  aiActions: string[];
  showOptions: boolean;
};

function createClientId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function createDraftTask(): DraftTask {
  return {
    id: createClientId("draft-task"),
    title: "",
    notes: "",
    due: "",
    aiActions: [],
    showOptions: false,
  };
}

function reorderDraftTasks(
  tasks: DraftTask[],
  activeId: string,
  overId: string
): DraftTask[] {
  const copy = [...tasks];
  const fromIndex = copy.findIndex((task) => task.id === activeId);
  const toIndex = copy.findIndex((task) => task.id === overId);
  if (fromIndex === -1 || toIndex === -1) return copy;
  const [moved] = copy.splice(fromIndex, 1);
  copy.splice(toIndex, 0, moved);
  return copy;
}

interface TaskInputFormProps {
  onResult?: (tasks: StructuredTask[]) => void;
}

export function TaskInputForm({ onResult }: TaskInputFormProps) {
  const { session } = useSupabase();
  const router = useRouter();
  const [tasks, setTasks] = useState<DraftTask[]>([createDraftTask()]);
  const [model, setModel] = useState<"default" | "high">("default");
  const [enableLongReason, setEnableLongReason] = useState(false);
  const [forceRefresh, setForceRefresh] = useState(false);
  const [isSubmitting, startTransition] = useTransition();
  // NOTE: ドラッグの反応距離は src/lib/dnd.ts で一元管理
  const sensors = useStandardSortableSensors();

  useEffect(() => {
    if (model !== "high" && enableLongReason) {
      setEnableLongReason(false);
    }
  }, [model, enableLongReason]);

  const canAddTask = useMemo(() => tasks.length < MAX_TASKS, [tasks.length]);

  const handleTaskFieldChange = (
    taskId: string,
    field: "title" | "notes" | "due",
    value: string
  ) => {
    setTasks((prev) =>
      prev.map((task) =>
        task.id === taskId ? { ...task, [field]: value } : task
      )
    );
  };

  const toggleTaskAction = (taskId: string, action: string) => {
    setTasks((prev) =>
      prev.map((task) => {
        if (task.id !== taskId) return task;
        const hasAction = task.aiActions.includes(action);
        const nextActions = hasAction
          ? task.aiActions.filter((item) => item !== action)
          : [...task.aiActions, action];
        return { ...task, aiActions: nextActions };
      })
    );
  };

  const handleAddTask = () => {
    if (!canAddTask) return;
    setTasks((prev) => [...prev, createDraftTask()]);
  };

  const handleRemoveTask = (taskId: string) => {
    setTasks((prev) =>
      prev.length === 1 ? prev : prev.filter((task) => task.id !== taskId)
    );
  };

  const toggleTaskOptions = (taskId: string) => {
    setTasks((prev) =>
      prev.map((task) =>
        task.id === taskId ? { ...task, showOptions: !task.showOptions } : task
      )
    );
  };

  const handleTaskDragEnd = (event: DragEndEvent) => {
    if (!event.over) return;
    const activeId = String(event.active.id);
    const overId = String(event.over.id);
    if (activeId === overId) return;
    setTasks((prev) => reorderDraftTasks(prev, activeId, overId));
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!session) {
      toast.error("ログイン後にご利用いただけます");
      router.push("/login");
      return;
    }

    const normalizedTasks = tasks.map((task) => ({
      title: task.title.trim(),
      notes: task.notes.trim(),
      due: task.due.trim(),
      aiActions: task.aiActions,
    }));

    if (normalizedTasks.length === 0) {
      toast.error("タスクを1件以上追加してください");
      return;
    }

    const missingTitleIndex = normalizedTasks.findIndex((task) => !task.title);
    if (missingTitleIndex !== -1) {
      toast.error(`タスク${missingTitleIndex + 1}のタイトルを入力してください`);
      return;
    }

    const requestTasks = normalizedTasks.map((task) => {
      const payload: Record<string, unknown> = { title: task.title };
      if (task.notes) payload.desc = task.notes;
      if (task.due) payload.due = task.due;
      if (task.aiActions.length > 0) payload.aiActions = task.aiActions;
      return payload;
    });

    const requestBody: Record<string, unknown> = {
      tasks: requestTasks,
    };

    if (model === "high") {
      requestBody.model = "high";
    }

    if (enableLongReason && model === "high") {
      requestBody.enableLongReason = true;
    }

    if (forceRefresh) {
      requestBody.forceRefresh = true;
    }

    startTransition(async () => {
      try {
        const response = await fetch("/api/analyze", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
          let message = "AI解析に失敗しました";
          try {
            const payload = (await response.json()) as { error?: string };
            if (payload?.error) message = payload.error;
          } catch {
            const fallback = await response.text();
            if (fallback) message = fallback;
          }
          throw new Error(message);
        }

        const result = (await response.json()) as {
          tasks: StructuredTask[];
          cacheHit?: boolean;
        };

        onResult?.(result.tasks);
        toast.success(
          result.cacheHit
            ? "過去のAI結果を再利用しました"
            : "AIがタスクを整理しました"
        );
      } catch (error) {
        console.error(error);
        toast.error(
          error instanceof Error
            ? error.message
            : "AI解析でエラーが発生しました"
        );
      }
    });
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-6 rounded-lg border border-border/60 bg-card/40 p-5"
    >
      <DndContext sensors={sensors} onDragEnd={handleTaskDragEnd}>
        <SortableContext
          items={tasks.map((task) => task.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="flex flex-col gap-5">
            {tasks.map((task, index) => (
              <SortableDraftTaskCard
                key={task.id}
                task={task}
                index={index}
                isSubmitting={isSubmitting}
                canRemove={tasks.length > 1}
                onRemove={() => handleRemoveTask(task.id)}
                onFieldChange={(field, value) =>
                  handleTaskFieldChange(task.id, field, value)
                }
                onToggleAction={(action) => toggleTaskAction(task.id, action)}
                onToggleOptions={() => toggleTaskOptions(task.id)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={handleAddTask}
          disabled={!canAddTask || isSubmitting}
        >
          タスクを追加
        </Button>
        {!canAddTask ? (
          <span className="text-xs text-muted-foreground">
            追加は最大{MAX_TASKS}件までです
          </span>
        ) : null}
      </div>

      <section className="flex flex-col gap-3 rounded-md border border-border/50 bg-background/60 p-4 shadow-sm">
        <h2 className="text-base font-semibold tracking-tight">AIオプション</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-2">
            <span className="text-sm font-medium text-muted-foreground">
              モデル
            </span>
            <select
              value={model}
              onChange={(event) =>
                setModel(event.target.value === "high" ? "high" : "default")
              }
              className="min-h-[36px] rounded-md border border-border/60 bg-background px-3 py-2 text-sm shadow-sm disabled:opacity-60"
              disabled={isSubmitting}
            >
              <option value="default">標準 (高速・月内無料枠対象)</option>
              <option value="high">高精度 (プレミアム)</option>
            </select>
          </label>

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={enableLongReason}
              onChange={(event) => setEnableLongReason(event.target.checked)}
              disabled={model !== "high" || isSubmitting}
              className="h-4 w-4"
            />
            <div className="flex flex-col">
              <span className="text-sm font-medium text-muted-foreground">
                詳細な理由説明を1件追加
              </span>
              <span className="text-xs text-muted-foreground">
                プレミアムモデル利用時のみ利用できます。
              </span>
            </div>
          </label>

          <label className="flex items-center gap-2 sm:col-span-2">
            <input
              type="checkbox"
              checked={forceRefresh}
              onChange={(event) => setForceRefresh(event.target.checked)}
              disabled={isSubmitting}
              className="h-4 w-4"
            />
            <div className="flex flex-col">
              <span className="text-sm font-medium text-muted-foreground">
                キャッシュを無効化して再解析する
              </span>
              <span className="text-xs text-muted-foreground">
                直近24時間の結果が再利用されるのを避けたい場合にオンにしてください。
              </span>
            </div>
          </label>
        </div>
      </section>

      <Button type="submit" size="lg" disabled={isSubmitting}>
        {isSubmitting ? <LoadingSpinner label="AIが整理中..." /> : "AIで整理"}
      </Button>
    </form>
  );
}

type SortableDraftTaskCardProps = {
  task: DraftTask;
  index: number;
  isSubmitting: boolean;
  canRemove: boolean;
  onRemove: () => void;
  onFieldChange: (field: "title" | "notes" | "due", value: string) => void;
  onToggleAction: (action: string) => void;
  onToggleOptions: () => void;
};

function SortableDraftTaskCard({
  task,
  index,
  isSubmitting,
  canRemove,
  onRemove,
  onFieldChange,
  onToggleAction,
  onToggleOptions,
}: SortableDraftTaskCardProps) {
  const sortable = useSortable({ id: task.id, disabled: isSubmitting });
  const style = {
    transform: CSS.Transform.toString(sortable.transform),
    transition: sortable.isDragging ? "none" : sortable.transition,
    zIndex: sortable.isDragging ? DRAG_ITEM_Z_INDEX : "auto",
  };

  const dragAttributes = isSubmitting
    ? {}
    : ((sortable.attributes ?? {}) as unknown as Record<string, unknown>);
  const dragListeners = isSubmitting
    ? {}
    : ((sortable.listeners ?? {}) as unknown as Record<string, unknown>);

  const taskNumber = index + 1;

  return (
    <section
      ref={isSubmitting ? undefined : sortable.setNodeRef}
      style={style}
      {...dragAttributes}
      {...dragListeners}
      className={cn(
        "flex flex-col gap-4 rounded-md border border-border/50 bg-background/60 p-4 shadow-sm transition",
        isSubmitting
          ? "cursor-not-allowed opacity-90"
          : "cursor-grab select-none active:cursor-grabbing",
        sortable.isDragging ? "ring-2 ring-primary/40 shadow-lg" : undefined
      )}
      aria-label={`タスク入力 ${taskNumber}`}
    >
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold tracking-tight">
          タスク {taskNumber}
        </h2>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onToggleOptions}
            disabled={isSubmitting}
            className="flex items-center gap-1 text-sm"
          >
            {task.showOptions ? (
              <ChevronUp className="h-4 w-4" aria-hidden />
            ) : (
              <ChevronDown className="h-4 w-4" aria-hidden />
            )}
            <span>AIオプション</span>
          </Button>
          {canRemove ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onRemove}
              disabled={isSubmitting}
            >
              削除
            </Button>
          ) : null}
        </div>
      </header>

      <div className="flex flex-col gap-3">
        <label className="flex flex-col gap-2">
          <span className="text-sm font-medium text-muted-foreground">
            タイトル
          </span>
          <Input
            value={task.title}
            onChange={(event) => onFieldChange("title", event.target.value)}
            placeholder="例: 週次レポートを作成する"
            maxLength={120}
            disabled={isSubmitting}
            required
          />
        </label>

        <label className="flex flex-col gap-2">
          <span className="text-sm font-medium text-muted-foreground">
            補足メモ (任意)
          </span>
          <Textarea
            value={task.notes}
            onChange={(event) => onFieldChange("notes", event.target.value)}
            placeholder="AIに伝えたい前提条件や進め方があれば記載してください"
            rows={4}
            maxLength={200}
            disabled={isSubmitting}
          />
        </label>

        <label className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-sm font-medium text-muted-foreground">
            期限 (任意)
          </span>
          <Input
            type="date"
            value={task.due}
            onChange={(event) => onFieldChange("due", event.target.value)}
            className="sm:max-w-64"
            disabled={isSubmitting}
          />
        </label>
      </div>

      <div className="flex flex-col gap-2 border-t border-dashed border-border/40 pt-3">
        {task.showOptions ? (
          <>
            <p className="text-sm font-medium text-muted-foreground">
              追加で依頼するAIアクション (任意)
            </p>
            <p className="text-xs text-muted-foreground/80">
              優先度と実行順の整理は常に行われます。必要なものだけ選択してください。
            </p>
            <div className="flex flex-wrap gap-3">
              {OPTIONAL_AI_ACTIONS.map((option) => {
                const checked = task.aiActions.includes(option.value);
                return (
                  <label
                    key={option.value}
                    className="flex cursor-pointer items-center gap-2 rounded-md border border-border/50 bg-background/40 px-3 py-2 text-sm shadow-sm transition hover:border-primary/60"
                  >
                    <input
                      type="checkbox"
                      className="h-4 w-4 cursor-pointer"
                      checked={checked}
                      onChange={() => onToggleAction(option.value)}
                      disabled={isSubmitting}
                    />
                    <div className="flex flex-col">
                      <span className="font-medium">{option.label}</span>
                      <span className="text-xs text-muted-foreground">
                        {option.description}
                      </span>
                    </div>
                  </label>
                );
              })}
            </div>
          </>
        ) : (
          <p className="text-xs text-muted-foreground">
            ※ AIオプションが必要な場合は「AIオプション」ボタンで開いてください。
          </p>
        )}
      </div>
    </section>
  );
}
