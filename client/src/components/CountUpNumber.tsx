/**
 * Shared count-up animation component.
 * Used on Home (stats section) and About (By the Numbers section).
 */
import { useRef, useState, useEffect } from 'react';

interface CountUpNumberProps {
  target: number;
  suffix?: string;
  /** Extra className applied to the root div */
  className?: string;
}

export function CountUpNumber({ target, suffix = '', className = '' }: CountUpNumberProps) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const animated = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !animated.current) {
          animated.current = true;
          const duration = 1200;
          const start = performance.now();
          const tick = (now: number) => {
            const t = Math.min((now - start) / duration, 1);
            const eased = 1 - Math.pow(1 - t, 3);
            setCount(Math.round(eased * target));
            if (t < 1) requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
        }
      },
      { threshold: 0.3 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [target]);

  return (
    <div ref={ref} className={`tabular-nums ${className}`}>
      {count}{suffix}
    </div>
  );
}
