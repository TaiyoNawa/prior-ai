"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Trash2 } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { DRAG_ITEM_Z_INDEX } from "@/lib/dnd";
import { cn } from "@/lib/utils";

import type { StructuredSubtask } from "@/lib/types";

interface SubtaskItemProps {
  subtask: StructuredSubtask & { clientId: string };
  onToggleCompleted: () => void;
  onTitleChange: (title: string) => void;
  onPriorityChange: (priority: number) => void;
  onRemove: () => void;
  dragDisabled?: boolean;
}

export function SubtaskItem({
  subtask,
  onToggleCompleted,
  onTitleChange,
  onPriorityChange,
  onRemove,
  dragDisabled = false,
}: SubtaskItemProps) {
  // サブタスクのドラッグハンドルを構成
  const sortable = useSortable({
    id: subtask.clientId,
    disabled: dragDisabled,
  });
  const [isFocused, setIsFocused] = useState(false);

  const style = {
    transform: CSS.Transform.toString(sortable.transform),
    transition: sortable.isDragging ? "none" : sortable.transition,
    zIndex: sortable.isDragging ? DRAG_ITEM_Z_INDEX : "auto",
  };

  return (
    <div
      ref={dragDisabled ? undefined : sortable.setNodeRef}
      style={style}
      {...(dragDisabled
        ? {}
        : ((sortable.attributes ?? {}) as unknown as Record<string, unknown>))}
      {...(dragDisabled
        ? {}
        : ((sortable.listeners ?? {}) as unknown as Record<string, unknown>))}
      className={cn(
        "flex flex-col gap-3 rounded-md border border-border/50 bg-background/80 p-3 shadow-sm transition",
        dragDisabled
          ? undefined
          : "cursor-grab select-none active:cursor-grabbing",
        sortable.isDragging ? "ring-2 ring-primary/40 shadow-lg" : undefined
      )}
    >
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={onToggleCompleted}
          className="mt-1 h-6 w-6 rounded-full border border-border/60 bg-background transition hover:border-primary focus:outline-none focus:ring-2 focus:ring-primary"
          aria-pressed={subtask.completed}
          aria-label={`${subtask.title} の完了状態を切り替え`}
        >
          <span
            className="block h-full w-full rounded-full"
            style={{
              backgroundColor: subtask.completed
                ? "rgb(59 130 246)"
                : "transparent",
            }}
          />
        </button>
        <div className="flex flex-1 flex-col gap-2">
          <Input
            value={subtask.title}
            onChange={(event) => onTitleChange(event.target.value)}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            aria-label="サブタスクのタイトル"
            placeholder="サブタスク名を入力"
            className="bg-background"
            maxLength={120}
          />
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <label className="flex items-center gap-1">
              <span>優先度</span>
              <Input
                type="number"
                value={subtask.priority}
                onChange={(event) =>
                  onPriorityChange(Number(event.target.value) || 0)
                }
                className="w-16"
                min={0}
                max={5}
              />
            </label>
            {typeof subtask.estimatedMinutes === "number" ? (
              <span>推定 {subtask.estimatedMinutes} 分</span>
            ) : null}
          </div>
        </div>
      </div>
      <div className="flex justify-end">
        <Button type="button" variant="ghost" size="sm" onClick={onRemove}>
          <Trash2 className="mr-1 h-4 w-4" /> 削除
        </Button>
      </div>
      {isFocused ? (
        <p className="text-xs text-muted-foreground">
          ※ Enterで確定します。最大10件までサブタスクを追加できます。
        </p>
      ) : null}
    </div>
  );
}
