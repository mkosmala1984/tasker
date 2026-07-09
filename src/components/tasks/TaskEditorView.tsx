import { Alert, Button, Group, Stack, Title } from "@mantine/core";
import type { AppState, TaskDraft } from "../../domain/types";
import { TaskForm } from "../TaskForm";

type Props = {
  state: AppState;
  today: string;
  taskId?: string | null;
  onCreate: (draft: TaskDraft) => void;
  onUpdate: (taskId: string, draft: TaskDraft) => void;
  onCancel: () => void;
};

export function TaskEditorView({ state, today, taskId, onCreate, onUpdate, onCancel }: Props) {
  const task = taskId ? state.tasks.find((item) => item.id === taskId) : undefined;

  if (taskId && !task) {
    return (
      <Stack align="flex-start" gap="md">
        <Alert color="yellow" title="Nie znaleziono zadania">
          Zadanie moglo zostac usuniete albo dane lokalne zostaly odswiezone.
        </Alert>
        <Button type="button" variant="default" onClick={onCancel}>
          Wroc do listy zadan
        </Button>
      </Stack>
    );
  }

  return (
    <Stack gap="md">
      <Group justify="space-between" align="center">
        <Title order={2}>{task ? "Edytuj zadanie" : "Dodaj zadanie"}</Title>
        <Button type="button" variant="default" onClick={onCancel}>
          Wroc do listy
        </Button>
      </Group>
      <TaskForm
        state={state}
        today={today}
        task={task}
        submitLabel={task ? "Zapisz zmiany" : "Zapisz zadanie"}
        onCancel={onCancel}
        onSubmit={(draft) => {
          if (task) {
            onUpdate(task.id, draft);
          } else {
            onCreate(draft);
          }
        }}
      />
    </Stack>
  );
}
