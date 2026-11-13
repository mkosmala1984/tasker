import { useEffect, useState } from "react";
import type { BoardBackgroundImage } from "../domain/boardBackground";

// Keep image bytes out of CSS custom properties, which have browser size limits.
export function useBoardBackgroundUrl(image: BoardBackgroundImage | null): string | undefined {
  const [url, setUrl] = useState<string>();
  const dataUrl = image?.dataUrl;
  useEffect(() => {
    if (!dataUrl) {
      setUrl(undefined);
      return;
    }
    const comma = dataUrl.indexOf(",");
    const mimeType = dataUrl.slice(5, dataUrl.indexOf(";"));
    const decoded = atob(dataUrl.slice(comma + 1));
    const bytes = Uint8Array.from(decoded, (character) => character.charCodeAt(0));
    const objectUrl = URL.createObjectURL(new Blob([bytes], { type: mimeType }));
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [dataUrl]);
  return url;
}
