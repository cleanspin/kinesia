import { expect, type Locator, type Page, test } from "@playwright/test";

async function box(locator: Locator) {
  await locator.scrollIntoViewIfNeeded();
  const rect = await locator.boundingBox();
  if (!rect) throw new Error("Element has no layout box");
  return rect;
}

async function rowUnderPointer(page: Page, x: number, y: number) {
  return page.evaluate(
    ([px, py]) => document.elementFromPoint(px, py)?.closest(".row")?.textContent ?? null,
    [x, y] as const,
  );
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
});

test("a sweep within a single frame hits every tile it crosses", async ({ page }) => {
  const tiles = page.locator("[data-tile]");
  const first = await box(tiles.nth(0));
  const last = await box(tiles.nth(15));
  const y = first.y + first.height / 2;

  await page.mouse.move(first.x - 20, y);
  // A single move: native hover only sees the endpoints.
  await page.mouse.move(last.x + last.width + 20, y);

  const stats = page.locator(".stats strong");
  await expect(stats.nth(0)).toHaveText("16");
  await expect(stats.nth(1)).toHaveText("16 (100%)");

  await expect(stats.nth(0)).toHaveText("0", { timeout: 5000 });
  await expect(stats.nth(1)).toHaveText("0 (0%)");
});

test("cards report the edge the pointer crossed and its speed", async ({ page }) => {
  const card = page.locator(".card").first();
  const rect = await box(card);

  await page.mouse.move(rect.x - 30, rect.y + 60);
  await page.mouse.move(rect.x + 40, rect.y + 60);
  await expect(card).toHaveAttribute("data-type", "enter");
  await expect(card).toHaveAttribute("data-edge", "left");
  await expect(card.locator("dd").nth(2)).not.toHaveText(/^(–|0 px\/s)$/);

  await page.mouse.move(rect.x + 40, rect.y + rect.height + 40);
  await expect(card).toHaveAttribute("data-type", "leave");
  await expect(card).toHaveAttribute("data-edge", "bottom");
});

test("the highlight follows rows scrolling under a still pointer", async ({ page }) => {
  const list = page.locator(".scroll-list");
  const rect = await box(list);
  const x = rect.x + 100;
  const y = rect.y + 70;
  const active = page.locator(".row[data-active]");

  await page.mouse.move(x, y);
  await expect(active).toHaveCount(1);
  const before = await active.textContent();

  await page.mouse.wheel(0, 240);
  await expect.poll(() => active.textContent()).not.toBe(before);
  await expect
    .poll(async () => (await rowUnderPointer(page, x, y)) === (await active.textContent()))
    .toBe(true);
  await expect(active).toHaveCount(1);
});

test("a fast hit breaks the crab wall where it crossed, and the crabs escape", async ({ page }) => {
  const rect = await box(page.locator(".crab-box"));
  const y = rect.y + 60;

  await page.mouse.move(rect.x - 80, y);
  await page.mouse.move(rect.x + 120, y);

  const leftWall = page.locator('.wall[data-edge="left"]');
  await expect(leftWall).toHaveCount(2);
  const [above, below] = await leftWall.evaluateAll((lines) =>
    lines.map((line) => [Number(line.getAttribute("y1")), Number(line.getAttribute("y2"))]),
  );
  expect(above?.[1]).toBeLessThan(60);
  expect(below?.[0]).toBeGreaterThan(60);

  await expect(page.locator(".gallery-meta")).not.toHaveText("0/6 escaped", { timeout: 8000 });
});
