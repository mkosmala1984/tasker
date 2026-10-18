import { Button, Group, Stack } from "@mantine/core";
import { useState } from "react";
import type { Category, TodayTask } from "../../domain/types";
import { TodayActiveColumns } from "./TodayActiveColumns";
import { TodayActiveList } from "./TodayActiveList";
import { TodayCompletedSection } from "./TodayCompletedSection";
import { TodaySummaryHeader } from "./TodaySummaryHeader";

export type TodayViewShellProps = {
  today: string;
  dateLabel: string;
  activeTasks: TodayTask[];
  completedToday: TodayTask[];
  categories: Category[];
  onAdd: () => void;
  onComplete: (taskId: string, scheduledDate: string) => void;
  onPostponeToDate: (taskId: string, scheduledDate: string, toDate: string) => void;
  onEdit: (taskId: string) => void;
  onDeactivate: (taskId: string) => void;
};

type TodayLayout = "columns" | "list";

const TODAY_LAYOUT_STORAGE_KEY = "tasker.todayLayout";
const TODAY_COLUMN_ORDER_STORAGE_KEY = "tasker.todayColumnOrder";

function loadColumnOrder(): string[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(TODAY_COLUMN_ORDER_STORAGE_KEY) ?? "[]");
    return Array.isArray(value) && value.every((id) => typeof id === "string") ? [...new Set<string>(value)] : [];
  } catch {
    return [];
  }
}

function loadTodayLayout(): TodayLayout {
  try {
    return localStorage.getItem(TODAY_LAYOUT_STORAGE_KEY) === "list" ? "list" : "columns";
  } catch {
    return "columns";
  }
}

export function TodayViewShell(props: TodayViewShellProps) {
  const [expandedTaskIds, setExpandedTaskIds] = useState<string[]>([]);
  const [completedOpen, setCompletedOpen] = useState(false);
  const [layout, setLayout] = useState<TodayLayout>(loadTodayLayout);
  const [columnOrder, setColumnOrder] = useState<string[]>(loadColumnOrder);
  const categoriesById = new Map(props.categories.map((category) => [category.id, category]));
  const orderedIds = [...new Set([...columnOrder, ...categoriesById.keys()])].filter((id) => categoriesById.has(id));
  const orderedCategories = orderedIds.map((id) => categoriesById.get(id)!);

  function moveColumn(categoryId: string, direction: -1 | 1) {
    const visibleIds = orderedIds.filter((id) => props.activeTasks.some((item) => item.category.id === id));
    const visibleIndex = visibleIds.indexOf(categoryId);
    const neighborId = visibleIds[visibleIndex + direction];
    if (visibleIndex < 0 || !neighborId) return;
    const nextOrder = [...orderedIds];
    const from = nextOrder.indexOf(categoryId);
    const to = nextOrder.indexOf(neighborId);
    [nextOrder[from], nextOrder[to]] = [nextOrder[to], nextOrder[from]];
    setColumnOrder(nextOrder);
    try {
      localStorage.setItem(TODAY_COLUMN_ORDER_STORAGE_KEY, JSON.stringify(nextOrder));
    } catch {
      // Keep the selected order for this session when storage is unavailable.
    }
  }

  function changeLayout(nextLayout: TodayLayout) {
    setLayout(nextLayout);
    try {
      localStorage.setItem(TODAY_LAYOUT_STORAGE_KEY, nextLayout);
    } catch {
      // The selected layout still works for this session when storage is unavailable.
    }
  }

  return (
    <Stack className="today-view" gap="lg" data-today-layout={layout}>
      {/*<TodaySummaryHeader dateLabel={props.dateLabel} activeCount={props.activeTasks.length} />*/}
      <Group className="today-layout-switch" justify="flex-end" gap={0} role="group" aria-label="Układ zadań">
        <Button type="button" variant={layout === "columns" ? "filled" : "default"} aria-pressed={layout === "columns"} onClick={() => changeLayout("columns")}>
          Kolumny
        </Button>
        <Button type="button" variant={layout === "list" ? "filled" : "default"} aria-pressed={layout === "list"} onClick={() => changeLayout("list")}>
          Lista
        </Button>
      </Group>
      <div className="today-scroll-area" role="region" aria-label="Przewijany widok zadań" tabIndex={0}>
        <Stack gap="lg">
          {layout === "columns" && props.activeTasks.length > 0 ? (
            <TodayActiveColumns
              today={props.today}
              activeTasks={props.activeTasks}
              categories={orderedCategories}
              onMoveColumn={moveColumn}
              expandedTaskIds={expandedTaskIds}
              onExpandedTaskIdsChange={setExpandedTaskIds}
              onComplete={props.onComplete}
              onPostponeToDate={props.onPostponeToDate}
              onEdit={props.onEdit}
              onDeactivate={props.onDeactivate}
            />
          ) : (
            <TodayActiveList
              today={props.today}
              activeTasks={props.activeTasks}
              expandedTaskIds={expandedTaskIds}
              onExpandedTaskIdsChange={setExpandedTaskIds}
              onAdd={props.onAdd}
              onComplete={props.onComplete}
              onPostponeToDate={props.onPostponeToDate}
              onEdit={props.onEdit}
              onDeactivate={props.onDeactivate}
            />
          )}
          <TodayCompletedSection
            tasks={props.completedToday}
            open={completedOpen}
            onToggle={() => setCompletedOpen((value) => !value)}
          />
        </Stack>
      </div>
    </Stack>
  );
}
