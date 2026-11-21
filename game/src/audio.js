// Solmar Bay — sound: Web Audio beeps in the browser, a safe
// no-op in Node (no AudioContext). The radio is a tiny synth
// sequencer: each song is 8 notes, stepped at 4 Hz.

import { STATIONS, SONG_STEPS } from './config.js';

export { STATIONS, SONG_STEPS };

export function stationLabel(station, song) {
  const st = STATIONS[station];
  if (!st) return 'Radio off';
  const s = st.songs[song] || st.songs[0];
  return `${st.name} ${st.freq} — ${s.title}`;
}

export function createAudio() {
  let ctx = null;
  try {
    if (typeof globalThis !== 'undefined' && globalThis.AudioContext) {
      ctx = new globalThis.AudioContext();
    } else if (typeof globalThis !== 'undefined' && globalThis.webkitAudioContext) {
      ctx = new globalThis.webkitAudioContext();
    }
  } catch (e) {
    ctx = null;
  }
  const audio = {
    ctx,
    muted: false,
    _engineOsc: null,

    setMuted(m) {
      this.muted = !!m;
      if (this._engineOsc) {
        try { this._engineOsc.disconnect(); } catch (e) { /* already stopped */ }
        this._engineOsc = null;
      }
    },

    beep(freq, dur, type, vol) {
      if (this.muted || !this.ctx) return;
      try {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = type || 'sine';
        osc.frequency.value = freq || 440;
        gain.gain.value = vol || 0.15;
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + (dur || 0.1));
      } catch (e) { /* audio is best-effort */ }
    },

    sfx(name) {
      if (this.muted || !this.ctx) return;
      const map = {
        shoot: [880, 0.08, 'square', 0.2],
        punch: [160, 0.1, 'square', 0.25],
        pickup: [660, 0.12, 'sine', 0.2],
        explosion: [60, 0.4, 'sawtooth', 0.3],
        engine: [120, 0.2, 'sawtooth', 0.1],
        click: [440, 0.05, 'sine', 0.15],
      };
      const spec = map[name];
      if (spec) this.beep(spec[0], spec[1], spec[2], spec[3]);
    },

    radioStep(station, song, step) {
      if (this.muted || !this.ctx) return;
      const st = STATIONS[station];
      if (!st) return;
      const s = st.songs[song] || st.songs[0];
      const note = s.notes[step % s.notes.length];
      if (note) this.beep(note, 0.22, 'triangle', 0.08);
    },

    engine(speed) {
      if (this.muted || !this.ctx) return;
      try {
        if (!this._engineOsc) {
          this._engineOsc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          gain.gain.value = 0.04;
          this._engineOsc.type = 'sawtooth';
          this._engineOsc.connect(gain);
          gain.connect(this.ctx.destination);
          this._engineOsc.start();
        }
        this._engineOsc.frequency.value = 60 + Math.abs(speed) * 4;
      } catch (e) { /* audio is best-effort */ }
    },
  };
  return audio;
}
