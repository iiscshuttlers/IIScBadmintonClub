import { useState, useEffect } from "react";
import { Upload, FolderPlus, X, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { type RemoteGalleryItem, saveRemoteGalleryImages } from "@/lib/galleryStorage";
import imageCompression from "browser-image-compression";

interface GalleryUploaderProps {
  remotePhotos: RemoteGalleryItem[];
}

export function GalleryUploader({ remotePhotos }: GalleryUploaderProps) {
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [files, setFiles] = useState<{file: File, caption: string}[]>([]);
  
  // Existing folders from remote photos
  const existingCategories = Array.from(new Set(remotePhotos.map((p) => p.category))).filter(c => c && c !== "uncategorized");
  const existingSubfolders = Array.from(new Set(remotePhotos.map((p) => p.subfolder).filter(Boolean)));

  const [categoryMode, setCategoryMode] = useState<"select" | "new">(existingCategories.length > 0 ? "select" : "new");
  const [category, setCategory] = useState(existingCategories[0] || "");
  const [newCategory, setNewCategory] = useState("");

  const [subfolderMode, setSubfolderMode] = useState<"none" | "select" | "new">("none");
  const [subfolder, setSubfolder] = useState("");
  const [newSubfolder, setNewSubfolder] = useState("");

  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const finalCategory = categoryMode === "new" ? newCategory : category;
  const finalSubfolder = subfolderMode === "new" ? newSubfolder : subfolderMode === "select" ? subfolder : "";

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files).map(file => ({
        file,
        caption: file.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
      }));
      setFiles(prev => [...prev, ...newFiles]);
    }
  };

  const removeFile = (idx: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateCaption = (idx: number, newCaption: string) => {
    setFiles((prev) => prev.map((f, i) => i === idx ? { ...f, caption: newCaption } : f));
  };

  const handleUpload = async () => {
    const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
    const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;
    
    if (!cloudName || !uploadPreset) {
      toast.error("Cloudinary is not configured. Missing Cloud Name or Upload Preset.");
      return;
    }
    if (files.length === 0) {
      toast.error("Please select at least one image to upload.");
      return;
    }
    if (!finalCategory.trim()) {
      toast.error("Please provide a category name.");
      return;
    }

    setUploading(true);
    setProgress(0);
    let uploadedCount = 0;

    const folderPath = finalSubfolder.trim()
      ? `gallery/${finalCategory.trim()}/${finalSubfolder.trim()}`
      : `gallery/${finalCategory.trim()}`;

    const newItems: RemoteGalleryItem[] = [];

    try {
      for (const { file, caption } of files) {
        
        let fileToUpload = file;
        try {
          const options = {
            maxSizeMB: 1,
            maxWidthOrHeight: 1920,
            useWebWorker: true,
          };
          fileToUpload = await imageCompression(file, options);
        } catch (error) {
          console.warn("Compression failed, uploading original", error);
        }

        // Upload to Cloudinary
        const formData = new FormData();
        formData.append("file", fileToUpload);
        formData.append("upload_preset", uploadPreset);
        formData.append("folder", folderPath);
        
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${fileExt}`;
        formData.append("public_id", fileName);

        const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
          method: "POST",
          body: formData,
        });

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error?.message || "Failed to upload to Cloudinary");
        }

        const data = await res.json();
        
        // Inject Cloudinary auto-format (WebP/AVIF) and auto-quality (compression)
        // Original: https://res.cloudinary.com/<cloud>/image/upload/v1234/folder/file.jpg
        // Optimized: https://res.cloudinary.com/<cloud>/image/upload/f_auto,q_auto/v1234/folder/file.jpg
        const optimizedUrl = data.secure_url.replace("/upload/", "/upload/f_auto,q_auto/");

        // Add to our list
        newItems.push({
          id: data.public_id,
          title: caption.trim(),
          category: finalCategory.trim(),
          subfolder: finalSubfolder.trim(),
          url: optimizedUrl,
          path: data.public_id,
        });

        uploadedCount++;
        setProgress(Math.round((uploadedCount / files.length) * 100));
      }

      // Save the updated list to Supabase site_data
      const updatedPhotos = [...remotePhotos, ...newItems];
      await saveRemoteGalleryImages(updatedPhotos);

      toast.success(`Successfully uploaded ${files.length} image(s)!`);
      setFiles([]);
      setIsOpen(false);
      // Invalidate the query so gallery refreshes immediately
      queryClient.invalidateQueries({ queryKey: ["gallery-remote-photos"] });

    } catch (err: any) {
      console.error("Upload error:", err);
      toast.error(`An error occurred: ${err.message}`);
    } finally {
      setUploading(false);
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-24 sm:bottom-6 left-4 sm:left-6 z-[60] bg-blue-600 hover:bg-blue-700 text-on-accent p-4 rounded-full shadow-2xl transition-transform hover:scale-110 flex items-center gap-2 group"
      >
        <Upload className="w-6 h-6" />
        <span className="font-bold hidden sm:block w-0 overflow-hidden group-hover:w-32 transition-all duration-300 whitespace-nowrap">Upload Photos</span>
      </button>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800 animate-in zoom-in-95 duration-200">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/50">
          <h3 className="font-black text-lg text-slate-800 dark:text-foreground flex items-center gap-2">
            <FolderPlus className="w-5 h-5 text-blue-600" />
            Upload to Gallery
          </h3>
          <button onClick={() => !uploading && setIsOpen(false)} className="text-muted-foreground hover:text-red-500 transition">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
          {/* Category Selection */}
          <div className="space-y-3">
            <label className="text-sm font-bold text-muted-foreground dark:text-slate-300">Category (Folder)</label>
            <div className="flex gap-2">
              <button
                className={`flex-1 py-1.5 rounded-lg text-sm font-bold border transition-colors ${categoryMode === "select" ? "bg-blue-50 border-blue-200 text-blue-700" : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-muted-foreground"}`}
                onClick={() => setCategoryMode("select")}
                disabled={existingCategories.length === 0}
              >
                Existing
              </button>
              <button
                className={`flex-1 py-1.5 rounded-lg text-sm font-bold border transition-colors ${categoryMode === "new" ? "bg-blue-50 border-blue-200 text-blue-700" : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-muted-foreground"}`}
                onClick={() => setCategoryMode("new")}
              >
                Create New
              </button>
            </div>
            {categoryMode === "select" ? (
              <select
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                <option value="" disabled>Select category...</option>
                {existingCategories.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                placeholder="e.g. BPL-2024"
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 outline-none focus:ring-2 focus:ring-blue-500 font-medium placeholder:font-normal"
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
              />
            )}
          </div>

          {/* Subfolder Selection */}
          <div className="space-y-3">
            <label className="text-sm font-bold text-muted-foreground dark:text-slate-300">Subfolder (Optional)</label>
            <div className="flex gap-2">
              <button
                className={`flex-1 py-1.5 rounded-lg text-sm font-bold border transition-colors ${subfolderMode === "none" ? "bg-blue-50 border-blue-200 text-blue-700" : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-muted-foreground"}`}
                onClick={() => setSubfolderMode("none")}
              >
                None
              </button>
              <button
                className={`flex-1 py-1.5 rounded-lg text-sm font-bold border transition-colors ${subfolderMode === "select" ? "bg-blue-50 border-blue-200 text-blue-700" : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-muted-foreground"}`}
                onClick={() => setSubfolderMode("select")}
                disabled={existingSubfolders.length === 0}
              >
                Existing
              </button>
              <button
                className={`flex-1 py-1.5 rounded-lg text-sm font-bold border transition-colors ${subfolderMode === "new" ? "bg-blue-50 border-blue-200 text-blue-700" : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-muted-foreground"}`}
                onClick={() => setSubfolderMode("new")}
              >
                Create New
              </button>
            </div>
            {subfolderMode === "select" ? (
              <select
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                value={subfolder}
                onChange={(e) => setSubfolder(e.target.value)}
              >
                <option value="" disabled>Select subfolder...</option>
                {existingSubfolders.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            ) : subfolderMode === "new" ? (
              <input
                type="text"
                placeholder="e.g. Finals (use / for nested folders like Finals/Day1)"
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 outline-none focus:ring-2 focus:ring-blue-500 font-medium placeholder:font-normal"
                value={newSubfolder}
                onChange={(e) => setNewSubfolder(e.target.value)}
              />
            ) : null}
          </div>

          {/* File Picker */}
          <div className="space-y-3">
            <label className="text-sm font-bold text-muted-foreground dark:text-slate-300">Photos</label>
            <div className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-2xl p-6 text-center hover:bg-slate-50 dark:hover:bg-slate-800/50 transition cursor-pointer relative overflow-hidden group">
              <input
                type="file"
                multiple
                accept="image/*"
                onChange={handleFileChange}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                id="gallery-upload"
              />
              <div className="flex flex-col items-center gap-2">
                <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 text-blue-600 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                  <Upload className="w-6 h-6" />
                </div>
                <span className="font-bold text-muted-foreground dark:text-slate-300">
                  Tap to select photos
                </span>
                <span className="text-xs text-muted-foreground">
                  PNG, JPG, WEBP
                </span>
              </div>
            </div>

            {files.length > 0 && (
              <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-xl p-4 animate-in fade-in slide-in-from-bottom-2">
                <div className="flex justify-between text-sm font-bold mb-3 text-muted-foreground dark:text-slate-300">
                  <span>Selected ({files.length})</span>
                  <button onClick={() => setFiles([])} className="text-red-500 hover:text-red-600">Clear all</button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {files.slice(0, 9).map(({ file, caption }, i) => (
                    <div key={i} className="flex flex-col gap-2">
                      <div className="relative aspect-square rounded-lg bg-slate-200 dark:bg-slate-700 overflow-hidden group shadow-sm flex flex-col items-center justify-center">
                        <ImageIcon className="text-muted-foreground w-6 h-6 mb-1" />
                        <span className="text-[10px] font-bold text-muted-foreground uppercase">{file.name.split('.').pop()}</span>
                        <button 
                          onClick={() => removeFile(i)}
                          className="absolute top-1 right-1 bg-black/60 text-on-accent rounded-full p-1 opacity-0 group-hover:opacity-100 transition z-10 hover:bg-red-500"
                        >
                          <X className="w-3 h-3" />
                        </button>
                        <img 
                          src={URL.createObjectURL(file)} 
                          className="absolute inset-0 w-full h-full object-cover" 
                          onError={(e) => { e.currentTarget.style.display = 'none'; }}
                        />
                      </div>
                      <input 
                        type="text"
                        placeholder="Caption (Optional)"
                        value={caption}
                        onChange={(e) => updateCaption(i, e.target.value)}
                        className="w-full text-xs p-2 rounded-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                  ))}
                  {files.length > 9 && (
                    <div className="aspect-square rounded-lg bg-slate-200 dark:bg-slate-700 flex items-center justify-center font-bold text-muted-foreground text-sm shadow-sm border border-slate-300 dark:border-slate-600">
                      +{files.length - 9}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
          {uploading ? (
            <div className="w-full">
              <div className="flex justify-between text-xs font-bold text-muted-foreground dark:text-muted-foreground mb-2">
                <span>Uploading to Cloudinary...</span>
                <span>{progress}%</span>
              </div>
              <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden shadow-inner">
                <div className="h-full bg-blue-600 transition-all duration-300" style={{ width: `${progress}%` }} />
              </div>
            </div>
          ) : (
            <button
              onClick={handleUpload}
              disabled={files.length === 0 || !finalCategory.trim()}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:dark:bg-slate-700 disabled:text-muted-foreground disabled:cursor-not-allowed text-on-accent font-bold py-3.5 rounded-xl transition-all active:scale-[0.98] flex items-center justify-center gap-2 shadow-lg shadow-blue-500/25"
            >
              <Upload className="w-5 h-5" />
              Upload {files.length > 0 && `${files.length} photos`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
