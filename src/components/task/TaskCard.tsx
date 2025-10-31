import { ChevronDown, ChevronUp } from "lucide-react";

import { cn } from "@/lib/utils";

import type { StructuredTask } from "@/lib/types";
import type { CSSProperties } from "react";

type SortableBindings = {
  attributes: Record<string, unknown>;
  listeners: Record<string, unknown>;
  setNodeRef: (node: HTMLElement | null) => void;
  style: CSSProperties;
  isDragging: boolean;
};

interface TaskCardProps {
  task: StructuredTask;
  isExpanded: boolean;
  onToggle: () => void;
  dragBindings?: SortableBindings;
}

function getPriorityColor(priority: number) {
  if (priority <= 2) return "bg-destructive/20 text-destructive";
  if (priority === 3) return "bg-yellow-400/20 text-yellow-600";
  return "bg-primary/20 text-primary-foreground";
}

function formatDueDate(dueDate?: string | null) {
  if (!dueDate) return null;
  try {
    const date = new Date(dueDate);
    return Intl.DateTimeFormat("ja-JP", {
      month: "short",
      day: "numeric",
      weekday: "short",
    }).format(date);
  } catch (error) {
    console.error("dueDate parse error", error);
    return null;
  }
}

export function TaskCard({
  task,
  isExpanded,
  onToggle,
  dragBindings,
}: TaskCardProps) {
  const dueLabel = formatDueDate(task.dueDate);
  const sortable = dragBindings ?? null;

  return (
    <article
      ref={sortable?.setNodeRef}
      style={sortable?.style}
      {...(sortable?.attributes ?? {})}
      {...(sortable?.listeners ?? {})}
      className={cn(
        "rounded-lg border border-border/60 bg-card/80 text-left shadow-sm transition focus:outline-none focus:ring-2 focus:ring-primary",
        sortable ? "cursor-grab select-none active:cursor-grabbing" : undefined,
        sortable?.isDragging
          ? "ring-2 ring-primary/60 shadow-lg"
          : "hover:border-primary/60"
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-3 rounded-lg px-4 py-3"
        aria-expanded={isExpanded}
      >
        <div className="flex flex-1 flex-col gap-1 text-left">
          <p className="text-base font-semibold leading-tight">{task.title}</p>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="rounded-full bg-muted px-2 py-0.5">
              カテゴリ: {task.category}
            </span>
            <span className="rounded-full bg-muted px-2 py-0.5">
              順番: {task.order}
            </span>
            {dueLabel ? (
              <span className="rounded-full bg-muted px-2 py-0.5">
                期限: {dueLabel}
              </span>
            ) : null}
            {typeof task.estimatedMinutes === "number" ? (
              <span className="rounded-full bg-muted px-2 py-0.5">
                目安: {task.estimatedMinutes}分
              </span>
            ) : null}
          </div>
          {task.shortReason ? (
            <p className="text-sm text-muted-foreground">{task.shortReason}</p>
          ) : null}
        </div>
        <span
          className={cn(
            "flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium",
            getPriorityColor(task.priority)
          )}
        >
          <span>優先度 {task.priority}</span>
        </span>
        {isExpanded ? (
          <ChevronUp aria-hidden className="h-5 w-5 text-muted-foreground" />
        ) : (
          <ChevronDown aria-hidden className="h-5 w-5 text-muted-foreground" />
        )}
      </button>
    </article>
  );
}
