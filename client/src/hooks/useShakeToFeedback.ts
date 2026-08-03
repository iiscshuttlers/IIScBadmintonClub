import { useEffect } from 'react';

export function useShakeToFeedback(onShake: () => void) {
  useEffect(() => {
    let lastUpdate = 0;
    let lastX = 0, lastY = 0, lastZ = 0;
    const SHAKE_THRESHOLD = 15;
    let lastShakeTime = 0;

    const handleMotion = (event: DeviceMotionEvent) => {
      const current = event.accelerationIncludingGravity;
      if (!current || current.x === null || current.y === null || current.z === null) return;

      const currentTime = Date.now();
      
      if (currentTime - lastShakeTime < 2000) {
        return;
      }

      if ((currentTime - lastUpdate) > 100) {
        const diffTime = currentTime - lastUpdate;
        lastUpdate = currentTime;

        const { x, y, z } = current;

        const speed = Math.abs(x + y + z - lastX - lastY - lastZ) / diffTime * 10000;

        if (speed > SHAKE_THRESHOLD * 100) {
          lastShakeTime = currentTime;
          onShake();
        }

        lastX = x;
        lastY = y;
        lastZ = z;
      }
    };

    window.addEventListener('devicemotion', handleMotion);

    return () => {
      window.removeEventListener('devicemotion', handleMotion);
    };
  }, [onShake]);
}
