import { useEffect } from 'react';

export function usePullToRefresh() {
  useEffect(() => {
    let startY = 0;
    let isRefreshing = false;
    
    // Create the visual indicator DOM node
    const indicator = document.createElement('div');
    indicator.style.position = 'fixed';
    indicator.style.top = '-60px'; // Hidden above viewport
    indicator.style.left = '50%';
    indicator.style.transform = 'translateX(-50%)';
    indicator.style.zIndex = '9999';
    indicator.style.display = 'flex';
    indicator.style.alignItems = 'center';
    indicator.style.justifyContent = 'center';
    indicator.style.width = '40px';
    indicator.style.height = '40px';
    indicator.style.borderRadius = '50%';
    indicator.style.backgroundColor = 'white';
    indicator.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
    indicator.style.transition = 'none'; // Will handle transform manually during pull
    
    // SVG Shuttlecock
    indicator.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 22a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z"/>
        <path d="m10.5 19-3-12"/>
        <path d="m13.5 19 3-12"/>
        <path d="m12 18 0-11"/>
        <path d="M6 7h12"/>
        <path d="M4 4h16"/>
      </svg>
    `;
    
    const svgIcon = indicator.querySelector('svg');
    document.body.appendChild(indicator);

    const handleTouchStart = (e: TouchEvent) => {
      if (window.scrollY === 0) {
        startY = e.touches[0].clientY;
        indicator.style.transition = 'none';
        if (svgIcon) svgIcon.style.transition = 'none';
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (window.scrollY === 0 && startY > 0 && !isRefreshing) {
        const y = e.touches[0].clientY;
        const pullDistance = Math.max(0, y - startY);
        
        if (pullDistance > 0 && pullDistance < 180) {
          // Move indicator down
          const visualY = Math.min(pullDistance * 0.5, 80); 
          indicator.style.transform = `translate(-50%, ${visualY}px)`;
          
          // Rotate shuttlecock based on pull
          if (svgIcon) {
            const rotation = Math.min(pullDistance * 2, 180);
            svgIcon.style.transform = `rotate(${rotation}deg)`;
          }
        }
        
        if (pullDistance > 150) { // 150px pull threshold
          isRefreshing = true;
          try {
            import('@capacitor/haptics').then(({ Haptics, ImpactStyle }) => {
              Haptics.impact({ style: ImpactStyle.Heavy });
            });
          } catch (e) { /* ignore */ }
          
          // Smash animation!
          indicator.style.transition = 'transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
          indicator.style.transform = `translate(-50%, 100px) scale(1.5)`;
          if (svgIcon) {
            svgIcon.style.transition = 'transform 0.4s ease-out';
            svgIcon.style.transform = 'rotate(180deg)';
          }
          
          // Trigger the reload shortly after the smash animation
          setTimeout(() => {
            window.location.reload();
          }, 400);
        }
      }
    };

    const handleTouchEnd = () => {
      startY = 0;
      if (!isRefreshing) {
        indicator.style.transition = 'transform 0.3s ease-out';
        indicator.style.transform = 'translate(-50%, 0)';
        if (svgIcon) {
          svgIcon.style.transition = 'transform 0.3s ease-out';
          svgIcon.style.transform = 'rotate(0deg)';
        }
      }
    };

    document.body.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.body.addEventListener('touchmove', handleTouchMove, { passive: true });
    document.body.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      document.body.removeEventListener('touchstart', handleTouchStart);
      document.body.removeEventListener('touchmove', handleTouchMove);
      document.body.removeEventListener('touchend', handleTouchEnd);
      if (document.body.contains(indicator)) {
        document.body.removeChild(indicator);
      }
    };
  }, []);
}
