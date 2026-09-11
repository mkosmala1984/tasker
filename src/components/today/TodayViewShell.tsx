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

  function changeLayout(nextLayout: TodayLayout) {
    setLayout(nextLayout);
    try {
      localStorage.setItem(TODAY_LAYOUT_STORAGE_KEY, nextLayout);
    } catch {
      // The selected layout still works for this session when storage is unavailable.
    }
  }

  return (
    <Stack gap="lg">
      {/*<TodaySummaryHeader dateLabel={props.dateLabel} activeCount={props.activeTasks.length} />*/}
      <Group className="today-layout-switch" justify="flex-end" gap={0} role="group" aria-label="Układ zadań">
        <Button type="button" variant={layout === "columns" ? "filled" : "default"} aria-pressed={layout === "columns"} onClick={() => changeLayout("columns")}>
          Kolumny
        </Button>
        <Button type="button" variant={layout === "list" ? "filled" : "default"} aria-pressed={layout === "list"} onClick={() => changeLayout("list")}>
          Lista
        </Button>
      </Group>
      {layout === "columns" && props.activeTasks.length > 0 ? (
        <TodayActiveColumns
          today={props.today}
          activeTasks={props.activeTasks}
          categories={props.categories}
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
  );
}
