import { expect, test } from "@playwright/test";
import { bookAndPay, login, newEmail } from "./helpers";

test("split-pay: share link, per-head amount, live progress", async ({ browser }) => {
  const orgCtx = await browser.newContext();
  const friendCtx = await browser.newContext();
  const organiser = await orgCtx.newPage();
  const friend = await friendCtx.newPage();
  await login(organiser, newEmail("organiser"));
  await bookAndPay(organiser, "rabona-ridge", 3);

  // Split three ways.
  await organiser.getByTestId("split-open").click();
  await organiser.getByRole("button", { name: "Fewer players" }).click();
  await organiser.getByRole("button", { name: "Fewer players" }).click();
  await expect(organiser.locator("#split-seats")).toHaveText("3");
  await organiser.getByTestId("split-create").click();
  const link = await organiser.getByTestId("split-link").inputValue();
  expect(link).toMatch(/\/split\/[a-z0-9]{32}$/);
  const path = new URL(link).pathname;

  // Organiser watches the split page.
  await organiser.goto(path);
  const progress = organiser.getByTestId("split-progress");
  await expect(progress).toHaveAttribute("data-paid-seats", "1");
  await expect(organiser.getByText("1 of 3 shares paid")).toBeVisible();

  // A friend opens the link (not signed in) and pays seat 2.
  await friend.goto(path);
  const seat2 = friend.getByTestId("seat-2");
  const perHead = (await seat2.innerText()).match(/₹[\d,]+/)![0];
  await friend.getByTestId("pay-seat-2").click();
  await friend.getByLabel("Your name").fill("Aarav");
  await friend.getByTestId("share-continue").click();
  const sheet = friend.getByTestId("mock-checkout");
  await expect(sheet).toContainText(perHead);
  await sheet.getByTestId("mock-pay").click();
  await expect(friend.getByTestId("seat-2")).toHaveAttribute("data-paid", "true", { timeout: 15_000 });
  await expect(friend.getByTestId("seat-2")).toContainText("Aarav");

  // The organiser's open page updates live, no reload.
  await expect(progress).toHaveAttribute("data-paid-seats", "2", { timeout: 10_000 });
  await expect(organiser.getByText("2 of 3 shares paid")).toBeVisible();

  await orgCtx.close();
  await friendCtx.close();
});
