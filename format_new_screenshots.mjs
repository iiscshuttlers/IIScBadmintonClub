import sharp from 'sharp';
import fs from 'fs';

async function generateScreenshots() {
  const phoneDir = 'screenshots/phone';
  const tabletDir = 'screenshots/tablet';
  const phoneOut = 'screenshots/phone_formatted';
  const tabletOut = 'screenshots/tablet_formatted';
  
  if (!fs.existsSync(phoneOut)) fs.mkdirSync(phoneOut, { recursive: true });
  if (!fs.existsSync(tabletOut)) fs.mkdirSync(tabletOut, { recursive: true });

  const phoneFiles = fs.readdirSync(phoneDir).filter(f => f.endsWith('.png'));
  console.log(`Generating Phone Screenshots (1080x1920) for ${phoneFiles.length} files...`);
  for (const file of phoneFiles) {
    await sharp(`${phoneDir}/${file}`)
      .resize(1080, 1920, { fit: 'contain', background: '#ffffff' })
      .toFile(`${phoneOut}/${file}`);
  }

  const tabletFiles = fs.readdirSync(tabletDir).filter(f => f.endsWith('.png'));
  console.log(`Generating Tablet Screenshots (1920x1080) for ${tabletFiles.length} files...`);
  for (const file of tabletFiles) {
    await sharp(`${tabletDir}/${file}`)
      .resize(1920, 1080, { fit: 'contain', background: '#ffffff' })
      .toFile(`${tabletOut}/${file}`);
  }

  console.log('Done!');
}

generateScreenshots().catch(console.error);
