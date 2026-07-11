import { Stack } from "@mantine/core";
import { useState } from "react";
import type { TodayTask } from "../../domain/types";
import { TodayActiveList } from "./TodayActiveList";
import { TodayCompletedSection } from "./TodayCompletedSection";
import { TodaySummaryHeader } from "./TodaySummaryHeader";

export type TodayViewShellProps = {
  today: string;
  dateLabel: string;
  activeTasks: TodayTask[];
  completedToday: TodayTask[];
  onAdd: () => void;
  onComplete: (taskId: string, scheduledDate: string) => void;
  onPostponeToDate: (taskId: string, scheduledDate: string, toDate: string) => void;
  onEdit: (taskId: string) => void;
  onDeactivate: (taskId: string) => void;
};

export function TodayViewShell(props: TodayViewShellProps) {
  const [expandedTaskIds, setExpandedTaskIds] = useState<string[]>([]);
  const [completedOpen, setCompletedOpen] = useState(false);

  return (
    <Stack gap="lg">
      <TodaySummaryHeader dateLabel={props.dateLabel} activeCount={props.activeTasks.length} />
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
      <TodayCompletedSection
        tasks={props.completedToday}
        open={completedOpen}
        onToggle={() => setCompletedOpen((value) => !value)}
      />
    </Stack>
  );
}
