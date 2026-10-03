import { mkdirSync } from "node:fs";
import path from "node:path";
import { expect, test, type Browser, type Page } from "@playwright/test";
import { ADMIN, holdSelected, login, newEmail, openTurf, selectFirstAvailable } from "./helpers";

const OUT = path.join(process.cwd(), "e2e", "screenshots");
const WIDTHS = [390, 1440] as const;
const THEMES = ["light", "dark"] as const;

async function shoot(page: Page, name: string, theme: string, width: number) {
  await page.waitForTimeout(1_400); // let entrance motion settle
  await page.screenshot({ path: path.join(OUT, `${name}-${theme}-${width}.png`), fullPage: width === 1440 });
}

async function contextFor(browser: Browser, theme: (typeof THEMES)[number], width: number) {
  const ctx = await browser.newContext({
    colorScheme: theme,
    viewport: { width, height: width === 390 ? 844 : 900 },
    deviceScaleFactor: width === 390 ? 2 : 1,
  });
  return { ctx, page: await ctx.newPage() };
}

test.describe("screenshots", () => {
  test.beforeAll(() => mkdirSync(OUT, { recursive: true }));

  for (const theme of THEMES) {
    for (const width of WIDTHS) {
      test(`${theme} @ ${width}px`, async ({ browser }) => {
        test.setTimeout(150_000);

        // Home
        let { ctx, page } = await contextFor(browser, theme, width);
        await page.goto("/");
        await shoot(page, "home", theme, width);

        // Slot grid with a selection, tomorrow (seeded bookings show booked states)
        await login(page, newEmail(`shot-${theme}-${width}`));
        await openTurf(page, "nutmeg-box", 1);
        await selectFirstAvailable(page);
        if (width === 390) await page.getByTestId("date-strip").evaluate((el) => window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 76 }));
        await shoot(page, "slot-grid", theme, width);

        // Checkout with a live hold
        await openTurf(page, "nutmeg-box", 6);
        await selectFirstAvailable(page);
        await holdSelected(page);
        await expect(page.getByRole("timer")).toBeVisible();
        await shoot(page, "checkout", theme, width);
        await ctx.close();

        // Admin control room
        ({ ctx, page } = await contextFor(browser, theme, width));
        await login(page, ADMIN, "/admin");
        await expect(page.getByTestId("heatmap")).toBeVisible();
        await shoot(page, "admin", theme, width);
        await ctx.close();
      });
    }
  }
});
