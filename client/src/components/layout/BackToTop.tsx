import { useState, useEffect } from "react";
import { ArrowUp } from "lucide-react";

export function BackToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 300);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (!visible) return null;

  return (
    <button
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      aria-label="Back to top"
      className="fixed bottom-6 right-6 z-50 w-12 h-12 rounded-full bg-primary hover:bg-primary text-foreground shadow-lg hover:shadow-primary/20 hover:-translate-y-1 transition-all duration-300 flex items-center justify-center"
    >
      <ArrowUp className="w-5 h-5" strokeWidth={2.5} />
    </button>
  );
}
