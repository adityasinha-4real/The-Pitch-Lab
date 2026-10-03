import { expect, test } from "@playwright/test";
import { holdSelected, login, newEmail, openTurf, selectFirstAvailable } from "./helpers";

test("browse→hold→pay(mock)→confirmed", async ({ page }) => {
  await login(page, newEmail("booker"));

  // Browse: home → turf list → turf detail.
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /book the pitch/i })).toBeVisible();
  await page.getByRole("link", { name: "Find a slot" }).click();
  await expect(page).toHaveURL(/\/turfs$/);
  const card = page.getByTestId("turf-card-nutmeg-box");
  await expect(card).toContainText("The Nutmeg Box");
  await expect(card).toContainText("₹");
  await card.click();
  await expect(page.getByRole("heading", { level: 1, name: "The Nutmeg Box" })).toBeVisible();

  // Slot grid: 7-day strip, hourly slots, prices from the rules.
  await expect(page.getByTestId("date-strip").getByRole("radio")).toHaveCount(7);
  await openTurf(page, "nutmeg-box", 2);
  const slots = page.getByTestId("slot-grid").getByRole("radio");
  await expect(slots).toHaveCount(18); // 6 AM – midnight
  await expect(page.getByTestId("slot-grid").locator('[data-state="available"]').first()).toContainText(/₹[\d,]+/);

  // Hold.
  const slotId = await selectFirstAvailable(page);
  const price = (await page.getByTestId(slotId).innerText()).match(/₹[\d,]+/)![0];
  await holdSelected(page);
  await expect(page.getByRole("heading", { name: "Beat the clock" })).toBeVisible();
  await expect(page.getByTestId("checkout-total")).toHaveText(price);

  // Pay with the mock gateway; the webhook confirms.
  await page.getByTestId("pay-button").click();
  const sheet = page.getByTestId("mock-checkout");
  await expect(sheet).toContainText("Test mode");
  await sheet.getByTestId("mock-pay").click();
  await expect(page.getByTestId("confirmed-heading")).toHaveText("It's on.", { timeout: 20_000 });
  await expect(page.getByTestId("celebration")).toBeAttached();

  // My bookings lists it as confirmed.
  await page.goto("/bookings");
  await expect(page.getByTestId("booking-row").filter({ hasText: "The Nutmeg Box" })).toContainText("Confirmed");
});

test("countdown: scoreboard hold timer with aria-live announcements", async ({ page }) => {
  await login(page, newEmail("timer"));
  await openTurf(page, "nutmeg-box", 3);
  await selectFirstAvailable(page);
  await holdSelected(page);
  const timer = page.getByRole("timer");
  await expect(timer).toHaveAttribute("aria-label", /Hold time remaining: [45] minutes \d+ seconds/);
  await expect(page.getByTestId("hold-announcer")).toHaveAttribute("aria-live", "polite");
  const first = await timer.getAttribute("aria-label");
  await page.waitForTimeout(2_200);
  expect(await timer.getAttribute("aria-label")).not.toBe(first);
});

test("declined payment keeps the hold", async ({ page }) => {
  await login(page, newEmail("declined"));
  await openTurf(page, "rabona-ridge", 2);
  await selectFirstAvailable(page);
  await holdSelected(page);
  await page.getByTestId("pay-button").click();
  await page.getByRole("button", { name: "Simulate a declined payment" }).click();
  await expect(page.getByText("Payment declined")).toBeVisible();
  await expect(page.getByTestId("pay-button")).toBeEnabled();
  await expect(page.getByRole("timer")).toBeVisible();
});

test("a slot someone else just held is taken out of your hands", async ({ browser }) => {
  const a = await browser.newContext();
  const b = await browser.newContext();
  const pa = await a.newPage();
  const pb = await b.newPage();
  await login(pa, newEmail("first"));
  await login(pb, newEmail("second"));
  await openTurf(pa, "rabona-ridge", 6);
  await openTurf(pb, "rabona-ridge", 6);
  const slotId = await selectFirstAvailable(pa);
  await pb.getByTestId(slotId).click();
  await expect(pb.getByTestId(slotId)).toHaveAttribute("aria-checked", "true");

  await holdSelected(pa);

  // B's grid updates live: the slot turns held and B's selection is withdrawn.
  await expect(pb.getByTestId(slotId)).toHaveAttribute("data-state", "held", { timeout: 10_000 });
  await expect(pb.getByTestId(slotId)).toHaveAttribute("aria-checked", "false");
  await expect(pb.getByTestId("hold-button").filter({ visible: true })).toHaveCount(0);
  // Trying to pick it again (keyboard, since it is aria-disabled) does nothing.
  await pb.getByTestId(slotId).focus();
  await pb.keyboard.press("Enter");
  await expect(pb.getByTestId(slotId)).toHaveAttribute("aria-checked", "false");
  await a.close();
  await b.close();
});
