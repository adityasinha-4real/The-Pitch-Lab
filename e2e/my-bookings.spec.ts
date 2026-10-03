import { expect, test } from "@playwright/test";
import { bookAndPay, login, newEmail } from "./helpers";

test.describe("my bookings", () => {
  test("lists upcoming bookings and cancel refunds 100% more than 24h out", async ({ page }) => {
    await login(page, newEmail("canceller"));
    await bookAndPay(page, "panenka-yard", 4);

    await page.goto("/bookings");
    const row = page.getByTestId("booking-row").filter({ hasText: "Panenka Yard" });
    await expect(row).toHaveAttribute("data-status", "confirmed");
    const amount = (await row.innerText()).match(/₹[\d,]+/)![0];

    await row.getByTestId("cancel-open").click();
    await expect(page.getByTestId("refund-preview")).toHaveText(amount);
    await expect(page.getByRole("dialog")).toContainText("100% of");
    await page.getByTestId("cancel-confirm").click();
    await expect(page.getByText(/Cancelled\. .* \(100%\) is on its way back/)).toBeVisible();

    await page.getByRole("tab", { name: /Cancelled/ }).click();
    const cancelled = page.getByTestId("booking-row").filter({ hasText: "Panenka Yard" });
    await expect(cancelled).toHaveAttribute("data-status", "cancelled");
    await expect(cancelled).toContainText(`refunded ${amount}`);

    // The slot is free again.
    await page.getByRole("tab", { name: /Upcoming/ }).click();
    await expect(page.getByTestId("booking-row")).toHaveCount(0);
  });
});
