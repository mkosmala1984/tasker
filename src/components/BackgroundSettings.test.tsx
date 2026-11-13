import { MantineProvider } from "@mantine/core";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BackgroundSettings } from "./BackgroundSettings";

const image = { name: "board.png", dataUrl: "data:image/png;base64,aGVsbG8=" };
beforeEach(() => {
  vi.stubGlobal("Image", class {
    naturalWidth = 1;
    naturalHeight = 1;
    onload?: () => void;
    set src(_value: string) { queueMicrotask(() => this.onload?.()); }
  });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
function setup(onSave = vi.fn().mockResolvedValue(undefined), current = null as typeof image | null) {
  render(<MantineProvider><BackgroundSettings image={current} onSave={onSave} /></MantineProvider>);
  return onSave;
}
function upload(file: File) {
  fireEvent.change(screen.getByLabelText("Wgraj grafikę tła"), { target: { files: [file] } });
}
describe("background settings", () => {
  it("reads the whole image and waits for the database before confirming save", async () => {
    let resolve!: () => void;
    const onSave = setup(vi.fn(() => new Promise<void>((done) => { resolve = done; })));
    upload(new File(["hello"], "board.png", { type: "image/png" }));
    await waitFor(() => expect(onSave).toHaveBeenCalledWith(image));
    expect(screen.queryByText("Zapisano tło. Synchronizacja działa zgodnie z ustawieniami Tigris.")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Wgraj grafikę tła")).toBeDisabled();
    resolve();
    expect(await screen.findByRole("status")).toHaveTextContent("Zapisano tło.");
  });

  it("rejects unsupported and oversized files before saving", async () => {
    const save = setup();
    upload(new File(["svg"], "x.svg", { type: "image/svg+xml" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("PNG, JPEG lub WebP");
    upload(new File([new Uint8Array(5 * 1024 * 1024 + 1)], "large.png", { type: "image/png" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("5 MB"));
    expect(save).not.toHaveBeenCalled();
  });

  it("rejects a file whose image cannot be decoded", async () => {
    vi.stubGlobal("Image", class {
      onerror?: () => void;
      set src(_value: string) { queueMicrotask(() => this.onerror?.()); }
    });
    const save = setup();
    upload(new File(["broken"], "bad.png", { type: "image/png" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Nie można odczytać grafiki");
    expect(save).not.toHaveBeenCalled();
  });

  it("previews the current image and resets it through the save action", async () => {
    const save = setup(undefined, image);
    expect(screen.getByAltText("Podgląd tła tablicy")).toHaveAttribute("src", image.dataUrl);
    fireEvent.click(screen.getByRole("button", { name: "Przywróć domyślne tło" }));
    await waitFor(() => expect(save).toHaveBeenCalledWith(null));
  });

  it("keeps the existing preview and reports a database write error", async () => {
    setup(vi.fn().mockRejectedValue(new Error("Brak miejsca w bazie.")), image);
    upload(new File(["hello"], "new.png", { type: "image/png" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Brak miejsca w bazie.");
    expect(screen.getByAltText("Podgląd tła tablicy")).toHaveAttribute("src", image.dataUrl);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});
