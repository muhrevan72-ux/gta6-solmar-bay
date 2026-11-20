// Solmar Bay — audio (rebuild #15).
// A safe no-op in Node (no AudioContext): every method exists and
// does nothing, so logic tests can call them freely. In the
// browser, a tiny WebAudio synth plays bleeps, the radio melody
// and the engine hum.

import { STATIONS } from './config.js';

export function stationLabel(station, song) {
  const st = STATIONS[station];
  if (!st) return 'Radio off';
  const s = st.songs[song % st.songs.length];
  const title = s && s.title ? s.title : s;
  return `${st.name} ${st.freq} — ${title}`;
}

export function createAudio() {
  const a = {
    muted: false,
    _ctx: null,
    _ensure() {
      if (typeof window !== 'undefined' && window.AudioContext && !this._ctx) {
        try { this._ctx = new window.AudioContext(); } catch (e) { this._ctx = null; }
      }
      return this._ctx;
    },
    sfx(name) {
      const ctx = this._ensure();
      if (!ctx || this.muted) return;
      try {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        const freq = name === 'explosion' ? 60 : name === 'shoot' ? 900 : 440;
        o.frequency.value = freq;
        o.type = name === 'explosion' ? 'sawtooth' : 'square';
        g.gain.setValueAtTime(0.08, ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
        o.connect(g).connect(ctx.destination);
        o.start();
        o.stop(ctx.currentTime + 0.15);
      } catch (e) { /* audio is best-effort */ }
    },
    beep(freq, dur, type, vol) {
      const ctx = this._ensure();
      if (!ctx || this.muted) return;
      try {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.frequency.value = freq;
        o.type = type || 'sine';
        g.gain.setValueAtTime(vol || 0.05, ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + (dur || 0.1));
        o.connect(g).connect(ctx.destination);
        o.start();
        o.stop(ctx.currentTime + (dur || 0.1));
      } catch (e) { /* audio is best-effort */ }
    },
    radioStep(station, song, step) {
      if (this.muted) return;
      const st = STATIONS[station];
      if (!st) return;
      const s = st.songs[song % st.songs.length];
      if (!s) return;
      const notes = s.notes;
      if (!notes) return;
      const n = notes[step % notes.length];
      if (n) this.beep(220 + n * 40, 0.22, 'triangle', 0.03);
    },
    engine(speed) {
      if (this.muted) return;
      // The engine hum is a low continuous tone in the browser;
      // in Node this is a no-op (no AudioContext).
      const ctx = this._ensure();
      if (!ctx) return;
    },
    setMuted(m) {
      this.muted = !!m;
    },
  };
  return a;
}
