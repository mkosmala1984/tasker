import { Select, Stack, Table, Text, TextInput, Title } from "@mantine/core";
import { buildHistoryList, type HistoryFilters } from "../domain/history";
import type { AppState } from "../domain/types";

type Props = {
  state: AppState;
  filters: HistoryFilters;
  onFiltersChange: (filters: HistoryFilters) => void;
};

export function HistoryView({ state, filters, onFiltersChange }: Props) {
  const items = buildHistoryList(state, filters);

  return (
    <Stack gap="md">
      <Title order={2}>Historia</Title>
      <Stack gap="sm">
        <TextInput label="Od daty wykonania" value={filters.fromDate} onChange={(event) => onFiltersChange({ ...filters, fromDate: event.currentTarget.value })} />
        <TextInput label="Do daty wykonania" value={filters.toDate} onChange={(event) => onFiltersChange({ ...filters, toDate: event.currentTarget.value })} />
        <Select
          label="Kategoria"
          clearable
          value={filters.categoryId || null}
          data={state.categories.map((item) => ({ value: item.id, label: item.name }))}
          onChange={(value) => onFiltersChange({ ...filters, categoryId: value ?? "" })}
        />
        <Select
          label="Osoba"
          clearable
          value={filters.assigneeId || null}
          data={state.assignees.map((item) => ({ value: item.id, label: item.name }))}
          onChange={(value) => onFiltersChange({ ...filters, assigneeId: value ?? "" })}
        />
        <Select
          label="Typ zadania"
          clearable
          value={filters.taskTypeId || null}
          data={state.taskTypes.map((item) => ({ value: item.id, label: item.name }))}
          onChange={(value) => onFiltersChange({ ...filters, taskTypeId: value ?? "" })}
        />
        <Select
          label="Priorytet"
          clearable
          value={filters.priorityId || null}
          data={state.priorities.map((item) => ({ value: item.id, label: item.name }))}
          onChange={(value) => onFiltersChange({ ...filters, priorityId: value ?? "" })}
        />
      </Stack>
      {items.length === 0 ? <Text c="dimmed">Brak wpisow historii dla wybranych filtrow.</Text> : null}
      <Table>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Zadanie</Table.Th>
            <Table.Th>Planowana data</Table.Th>
            <Table.Th>Data wykonania</Table.Th>
            <Table.Th>Kategoria</Table.Th>
            <Table.Th>Osoba</Table.Th>
            <Table.Th>Typ</Table.Th>
            <Table.Th>Priorytet</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {items.map((item) => (
            <Table.Tr key={item.completionId}>
              <Table.Td>{item.title}</Table.Td>
              <Table.Td>{item.scheduledDate}</Table.Td>
              <Table.Td>{item.completedDate}</Table.Td>
              <Table.Td>{item.categoryName}</Table.Td>
              <Table.Td>{item.assigneeName}</Table.Td>
              <Table.Td>{item.taskTypeName}</Table.Td>
              <Table.Td>{item.priorityName}</Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Stack>
  );
}
