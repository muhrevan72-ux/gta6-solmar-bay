// Solmar Bay — audio: synth radio + SFX stubs (rebuild #13).
// Safe no-ops in Node (no AudioContext); the sequencer API is
// what the suites exercise.
import { STATIONS } from './config.js';

export function stationLabel(station, song) {
  const st = STATIONS[station];
  if (!st) return 'Radio off';
  const s = st.songs[song % st.songs.length];
  return `${st.name} ${st.freq} — ${s.title}`;
}

export function createAudio() {
  return {
    muted: false,
    _ctx: null,
    setMuted(m) {
      this.muted = !!m;
    },
    beep(freq, dur, type, vol) {
      // Real browsers: tiny oscillator blip. Node: no-op.
      if (typeof window === 'undefined') return;
      try {
        if (!this._ctx) this._ctx = new (window.AudioContext || window.webkitAudioContext)();
        const o = this._ctx.createOscillator();
        const gn = this._ctx.createGain();
        o.type = type || 'sine';
        o.frequency.value = freq;
        gn.gain.value = this.muted ? 0 : (vol || 0.1);
        o.connect(gn);
        gn.connect(this._ctx.destination);
        o.start();
        o.stop(this._ctx.currentTime + (dur || 0.1));
      } catch (e) { /* audio is best-effort */ }
    },
    sfx(name) {
      if (this.muted) return;
      if (name === 'shoot') this.beep(880, 0.08, 'square', 0.08);
      else if (name === 'explosion') this.beep(90, 0.4, 'sawtooth', 0.15);
      else if (name === 'pickup') this.beep(660, 0.1, 'sine', 0.08);
      else if (name === 'punch') this.beep(200, 0.1, 'square', 0.08);
    },
    radioStep(station, song, step) {
      if (this.muted) return;
      const st = STATIONS[station];
      if (!st) return;
      const s = st.songs[song % st.songs.length];
      const note = s.notes[step % s.notes.length];
      this.beep(note, 0.22, 'triangle', 0.03);
    },
    engine(speed) {
      // Continuous engine hum is browser-only; no-op here.
    },
  };
}
