import { Paper } from "@mantine/core";
import type { AppState, TaskDraft } from "../../domain/types";
import { useTaskerStore } from "../../state/taskerStore";
import { TaskEditorView } from "./TaskEditorView";
import { TaskListView } from "./TaskListView";

type Props = {
  today: string;
};

export function TasksModuleView({ today }: Props) {
  const state = useTaskerStore((store) => store.state);
  const taskEditorTaskId = useTaskerStore((store) => store.taskEditorTaskId);
  const taskEditorInitialDate = useTaskerStore((store) => store.taskEditorInitialDate);
  const openTaskCreate = useTaskerStore((store) => store.openTaskCreate);
  const openTaskEdit = useTaskerStore((store) => store.openTaskEdit);
  const closeTaskEditor = useTaskerStore((store) => store.closeTaskEditor);
  const addTask = useTaskerStore((store) => store.addTask);
  const updateTask = useTaskerStore((store) => store.updateTask);
  const deactivateTask = useTaskerStore((store) => store.deactivateTask);

  async function handleCreate(draft: TaskDraft) {
    await addTask(draft);
    closeTaskEditor();
  }

  async function handleUpdate(taskId: string, draft: TaskDraft, base: AppState) {
    await updateTask(taskId, draft, undefined, base);
    closeTaskEditor();
  }

  return (
    <Paper withBorder p="lg" radius="md" shadow="xs">
      {taskEditorTaskId !== undefined ? (
        <TaskEditorView
          key={taskEditorTaskId ?? "create"}
          state={state}
          today={today}
          initialDate={taskEditorInitialDate}
          taskId={taskEditorTaskId}
          onCreate={handleCreate}
          onUpdate={handleUpdate}
          onCancel={closeTaskEditor}
        />
      ) : (
        <TaskListView state={state} onCreate={() => openTaskCreate()} onEdit={openTaskEdit} onDeactivate={(id) => void deactivateTask(id).catch(() => undefined)} />
      )}
    </Paper>
  );
}
