import { Alert, Button, Group, Input, Stack, Text, Title } from "@mantine/core";
import { useState } from "react";
import type { AppState } from "../domain/types";
import type { JsonHostingCredentials } from "../storage/jsonHostingStorage";
import { createExportPayload, serializeExportPayload, type ImportPreview } from "../storage/taskerBackup";
import type { JsonHostingSyncStatus } from "../state/jsonHostingSync";

type Props = {
  state: AppState;
  onPreviewImport: (raw: string) => ImportPreview;
  onApplyImport: (preview: ImportPreview) => void;
  credentials?: JsonHostingCredentials;
  status: JsonHostingSyncStatus;
  onConfigureJsonHosting: (credentials: JsonHostingCredentials) => void;
  onDisconnectJsonHosting: () => void;
};

function getJsonHostingStatus(status: JsonHostingSyncStatus): { color: string; message: string } {
  switch (status.kind) {
    case "checking":
      return { color: "blue", message: "Sprawdzanie danych JSONHosting." };
    case "syncing":
      return { color: "blue", message: "Synchronizowanie danych JSONHosting." };
    case "synced":
      return { color: "green", message: "Zsynchronizowano dane z JSONHosting." };
    case "remote-loaded":
      return { color: "green", message: "Wczytano nowsze dane z JSONHosting." };
    case "error":
      return { color: "red", message: status.message };
    case "disconnected":
      return { color: "gray", message: "JSONHosting nie jest polaczony." };
  }
}

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

export function DataTransferView({
  state,
  onPreviewImport,
  onApplyImport,
  credentials,
  status,
  onConfigureJsonHosting,
  onDisconnectJsonHosting
}: Props) {
  const [preview, setPreview] = useState<ImportPreview | undefined>();
  const [error, setError] = useState<string | undefined>();
  const [documentId, setDocumentId] = useState(credentials?.documentId ?? "");
  const [editKey, setEditKey] = useState(credentials?.editKey ?? "");
  const jsonHostingStatus = getJsonHostingStatus(status);
  const canConfigureJsonHosting = documentId.trim().length > 0 && editKey.trim().length > 0;

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

  function configureJsonHosting() {
    if (!canConfigureJsonHosting) {
      return;
    }
    onConfigureJsonHosting({ documentId: documentId.trim(), editKey: editKey.trim() });
  }

  return (
    <Stack gap="md">
      <Title order={2}>Dane</Title>
      <Alert color="yellow" title="Uwaga: publiczne dane">
        Dokumenty JSONHosting sa publicznie dostepne. Nie zapisuj w nich poufnych danych.
      </Alert>
      <Alert color={jsonHostingStatus.color} title="Synchronizacja JSONHosting">
        {jsonHostingStatus.message}
      </Alert>
      <Input.Wrapper label="ID dokumentu JSONHosting">
        <Input value={documentId} onChange={(event) => setDocumentId(event.currentTarget.value)} />
      </Input.Wrapper>
      <Input.Wrapper label="Klucz edycji JSONHosting">
        <Input type="password" value={editKey} onChange={(event) => setEditKey(event.currentTarget.value)} />
      </Input.Wrapper>
      <Group>
        <Button type="button" onClick={configureJsonHosting} disabled={!canConfigureJsonHosting}>
          Polacz z JSONHosting
        </Button>
        {credentials ? (
          <Button type="button" color="red" variant="light" onClick={onDisconnectJsonHosting}>
            Rozlacz JSONHosting
          </Button>
        ) : null}
      </Group>
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
