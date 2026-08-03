# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: umpire-engine.spec.ts >> Umpire Engine: Chaos Resilience >> Optimistic UI rolls back on hostile network failure
- Location: tests\umpire-engine.spec.ts:5:3

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: expect(locator).toBeVisible() failed

Locator: locator('[data-testid="t1-score"]').first()
Expected: visible
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 30000ms
  - waiting for locator('[data-testid="t1-score"]').first()

```

```yaml
- link "Skip to content":
  - /url: "#main-content"
- status:
  - img
  - text: You're offline — some features may be unavailable
- navigation:
  - link "IISc Logo IISc Badminton Club Shuttlers · Bangalore":
    - /url: /
    - img "IISc Logo"
    - text: IISc Badminton Club Shuttlers · Bangalore
  - link "Home":
    - /url: /
    - button "Home"
  - link "Pulse":
    - /url: /pulse
    - button "Pulse"
  - link "Legacy":
    - /url: /legacy
    - button "Legacy"
  - link "Hub":
    - /url: /hub
    - button "Hub"
  - button "Search":
    - img
  - button "Sign In":
    - img
    - text: Sign In
- main:
  - text: 🏸
  - heading "This page crashed" [level=2]
  - paragraph: Something went wrong loading this section. The rest of the app is unaffected.
  - button "Reload"
  - link "Go Home":
    - /url: /
- contentinfo:
  - img
  - heading "IISc Badminton Club" [level=3]
  - paragraph: Shuttlers · Est. 2018
  - img
  - text: IISc Gymkhana, Bangalore
  - img
  - link "iiscbadmintonclub@gmail.com":
    - /url: mailto:iiscbadmintonclub@gmail.com
  - link "Instagram":
    - /url: https://www.instagram.com/badminton.iisc/
    - img
  - link "YouTube":
    - /url: https://youtube.com/@iiscbadmintonclub
    - img
  - heading "Quick Links" [level=4]
  - list:
    - listitem:
      - link "Home":
        - /url: /
    - listitem:
      - link "Pulse":
        - /url: /pulse
    - listitem:
      - link "Hub":
        - /url: /hub
    - listitem:
      - link "Legacy":
        - /url: /legacy
    - listitem:
      - link "Glossary":
        - /url: /glossary
    - listitem:
      - link "Privacy Policy":
        - /url: /privacy
    - listitem:
      - link "Terms of Service":
        - /url: /terms
    - listitem:
      - link "Delete Account":
        - /url: /delete-account
  - heading "Get the App" [level=4]
  - link "Download for Android App":
    - /url: https://play.google.com/store/apps/details?id=com.iiscshuttlers.app
    - img
    - text: Download for Android App
    - img
  - paragraph:
    - text: © 2026 IISc Badminton Club. All rights reserved.
    - link "·":
      - /url: /admin
  - paragraph: Built with ♥
  - text: v1.24
- region "Notifications alt+T"
- button:
  - img
- text: 🏸
- heading "Welcome to IISc Badminton Club!" [level=2]
- paragraph: Your one-stop hub for badminton at IISc. Track matches, compete on leaderboards, and rise through the ranks.
- button "Back" [disabled]:
  - img
  - text: Back
- button "Next":
  - text: Next
  - img
- button "Open Tanstack query devtools":
  - img
- img
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | 
  3  | test.describe('Umpire Engine: Chaos Resilience', () => {
  4  |   
  5  |   test('Optimistic UI rolls back on hostile network failure', async ({ page }) => {
  6  |     // 1. Navigate to our dedicated E2E test route
  7  |     await page.goto('/test-umpire-engine');
  8  |     
  9  |     // Intercept and forcibly fail the RPC call
  10 |     await page.route('**/rest/v1/rpc/increment_match_score', route => route.abort('failed'));
  11 |     
  12 |     // 2. Record initial score
  13 |     
  14 |     // DEBUGGING
  15 |     page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  16 |     page.on('pageerror', err => console.log('PAGE ERROR:', err.message));
  17 |     
  18 |     await page.waitForTimeout(2000); // Wait to see if it renders
  19 |     const html = await page.content();
  20 |     console.log("PAGE HTML:", html.substring(0, 500));
  21 |     
  22 |     const scoreLocator = page.locator('[data-testid="t1-score"]').first();
> 23 |     await expect(scoreLocator).toBeVisible({ timeout: 30000 });
     |                                ^ Error: expect(locator).toBeVisible() failed
  24 |     const initialScoreText = await scoreLocator.innerText();
  25 |     const initialScore = Number(initialScoreText) || 0;
  26 |     
  27 |     // 3. Trigger mutation (add point to Team 1)
  28 |     const addBtn = page.locator('[data-testid="btn-add-point-t1"]').first();
  29 |     await addBtn.click();
  30 |     
  31 |     // 4. Assert Optimistic Update (Immediate +1 in the UI without network completion)
  32 |     // The UI should show the new score instantly
  33 |     await expect(scoreLocator).toHaveText(String(initialScore + 1));
  34 |     
  35 |     // 5. Assert Rollback after network timeout/failure
  36 |     // The query should fail and rollback, restoring the initial score.
  37 |     // The UmpireEngine uses sonner for toast, and the rollback happens when the mutation throws.
  38 |     await expect(page.locator('text=Failed to add point').or(page.locator('text=Failed to increment'))).toBeVisible({ timeout: 5000 });
  39 |     
  40 |     // Check that the score has rolled back
  41 |     await expect(scoreLocator).toHaveText(String(initialScore));
  42 |   });
  43 | 
  44 |   test('Race Condition: Concurrent Rapid Taps are dropped while syncing', async ({ page }) => {
  45 |     await page.goto('/test-umpire-engine');
  46 |     await page.waitForTimeout(1000);
  47 |     const addBtn = page.locator('[data-testid="btn-add-point-t1"]').first();
  48 |     await expect(addBtn).toBeVisible({ timeout: 30000 });
  49 |     
  50 |     let requestCount = 0;
  51 | 
  52 |     // Delay network requests to simulate slow 3G
  53 |     await page.route('**/rest/v1/rpc/increment_match_score', async route => {
  54 |       requestCount++;
  55 |       // delay by 1s
  56 |       await new Promise(r => setTimeout(r, 1000));
  57 |       // mock success response
  58 |       await route.fulfill({
  59 |         status: 200,
  60 |         contentType: 'application/json',
  61 |         body: JSON.stringify({ success: true })
  62 |       });
  63 |     });
  64 | 
  65 |     // Attempt to double-submit rapidly
  66 |     await addBtn.click();
  67 |     await addBtn.click(); // Second click should be swallowed by isSyncing lock in UmpireEngine.tsx
  68 |     await addBtn.click(); // Third click just in case
  69 |     
  70 |     // Wait for the first request to complete (around 1s delay)
  71 |     // plus a little buffer to ensure the network has settled
  72 |     await page.waitForTimeout(2000);
  73 |     
  74 |     // Verify only 1 network request fired
  75 |     expect(requestCount).toBeLessThanOrEqual(1);
  76 |   });
  77 | 
  78 | });
  79 | 
```