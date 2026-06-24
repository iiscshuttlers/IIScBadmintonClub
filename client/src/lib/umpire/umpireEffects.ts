import { Capacitor } from "@capacitor/core";

export function playTimerEndEffect() {
  try {
    if (typeof window !== "undefined") {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContext) {
        const ctx = new AudioContext();
        const osc = ctx.createOscillator();
        osc.type = "sine";
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        osc.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.5);
      }
      if (typeof Capacitor !== "undefined" && Capacitor.isNativePlatform()) {
        import("@capacitor/haptics").then(({ Haptics }) => Haptics.vibrate({ duration: 500 }));
      } else if (navigator.vibrate) {
        navigator.vibrate(500);
      }
    }
  } catch (e) {
    console.error("Failed to play timer end effect", e);
  }
}
