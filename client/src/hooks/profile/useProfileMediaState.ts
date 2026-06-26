import { useState } from "react";
import { getYouTubeId } from "@/lib/playerUtils";

export function useProfileMediaState() {
  const [mediaImages, setMediaImages] = useState<{ url: string; caption: string }[]>([]);
  const [mediaVideos, setMediaVideos] = useState<{ url: string; caption: string }[]>([]);
  const [imagePreviewStatus, setImagePreviewStatus] = useState<("ok" | "error" | "idle")[]>([]);
  const [videoPreviewIds, setVideoPreviewIds] = useState<(string | null)[]>([]);

  function handleImageBlur(idx: number, url: string) {
    if (!url) return;
    const img = new window.Image();
    img.onload = () => setImagePreviewStatus((prev) => { const n = [...prev]; n[idx] = "ok"; return n; });
    img.onerror = () => setImagePreviewStatus((prev) => { const n = [...prev]; n[idx] = "error"; return n; });
    img.src = url;
  }

  function handleVideoBlur(idx: number, url: string) {
    const ytId = getYouTubeId(url);
    setVideoPreviewIds((prev) => { const n = [...prev]; n[idx] = ytId; return n; });
  }

  return {
    mediaImages, setMediaImages,
    mediaVideos, setMediaVideos,
    imagePreviewStatus, setImagePreviewStatus,
    videoPreviewIds, setVideoPreviewIds,
    handleImageBlur, handleVideoBlur,
  };
}
