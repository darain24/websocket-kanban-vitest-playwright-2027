import { render, screen, fireEvent } from "@testing-library/react";
import { act } from "react";
import KanbanBoard from "../../components/KanbanBoard.jsx";

let mockSocket;

function createMockSocket() {
  const handlers = {};
  mockSocket = {
    on: (event, cb) => {
      handlers[event] = cb;
    },
    emit: vi.fn((event, payload) => {
      if (event === "sync:tasks" && handlers["sync:tasks"]) {
        handlers["sync:tasks"]([]);
      }
    }),
    disconnect: vi.fn(),
    _handlers: handlers,
  };
  // Simulate connection so Add Task button is enabled
  setTimeout(() => {
    if (handlers["connect"]) handlers["connect"]();
  }, 0);
  return mockSocket;
}

vi.mock("socket.io-client", () => ({
  io: vi.fn(() => createMockSocket()),
}));

function trigger(event, payload) {
  if (!mockSocket || !mockSocket._handlers[event]) return;
  act(() => {
    mockSocket._handlers[event](payload);
  });
}

describe("KanbanBoard unit tests", () => {
  test("renders Kanban board title", () => {
    render(<KanbanBoard />);
    expect(screen.getByText("Kanban Board")).toBeInTheDocument();
  });

  test("requests initial task sync on mount", () => {
    render(<KanbanBoard />);
    expect(mockSocket.emit).toHaveBeenCalledWith("sync:tasks");
  });

  test("displays tasks received from WebSocket", () => {
    render(<KanbanBoard />);

    const sampleTasks = [
      {
        id: "1",
        title: "Sample Task",
        description: "Test description",
        status: "todo",
        priority: "High",
        category: "Bug",
        attachments: [],
      },
    ];

    trigger("sync:tasks", sampleTasks);

    // At unit level, it's enough to assert that the task title
    // rendered from the WebSocket payload appears on the board.
    expect(screen.getByText("Sample Task")).toBeInTheDocument();
  });

  test("emits task:create when user adds a task", async () => {
    render(<KanbanBoard />);
    trigger("connect");

    const titleInput = screen.getByTestId("new-task-title");
    const descriptionInput = screen.getByTestId("new-task-description");
    const prioritySelect = screen.getByTestId("new-task-priority");
    const categorySelect = screen.getByTestId("new-task-category");

    fireEvent.change(titleInput, { target: { value: "New Task" } });
    fireEvent.change(descriptionInput, { target: { value: "New description" } });
    fireEvent.change(prioritySelect, { target: { value: "Low" } });
    fireEvent.change(categorySelect, { target: { value: "Enhancement" } });

    const form = titleInput.closest("form");
    fireEvent.submit(form);

    expect(mockSocket.emit).toHaveBeenCalledWith(
      "task:create",
      expect.objectContaining({
        title: "New Task",
        description: "New description",
        priority: "Low",
        category: "Enhancement",
      })
    );
  });

  test("supports file attachment selection for new tasks", () => {
    render(<KanbanBoard />);

    const fileInput = screen.getByTestId("new-task-file-input");
    const file = new File(["content"], "example.png", { type: "image/png" });

    fireEvent.change(fileInput, { target: { files: [file] } });

    const list = screen.getByTestId("new-task-attachments");
    expect(list).toHaveTextContent("example.png");
  });
});
