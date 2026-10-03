import { expect, test } from "@playwright/test";
import { bookAndPay, login, newEmail } from "./helpers";

test("open games: post 'need N players', another player joins", async ({ browser }) => {
  const hostCtx = await browser.newContext();
  const joinerCtx = await browser.newContext();
  const host = await hostCtx.newPage();
  const joiner = await joinerCtx.newPage();
  await login(host, newEmail("host"));
  await login(joiner, newEmail("joiner"));

  await bookAndPay(host, "rabona-ridge", 4);
  await host.getByTestId("open-game-open").click();
  await host.getByRole("button", { name: "Fewer players" }).click(); // 3 → 2
  await host.getByLabel("Note for players").fill("Need a keeper and a winger");
  await host.getByTestId("open-game-save").click();
  await expect(host.getByText("Listed on the open games board: need 2.")).toBeVisible();
  await expect(host.getByTestId("open-game-open")).toHaveText(/Need 2 more/);

  await joiner.goto("/games");
  const card = joiner.locator("article").filter({ hasText: "Need a keeper and a winger" });
  await expect(card.getByTestId("players-left")).toHaveText("2");
  await card.getByTestId("join-game").click();
  await expect(joiner.getByText("You're in.")).toBeVisible();
  await expect(card.getByTestId("players-left")).toHaveText("1");
  await expect(card.getByRole("button", { name: "Leave" })).toBeVisible();

  // The host sees their own game marked as theirs.
  await host.goto("/games");
  await expect(host.locator("article").filter({ hasText: "Need a keeper and a winger" })).toContainText("Your game");
  await hostCtx.close();
  await joinerCtx.close();
});
