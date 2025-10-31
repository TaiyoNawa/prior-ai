"use client";

import { DndContext, type DragEndEvent, closestCenter } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { RefreshCcw, Sparkles } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { useStandardSortableSensors } from "@/lib/dnd";

import { SubtaskItem } from "./SubtaskItem";

import type { StructuredSubtask } from "@/lib/types";

interface TaskDetailPanelProps {
  taskId: string;
  subtasks: Array<StructuredSubtask & { clientId: string }>;
  onSubtaskToggle: (subtaskId: string) => void;
  onSubtaskTitleChange: (subtaskId: string, title: string) => void;
  onSubtaskPriorityChange: (subtaskId: string, priority: number) => void;
  onSubtaskRemove: (subtaskId: string) => void;
  onSubtaskAdd: (payload: { title: string; priority: number }) => void;
  onSubtaskReorder: (payload: { activeId: string; overId: string }) => void;
  onRequestReanalyze?: () => void;
  canAddSubtask: boolean;
}

const MAX_SUBTASKS = 10;

export function TaskDetailPanel({
  taskId,
  subtasks,
  onSubtaskToggle,
  onSubtaskTitleChange,
  onSubtaskPriorityChange,
  onSubtaskRemove,
  onSubtaskAdd,
  onSubtaskReorder,
  onRequestReanalyze,
  canAddSubtask,
}: TaskDetailPanelProps) {
  // NOTE: サブタスク追加フォームの入力値をローカルに保持
  const [newTitle, setNewTitle] = useState("");
  const [newPriority, setNewPriority] = useState(0);

  // NOTE: メインリストと同じドラッグ感度で動作させる
  const sensors = useStandardSortableSensors();

  // サブタスクをドラッグした際に順序を再計算する
  const handleDragEnd = (event: DragEndEvent) => {
    if (!event.over || event.active.id === event.over.id) {
      return;
    }
    onSubtaskReorder({
      activeId: String(event.active.id),
      overId: String(event.over.id),
    });
  };

  const handleAddSubtask = () => {
    if (!newTitle.trim()) {
      return;
    }
    onSubtaskAdd({
      title: newTitle.trim(),
      priority: Number(newPriority) || 0,
    });
    setNewTitle("");
    setNewPriority(0);
  };

  // タスク詳細パネル内の構造
  return (
    <div className="flex flex-col gap-5 rounded-lg border border-border/40 bg-card/50 p-4">
      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          サブタスク
        </h3>
        <p className="text-xs text-muted-foreground/80">
          最大{MAX_SUBTASKS}
          件までサブタスクを作成できます。ドラッグで順序を変更すると order
          が更新されます。
        </p>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={subtasks.map((subtask) => subtask.clientId)}
          strategy={verticalListSortingStrategy}
        >
          <div className="flex flex-col gap-3">
            {subtasks.length === 0 ? (
              <div className="rounded-md border border-dashed border-border/60 px-4 py-6 text-center text-sm text-muted-foreground">
                サブタスクはまだありません。
              </div>
            ) : (
              subtasks.map((subtask) => (
                <SubtaskItem
                  key={subtask.clientId}
                  subtask={subtask}
                  onToggleCompleted={() => onSubtaskToggle(subtask.clientId)}
                  onTitleChange={(title) =>
                    onSubtaskTitleChange(subtask.clientId, title)
                  }
                  onPriorityChange={(priority) =>
                    onSubtaskPriorityChange(subtask.clientId, priority)
                  }
                  onRemove={() => onSubtaskRemove(subtask.clientId)}
                />
              ))
            )}
          </div>
        </SortableContext>
      </DndContext>

      <div className="flex flex-col gap-3 rounded-md bg-muted/30 p-3">
        <div className="flex flex-col gap-2">
          <label
            className="text-sm font-medium text-muted-foreground"
            htmlFor={`${taskId}-subtask-title`}
          >
            サブタスクを追加
          </label>
          <Input
            id={`${taskId}-subtask-title`}
            value={newTitle}
            onChange={(event) => setNewTitle(event.target.value)}
            placeholder="例: ユーザーインタビューの質問を用意する"
            maxLength={120}
            disabled={!canAddSubtask}
          />
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <label
            className="flex items-center gap-2"
            htmlFor={`${taskId}-subtask-priority`}
          >
            優先度
            <Input
              id={`${taskId}-subtask-priority`}
              type="number"
              value={newPriority}
              onChange={(event) =>
                setNewPriority(Number(event.target.value) || 0)
              }
              className="w-20"
              min={0}
              max={5}
              disabled={!canAddSubtask}
            />
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            onClick={handleAddSubtask}
            disabled={!canAddSubtask}
          >
            追加する
          </Button>
          {!canAddSubtask ? (
            <span className="text-xs text-muted-foreground">
              サブタスクは最大{MAX_SUBTASKS}件です。
            </span>
          ) : null}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          AIオプション
        </h3>
        <p className="text-xs text-muted-foreground/80">
          プレミアムモデル利用時は、サブタスクの優先度を再解析して最新の推定を取得できます。
        </p>
        <Button
          type="button"
          variant="secondary"
          className="w-fit"
          onClick={() => onRequestReanalyze?.()}
          disabled={!onRequestReanalyze}
        >
          <Sparkles className="mr-2 h-4 w-4" /> サブタスクをAIで再評価
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="w-fit"
          onClick={() => onRequestReanalyze?.()}
          disabled={!onRequestReanalyze}
        >
          <RefreshCcw className="mr-2 h-4 w-4" /> 最新のAI結果を取得
        </Button>
      </div>
    </div>
  );
}
