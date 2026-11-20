// Solmar Bay — synthesized audio.
//
// No audio files: every sound is a WebAudio oscillator, and the
// radio is a 32-step sequencer that plays original synth songs
// (nothing copyrighted). In Node (no AudioContext) every method
// is a safe no-op, so headless tests can call the audio system
// without crashing.

import { STATIONS, SONG_STEPS } from './config.js';

const NOTE_FREQ = [261.63, 293.66, 329.63, 349.23, 392.0, 440.0, 493.88, 523.25, 587.33, 659.25];

export function createAudio() {
  const a = {
    ctx: null,
    master: null,
    muted: false,
    started: false,
    // Lazily create the context on the first user gesture.
    ensure: function () {
      if (typeof window === 'undefined' || typeof window.AudioContext === 'undefined') return null;
      if (!a.ctx) {
        a.ctx = new window.AudioContext();
        a.master = a.ctx.createGain();
        a.master.gain.value = a.muted ? 0 : 0.5;
        a.master.connect(a.ctx.destination);
      }
      if (a.ctx.state === 'suspended') a.ctx.resume();
      return a.ctx;
    },
    // One short beep: {freq, dur, type, vol}.
    beep: function (freq, dur, type, vol) {
      const ctx = a.ensure();
      if (!ctx) return;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = type || 'square';
      o.frequency.value = freq || 440;
      g.gain.value = vol || 0.15;
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + (dur || 0.15));
      o.connect(g);
      g.connect(a.master);
      o.start();
      o.stop(ctx.currentTime + (dur || 0.15));
    },
    // A named one-shot effect.
    sfx: function (name) {
      if (a.muted) return;
      switch (name) {
        case 'shoot':
          a.beep(180, 0.08, 'square', 0.25);
          break;
        case 'punch':
          a.beep(120, 0.1, 'sawtooth', 0.2);
          break;
        case 'explosion':
          a.beep(60, 0.5, 'sawtooth', 0.4);
          break;
        case 'pickup':
          a.beep(880, 0.12, 'sine', 0.2);
          break;
        case 'mission':
          a.beep(523.25, 0.15, 'sine', 0.2);
          setTimeout(() => a.beep(659.25, 0.15, 'sine', 0.2), 150);
          setTimeout(() => a.beep(783.99, 0.3, 'sine', 0.2), 300);
          break;
        case 'siren':
          a.beep(700, 0.4, 'sine', 0.1);
          break;
        case 'phone':
          a.beep(1200, 0.1, 'sine', 0.15);
          break;
        case 'cash':
          a.beep(1046.5, 0.1, 'sine', 0.2);
          break;
        case 'error':
          a.beep(140, 0.2, 'square', 0.15);
          break;
        default:
          a.beep(440, 0.1, 'sine', 0.1);
      }
    },
    // Engine hum: a low oscillator whose pitch follows speed.
    engine: function (speed) {
      const ctx = a.ensure();
      if (!ctx) return;
      if (!a._engine) {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = 'sawtooth';
        o.frequency.value = 60;
        g.gain.value = 0;
        o.connect(g);
        g.connect(a.master);
        o.start();
        a._engine = { o, g };
      }
      a._engine.o.frequency.value = 50 + Math.abs(speed) * 4;
      a._engine.g.gain.value = a.muted ? 0 : Math.min(0.12, Math.abs(speed) * 0.004);
    },
    // Radio: advance the 32-step sequencer for the current song.
    // Called once per beat from main.js.
    radioStep: function (stationIdx, songIdx, step) {
      if (a.muted) return;
      const st = STATIONS[stationIdx];
      if (!st) return;
      const song = st.songs[songIdx % st.songs.length];
      if (!song) return;
      const note = song.notes[step % song.notes.length];
      const freq = NOTE_FREQ[note % NOTE_FREQ.length];
      // Bass on every 4th step, melody on the rest.
      if (step % 4 === 0) {
        a.beep(freq / 2, 0.22, 'triangle', 0.18);
      } else if (step % 2 === 0) {
        a.beep(freq, 0.12, 'square', 0.08);
      }
    },
    setMuted: function (m) {
      a.muted = m;
      if (a.master) a.master.gain.value = m ? 0 : 0.5;
    },
  };
  return a;
}

// Human-readable radio label for the HUD.
export function stationLabel(stationIdx, songIdx) {
  const st = STATIONS[stationIdx];
  if (!st) return 'Radio off';
  const song = st.songs[songIdx % st.songs.length];
  return `${st.name} ${st.freq} — ${song ? song.title : ''}`;
}
