import { useGame } from './store';

/**
 * Tiny WebAudio synth — no audio files. All hooks are generated.
 * Muted state lives in the game store.
 */

let ctx: AudioContext | null = null;

function ac(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const W = window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext };
  const Ctor = W.AudioContext ?? W.webkitAudioContext;
  if (!Ctor) return null;
  if (!ctx) ctx = new Ctor();
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

function muted(): boolean {
  return useGame.getState().muted;
}

interface ToneOpts {
  freq: number;
  dur?: number;
  type?: OscillatorType;
  gain?: number;
  delay?: number;
  glide?: number;
}

function tone({ freq, dur = 0.12, type = 'square', gain = 0.06, delay = 0, glide }: ToneOpts) {
  const c = ac();
  if (!c || muted()) return;
  const t0 = c.currentTime + delay;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (glide) osc.frequency.exponentialRampToValueAtTime(Math.max(30, glide), t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}

export const sfx = {
  click() {
    tone({ freq: 880, dur: 0.07, type: 'square', gain: 0.04 });
  },
  hover() {
    tone({ freq: 660, dur: 0.04, type: 'sine', gain: 0.025 });
  },
  tick() {
    tone({ freq: 520, dur: 0.05, type: 'square', gain: 0.035 });
  },
  shuffle() {
    for (let i = 0; i < 7; i++) tone({ freq: 300 + i * 90, dur: 0.05, type: 'square', gain: 0.03, delay: i * 0.07 });
  },
  lock() {
    tone({ freq: 220, dur: 0.2, type: 'sawtooth', gain: 0.05, glide: 110 });
  },
  unlock() {
    tone({ freq: 392, dur: 0.1, type: 'triangle', gain: 0.07 });
    tone({ freq: 523, dur: 0.1, type: 'triangle', gain: 0.07, delay: 0.09 });
    tone({ freq: 659, dur: 0.16, type: 'triangle', gain: 0.07, delay: 0.18 });
    tone({ freq: 784, dur: 0.22, type: 'triangle', gain: 0.08, delay: 0.27 });
  },
  win() {
    const notes = [523, 659, 784, 1047, 1319];
    notes.forEach((f, i) => tone({ freq: f, dur: 0.16, type: 'square', gain: 0.05, delay: i * 0.08 }));
  },
  rareWin() {
    const notes = [523, 659, 784, 1047, 1319, 1568, 2093];
    notes.forEach((f, i) => tone({ freq: f, dur: 0.14, type: 'square', gain: 0.05, delay: i * 0.06 }));
  },
  wrong() {
    tone({ freq: 220, dur: 0.18, type: 'sawtooth', gain: 0.06, glide: 140 });
    tone({ freq: 165, dur: 0.26, type: 'sawtooth', gain: 0.06, delay: 0.14, glide: 98 });
  },
  timeout() {
    tone({ freq: 440, dur: 0.12, type: 'sawtooth', gain: 0.05 });
    tone({ freq: 330, dur: 0.12, type: 'sawtooth', gain: 0.05, delay: 0.14 });
    tone({ freq: 220, dur: 0.3, type: 'sawtooth', gain: 0.06, delay: 0.28, glide: 110 });
  },
  burn() {
    tone({ freq: 180, dur: 0.15, type: 'sawtooth', gain: 0.05, glide: 60 });
    tone({ freq: 120, dur: 0.2, type: 'square', gain: 0.04, delay: 0.1, glide: 50 });
  },
  duplicate() {
    tone({ freq: 587, dur: 0.1, type: 'square', gain: 0.05 });
    tone({ freq: 587, dur: 0.14, type: 'square', gain: 0.05, delay: 0.13 });
  },
  achievement() {
    tone({ freq: 784, dur: 0.12, type: 'triangle', gain: 0.07 });
    tone({ freq: 988, dur: 0.12, type: 'triangle', gain: 0.07, delay: 0.1 });
    tone({ freq: 1175, dur: 0.2, type: 'triangle', gain: 0.08, delay: 0.2 });
  },
  clawDescend() {
    tone({ freq: 320, dur: 0.5, type: 'sawtooth', gain: 0.035, glide: 130 });
  },
  clawAscend() {
    tone({ freq: 150, dur: 0.42, type: 'sawtooth', gain: 0.035, glide: 360 });
  },
  clawOpen() {
    tone({ freq: 760, dur: 0.05, type: 'square', gain: 0.035 });
    tone({ freq: 560, dur: 0.06, type: 'square', gain: 0.03, delay: 0.05 });
  },
  clawSlip() {
    tone({ freq: 520, dur: 0.22, type: 'sawtooth', gain: 0.05, glide: 160 });
    tone({ freq: 95, dur: 0.14, type: 'sine', gain: 0.09, delay: 0.16, glide: 45 });
  },
  clawThud() {
    tone({ freq: 95, dur: 0.14, type: 'sine', gain: 0.08, glide: 48 });
  },
};
