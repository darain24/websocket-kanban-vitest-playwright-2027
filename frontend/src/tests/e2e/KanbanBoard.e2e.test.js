import { test, expect } from "@playwright/test";

test("User can add a task and see it on the board", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByText("Real-time Kanban Board")).toBeVisible();

  await page.getByTestId("new-task-title").fill("Playwright Task");
  await page
    .getByTestId("new-task-description")
    .fill("Created via Playwright");

  await page.getByTestId("create-task-button").click();

  await expect(page.getByText("Playwright Task")).toBeVisible();
});

test("User can drag and drop a task between columns", async ({ page }) => {
  await page.goto("/");

  await page.getByTestId("new-task-title").fill("Drag Me");
  await page.getByTestId("create-task-button").click();
  await expect(page.getByText("Drag Me")).toBeVisible();

  const task = page.getByText("Drag Me").first();
  const doneColumn = page.getByTestId("column-done");

  // Simulate drag-and-drop with the browser's actions API
  const taskBox = await task.boundingBox();
  const doneBox = await doneColumn.boundingBox();

  if (taskBox && doneBox) {
    await page.mouse.move(
      taskBox.x + taskBox.width / 2,
      taskBox.y + taskBox.height / 2
    );
    await page.mouse.down();
    await page.mouse.move(doneBox.x + doneBox.width / 2, doneBox.y + 10);
    await page.mouse.up();
  }

  await expect(doneColumn.getByText("Drag Me")).toBeVisible();
});

test("User can select priority and category using dropdowns", async ({ page }) => {
  await page.goto("/");

  await page.getByTestId("new-task-title").fill("Configured Task");
  await page.getByTestId("new-task-priority").selectOption("High");
  await page.getByTestId("new-task-category").selectOption("Bug");
  await page.getByTestId("create-task-button").click();

  const card = page.getByText("Configured Task").first();
  await expect(card).toBeVisible();

  await expect(
    card.locator("xpath=..").getByText(/Priority:\s*High/)
  ).toBeVisible();
  await expect(
    card.locator("xpath=..").getByText(/Category:\s*Bug/)
  ).toBeVisible();
});

test("User can upload a file and see it listed", async ({ page }) => {
  await page.goto("/");

  const filePath = "playwright.config.js";

  await page
    .getByTestId("new-task-file-input")
    .setInputFiles(filePath);

  await page.getByTestId("new-task-title").fill("With Attachment");
  await page.getByTestId("create-task-button").click();

  const taskCard = page.getByText("With Attachment").first();
  await expect(taskCard).toBeVisible();

  // Attachment should be visible in the card's attachments list
  await expect(
    page.getByText("playwright.config.js")
  ).toBeVisible();
});

test("Graph updates as tasks move between columns", async ({ page }) => {
  await page.goto("/");

  await page.getByTestId("new-task-title").fill("Graph Task");
  await page.getByTestId("create-task-button").click();

  await expect(page.getByText("Completion:")).toBeVisible();

  const todoColumn = page.getByTestId("column-todo");
  const doneColumn = page.getByTestId("column-done");
  const task = todoColumn.getByText("Graph Task").first();

  const taskBox = await task.boundingBox();
  const doneBox = await doneColumn.boundingBox();

  if (taskBox && doneBox) {
    await page.mouse.move(
      taskBox.x + taskBox.width / 2,
      taskBox.y + taskBox.height / 2
    );
    await page.mouse.down();
    await page.mouse.move(doneBox.x + doneBox.width / 2, doneBox.y + 10);
    await page.mouse.up();
  }

  await expect(doneColumn.getByText("Graph Task")).toBeVisible();
  await expect(
    page.getByTestId("completion-percentage")
  ).toContainText("%");
});

test("Real-time updates are visible across two browser sessions", async ({
  browser,
}) => {
  const context1 = await browser.newContext();
  const context2 = await browser.newContext();

  const page1 = await context1.newPage();
  const page2 = await context2.newPage();

  await page1.goto("/");
  await page2.goto("/");

  await expect(page1.getByText("Real-time Kanban Board")).toBeVisible();
  await expect(page2.getByText("Real-time Kanban Board")).toBeVisible();

  await page1.getByTestId("new-task-title").fill("Realtime Task");
  await page1.getByTestId("create-task-button").click();

  await expect(page2.getByText("Realtime Task")).toBeVisible();

  await context1.close();
  await context2.close();
});
