import { Alert, Button, Group, Input, Stack, Text, Title } from "@mantine/core";
import { useState } from "react";
import type { AppState } from "../domain/types";
import type { TigrisCredentials } from "../storage/tigrisStorage";
import {
  createExportPayload,
  serializeExportPayload,
  type ImportPreview,
} from "../storage/taskerBackup";
import type { RemoteSyncStatus } from "../state/remoteSync";
import type { SyncConflict } from "../domain/syncOperations";

type Props = {
  state: AppState;
  onPreviewImport: (raw: string) => ImportPreview;
  onApplyImport: (preview: ImportPreview) => void | Promise<void>;
  tigrisCredentials?: TigrisCredentials;
  tigrisStatus: RemoteSyncStatus;
  onConfigureTigris: (credentials: TigrisCredentials) => Promise<void>;
  onDisconnectTigris: () => void;
  conflicts?: SyncConflict[];
  onResolveConflict?: (
    conflict: SyncConflict,
    choice: "local" | "remote",
  ) => Promise<void>;
};

function getTigrisStatus(status: RemoteSyncStatus): {
  color: string;
  message: string;
} {
  switch (status.kind) {
    case "checking":
      return { color: "blue", message: "Sprawdzanie danych Tigris." };
    case "syncing":
      return { color: "blue", message: "Synchronizowanie danych Tigris." };
    case "synced":
      return { color: "green", message: "Zsynchronizowano dane z Tigris." };
    case "local":
      return { color: "gray", message: "Zapisano lokalnie." };
    case "pending":
      return { color: "yellow", message: "Oczekuje na synchronizację." };
    case "conflict":
      return { color: "yellow", message: "Zmiany wymagają rozstrzygnięcia." };
    case "error":
      return { color: "red", message: status.message };
    case "disconnected":
      return { color: "gray", message: "Tigris nie jest polaczony." };
  }
}

function readFileText(file: File): Promise<string> {
  if ("text" in file && typeof file.text === "function") {
    return file.text();
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(String(reader.result ?? "")));
    reader.addEventListener("error", () =>
      reject(new Error("Nie mozna odczytac pliku importu.")),
    );
    reader.readAsText(file);
  });
}

export function DataTransferView({
  state,
  onPreviewImport,
  onApplyImport,
  tigrisCredentials,
  tigrisStatus,
  onConfigureTigris,
  onDisconnectTigris,
  conflicts = [],
  onResolveConflict,
}: Props) {
  const [preview, setPreview] = useState<ImportPreview | undefined>();
  const [error, setError] = useState<string | undefined>();
  const [bucket, setBucket] = useState(tigrisCredentials?.bucket ?? "");
  const [objectKey, setObjectKey] = useState(
    tigrisCredentials?.objectKey ?? "tasker.json",
  );
  const [accessKeyId, setAccessKeyId] = useState(
    tigrisCredentials?.accessKeyId ?? "",
  );
  const [secretAccessKey, setSecretAccessKey] = useState(
    tigrisCredentials?.secretAccessKey ?? "",
  );
  const tigrisSyncStatus = getTigrisStatus(tigrisStatus);
  const canConfigureTigris = [
    bucket,
    objectKey,
    accessKeyId,
    secretAccessKey,
  ].every((value) => value.trim().length > 0);

  function exportData() {
    const payload = createExportPayload(state, new Date().toISOString());
    const blob = new Blob([serializeExportPayload(payload)], {
      type: "application/json",
    });
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
      setError(
        caught instanceof Error
          ? caught.message
          : "Nie mozna odczytac pliku importu.",
      );
    }
  }

  async function confirmImport() {
    if (!preview) {
      return;
    }
    try {
      await onApplyImport(preview);
      setPreview(undefined);
      setError(undefined);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Nie można zapisać importu.",
      );
      if (caught instanceof Error && /ponownie/.test(caught.message))
        setPreview(onPreviewImport(serializeExportPayload(preview.payload)));
    }
  }

  function configureTigris() {
    if (!canConfigureTigris) {
      return;
    }
    void onConfigureTigris({
      bucket: bucket.trim(),
      objectKey: objectKey.trim(),
      accessKeyId: accessKeyId.trim(),
      secretAccessKey: secretAccessKey.trim(),
    });
  }

  return (
    <Stack gap="md">
      <Title order={2}>Dane</Title>
      {conflicts.map((conflict) => (
        <Alert
          key={`${conflict.operationId}:${conflict.id}:${conflict.field}`}
          color="yellow"
          title={`Konflikt: ${state.tasks.find((t) => t.id === conflict.id)?.title ?? conflict.id} — ${conflict.field}`}
        >
          <Stack gap="xs">
            {conflict.field === "$entity" && conflict.local ? (
              <Text>
                Przywrócenie mojej wersji przywróci też brakujące kategorie,
                osoby, typy i priorytety potrzebne temu zadaniu.
              </Text>
            ) : null}
            {conflict.reason === "reference-delete" ? (
              <Text>
                Ten wpis jest teraz używany przez zadania. Aby go usunąć,
                najpierw zmień ich odwołania.
              </Text>
            ) : null}
            <Text>
              Moja wartość: {JSON.stringify(conflict.local) ?? "usunięto"}
            </Text>
            <Text>
              Zdalna wartość: {JSON.stringify(conflict.remote) ?? "usunięto"}
            </Text>
            <Group>
              <Button
                disabled={conflict.reason === "reference-delete"}
                onClick={() =>
                  void onResolveConflict?.(conflict, "local").catch((e) =>
                    setError(e.message),
                  )
                }
              >
                Zachowaj moją zmianę
              </Button>
              <Button
                variant="default"
                onClick={() =>
                  void onResolveConflict?.(conflict, "remote").catch((e) =>
                    setError(e.message),
                  )
                }
              >
                Przyjmij zmianę zdalną
              </Button>
            </Group>
          </Stack>
        </Alert>
      ))}
      <Alert color="yellow" title="Uwaga: dane dostepu Tigris">
        Tajny klucz dostepu jest przechowywany w tej przegladarce. Uzyj
        dedykowanego bucketu z minimalnymi uprawnieniami.
      </Alert>
      <Alert color={tigrisSyncStatus.color} title="Synchronizacja Tigris">
        {tigrisSyncStatus.message}
      </Alert>
      <Input.Wrapper label="Bucket Tigris">
        <Input
          value={bucket}
          onChange={(event) => setBucket(event.currentTarget.value)}
        />
      </Input.Wrapper>
      <Input.Wrapper label="Klucz obiektu Tigris">
        <Input
          value={objectKey}
          onChange={(event) => setObjectKey(event.currentTarget.value)}
        />
      </Input.Wrapper>
      <Input.Wrapper label="ID klucza dostepu Tigris">
        <Input
          value={accessKeyId}
          onChange={(event) => setAccessKeyId(event.currentTarget.value)}
        />
      </Input.Wrapper>
      <Input.Wrapper label="Tajny klucz dostepu Tigris">
        <Input
          type="password"
          value={secretAccessKey}
          onChange={(event) => setSecretAccessKey(event.currentTarget.value)}
        />
      </Input.Wrapper>
      <Group>
        <Button
          type="button"
          onClick={configureTigris}
          disabled={!canConfigureTigris}
        >
          Polacz z Tigris
        </Button>
        {tigrisCredentials ? (
          <Button
            type="button"
            color="red"
            variant="light"
            onClick={onDisconnectTigris}
          >
            Rozlacz Tigris
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
          onChange={(event) =>
            void importFile(event.currentTarget.files?.[0] ?? null)
          }
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
