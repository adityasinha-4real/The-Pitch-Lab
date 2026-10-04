import { expect, test } from "@playwright/test";
import { login, newEmail } from "./helpers";

test.describe("auth", () => {
  test("magic link signs a new player in", async ({ page }) => {
    const email = newEmail("magic");
    await login(page, email);
    await expect(page.getByRole("button", { name: "Account menu" })).toBeVisible();
    await page.getByRole("button", { name: "Account menu" }).click();
    await expect(page.getByText(email)).toBeVisible();
  });

  test("a magic link works only once", async ({ page, context }) => {
    await page.goto("/signin");
    await page.getByLabel("Email").fill(newEmail("once"));
    await page.getByRole("button", { name: "Email me a magic link" }).click();
    const href = await page.getByTestId("local-magic-link").getAttribute("href");
    await page.goto(href!);
    await expect(page.getByRole("button", { name: "Account menu" })).toBeVisible();
    await context.clearCookies();
    await page.goto(href!);
    await expect(page).toHaveURL(/\/signin\?error=used/);
    await expect(page.getByRole("main").getByRole("alert")).toContainText("already used");
  });

  test("rejects an invalid email", async ({ page }) => {
    await page.goto("/signin");
    await page.getByLabel("Email").fill("not-an-email");
    await page.getByRole("button", { name: "Email me a magic link" }).click();
    await expect(page.getByRole("main").getByRole("alert")).toContainText("valid email");
  });

  test("google: continue with Google signs in", async ({ page }) => {
    await page.goto("/signin");
    await page.getByRole("link", { name: "Continue with Google" }).click();
    await expect(page.getByRole("button", { name: "Account menu" })).toBeVisible();
    await page.getByRole("button", { name: "Account menu" }).click();
    await expect(page.getByText("google.player@pitchlab.test")).toBeVisible();
  });

  test("redirect: protected pages send you to sign in and back", async ({ page }) => {
    await page.goto("/bookings");
    await expect(page).toHaveURL(/\/signin\?next=%2Fbookings/);
    await page.getByLabel("Email").fill(newEmail("redirect"));
    await page.getByRole("button", { name: "Email me a magic link" }).click();
    await page.getByTestId("local-magic-link").click();
    await expect(page).toHaveURL(/\/bookings$/);
    await expect(page.getByRole("heading", { name: "My bookings" })).toBeVisible();
  });

  test("sign out ends the session", async ({ page }) => {
    await login(page, newEmail("signout"));
    await page.getByRole("button", { name: "Account menu" }).click();
    await page.getByRole("menuitem", { name: "Sign out" }).click();
    await expect(page.getByRole("link", { name: "Sign in" }).first()).toBeVisible();
  });
});
