import { QuickAddForm } from "./components/QuickAddForm";
import { TaskFilters } from "./components/TaskFilters";
import { TodayTaskList } from "./components/TodayTaskList";
import { formatPolishDateLabel } from "./domain/dates";
import { useTaskerState } from "./hooks/useTaskerState";

type Props = {
  now?: Date;
};

export default function App({ now = new Date() }: Props) {
  const tasker = useTaskerState(now);

  function focusQuickAdd() {
    document.getElementById("quick-add-title")?.focus();
  }

  return (
    <main className="app-shell">
      <header className="app-header" aria-label="Tasker">
        <div>
          <h1>Tasker</h1>
          <p className="today-date">{formatPolishDateLabel(tasker.today)}</p>
        </div>
        <button className="blue-button" type="button" onClick={focusQuickAdd}>
          + Dodaj zadanie
        </button>
      </header>

      <section className="content-panel">
        <div className="section-heading">
          <h2>Dzisiaj</h2>
          <p>Zadania wymagające reakcji</p>
        </div>

        {tasker.storageError ? <p className="warning">{tasker.storageError}</p> : null}

        <TaskFilters
          categories={tasker.state.categories}
          assignees={tasker.state.assignees}
          filters={tasker.filters}
          onChange={tasker.setFilters}
        />

        <TodayTaskList
          tasks={tasker.todayTasks}
          categories={tasker.state.categories}
          assignees={tasker.state.assignees}
          onAdd={focusQuickAdd}
          onComplete={tasker.completeTask}
          onPostpone={tasker.postponeTask}
          onDeactivate={tasker.deactivateTask}
          onUpdate={tasker.updateTask}
        />

        <QuickAddForm
          categories={tasker.state.categories}
          assignees={tasker.state.assignees}
          today={tasker.today}
          onSubmit={tasker.addTask}
        />
      </section>
    </main>
  );
}
