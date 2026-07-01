import React from "react";
import { Image as ImageIcon, Play } from "lucide-react";
import { motion } from "framer-motion";

interface MediaTabProps {
  mediaImages: any[];
  setMediaImages: (val: any[]) => void;
  imagePreviewStatus: ("ok" | "error" | "idle")[];
  setImagePreviewStatus: React.Dispatch<React.SetStateAction<("ok" | "error" | "idle")[]>>;
  mediaVideos: any[];
  setMediaVideos: (val: any[]) => void;
  videoPreviewIds: (string | null)[];
  setVideoPreviewIds: React.Dispatch<React.SetStateAction<(string | null)[]>>;
  handleImageBlur: (idx: number, url: string) => void;
  handleVideoBlur: (idx: number, url: string) => void;
}

export function MediaTab({
  mediaImages,
  setMediaImages,
  imagePreviewStatus,
  setImagePreviewStatus,
  mediaVideos,
  setMediaVideos,
  videoPreviewIds,
  setVideoPreviewIds,
  handleImageBlur,
  handleVideoBlur,
}: MediaTabProps) {
  return (
    <motion.div
      key="media"
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 10 }}
      transition={{ duration: 0.2 }}
      className="space-y-8"
    >
      {/* Game Photos Links */}
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <label className="block text-sm font-semibold text-muted-foreground dark:text-slate-300 flex items-center gap-2">
            <ImageIcon className="w-5 h-5 text-primary" />
            Game Photos Showcase
          </label>
          <button
            type="button"
            onClick={() =>
              setMediaImages([...mediaImages, { url: "", caption: "" }])
            }
            className="text-xs font-bold text-primary hover:text-primary dark:text-primary flex items-center gap-1 bg-primary/10 dark:bg-primary/20 px-3 py-1.5 rounded-lg border border-primary/30 dark:border-primary/30 transition shadow-sm"
          >
            + Add Photo Link
          </button>
        </div>

        <div className="space-y-3">
          {mediaImages.map((img, idx) => (
            <div
              key={idx}
              className="flex gap-3 items-end p-4 bg-slate-50 dark:bg-slate-850 rounded-2xl border border-slate-200 dark:border-slate-800 relative"
            >
              <button
                type="button"
                onClick={() =>
                  setMediaImages(mediaImages.filter((_, i) => i !== idx))
                }
                className="absolute top-2 right-2 text-rose-500 hover:text-rose-600 text-xs font-bold"
              >
                Remove
              </button>
              <div className="flex-1 space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground dark:text-muted-foreground mb-1">
                    Image URL
                  </label>
                  <input
                    type="text"
                    required
                    value={img.url}
                    onChange={(e) => {
                      const updated = [...mediaImages];
                      updated[idx].url = e.target.value;
                      setMediaImages(updated);
                      setImagePreviewStatus((prev) => {
                        const n = [...prev];
                        n[idx] = "idle";
                        return n;
                      });
                    }}
                    onBlur={(e) => handleImageBlur(idx, e.target.value)}
                    className={`w-full px-3 py-2 rounded-xl border bg-white dark:bg-slate-900 text-foreground dark:text-foreground text-xs outline-none focus:ring-2 focus:ring-primary
                      ${
                        imagePreviewStatus[idx] === "error"
                          ? "border-rose-400 dark:border-rose-500"
                          : "border-slate-200 dark:border-slate-700"
                      }`}
                    placeholder="e.g. https://images.unsplash.com/photo-..."
                  />
                  {imagePreviewStatus[idx] === "ok" && img.url && (
                    <div className="mt-2 rounded-xl overflow-hidden border border-primary/40 dark:border-primary/80 w-full aspect-video bg-slate-100 dark:bg-slate-800">
                      <img
                        src={img.url}
                        alt="preview"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                  {imagePreviewStatus[idx] === "error" && (
                    <p className="mt-1 text-[11px] text-rose-500 font-semibold">
                      Could not load image — check the URL.
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground dark:text-muted-foreground mb-1">
                    Caption
                  </label>
                  <input
                    type="text"
                    value={img.caption}
                    onChange={(e) => {
                      const updated = [...mediaImages];
                      updated[idx].caption = e.target.value;
                      setMediaImages(updated);
                    }}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-foreground dark:text-foreground text-xs outline-none focus:ring-2 focus:ring-primary"
                    placeholder="e.g. Winning Smash in Doubles Final"
                  />
                </div>
              </div>
            </div>
          ))}
          {mediaImages.length === 0 && (
            <div className="text-center py-6 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl text-muted-foreground text-sm">
              No photos added yet. Showcase your winning matches!
            </div>
          )}
        </div>
      </div>

      {/* YouTube Video Links */}
      <div className="space-y-4 pt-6 border-t border-slate-100 dark:border-slate-800">
        <div className="flex justify-between items-center">
          <label className="block text-sm font-semibold text-muted-foreground dark:text-slate-300 flex items-center gap-2">
            <Play className="w-5 h-5 text-red-500 fill-red-500" />
            YouTube Game Highlights
          </label>
          <button
            type="button"
            onClick={() =>
              setMediaVideos([...mediaVideos, { url: "", caption: "" }])
            }
            className="text-xs font-bold text-primary hover:text-primary dark:text-primary flex items-center gap-1 bg-primary/10 dark:bg-primary/20 px-3 py-1.5 rounded-lg border border-primary/30 dark:border-primary/30 transition shadow-sm"
          >
            + Add Video Link
          </button>
        </div>

        <div className="space-y-3">
          {mediaVideos.map((vid, idx) => (
            <div
              key={idx}
              className="flex gap-3 items-end p-4 bg-slate-50 dark:bg-slate-850 rounded-2xl border border-slate-200 dark:border-slate-800 relative"
            >
              <button
                type="button"
                onClick={() =>
                  setMediaVideos(mediaVideos.filter((_, i) => i !== idx))
                }
                className="absolute top-2 right-2 text-rose-500 hover:text-rose-600 text-xs font-bold"
              >
                Remove
              </button>
              <div className="flex-1 space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground dark:text-muted-foreground mb-1">
                    YouTube URL
                  </label>
                  <input
                    type="text"
                    required
                    value={vid.url}
                    onChange={(e) => {
                      const updated = [...mediaVideos];
                      updated[idx].url = e.target.value;
                      setMediaVideos(updated);
                      setVideoPreviewIds((prev) => {
                        const n = [...prev];
                        n[idx] = null;
                        return n;
                      });
                    }}
                    onBlur={(e) => handleVideoBlur(idx, e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-foreground dark:text-foreground text-xs outline-none focus:ring-2 focus:ring-primary"
                    placeholder="e.g. https://youtube.com/watch?v=..."
                  />
                  {videoPreviewIds[idx] && (
                    <div className="mt-2 rounded-xl overflow-hidden border border-primary/40 dark:border-primary/80 w-full aspect-video bg-black">
                      <iframe
                        src={`https://www.youtube.com/embed/${videoPreviewIds[idx]}`}
                        title="YouTube video player"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                        className="w-full h-full"
                      />
                    </div>
                  )}
                  {vid.url && !videoPreviewIds[idx] && (
                    <p className="mt-1 text-[11px] text-rose-500 font-semibold">
                      Invalid YouTube link format.
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground dark:text-muted-foreground mb-1">
                    Caption
                  </label>
                  <input
                    type="text"
                    value={vid.caption}
                    onChange={(e) => {
                      const updated = [...mediaVideos];
                      updated[idx].caption = e.target.value;
                      setMediaVideos(updated);
                    }}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-foreground dark:text-foreground text-xs outline-none focus:ring-2 focus:ring-primary"
                    placeholder="e.g. IISc Shuttlers Open 2024"
                  />
                </div>
              </div>
            </div>
          ))}
          {mediaVideos.length === 0 && (
            <div className="text-center py-6 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl text-muted-foreground text-sm">
              No videos added. (Shorts & Standard links supported)
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
