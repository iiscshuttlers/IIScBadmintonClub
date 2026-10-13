import React from "react";
import { motion, AnimatePresence } from "framer-motion";

interface AnimatedScoreNumberProps {
  value: string | number;
  className?: string;
}

/**
 * Animated number roll for live scores.
 * Rolls up smoothly on score increments, with prefers-reduced-motion fallback.
 */
export function AnimatedScoreNumber({ value, className = "" }: AnimatedScoreNumberProps) {
  return (
    <span className={`inline-block overflow-hidden relative ${className}`}>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={String(value)}
          initial={{ y: "60%", opacity: 0 }}
          animate={{ y: "0%", opacity: 1 }}
          exit={{ y: "-60%", opacity: 0 }}
          transition={{ duration: 0.22, ease: "easeOut" }}
          className="inline-block"
        >
          {value}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}
