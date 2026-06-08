import { useEffect } from 'react';

export function usePullToRefresh() {
  useEffect(() => {
    let startY = 0;
    let isRefreshing = false;

    const handleTouchStart = (e: TouchEvent) => {
      if (window.scrollY === 0) {
        startY = e.touches[0].clientY;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (window.scrollY === 0 && startY > 0 && !isRefreshing) {
        const y = e.touches[0].clientY;
        if (y - startY > 150) { // 150px pull threshold
          isRefreshing = true;
          // Trigger the reload
          window.location.reload();
        }
      }
    };

    const handleTouchEnd = () => {
      startY = 0;
      isRefreshing = false;
    };

    // Add passive event listeners to the body
    document.body.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.body.addEventListener('touchmove', handleTouchMove, { passive: true });
    document.body.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      document.body.removeEventListener('touchstart', handleTouchStart);
      document.body.removeEventListener('touchmove', handleTouchMove);
      document.body.removeEventListener('touchend', handleTouchEnd);
    };
  }, []);
}
