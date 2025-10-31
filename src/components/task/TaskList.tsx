"use client";

import { DndContext, type DragEndEvent } from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
  type ReactNode,
} from "react";

import { TaskCard } from "@/components/task/TaskCard";
import { TaskDetailPanel } from "@/components/task/TaskDetailPanel";

import { useStandardSortableSensors } from "@/lib/dnd";
import { DRAG_ITEM_Z_INDEX } from "@/lib/dnd";

import type {
  StructuredSubtask,
  StructuredTask,
  TaskSortKey,
} from "@/lib/types";

// TODO(prior-ai/ui-roadmap):
// - Prismaスキーマでサブタスクを独立モデル化する（対応済み）
// - タスク一覧UIをアコーディオン+ドラッグ&ドロップ対応に刷新する
// - サブタスク編集/優先度/完了トグルの操作パターンを設計する
// - PrismaクエリをuserIdスコープで共通化しセキュリティを担保する
// - 後続でテスト/README/環境変数ドキュメントを更新する

// NOTE: この後 TaskDetailPanel.tsx / SubtaskItem.tsx / TaskCard.tsx を改修し、APIとの永続化処理を追加予定

interface TaskListProps {
  tasks: StructuredTask[];
  withControls?: boolean;
  onTaskOrderChange?: (tasks: StructuredTask[]) => void;
  onSubtaskChange?: (taskIndex: number, subtasks: StructuredSubtask[]) => void;
}

type ManagedSubtask = StructuredSubtask & { clientId: string };
type ManagedTask = Omit<StructuredTask, "subtasks"> & {
  clientId: string;
  subtasks: ManagedSubtask[];
};

const sortLabels: Record<TaskSortKey, string> = {
  priority: "優先度が高い順",
  order: "実行順",
  category: "カテゴリ別",
};

function createClientId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function attachMeta(source: StructuredTask[]): ManagedTask[] {
  return source.map((task) => ({
    ...task,
    order: task.order ?? 0,
    clientId: createClientId("task"),
    subtasks: task.subtasks.slice(0, 10).map((subtask, index) => ({
      title: subtask.title,
      priority: subtask.priority ?? 0,
      order: subtask.order ?? index + 1,
      completed: subtask.completed ?? false,
      shortReason: subtask.shortReason,
      estimatedMinutes: subtask.estimatedMinutes,
      clientId: createClientId("subtask"),
    })),
  }));
}

function reorder<T>(
  items: T[],
  fromId: string,
  toId: string,
  getId: (item: T) => string
) {
  const copy = [...items];
  const fromIndex = copy.findIndex((item) => getId(item) === fromId);
  const toIndex = copy.findIndex((item) => getId(item) === toId);
  if (fromIndex === -1 || toIndex === -1) return copy;
  const [moved] = copy.splice(fromIndex, 1);
  copy.splice(toIndex, 0, moved);
  return copy;
}

function toStructuredTasks(tasks: ManagedTask[]): StructuredTask[] {
  return tasks.map((task, index) => ({
    title: task.title,
    priority: task.priority,
    order: index + 1,
    category: task.category,
    shortReason: task.shortReason,
    longExplanation: task.longExplanation,
    estimatedMinutes: task.estimatedMinutes,
    dueDate: task.dueDate,
    subtasks: task.subtasks.map((subtask, subIndex) => ({
      title: subtask.title,
      priority: subtask.priority,
      order: subIndex + 1,
      completed: subtask.completed,
      shortReason: subtask.shortReason,
      estimatedMinutes: subtask.estimatedMinutes,
    })),
  }));
}

function stripClientMeta(subtask: ManagedSubtask): StructuredSubtask {
  return {
    title: subtask.title,
    priority: subtask.priority,
    order: subtask.order,
    completed: subtask.completed,
    shortReason: subtask.shortReason,
    estimatedMinutes: subtask.estimatedMinutes,
  };
}

