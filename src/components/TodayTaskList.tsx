import type { Assignee, Category, TaskDraft, TodayTask } from "../domain/types";
import { TodayTaskCard } from "./TodayTaskCard";

type Props = {
  tasks: TodayTask[];
  categories: Category[];
  assignees: Assignee[];
  onAdd: () => void;
  onComplete: (taskId: string, scheduledDate: string) => void;
  onPostpone: (taskId: string) => void;
  onDeactivate: (taskId: string) => void;
  onUpdate: (taskId: string, draft: TaskDraft) => void;
};

export function TodayTaskList({ tasks, categories, assignees, onAdd, onComplete, onPostpone, onDeactivate, onUpdate }: Props) {
  if (tasks.length === 0) {
    return (
      <section className="empty-state">
        <h2>Brak zadań na dziś</h2>
        <p className="meta">Dodaj pierwsze zadanie powtarzalne albo zmień filtry.</p>
        <button className="blue-button" type="button" onClick={onAdd}>
          Dodaj zadanie
        </button>
      </section>
    );
  }

  return (
    <section className="task-list" aria-label="Zadania na dziś">
      {tasks.map((item) => (
        <TodayTaskCard
          key={item.task.id}
          item={item}
          categories={categories}
          assignees={assignees}
          onComplete={onComplete}
          onPostpone={onPostpone}
          onDeactivate={onDeactivate}
          onUpdate={onUpdate}
        />
      ))}
    </section>
  );
}
