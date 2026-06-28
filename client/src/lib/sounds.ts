// All sounds are synthesised via Web Audio API — no external files needed.
//
// Mobile browsers suspend AudioContext until a user gesture has occurred.
// We keep a single shared context and unlock it on first user interaction
// so notification sounds work reliably when the app is foregrounded.

// AudioContext is only created after a real user gesture to avoid the
// "AudioContext was not allowed to start" browser warning.
let _ctx: AudioContext | null = null;
let _gestureReceived = false;

function createCtx() {
  if (_ctx && _ctx.state !== "closed") return;
  try {
    _ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
  } catch (_) {}
}

// Call this once at app startup. Listens for the first real gesture and
// Sounds queued to play immediately on first user gesture (e.g. page-load smash).
const _pendingOnUnlock: Array<() => void> = [];

/**
 * Queue a sound to fire on the very first user gesture after page load.
 * Useful for "page refresh" welcome sounds that need audio context unlocked first.
 */
export function playOnUnlock(fn: () => void) {
  if (_gestureReceived) {
    fn();
  } else {
    _pendingOnUnlock.push(fn);
  }
}

// creates + resumes the AudioContext so it's ready when notifications arrive.
export function initSounds() {
  const unlock = () => {
    _gestureReceived = true;
    createCtx();
    if (_ctx?.state === "suspended") {
      _ctx.resume().catch(() => {});
    }
    // Drain any sounds queued before first gesture
    _pendingOnUnlock.splice(0).forEach((fn) => {
      try { fn(); } catch (_) {}
    });
    ["pointerdown", "touchstart", "click", "keydown"].forEach((e) =>
      document.removeEventListener(e, unlock)
    );
  };
  ["pointerdown", "touchstart", "click", "keydown"].forEach((e) =>
    document.addEventListener(e, unlock)
  );
}

function noiseBuffer(ctx: AudioContext, duration: number): AudioBuffer {
  const len = Math.floor(ctx.sampleRate * duration);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}

async function play(fn: (ctx: AudioContext, t: number) => void) {
  if (!_gestureReceived || !_ctx) return; // no gesture yet — skip silently
  try {
    if (_ctx.state === "suspended") await _ctx.resume();
    fn(_ctx, _ctx.currentTime);
  } catch (e) {
    console.warn("Sound playback failed:", e);
  }
}

/**
 * SMASH — hard racket hit + cork ping + feather swoosh.
 * Use for: match logged by opponent.
 */
export function playSmashSound() {
  play((ctx, t) => {
    // Thwack
    const nBuf = noiseBuffer(ctx, 0.18);
    const n = ctx.createBufferSource();
    n.buffer = nBuf;
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass"; bp.frequency.value = 900; bp.Q.value = 1.2;
    const hs = ctx.createBiquadFilter();
    hs.type = "highshelf"; hs.frequency.value = 2500; hs.gain.value = 8;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.7, t);
    ng.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    n.connect(bp); bp.connect(hs); hs.connect(ng); ng.connect(ctx.destination);
    n.start(t); n.stop(t + 0.18);

    // Cork ping
    const ping = ctx.createOscillator();
    ping.type = "sine";
    ping.frequency.setValueAtTime(1400, t);
    ping.frequency.exponentialRampToValueAtTime(350, t + 0.1);
    const pg = ctx.createGain();
    pg.gain.setValueAtTime(0.35, t);
    pg.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    ping.connect(pg); pg.connect(ctx.destination);
    ping.start(t); ping.stop(t + 0.12);

    // Feather swoosh
    const sBuf = noiseBuffer(ctx, 0.12);
    const sw = ctx.createBufferSource();
    sw.buffer = sBuf;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass"; lp.frequency.value = 380;
    const sg = ctx.createGain();
    sg.gain.setValueAtTime(0.18, t + 0.05);
    sg.gain.exponentialRampToValueAtTime(0.001, t + 0.17);
    sw.connect(lp); lp.connect(sg); sg.connect(ctx.destination);
    sw.start(t + 0.05); sw.stop(t + 0.17);
  });
}

/**
 * SERVE — soft shuttle tap + airy rising swoosh.
 * Use for: match request / ping.
 */
