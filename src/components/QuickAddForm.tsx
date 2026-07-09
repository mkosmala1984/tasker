import { Button, Paper, Stack, TextInput, Title } from "@mantine/core";
import { useState } from "react";
import type { Assignee, Category, TaskDraft } from "../domain/types";

type Props = {
  categories: Category[];
  assignees: Assignee[];
  today: string;
  onSubmit: (draft: TaskDraft) => void;
};

const emptyForm = {
  title: "",
  categoryName: "",
  assigneeName: ""
};

export function QuickAddForm({ categories, assignees, today, onSubmit }: Props) {
  const [form, setForm] = useState(emptyForm);

  return (
    <Paper
      component="form"
      withBorder
      p="lg"
      radius="md"
      aria-label="Szybkie dodanie"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit({
          ...form,
          schedule: { mode: "recurring", startDate: today, recurrence: { type: "daily" } },
          active: true
        });
        setForm(emptyForm);
      }}
    >
      <Stack gap="sm">
        <Title order={2}>Szybkie dodanie</Title>

        <TextInput
          id="quick-add-title"
          label="Nazwa zadania"
          required
          value={form.title}
          onChange={(event) => setForm({ ...form, title: event.currentTarget.value })}
        />

        <TextInput
          label="Kategoria"
          required
          list="quick-add-categories"
          value={form.categoryName}
          onChange={(event) => setForm({ ...form, categoryName: event.currentTarget.value })}
        />
        <datalist id="quick-add-categories">
          {categories.map((category) => (
            <option key={category.id} value={category.name} />
          ))}
        </datalist>

        <TextInput
          label="Osoba"
          required
          list="quick-add-assignees"
          value={form.assigneeName}
          onChange={(event) => setForm({ ...form, assigneeName: event.currentTarget.value })}
        />
        <datalist id="quick-add-assignees">
          {assignees.map((assignee) => (
            <option key={assignee.id} value={assignee.name} />
          ))}
        </datalist>

        <Button type="submit" w="fit-content">
          Zapisz
        </Button>
      </Stack>
    </Paper>
  );
}
