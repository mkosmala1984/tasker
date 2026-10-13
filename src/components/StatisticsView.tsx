import { Group, Stack, Table, Text, Title } from "@mantine/core";
import type { AppState } from "../domain/types";

type Props = {
  state: AppState;
};

export function StatisticsView({ state }: Props) {
  const counts = new Map<string, number>();
  for (const task of state.tasks) {
    if (task.active) {
      counts.set(task.categoryId, (counts.get(task.categoryId) ?? 0) + 1);
    }
  }
  const categories = [...state.categories].sort((left, right) => left.name.localeCompare(right.name, "pl"));

  return (
    <Stack gap="md">
      <Title order={2}>Statystyki</Title>
      <Text c="dimmed">Liczba zadań oznaczonych jako aktywne w każdej kategorii, niezależnie od terminu.</Text>
      {categories.length === 0 ? (
        <Text c="dimmed">Brak kategorii do wyświetlenia.</Text>
      ) : (
        <Table striped>
          <Table.Caption>Aktywne zadania według kategorii</Table.Caption>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Kategoria</Table.Th>
              <Table.Th style={{ textAlign: "right" }}>Aktywne zadania</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {categories.map(category => (
              <Table.Tr key={category.id}>
                <Table.Td>
                  <Group gap="xs" wrap="nowrap">
                    <span aria-hidden="true" style={{ background: category.color, borderRadius: 4, height: 16, width: 16, flexShrink: 0 }} />
                    <Text>{category.name}</Text>
                  </Group>
                </Table.Td>
                <Table.Td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{counts.get(category.id) ?? 0}</Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}
    </Stack>
  );
}
