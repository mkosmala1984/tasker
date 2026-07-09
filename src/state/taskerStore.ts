import { create } from "zustand";
import { addDays, getTodayString } from "../domain/dates";
import { addTask, completeTask, deactivateTask, postponeTask, updateTask } from "../domain/tasks";
import type { AppState, AppView, TaskDraft, TodayFilters } from "../domain/types";
import { loadState, saveState } from "../storage/taskerStorage";

export const emptyFilters: TodayFilters = { categoryId: "", assigneeId: "", taskTypeId: "", priorityId: "" };

export type TaskerStore = {
  state: AppState;
  storageError?: string;
  filters: TodayFilters;
  view: AppView;
  taskEditorTaskId?: string | null;
  setFilters: (filters: TodayFilters) => void;
  setView: (view: AppView) => void;
  openTaskCreate: () => void;
  openTaskEdit: (taskId: string) => void;
  closeTaskEditor: () => void;
  addTask: (draft: TaskDraft, now?: Date) => void;
  updateTask: (taskId: string, draft: TaskDraft, now?: Date) => void;
  deactivateTask: (taskId: string, now?: Date) => void;
  completeTask: (taskId: string, scheduledDate: string, now?: Date) => void;
  postponeTask: (taskId: string, now?: Date) => void;
  reset: () => void;
};

function loadInitialStoreState() {
  const initial = loadState();
  return {
    state: initial.state,
    storageError: initial.error,
    filters: emptyFilters,
    view: "today" as AppView,
    taskEditorTaskId: undefined
  };
}

function persist(nextState: AppState): Pick<TaskerStore, "state"> {
  saveState(nextState);
  return { state: nextState };
}

export const useTaskerStore = create<TaskerStore>((set, get) => ({
  ...loadInitialStoreState(),
  setFilters: (filters) => set({ filters }),
  setView: (view) => set({ view, taskEditorTaskId: undefined }),
  openTaskCreate: () => set({ view: "tasks", taskEditorTaskId: null }),
  openTaskEdit: (taskId) => set({ view: "tasks", taskEditorTaskId: taskId }),
  closeTaskEditor: () => set({ taskEditorTaskId: undefined }),
  addTask: (draft, now = new Date()) => {
    set(persist(addTask(get().state, draft, now.toISOString())));
  },
  updateTask: (taskId, draft, now = new Date()) => {
    set(persist(updateTask(get().state, taskId, draft, now.toISOString())));
  },
  deactivateTask: (taskId, now = new Date()) => {
    set(persist(deactivateTask(get().state, taskId, now.toISOString())));
  },
  completeTask: (taskId, scheduledDate, now = new Date()) => {
    const today = getTodayString(now);
    set(persist(completeTask(get().state, taskId, scheduledDate, today)));
  },
  postponeTask: (taskId, now = new Date()) => {
    const today = getTodayString(now);
    set(persist(postponeTask(get().state, taskId, today, addDays(today, 1), now.toISOString())));
  },
  reset: () => set(loadInitialStoreState())
}));

export function resetTaskerStore(): void {
  useTaskerStore.getState().reset();
}
