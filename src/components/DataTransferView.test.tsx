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
  status: { kind: "disconnected" } as const,
  onConfigureJsonHosting: vi.fn(),
  onCreateJsonHostingDocument: vi.fn(),
  onDisconnectJsonHosting: vi.fn()
};

function renderView(props: Partial<typeof baseProps> = {}) {
  return render(
    <MantineProvider>
      <DataTransferView {...baseProps} {...props} />
    </MantineProvider>
  );
}

describe("DataTransferView", () => {
  it("submits trimmed JSONHosting credentials", async () => {
    const user = userEvent.setup();
    const onConfigureJsonHosting = vi.fn();
    renderView({ onConfigureJsonHosting });

    const connectButton = screen.getByRole("button", { name: "Polacz z JSONHosting" });
    expect(connectButton).toBeDisabled();

    await user.type(screen.getByLabelText("ID dokumentu JSONHosting"), " abc123 ");
    await user.type(screen.getByLabelText("Klucz edycji JSONHosting"), " secret ");
    await user.click(connectButton);

    expect(onConfigureJsonHosting).toHaveBeenCalledWith({ documentId: "abc123", editKey: "secret" });
  });

  it("shows the public-data warning and Polish sync status", () => {
    renderView({ status: { kind: "synced", at: "2026-07-12T10:00:00.000Z" } });

    expect(screen.getByText(/publicznie dostepne/i)).toBeInTheDocument();
    expect(screen.getByText(/zsynchronizowano/i)).toBeInTheDocument();
  });

  it("shows configured credentials and disconnects JSONHosting", async () => {
    const user = userEvent.setup();
    const onDisconnectJsonHosting = vi.fn();
    renderView({ credentials: { documentId: "abc123", editKey: "secret" }, onDisconnectJsonHosting });

    expect(screen.getByDisplayValue("abc123")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Rozlacz JSONHosting" }));

    expect(onDisconnectJsonHosting).toHaveBeenCalledOnce();
  });

  it("creates a public JSONHosting document from the current data and prevents duplicate requests", async () => {
    const user = userEvent.setup();
    const onCreateJsonHostingDocument = vi.fn(() => new Promise<void>(() => undefined));
    renderView({ onCreateJsonHostingDocument });

    const createButton = screen.getByRole("button", { name: "Utworz nowy dokument JSONHosting z biezacych danych" });
    expect(screen.getByText(/utworz nowy publiczny dokument JSONHosting z biezacych danych/i)).toBeInTheDocument();
    expect(screen.getByText(/zastapi aktualne polaczenie/i)).toBeInTheDocument();
    expect(screen.getByText(/dokument.*publiczn/i)).toBeInTheDocument();

    await user.click(createButton);

    expect(onCreateJsonHostingDocument).toHaveBeenCalledOnce();
    expect(createButton).toBeDisabled();
  });
});
