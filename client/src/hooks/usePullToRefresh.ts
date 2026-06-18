import { useEffect } from "react";

export function usePullToRefresh() {
  useEffect(() => {
    let startY = 0;
    let isRefreshing = false;

    // Inject keyframes for spin animation
    const styleEl = document.createElement("style");
    styleEl.textContent = `
      @keyframes shuttle-spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
      }
    `;
    document.head.appendChild(styleEl);

    const indicator = document.createElement("div");
    indicator.style.position = "fixed";
    indicator.style.top = "-80px";
    indicator.style.left = "50%";
    indicator.style.transform = "translateX(-50%)";
    indicator.style.zIndex = "9999";
    indicator.style.display = "flex";
    indicator.style.alignItems = "center";
    indicator.style.justifyContent = "center";
    indicator.style.width = "56px";
    indicator.style.height = "56px";
    indicator.style.borderRadius = "50%";
    indicator.style.backgroundColor = "white";
    indicator.style.boxShadow = "0 4px 16px rgba(0,0,0,0.2)";
    indicator.style.transition = "none";

    // Realistic shuttlecock SVG — cork base at bottom, feathers fanning up
    indicator.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 36 36">
        <!-- Feathers (fan, top) -->
        <ellipse cx="18" cy="10" rx="10" ry="7" fill="#f0f4ff" stroke="#c7d2fe" stroke-width="1"/>
        <!-- Feather veins -->
        <line x1="18" y1="17" x2="10" y2="5"  stroke="#a5b4fc" stroke-width="0.8"/>
        <line x1="18" y1="17" x2="13" y2="4"  stroke="#a5b4fc" stroke-width="0.8"/>
        <line x1="18" y1="17" x2="18" y2="3"  stroke="#a5b4fc" stroke-width="0.8"/>
        <line x1="18" y1="17" x2="23" y2="4"  stroke="#a5b4fc" stroke-width="0.8"/>
        <line x1="18" y1="17" x2="26" y2="5"  stroke="#a5b4fc" stroke-width="0.8"/>
        <!-- Feather ring band -->
        <ellipse cx="18" cy="17" rx="7" ry="2.5" fill="none" stroke="#818cf8" stroke-width="1.2"/>
        <!-- Shaft -->
        <rect x="16.5" y="17" width="3" height="9" rx="1.5" fill="#6d5c3e"/>
        <!-- Cork base -->
        <ellipse cx="18" cy="27" rx="4.5" ry="3" fill="#d97706"/>
        <ellipse cx="18" cy="26" rx="4.5" ry="2.5" fill="#f59e0b"/>
        <!-- Cork highlight -->
        <ellipse cx="16.5" cy="25.5" rx="1.5" ry="0.8" fill="#fcd34d" opacity="0.6"/>
      </svg>
    `;

    const svgEl = indicator.querySelector("svg") as SVGSVGElement | null;
    document.body.appendChild(indicator);

    const handleTouchStart = (e: TouchEvent) => {
      if (window.scrollY === 0) {
        startY = e.touches[0].clientY;
        indicator.style.transition = "none";
        if (svgEl) {
          svgEl.style.transition = "none";
          svgEl.style.animation = "none";
        }
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (window.scrollY === 0 && startY > 0 && !isRefreshing) {
        const y = e.touches[0].clientY;
        const pullDistance = Math.max(0, y - startY);

        if (pullDistance > 0 && pullDistance < 180) {
          // Shuttle descends as user pulls down
          const visualY = Math.min(pullDistance * 0.5, 90);
          indicator.style.transform = `translate(-50%, ${visualY}px)`;

          // Rotate gradually: 0° (feathers up) → 180° (inverted, cork up) as pull increases
          if (svgEl) {
            const rotation = Math.min((pullDistance / 150) * 180, 180);
            svgEl.style.transform = `rotate(${rotation}deg)`;
          }
        }

        if (pullDistance > 150 && !isRefreshing) {
          isRefreshing = true;

          try {
            import("@capacitor/core").then(({ Capacitor }) => {
              if (Capacitor.isNativePlatform()) {
                import("@capacitor/haptics").then(({ Haptics, ImpactStyle }) => {
                  Haptics.impact({ style: ImpactStyle.Heavy });
                });
              }
            });
          } catch (_) {
            /* ignore */
          }

          // Phase 1: invert fully (cork up, feathers down) — quick flip
          indicator.style.transition = "transform 0.15s ease-in";
          indicator.style.transform = `translate(-50%, 90px)`;
          if (svgEl) {
            svgEl.style.transition = "transform 0.15s ease-in";
            svgEl.style.transform = "rotate(180deg)";
          }

          // Phase 2: shoot upward fast out of screen, then spin while reloading
          setTimeout(() => {
            indicator.style.transition = "transform 0.25s cubic-bezier(0.55, 0, 1, 0.45)";
            indicator.style.transform = `translate(-50%, -120px)`;
            if (svgEl) {
              svgEl.style.transition = "none";
              svgEl.style.transform = "none";
              svgEl.style.animation = "shuttle-spin 0.3s linear infinite";
            }
          }, 150);

          // Phase 3: re-enter from top and keep spinning while page loads
          setTimeout(() => {
            indicator.style.transition = "transform 0.2s ease-out";
            indicator.style.transform = `translate(-50%, 40px)`;
          }, 400);

          // Reload after the shoot-up animation
          setTimeout(() => {
            window.location.reload();
          }, 450);
        }
      }
    };

    const handleTouchEnd = () => {
      startY = 0;
      if (!isRefreshing) {
        indicator.style.transition = "transform 0.3s ease-out";
        indicator.style.transform = "translate(-50%, 0)";
        if (svgEl) {
          svgEl.style.transition = "transform 0.3s ease-out";
          svgEl.style.transform = "rotate(0deg)";
          svgEl.style.animation = "none";
        }
      }
    };

    document.body.addEventListener("touchstart", handleTouchStart, { passive: true });
    document.body.addEventListener("touchmove", handleTouchMove, { passive: true });
    document.body.addEventListener("touchend", handleTouchEnd, { passive: true });

    return () => {
      document.body.removeEventListener("touchstart", handleTouchStart);
      document.body.removeEventListener("touchmove", handleTouchMove);
      document.body.removeEventListener("touchend", handleTouchEnd);
      if (document.body.contains(indicator)) document.body.removeChild(indicator);
      if (document.head.contains(styleEl)) document.head.removeChild(styleEl);
    };
  }, []);
}
