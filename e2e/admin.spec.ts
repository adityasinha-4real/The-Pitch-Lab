import { expect, test } from "@playwright/test";
import { ADMIN, login, newEmail, openTurf } from "./helpers";

test.describe("admin", () => {
  test("gate: players get a 404, signed-out visitors get sign-in", async ({ page }) => {
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/signin\?next=%2Fadmin/);
    await login(page, newEmail("not-admin"));
    const res = await page.goto("/admin");
    expect(res?.status()).toBe(404);
    await expect(page.getByRole("heading", { name: "Wide of the post." })).toBeVisible();
  });

  test("overview shows the occupancy heatmap; bookings table lists bookings", async ({ page }) => {
    await login(page, ADMIN, "/admin");
    await expect(page.getByRole("heading", { name: "Control room" })).toBeVisible();
    await expect(page.getByTestId("heatmap")).toBeVisible();
    await expect(page.getByTestId("heatmap").locator("tbody tr")).toHaveCount(7);

    await page.getByRole("link", { name: "Bookings", exact: true }).click();
    const table = page.getByTestId("admin-bookings");
    await expect(table.locator("tbody tr").first()).toBeVisible();
    await expect(table).toContainText("Kabir Mehta");
    await page.getByLabel("Status").selectOption("cancelled");
    await page.getByRole("button", { name: "Filter" }).click();
    await expect(page).toHaveURL(/status=cancelled/);
    await expect(table.locator("tbody tr").first()).toContainText("cancelled");
  });

  test("block slot: admin blocks an hour and players see it unavailable", async ({ page, browser }) => {
    await login(page, ADMIN, "/admin?tab=slots&turf=nutmeg-box");
    await page.getByRole("link", { name: /^\w{3} \d+$/ }).nth(5).click();
    const board = page.getByTestId("block-board");
    const target = board.locator('[data-state="available"]').first();
    const testId = (await target.getAttribute("data-testid"))!;
    const hour = testId.replace("admin-slot-", "");
    await target.getByRole("button", { name: /^Block/ }).click();
    await page.getByLabel("Reason").fill("Floodlight service");
    await page.getByTestId("block-confirm").click();
    await expect(page.getByTestId(testId)).toHaveAttribute("data-state", "blocked");
    await expect(page.getByTestId(testId)).toContainText("Floodlight service");

    const player = await browser.newPage();
    await openTurf(player, "nutmeg-box", 5);
    await expect(player.getByTestId(`slot-${hour}`)).toHaveAttribute("data-state", "blocked");
    await player.close();

    // And it can be lifted again.
    await page.getByTestId(testId).getByRole("button", { name: /^Unblock/ }).click();
    await expect(page.getByTestId(testId)).toHaveAttribute("data-state", "available");
  });

  test("pricing: edit a rule and the rate card follows", async ({ page }) => {
    await login(page, ADMIN, "/admin?tab=pricing");
    const section = page.getByTestId("pricing-Panenka Yard");
    const row = section.getByTestId("rule-row").filter({ has: page.locator('input[value="Weekday"]') });
    await row.getByTestId("rule-price").fill("1050");
    await row.getByTestId("rule-save").click();
    await expect(page.getByText("Saved “Weekday”.")).toBeVisible();

    await page.goto("/turfs/panenka-yard");
    const rate = page.getByRole("row").filter({ hasText: /^Weekday\s*Mon–Fri/ });
    await expect(rate).toContainText("₹1,050");

    // Invalid rules can't be saved.
    await page.goto("/admin?tab=pricing");
    const again = page.getByTestId("pricing-Panenka Yard").getByTestId("rule-row").first();
    await again.getByLabel("Ends (24:00 for midnight)").fill("05:00");
    await expect(again.getByRole("alert")).toContainText("End time must be after start time");
    await expect(again.getByTestId("rule-save")).toBeDisabled();
  });
});
