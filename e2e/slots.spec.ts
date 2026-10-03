import { expect, test } from "@playwright/test";
import { holdSelected, login, newEmail, openTurf, selectFirstAvailable } from "./helpers";

test.describe("slot grid", () => {
  test("renders available, booked, blocked and past states distinctly", async ({ page }) => {
    // Seed: tomorrow 7 PM and 8 PM at The Nutmeg Box are booked; day +4 7 AM is blocked.
    await openTurf(page, "nutmeg-box", 1);
    await expect(page.getByTestId("slot-19")).toHaveAttribute("data-state", "booked");
    await expect(page.getByTestId("slot-19")).toHaveAttribute("aria-disabled", "true");
    await expect(page.getByTestId("slot-19")).toContainText("Booked");
    await expect(page.getByTestId("slot-10")).toHaveAttribute("data-state", "available");

    await openTurf(page, "nutmeg-box", 4);
    await expect(page.getByTestId("slot-7")).toHaveAttribute("data-state", "blocked");
    await expect(page.getByTestId("slot-7")).toContainText("Unavailable");

    // Today: every slot that has started is "past", every later one isn't.
    await openTurf(page, "nutmeg-box", 0);
    const cells = page.getByTestId("slot-grid").getByRole("radio");
    const states = await cells.evaluateAll((els) =>
      els.map((e) => ({ start: Date.parse(e.getAttribute("data-start")!), state: e.getAttribute("data-state") })),
    );
    const now = Date.now();
    for (const s of states) expect(s.state === "past").toBe(s.start <= now);
  });

  test("live: another player's hold appears without a reload", async ({ browser }) => {
    const watcherCtx = await browser.newContext();
    const holderCtx = await browser.newContext();
    const watcher = await watcherCtx.newPage();
    const holder = await holderCtx.newPage();
    await login(holder, newEmail("live-holder"));

    await openTurf(watcher, "panenka-yard", 3);
    await openTurf(holder, "panenka-yard", 3);
    const slotId = await selectFirstAvailable(holder);
    await expect(watcher.getByTestId(slotId)).toHaveAttribute("data-state", "available");
    await holdSelected(holder);

    // No reload on the watcher's page: the realtime ping refreshes the grid.
    await expect(watcher.getByTestId(slotId)).toHaveAttribute("data-state", "held", { timeout: 10_000 });
    await expect(watcher.getByTestId(slotId)).toContainText("On hold");
    await watcherCtx.close();
    await holderCtx.close();
  });

  test("keyboard: arrow keys move through the grid, Enter selects", async ({ page }) => {
    await login(page, newEmail("keys"));
    await openTurf(page, "rabona-ridge", 5);
    const grid = page.getByTestId("slot-grid");
    const first = grid.getByRole("radio").first();
    await first.focus();
    const id = () => page.evaluate(() => document.activeElement?.getAttribute("data-testid"));
    expect(await id()).toBe("slot-6");

    await page.keyboard.press("ArrowRight");
    expect(await id()).toBe("slot-7");
    await page.keyboard.press("ArrowLeft");
    expect(await id()).toBe("slot-6");

    const cols = await grid.evaluate((g) => getComputedStyle(g).gridTemplateColumns.split(" ").length);
    await page.keyboard.press("ArrowDown");
    expect(await id()).toBe(`slot-${6 + cols}`);
    await page.keyboard.press("End");
    expect(await id()).toBe("slot-23");
    await page.keyboard.press("Home");
    expect(await id()).toBe("slot-6");

    // Only the focused slot is in the tab order (roving tabindex).
    await expect(grid.locator('[tabindex="0"]')).toHaveCount(1);

    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("slot-7")).toHaveAttribute("aria-checked", "true");

    // Date strip is arrow-navigable too.
    await page.getByTestId("date-strip").getByRole("radio", { checked: true }).focus();
    await page.keyboard.press("ArrowRight");
    await expect(page.getByTestId("date-strip").getByRole("radio").nth(6)).toHaveAttribute("aria-checked", "true");
  });
});
