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
    <form
      className="quick-add"
      aria-label="Szybkie dodanie"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit({
          ...form,
          recurrence: { type: "daily" },
          startDate: today,
          active: true
        });
        setForm(emptyForm);
      }}
    >
      <h2>Szybkie dodanie</h2>

      <label className="field">
        <span>Nazwa zadania</span>
        <input
          id="quick-add-title"
          required
          value={form.title}
          onChange={(event) => setForm({ ...form, title: event.target.value })}
        />
      </label>

      <label className="field">
        <span>Kategoria</span>
        <input
          required
          list="quick-add-categories"
          value={form.categoryName}
          onChange={(event) => setForm({ ...form, categoryName: event.target.value })}
        />
        <datalist id="quick-add-categories">
          {categories.map((category) => (
            <option key={category.id} value={category.name} />
          ))}
        </datalist>
      </label>

      <label className="field">
        <span>Osoba</span>
        <input
          required
          list="quick-add-assignees"
          value={form.assigneeName}
          onChange={(event) => setForm({ ...form, assigneeName: event.target.value })}
        />
        <datalist id="quick-add-assignees">
          {assignees.map((assignee) => (
            <option key={assignee.id} value={assignee.name} />
          ))}
        </datalist>
      </label>

      <div className="form-actions">
        <button className="blue-button" type="submit">
          Zapisz
        </button>
      </div>
    </form>
  );
}
