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
    <form
      className="task-form"
      aria-label={task ? "Edytuj zadanie" : "Dodaj zadanie"}
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(draft);
      }}
    >
      <label className="field">
        <span>Nazwa zadania</span>
        <input required value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} />
      </label>

      <label className="field">
        <span>Kategoria</span>
        <input
          required
          list="tasker-categories"
          value={draft.categoryName}
          onChange={(event) => setDraft({ ...draft, categoryName: event.target.value })}
        />
        <datalist id="tasker-categories">
          {categories.map((category) => (
            <option key={category.id} value={category.name} />
          ))}
        </datalist>
      </label>

      <label className="field">
        <span>Osoba</span>
        <input
          required
          list="tasker-assignees"
          value={draft.assigneeName}
          onChange={(event) => setDraft({ ...draft, assigneeName: event.target.value })}
        />
        <datalist id="tasker-assignees">
          {assignees.map((assignee) => (
            <option key={assignee.id} value={assignee.name} />
          ))}
        </datalist>
      </label>

      <label className="field">
        <span>Data startu</span>
        <input required type="date" value={draft.startDate} onChange={(event) => setDraft({ ...draft, startDate: event.target.value })} />
      </label>

      <label className="field">
        <span>Powtarzanie</span>
        <select value={recurrenceType(draft.recurrence)} onChange={(event) => changeRecurrence(event.target.value as RecurrenceRule["type"])}>
          <option value="daily">Codziennie</option>
          <option value="everyNDays">Co N dni</option>
          <option value="weekly">Co tydzień</option>
          <option value="monthly">Co miesiąc</option>
          <option value="quarterly">Co kwartał</option>
        </select>
      </label>

      {draft.recurrence.type === "everyNDays" ? (
        <label className="field">
          <span>Liczba dni</span>
          <input
            required
            min={1}
            type="number"
            value={draft.recurrence.intervalDays}
            onChange={(event) =>
              setDraft({
                ...draft,
                recurrence: { type: "everyNDays", intervalDays: Number(event.target.value) }
              })
            }
          />
        </label>
      ) : null}

      <label className="field">
        <span>Status</span>
        <select value={draft.active ? "active" : "inactive"} onChange={(event) => setDraft({ ...draft, active: event.target.value === "active" })}>
          <option value="active">Aktywne</option>
          <option value="inactive">Nieaktywne</option>
        </select>
      </label>

      <div className="form-actions">
        <button className="blue-button" type="submit">
          Zapisz
        </button>
        <button className="secondary-button" type="button" onClick={onCancel}>
          Anuluj
        </button>
      </div>
    </form>
  );
}
