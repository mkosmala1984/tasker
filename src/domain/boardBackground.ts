import type { AppState } from "./types";

export type BoardBackgroundImage = { name: string; dataUrl: string };
export type BoardBackground = { id: "today"; image: BoardBackgroundImage | null };
export const MAX_BACKGROUND_BYTES = 5 * 1024 * 1024;
export const BACKGROUND_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"];

export function isBackgroundImage(value: unknown): value is BoardBackgroundImage {
  if (!value || typeof value !== "object") return false;
  const image = value as Partial<BoardBackgroundImage>;
  if (typeof image.name !== "string" || !image.name.trim() || typeof image.dataUrl !== "string") return false;
  const match = /^data:image\/(?:png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(image.dataUrl);
  if (!match || match[1].length % 4 !== 0) return false;
  const padding = match[1].endsWith("==") ? 2 : match[1].endsWith("=") ? 1 : 0;
  return match[1].length / 4 * 3 - padding <= MAX_BACKGROUND_BYTES;
}

export function setBoardBackground(state: AppState, image: BoardBackgroundImage | null): AppState {
  if (image !== null && !isBackgroundImage(image)) throw new Error("Niepoprawna grafika tła.");
  return { ...state, backgrounds: [{ id: "today", image }] };
}

export function backgroundValueLabel(value: unknown): string {
  if (value && typeof value === "object" && "image" in value) return backgroundValueLabel(value.image);
  return isBackgroundImage(value) ? value.name : "Domyślne tło";
}
