// Solmar Bay — WebAudio synth: engine hum, sirens, effects, radio.
// All sound is synthesised; there are no audio files. In Node (no
// AudioContext) every method is a safe no-op.

import { STATIONS } from './config.js';

export function stationLabel(station, song) {
  const st = STATIONS[station];
  if (!st) return 'Radio off';
  const s = st.songs[song % st.songs.length];
  return `${st.name} ${st.freq} — ${s.name}`;
}

export function createAudio() {
  const audio = {
    muted: false,
    _ac: null,
    _master: null,
    _engineOsc: null,
    _engineGain: null,
    _ctx() {
      if (typeof window === 'undefined' || !window.AudioContext) return null;
      if (!this._ac) {
        try {
          this._ac = new window.AudioContext();
          this._master = this._ac.createGain();
          this._master.gain.value = 0.5;
          this._master.connect(this._ac.destination);
        } catch (e) {
          return null;
        }
      }
      return this._ac;
    },
    setMuted(m) {
      this.muted = !!m;
      if (this._master) this._master.gain.value = this.muted ? 0 : 0.5;
    },
    beep(freq, dur, type, vol) {
      if (this.muted) return;
      const ctx = this._ctx();
      if (!ctx) return;
      try {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = type || 'sine';
        o.frequency.value = freq;
        g.gain.setValueAtTime(vol || 0.15, ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + (dur || 0.1));
        o.connect(g);
        g.connect(this._master);
        o.start();
        o.stop(ctx.currentTime + (dur || 0.1));
      } catch (e) { /* audio is best-effort */ }
    },
    sfx(name) {
      if (this.muted) return;
      switch (name) {
        case 'shoot': this.beep(180, 0.08, 'square', 0.2); break;
        case 'punch': this.beep(90, 0.12, 'sine', 0.25); break;
        case 'explosion': this.beep(55, 0.5, 'sawtooth', 0.35); break;
        case 'pickup': this.beep(660, 0.1, 'sine', 0.15); this.beep(880, 0.12, 'sine', 0.12); break;
        case 'mission': this.beep(523, 0.15, 'sine', 0.2); this.beep(659, 0.15, 'sine', 0.2); this.beep(784, 0.3, 'sine', 0.2); break;
        case 'siren': this.beep(700, 0.3, 'sine', 0.08); break;
        case 'busted': this.beep(220, 0.4, 'sawtooth', 0.2); break;
        default: this.beep(440, 0.08, 'sine', 0.1); break;
      }
    },
    engine(speed) {
      if (this.muted) return;
      const ctx = this._ctx();
      if (!ctx) return;
      try {
        if (!this._engineOsc) {
          this._engineOsc = ctx.createOscillator();
          this._engineGain = ctx.createGain();
          this._engineOsc.type = 'sawtooth';
          this._engineOsc.frequency.value = 60;
          this._engineGain.gain.value = 0.0;
          this._engineOsc.connect(this._engineGain);
          this._engineGain.connect(this._master);
          this._engineOsc.start();
        }
        const target = Math.min(0.12, 0.02 + Math.abs(speed) * 0.003);
        this._engineGain.gain.value = target;
        this._engineOsc.frequency.value = 60 + Math.abs(speed) * 4;
      } catch (e) { /* best-effort */ }
    },
    radioStep(station, song, step) {
      if (this.muted) return;
      const st = STATIONS[station];
      if (!st) return;
      const s = st.songs[song % st.songs.length];
      if (!s) return;
      const note = s.notes[step % s.notes.length];
      // Only the downbeats sound, so the sequencer is a gentle pulse.
      if (step % 4 === 0) this.beep(note, 0.22, 'triangle', 0.06);
    },
  };
  return audio;
}
