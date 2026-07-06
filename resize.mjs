import sharp from 'sharp';

async function resize() {
  await sharp('client/public/profile_banner.png')
    .resize(1024, 500)
    .toFile('screenshots/feature_graphic.png');
  console.log('Feature graphic created!');
}

resize();
