import { Alert, Button, Group, Stack, Title } from "@mantine/core";
import { useState } from "react";
import type { AppState, TaskDraft } from "../../domain/types";
import { TaskForm } from "../TaskForm";

type Props = {
  state: AppState;
  today: string;
  initialDate?: string;
  taskId?: string | null;
  onCreate: (draft: TaskDraft) => void | Promise<void>;
  onUpdate: (taskId: string, draft: TaskDraft, base: AppState) => void | Promise<void>;
  onCancel: () => void;
};

export function TaskEditorView({ state, today, initialDate, taskId, onCreate, onUpdate, onCancel }: Props) {
  const [editingBase] = useState(() => structuredClone(state));
  const task = taskId ? editingBase.tasks.find((item) => item.id === taskId) : undefined;
  const createDate = initialDate ?? today;

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
        state={editingBase}
        today={task ? today : createDate}
        task={task}
        submitLabel={task ? "Zapisz zmiany" : "Zapisz zadanie"}
        onCancel={onCancel}
        onSubmit={async (draft) => {
          if (task) {
            await onUpdate(task.id, draft, editingBase);
          } else {
            await onCreate(draft);
          }
        }}
      />
    </Stack>
  );
}
