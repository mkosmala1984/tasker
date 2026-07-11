import { compareDates } from "./dates";
import { getNextScheduledDate } from "./recurrence";
import type { AppState, Assignee, Category, Completion, Postponement, Priority, Task, TaskType, TodayFilters, TodayTask, TodayTaskGroup } from "./types";

function getLatestCompletion(taskId: string, completions: Completion[]): Completion | undefined {
  return completions
    .filter((completion) => completion.taskId === taskId)
    .sort((left, right) => compareDates(right.completedDate, left.completedDate))[0];
}

function wasCompleted(taskId: string, scheduledDate: string, completions: Completion[]): boolean {
  return completions.some((completion) => completion.taskId === taskId && completion.scheduledDate === scheduledDate);
}

export function getCurrentScheduledDate(task: Task, completions: Completion[]): string | undefined {
  if (task.schedule.mode === "oneTime") {
    return wasCompleted(task.id, task.schedule.date, completions) ? undefined : task.schedule.date;
  }

  const latestCompletion = getLatestCompletion(task.id, completions);
  if (!latestCompletion) {
    return task.schedule.startDate;
  }

  return getNextScheduledDate(latestCompletion.completedDate, task.schedule.recurrence);
}

function getLatestPostponement(taskId: string, postponements: Postponement[]): Postponement | undefined {
  return postponements
    .filter((postponement) => postponement.taskId === taskId)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0];
}

function isHiddenByPostponement(state: AppState, taskId: string, today: string): boolean {
  const latestPostponement = getLatestPostponement(taskId, state.postponements);
  return latestPostponement !== undefined && compareDates(today, latestPostponement.toDate) < 0;
}

function findCategory(categories: Category[], id: string): Category {
  return categories.find((category) => category.id === id) ?? { id, name: "Nieznana kategoria", color: "#868e96" };
}

function findAssignee(assignees: Assignee[], id: string): Assignee {
  return assignees.find((assignee) => assignee.id === id) ?? { id, name: "Nieznana osoba" };
}

function findTaskType(taskTypes: TaskType[], id: string): TaskType {
  return taskTypes.find((taskType) => taskType.id === id) ?? { id, name: "Nieznany typ", active: false, order: 0 };
}

function findPriority(priorities: Priority[], id: string): Priority {
  return priorities.find((priority) => priority.id === id) ?? { id, name: "Nieznany priorytet", active: false, order: 0 };
}

function buildTodayTaskItem(state: AppState, task: Task, today: string): TodayTask | undefined {
  const scheduledDate = getCurrentScheduledDate(task, state.completions);
  if (scheduledDate === undefined || compareDates(scheduledDate, today) > 0 || isHiddenByPostponement(state, task.id, today)) {
    return undefined;
  }

  return {
    task,
    category: findCategory(state.categories, task.categoryId),
    assignee: findAssignee(state.assignees, task.assigneeId),
    taskType: findTaskType(state.taskTypes, task.taskTypeId),
    priority: findPriority(state.priorities, task.priorityId),
    scheduledDate,
    isOverdue: compareDates(scheduledDate, today) < 0,
    lastCompletedDate: getLatestCompletion(task.id, state.completions)?.completedDate
  };
}

function buildCompletedTodayItem(state: AppState, task: Task, completion: Completion, today: string): TodayTask {
  return {
    task,
    category: findCategory(state.categories, task.categoryId),
    assignee: findAssignee(state.assignees, task.assigneeId),
    taskType: findTaskType(state.taskTypes, task.taskTypeId),
    priority: findPriority(state.priorities, task.priorityId),
    scheduledDate: completion.scheduledDate,
    isOverdue: compareDates(completion.scheduledDate, today) < 0,
    lastCompletedDate: completion.completedDate
  };
}

function matchesFilters(task: Task, filters: TodayFilters): boolean {
  return (
    (filters.categoryId === "" || task.categoryId === filters.categoryId) &&
    (filters.assigneeId === "" || task.assigneeId === filters.assigneeId) &&
    (filters.taskTypeId === "" || task.taskTypeId === filters.taskTypeId) &&
    (filters.priorityId === "" || task.priorityId === filters.priorityId)
  );
}

export function buildTodayTaskGroup(state: AppState, today: string): TodayTaskGroup {
  const completedToday = state.completions
    .filter((completion) => completion.completedDate === today)
    .map((completion) => ({
      completion,
      task: state.tasks.find((task) => task.id === completion.taskId)
    }))
    .filter((item): item is { completion: Completion; task: Task } => item.task !== undefined && item.task.active)
    .map((item) => buildCompletedTodayItem(state, item.task, item.completion, today))
    .sort((left, right) => {
      const byDate = compareDates(left.scheduledDate, right.scheduledDate);
      if (byDate !== 0) {
        return byDate;
      }

      return left.task.title.localeCompare(right.task.title, "pl");
    });

  const completedTodayIds = new Set(completedToday.map((item) => item.task.id));

  const items = state.tasks
    .filter((task) => task.active)
    .map((task) => buildTodayTaskItem(state, task, today))
    .filter((item): item is TodayTask => item !== undefined)
    .sort((left, right) => {
      const byDate = compareDates(left.scheduledDate, right.scheduledDate);
      if (byDate !== 0) {
        return byDate;
      }

      return left.task.title.localeCompare(right.task.title, "pl");
    });

  return {
    active: items.filter((item) => !completedTodayIds.has(item.task.id)),
    completedToday
  };
}

export function buildTodayList(state: AppState, today: string, filters: TodayFilters): TodayTask[] {
  return buildTodayTaskGroup(state, today).active
    .filter((item) => matchesFilters(item.task, filters));
}
