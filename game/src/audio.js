// Solmar Bay — sound.
//
// A tiny WebAudio synth: bleeps for UI and combat, a step sequencer for
// the radio, and an engine hum that follows the car's speed. Everything
// is guarded, so in Node (no AudioContext) every call is a safe no-op.

import { STATIONS } from './config.js';

export function stationLabel(station, song) {
  const st = STATIONS[station];
  if (!st) return 'Radio off';
  const s = st.songs[song];
  if (!s) return 'Radio off';
  return `${st.name} ${st.freq} — ${s.title}`;
}

export function createAudio() {
  const audio = {
    muted: false,
    _ctx: null,
    _engineOsc: null,
    _engineGain: null,

    _context() {
      if (this.muted) return null;
      if (typeof globalThis === 'undefined') return null;
      const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
      if (!AC) return null;
      if (!this._ctx) {
        try {
          this._ctx = new AC();
        } catch {
          return null;
        }
      }
      if (this._ctx.state === 'suspended') {
        this._ctx.resume().catch(() => {});
      }
      return this._ctx;
    },

    setMuted(m) {
      this.muted = !!m;
      if (this.muted && this._engineGain) {
        try { this._engineGain.gain.value = 0; } catch { /* no-op */ }
      }
    },

    beep(freq, dur = 0.1, type = 'sine', vol = 0.15) {
      const ctx = this._context();
      if (!ctx) return;
      try {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = type;
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(vol, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + dur);
      } catch { /* audio is best-effort */ }
    },

    sfx(name) {
      if (this.muted) return;
      switch (name) {
        case 'shoot': this.beep(880, 0.08, 'square', 0.2); break;
        case 'punch': this.beep(140, 0.1, 'sawtooth', 0.2); break;
        case 'explosion': this.beep(60, 0.5, 'sawtooth', 0.3); break;
        case 'pickup': this.beep(660, 0.08, 'sine', 0.15); this.beep(990, 0.12, 'sine', 0.12); break;
        case 'phone': this.beep(1200, 0.15, 'sine', 0.12); break;
        case 'siren': this.beep(700, 0.2, 'triangle', 0.1); break;
        case 'cash': this.beep(1320, 0.1, 'sine', 0.15); break;
        case 'error': this.beep(180, 0.2, 'square', 0.12); break;
        case 'success': this.beep(523, 0.1, 'sine', 0.15); this.beep(784, 0.15, 'sine', 0.15); break;
        default: this.beep(440, 0.08, 'sine', 0.1); break;
      }
    },

    // One sequencer step of a radio song: the song's 8 notes cycle
    // across the 32 steps.
    radioStep(station, song, step) {
      const ctx = this._context();
      if (!ctx) return;
      const st = STATIONS[station];
      if (!st) return;
      const s = st.songs[song];
      if (!s || !s.notes || !s.notes.length) return;
      const note = s.notes[step % s.notes.length];
      const freq = 220 * Math.pow(2, note / 12);
      this.beep(freq, 0.22, 'triangle', 0.06);
    },

    // A low hum whose pitch follows the car's speed.
    engine(speed) {
      const ctx = this._context();
      if (!ctx) return;
      try {
        if (!this._engineOsc) {
          this._engineOsc = ctx.createOscillator();
          this._engineGain = ctx.createGain();
          this._engineOsc.type = 'sawtooth';
          this._engineOsc.frequency.value = 50;
          this._engineGain.gain.value = 0;
          this._engineOsc.connect(this._engineGain);
          this._engineGain.connect(ctx.destination);
          this._engineOsc.start();
        }
        const target = speed > 0.5 ? 0.03 : 0;
        this._engineOsc.frequency.value = 50 + Math.min(speed, 40) * 3;
        this._engineGain.gain.value = target;
      } catch { /* best-effort */ }
    },
  };
  return audio;
}
