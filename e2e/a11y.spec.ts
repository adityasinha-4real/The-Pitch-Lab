import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { ADMIN, holdSelected, login, newEmail, openTurf, selectFirstAvailable } from "./helpers";

async function audit(page: Page, label: string) {
  // Let entrance animations finish so axe measures final colours.
  await page.waitForTimeout(900);
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  const bad = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  if (bad.length) {
    console.log(
      `\n[axe] ${label}\n` +
        bad.map((v) => `  ${v.impact} ${v.id}: ${v.help}\n${v.nodes.slice(0, 4).map((n) => `    ${n.target.join(" ")} — ${n.failureSummary?.split("\n")[1] ?? ""}`).join("\n")}`).join("\n"),
    );
  }
  expect(bad, `${label}: serious/critical axe violations`).toEqual([]);
}

for (const scheme of ["light", "dark"] as const) {
  test.describe(`axe (${scheme})`, () => {
    test.use({ colorScheme: scheme });

    test("public pages", async ({ page }) => {
      for (const path of ["/", "/turfs", "/turfs/nutmeg-box", "/games", "/signin", "/split/seedsplitkabir0000000000000000001", "/nope"]) {
        await page.goto(path);
        await audit(page, `${scheme} ${path}`);
      }
      await openTurf(page, "nutmeg-box", 1);
      await page.getByTestId("slot-grid").locator('[data-state="available"]').first().click();
      await audit(page, `${scheme} slot selected`);
    });

    test("player pages", async ({ page }) => {
      await login(page, newEmail(`axe-${scheme}`));
      await page.goto("/bookings");
      await audit(page, `${scheme} /bookings`);
      await openTurf(page, "rabona-ridge", 5);
      await selectFirstAvailable(page);
      await holdSelected(page);
      await audit(page, `${scheme} checkout`);
      await page.getByTestId("pay-button").click();
      await expect(page.getByTestId("mock-checkout")).toBeVisible();
      await audit(page, `${scheme} mock checkout`);
      await page.getByTestId("mock-pay").click();
      await expect(page.getByTestId("confirmed-heading")).toBeVisible({ timeout: 20_000 });
      await page.waitForTimeout(2_500);
      await audit(page, `${scheme} confirmed`);
    });

    test("admin pages", async ({ page }) => {
      await login(page, ADMIN, "/admin");
      for (const tab of ["overview", "bookings", "slots", "pricing"]) {
        await page.goto(`/admin?tab=${tab}`);
        await audit(page, `${scheme} admin ${tab}`);
      }
    });
  });
}