function SortableTaskRow({
  task,
  isExpanded,
  onToggle,
  children,
  dragDisabled,
}: {
  task: ManagedTask;
  isExpanded: boolean;
  onToggle: () => void;
  children: ReactNode;
  dragDisabled: boolean;
}) {
  const sortable = useSortable({ id: task.clientId, disabled: dragDisabled });
  const style = {
    transform: CSS.Transform.toString(sortable.transform),
    transition: sortable.isDragging ? "none" : sortable.transition,
    zIndex: sortable.isDragging ? DRAG_ITEM_Z_INDEX : "auto",
  };

  const dragProps = dragDisabled
    ? undefined
    : {
        attributes: (sortable.attributes ?? {}) as unknown as Record<
          string,
          unknown
        >,
        listeners: (sortable.listeners ?? {}) as unknown as Record<
          string,
          unknown
        >,
        setNodeRef: sortable.setNodeRef,
        style,
        isDragging: sortable.isDragging,
      };

  return (
    <li className="flex flex-col gap-3">
      <TaskCard
        task={task}
        isExpanded={isExpanded}
        onToggle={onToggle}
        dragBindings={dragProps}
      />
      {isExpanded ? children : null}
    </li>
  );
}

export function TaskList({
  tasks,
  withControls = true,
  onTaskOrderChange,
  onSubtaskChange,
}: TaskListProps) {
  // NOTE: ドラッグの感度を揃えるため、共通センサーを利用
  const sensors = useStandardSortableSensors();

  const [managedTasks, setManagedTasks] = useState<ManagedTask[]>(() =>
    attachMeta(tasks)
  );
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<TaskSortKey>("order");

  useEffect(() => {
    const next = attachMeta(tasks);
    setManagedTasks(next);
    setExpandedTaskId(next.length > 0 ? next[0].clientId : null);
  }, [tasks]);

  const sortedTasks = useMemo(() => {
    const copy = [...managedTasks];
    switch (sortKey) {
      case "priority":
        return copy.sort((a, b) => a.priority - b.priority);
      case "order":
        return copy.sort((a, b) => a.order - b.order);
      case "category":
        return copy.sort((a, b) => a.category.localeCompare(b.category));
      default:
        return copy;
    }
  }, [managedTasks, sortKey]);

  const isManualOrdering = sortKey === "order";

  const handleTaskDragEnd = (event: DragEndEvent) => {
    if (!isManualOrdering) return;
    const overId = event.over ? String(event.over.id) : null;
    const activeId = String(event.active.id);
    if (!overId || activeId === overId) {
      return;
    }

    setManagedTasks((prev) => {
      const reordered = reorder(
        prev,
        activeId,
        overId,
        (item) => item.clientId
      ).map((task, index) => ({
        ...task,
        order: index + 1,
      }));
      onTaskOrderChange?.(toStructuredTasks(reordered));
      return reordered;
    });
  };

  // タスクをクリックしたときに詳細を開閉する関数
  const toggleTask = useCallback((taskId: string) => {
    setExpandedTaskId((current) => (current === taskId ? null : taskId));
  }, []);

  const handleSubtaskReorder = (
    taskId: string,
    payload: { activeId: string; overId: string }
  ) => {
    setManagedTasks((prev) => {
      const updated = prev.map((task) => {
        if (task.clientId !== taskId) return task;
        const reordered = reorder(
          task.subtasks,
          payload.activeId,
          payload.overId,
          (subtask) => subtask.clientId
        ).map((subtask, index) => ({
          ...subtask,
          order: index + 1,
        }));
        onSubtaskChange?.(
          prev.findIndex((item) => item.clientId === taskId),
          reordered.map(stripClientMeta)
        );
        return {
          ...task,
          subtasks: reordered,
        };
      });
      return updated;
    });
  };

  const handleSubtaskToggle = (taskId: string, subtaskId: string) => {
    setManagedTasks((prev) =>
      prev.map((task) => {
        if (task.clientId !== taskId) return task;
        const subtasks = task.subtasks.map((subtask) =>
          subtask.clientId === subtaskId
            ? {
                ...subtask,
                completed: !subtask.completed,
              }
            : subtask
        );
        return { ...task, subtasks };
      })
    );
  };

  const handleSubtaskTitleChange = (
    taskId: string,
    subtaskId: string,
    title: string
  ) => {
    setManagedTasks((prev) =>
      prev.map((task) => {
        if (task.clientId !== taskId) return task;
        const subtasks = task.subtasks.map((subtask) =>
          subtask.clientId === subtaskId ? { ...subtask, title } : subtask
        );
        return { ...task, subtasks };
      })
    );
  };

  const handleSubtaskPriorityChange = (
    taskId: string,
    subtaskId: string,
    priority: number
  ) => {
    const clampedPriority = Math.max(0, Math.min(priority, 5));
    setManagedTasks((prev) =>
      prev.map((task) => {
        if (task.clientId !== taskId) return task;
        const subtasks = task.subtasks.map((subtask) =>
          subtask.clientId === subtaskId
            ? { ...subtask, priority: clampedPriority }
            : subtask
        );
        return { ...task, subtasks };
      })
    );
  };

  const handleSubtaskRemove = (taskId: string, subtaskId: string) => {
    setManagedTasks((prev) =>
      prev.map((task) => {
        if (task.clientId !== taskId) return task;
        const subtasks = task.subtasks
          .filter((subtask) => subtask.clientId !== subtaskId)
          .map((subtask, index) => ({ ...subtask, order: index + 1 }));
        return { ...task, subtasks };
      })
    );
  };

  const handleSubtaskAdd = (
    taskId: string,
    payload: { title: string; priority: number }
  ) => {
    setManagedTasks((prev) =>
      prev.map((task) => {
        if (task.clientId !== taskId) return task;
        if (task.subtasks.length >= 10) return task;
        const newSubtask: ManagedSubtask = {
          title: payload.title,
          priority: Math.max(0, Math.min(payload.priority, 5)),
          order: task.subtasks.length + 1,
          completed: false,
          clientId: createClientId("subtask"),
        };
        return { ...task, subtasks: [...task.subtasks, newSubtask] };
      })
    );
  };

  if (managedTasks.length === 0) {
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
          {!isManualOrdering ? (
            <span className="text-xs text-muted-foreground">
              ドラッグで並び替えたい場合は「実行順」を選択してください。
            </span>
          ) : null}
        </div>
      ) : null}

      <DndContext sensors={sensors} onDragEnd={handleTaskDragEnd}>
        <SortableContext
          items={sortedTasks.map((task) => task.clientId)}
          strategy={verticalListSortingStrategy}
        >
          <ul className="flex flex-col gap-4" role="list">
            {sortedTasks.map((task) => (
              <SortableTaskRow
                key={task.clientId}
                task={task}
                isExpanded={expandedTaskId === task.clientId}
                onToggle={() => toggleTask(task.clientId)}
                dragDisabled={!isManualOrdering}
              >
                <TaskDetailPanel
                  taskId={task.clientId}
                  subtasks={task.subtasks}
                  canAddSubtask={task.subtasks.length < 10}
                  onSubtaskReorder={(payload) =>
                    handleSubtaskReorder(task.clientId, payload)
                  }
                  onSubtaskToggle={(subtaskId) =>
                    handleSubtaskToggle(task.clientId, subtaskId)
                  }
                  onSubtaskTitleChange={(subtaskId, title) =>
                    handleSubtaskTitleChange(task.clientId, subtaskId, title)
                  }
                  onSubtaskPriorityChange={(subtaskId, priority) =>
                    handleSubtaskPriorityChange(
                      task.clientId,
                      subtaskId,
                      priority
                    )
                  }
                  onSubtaskRemove={(subtaskId) =>
                    handleSubtaskRemove(task.clientId, subtaskId)
                  }
                  onSubtaskAdd={(payload) =>
                    handleSubtaskAdd(task.clientId, payload)
                  }
                />
              </SortableTaskRow>
            ))}
          </ul>
        </SortableContext>
      </DndContext>
    </div>
  );
}
