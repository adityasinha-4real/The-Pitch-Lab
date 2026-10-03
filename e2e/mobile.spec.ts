import { expect, test } from "@playwright/test";
import { login, newEmail, openTurf, selectFirstAvailable } from "./helpers";

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

test.describe("mobile", () => {
  test("sticky bottom booking bar appears when a slot is picked", async ({ page }) => {
    await login(page, newEmail("mobile"));
    await openTurf(page, "panenka-yard", 5);
    await expect(page.getByTestId("mobile-booking-bar")).toHaveCount(0);
    await selectFirstAvailable(page);
    const bar = page.getByTestId("mobile-booking-bar");
    await expect(bar).toBeVisible();
    expect(await bar.evaluate((el) => getComputedStyle(el).position)).toBe("fixed");
    const box = (await bar.boundingBox())!;
    expect(Math.round(box.y + box.height)).toBeGreaterThanOrEqual(843);
    await expect(bar.getByTestId("hold-button")).toBeVisible();
    // Scrolling keeps it pinned.
    await page.mouse.wheel(0, 1200);
    await expect(bar).toBeInViewport();
  });

  test("44px touch targets on the booking surface", async ({ page }) => {
    await openTurf(page, "panenka-yard", 5);
    const targets = page.locator(
      'header a, header button, [data-testid="date-strip"] [role="radio"], [data-testid="slot-grid"] [role="radio"]',
    );
    const sizes = await targets.evaluateAll((els) =>
      els
        .filter((e) => (e as HTMLElement).offsetParent !== null)
        .map((e) => {
          const r = e.getBoundingClientRect();
          return { id: e.getAttribute("data-testid") ?? e.getAttribute("aria-label") ?? e.textContent?.trim(), w: r.width, h: r.height };
        }),
    );
    expect(sizes.length).toBeGreaterThan(20);
    for (const s of sizes) {
      expect(s.h, `${s.id} height`).toBeGreaterThanOrEqual(44);
      expect(s.w, `${s.id} width`).toBeGreaterThanOrEqual(44);
    }
  });

  test("skeleton: changing date shows skeleton loaders, not a spinner", async ({ page }) => {
    await openTurf(page, "panenka-yard", 1);
    await page.route("**/api/turfs/*/slots*", async (route) => {
      await new Promise((r) => setTimeout(r, 900));
      await route.continue();
    });
    await page.getByTestId("date-strip").getByRole("radio").nth(2).click();
    await expect(page.getByTestId("slot-skeleton")).toBeVisible();
    await expect(page.locator(".animate-spin")).toHaveCount(0);
    await expect(page.getByTestId("slot-grid")).toBeVisible();
  });

  test("no horizontal page scroll", async ({ page }) => {
    for (const path of ["/", "/turfs", "/turfs/rabona-ridge", "/games", "/signin"]) {
      await page.goto(path);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, path).toBeLessThanOrEqual(0);
    }
  });
});
