// Solmar Bay — audio.
//
// A tiny WebAudio synth: beeps for the UI, a chiptune radio
// sequencer and an engine hum. In Node there is no AudioContext,
// so every call is a no-op — the suites drive the sequencer
// headlessly without sound.

import { STATIONS, SONG_STEPS } from './config.js';

// 'BAY FM 94.7 — Golden Hour Drive', or 'Radio off' for a bad index.
export function stationLabel(station, song) {
  const st = STATIONS[station];
  if (!st) return 'Radio off';
  const s = st.songs[song || 0];
  if (!s) return 'Radio off';
  return `${st.name} ${st.freq} — ${s.name}`;
}

export function createAudio() {
  const a = {
    muted: false,
    ctx: null,
    _ensure() {
      if (this.ctx) return this.ctx;
      try {
        const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
        if (!AC) return null;
        this.ctx = new AC();
        return this.ctx;
      } catch {
        return null;
      }
    },
    beep(freq, dur, type, vol) {
      const ctx = this._ensure();
      if (!ctx || this.muted) return;
      try {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = type || 'square';
        osc.frequency.value = freq || 440;
        gain.gain.value = vol || 0.05;
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + (dur || 0.1));
      } catch { /* sound is best-effort */ }
    },
    sfx(name) {
      if (this.muted) return;
      if (name === 'shoot') this.beep(220, 0.08, 'square', 0.08);
      else if (name === 'punch') this.beep(120, 0.1, 'sawtooth', 0.08);
      else if (name === 'cash') { this.beep(880, 0.08, 'sine', 0.06); this.beep(1320, 0.12, 'sine', 0.06); }
      else if (name === 'bust') this.beep(180, 0.4, 'sawtooth', 0.08);
      else this.beep(440, 0.08, 'square', 0.05);
    },
    // One sequencer step: play the note for this station/song/step.
    radioStep(station, song, step) {
      if (this.muted) return;
      const st = STATIONS[station];
      if (!st) return;
      const s = st.songs[song || 0];
      if (!s || !s.notes) return;
      const note = s.notes[step % s.notes.length];
      if (note) this.beep(note, 0.22, 'triangle', 0.04);
    },
    // A low engine hum whose pitch follows the speed.
    engine(speed) {
      if (this.muted) return;
      const ctx = this._ensure();
      if (!ctx) return;
      try {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.value = 60 + Math.abs(speed || 0) * 4;
        gain.gain.value = 0.02;
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.1);
      } catch { /* best-effort */ }
    },
    setMuted(m) {
      this.muted = !!m;
    },
  };
  return a;
}
