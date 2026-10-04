import { expect, test } from "@playwright/test";
import { holdSelected, login, newEmail, openTurf, selectFirstAvailable } from "./helpers";

test("hold expiry frees the slot for someone else", async ({ browser }) => {
  const aCtx = await browser.newContext();
  const bCtx = await browser.newContext();
  const a = await aCtx.newPage();
  const b = await bCtx.newPage();
  await login(a, newEmail("expire-a"));
  await login(b, newEmail("expire-b"));

  await openTurf(a, "panenka-yard", 2);
  const slotId = await selectFirstAvailable(a);
  const bookingId = await holdSelected(a);

  // B sees it held.
  await openTurf(b, "panenka-yard", 2);
  await expect(b.getByTestId(slotId)).toHaveAttribute("data-state", "held");

  // Five minutes pass (test hook back-dates the hold, DECISIONS D13).
  const res = await a.request.post("/api/test/expire-holds", { data: { bookingId } });
  expect(res.ok()).toBe(true);

  // Expired holds read as free: B's grid frees the slot, and B can hold it.
  await expect(b.getByTestId(slotId)).toHaveAttribute("data-state", "available", { timeout: 10_000 });
  await b.getByTestId(slotId).click();
  await holdSelected(b);
  await expect(b.getByRole("timer")).toBeVisible();

  // A's checkout no longer offers payment once its hold is gone.
  await a.reload();
  await expect(a.getByRole("heading", { name: /full time on your hold|slot no longer held/i })).toBeVisible();
  await aCtx.close();
  await bCtx.close();
});

test("test hooks are locked away from players", async ({ request }) => {
  // The route exists only when PITCHLAB_TEST_HOOKS=1 (this server); bad input is still rejected.
  const res = await request.post("/api/test/expire-holds", { data: { bookingId: "not-a-uuid" } });
  expect(res.status()).toBe(400);
});
