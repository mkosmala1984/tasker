import { Group, Select, SegmentedControl, Stack } from "@mantine/core";
import type { Assignee, Category, Priority, TaskType, TodayFilters } from "../domain/types";

type Props = {
  categories: Category[];
  assignees: Assignee[];
  taskTypes: TaskType[];
  priorities: Priority[];
  filters: TodayFilters;
  onChange: (filters: TodayFilters) => void;
};

export function TaskFilters({ categories, assignees, taskTypes, priorities, filters, onChange }: Props) {
  const categoryData = [
    { label: "Wszystkie", value: "" },
    ...categories.map((category) => ({ label: category.name, value: category.id }))
  ];

  const assigneeData = [
    { label: "Wszystkie osoby", value: "" },
    ...assignees.map((assignee) => ({ label: assignee.name, value: assignee.id }))
  ];

  const taskTypeData = [
    { label: "Wszystkie typy", value: "" },
    ...taskTypes.filter((taskType) => taskType.active).map((taskType) => ({ label: taskType.name, value: taskType.id }))
  ];

  const priorityData = [
    { label: "Wszystkie priorytety", value: "" },
    ...priorities.filter((priority) => priority.active).map((priority) => ({ label: priority.name, value: priority.id }))
  ];

  return (
    <Group component="section" aria-label="Filtry" justify="space-between" align="end" gap="md">
      <Stack gap={6}>
        <SegmentedControl
          aria-label="Kategorie"
          data={categoryData}
          value={filters.categoryId}
          onChange={(categoryId) => onChange({ ...filters, categoryId })}
        />
      </Stack>

      <Select
        label="Osoba"
        data={assigneeData}
        value={filters.assigneeId}
        onChange={(assigneeId) => onChange({ ...filters, assigneeId: assigneeId ?? "" })}
        allowDeselect={false}
        w={{ base: "100%", sm: 220 }}
      />

      <Select
        label="Typ"
        data={taskTypeData}
        value={filters.taskTypeId}
        onChange={(taskTypeId) => onChange({ ...filters, taskTypeId: taskTypeId ?? "" })}
        allowDeselect={false}
        w={{ base: "100%", sm: 220 }}
      />

      <Select
        label="Priorytet"
        data={priorityData}
        value={filters.priorityId}
        onChange={(priorityId) => onChange({ ...filters, priorityId: priorityId ?? "" })}
        allowDeselect={false}
        w={{ base: "100%", sm: 220 }}
      />
    </Group>
  );
}
