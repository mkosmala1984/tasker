import { Alert, Button, Group, Input, Stack, Text, Title } from "@mantine/core";
import { useState } from "react";
import type { AppState } from "../domain/types";
import { createExportPayload, serializeExportPayload, type ImportPreview } from "../storage/taskerBackup";

type Props = {
  state: AppState;
  onPreviewImport: (raw: string) => ImportPreview;
  onApplyImport: (preview: ImportPreview) => void;
};

function readFileText(file: File): Promise<string> {
  if ("text" in file && typeof file.text === "function") {
    return file.text();
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(String(reader.result ?? "")));
    reader.addEventListener("error", () => reject(new Error("Nie mozna odczytac pliku importu.")));
    reader.readAsText(file);
  });
}

export function DataTransferView({ state, onPreviewImport, onApplyImport }: Props) {
  const [preview, setPreview] = useState<ImportPreview | undefined>();
  const [error, setError] = useState<string | undefined>();

  function exportData() {
    const payload = createExportPayload(state, new Date().toISOString());
    const blob = new Blob([serializeExportPayload(payload)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `tasker-backup-${payload.exportedAt.slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function importFile(file: File | null) {
    setPreview(undefined);
    setError(undefined);
    if (!file) {
      return;
    }

    try {
      const raw = await readFileText(file);
      setPreview(onPreviewImport(raw));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Nie mozna odczytac pliku importu.");
    }
  }

  function confirmImport() {
    if (!preview) {
      return;
    }
    onApplyImport(preview);
    setPreview(undefined);
    setError(undefined);
  }

  return (
    <Stack gap="md">
      <Title order={2}>Dane</Title>
      <Group>
        <Button type="button" onClick={exportData}>
          Eksportuj dane
        </Button>
      </Group>
      <Input.Wrapper label="Plik importu">
        <Input
          aria-label="Plik importu"
          type="file"
          accept="application/json,.json"
          onChange={(event) => void importFile(event.currentTarget.files?.[0] ?? null)}
        />
      </Input.Wrapper>
      {error ? (
        <Alert color="red" title="Import przerwany">
          {error}
        </Alert>
      ) : null}
      {preview ? (
        <Alert color="blue" title="Podsumowanie importu">
          <Stack gap="xs">
            <Text>Zadania: {preview.summary.taskCount}</Text>
            <Text>Kategorie: {preview.summary.categoryCount}</Text>
            <Text>Osoby: {preview.summary.assigneeCount}</Text>
            <Text>Typy zadan: {preview.summary.taskTypeCount}</Text>
            <Text>Priorytety: {preview.summary.priorityCount}</Text>
            <Text>Historia: {preview.summary.completionCount}</Text>
            <Text>Odlozenia: {preview.summary.postponementCount}</Text>
            <Button type="button" color="red" onClick={confirmImport}>
              Potwierdz import i zastap dane
            </Button>
          </Stack>
        </Alert>
      ) : null}
    </Stack>
  );
}
