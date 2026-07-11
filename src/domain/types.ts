export type RecurrenceRule =
  | { type: "daily" }
  | { type: "everyNDays"; intervalDays: number }
  | { type: "weekly" }
  | { type: "monthly" }
  | { type: "quarterly" };

export type TaskMode = "oneTime" | "recurring";

export type TaskSchedule =
  | { mode: "oneTime"; date: string }
  | { mode: "recurring"; startDate: string; recurrence: RecurrenceRule };

export type Task = {
  id: string;
  title: string;
  categoryId: string;
  assigneeId: string;
  taskTypeId: string;
  priorityId: string;
  schedule: TaskSchedule;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type Category = {
  id: string;
  name: string;
  color: string;
};

export type Assignee = {
  id: string;
  name: string;
};

export type TaskType = {
  id: string;
  name: string;
  active: boolean;
  order: number;
};

export type Priority = {
  id: string;
  name: string;
  active: boolean;
  order: number;
  color?: string;
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
  tasks: Task[];
  categories: Category[];
  assignees: Assignee[];
  taskTypes: TaskType[];
  priorities: Priority[];
  completions: Completion[];
  postponements: Postponement[];
};

export type TodayFilters = {
  categoryId: string;
  assigneeId: string;
  taskTypeId: string;
  priorityId: string;
};

export type TodayTask = {
  task: Task;
  category: Category;
  assignee: Assignee;
  taskType: TaskType;
  priority: Priority;
  scheduledDate: string;
  isOverdue: boolean;
  lastCompletedDate?: string;
};

export type TodayTaskGroup = {
  active: TodayTask[];
  completedToday: TodayTask[];
};

export type TaskDraft = {
  title: string;
  categoryName: string;
  categoryColor?: string;
  assigneeName: string;
  taskTypeId?: string;
  priorityId?: string;
  schedule: TaskSchedule;
  active: boolean;
};

export type AppView = "today" | "tasks" | "calendar" | "categories" | "settings" | "history" | "data";
