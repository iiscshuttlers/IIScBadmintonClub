import { chromium } from "playwright";

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  console.log("Navigating to page...");
  await page.goto("http://localhost:3001/pulse?t=active&cat=MD#players", { waitUntil: "networkidle" });
  
  console.log("Waiting for MD category to be selected...");
  await page.waitForTimeout(2000); // Give it a bit to load the list
  
  // Click MD if not already active
  const mdBtn = await page.locator('button:has-text("MD")');
  if (await mdBtn.isVisible()) {
    await mdBtn.click();
    await page.waitForTimeout(1000);
  }

  // Extract participants text
  // Looking at TournamentManager/LivePlayersSection, the player names are likely inside elements with certain classes.
  // We can just grab the text of all player names.
  const players = await page.evaluate(() => {
    // We can just select all elements that have the font-black / text-sm styling
    // But safely, let's just grab the whole container text and we can parse it
    const cards = Array.from(document.querySelectorAll('.flex-col.sm\\:flex-row'));
    return cards.map(c => c.innerText);
  });

  console.log(JSON.stringify(players, null, 2));
  
  // Also try another selector if that one fails
  const pNames = await page.evaluate(() => {
    // In LivePlayersSection, names are inside <div className="font-black text-sm ...">
    const names = Array.from(document.querySelectorAll('.font-black.text-sm'));
    return names.map(n => n.innerText);
  });
  console.log("Alternative names list:");
  console.log(JSON.stringify(pNames, null, 2));

  await browser.close();
})();
