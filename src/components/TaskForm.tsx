import { Button, Group, NativeSelect, NumberInput, Paper, Stack, TextInput } from "@mantine/core";
import { useState } from "react";
import type { Assignee, Category, RecurrenceRule, Task, TaskDraft } from "../domain/types";

type Props = {
  categories: Category[];
  assignees: Assignee[];
  task?: Task;
  onSubmit: (draft: TaskDraft) => void;
  onCancel: () => void;
};

function defaultDraft(task?: Task, categories: Category[] = [], assignees: Assignee[] = []): TaskDraft {
  const category = categories.find((item) => item.id === task?.categoryId);
  const assignee = assignees.find((item) => item.id === task?.assigneeId);

  return {
    title: task?.title ?? "",
    categoryName: category?.name ?? "",
    assigneeName: assignee?.name ?? "",
    recurrence: task?.recurrence ?? { type: "daily" },
    startDate: task?.startDate ?? "",
    active: task?.active ?? true
  };
}

function recurrenceType(recurrence: RecurrenceRule): RecurrenceRule["type"] {
  return recurrence.type;
}

export function TaskForm({ categories, assignees, task, onSubmit, onCancel }: Props) {
  const [draft, setDraft] = useState<TaskDraft>(() => defaultDraft(task, categories, assignees));

  function changeRecurrence(type: RecurrenceRule["type"]) {
    setDraft((current) => ({
      ...current,
      recurrence: type === "everyNDays" ? { type, intervalDays: 2 } : { type }
    }));
  }

  return (
    <Paper
      component="form"
      withBorder
      p="lg"
      radius="md"
      aria-label={task ? "Edytuj zadanie" : "Dodaj zadanie"}
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(draft);
      }}
    >
      <Stack gap="sm">
        <TextInput label="Nazwa zadania" required value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.currentTarget.value })} />

        <TextInput
          label="Kategoria"
          required
          list="tasker-categories"
          value={draft.categoryName}
          onChange={(event) => setDraft({ ...draft, categoryName: event.currentTarget.value })}
        />
        <datalist id="tasker-categories">
          {categories.map((category) => (
            <option key={category.id} value={category.name} />
          ))}
        </datalist>

        <TextInput
          label="Osoba"
          required
          list="tasker-assignees"
          value={draft.assigneeName}
          onChange={(event) => setDraft({ ...draft, assigneeName: event.currentTarget.value })}
        />
        <datalist id="tasker-assignees">
          {assignees.map((assignee) => (
            <option key={assignee.id} value={assignee.name} />
          ))}
        </datalist>

        <TextInput
          label="Data startu"
          required
          type="date"
          value={draft.startDate}
          onChange={(event) => setDraft({ ...draft, startDate: event.currentTarget.value })}
        />

        <NativeSelect
          label="Powtarzanie"
          value={recurrenceType(draft.recurrence)}
          onChange={(event) => changeRecurrence(event.currentTarget.value as RecurrenceRule["type"])}
          data={[
            { value: "daily", label: "Codziennie" },
            { value: "everyNDays", label: "Co N dni" },
            { value: "weekly", label: "Co tydzien" },
            { value: "monthly", label: "Co miesiac" },
            { value: "quarterly", label: "Co kwartal" }
          ]}
        />

        {draft.recurrence.type === "everyNDays" ? (
          <NumberInput
            label="Liczba dni"
            required
            min={1}
            value={draft.recurrence.intervalDays}
            onChange={(value) =>
              setDraft({
                ...draft,
                recurrence: { type: "everyNDays", intervalDays: Number(value) }
              })
            }
          />
        ) : null}

        <NativeSelect
          label="Status"
          value={draft.active ? "active" : "inactive"}
          onChange={(event) => setDraft({ ...draft, active: event.currentTarget.value === "active" })}
          data={[
            { value: "active", label: "Aktywne" },
            { value: "inactive", label: "Nieaktywne" }
          ]}
        />

        <Group gap="xs">
          <Button type="submit">Zapisz</Button>
          <Button type="button" variant="default" onClick={onCancel}>
            Anuluj
          </Button>
        </Group>
      </Stack>
    </Paper>
  );
}
