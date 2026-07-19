import { createClient } from "@supabase/supabase-js";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";

const __dirname = dirname(fileURLToPath(import.meta.url));

const CLOUD_NAME = process.env.VITE_CLOUDINARY_CLOUD_NAME;
const API_KEY = process.env.VITE_CLOUDINARY_API_KEY;
const API_SECRET = process.env.VITE_CLOUDINARY_API_SECRET;

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!CLOUD_NAME || !API_KEY || !API_SECRET) {
  console.error("❌ Error: Missing Cloudinary credentials.");
  console.error("Please add VITE_CLOUDINARY_CLOUD_NAME, VITE_CLOUDINARY_API_KEY, and VITE_CLOUDINARY_API_SECRET to your .env file.");
  process.exit(1);
}

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("❌ Error: Missing Supabase credentials.");
  console.error("Please add VITE_SUPABASE_URL and VITE_SUPABASE_SERVICE_ROLE_KEY to your .env file.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

function formatText(text) {
  return text.replace(/[-_]/g, " ").replace(/\//g, " > ").replace(/\b\w/g, (c) => c.toUpperCase());
}

async function fetchCloudinaryImages() {
  console.log("Fetching images from Cloudinary...");
  const auth = Buffer.from(`${API_KEY}:${API_SECRET}`).toString('base64');
  
  let allResources = [];
  let nextCursor = null;

  do {
    let url = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/resources/image/upload?max_results=500&prefix=gallery/`;
    if (nextCursor) {
      url += `&next_cursor=${nextCursor}`;
    }

    const res = await fetch(url, {
      headers: { 'Authorization': `Basic ${auth}` }
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Cloudinary API Error: ${res.status} ${res.statusText} - ${errorText}`);
    }

    const data = await res.json();
    allResources = allResources.concat(data.resources);
    nextCursor = data.next_cursor;
    
    console.log(`Fetched ${allResources.length} images so far...`);
  } while (nextCursor);

  return allResources;
}

async function run() {
  try {
    const resources = await fetchCloudinaryImages();
    console.log(`✅ Successfully fetched ${resources.length} total images from Cloudinary.`);

    const newGalleryItems = [];

    for (const res of resources) {
      // public_id looks like: gallery/Tournaments/BPL-2024/IMG_1234
      const parts = res.public_id.split("/");
      
      // We ignore the root "gallery" folder for categorization
      if (parts[0] === "gallery") {
        parts.shift();
      }

      // If it's just in the root of gallery without subfolders, skip or put in general
      if (parts.length < 2) continue;

      const rawCategory = parts[0];
      const category = rawCategory.charAt(0).toUpperCase() + rawCategory.slice(1);
      const subfolder = parts.length > 2 ? parts.slice(1, -1).join("/") : "";
      
      // filename without extension
      const filename = parts[parts.length - 1];
      const title = formatText(filename);

      // The 'path' property needs to match how it's handled on the frontend
      // e.g. "Tournaments/BPL-2024/IMG_1234.jpg"
      const path = `${parts.join("/")}.${res.format}`;

      // Force optimization params in URL
      const optimizedUrl = res.secure_url.replace("/upload/", "/upload/f_auto,q_auto/");

      newGalleryItems.push({
        id: crypto.randomUUID(),
        title,
        category,
        subfolder,
        url: optimizedUrl,
        path,
      });
    }

    console.log(`Formatted ${newGalleryItems.length} images for Supabase.`);

    // Fetch existing images from Supabase
    const { data: siteData, error: fetchError } = await supabase
      .from("site_data")
      .select("value")
      .eq("key", "gallery_images")
      .maybeSingle();

    if (fetchError && fetchError.code !== "PGRST116") {
      throw fetchError;
    }

    const existingImages = siteData?.value || [];
    console.log(`Found ${existingImages.length} existing images in Supabase.`);

    // Merge logic: prefer newly fetched Cloudinary images, keep existing ones if they aren't duplicates
    const pathMap = new Map();
    for (const img of existingImages) {
      pathMap.set(img.path, img);
    }
    for (const img of newGalleryItems) {
      pathMap.set(img.path, img); // Overwrite existing if path matches
    }

    const mergedImages = Array.from(pathMap.values());

    // Save to local JSON file for fallback and immediate availability without RLS
    const fs = await import("fs");
    const jsonPath = resolve(__dirname, "../client/public/data/gallery_images.json");
    fs.writeFileSync(jsonPath, JSON.stringify(mergedImages, null, 2));
    console.log(`Saved ${mergedImages.length} images to client/public/data/gallery_images.json`);

    try {
      console.log(`Updating Supabase with ${mergedImages.length} total images...`);
      const { error: upsertError } = await supabase
        .from("site_data")
        .upsert({
          key: "gallery_images",
          value: mergedImages,
          updated_at: new Date().toISOString()
        }, { onConflict: "key" });

      if (upsertError) {
        console.warn("⚠️ Could not write to Supabase due to RLS, but images are saved locally!");
      } else {
        console.log("✅ Successfully synced to Supabase.");
      }
    } catch (e) {
      console.warn("⚠️ Could not write to Supabase, but images are saved locally!");
    }

    console.log("🎉 Sync complete! All Cloudinary images are now available in the app.");

  } catch (error) {
    console.error("❌ An error occurred:", error);
  }
}

run();
