// Solmar Bay — procedural audio (Web Audio synth, safe no-op in Node).
// Written fresh for rebuild #18. Radio stations are defined in
// config.js; this module labels them and plays the sequencer.

import { STATIONS } from './config.js';

export function stationLabel(station, song) {
  const s = STATIONS[station];
  if (!s) return 'Radio off';
  const sg = s.songs[song] || s.songs[0];
  return `${s.name} ${s.freq} — ${sg.title}`;
}

export function createAudio() {
  const audio = {
    ctx: null,
    muted: false,
    _osc: null,
    _ensure() {
      if (audio.ctx) return audio.ctx;
      try {
        const AC = (typeof globalThis !== 'undefined' && (globalThis.AudioContext || globalThis.webkitAudioContext)) || null;
        if (!AC) return null;
        audio.ctx = new AC();
      } catch (e) {
        audio.ctx = null;
      }
      return audio.ctx;
    },
    setMuted(m) {
      audio.muted = !!m;
      if (audio.ctx && audio.ctx.suspend && audio.ctx.resume) {
        if (audio.muted) audio.ctx.suspend();
        else audio.ctx.resume();
      }
    },
    beep(freq, dur, type, vol) {
      if (audio.muted) return;
      const ctx = audio._ensure();
      if (!ctx) return;
      try {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = type || 'sine';
        o.frequency.value = freq || 440;
        g.gain.value = vol || 0.08;
        o.connect(g);
        g.connect(ctx.destination);
        o.start();
        o.stop(ctx.currentTime + (dur || 0.1));
      } catch (e) { /* audio is best-effort */ }
    },
    sfx(name) {
      if (audio.muted) return;
      const map = {
        shoot: [880, 0.08, 'square', 0.12],
        punch: [160, 0.1, 'sawtooth', 0.12],
        cash: [1320, 0.12, 'sine', 0.1],
        pickup: [660, 0.1, 'sine', 0.1],
        bust: [220, 0.4, 'sawtooth', 0.12],
        click: [440, 0.05, 'sine', 0.06],
        horn: [330, 0.25, 'square', 0.1],
      };
      const p = map[name] || map.click;
      audio.beep(p[0], p[1], p[2], p[3]);
    },
    // One sequencer step: play the note for this station/song/step.
    radioStep(station, song, step) {
      if (audio.muted) return;
      const s = STATIONS[station];
      if (!s) return;
      const sg = s.songs[song] || s.songs[0];
      if (!sg || !sg.notes) return;
      const note = sg.notes[step % sg.notes.length];
      const freq = 220 * Math.pow(2, note / 12);
      audio.beep(freq, 0.22, 'triangle', 0.05);
    },
    engine(on, speed) {
      if (audio.muted) return;
      const ctx = audio._ensure();
      if (!ctx) return;
      try {
        if (on && !audio._osc) {
          const o = ctx.createOscillator();
          const g = ctx.createGain();
          o.type = 'sawtooth';
          o.frequency.value = 60;
          g.gain.value = 0.03;
          o.connect(g);
          g.connect(ctx.destination);
          o.start();
          audio._osc = o;
          audio._oscGain = g;
        } else if (!on && audio._osc) {
          audio._osc.stop();
          audio._osc = null;
        }
        if (audio._osc) {
          audio._osc.frequency.value = 60 + (speed || 0) * 4;
        }
      } catch (e) { /* best-effort */ }
    },
  };
  return audio;
}
