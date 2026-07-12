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
import {
  clearJsonHostingCredentials,
  createJsonHostingDocument,
  loadJsonHostingCredentials,
  saveJsonHostingCredentials,
  type JsonHostingCredentials
} from "../storage/jsonHostingStorage";
import { loadState, saveState } from "../storage/taskerStorage";
import {
  createJsonHostingSyncController,
  type JsonHostingSyncController,
  type JsonHostingSyncStatus
} from "./jsonHostingSync";

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
  jsonHostingCredentials?: JsonHostingCredentials;
  jsonHostingStatus: JsonHostingSyncStatus;
  observedRemoteRevision: number;
  observedRemoteUpdatedAt: string;
  filters: TodayFilters;
  historyFilters: HistoryFilters;
  view: AppView;
  selectedCalendarDate: string;
  taskEditorTaskId?: string | null;
  taskEditorInitialDate?: string;
  setFilters: (filters: TodayFilters) => void;
  setHistoryFilters: (filters: HistoryFilters) => void;
  setView: (view: AppView) => void;
  setSelectedCalendarDate: (date: string) => void;
  openTaskCreate: (initialDate?: string) => void;
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
  postponeTask: (taskId: string, scheduledDate: string, toDate: string, now?: Date) => void;
  postponeTaskToDate: (taskId: string, scheduledDate: string, toDate: string, now?: Date) => void;
  postponeTaskToTomorrow: (taskId: string, scheduledDate: string, now?: Date) => void;
  configureJsonHosting: (credentials: JsonHostingCredentials) => void;
  createJsonHostingDocument: () => Promise<void>;
  disconnectJsonHosting: () => void;
  startJsonHostingSync: () => void;
  stopJsonHostingSync: () => void;
  reset: () => void;
};

function loadInitialStoreState() {
  const initial = loadState();
  const today = getTodayString();
  return {
    state: initial.state,
    storageError: initial.error,
    jsonHostingCredentials: loadJsonHostingCredentials(),
    jsonHostingStatus: { kind: "disconnected" } as JsonHostingSyncStatus,
    observedRemoteRevision: 0,
    observedRemoteUpdatedAt: "",
    filters: emptyFilters,
    historyFilters: emptyHistoryFilters,
    view: "today" as AppView,
    selectedCalendarDate: today,
    taskEditorTaskId: undefined,
    taskEditorInitialDate: undefined
  };
}

function persist(nextState: AppState): Pick<TaskerStore, "state"> {
  saveState(nextState);
  if (useTaskerStore.getState().jsonHostingCredentials !== undefined) {
    syncController.scheduleSave(nextState);
  }
  return { state: nextState };
}