export function playServeSound() {
  play((ctx, t) => {
    // Light tap
    const nBuf = noiseBuffer(ctx, 0.1);
    const n = ctx.createBufferSource();
    n.buffer = nBuf;
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass"; bp.frequency.value = 1200; bp.Q.value = 2;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.25, t);
    ng.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
    n.connect(bp); bp.connect(ng); ng.connect(ctx.destination);
    n.start(t); n.stop(t + 0.1);

    // Rising swoosh
    const sBuf = noiseBuffer(ctx, 0.25);
    const sw = ctx.createBufferSource();
    sw.buffer = sBuf;
    const hp = ctx.createBiquadFilter();
    hp.type = "highpass"; hp.frequency.value = 2000;
    const sg = ctx.createGain();
    sg.gain.setValueAtTime(0.001, t + 0.05);
    sg.gain.linearRampToValueAtTime(0.12, t + 0.12);
    sg.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
    sw.connect(hp); hp.connect(sg); sg.connect(ctx.destination);
    sw.start(t + 0.05); sw.stop(t + 0.28);

    // Soft cork tone
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(900, t);
    osc.frequency.exponentialRampToValueAtTime(600, t + 0.08);
    const og = ctx.createGain();
    og.gain.setValueAtTime(0.12, t);
    og.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
    osc.connect(og); og.connect(ctx.destination);
    osc.start(t); osc.stop(t + 0.1);
  });
}

/**
 * POINT WON — ascending 3-note arpeggio (C-E-G).
 * Use for: match confirmed.
 */
export function playPointSound() {
  play((ctx, t) => {
    [523, 659, 784].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(freq * 0.97, t + i * 0.1);
      osc.frequency.linearRampToValueAtTime(freq, t + i * 0.1 + 0.04);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t + i * 0.1);
      g.gain.linearRampToValueAtTime(0.28, t + i * 0.1 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.1 + 0.14);
      osc.connect(g); g.connect(ctx.destination);
      osc.start(t + i * 0.1);
      osc.stop(t + i * 0.1 + 0.15);
    });
  });
}

/**
 * WHISTLE — referee short whistle with vibrato.
 * Use for: announcements, live match started, admin push.
 */
export function playWhistleSound() {
  play((ctx, t) => {
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(2800, t);
    osc.frequency.linearRampToValueAtTime(2900, t + 0.05);
    osc.frequency.linearRampToValueAtTime(2750, t + 0.25);

    const lfo = ctx.createOscillator();
    lfo.type = "sine";
    lfo.frequency.value = 18;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 30;
    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);

    // Breath noise
    const nBuf = noiseBuffer(ctx, 0.3);
    const nb = ctx.createBufferSource();
    nb.buffer = nBuf;
    const nh = ctx.createBiquadFilter();
    nh.type = "highpass"; nh.frequency.value = 3500;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.04, t);
    ng.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
    nb.connect(nh); nh.connect(ng); ng.connect(ctx.destination);
    nb.start(t); nb.stop(t + 0.28);

    const wg = ctx.createGain();
    wg.gain.setValueAtTime(0, t);
    wg.gain.linearRampToValueAtTime(0.4, t + 0.04);
    wg.gain.setValueAtTime(0.38, t + 0.22);
    wg.gain.exponentialRampToValueAtTime(0.001, t + 0.3);

    osc.connect(wg); wg.connect(ctx.destination);
    lfo.start(t); osc.start(t);
    lfo.stop(t + 0.3); osc.stop(t + 0.3);
  });
}

/**
 * VICTORY — ascending chord sweep + sparkle.
 * Use for: top-10 reached, buddy accepted.
 */
export function playVictorySound() {
  play((ctx, t) => {
    [
      { freq: 440, delay: 0 },
      { freq: 554, delay: 0.06 },
      { freq: 659, delay: 0.12 },
      { freq: 880, delay: 0.18 },
    ].forEach(({ freq, delay }) => {
      const osc = ctx.createOscillator();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(freq * 0.9, t + delay);
      osc.frequency.linearRampToValueAtTime(freq, t + delay + 0.06);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t + delay);
      g.gain.linearRampToValueAtTime(0.22, t + delay + 0.04);
      g.gain.setValueAtTime(0.2, t + delay + 0.2);
      g.gain.exponentialRampToValueAtTime(0.001, t + delay + 0.5);
      osc.connect(g); g.connect(ctx.destination);
      osc.start(t + delay);
      osc.stop(t + delay + 0.55);
    });

    // Sparkle at peak
    const sBuf = noiseBuffer(ctx, 0.1);
    const sb = ctx.createBufferSource();
    sb.buffer = sBuf;
    const sbf = ctx.createBiquadFilter();
    sbf.type = "highpass"; sbf.frequency.value = 5000;
    const sbg = ctx.createGain();
    sbg.gain.setValueAtTime(0.12, t + 0.22);
    sbg.gain.exponentialRampToValueAtTime(0.001, t + 0.32);
    sb.connect(sbf); sbf.connect(sbg); sbg.connect(ctx.destination);
    sb.start(t + 0.22); sb.stop(t + 0.32);
  });
}
