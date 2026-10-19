import { Alert, Button, Checkbox, Group, NativeSelect, NumberInput, Paper, Stack, Text, TextInput } from "@mantine/core";
import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { createEmptyTaskFormValues, isUnassignedAssigneeName, recurrenceOptions, taskFormValuesToDraft, taskToFormValues, UNASSIGNED_ASSIGNEE_NAME, validateTaskFormValues, type TaskFormErrors } from "../domain/taskForm";
import { isDateString } from "../domain/dates";
import type { AppState, Task, TaskDraft } from "../domain/types";
import { loadTaskFormPreferences, saveTaskFormPreferences } from "../storage/taskFormPreferences";
import { TaskChoices } from "./tasks/TaskChoices";
import { TaskDatePicker } from "./tasks/TaskDatePicker";

type Props = {
  state: AppState;
  today: string;
  initialDate?: string;
  task?: Task;
  submitLabel: string;
  onSubmit: (draft: TaskDraft) => void | Promise<void>;
  onSubmitAndContinue?: (draft: TaskDraft) => void | Promise<void>;
  onCancel: () => void;
};

function activeOptions<T extends { id: string; name: string; active?: boolean; order?: number }>(items: T[]) {
  return [...items].filter(item => item.active !== false).sort((left, right) => (left.order ?? 0) - (right.order ?? 0))
    .map(item => ({ value: item.id, label: item.name }));
}

