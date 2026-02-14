import React, { useEffect, useMemo, useState } from "react";
import { io } from "socket.io-client";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import "./KanbanBoard.css";

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || "http://localhost:5001";

const STATUSES = [
  { id: "todo", label: "To Do" },
  { id: "in-progress", label: "In Progress" },
  { id: "done", label: "Done" },
];

const PRIORITIES = ["Low", "Medium", "High"];
const CATEGORIES = ["Bug", "Feature", "Enhancement"];

function createEmptyTask() {
  return {
    title: "",
    description: "",
    status: "todo",
    priority: "Medium",
    category: "Feature",
    attachments: [],
  };
}

function KanbanBoard() {
  const [socket, setSocket] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [newTask, setNewTask] = useState(createEmptyTask());
  const [titleError, setTitleError] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [draggingTaskId, setDraggingTaskId] = useState(null);
  const [dragOverColumnId, setDragOverColumnId] = useState(null);

  // Connect to WebSocket server
  useEffect(() => {
    const s = io(SOCKET_URL, { transports: ["websocket"] });
    setSocket(s);

    s.on("connect", () => setConnected(true));
    s.on("disconnect", () => setConnected(false));
    s.on("connect_error", () => {
      setLoading(false);
      setConnected(false);
    });

    s.on("sync:tasks", (serverTasks) => {
      setTasks(serverTasks || []);
      setLoading(false);
    });

    s.emit("sync:tasks");

    // If no response after 3s, stop loading so UI is usable
    const timeout = setTimeout(() => setLoading(false), 3000);
    return () => {
      clearTimeout(timeout);
      s.disconnect();
    };
  }, []);

  const handleInputChange = (field, value) => {
    setNewTask((prev) => ({ ...prev, [field]: value }));
  };

  const handleFileChange = (event) => {
    const files = Array.from(event.target.files || []);
    const attachments = files.map((file, index) => ({
      id: `${file.name}-${index}-${Date.now()}`,
      name: file.name,
      type: file.type,
      // For simplicity we just simulate a URL string here
      url: null,
      isImage: file.type.startsWith("image/"),
    }));
    setNewTask((prev) => ({ ...prev, attachments }));
  };

  const handleCreateTask = (event) => {
    event.preventDefault();
    setTitleError(false);
    if (!newTask.title.trim()) {
      setTitleError(true);
      return;
    }
    if (!socket || !connected) return;

    socket.emit("task:create", {
      ...newTask,
    });
    setNewTask(createEmptyTask());
  };

  const handleDeleteTask = (id) => {
    if (!socket) return;
    socket.emit("task:delete", { id });
  };

  const handleStartEdit = (taskId) => {
    setEditingTaskId(taskId);
  };

  const handleUpdateTaskField = (taskId, field, value) => {
    setTasks((prev) =>
      prev.map((task) =>
        task.id === taskId ? { ...task, [field]: value } : task
      )
    );
  };

  const handleSaveEdit = (taskId) => {
    if (!socket) return;
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;
    socket.emit("task:update", task);
    setEditingTaskId(null);
  };

  const handleCancelEdit = () => {
    // Request fresh sync from server to discard local edits
    if (socket) {
      socket.emit("sync:tasks");
    }
    setEditingTaskId(null);
  };

  const handleDragStart = (event, taskId) => {
    event.dataTransfer.setData("text/plain", taskId);
    setDraggingTaskId(taskId);
  };

  const handleDragOver = (event, statusId) => {
    event.preventDefault();
    setDragOverColumnId(statusId);
  };

  const handleDragLeave = () => {
    setDragOverColumnId(null);
  };

  const handleDrop = (event, statusId) => {
    event.preventDefault();
    setDragOverColumnId(null);
    const taskId = event.dataTransfer.getData("text/plain") || draggingTaskId;
    setDraggingTaskId(null);
    if (!taskId || !socket) return;
    socket.emit("task:move", { id: taskId, status: statusId });
  };

  const columnTasks = useMemo(() => {
    const map = {};
    STATUSES.forEach((s) => {
      map[s.id] = [];
    });
    tasks.forEach((task) => {
      const key = STATUSES.some((s) => s.id === task.status)
        ? task.status
        : "todo";
      map[key].push(task);
    });
    return map;
  }, [tasks]);

  const chartData = useMemo(() => {
    const total = tasks.length || 1;
    const counts = STATUSES.map((s) => ({
      status: s.label,
      count: tasks.filter((t) => t.status === s.id).length,
    }));
    const doneCount = tasks.filter((t) => t.status === "done").length;
    const completion = Math.round((doneCount / total) * 100);
    return {
      counts,
      completion,
    };
  }, [tasks]);

  return (
    <div className="kanban-board" data-testid="kanban-board">
      <h2 className="board-title">Kanban Board</h2>

      {!connected && !loading && (
        <div role="alert" className="kanban-alert kanban-alert--error">
          Not connected to server. Start the backend: run <code>npm run dev</code> in the <code>backend</code> folder (port 5001).
        </div>
      )}
      {loading && (
        <p className="kanban-loading" data-testid="loading-indicator">
          Loading tasks...
        </p>
      )}

      <section className="kanban-progress" aria-label="Task progress">
        <h3>Task Progress</h3>
        <p className="kanban-completion" data-testid="completion-percentage">
          <strong>Completion: {chartData.completion}%</strong> done
        </p>
        <div className="kanban-chart-wrap" aria-label="Task progress chart">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={chartData.counts} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="status" tick={{ fill: "#64748b", fontSize: 12 }} />
              <YAxis allowDecimals={false} tick={{ fill: "#64748b", fontSize: 12 }} />
              <Tooltip
                contentStyle={{
                  borderRadius: 8,
                  border: "1px solid #e2e8f0",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                }}
              />
              <Legend />
              <Bar dataKey="count" fill="#6366f1" name="Tasks" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section aria-label="Create new task" className="new-task-form">
        <h3>Create Task</h3>
        <form onSubmit={handleCreateTask}>
          <div className="form-grid">
            <div className="form-group form-full">
              <label htmlFor="new-task-title">Title</label>
              <input
                id="new-task-title"
                data-testid="new-task-title"
                type="text"
                value={newTask.title}
                onChange={(e) => {
                  handleInputChange("title", e.target.value);
                  setTitleError(false);
                }}
                required
                aria-invalid={titleError}
                aria-describedby={titleError ? "title-error" : undefined}
                placeholder="Task title"
              />
              {titleError && (
                <p id="title-error" role="alert" className="form-error">
                  Please enter a title for the task.
                </p>
              )}
            </div>
            <div className="form-group form-full">
              <label htmlFor="new-task-description">Description</label>
              <textarea
                id="new-task-description"
                data-testid="new-task-description"
                value={newTask.description}
                onChange={(e) =>
                  handleInputChange("description", e.target.value)
                }
                placeholder="Optional description"
              />
            </div>
            <div className="form-group">
              <label htmlFor="new-task-priority">Priority</label>
              <select
                id="new-task-priority"
                data-testid="new-task-priority"
                value={newTask.priority}
                onChange={(e) => handleInputChange("priority", e.target.value)}
              >
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="new-task-category">Category</label>
              <select
                id="new-task-category"
                data-testid="new-task-category"
                value={newTask.category}
                onChange={(e) => handleInputChange("category", e.target.value)}
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group form-full">
              <label htmlFor="new-task-file-input">Attachments</label>
              <input
                id="new-task-file-input"
                data-testid="new-task-file-input"
                type="file"
                multiple
                onChange={handleFileChange}
              />
              <span className="file-hint">Images, PDFs, etc.</span>
              {newTask.attachments.length > 0 && (
                <ul className="attachment-list" data-testid="new-task-attachments">
                  {newTask.attachments.map((file) => (
                    <li key={file.id}>{file.name}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
          <button
            type="submit"
            className="btn btn-primary"
            data-testid="create-task-button"
            disabled={!connected}
          >
            Add Task
          </button>
        </form>
      </section>

      <section className="kanban-columns" aria-label="Kanban columns">
        {STATUSES.map((status) => (
          <div
            key={status.id}
            className={`kanban-column ${dragOverColumnId === status.id ? "drag-over" : ""}`}
            onDragOver={(e) => handleDragOver(e, status.id)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, status.id)}
            data-testid={`column-${status.id}`}
          >
            <div className="column-header">
              <h3>{status.label}</h3>
            </div>
            <div className="column-cards">
              {columnTasks[status.id].length === 0 ? (
                <div className="column-empty">No tasks yet.</div>
              ) : (
              columnTasks[status.id].map((task) => {
                const isEditing = task.id === editingTaskId;
                const priorityClass =
                  task.priority === "High"
                    ? "badge-priority-high"
                    : task.priority === "Medium"
                      ? "badge-priority-medium"
                      : "badge-priority-low";
                const categoryClass =
                  task.category === "Bug"
                    ? "badge-category-bug"
                    : task.category === "Feature"
                      ? "badge-category-feature"
                      : "badge-category-enhancement";
                return (
                  <article
                    key={task.id}
                    className={`kanban-task ${draggingTaskId === task.id ? "dragging" : ""} ${isEditing ? "is-editing" : ""}`}
                    draggable={!isEditing}
                    onDragStart={(e) => handleDragStart(e, task.id)}
                    data-testid={`task-${task.id}`}
                  >
                    {isEditing ? (
                      <div className="task-edit-form">
                        <div className="form-group">
                          <label>Title</label>
                          <input
                            aria-label="Edit title"
                            value={task.title}
                            onChange={(e) =>
                              handleUpdateTaskField(
                                task.id,
                                "title",
                                e.target.value
                              )
                            }
                          />
                        </div>
                        <div className="form-group">
                          <label>Description</label>
                          <textarea
                            aria-label="Edit description"
                            value={task.description}
                            onChange={(e) =>
                              handleUpdateTaskField(
                                task.id,
                                "description",
                                e.target.value
                              )
                            }
                          />
                        </div>
                        <div className="form-group">
                          <label>Priority</label>
                          <select
                            value={task.priority}
                            onChange={(e) =>
                              handleUpdateTaskField(
                                task.id,
                                "priority",
                                e.target.value
                              )
                            }
                          >
                            {PRIORITIES.map((p) => (
                              <option key={p} value={p}>
                                {p}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="form-group">
                          <label>Category</label>
                          <select
                            value={task.category}
                            onChange={(e) =>
                              handleUpdateTaskField(
                                task.id,
                                "category",
                                e.target.value
                              )
                            }
                          >
                            {CATEGORIES.map((c) => (
                              <option key={c} value={c}>
                                {c}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="form-actions">
                          <button
                            type="button"
                            className="btn btn-primary"
                            onClick={() => handleSaveEdit(task.id)}
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            className="btn btn-ghost"
                            onClick={handleCancelEdit}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <h4 className="task-title">{task.title}</h4>
                        {task.description && (
                          <p className="task-description">{task.description}</p>
                        )}
                        <div className="task-meta">
                          <span
                            className={`badge ${priorityClass}`}
                          >
                            {task.priority}
                          </span>
                          <span
                            className={`badge ${categoryClass}`}
                          >
                            {task.category}
                          </span>
                        </div>
                        {Array.isArray(task.attachments) &&
                          task.attachments.length > 0 && (
                            <div className="task-attachments">
                              <strong>Attachments</strong>
                              <ul>
                                {task.attachments.map((file) => (
                                  <li key={file.id}>{file.name}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        <div className="task-actions">
                          <button
                            type="button"
                            className="btn btn-ghost"
                            onClick={() => handleStartEdit(task.id)}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="btn btn-danger"
                            onClick={() => handleDeleteTask(task.id)}
                          >
                            Delete
                          </button>
                        </div>
                      </>
                    )}
                  </article>
                );
              })
              )}
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}

export default KanbanBoard;
