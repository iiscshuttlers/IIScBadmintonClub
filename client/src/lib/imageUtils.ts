export async function optimizeImage(
  file: File,
  maxWidth = 1024,
  quality = 0.8,
): Promise<File> {
  let blob: Blob = file;

  // Handle HEIC/HEIF files if the CDN script is loaded
  if (
    file.name.toLowerCase().endsWith(".heic") ||
    file.name.toLowerCase().endsWith(".heif") ||
    file.type === "image/heic"
  ) {
    if (typeof window !== "undefined" && (window as any).heic2any) {
      try {
        const result = await (window as any).heic2any({
          blob: file,
          toType: "image/jpeg",
          quality: 0.8,
        });
        blob = Array.isArray(result) ? result[0] : result;
      } catch (e) {
        console.error("HEIC conversion failed", e);
      }
    } else {
      console.warn("heic2any script not loaded, uploading original file");
    }
  }

  // If it's a PDF or something that can't be drawn on canvas, skip
  if (!blob.type.startsWith("image/")) {
    return file;
  }

  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(blob);

    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;

      // Calculate aspect ratio
      if (width > maxWidth) {
        height = Math.round((height * maxWidth) / width);
        width = maxWidth;
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(new File([blob], file.name, { type: blob.type }));
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (newBlob) => {
          if (newBlob) {
            // Replace extension with .webp
            const newName = file.name.replace(/\.[^/.]+$/, "") + ".webp";
            resolve(new File([newBlob], newName, { type: "image/webp" }));
          } else {
            resolve(new File([blob], file.name, { type: blob.type }));
          }
        },
        "image/webp",
        quality,
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(file); // Fallback to original
    };

    img.src = url;
  });
}
