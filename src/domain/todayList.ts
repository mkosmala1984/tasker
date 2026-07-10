import { compareDates } from "./dates";
import { getNextScheduledDate } from "./recurrence";
import type { AppState, Assignee, Category, Completion, Postponement, Priority, Task, TaskType, TodayFilters, TodayTask } from "./types";

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

function matchesFilters(task: Task, filters: TodayFilters): boolean {
  return (
    (filters.categoryId === "" || task.categoryId === filters.categoryId) &&
    (filters.assigneeId === "" || task.assigneeId === filters.assigneeId) &&
    (filters.taskTypeId === "" || task.taskTypeId === filters.taskTypeId) &&
    (filters.priorityId === "" || task.priorityId === filters.priorityId)
  );
}

export function buildTodayList(state: AppState, today: string, filters: TodayFilters): TodayTask[] {
  return state.tasks
    .filter((task) => task.active)
    .filter((task) => matchesFilters(task, filters))
    .map((task) => ({
      task,
      scheduledDate: getCurrentScheduledDate(task, state.completions)
    }))
    .filter((item): item is { task: Task; scheduledDate: string } => item.scheduledDate !== undefined)
    .filter((item) => compareDates(item.scheduledDate, today) <= 0)
    .filter((item) => !isHiddenByPostponement(state, item.task.id, today))
    .map((item) => ({
      task: item.task,
      category: findCategory(state.categories, item.task.categoryId),
      assignee: findAssignee(state.assignees, item.task.assigneeId),
      taskType: findTaskType(state.taskTypes, item.task.taskTypeId),
      priority: findPriority(state.priorities, item.task.priorityId),
      scheduledDate: item.scheduledDate,
      isOverdue: compareDates(item.scheduledDate, today) < 0,
      lastCompletedDate: getLatestCompletion(item.task.id, state.completions)?.completedDate
    }))
    .sort((left, right) => {
      const byDate = compareDates(left.scheduledDate, right.scheduledDate);
      if (byDate !== 0) {
        return byDate;
      }
      return left.task.title.localeCompare(right.task.title, "pl");
    });
}
