import { Button, Group, Stack, Table, Text, TextInput, Title } from "@mantine/core";
import { useState } from "react";
import type { Assignee } from "../domain/types";
import type { DictionaryInput } from "../domain/configuration";

type Props = {
  assignees: Assignee[];
  referencedIds: ReadonlySet<string>;
  onAdd: (input: DictionaryInput) => Promise<void>;
  onUpdate: (id: string, input: DictionaryInput) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
};

export function AssigneeManager({ assignees, referencedIds, onAdd, onUpdate, onRemove }: Props) {
  const [name, setName] = useState("");
  const [editingId, setEditingId] = useState<string>();
  const [editName, setEditName] = useState("");
  const [error, setError] = useState<string>();

  async function save() {
    try {
      await onAdd({ name });
      setName("");
      setError(undefined);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Nie można dodać osoby.");
    }
  }

  async function update(id: string) {
    try {
      await onUpdate(id, { name: editName });
      setEditingId(undefined);
      setError(undefined);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Nie można zmienić nazwy osoby.");
    }
  }

  async function remove(id: string) {
    try {
      await onRemove(id);
      if (editingId === id) setEditingId(undefined);
      setError(undefined);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Nie można usunąć osoby.");
    }
  }

  return (
    <Stack gap="md">
      <Title order={3}>Osoby</Title>
      <Group align="end">
        <TextInput label="Nazwa osoby" value={name} onChange={(event) => setName(event.currentTarget.value)} />
        <Button type="button" onClick={save}>Dodaj osobę</Button>
      </Group>
      {error ? <Text c="red" role="alert">{error}</Text> : null}
      <Text size="sm" c="dimmed">Można usunąć tylko osoby bez przypisanych zadań, również nieaktywnych.</Text>
      {assignees.length === 0 ? <Text>Brak osób.</Text> : (
        <Table>
          <Table.Thead><Table.Tr><Table.Th>Nazwa</Table.Th><Table.Th>Akcje</Table.Th></Table.Tr></Table.Thead>
          <Table.Tbody>
            {assignees.map((person) => (
              <Table.Tr key={person.id}>
                <Table.Td>
                  {editingId === person.id ? (
                    <TextInput aria-label={`Nazwa osoby ${person.name}`} value={editName} onChange={(event) => setEditName(event.currentTarget.value)} />
                  ) : person.name}
                </Table.Td>
                <Table.Td>
                  <Group gap="xs">
                    {editingId === person.id ? (
                      <>
                        <Button type="button" variant="default" onClick={() => update(person.id)}>Zapisz</Button>
                        <Button type="button" variant="default" onClick={() => { setEditingId(undefined); setError(undefined); }}>Anuluj</Button>
                      </>
                    ) : (
                      <Button type="button" variant="default" onClick={() => { setEditingId(person.id); setEditName(person.name); setError(undefined); }}>Edytuj</Button>
                    )}
                    <Button type="button" variant="default" disabled={referencedIds.has(person.id)} onClick={() => remove(person.id)}>Usuń</Button>
                  </Group>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}
    </Stack>
  );
}
