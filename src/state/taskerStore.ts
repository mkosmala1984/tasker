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
  type PriorityInput,
} from "../domain/configuration";
import { addDays, getTodayString } from "../domain/dates";
import { emptyHistoryFilters, type HistoryFilters } from "../domain/history";
import {
  addTask,
  completeTask,
  deactivateTask,
  postponeTask,
  updateTask,
} from "../domain/tasks";
import type {
  AppState,
  AppView,
  TaskDraft,
  TodayFilters,
} from "../domain/types";
import { createOperation, type SyncConflict } from "../domain/syncOperations";
import {
  previewImport as previewImportDomain,
  type ImportPreview,
} from "../storage/taskerBackup";
import {
  clearTigrisCredentials,
  getTigrisEnvelope,
  loadTigrisCredentials,
  putTigrisEnvelope,
  saveTigrisCredentials,
  type TigrisCredentials,
} from "../storage/tigrisStorage";
import { loadState, STORAGE_KEY } from "../storage/taskerStorage";
import {
  journalNotifications,
  SyncJournal,
  JournalMissingError,
  type JournalRecord,
} from "../storage/syncJournal";
import {
  createRemoteSyncController,
  type RemoteSyncStatus,
} from "./remoteSync";
export const emptyFilters: TodayFilters = {
  categoryId: "",
  assigneeId: "",
  taskTypeId: "",
  priorityId: "",
};
const DATASET_KEY = "tasker:dataset:v2";
function datasetFor(c: TigrisCredentials) {
  return JSON.stringify(["tigris", c.bucket, c.objectKey]);
}
export type TaskerStore = {
  state: AppState;
  storageError?: string;
  ready: boolean;
  conflicts: SyncConflict[];
  pendingCount: number;
  localVersion: number;
  tigrisCredentials?: TigrisCredentials;
  tigrisStatus: RemoteSyncStatus;
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
  openTaskCreate: (date?: string) => void;
  openTaskEdit: (id: string) => void;
  closeTaskEditor: () => void;
  addCategory: (input: CategoryInput) => Promise<void>;
  updateCategory: (id: string, input: CategoryInput) => Promise<void>;
  deactivateCategory: (id: string) => Promise<void>;
  addTaskType: (input: DictionaryInput) => Promise<void>;
  updateTaskType: (id: string, input: DictionaryInput) => Promise<void>;
  setTaskTypeActive: (id: string, active: boolean) => Promise<void>;
  moveTaskType: (id: string, direction: "up" | "down") => Promise<void>;
  addPriority: (input: PriorityInput) => Promise<void>;
  updatePriority: (id: string, input: PriorityInput) => Promise<void>;
  setPriorityActive: (id: string, active: boolean) => Promise<void>;
  movePriority: (id: string, direction: "up" | "down") => Promise<void>;
  previewImport: (raw: string) => ImportPreview;
  applyImport: (preview: ImportPreview) => Promise<void>;
  addTask: (draft: TaskDraft, now?: Date) => Promise<void>;
  updateTask: (
    id: string,
    draft: TaskDraft,
    now?: Date,
    editingBase?: AppState,
  ) => Promise<void>;
  deactivateTask: (id: string, now?: Date) => Promise<void>;
  completeTask: (id: string, date: string, now?: Date) => Promise<void>;
  postponeTask: (
    id: string,
    from: string,
    to: string,
    now?: Date,
  ) => Promise<void>;
  postponeTaskToDate: (
    id: string,
    from: string,
    to: string,
    now?: Date,
  ) => Promise<void>;
  postponeTaskToTomorrow: (
    id: string,
    from: string,
    now?: Date,
  ) => Promise<void>;
  configureTigris: (c: TigrisCredentials) => Promise<void>;
  disconnectTigris: () => Promise<void>;
  resolveConflict: (
    conflict: SyncConflict,
    choice: "local" | "remote",
  ) => Promise<void>;
  startSync: () => void;
  stopSync: () => void;
  refresh: () => Promise<void>;
  initialize: () => Promise<void>;
  reset: (journal?: SyncJournal) => Promise<void>;
};
export function createTaskerStore(initialJournal = new SyncJournal()) {
  let journal = initialJournal,
    dataset = "local",
    sessionId = crypto.randomUUID();
  let initialization: Promise<void>,
    notifications: ReturnType<typeof journalNotifications> | undefined;
  let writeTail: Promise<void> = Promise.resolve(),
    changingConnection = false,
    syncRequested = false;
  let controller: ReturnType<
    typeof createRemoteSyncController<TigrisCredentials>
  >;
  const initial = loadState();
  const store = create<TaskerStore>((set, get) => {
    function publish(record: JournalRecord) {
      if (record.dataset !== dataset || record.version < get().localVersion)
        return;
      set({
        state: record.state,
        conflicts: record.conflicts,
        pendingCount: record.operations.length,
        localVersion: record.version,
        ready: true,
      });
    }
    function report(error: unknown) {
      set({
        storageError:
          error instanceof Error || error instanceof DOMException
            ? error.message
            : "Nie można zapisać danych lokalnych.",
      });
    }
    function mutate(
      transform: (state: AppState) => AppState,
      editingBase = get().state,
    ): Promise<void> {
      if (changingConnection)
        return Promise.reject(
          new Error(
            "Poczekaj na zakończenie zmiany połączenia. Szkic pozostaje w formularzu.",
          ),
        );
      const target = dataset,
        operation = createOperation(
          editingBase,
          transform(editingBase),
          sessionId,
        );
      const perform = async () => {
        try {
          await initialization;
          const record = await journal.append(target, operation);
          publish(record);
          set({ storageError: undefined });
          notifications?.notify();
          if (dataset === target) controller.scheduleSave();
        } catch (error) {
          report(error);
          throw error;
        }
      };
      const result = writeTail.then(perform);
      writeTail = result.catch(() => undefined);
      return result;
    }
    const id = (prefix: string) => `${prefix}-${crypto.randomUUID()}`;
    const postpone = (
      taskId: string,
      from: string,
      to: string,
      now = new Date(),
    ) => mutate((s) => postponeTask(s, taskId, from, to, now.toISOString()));
    return {
      state: initial.state,
      storageError: initial.error,
      ready: false,
      conflicts: [],
      pendingCount: 0,
      localVersion: 0,
      tigrisCredentials: loadTigrisCredentials(),
      tigrisStatus: { kind: "local" },
      filters: emptyFilters,
      historyFilters: emptyHistoryFilters,
      view: "today",
      selectedCalendarDate: getTodayString(),
      setFilters: (filters) => set({ filters }),
      setHistoryFilters: (historyFilters) => set({ historyFilters }),
      setView: (view) =>
        set({
          view,
          taskEditorTaskId: undefined,
          taskEditorInitialDate: undefined,
        }),
      setSelectedCalendarDate: (selectedCalendarDate) =>
        set({ selectedCalendarDate }),
      openTaskCreate: (taskEditorInitialDate) =>
        set({ view: "tasks", taskEditorTaskId: null, taskEditorInitialDate }),
      openTaskEdit: (taskEditorTaskId) =>
        set({
          view: "tasks",
          taskEditorTaskId,
          taskEditorInitialDate: undefined,
        }),
      closeTaskEditor: () =>
        set({ taskEditorTaskId: undefined, taskEditorInitialDate: undefined }),
      addCategory: (input) =>
        mutate((s) => addCategoryDomain(s, input, () => id("category"))),
      updateCategory: (key, input) =>
        mutate((s) => updateCategoryDomain(s, key, input)),
      deactivateCategory: (key) =>
        mutate((s) => deactivateCategoryDomain(s, key)),
      addTaskType: (input) =>
        mutate((s) => addTaskTypeDomain(s, input, () => id("task-type"))),
      updateTaskType: (key, input) =>
        mutate((s) => updateTaskTypeDomain(s, key, input)),
      setTaskTypeActive: (key, active) =>
        mutate((s) => setTaskTypeActiveDomain(s, key, active)),
      moveTaskType: (key, direction) =>
        mutate((s) => moveTaskTypeDomain(s, key, direction)),
      addPriority: (input) =>
        mutate((s) => addPriorityDomain(s, input, () => id("priority"))),
      updatePriority: (key, input) =>
        mutate((s) => updatePriorityDomain(s, key, input)),
      setPriorityActive: (key, active) =>
        mutate((s) => setPriorityActiveDomain(s, key, active)),
      movePriority: (key, direction) =>
        mutate((s) => movePriorityDomain(s, key, direction)),
      addTask: (draft, now = new Date()) =>
        mutate((s) => addTask(s, draft, now.toISOString())),
      updateTask: (key, draft, now = new Date(), base) =>
        mutate((s) => updateTask(s, key, draft, now.toISOString()), base),
      deactivateTask: (key, now = new Date()) =>
        mutate((s) => deactivateTask(s, key, now.toISOString())),
      completeTask: (key, date, now = new Date()) =>
        mutate((s) => completeTask(s, key, date, getTodayString(now))),
      postponeTask: postpone,
      postponeTaskToDate: postpone,
      postponeTaskToTomorrow: (key, date, now = new Date()) =>
        postpone(key, date, addDays(getTodayString(now), 1), now),
      previewImport: (raw) => ({
        ...previewImportDomain(raw),
        localVersion: get().localVersion,
      }),
      applyImport: async (preview) => {
        if (changingConnection)
          throw new Error("Poczekaj na zakończenie zmiany połączenia.");
        const target = dataset,
          base = get().state;
        try {
          await initialization;
          publish(
            await journal.append(
              target,
              createOperation(base, preview.state, sessionId, true),
              preview.localVersion,
            ),
          );
          notifications?.notify();
          controller.scheduleSave();
        } catch (error) {
          report(error);
          throw error;
        }
      },
      resolveConflict: async (conflict, choice) => {
        if (changingConnection)
          throw new Error("Poczekaj na zakończenie zmiany połączenia.");
        try {
          await initialization;
          publish(
            await journal.resolve(
              dataset,
              conflict.operationId,
              conflict.field,
              conflict.id,
              choice,
            ),
          );
          notifications?.notify();
          controller.scheduleSave();
        } catch (error) {
          report(error);
          throw error;
        }
      },
      configureTigris: async (credentials) => {
        if (changingConnection) return;
        changingConnection = true;
        try {
          await initialization;
          await writeTail;
          const nextDataset = datasetFor(credentials),
            current = await journal.read(dataset);
          if (
            get().tigrisCredentials &&
            nextDataset !== dataset &&
            current.operations.length
          )
            throw new Error(
              "Zmiany oczekują na synchronizację. Najpierw zakończ synchronizację albo rozłącz i zachowaj je lokalnie; poprzedni dziennik pozostanie zapisany.",
            );
          const next = await journal.initialize(nextDataset, current.state);
          // Complete all durable writes before replacing the active connection.
          saveTigrisCredentials(credentials);
          localStorage.setItem(DATASET_KEY, nextDataset);
          controller.stop();
          dataset = nextDataset;
          controller.setCredentials(credentials, dataset);
          set({
            tigrisCredentials: credentials,
            localVersion: 0,
            storageError: undefined,
          });
          publish(next);
          controller.start();
          await controller.syncNow();
        } catch (error) {
          set({
            tigrisStatus: {
              kind: "error",
              message:
                error instanceof Error
                  ? error.message
                  : "Nie można połączyć z Tigris.",
            },
          });
        } finally {
          changingConnection = false;
        }
      },
      disconnectTigris: async () => {
        if (changingConnection) return;
        changingConnection = true;
        try {
          await initialization;
          await writeTail;
          const current = await journal.read(dataset),
            nextDataset = `local:${crypto.randomUUID()}`;
          const next = await journal.initialize(nextDataset, current.state);
          localStorage.setItem(DATASET_KEY, nextDataset);
          clearTigrisCredentials();
          controller.stop();
          controller.setCredentials(undefined, nextDataset);
          dataset = nextDataset;
          set({
            tigrisCredentials: undefined,
            tigrisStatus: { kind: "local" },
            localVersion: 0,
          });
          publish(next);
          notifications?.notify();
        } catch (error) {
          report(error);
        } finally {
          changingConnection = false;
        }
      },
      initialize: () => initialization,
      refresh: async () => {
        try {
          await initialization;
          const record = await journal.read(dataset);
          if (record.version > get().localVersion) {
            publish(record);
            controller.scheduleSave();
          }
        } catch (error) {
          report(error);
        }
      },
      startSync: () => {
        syncRequested = true;
        notifications ??= journalNotifications(() => {
          void get().refresh();
        });
        void initialization
          .then(() => {
            if (syncRequested) {
              controller.start();
              controller.checkForRemoteUpdate();
            }
          })
          .catch(report);
      },
      stopSync: () => {
        syncRequested = false;
        controller.stop();
        notifications?.close();
        notifications = undefined;
      },
      reset: async (replacementJournal) => {
        get().stopSync();
        await initialization.catch(() => undefined);
        await writeTail;
        if (replacementJournal) {
          await journal.close();
          journal = replacementJournal;
        }
        sessionId = crypto.randomUUID();
        set({
          ...initial,
          ...loadState(),
          ready: false,
          conflicts: [],
          pendingCount: 0,
          localVersion: 0,
          tigrisCredentials: loadTigrisCredentials(),
          tigrisStatus: { kind: "local" },
          filters: emptyFilters,
          historyFilters: emptyHistoryFilters,
          view: "today",
          taskEditorTaskId: undefined,
          taskEditorInitialDate: undefined,
        });
        initialization = initialize();
        await initialization;
      },
    };
  });
  controller = createRemoteSyncController({
    dataset,
    credentials: store.getState().tigrisCredentials,
    journal: {
      read: (key) => journal.read(key),
      acceptRemote: (key, doc, created) =>
        journal.acceptRemote(key, doc, created),
    },
    storage: {
      getRemoteEnvelope: getTigrisEnvelope,
      putRemoteEnvelope: putTigrisEnvelope,
    },
    setStatus: (tigrisStatus) => {
      const current = store.getState();
      if (
        tigrisStatus.kind === "synced" &&
        (current.pendingCount || current.conflicts.length)
      )
        tigrisStatus = {
          kind: current.conflicts.length ? "conflict" : "pending",
        };
      store.setState({ tigrisStatus });
    },
    onChange: (record) => {
      if (
        record.dataset !== dataset ||
        record.version < store.getState().localVersion
      )
        return;
      store.setState({
        state: record.state,
        conflicts: record.conflicts,
        pendingCount: record.operations.length,
        localVersion: record.version,
      });
      notifications?.notify();
    },
  });
  async function initialize() {
    const credentials = store.getState().tigrisCredentials;
    dataset = credentials
      ? datasetFor(credentials)
      : (localStorage.getItem(DATASET_KEY) ?? "local");
    // The legacy value is retained as a recovery copy. Credential cleanup follows the durable transaction.
    let record: JournalRecord;
    try {
      record = await journal.read(dataset);
    } catch (error) {
      if (!(error instanceof JournalMissingError)) throw error;
      const legacy = loadState();
      if (legacy.error) throw new Error(legacy.error);
      record = await journal.initialize(dataset, legacy.state);
    }
    localStorage.setItem(DATASET_KEY, dataset);
    localStorage.removeItem("tasker:jsonhosting:v1");
    store.setState({
      state: record.state,
      conflicts: record.conflicts,
      pendingCount: record.operations.length,
      localVersion: record.version,
      ready: true,
      storageError: undefined,
    });
    controller.setCredentials(credentials, dataset);
  }
  initialization = initialize();
  // Surface startup errors without producing an unhandled promise; mutations still reject the original failure.
  void initialization.catch((error) =>
    store.setState({
      storageError:
        error instanceof Error
          ? error.message
          : "Nie można otworzyć bazy danych.",
    }),
  );
  return store;
}
export const useTaskerStore = createTaskerStore();
// Test reset keeps production journals intact and seeds an isolated database from the legacy fixture.
export async function resetTaskerStore(): Promise<void> {
  await useTaskerStore
    .getState()
    .reset(new SyncJournal(`tasker-test-${crypto.randomUUID()}`));
}
