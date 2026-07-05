import { useMemo, useState } from "react";
import { addDays, getTodayString } from "../domain/dates";
import { buildTodayList } from "../domain/todayList";
import { addTask, completeTask, deactivateTask, postponeTask, updateTask } from "../domain/tasks";
import type { AppState, TaskDraft, TodayFilters } from "../domain/types";
import { loadState, saveState } from "../storage/taskerStorage";

export function useTaskerState(now: Date = new Date()) {
  const initial = useMemo(() => loadState(), []);
  const [state, setState] = useState<AppState>(initial.state);
  const [storageError] = useState(initial.error);
  const [filters, setFilters] = useState<TodayFilters>({ categoryId: "", assigneeId: "" });
  const today = getTodayString(now);

  function persist(nextState: AppState) {
    setState(nextState);
    saveState(nextState);
  }

  return {
    state,
    storageError,
    filters,
    setFilters,
    today,
    todayTasks: buildTodayList(state, today, filters),
    addTask: (draft: TaskDraft) => persist(addTask(state, draft, now.toISOString())),
    updateTask: (taskId: string, draft: TaskDraft) => persist(updateTask(state, taskId, draft, now.toISOString())),
    deactivateTask: (taskId: string) => persist(deactivateTask(state, taskId, now.toISOString())),
    completeTask: (taskId: string, scheduledDate: string) => persist(completeTask(state, taskId, scheduledDate, today)),
    postponeTask: (taskId: string) => persist(postponeTask(state, taskId, today, addDays(today, 1), now.toISOString()))
  };
}
