import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";

interface VideoPlayerModalProps {
  isOpen: boolean;
  onClose: () => void;
  videoUrl: string;
}

export function VideoPlayerModal({ isOpen, onClose, videoUrl }: VideoPlayerModalProps) {
  let embedUrl = videoUrl;
  if (videoUrl) {
    const ytMatch = videoUrl.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/);
    if (ytMatch && ytMatch[1]) {
      embedUrl = `https://www.youtube.com/embed/${ytMatch[1]}?autoplay=1`;
    }
  }

  return (
    <AnimatePresence>
      {isOpen && videoUrl && (
        <motion.div 
          className="fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-4 bg-black/95" 
          onClick={onClose}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div onClick={e => e.stopPropagation()}
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="w-full max-w-4xl bg-black rounded-2xl shadow-2xl overflow-hidden border border-slate-800 relative aspect-video flex flex-col"
        >
          <button
            onClick={onClose}
            className="absolute top-2 right-2 sm:top-4 sm:right-4 p-2 rounded-full bg-black/50 text-white hover:bg-black/80 transition-colors z-10"
          >
            <X className="w-5 h-5" />
          </button>
          
          <iframe
            src={embedUrl}
            title="Video player"
            className="w-full h-full border-0 bg-black"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </motion.div>
      </motion.div>
      )}
    </AnimatePresence>
  );
}
