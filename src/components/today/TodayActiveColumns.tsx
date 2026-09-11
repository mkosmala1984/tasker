import { Badge, Group, Paper, Stack, Title } from "@mantine/core";
import type { Category, TodayTask } from "../../domain/types";
import { TodayTaskRow } from "./TodayTaskRow";

type Props = {
  today: string;
  activeTasks: TodayTask[];
  categories: Category[];
  expandedTaskIds: string[];
  onExpandedTaskIdsChange: (taskIds: string[]) => void;
  onComplete: (taskId: string, scheduledDate: string) => void;
  onPostponeToDate: (taskId: string, scheduledDate: string, toDate: string) => void;
  onEdit: (taskId: string) => void;
  onDeactivate: (taskId: string) => void;
};

export function TodayActiveColumns({
  today,
  activeTasks,
  categories,
  expandedTaskIds,
  onExpandedTaskIdsChange,
  onComplete,
  onPostponeToDate,
  onEdit,
  onDeactivate
}: Props) {
  const categoryOrder = new Map(categories.map((category, index) => [category.id, index]));
  const groupedTasks = [...activeTasks.reduce((groups, item) => {
    const group = groups.get(item.category.id);
    if (group) {
      group.tasks.push(item);
    } else {
      groups.set(item.category.id, { category: item.category, tasks: [item] });
    }
    return groups;
  }, new Map<string, { category: Category; tasks: TodayTask[] }>()).values()].sort(
    (left, right) =>
      (categoryOrder.get(left.category.id) ?? Number.MAX_SAFE_INTEGER) -
      (categoryOrder.get(right.category.id) ?? Number.MAX_SAFE_INTEGER)
  );

  return (
    <div className="today-active-columns" aria-label="Aktywne zadania według kategorii">
      {groupedTasks.map(({ category, tasks }) => (
        <Paper className="today-category-column" component="section" aria-label={`Kategoria: ${category.name}`} key={category.id} withBorder radius="md" p="md">
          <Group className="today-category-column-header" justify="space-between" align="center" gap="sm">
            <Group gap="xs">
              <span className="today-category-color" style={{ backgroundColor: category.color }} aria-hidden="true" />
              <Title order={2}>{category.name}</Title>
            </Group>
            <Badge variant="light">{tasks.length}</Badge>
          </Group>
          <Stack className="today-category-column-tasks" gap={0}>
            {tasks.map((item) => {
              const expanded = expandedTaskIds.includes(item.task.id);
              return (
                <TodayTaskRow
                  key={item.task.id}
                  item={item}
                  today={today}
                  expanded={expanded}
                  onToggleExpanded={() => onExpandedTaskIdsChange(expanded ? expandedTaskIds.filter((taskId) => taskId !== item.task.id) : [...expandedTaskIds, item.task.id])}
                  onComplete={onComplete}
                  onPostponeToDate={onPostponeToDate}
                  onEdit={onEdit}
                  onDeactivate={onDeactivate}
                />
              );
            })}
          </Stack>
        </Paper>
      ))}
    </div>
  );
}
