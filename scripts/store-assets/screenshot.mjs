import puppeteer from 'puppeteer';
import fs from 'fs';

(async () => {
  if (!fs.existsSync('screenshots')) {
    fs.mkdirSync('screenshots');
  }

  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  
  // Set viewport for a standard phone
  await page.setViewport({ width: 1080, height: 2400 });

  console.log('Navigating to Home...');
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle0' });
  await page.screenshot({ path: 'screenshots/1_home.png' });

  console.log('Navigating to Pulse...');
  await page.goto('http://localhost:3000/pulse', { waitUntil: 'networkidle0' });
  await page.screenshot({ path: 'screenshots/2_pulse.png' });

  console.log('Navigating to Hub...');
  await page.goto('http://localhost:3000/hub', { waitUntil: 'networkidle0' });
  await page.screenshot({ path: 'screenshots/3_hub.png' });

  // Tablet size
  await page.setViewport({ width: 1600, height: 2560 });
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle0' });
  await page.screenshot({ path: 'screenshots/4_tablet_home.png' });

  await browser.close();
  console.log('Done.');
})();
