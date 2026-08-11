import puppeteer from 'puppeteer';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

(async () => {
  console.log("Launching puppeteer...");
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  
  const htmlPath = `file:///${path.join(__dirname, 'rulebook.html').replace(/\\/g, '/')}`;
  console.log("Loading HTML:", htmlPath);
  
  await page.goto(htmlPath, { waitUntil: 'load' });
  
  // Wait a moment for Tailwind CDN script to process and render styles
  await new Promise(r => setTimeout(r, 2000));
  
  console.log("Generating PDF...");
  await page.pdf({
    path: 'Official_Rulebook.pdf',
    format: 'A4',
    printBackground: true,
    margin: {
      top: '0px',
      bottom: '0px',
      left: '0px',
      right: '0px'
    }
  });

  await browser.close();
  console.log('PDF generated successfully as Official_Rulebook.pdf');
})();