export function TaskForm({ state, today, initialDate, task, submitLabel, onSubmit, onSubmitAndContinue, onCancel }: Props) {
  const [initial] = useState(() => {
    const preferences = loadTaskFormPreferences(state, today);
    const values = task ? taskToFormValues(task, state) : preferences.values;
    if (!task && initialDate && isDateString(initialDate) && initialDate >= today) {
      values.oneTimeDate = initialDate;
      values.recurringStartDate = initialDate;
    }
    return { values, remember: preferences.enabled };
  });
  const [values, setValues] = useState(initial.values);
  const [remember, setRemember] = useState(initial.remember);
  const [errors, setErrors] = useState<TaskFormErrors>({});
  const [saveError, setSaveError] = useState<string>();
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const titleRef = useRef<HTMLInputElement>(null);
  const [formVersion, setFormVersion] = useState(0);
  useEffect(() => {
    if (formVersion > 0) titleRef.current?.focus();
  }, [formVersion]);
  const dateKey = values.mode === "oneTime" ? "oneTimeDate" : "recurringStartDate";

  async function save(keepOpen: boolean) {
    if (savingRef.current) return;
    const nextErrors = validateTaskFormValues(values, state);
    const date = values[dateKey];
    const originalDate = task?.schedule.mode === "oneTime" ? task.schedule.date : task?.schedule.startDate;
    if (date && (!isDateString(date) || (date < today && (!task || date !== originalDate || values.mode !== task.schedule.mode)))) {
      nextErrors[dateKey] = "Wybierz dzisiaj lub późniejszą datę.";
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    savingRef.current = true;
    setSaving(true);
    setSaveError(undefined);
    setNotice("");
    try {
      const callback = keepOpen ? onSubmitAndContinue : onSubmit;
      if (!callback) return;
      await callback(taskFormValuesToDraft(values, state));
      const stored = task ? true : saveTaskFormPreferences(values, remember);
      if (keepOpen) {
        setValues({ ...(remember ? values : createEmptyTaskFormValues(state, today)), title: "", oneTimeDate: today, recurringStartDate: today, active: true });
        setErrors({});
        setFormVersion(version => version + 1);
      }
      setNotice(stored ? (keepOpen ? "Zadanie zapisane. Dodaj kolejne." : "Zadanie zapisane.") : "Zadanie zapisane. Nie udało się zapamiętać wyborów w przeglądarce.");
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Nie można zapisać zadania.");
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void save(false);
  }

  return (
    <Paper className="task-form" component="form" withBorder p={{ base: "sm", sm: "lg" }} radius="md" aria-label={task ? "Edytuj zadanie" : "Dodaj zadanie"} noValidate onSubmit={handleSubmit}>
      <Stack gap="lg">
        {saveError ? <Alert color="red" title="Zapis przerwany">{saveError}</Alert> : null}
        {errors.dictionary ? <Alert color="yellow" title="Brakuje słowników">{errors.dictionary}</Alert> : null}
        <fieldset className="task-form-fields" disabled={saving}>
        <TextInput ref={titleRef} className="task-title-input" size="lg" label="Nazwa zadania" aria-label="Nazwa zadania" placeholder="Co chcesz zrobić?" required value={values.title} error={errors.title} onChange={event => setValues({ ...values, title: event.currentTarget.value })} />
        <div className="task-form-columns">
          <div className="task-form-choices">
            <TaskChoices label="Typ zadania" value={values.taskTypeId} error={errors.taskTypeId} options={activeOptions(state.taskTypes)} onChange={taskTypeId => setValues({ ...values, taskTypeId })} />
            <TaskChoices label="Tryb" value={values.mode} options={[{ value: "oneTime", label: "Jednorazowe" }, { value: "recurring", label: "Cykliczne" }]} onChange={mode => setValues({ ...values, mode })} />
            <TaskChoices label="Kategoria" tone="category" value={values.categoryId} error={errors.categoryId} options={activeOptions(state.categories)} onChange={categoryId => setValues({ ...values, categoryId })} />
            <TaskChoices label="Osoba" tone="person" value={values.assigneeId} error={errors.assigneeId} options={[{ value: "", label: UNASSIGNED_ASSIGNEE_NAME }, ...activeOptions(state.assignees.filter(person => !isUnassignedAssigneeName(person.name)))]} onChange={assigneeId => setValues({ ...values, assigneeId })} />
            {values.mode === "recurring" ? <>
              <TaskChoices label="Reguła powtarzania" value={values.recurrenceType} options={recurrenceOptions} onChange={recurrenceType => setValues({ ...values, recurrenceType })} />
              {values.recurrenceType === "everyNDays" ? <NumberInput size="lg" label="Liczba dni" aria-label="Liczba dni" required min={1} clampBehavior="none" value={values.intervalDays} error={errors.intervalDays} onChange={value => setValues({ ...values, intervalDays: Number(value) })} /> : null}
            </> : null}
            <details className="task-form-details">
              <summary>Priorytet i aktywność</summary>
              <Stack gap="md" mt="md">
                <NativeSelect size="lg" label="Priorytet" aria-label="Priorytet" value={values.priorityId} data={[{ value: "", label: "Domyślny priorytet" }, ...activeOptions(state.priorities)]} onChange={event => setValues({ ...values, priorityId: event.currentTarget.value })} />
                <Checkbox size="md" label="Aktywne" checked={values.active} onChange={event => setValues({ ...values, active: event.currentTarget.checked })} />
                <Text c="dimmed" size="sm">Nieaktywne zadanie pozostaje w danych, ale nie pojawia się w planie jako wymagające reakcji.</Text>
              </Stack>
            </details>
            {!task ? <Checkbox size="md" label="Zapamiętaj wybory po zapisaniu" checked={remember} onChange={event => setRemember(event.currentTarget.checked)} /> : null}
          </div>
          <TaskDatePicker key={formVersion} today={today} value={values[dateKey]} label={values.mode === "oneTime" ? "Data zadania" : "Data startu"} error={errors[dateKey]} onChange={date => setValues({ ...values, oneTimeDate: date, recurringStartDate: date })} />
        </div>
        </fieldset>
        <Group className="task-form-actions" gap="sm">
          <Button size="lg" type="submit" disabled={saving}>{submitLabel}</Button>
          {!task && onSubmitAndContinue ? <Button size="lg" type="button" variant="default" disabled={saving} onClick={() => void save(true)}>Zapisz i dodaj kolejne</Button> : null}
          <Button size="lg" type="button" variant="subtle" disabled={saving} onClick={onCancel}>Anuluj</Button>
        </Group>
        {notice ? <Text role="status" size="sm">{notice}</Text> : null}
      </Stack>
    </Paper>
  );
}
