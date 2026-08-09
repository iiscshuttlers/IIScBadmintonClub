import { supabase } from "./supabase";
import { fetchSiteData } from "./siteData";

export interface RemoteGalleryItem {
  id: string;
  title: string;
  category: string;
  subfolder: string;
  url: string;
  path: string; // usually category/subfolder/filename
}

export async function fetchRemoteGalleryImages(): Promise<RemoteGalleryItem[]> {
  try {
    const images = await fetchSiteData<RemoteGalleryItem[]>("gallery_images", "gallery_images.json").catch(() => []);
    if (!images) return [];
    
    // Inject f_auto,q_auto into all Cloudinary URLs if they don't already have it
    const optimizedImages = images.map(img => {
      if (img.url && img.url.includes("res.cloudinary.com") && !img.url.includes("f_auto")) {
        return { ...img, url: img.url.replace("/upload/", "/upload/f_auto,q_auto/") };
      }
      return img;
    });

    // Sort by path
    return optimizedImages.sort((a, b) => a.path.localeCompare(b.path));
  } catch (err) {
    console.error("Failed to fetch gallery images:", err);
    return [];
  }
}

export async function saveRemoteGalleryImages(images: RemoteGalleryItem[]): Promise<void> {
  if (!supabase) throw new Error("Supabase is not initialized");

  const { error } = await supabase
    .from("site_data")
    .upsert(
      { key: "gallery_images", value: images as any, updated_at: new Date().toISOString() },
      { onConflict: "key" }
    );

  if (error) {
    throw new Error(`Failed to save gallery images: ${error.message}`);
  }
}

export async function deleteRemoteGalleryImage(pathToRemove: string): Promise<void> {
  const current = await fetchRemoteGalleryImages();
  const updated = current.filter(img => img.path !== pathToRemove);
  await saveRemoteGalleryImages(updated);
}

export async function deleteRemoteGalleryImages(pathsToRemove: string[]): Promise<void> {
  const current = await fetchRemoteGalleryImages();
  const pathsSet = new Set(pathsToRemove);
  const updated = current.filter(img => !pathsSet.has(img.path));
  await saveRemoteGalleryImages(updated);
}
