import { render, screen, fireEvent } from "@testing-library/react";
import { act } from "react";
import KanbanBoard from "../../components/KanbanBoard";

let serverTasks = [];

function createMockSocket() {
  const handlers = {};
  const socket = {
    on: (event, cb) => {
      handlers[event] = cb;
    },
    emit: (event, payload) => {
      if (event === "sync:tasks") {
        if (handlers["sync:tasks"]) {
          handlers["sync:tasks"](serverTasks);
        }
      }
      if (event === "task:create") {
        const id = String(serverTasks.length + 1);
        serverTasks.push({
          id,
          title: payload.title ?? "",
          description: payload.description ?? "",
          status: payload.status ?? "todo",
          priority: payload.priority ?? "Medium",
          category: payload.category ?? "Feature",
          attachments: payload.attachments ?? [],
        });
        if (handlers["sync:tasks"]) {
          handlers["sync:tasks"](serverTasks);
        }
      }
    },
    disconnect: vi.fn(),
    _handlers: handlers,
  };
  return socket;
}

vi.mock("socket.io-client", () => ({
  io: vi.fn(() => createMockSocket()),
}));

describe("WebSocket integration", () => {
  beforeEach(() => {
    serverTasks = [];
  });

  test.skip("WebSocket-driven create flow results in task rendering", async () => {
    render(<KanbanBoard />);

    const titleInput = screen.getByTestId("new-task-title");
    const descriptionInput = screen.getByTestId("new-task-description");

    fireEvent.change(titleInput, { target: { value: "Integrated Task" } });
    fireEvent.change(descriptionInput, {
      target: { value: "Created via WebSocket integration test" },
    });

    const form = titleInput.closest("form");

    await act(async () => {
      fireEvent.submit(form);
    });

    await screen.findByText("Integrated Task");
  });
});
