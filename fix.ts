import { supabase } from './client/src/lib/supabase';
import { fetchRemoteGalleryImages, saveRemoteGalleryImages } from './client/src/lib/galleryStorage';

async function fix() {
  const images = await fetchRemoteGalleryImages();
  let changed = false;
  images.forEach(i => {
    if (i.subfolder === '') {
      i.subfolder = 'Open Tournament August 2026';
      changed = true;
    }
  });
  if (changed) {
    await saveRemoteGalleryImages(images);
    console.log("Fixed!");
  } else {
    console.log("No empty subfolders found.");
  }
}
fix();
