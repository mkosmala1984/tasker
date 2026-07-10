import type { AppState, Priority, TaskType } from "./types";

export type IdFactory = () => string;

export type CategoryInput = {
  name: string;
  color: string;
};

export type DictionaryInput = {
  name: string;
};

export type PriorityInput = {
  name: string;
  color?: string;
};

function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, " ");
}

function normalizeKey(name: string): string {
  return normalizeName(name).toLocaleLowerCase("pl");
}

function assertName(name: string): string {
  const normalized = normalizeName(name);
  if (normalized.length === 0) {
    throw new Error("Nazwa jest wymagana.");
  }
  return normalized;
}

function assertHexColor(color: string): string {
  const normalized = color.trim();
  if (!/^#[0-9a-fA-F]{6}$/.test(normalized)) {
    throw new Error("Kolor musi byc w formacie #RRGGBB.");
  }
  return normalized.toLowerCase();
}

function assertUniqueName<T extends { id: string; name: string }>(
  items: T[],
  name: string,
  currentId: string | undefined,
  message: string
): void {
  const key = normalizeKey(name);
  const duplicate = items.some((item) => item.id !== currentId && normalizeKey(item.name) === key);
  if (duplicate) {
    throw new Error(message);
  }
}

function nextOrder(items: Array<{ order: number }>): number {
  return items.length === 0 ? 0 : Math.max(...items.map((item) => item.order)) + 1;
}

function sortByOrder<T extends { order: number }>(items: T[]): T[] {
  return [...items].sort((left, right) => left.order - right.order);
}

function moveOrderedItem<T extends { id: string; order: number }>(items: T[], id: string, direction: "up" | "down"): T[] {
  const sorted = sortByOrder(items);
  const index = sorted.findIndex((item) => item.id === id);
  const targetIndex = direction === "up" ? index - 1 : index + 1;
  if (index < 0 || targetIndex < 0 || targetIndex >= sorted.length) {
    return sorted;
  }

  const current = sorted[index];
  const target = sorted[targetIndex];
  return sorted
    .map((item) => {
      if (item.id === current.id) {
        return { ...item, order: target.order };
      }
      if (item.id === target.id) {
        return { ...item, order: current.order };
      }
      return item;
    })
    .sort((left, right) => left.order - right.order);
}

export function addCategory(state: AppState, input: CategoryInput, nextId: IdFactory): AppState {
  const name = assertName(input.name);
  const color = assertHexColor(input.color);
  assertUniqueName(state.categories, name, undefined, "Kategoria o tej nazwie juz istnieje.");
  return { ...state, categories: [...state.categories, { id: nextId(), name, color }] };
}

export function updateCategory(state: AppState, categoryId: string, input: CategoryInput): AppState {
  const name = assertName(input.name);
  const color = assertHexColor(input.color);
  assertUniqueName(state.categories, name, categoryId, "Kategoria o tej nazwie juz istnieje.");
  return {
    ...state,
    categories: state.categories.map((category) => (category.id === categoryId ? { ...category, name, color } : category))
  };
}

export function deactivateCategory(state: AppState, categoryId: string): AppState {
  const isReferenced = state.tasks.some((task) => task.categoryId === categoryId);
  if (isReferenced) {
    return state;
  }
  return { ...state, categories: state.categories.filter((category) => category.id !== categoryId) };
}

export function addTaskType(state: AppState, input: DictionaryInput, nextId: IdFactory): AppState {
  const name = assertName(input.name);
  assertUniqueName(state.taskTypes, name, undefined, "Typ zadania o tej nazwie juz istnieje.");
  const taskType: TaskType = { id: nextId(), name, active: true, order: nextOrder(state.taskTypes) };
  return { ...state, taskTypes: sortByOrder([...state.taskTypes, taskType]) };
}

export function updateTaskType(state: AppState, taskTypeId: string, input: DictionaryInput): AppState {
  const name = assertName(input.name);
  assertUniqueName(state.taskTypes, name, taskTypeId, "Typ zadania o tej nazwie juz istnieje.");
  return {
    ...state,
    taskTypes: sortByOrder(state.taskTypes.map((item) => (item.id === taskTypeId ? { ...item, name } : item)))
  };
}

export function setTaskTypeActive(state: AppState, taskTypeId: string, active: boolean): AppState {
  return {
    ...state,
    taskTypes: sortByOrder(state.taskTypes.map((item) => (item.id === taskTypeId ? { ...item, active } : item)))
  };
}

export function moveTaskType(state: AppState, taskTypeId: string, direction: "up" | "down"): AppState {
  return { ...state, taskTypes: moveOrderedItem(state.taskTypes, taskTypeId, direction) };
}

export function addPriority(state: AppState, input: PriorityInput, nextId: IdFactory): AppState {
  const name = assertName(input.name);
  const color = input.color ? assertHexColor(input.color) : undefined;
  assertUniqueName(state.priorities, name, undefined, "Priorytet o tej nazwie juz istnieje.");
  const priority: Priority = { id: nextId(), name, active: true, order: nextOrder(state.priorities), color };
  return { ...state, priorities: sortByOrder([...state.priorities, priority]) };
}

export function updatePriority(state: AppState, priorityId: string, input: PriorityInput): AppState {
  const name = assertName(input.name);
  const color = input.color ? assertHexColor(input.color) : undefined;
  assertUniqueName(state.priorities, name, priorityId, "Priorytet o tej nazwie juz istnieje.");
  return {
    ...state,
    priorities: sortByOrder(state.priorities.map((item) => (item.id === priorityId ? { ...item, name, color } : item)))
  };
}

export function setPriorityActive(state: AppState, priorityId: string, active: boolean): AppState {
  return {
    ...state,
    priorities: sortByOrder(state.priorities.map((item) => (item.id === priorityId ? { ...item, active } : item)))
  };
}

export function movePriority(state: AppState, priorityId: string, direction: "up" | "down"): AppState {
  return { ...state, priorities: moveOrderedItem(state.priorities, priorityId, direction) };
}
