import { Group, Select, SegmentedControl, Stack } from "@mantine/core";
import type { Assignee, Category, TodayFilters } from "../domain/types";

type Props = {
  categories: Category[];
  assignees: Assignee[];
  filters: TodayFilters;
  onChange: (filters: TodayFilters) => void;
};

export function TaskFilters({ categories, assignees, filters, onChange }: Props) {
  const categoryData = [
    { label: "Wszystkie", value: "" },
    ...categories.map((category) => ({ label: category.name, value: category.id }))
  ];

  const assigneeData = [
    { label: "Wszystkie osoby", value: "" },
    ...assignees.map((assignee) => ({ label: assignee.name, value: assignee.id }))
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
    </Group>
  );
}
