import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { useBoardBackgroundUrl } from "./useBoardBackgroundUrl";

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

it("uses a short object URL even when encoded image data exceeds CSS variable limits", async () => {
  const create = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:large-background");
  const revoke = vi.spyOn(URL, "revokeObjectURL");
  const image = { name: "large.png", dataUrl: `data:image/png;base64,${"AAAA".repeat(750000)}` };
  const view = renderHook(({ image }) => useBoardBackgroundUrl(image), { initialProps: { image: image as typeof image | null } });
  await waitFor(() => expect(view.result.current).toBe("blob:large-background"));
  const blob = create.mock.calls[0][0];
  expect(blob).toBeInstanceOf(Blob);
  expect((blob as Blob).size).toBe(2250000);
  expect((blob as Blob).type).toBe("image/png");
  view.rerender({ image: null });
  await waitFor(() => expect(view.result.current).toBeUndefined());
  expect(revoke).toHaveBeenCalledWith("blob:large-background");
});

it("revokes the previous URL when an image changes and on unmount", async () => {
  const create = vi.spyOn(URL, "createObjectURL").mockReturnValueOnce("blob:first").mockReturnValueOnce("blob:second");
  const revoke = vi.spyOn(URL, "revokeObjectURL");
  const image = { name: "first.png", dataUrl: "data:image/png;base64,aGVsbG8=" };
  const view = renderHook(({ image }) => useBoardBackgroundUrl(image), { initialProps: { image } });
  await waitFor(() => expect(view.result.current).toBe("blob:first"));
  view.rerender({ image: { name: "second.webp", dataUrl: "data:image/webp;base64,d29ybGQ=" } });
  await waitFor(() => expect(view.result.current).toBe("blob:second"));
  expect(create).toHaveBeenCalledTimes(2);
  expect(revoke).toHaveBeenCalledWith("blob:first");
  view.unmount();
  expect(revoke).toHaveBeenCalledWith("blob:second");
});
