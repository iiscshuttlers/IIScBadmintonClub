import type { Variants } from "framer-motion";

/**
 * Shared motion language for Tournaments UI.
 * Restrained, consistent, respect prefers-reduced-motion.
 */

export const cardIn: Variants = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.25, ease: "easeOut" } },
  exit: { opacity: 0, y: -8, transition: { duration: 0.18 } },
};

export const staggerContainer: Variants = {
  initial: {},
  animate: {
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.02,
    },
  },
};

export const fadeCross: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.2 } },
  exit: { opacity: 0, transition: { duration: 0.15 } },
};

export const liftHover = "transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl active:scale-[0.98]";
export const tapScale = "active:scale-[0.98] transition-transform duration-100";
