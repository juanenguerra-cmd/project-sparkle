import { test, expect } from "@playwright/test";

test("home page renders and captures screenshot", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/IP Nurse Hub/i);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: "playwright-report/homepage.png", fullPage: true });
});
