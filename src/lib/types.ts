export type StructuredSubtask = {
  title: string;
  priority: number;
  order: number;
  completed: boolean;
  shortReason?: string;
  estimatedMinutes?: number | null;
};

export type StructuredTask = {
  title: string;
  priority: number;
  order: number;
  category: string;
  subtasks: StructuredSubtask[];
  shortReason?: string;
  longExplanation?: string;
  estimatedMinutes?: number | null;
  dueDate?: string | null;
};

export type AnalyzeTasksResponse = {
  tasks: StructuredTask[];
  usedModel: string;
  cacheHit: boolean;
  rawResponse: string;
  costEstimate: number;
  promptHash: string;
};

export type TaskSortKey = "priority" | "order" | "category";
