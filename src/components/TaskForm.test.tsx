import { MantineProvider } from "@mantine/core";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { createEmptyState } from "../storage/taskerStorage";
import { TaskForm } from "./TaskForm";

describe("draft durability", () => {
  it("keeps typed text when another session changes state", async () => {
    const state = createEmptyState(),
      onSubmit = vi.fn();
    const props = {
      state,
      today: "2026-10-08",
      submitLabel: "Zapisz",
      onSubmit,
      onCancel: vi.fn(),
    };
    const view = render(
      <MantineProvider>
        <TaskForm {...props} />
      </MantineProvider>,
    );
    await userEvent
      .setup()
      .type(screen.getByLabelText("Nazwa zadania"), "Mój szkic");
    view.rerender(
      <MantineProvider>
        <TaskForm
          {...props}
          state={{
            ...state,
            categories: [{ id: "c", name: "Dom", color: "red" }],
          }}
        />
      </MantineProvider>,
    );
    expect(screen.getByLabelText("Nazwa zadania")).toHaveValue("Mój szkic");
  });
});
