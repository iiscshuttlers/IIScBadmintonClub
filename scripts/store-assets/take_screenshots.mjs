import { chromium } from 'playwright';
import fs from 'fs';

async function takeScreenshots() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();

  console.log('Generating Phone Screenshots...');
  const phonePage = await context.newPage();
  await phonePage.setViewportSize({ width: 1080, height: 1920 });
  await phonePage.goto('http://localhost:5173');
  await phonePage.waitForLoadState('networkidle');
  // Press Escape to close any welcome modal
  await phonePage.keyboard.press('Escape');
  await phonePage.waitForTimeout(1000); // Wait for modal animation to finish
  
  await phonePage.screenshot({ path: 'screenshots/phone/1_home.png' });

  // Navigate to Pulse
  await phonePage.goto('http://localhost:5173/pulse');
  await phonePage.waitForLoadState('networkidle');
  await phonePage.keyboard.press('Escape');
  await phonePage.waitForTimeout(500);
  await phonePage.screenshot({ path: 'screenshots/phone/2_pulse.png' });

  // Navigate to Hub
  await phonePage.goto('http://localhost:5173/hub');
  await phonePage.waitForLoadState('networkidle');
  await phonePage.keyboard.press('Escape');
  await phonePage.waitForTimeout(500);
  await phonePage.screenshot({ path: 'screenshots/phone/3_hub.png' });
  await phonePage.close();

  console.log('Generating Tablet Screenshots...');
  const tabletPage = await context.newPage();
  await tabletPage.setViewportSize({ width: 1920, height: 1080 });
  await tabletPage.goto('http://localhost:5173');
  await tabletPage.waitForLoadState('networkidle');
  await tabletPage.keyboard.press('Escape');
  await tabletPage.waitForTimeout(1000);
  await tabletPage.screenshot({ path: 'screenshots/tablet/1_home.png' });

  await tabletPage.goto('http://localhost:5173/pulse');
  await tabletPage.waitForLoadState('networkidle');
  await tabletPage.keyboard.press('Escape');
  await tabletPage.waitForTimeout(500);
  await tabletPage.screenshot({ path: 'screenshots/tablet/2_pulse.png' });
  await tabletPage.close();

  await browser.close();
  console.log('Successfully generated new screenshots without the modal!');
}

takeScreenshots().catch(console.error);
