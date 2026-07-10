import { Button, Group, Stack, Table, Text, TextInput, Title } from "@mantine/core";
import { useState } from "react";
import type { Category } from "../domain/types";
import type { CategoryInput } from "../domain/configuration";

type Props = {
  categories: Category[];
  onAdd: (input: CategoryInput) => void;
  onUpdate: (categoryId: string, input: CategoryInput) => void;
  onDeactivate: (categoryId: string) => void;
};

export function CategoryManager({ categories, onAdd, onUpdate, onDeactivate }: Props) {
  const [name, setName] = useState("");
  const [color, setColor] = useState("#228be6");
  const [editingId, setEditingId] = useState<string | undefined>();
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState("#228be6");
  const [error, setError] = useState<string | undefined>();

  function submitAdd() {
    try {
      onAdd({ name, color });
      setName("");
      setColor("#228be6");
      setError(undefined);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Nie mozna zapisac kategorii.");
    }
  }

  function startEdit(category: Category) {
    setEditingId(category.id);
    setEditName(category.name);
    setEditColor(category.color);
    setError(undefined);
  }

  function submitEdit(categoryId: string) {
    try {
      onUpdate(categoryId, { name: editName, color: editColor });
      setEditingId(undefined);
      setError(undefined);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Nie mozna zapisac kategorii.");
    }
  }

  return (
    <Stack gap="md">
      <Title order={2}>Kategorie</Title>
      <Group align="end">
        <TextInput label="Nazwa kategorii" value={name} onChange={(event) => setName(event.currentTarget.value)} />
        <TextInput label="Kolor kategorii" value={color} onChange={(event) => setColor(event.currentTarget.value)} />
        <Button type="button" onClick={submitAdd}>
          Dodaj kategorie
        </Button>
      </Group>
      {error ? <Text c="red">{error}</Text> : null}
      <Table>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Nazwa</Table.Th>
            <Table.Th>Kolor</Table.Th>
            <Table.Th>Akcje</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {categories.map((category) => (
            <Table.Tr key={category.id}>
              <Table.Td>
                {editingId === category.id ? (
                  <TextInput aria-label={`Nazwa ${category.name}`} value={editName} onChange={(event) => setEditName(event.currentTarget.value)} />
                ) : (
                  category.name
                )}
              </Table.Td>
              <Table.Td>
                <Group gap="xs">
                  <span
                    aria-hidden="true"
                    style={{ background: category.color, borderRadius: 4, display: "inline-block", height: 20, width: 20 }}
                  />
                  {editingId === category.id ? (
                    <TextInput aria-label={`Kolor ${category.name}`} value={editColor} onChange={(event) => setEditColor(event.currentTarget.value)} />
                  ) : (
                    category.color
                  )}
                </Group>
              </Table.Td>
              <Table.Td>
                <Group gap="xs">
                  {editingId === category.id ? (
                    <Button type="button" variant="default" onClick={() => submitEdit(category.id)}>
                      Zapisz
                    </Button>
                  ) : (
                    <Button type="button" variant="default" onClick={() => startEdit(category)}>
                      Edytuj
                    </Button>
                  )}
                  <Button type="button" variant="default" onClick={() => onDeactivate(category.id)}>
                    Dezaktywuj
                  </Button>
                </Group>
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Stack>
  );
}
