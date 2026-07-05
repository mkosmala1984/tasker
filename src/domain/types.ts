export type RecurrenceRule =
  | { type: "daily" }
  | { type: "everyNDays"; intervalDays: number }
  | { type: "weekly" }
  | { type: "monthly" }
  | { type: "quarterly" };

export type Task = {
  id: string;
  title: string;
  categoryId: string;
  assigneeId: string;
  recurrence: RecurrenceRule;
  startDate: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type Category = {
  id: string;
  name: string;
};

export type Assignee = {
  id: string;
  name: string;
};

export type Completion = {
  id: string;
  taskId: string;
  scheduledDate: string;
  completedDate: string;
};

export type Postponement = {
  id: string;
  taskId: string;
  fromDate: string;
  toDate: string;
  createdAt: string;
};

export type AppState = {
  version: 1;
  tasks: Task[];
  categories: Category[];
  assignees: Assignee[];
  completions: Completion[];
  postponements: Postponement[];
};

export type TodayFilters = {
  categoryId: string;
  assigneeId: string;
};

export type TodayTask = {
  task: Task;
  category: Category;
  assignee: Assignee;
  scheduledDate: string;
  isOverdue: boolean;
  lastCompletedDate?: string;
};

export type TaskDraft = {
  title: string;
  categoryName: string;
  assigneeName: string;
  recurrence: RecurrenceRule;
  startDate: string;
  active: boolean;
};