export const useTaskerStore = create<TaskerStore>((set, get) => ({
  ...loadInitialStoreState(),
  setFilters: (filters) => set({ filters }),
  setHistoryFilters: (historyFilters) => set({ historyFilters }),
  setView: (view) => set({ view, taskEditorTaskId: undefined, taskEditorInitialDate: undefined }),
  setSelectedCalendarDate: (selectedCalendarDate) => set({ selectedCalendarDate }),
  openTaskCreate: (taskEditorInitialDate) => set({ view: "tasks", taskEditorTaskId: null, taskEditorInitialDate }),
  openTaskEdit: (taskId) => set({ view: "tasks", taskEditorTaskId: taskId, taskEditorInitialDate: undefined }),
  closeTaskEditor: () => set({ taskEditorTaskId: undefined, taskEditorInitialDate: undefined }),
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
  postponeTask: (taskId, scheduledDate, toDate, now = new Date()) => {
    set(persist(postponeTask(get().state, taskId, scheduledDate, toDate, now.toISOString())));
  },
  postponeTaskToDate: (taskId, scheduledDate, toDate, now = new Date()) => {
    set(persist(postponeTask(get().state, taskId, scheduledDate, toDate, now.toISOString())));
  },
  postponeTaskToTomorrow: (taskId, scheduledDate, now = new Date()) => {
    const today = getTodayString(now);
    set(persist(postponeTask(get().state, taskId, scheduledDate, addDays(today, 1), now.toISOString())));
  },
  configureJsonHosting: (credentials) => {
    saveJsonHostingCredentials(credentials);
    syncController.setCredentials(credentials);
    set({ jsonHostingCredentials: credentials, jsonHostingStatus: { kind: "disconnected" } });
    syncController.start();
    syncController.checkForRemoteUpdate();
  },
  createJsonHostingDocument: async () => {
    const state = get().state;
    const updatedAt = new Date().toISOString();
    const previousCredentials = get().jsonHostingCredentials;
    const previousObservedRemoteRevision = get().observedRemoteRevision;
    const previousObservedRemoteUpdatedAt = get().observedRemoteUpdatedAt;
    let activationStarted = false;
    set({ jsonHostingStatus: { kind: "syncing" } });
    try {
      const { credentials, envelope } = await createJsonHostingDocument(state, updatedAt);
      activationStarted = true;
      syncController.stop();
      saveJsonHostingCredentials(credentials);
      set({
        jsonHostingCredentials: credentials,
        jsonHostingStatus: { kind: "disconnected" },
        observedRemoteRevision: envelope.revision,
        observedRemoteUpdatedAt: envelope.updatedAt
      });
      syncController.setCredentials(credentials);
      syncController.start();
      syncController.checkForRemoteUpdate();
    } catch (error) {
      if (activationStarted) {
        try {
          syncController.stop();
          if (previousCredentials === undefined) {
            clearJsonHostingCredentials();
          } else {
            saveJsonHostingCredentials(previousCredentials);
          }
          set({
            jsonHostingCredentials: previousCredentials,
            observedRemoteRevision: previousObservedRemoteRevision,
            observedRemoteUpdatedAt: previousObservedRemoteUpdatedAt
          });
          syncController.setCredentials(previousCredentials);
          if (previousCredentials !== undefined) {
            syncController.start();
            syncController.checkForRemoteUpdate();
          }
        } catch {
          // The original activation error remains the user-visible failure.
        }
      }
      set({
        jsonHostingStatus: {
          kind: "error",
          message: error instanceof Error ? error.message : "Nie mozna utworzyc dokumentu JSONHosting."
        }
      });
    }
  },
  disconnectJsonHosting: () => {
    clearJsonHostingCredentials();
    syncController.stop();
    syncController.setCredentials(undefined);
    set({ jsonHostingCredentials: undefined, jsonHostingStatus: { kind: "disconnected" } });
  },
  startJsonHostingSync: () => {
    syncController.start();
    syncController.checkForRemoteUpdate();
  },
  stopJsonHostingSync: () => syncController.stop(),
  reset: () => {
    const initial = loadInitialStoreState();
    syncController.setCredentials(initial.jsonHostingCredentials);
    set(initial);
  }
}));

const syncController: JsonHostingSyncController = createJsonHostingSyncController({
  credentials: useTaskerStore.getState().jsonHostingCredentials,
  getLocalSnapshot: () => {
    const { state, observedRemoteRevision, observedRemoteUpdatedAt } = useTaskerStore.getState();
    return { state, observedRevision: observedRemoteRevision, updatedAt: observedRemoteUpdatedAt };
  },
  replaceLocal: (envelope) => {
    saveState(envelope.state);
    useTaskerStore.setState({
      state: envelope.state,
      observedRemoteRevision: envelope.revision,
      observedRemoteUpdatedAt: envelope.updatedAt
    });
  },
  confirmLocalSave: (envelope) =>
    useTaskerStore.setState({
      observedRemoteRevision: envelope.revision,
      observedRemoteUpdatedAt: envelope.updatedAt
    }),
  setStatus: (jsonHostingStatus) => useTaskerStore.setState({ jsonHostingStatus })
});

if (useTaskerStore.getState().jsonHostingCredentials !== undefined) {
  syncController.start();
  syncController.checkForRemoteUpdate();
}

export function resetTaskerStore(): void {
  useTaskerStore.getState().reset();
}
