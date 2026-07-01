import { useState, useRef, useEffect } from "react";
import { motion, useAnimation, useMotionValue, useTransform } from "framer-motion";
import { Check, ChevronRight, Loader2 } from "lucide-react";

interface SwipeToConfirmProps {
  onConfirm: () => Promise<void> | void;
  isLoading?: boolean;
  disabled?: boolean;
  text?: string;
}

export function SwipeToConfirm({ onConfirm, isLoading, disabled, text = "Swipe to Submit" }: SwipeToConfirmProps) {
  const [isSuccess, setIsSuccess] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const controls = useAnimation();
  
  const [containerWidth, setContainerWidth] = useState(0);
  const [handleWidth, setHandleWidth] = useState(0);

  useEffect(() => {
    if (containerRef.current && handleRef.current) {
      setContainerWidth(containerRef.current.offsetWidth);
      setHandleWidth(handleRef.current.offsetWidth);
    }
    
    const handleResize = () => {
      if (containerRef.current && handleRef.current) {
        setContainerWidth(containerRef.current.offsetWidth);
        setHandleWidth(handleRef.current.offsetWidth);
      }
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const dragBoundary = containerWidth - handleWidth - 8; // 8px for padding

  const opacity = useTransform(x, [0, dragBoundary * 0.8], [1, 0]);
  const progressWidth = useTransform(x, [0, dragBoundary], [handleWidth, containerWidth - 8]);

  const handleDragEnd = async (event: any, info: any) => {
    if (disabled || isLoading || isSuccess) return;

    if (info.offset.x >= dragBoundary * 0.8) {
      // Success threshold reached
      controls.start({ x: dragBoundary });
      try {
        await onConfirm();
        setIsSuccess(true);
      } catch (e) {
        controls.start({ x: 0 });
      }
    } else {
      // Snap back
      controls.start({ x: 0 });
    }
  };

  if (isSuccess || isLoading) {
    return (
      <div className="w-full h-14 rounded-full bg-primary text-foreground flex items-center justify-center font-bold shadow-lg shadow-primary/20 transition-all">
        {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Check className="w-5 h-5 mr-2" /> Match Submitted!</>}
      </div>
    );
  }

  return (
    <div 
      ref={containerRef}
      className={`relative w-full h-14 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center p-1 overflow-hidden transition-opacity ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      <motion.div
        className="absolute left-1 top-1 bottom-1 bg-primary/20 rounded-full z-0"
        style={{ width: progressWidth }}
      />
      
      <motion.div
        style={{ opacity }}
        className="absolute inset-0 flex items-center justify-center font-bold text-sm text-muted-foreground dark:text-muted-foreground z-0 select-none pointer-events-none"
      >
        {text}
      </motion.div>

      <motion.div
        ref={handleRef}
        drag={disabled || isLoading ? false : "x"}
        dragConstraints={{ left: 0, right: dragBoundary > 0 ? dragBoundary : 0 }}
        dragElastic={0.1}
        dragMomentum={false}
        onDragEnd={handleDragEnd}
        animate={controls}
        style={{ x }}
        className="h-12 w-16 bg-white dark:bg-slate-700 rounded-full shadow-md flex items-center justify-center z-10 cursor-grab active:cursor-grabbing border border-slate-200 dark:border-slate-600"
      >
        <div className="flex -space-x-1">
          <ChevronRight className="w-5 h-5 text-primary opacity-60" />
          <ChevronRight className="w-5 h-5 text-primary" />
        </div>
      </motion.div>
    </div>
  );
}
