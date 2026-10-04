import { expect, type Browser, type Page } from "@playwright/test";

let counter = 0;
/** A fresh player email per call so tests don't share holds or bookings. */
export const newEmail = (tag: string) => `${tag}-${Date.now().toString(36)}-${counter++}@e2e.test`;

export const ADMIN = "admin@pitchlab.test";

/** Sign in through the real magic-link flow (local adapter shows the link on screen). */
export async function login(page: Page, email: string, next = "/") {
  await page.goto(`/signin?next=${encodeURIComponent(next)}`);
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Email me a magic link" }).click();
  await expect(page.getByText("Check your inbox")).toBeVisible();
  await page.getByTestId("local-magic-link").click();
  await page.waitForURL((u) => !u.pathname.startsWith("/signin") && !u.pathname.startsWith("/auth"));
}

export async function newPlayer(browser: Browser, tag: string, next = "/") {
  const context = await browser.newContext({ viewport: { width: 1280, height: 860 } });
  const page = await context.newPage();
  const email = newEmail(tag);
  await login(page, email, next);
  return { context, page, email };
}

/** Open a turf on the nth day of the strip (0 = today) and wait for the grid. */
export async function openTurf(page: Page, slug: string, dayIndex: number) {
  await page.goto(`/turfs/${slug}`);
  await page.getByTestId("date-strip").getByRole("radio").nth(dayIndex).click();
  await expect(page.getByTestId("slot-grid")).toBeVisible();
}

/** Select the first available slot; returns its hour test id. */
export async function selectFirstAvailable(page: Page) {
  const slot = page.getByTestId("slot-grid").locator('[data-state="available"]').first();
  await expect(slot).toBeVisible();
  const testId = (await slot.getAttribute("data-testid"))!;
  await slot.click();
  await expect(slot).toHaveAttribute("aria-checked", "true");
  return testId;
}

/** Hold the selected slot and land on checkout. Returns the booking id. */
export async function holdSelected(page: Page) {
  await page.getByTestId("hold-button").filter({ visible: true }).click();
  await page.waitForURL(/\/checkout\/[0-9a-f-]{36}$/);
  return page.url().split("/").pop()!;
}

/** Pay with the mock gateway and wait for the webhook-driven confirmation. */
export async function payWithMock(page: Page) {
  await page.getByTestId("pay-button").click();
  const sheet = page.getByTestId("mock-checkout");
  await expect(sheet).toBeVisible();
  await sheet.getByTestId("mock-pay").click();
  await expect(page.getByTestId("confirmed-heading")).toBeVisible({ timeout: 20_000 });
}

export async function bookAndPay(page: Page, slug: string, dayIndex: number) {
  await openTurf(page, slug, dayIndex);
  const slotId = await selectFirstAvailable(page);
  const bookingId = await holdSelected(page);
  await payWithMock(page);
  return { bookingId, slotId };
}
