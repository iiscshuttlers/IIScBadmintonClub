import { test, expect } from '@playwright/test';

test.describe('Umpire Engine: Chaos Resilience', () => {
  
  test('Optimistic UI rolls back on hostile network failure', async ({ page }) => {
    // 1. Navigate to our dedicated E2E test route
    await page.goto('/test-umpire-engine');
    
    // Intercept and forcibly fail the RPC call
    await page.route('**/rest/v1/rpc/increment_match_score', route => route.abort('failed'));
    
    // 2. Record initial score
    
    // DEBUGGING
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    page.on('pageerror', err => console.log('PAGE ERROR:', err.message));
    
    await page.waitForTimeout(2000); // Wait to see if it renders
    const html = await page.content();
    console.log("PAGE HTML:", html.substring(0, 500));
    
    const scoreLocator = page.locator('[data-testid="t1-score"]').first();
    await expect(scoreLocator).toBeVisible({ timeout: 30000 });
    const initialScoreText = await scoreLocator.innerText();
    const initialScore = Number(initialScoreText) || 0;
    
    // 3. Trigger mutation (add point to Team 1)
    const addBtn = page.locator('[data-testid="btn-add-point-t1"]').first();
    await addBtn.click();
    
    // 4. Assert Optimistic Update (Immediate +1 in the UI without network completion)
    // The UI should show the new score instantly
    await expect(scoreLocator).toHaveText(String(initialScore + 1));
    
    // 5. Assert Rollback after network timeout/failure
    // The query should fail and rollback, restoring the initial score.
    // The UmpireEngine uses sonner for toast, and the rollback happens when the mutation throws.
    await expect(page.locator('text=Failed to add point').or(page.locator('text=Failed to increment'))).toBeVisible({ timeout: 5000 });
    
    // Check that the score has rolled back
    await expect(scoreLocator).toHaveText(String(initialScore));
  });

  test('Race Condition: Concurrent Rapid Taps are dropped while syncing', async ({ page }) => {
    await page.goto('/test-umpire-engine');
    await page.waitForTimeout(1000);
    const addBtn = page.locator('[data-testid="btn-add-point-t1"]').first();
    await expect(addBtn).toBeVisible({ timeout: 30000 });
    
    let requestCount = 0;

    // Delay network requests to simulate slow 3G
    await page.route('**/rest/v1/rpc/increment_match_score', async route => {
      requestCount++;
      // delay by 1s
      await new Promise(r => setTimeout(r, 1000));
      // mock success response
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true })
      });
    });

    // Attempt to double-submit rapidly
    await addBtn.click();
    await addBtn.click(); // Second click should be swallowed by isSyncing lock in UmpireEngine.tsx
    await addBtn.click(); // Third click just in case
    
    // Wait for the first request to complete (around 1s delay)
    // plus a little buffer to ensure the network has settled
    await page.waitForTimeout(2000);
    
    // Verify only 1 network request fired
    expect(requestCount).toBeLessThanOrEqual(1);
  });

});
