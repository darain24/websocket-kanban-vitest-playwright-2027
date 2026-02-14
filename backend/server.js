const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);

// Simple in-memory task store
/**
 * Task shape:
 * {
 *   id: string,
 *   title: string,
 *   description: string,
 *   status: "todo" | "in-progress" | "done",
 *   priority: "Low" | "Medium" | "High",
 *   category: "Bug" | "Feature" | "Enhancement",
 *   attachments: Array<{ id: string, name: string, type: string, url: string | null }>
 * }
 */
let tasks = [];
let nextId = 1;

const io = new Server(server, {
  cors: { origin: "*" },
});

const SYNC_EVENT = "sync:tasks";

function broadcastTasks() {
  io.emit(SYNC_EVENT, tasks);
}

io.on("connection", (socket) => {
  console.log("A user connected", socket.id);

  // Send current tasks to newly connected client
  socket.emit(SYNC_EVENT, tasks);

  socket.on("task:create", (payload) => {
    const id = String(nextId++);
    const newTask = {
      id,
      title: payload.title ?? "",
      description: payload.description ?? "",
      status: payload.status ?? "todo",
      priority: payload.priority ?? "Medium",
      category: payload.category ?? "Feature",
      attachments: Array.isArray(payload.attachments)
        ? payload.attachments
        : [],
    };
    tasks.push(newTask);
    broadcastTasks();
  });

  socket.on("task:update", (payload) => {
    if (!payload || !payload.id) return;
    const index = tasks.findIndex((t) => t.id === payload.id);
    if (index === -1) return;
    tasks[index] = {
      ...tasks[index],
      ...payload,
      id: tasks[index].id, // never allow id change
    };
    broadcastTasks();
  });

  socket.on("task:move", ({ id, status }) => {
    if (!id || !status) return;
    const task = tasks.find((t) => t.id === id);
    if (!task) return;
    task.status = status;
    broadcastTasks();
  });

  socket.on("task:delete", ({ id }) => {
    if (!id) return;
    const originalLength = tasks.length;
    tasks = tasks.filter((t) => t.id !== id);
    if (tasks.length !== originalLength) {
      broadcastTasks();
    }
  });

  socket.on(SYNC_EVENT, () => {
    // Client can request a fresh sync explicitly
    socket.emit(SYNC_EVENT, tasks);
  });

  socket.on("disconnect", () => {
    console.log("User disconnected", socket.id);
  });
});

const PORT = process.env.PORT || 5001;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
