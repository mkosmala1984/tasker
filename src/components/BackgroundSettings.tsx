import { Alert, Button, Group, Stack, Text, Title } from "@mantine/core";
import { useState } from "react";
import { BACKGROUND_IMAGE_TYPES, MAX_BACKGROUND_BYTES, type BoardBackgroundImage } from "../domain/boardBackground";
import defaultBackground from "../assets/pastel-watercolor-beach-at-dawn.png";

function readImage(file: File): Promise<BoardBackgroundImage> {
  if (!BACKGROUND_IMAGE_TYPES.includes(file.type)) return Promise.reject(new Error("Wybierz plik PNG, JPEG lub WebP."));
  if (!file.size || file.size > MAX_BACKGROUND_BYTES) return Promise.reject(new Error("Grafika musi mieć od 1 bajta do 5 MB."));
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    const failed = () => reject(new Error("Nie można odczytać grafiki. Wybierz poprawny plik obrazu."));
    reader.onerror = reader.onabort = failed;
    reader.onload = () => {
      const dataUrl = reader.result;
      if (typeof dataUrl !== "string") return failed();
      const decoded = new Image();
      decoded.onerror = failed;
      decoded.onload = () => decoded.naturalWidth > 0 && decoded.naturalHeight > 0
        ? resolve({ name: file.name, dataUrl }) : failed();
      decoded.src = dataUrl;
    };
    reader.readAsDataURL(file);
  });
}

type Props = {
  image: BoardBackgroundImage | null;
  onSave: (image: BoardBackgroundImage | null) => Promise<void>;
};

export function BackgroundSettings({ image, onSave }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [saved, setSaved] = useState(false);

  async function save(file?: File) {
    setBusy(true);
    setError(undefined);
    setSaved(false);
    try {
      await onSave(file ? await readImage(file) : null);
      setSaved(true);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Nie można zapisać tła.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Stack gap="sm">
      <Title order={3}>Tło tablicy</Title>
      <Text size="sm">Wybierz PNG, JPEG lub WebP do 5 MB. Tło zapisuje się po wyborze pliku i synchronizuje przez Tigris, jeśli połączenie jest skonfigurowane.</Text>
      <img className="background-preview" src={image?.dataUrl ?? defaultBackground} alt="Podgląd tła tablicy" />
      <Text size="sm">{image?.name ?? "Domyślne tło"}</Text>
      <Group align="flex-end">
        <Stack gap={4}>
          <label htmlFor="board-background-upload">Wgraj grafikę tła</label>
          <input id="board-background-upload" type="file" accept={BACKGROUND_IMAGE_TYPES.join(",")} disabled={busy}
            onChange={(event) => {
              const file = event.currentTarget.files?.[0];
              event.currentTarget.value = "";
              if (file) void save(file);
            }} />
        </Stack>
        <Button variant="default" disabled={busy || !image} onClick={() => void save()}>Przywróć domyślne tło</Button>
      </Group>
      {busy ? <Text size="sm">Zapisywanie tła…</Text> : null}
      {error ? <Alert color="red" title="Nie zapisano tła" role="alert">{error}</Alert> : null}
      {saved ? <Text role="status" size="sm">Zapisano tło. Synchronizacja działa zgodnie z ustawieniami Tigris.</Text> : null}
    </Stack>
  );
}
