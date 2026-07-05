import type { Assignee, Category, TodayFilters } from "../domain/types";

type Props = {
  categories: Category[];
  assignees: Assignee[];
  filters: TodayFilters;
  onChange: (filters: TodayFilters) => void;
};

export function TaskFilters({ categories, assignees, filters, onChange }: Props) {
  return (
    <section className="filters" aria-label="Filtry">
      <div className="category-tabs" aria-label="Kategorie">
        <button
          className={filters.categoryId === "" ? "category-tab is-selected" : "category-tab"}
          type="button"
          onClick={() => onChange({ ...filters, categoryId: "" })}
        >
          Wszystkie
        </button>
        {categories.map((category) => (
          <button
            className={filters.categoryId === category.id ? "category-tab is-selected" : "category-tab"}
            key={category.id}
            type="button"
            onClick={() => onChange({ ...filters, categoryId: category.id })}
          >
            {category.name}
          </button>
        ))}
      </div>

      <label className="field assignee-filter">
        <span>Osoba</span>
        <select value={filters.assigneeId} onChange={(event) => onChange({ ...filters, assigneeId: event.target.value })}>
          <option value="">Wszystkie osoby</option>
          {assignees.map((assignee) => (
            <option key={assignee.id} value={assignee.id}>
              {assignee.name}
            </option>
          ))}
        </select>
      </label>
    </section>
  );
}
