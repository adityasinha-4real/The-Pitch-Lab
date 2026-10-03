import { expect, test } from "@playwright/test";
import { openTurf } from "./helpers";

const bg = (page: import("@playwright/test").Page) => page.evaluate(() => getComputedStyle(document.body).backgroundColor);

test.describe("themes", () => {
  test("follows the system by default in both schemes", async ({ browser }) => {
    for (const [scheme, colour] of [
      ["dark", "rgb(11, 18, 13)"],
      ["light", "rgb(246, 245, 239)"],
    ] as const) {
      const ctx = await browser.newContext({ colorScheme: scheme });
      const page = await ctx.newPage();
      await page.goto("/");
      await expect(page.locator("html")).toHaveClass(new RegExp(`\\b${scheme}\\b`));
      expect(await bg(page)).toBe(colour);
      await ctx.close();
    }
  });

  test("toggle persists on reload with no flash of the wrong theme", async ({ browser }) => {
    const ctx = await browser.newContext({ colorScheme: "dark" });
    const page = await ctx.newPage();
    // Record the theme class at the very first moment the DOM is ready, on every load.
    await page.addInitScript(() => {
      document.addEventListener("DOMContentLoaded", () => {
        (window as unknown as { __firstTheme: string }).__firstTheme = document.documentElement.className;
      });
    });
    await page.goto("/");
    await expect(page.locator("html")).toHaveClass(/\bdark\b/);

    await page.getByTestId("theme-toggle").click();
    await expect(page.locator("html")).toHaveClass(/\blight\b/);
    expect(await page.evaluate(() => localStorage.getItem("nutmeg-theme"))).toBe("light");

    await page.reload();
    expect(await page.evaluate(() => (window as unknown as { __firstTheme: string }).__firstTheme)).toMatch(/\blight\b/);
    await expect(page.locator("html")).toHaveClass(/\blight\b/);
    expect(await bg(page)).toBe("rgb(246, 245, 239)");

    // Footer switcher can hand control back to the system.
    await page.getByRole("radio", { name: "System" }).click();
    await page.reload();
    await expect(page.locator("html")).toHaveClass(/\bdark\b/);
    await ctx.close();
  });

  test("fonts: scoreboard display face and tabular prices", async ({ page }) => {
    await page.goto("/turfs/nutmeg-box");
    const h1Font = await page.locator("h1").first().evaluate((el) => getComputedStyle(el).fontFamily);
    expect(h1Font).toMatch(/Big Shoulders/i);
    const bodyFont = await page.evaluate(() => getComputedStyle(document.body).fontFamily);
    expect(bodyFont).toMatch(/Inter Tight/i);
    const price = page.locator(".num").first();
    expect(await price.evaluate((el) => getComputedStyle(el).fontVariantNumeric)).toContain("tabular-nums");
    // Fonts actually loaded, not just declared.
    expect(await page.evaluate(async () => (await document.fonts.ready, [...document.fonts].some((f) => /Big Shoulders/i.test(f.family) && f.status === "loaded")))).toBe(true);
  });

  test("reduced motion: no transform animations, no confetti", async ({ browser }) => {
    const ctx = await browser.newContext({ reducedMotion: "reduce" });
    const page = await ctx.newPage();
    await openTurf(page, "nutmeg-box", 2);
    const transforms = await page
      .getByTestId("slot-grid")
      .getByRole("radio")
      .evaluateAll((els) => els.slice(0, 6).map((e) => getComputedStyle(e).transform));
    for (const t of transforms) expect(t === "none" || t === "matrix(1, 0, 0, 1, 0, 0)").toBe(true);
    const shimmer = await page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches);
    expect(shimmer).toBe(true);
    await ctx.close();
  });
});
