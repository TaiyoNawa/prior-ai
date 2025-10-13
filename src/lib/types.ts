export type StructuredTask = {
  task: string;
  priority: number;
  order: number;
  subtasks: string[];
  category: string;
};

export type AnalyzeTasksResponse = {
  tasks: StructuredTask[];
};

export type TaskSortKey = "priority" | "order" | "category";
