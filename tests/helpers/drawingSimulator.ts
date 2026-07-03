import { Page } from "@playwright/test";

export async function drawLineOnCanvas(page: Page, canvasSelector = "canvas") {
  const canvas = page.locator(canvasSelector);
  await canvas.waitFor({ state: "visible" });
  const box = await canvas.boundingBox();
  if (!box) throw new Error("Canvas bounding box not found");

  const startX = box.x + box.width / 4;
  const startY = box.y + box.height / 4;
  const endX = box.x + box.width / 2;
  const endY = box.y + box.height / 2;

  // Move to start, click down, drag to end, release mouse
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(endX, endY, { steps: 5 });
  await page.mouse.up();
}

export async function clearCanvas(page: Page) {
  await page.click('button:has-text("Clear Canvas")');
}
