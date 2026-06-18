// Generates badminton notification sound WAV files into android/app/src/main/res/raw/
// Run: node scripts/generate-sounds.js

const fs = require("fs");
const path = require("path");

const OUT_DIR = path.join(__dirname, "../android/app/src/main/res/raw");
const SAMPLE_RATE = 44100;

function writeWav(filename, samples) {
  const numSamples = samples.length;
  const dataSize = numSamples * 2; // 16-bit PCM
  const buf = Buffer.alloc(44 + dataSize);

  // RIFF header
  buf.write("RIFF", 0);
  buf.writeUInt32LE(36 + dataSize, 4);
  buf.write("WAVE", 8);
  buf.write("fmt ", 12);
  buf.writeUInt32LE(16, 16);       // PCM chunk size
  buf.writeUInt16LE(1, 20);        // PCM format
  buf.writeUInt16LE(1, 22);        // mono
  buf.writeUInt32LE(SAMPLE_RATE, 24);
  buf.writeUInt32LE(SAMPLE_RATE * 2, 28); // byte rate
  buf.writeUInt16LE(2, 32);        // block align
  buf.writeUInt16LE(16, 34);       // bits per sample
  buf.write("data", 36);
  buf.writeUInt32LE(dataSize, 40);

  for (let i = 0; i < numSamples; i++) {
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    buf.writeInt16LE(Math.round(clamped * 32767), 44 + i * 2);
  }

  const outPath = path.join(OUT_DIR, filename);
  fs.writeFileSync(outPath, buf);
  console.log(`✓ ${filename} (${(buf.length / 1024).toFixed(1)} KB)`);
}

function noise() { return Math.random() * 2 - 1; }

// ── SMASH — hard racket hit + cork ping + feather swoosh ──────────────────────
function generateSmash() {
  const dur = 0.55;
  const n = Math.floor(SAMPLE_RATE * dur);
  const out = new Float32Array(n);

  for (let i = 0; i < n; i++) {
    const t = i / SAMPLE_RATE;
    // Thwack noise
    out[i] += noise() * 0.7 * Math.exp(-t * 28);
    // Cork ping: decaying sine 1400→350 Hz
    const pingFreq = 1400 * Math.exp(-t * 25);
    out[i] += 0.35 * Math.sin(2 * Math.PI * pingFreq * t) * Math.exp(-t * 22);
    // Feather swoosh (low-freq noise, delayed)
    if (t > 0.05) out[i] += noise() * 0.18 * Math.exp(-(t - 0.05) * 18);
  }
  applyMasterGain(out, 0.82);
  return out;
}

// ── SERVE — soft tap + airy rising swoosh ─────────────────────────────────────
function generateServe() {
  const dur = 0.5;
  const n = Math.floor(SAMPLE_RATE * dur);
  const out = new Float32Array(n);

  for (let i = 0; i < n; i++) {
    const t = i / SAMPLE_RATE;
    // Soft tap
    out[i] += noise() * 0.25 * Math.exp(-t * 60);
    // Cork tone (soft)
    out[i] += 0.12 * Math.sin(2 * Math.PI * 900 * t) * Math.exp(-t * 35);
    // Rising airy swoosh (delayed, fades in then out)
    if (t > 0.05) {
      const st = t - 0.05;
      const env = st < 0.08 ? st / 0.08 : Math.exp(-(st - 0.08) * 12);
      out[i] += noise() * 0.14 * env;
    }
  }
  applyMasterGain(out, 0.78);
  return out;
}

// ── POINT — ascending 3-note arpeggio (C5-E5-G5) ─────────────────────────────
function generatePoint() {
  const dur = 0.55;
  const n = Math.floor(SAMPLE_RATE * dur);
  const out = new Float32Array(n);
  const notes = [{ f: 523, start: 0 }, { f: 659, start: 0.1 }, { f: 784, start: 0.2 }];

  for (const { f, start } of notes) {
    for (let i = 0; i < n; i++) {
      const t = i / SAMPLE_RATE - start;
      if (t < 0) continue;
      const env = t < 0.02 ? t / 0.02 : Math.exp(-(t - 0.02) * 18);
      // Triangle approximation via harmonics
      out[i] += 0.28 * (
        Math.sin(2 * Math.PI * f * t) -
        (1 / 9) * Math.sin(2 * Math.PI * 3 * f * t) +
        (1 / 25) * Math.sin(2 * Math.PI * 5 * f * t)
      ) * env;
    }
  }
  applyMasterGain(out, 0.8);
  return out;
}

// ── WHISTLE — referee whistle with vibrato ────────────────────────────────────
function generateWhistle() {
  const dur = 0.45;
  const n = Math.floor(SAMPLE_RATE * dur);
  const out = new Float32Array(n);

  for (let i = 0; i < n; i++) {
    const t = i / SAMPLE_RATE;
    // Envelope: fast attack, sustain, fast release
    const env = t < 0.04 ? t / 0.04 : t > 0.38 ? Math.exp(-(t - 0.38) * 30) : 1;
    // Main whistle tone with slight pitch wobble
    const baseFreq = 2800 + 100 * t - 50 * t * t;
    const vibrato = 30 * Math.sin(2 * Math.PI * 18 * t);
    out[i] += 0.38 * Math.sin(2 * Math.PI * (baseFreq + vibrato) * t) * env;
    // Slight breath noise
    out[i] += noise() * 0.04 * env;
  }
  applyMasterGain(out, 0.82);
  return out;
}

// ── VICTORY — ascending chord sweep + sparkle ─────────────────────────────────
function generateVictory() {
  const dur = 0.9;
  const n = Math.floor(SAMPLE_RATE * dur);
  const out = new Float32Array(n);
  const voices = [
    { f: 440, start: 0 },
    { f: 554, start: 0.06 },
    { f: 659, start: 0.12 },
    { f: 880, start: 0.18 },
  ];

  for (const { f, start } of voices) {
    for (let i = 0; i < n; i++) {
      const t = i / SAMPLE_RATE - start;
      if (t < 0) continue;
      const env = t < 0.04 ? t / 0.04 : Math.exp(-(t - 0.04) * 3.5);
      out[i] += 0.22 * (
        Math.sin(2 * Math.PI * f * t) -
        (1 / 9) * Math.sin(2 * Math.PI * 3 * f * t)
      ) * env;
    }
  }

  // Sparkle burst
  for (let i = 0; i < n; i++) {
    const t = i / SAMPLE_RATE;
    if (t > 0.2 && t < 0.32) {
      out[i] += noise() * 0.12 * Math.exp(-(t - 0.2) * 20);
    }
  }

  applyMasterGain(out, 0.8);
  return out;
}

function applyMasterGain(samples, gain) {
  for (let i = 0; i < samples.length; i++) samples[i] *= gain;
}

// Generate all
writeWav("smash.wav",   generateSmash());
writeWav("serve.wav",   generateServe());
writeWav("point.wav",   generatePoint());
writeWav("whistle.wav", generateWhistle());
writeWav("victory.wav", generateVictory());

console.log("\nAll sounds written to android/app/src/main/res/raw/");
