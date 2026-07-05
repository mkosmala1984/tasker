import { useState } from "react";
import type { Assignee, Category, TaskDraft, TodayTask } from "../domain/types";
import { TaskForm } from "./TaskForm";

type Props = {
  item: TodayTask;
  categories: Category[];
  assignees: Assignee[];
  onComplete: (taskId: string, scheduledDate: string) => void;
  onPostpone: (taskId: string) => void;
  onDeactivate: (taskId: string) => void;
  onUpdate: (taskId: string, draft: TaskDraft) => void;
};

export function TodayTaskCard({ item, categories, assignees, onComplete, onPostpone, onDeactivate, onUpdate }: Props) {
  const [isEditing, setIsEditing] = useState(false);

  if (isEditing) {
    return (
      <TaskForm
        task={item.task}
        categories={categories}
        assignees={assignees}
        onCancel={() => setIsEditing(false)}
        onSubmit={(draft) => {
          onUpdate(item.task.id, draft);
          setIsEditing(false);
        }}
      />
    );
  }

  const statusText = item.isOverdue ? `Zaległe od ${item.scheduledDate}` : "Dzisiaj";
  const completionText = item.lastCompletedDate ? `Ostatnio wykonane: ${item.lastCompletedDate}` : "Jeszcze nie wykonane";

  return (
    <article className={item.isOverdue ? "task-card is-overdue" : "task-card"}>
      <div className="task-card-header">
        <div>
          <h2 className="task-title">{item.task.title}</h2>
        </div>
        <span className={item.isOverdue ? "status-pill is-overdue" : "status-pill"}>{statusText}</span>
      </div>

      <div className="task-meta" aria-label="Szczegóły zadania">
        <span className="meta-pill">{item.category.name}</span>
        <span className="meta-pill">{item.assignee.name}</span>
        <span className="meta-pill">{completionText}</span>
      </div>

      <div className="task-actions">
        <button className="complete-button" type="button" onClick={() => onComplete(item.task.id, item.scheduledDate)}>
          Wykonane
        </button>
        <button className="secondary-button" type="button" onClick={() => onPostpone(item.task.id)}>
          Odłóż na jutro
        </button>
        <button className="secondary-button" type="button" onClick={() => setIsEditing(true)}>
          Edytuj
        </button>
        <button className="danger-button" type="button" onClick={() => onDeactivate(item.task.id)}>
          Dezaktywuj
        </button>
      </div>
    </article>
  );
}
