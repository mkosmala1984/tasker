import { create } from "zustand";
import {
  addCategory as addCategoryDomain,
  addPriority as addPriorityDomain,
  addTaskType as addTaskTypeDomain,
  deactivateCategory as deactivateCategoryDomain,
  movePriority as movePriorityDomain,
  moveTaskType as moveTaskTypeDomain,
  setPriorityActive as setPriorityActiveDomain,
  setTaskTypeActive as setTaskTypeActiveDomain,
  updateCategory as updateCategoryDomain,
  updatePriority as updatePriorityDomain,
  updateTaskType as updateTaskTypeDomain,
  type CategoryInput,
  type DictionaryInput,
  type PriorityInput
} from "../domain/configuration";
import { addDays, getTodayString } from "../domain/dates";
import { emptyHistoryFilters, type HistoryFilters } from "../domain/history";
import { addTask, completeTask, deactivateTask, postponeTask, updateTask } from "../domain/tasks";
import type { AppState, AppView, TaskDraft, TodayFilters } from "../domain/types";
import { previewImport as previewImportDomain, type ImportPreview } from "../storage/taskerBackup";
import { loadState, saveState } from "../storage/taskerStorage";

export const emptyFilters: TodayFilters = { categoryId: "", assigneeId: "", taskTypeId: "", priorityId: "" };

function createId(prefix: string): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

export type TaskerStore = {
  state: AppState;
  storageError?: string;
  filters: TodayFilters;
  historyFilters: HistoryFilters;
  view: AppView;
  taskEditorTaskId?: string | null;
  setFilters: (filters: TodayFilters) => void;
  setHistoryFilters: (filters: HistoryFilters) => void;
  setView: (view: AppView) => void;
  openTaskCreate: () => void;
  openTaskEdit: (taskId: string) => void;
  closeTaskEditor: () => void;
  addCategory: (input: CategoryInput) => void;
  updateCategory: (categoryId: string, input: CategoryInput) => void;
  deactivateCategory: (categoryId: string) => void;
  addTaskType: (input: DictionaryInput) => void;
  updateTaskType: (taskTypeId: string, input: DictionaryInput) => void;
  setTaskTypeActive: (taskTypeId: string, active: boolean) => void;
  moveTaskType: (taskTypeId: string, direction: "up" | "down") => void;
  addPriority: (input: PriorityInput) => void;
  updatePriority: (priorityId: string, input: PriorityInput) => void;
  setPriorityActive: (priorityId: string, active: boolean) => void;
  movePriority: (priorityId: string, direction: "up" | "down") => void;
  previewImport: (raw: string) => ImportPreview;
  applyImport: (preview: ImportPreview) => void;
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
    historyFilters: emptyHistoryFilters,
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
  setHistoryFilters: (historyFilters) => set({ historyFilters }),
  setView: (view) => set({ view, taskEditorTaskId: undefined }),
  openTaskCreate: () => set({ view: "tasks", taskEditorTaskId: null }),
  openTaskEdit: (taskId) => set({ view: "tasks", taskEditorTaskId: taskId }),
  closeTaskEditor: () => set({ taskEditorTaskId: undefined }),
  addCategory: (input) => {
    set(persist(addCategoryDomain(get().state, input, () => createId("category"))));
  },
  updateCategory: (categoryId, input) => {
    set(persist(updateCategoryDomain(get().state, categoryId, input)));
  },
  deactivateCategory: (categoryId) => {
    set(persist(deactivateCategoryDomain(get().state, categoryId)));
  },
  addTaskType: (input) => {
    set(persist(addTaskTypeDomain(get().state, input, () => createId("task-type"))));
  },
  updateTaskType: (taskTypeId, input) => {
    set(persist(updateTaskTypeDomain(get().state, taskTypeId, input)));
  },
  setTaskTypeActive: (taskTypeId, active) => {
    set(persist(setTaskTypeActiveDomain(get().state, taskTypeId, active)));
  },
  moveTaskType: (taskTypeId, direction) => {
    set(persist(moveTaskTypeDomain(get().state, taskTypeId, direction)));
  },
  addPriority: (input) => {
    set(persist(addPriorityDomain(get().state, input, () => createId("priority"))));
  },
  updatePriority: (priorityId, input) => {
    set(persist(updatePriorityDomain(get().state, priorityId, input)));
  },
  setPriorityActive: (priorityId, active) => {
    set(persist(setPriorityActiveDomain(get().state, priorityId, active)));
  },
  movePriority: (priorityId, direction) => {
    set(persist(movePriorityDomain(get().state, priorityId, direction)));
  },
  previewImport: (raw) => previewImportDomain(raw),
  applyImport: (preview) => {
    set(persist(preview.state));
  },
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
