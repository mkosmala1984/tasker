import { compareDates } from "./dates";
import { getNextScheduledDate } from "./recurrence";
import type { AppState, Assignee, Category, Completion, Task, TodayFilters, TodayTask } from "./types";

function getLatestCompletion(taskId: string, completions: Completion[]): Completion | undefined {
  return completions
    .filter((completion) => completion.taskId === taskId)
    .sort((left, right) => compareDates(right.completedDate, left.completedDate))[0];
}

export function getCurrentScheduledDate(task: Task, completions: Completion[]): string {
  const latestCompletion = getLatestCompletion(task.id, completions);
  if (!latestCompletion) {
    return task.startDate;
  }

  return getNextScheduledDate(latestCompletion.completedDate, task.recurrence);
}

function wasPostponedFromToday(state: AppState, taskId: string, today: string): boolean {
  return state.postponements.some((postponement) => postponement.taskId === taskId && postponement.fromDate === today);
}

function findCategory(categories: Category[], id: string): Category {
  return categories.find((category) => category.id === id) ?? { id, name: "Nieznana kategoria" };
}

function findAssignee(assignees: Assignee[], id: string): Assignee {
  return assignees.find((assignee) => assignee.id === id) ?? { id, name: "Nieznana osoba" };
}

function matchesFilters(task: Task, filters: TodayFilters): boolean {
  const categoryMatches = filters.categoryId === "" || task.categoryId === filters.categoryId;
  const assigneeMatches = filters.assigneeId === "" || task.assigneeId === filters.assigneeId;
  return categoryMatches && assigneeMatches;
}

export function buildTodayList(state: AppState, today: string, filters: TodayFilters): TodayTask[] {
  return state.tasks
    .filter((task) => task.active)
    .filter((task) => matchesFilters(task, filters))
    .map((task) => ({
      task,
      scheduledDate: getCurrentScheduledDate(task, state.completions)
    }))
    .filter((item) => compareDates(item.scheduledDate, today) <= 0)
    .filter((item) => !wasPostponedFromToday(state, item.task.id, today))
    .map((item) => ({
      task: item.task,
      category: findCategory(state.categories, item.task.categoryId),
      assignee: findAssignee(state.assignees, item.task.assigneeId),
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
