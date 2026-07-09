import { Alert, Button, Checkbox, Group, NativeSelect, NumberInput, Paper, Stack, Text, TextInput } from "@mantine/core";
import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import {
  createEmptyTaskFormValues,
  recurrenceOptions,
  taskFormValuesToDraft,
  taskToFormValues,
  validateTaskFormValues,
  type TaskFormErrors,
  type TaskFormValues
} from "../domain/taskForm";
import type { AppState, Task, TaskDraft } from "../domain/types";

type Props = {
  state: AppState;
  today: string;
  task?: Task;
  submitLabel: string;
  onSubmit: (draft: TaskDraft) => void;
  onCancel: () => void;
};

function activeOptions<T extends { id: string; name: string; active?: boolean; order?: number }>(items: T[]) {
  return [...items]
    .filter((item) => item.active !== false)
    .sort((left, right) => (left.order ?? 0) - (right.order ?? 0))
    .map((item) => ({ value: item.id, label: item.name }));
}

function priorityOptions(state: AppState) {
  return [{ value: "", label: "Domyslny priorytet" }, ...activeOptions(state.priorities)];
}

function hasErrors(errors: TaskFormErrors): boolean {
  return Object.keys(errors).length > 0;
}

export function TaskForm({ state, today, task, submitLabel, onSubmit, onCancel }: Props) {
  const [values, setValues] = useState<TaskFormValues>(() =>
    task ? taskToFormValues(task, state) : createEmptyTaskFormValues(state, today)
  );
  const [errors, setErrors] = useState<TaskFormErrors>({});

  useEffect(() => {
    setValues(task ? taskToFormValues(task, state) : createEmptyTaskFormValues(state, today));
    setErrors({});
  }, [state, task, today]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors = validateTaskFormValues(values, state);
    setErrors(nextErrors);
    if (hasErrors(nextErrors)) {
      return;
    }
    onSubmit(taskFormValuesToDraft(values, state));
  }

  return (
    <Paper
      component="form"
      withBorder
      p="lg"
      radius="md"
      aria-label={task ? "Edytuj zadanie" : "Dodaj zadanie"}
      noValidate
      onSubmit={handleSubmit}
    >
      <Stack gap="sm">
        {errors.dictionary ? (
          <Alert color="yellow" title="Brakuje slownikow">
            {errors.dictionary}
          </Alert>
        ) : null}

        <TextInput
          label="Nazwa zadania"
          aria-label="Nazwa zadania"
          required
          value={values.title}
          error={errors.title}
          onChange={(event) => setValues({ ...values, title: event.currentTarget.value })}
        />

        <NativeSelect
          label="Typ zadania"
          aria-label="Typ zadania"
          required
          value={values.taskTypeId}
          error={errors.taskTypeId}
          data={activeOptions(state.taskTypes)}
          onChange={(event) => setValues({ ...values, taskTypeId: event.currentTarget.value })}
        />

        <NativeSelect
          label="Tryb"
          aria-label="Tryb"
          value={values.mode}
          data={[
            { value: "oneTime", label: "Jednorazowe" },
            { value: "recurring", label: "Cykliczne" }
          ]}
          onChange={(event) => setValues({ ...values, mode: event.currentTarget.value as TaskFormValues["mode"] })}
        />

        {values.mode === "oneTime" ? (
          <TextInput
            label="Data zadania"
            aria-label="Data zadania"
            required
            type="date"
            value={values.oneTimeDate}
            error={errors.oneTimeDate}
            onChange={(event) => setValues({ ...values, oneTimeDate: event.currentTarget.value })}
          />
        ) : (
          <>
            <TextInput
              label="Data startu"
              aria-label="Data startu"
              required
              type="date"
              value={values.recurringStartDate}
              error={errors.recurringStartDate}
              onChange={(event) => setValues({ ...values, recurringStartDate: event.currentTarget.value })}
            />
            <NativeSelect
              label="Regula powtarzania"
              aria-label="Regula powtarzania"
              value={values.recurrenceType}
              data={recurrenceOptions}
              onChange={(event) =>
                setValues({ ...values, recurrenceType: event.currentTarget.value as TaskFormValues["recurrenceType"] })
              }
            />
            {values.recurrenceType === "everyNDays" ? (
              <NumberInput
                label="Liczba dni"
                aria-label="Liczba dni"
                required
                min={1}
                clampBehavior="none"
                value={values.intervalDays}
                error={errors.intervalDays}
                onChange={(value) => setValues({ ...values, intervalDays: Number(value) })}
              />
            ) : null}
          </>
        )}

        <NativeSelect
          label="Kategoria"
          aria-label="Kategoria"
          required
          value={values.categoryId}
          error={errors.categoryId}
          data={activeOptions(state.categories)}
          onChange={(event) => setValues({ ...values, categoryId: event.currentTarget.value })}
        />

        <NativeSelect
          label="Osoba"
          aria-label="Osoba"
          required
          value={values.assigneeId}
          error={errors.assigneeId}
          data={activeOptions(state.assignees)}
          onChange={(event) => setValues({ ...values, assigneeId: event.currentTarget.value })}
        />

        <NativeSelect
          label="Priorytet"
          aria-label="Priorytet"
          value={values.priorityId}
          data={priorityOptions(state)}
          onChange={(event) => setValues({ ...values, priorityId: event.currentTarget.value })}
        />

        <Checkbox
          label="Aktywne"
          checked={values.active}
          onChange={(event) => setValues({ ...values, active: event.currentTarget.checked })}
        />

        <Text c="dimmed" size="sm">
          Nieaktywne zadanie pozostaje w danych, ale nie pojawia sie w planie jako wymagajace reakcji.
        </Text>

        <Group gap="xs">
          <Button type="submit">{submitLabel}</Button>
          <Button type="button" variant="default" onClick={onCancel}>
            Anuluj
          </Button>
        </Group>
      </Stack>
    </Paper>
  );
}
