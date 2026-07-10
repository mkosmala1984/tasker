import { Button, Checkbox, Group, Stack, Table, Text, TextInput, Title } from "@mantine/core";
import { useState } from "react";

type DictionaryItem = {
  id: string;
  name: string;
  active: boolean;
  order: number;
  color?: string;
};

type Props = {
  title: string;
  nameLabel: string;
  colorLabel?: string;
  addLabel: string;
  items: DictionaryItem[];
  onAdd: (input: { name: string; color?: string }) => void;
  onUpdate: (id: string, input: { name: string; color?: string }) => void;
  onSetActive: (id: string, active: boolean) => void;
  onMove: (id: string, direction: "up" | "down") => void;
};

export function DictionaryManager({ title, nameLabel, colorLabel, addLabel, items, onAdd, onUpdate, onSetActive, onMove }: Props) {
  const [name, setName] = useState("");
  const [color, setColor] = useState("#868e96");
  const [editingId, setEditingId] = useState<string | undefined>();
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState("#868e96");
  const [error, setError] = useState<string | undefined>();

  function submitAdd() {
    try {
      onAdd({ name, color: colorLabel ? color : undefined });
      setName("");
      setColor("#868e96");
      setError(undefined);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Nie mozna zapisac slownika.");
    }
  }

  function edit(item: DictionaryItem) {
    setEditingId(item.id);
    setEditName(item.name);
    setEditColor(item.color ?? "#868e96");
    setError(undefined);
  }

  function submitEdit(item: DictionaryItem) {
    try {
      onUpdate(item.id, { name: editName, color: colorLabel ? editColor : undefined });
      setEditingId(undefined);
      setError(undefined);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Nie mozna zapisac slownika.");
    }
  }

  return (
    <Stack gap="md">
      <Title order={3}>{title}</Title>
      <Group align="end">
        <TextInput label={nameLabel} value={name} onChange={(event) => setName(event.currentTarget.value)} />
        {colorLabel ? <TextInput label={colorLabel} value={color} onChange={(event) => setColor(event.currentTarget.value)} /> : null}
        <Button type="button" onClick={submitAdd}>
          {addLabel}
        </Button>
      </Group>
      {error ? <Text c="red">{error}</Text> : null}
      <Table>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Nazwa</Table.Th>
            {colorLabel ? <Table.Th>Kolor</Table.Th> : null}
            <Table.Th>Aktywny</Table.Th>
            <Table.Th>Kolejnosc</Table.Th>
            <Table.Th>Akcje</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {[...items].sort((left, right) => left.order - right.order).map((item) => (
            <Table.Tr key={item.id}>
              <Table.Td>
                {editingId === item.id ? (
                  <TextInput aria-label={`Nazwa ${item.name}`} value={editName} onChange={(event) => setEditName(event.currentTarget.value)} />
                ) : (
                  item.name
                )}
              </Table.Td>
              {colorLabel ? (
                <Table.Td>
                  {editingId === item.id ? (
                    <TextInput aria-label={`Kolor ${item.name}`} value={editColor} onChange={(event) => setEditColor(event.currentTarget.value)} />
                  ) : (
                    item.color
                  )}
                </Table.Td>
              ) : null}
              <Table.Td>
                <Checkbox checked={item.active} onChange={(event) => onSetActive(item.id, event.currentTarget.checked)} aria-label={`Aktywny ${item.name}`} />
              </Table.Td>
              <Table.Td>{item.order + 1}</Table.Td>
              <Table.Td>
                <Group gap="xs">
                  <Button type="button" variant="default" onClick={() => onMove(item.id, "up")}>
                    W gore
                  </Button>
                  <Button type="button" variant="default" onClick={() => onMove(item.id, "down")}>
                    W dol
                  </Button>
                  {editingId === item.id ? (
                    <Button type="button" variant="default" onClick={() => submitEdit(item)}>
                      Zapisz
                    </Button>
                  ) : (
                    <Button type="button" variant="default" onClick={() => edit(item)}>
                      Edytuj
                    </Button>
                  )}
                </Group>
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Stack>
  );
}
