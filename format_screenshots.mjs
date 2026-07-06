import sharp from 'sharp';
import fs from 'fs';

async function generateScreenshots() {
  const phoneOut = 'screenshots/phone';
  const tabletOut = 'screenshots/tablet';
  
  if (!fs.existsSync(phoneOut)) fs.mkdirSync(phoneOut, { recursive: true });
  if (!fs.existsSync(tabletOut)) fs.mkdirSync(tabletOut, { recursive: true });

  const phoneFiles = ['1_home.png', '2_pulse.png', '3_hub.png'];
  
  console.log('Generating Phone Screenshots (1080x1920)...');
  for (const file of phoneFiles) {
    await sharp(`screenshots/${file}`)
      .resize(1080, 1920, { fit: 'contain', background: '#ffffff' })
      .toFile(`${phoneOut}/${file}`);
  }

  console.log('Generating Tablet Screenshots (1920x1080)...');
  const tabletFiles = ['4_tablet_home.png', '1_home.png', '2_pulse.png'];
  for (const file of tabletFiles) {
    await sharp(`screenshots/${file}`)
      .resize(1920, 1080, { fit: 'contain', background: '#ffffff' })
      .toFile(`${tabletOut}/${file}`);
  }

  console.log('Done!');
}

generateScreenshots().catch(console.error);
