import { useState } from "react";

export function useYoutubeDrawing() {
  const [zoomParams, setZoomParams] = useState({ scale: 1, x: 0, y: 0 });
  const [isDrawMode, setIsDrawMode] = useState(false);
  const [drawLines, setDrawLines] = useState<{ x: number; y: number }[][]>([]);
  const [currentLine, setCurrentLine] = useState<{ x: number; y: number }[]>([]);
  const [brightness, setBrightness] = useState(1);

  return {
    zoomParams, setZoomParams,
    isDrawMode, setIsDrawMode,
    drawLines, setDrawLines,
    currentLine, setCurrentLine,
    brightness, setBrightness
  };
}
