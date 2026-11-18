import { expect, test } from "@playwright/test";

test.describe("Umpire Engine scoring journey", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/test-umpire-engine");
    const dismissTour = page.getByRole("button", { name: "Dismiss tour" });
    if (await dismissTour.isVisible()) await dismissTour.click();
    await expect(page.getByTestId("t1-score").first()).toBeVisible();
  });

  test("records rapid rallies without dropping taps and supports correction", async ({ page }) => {
    const score = page.getByTestId("t1-score").first();
    const addPoint = page.getByTestId("btn-add-point-t1").first();

    await expect(score).toHaveText("0");
    await addPoint.click();
    await addPoint.click();
    await addPoint.click();
    await expect(score).toHaveText("3");

    await addPoint.getByRole("button", { name: "Deduct point" }).click();
    await expect(score).toHaveText("2");
  });

  test("keeps both scoring controls keyboard reachable", async ({ page }) => {
    const teamOne = page.getByTestId("btn-add-point-t1").first();
    const teamTwo = page.getByTestId("btn-add-point-t2").first();

    await teamOne.focus();
    await expect(teamOne).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("t1-score").first()).toHaveText("1");

    await teamTwo.focus();
    await expect(teamTwo).toBeFocused();
    await page.keyboard.press("Space");
    await expect(page.getByTestId("t2-score").first()).toHaveText("1");
  });
});
