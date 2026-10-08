import { MantineProvider } from "@mantine/core";
import { render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { AppState } from "../domain/types";
import { DataTransferView } from "./DataTransferView";

const state: AppState = {
  tasks: [],
  categories: [],
  assignees: [],
  taskTypes: [],
  priorities: [],
  completions: [],
  postponements: []
};

const baseProps: ComponentProps<typeof DataTransferView> = {
  state,
  onPreviewImport: vi.fn(),
  onApplyImport: vi.fn(),
  tigrisStatus: { kind: "disconnected" } as const,
  onConfigureTigris: vi.fn(),
  onDisconnectTigris: vi.fn()
};

function renderView(props: Partial<typeof baseProps> = {}) {
  return render(
    <MantineProvider>
      <DataTransferView {...baseProps} {...props} />
    </MantineProvider>
  );
}

describe("DataTransferView", () => {
  it("submits trimmed Tigris credentials, masks the secret, and warns about local secrets", async () => {
    const user = userEvent.setup();
    const onConfigureTigris = vi.fn();
    renderView({ onConfigureTigris });

    const connectButton = screen.getByRole("button", { name: "Polacz z Tigris" });
    expect(connectButton).toBeDisabled();
    expect(screen.getByLabelText("Klucz obiektu Tigris")).toHaveValue("tasker.json");
    expect(screen.getByLabelText("Tajny klucz dostepu Tigris")).toHaveAttribute("type", "password");
    expect(screen.getByText(/tajny klucz.*tej przegladarce/i)).toBeInTheDocument();
    expect(screen.getByText(/dedykowanego.*minimalnymi uprawnieniami/i)).toBeInTheDocument();

    await user.type(screen.getByLabelText("Bucket Tigris"), " tasker ");
    await user.clear(screen.getByLabelText("Klucz obiektu Tigris"));
    await user.type(screen.getByLabelText("Klucz obiektu Tigris"), " shared/tasker.json ");
    await user.type(screen.getByLabelText("ID klucza dostepu Tigris"), " tid_key ");
    await user.type(screen.getByLabelText("Tajny klucz dostepu Tigris"), " tsec_secret ");
    await user.click(connectButton);

    expect(onConfigureTigris).toHaveBeenCalledWith({
      bucket: "tasker",
      objectKey: "shared/tasker.json",
      accessKeyId: "tid_key",
      secretAccessKey: "tsec_secret"
    });
  });

  it("shows configured Tigris credentials and disconnects Tigris", async () => {
    const user = userEvent.setup();
    const onDisconnectTigris = vi.fn();
    renderView({
      tigrisCredentials: { bucket: "tasker", objectKey: "shared/tasker.json", accessKeyId: "tid_key", secretAccessKey: "tsec_secret" },
      onDisconnectTigris
    });

    expect(screen.getByDisplayValue("tasker")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Rozlacz Tigris" }));

    expect(onDisconnectTigris).toHaveBeenCalledOnce();
  });

  it("does not expose JSONHosting controls", () => {
    renderView();
    expect(screen.queryByText(/JSONHosting/)).not.toBeInTheDocument();
  });
});
