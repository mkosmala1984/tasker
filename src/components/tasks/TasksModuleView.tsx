import { Paper } from "@mantine/core";
import type { TaskDraft } from "../../domain/types";
import { useTaskerStore } from "../../state/taskerStore";
import { TaskEditorView } from "./TaskEditorView";
import { TaskListView } from "./TaskListView";

type Props = {
  today: string;
};

export function TasksModuleView({ today }: Props) {
  const state = useTaskerStore((store) => store.state);
  const taskEditorTaskId = useTaskerStore((store) => store.taskEditorTaskId);
  const openTaskCreate = useTaskerStore((store) => store.openTaskCreate);
  const openTaskEdit = useTaskerStore((store) => store.openTaskEdit);
  const closeTaskEditor = useTaskerStore((store) => store.closeTaskEditor);
  const addTask = useTaskerStore((store) => store.addTask);
  const updateTask = useTaskerStore((store) => store.updateTask);
  const deactivateTask = useTaskerStore((store) => store.deactivateTask);

  function handleCreate(draft: TaskDraft) {
    addTask(draft);
    closeTaskEditor();
  }

  function handleUpdate(taskId: string, draft: TaskDraft) {
    updateTask(taskId, draft);
    closeTaskEditor();
  }

  return (
    <Paper withBorder p="lg" radius="md" shadow="xs">
      {taskEditorTaskId !== undefined ? (
        <TaskEditorView
          state={state}
          today={today}
          taskId={taskEditorTaskId}
          onCreate={handleCreate}
          onUpdate={handleUpdate}
          onCancel={closeTaskEditor}
        />
      ) : (
        <TaskListView state={state} onCreate={openTaskCreate} onEdit={openTaskEdit} onDeactivate={deactivateTask} />
      )}
    </Paper>
  );
}
