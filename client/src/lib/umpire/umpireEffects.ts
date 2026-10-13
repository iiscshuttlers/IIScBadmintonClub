import { Capacitor } from "@capacitor/core";

/**
 * Umpire console feedback — haptics + sound.
 *
 * All effects are gated behind a per-device preference so they can be muted
 * from Settings. Defaults: ON for native (courtside, phone in hand), OFF for
 * web (umpiring from a laptop is quieter). (#33)
 */

const HAPTICS_KEY = "umpire_haptics_enabled";
const SOUND_KEY = "umpire_sound_enabled";

function prefEnabled(key: string): boolean {
  try {
    const v = localStorage.getItem(key);
    if (v === null) return Capacitor.isNativePlatform(); // default: native on, web off
    return v === "1" || v === "true";
  } catch {
    return false;
  }
}

export function setUmpireHaptics(on: boolean) {
  try { localStorage.setItem(HAPTICS_KEY, on ? "1" : "0"); } catch { /* ignore */ }
}
export function setUmpireSound(on: boolean) {
  try { localStorage.setItem(SOUND_KEY, on ? "1" : "0"); } catch { /* ignore */ }
}
export function getUmpireHaptics(): boolean { return prefEnabled(HAPTICS_KEY); }
export function getUmpireSound(): boolean { return prefEnabled(SOUND_KEY); }

// ── Low-level haptics ────────────────────────────────────────────────────────
async function vibrate(ms: number) {
  try {
    if (Capacitor.isNativePlatform()) {
      const { Haptics } = await import("@capacitor/haptics");
      await Haptics.vibrate({ duration: ms });
    } else if (navigator.vibrate) {
      navigator.vibrate(ms);
    }
  } catch { /* haptics are best-effort */ }
}

async function impact(style: "Light" | "Medium" | "Heavy") {
  try {
    if (Capacitor.isNativePlatform()) {
      const { Haptics, ImpactStyle } = await import("@capacitor/haptics");
      await Haptics.impact({ style: ImpactStyle[style] });
    } else if (navigator.vibrate) {
      navigator.vibrate(style === "Light" ? 15 : style === "Medium" ? 30 : 60);
    }
  } catch { /* best-effort */ }
}

// ── Low-level sound (WebAudio, no asset loading) ─────────────────────────────
let _ctx: AudioContext | null = null;
function audioCtx(): AudioContext | null {
  try {
    if (typeof window === "undefined") return null;
    const AC = window.AudioContext || (window as any).webkitAudioContext;
    if (!AC) return null;
    if (!_ctx) _ctx = new AC();
    return _ctx;
  } catch {
    return null;
  }
}

/** Play a short tone. `freqs` sequenced as a tiny melody. */
function tone(freqs: number[], dur = 0.12, type: OscillatorType = "sine") {
  const ctx = audioCtx();
  if (!ctx) return;
  try {
    let t = ctx.currentTime;
    for (const f of freqs) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(f, t);
      // quick attack/decay envelope to avoid clicks
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.2, t + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + dur);
      t += dur;
    }
  } catch { /* best-effort */ }
}

// ── Public effects ───────────────────────────────────────────────────────────

/** A single point was scored. */
export function playPointEffect() {
  if (getUmpireHaptics()) impact("Light");
  if (getUmpireSound()) tone([660], 0.08, "triangle");
}

/** A milestone was reached: half-time interval or a set/game won. */
export function playMilestoneEffect() {
  if (getUmpireHaptics()) impact("Medium");
  if (getUmpireSound()) tone([660, 880], 0.12, "sine");
}

/** The match is over. */
export function playMatchWonEffect() {
  if (getUmpireHaptics()) vibrate(300);
  if (getUmpireSound()) tone([523, 659, 784, 1047], 0.15, "sine"); // C-E-G-C fanfare
}

/** Interval / rest timer finished. */
export function playTimerEndEffect() {
  if (getUmpireHaptics() || Capacitor.isNativePlatform()) vibrate(500);
  if (getUmpireSound()) tone([880], 0.5, "sine");
}
