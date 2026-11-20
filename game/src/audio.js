// Solmar Bay — WebAudio synth sound + the radio.
//
// No audio files: every sound is synthesized (engine hum by speed,
// siren, pickup blip, punch thud, mission jingle, and the radio's
// original sequencer songs). The AudioContext is created lazily on
// the first user gesture, so loading the page never needs audio
// permission; every play function no-ops while the context is null,
// which is also what makes the module headless-testable.

import { STATIONS, SONG_STEPS } from './config.js';

export function createAudio() {
  return {
    ctx: null, // created lazily on first user gesture
    master: null,
    muted: false,
    engineOsc: null,
    engineGain: null,
    sirenOn: false,
    sirenT: 0,
  };
}

// Lazily create (and resume) the audio context. Safe to call often.
export function ensureAudio(audio) {
  if (audio.muted) return null;
  try {
    if (typeof window === 'undefined' || !window.AudioContext) return null;
    if (!audio.ctx) {
      audio.ctx = new window.AudioContext();
      audio.master = audio.ctx.createGain();
      audio.master.gain.value = 0.5;
      audio.master.connect(audio.ctx.destination);
    }
    if (audio.ctx.state === 'suspended') audio.ctx.resume();
    return audio.ctx;
  } catch (e) {
    return null;
  }
}

export function playTone(audio, freq, dur, type, vol, when) {
  const ctx = ensureAudio(audio);
  if (!ctx) return;
  try {
    const t0 = ctx.currentTime + (when || 0);
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type || 'sine';
    osc.frequency.value = freq;
    g.gain.setValueAtTime(vol || 0.2, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(g);
    g.connect(audio.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  } catch (e) { /* audio must never break the game */ }
}

export function playBlip(audio) {
  playTone(audio, 880, 0.08, 'sine', 0.15);
  playTone(audio, 1320, 0.06, 'sine', 0.1, 0.05);
}

export function playThud(audio) {
  playTone(audio, 90, 0.12, 'triangle', 0.3);
}

export function playJingle(audio) {
  const notes = [523, 659, 784, 1047];
  notes.forEach((f, i) => playTone(audio, f, 0.18, 'triangle', 0.2, i * 0.09));
}

export function playSirenBlip(audio) {
  playTone(audio, 700, 0.15, 'square', 0.06);
  playTone(audio, 950, 0.15, 'square', 0.06, 0.15);
}

// Continuous engine hum whose pitch follows the car's speed.
export function engineHum(audio, speedNorm) {
  const ctx = ensureAudio(audio);
  if (!ctx) return;
  try {
    if (!audio.engineOsc) {
      audio.engineOsc = ctx.createOscillator();
      audio.engineGain = ctx.createGain();
      audio.engineOsc.type = 'sawtooth';
      audio.engineOsc.frequency.value = 60;
      audio.engineGain.gain.value = 0;
      audio.engineOsc.connect(audio.engineGain);
      audio.engineGain.connect(audio.master);
      audio.engineOsc.start();
    }
    const target = speedNorm > 0.02 ? 0.05 + speedNorm * 0.06 : 0;
    audio.engineGain.gain.setTargetAtTime(target, ctx.currentTime, 0.1);
    audio.engineOsc.frequency.setTargetAtTime(50 + speedNorm * 160, ctx.currentTime, 0.1);
  } catch (e) { /* never break the game */ }
}

export function setMuted(audio, m) {
  audio.muted = m;
  if (audio.master) audio.master.gain.value = m ? 0 : 0.5;
}

// ---- radio: 4 original stations, 8 original synth songs ----

export function createRadio() {
  return {
    station: 0, // index into STATIONS
    songIdx: 0,
    step: 0, // sequencer step within the song (0..31)
    stepT: 0, // seconds since last step
    stepDur: 0.22, // seconds per 8th-note step
  };
}

export function radioNow(radio) {
  const st = STATIONS[radio.station];
  const song = st.songs[radio.songIdx];
  return { station: st.name, freq: st.freq, genre: st.genre, song: song.title };
}

export function nextStation(radio) {
  radio.station = (radio.station + 1) % STATIONS.length;
  radio.songIdx = 0;
  radio.step = 0;
  radio.stepT = 0;
  return radioNow(radio);
}

// Advance the sequencer; plays the current step's note through the
// synth. Songs rotate on their own when one finishes.
export function advanceRadio(radio, audio, dt) {
  radio.stepT += dt;
  if (radio.stepT < radio.stepDur) return;
  radio.stepT -= radio.stepDur;
  radio.step = (radio.step + 1) % SONG_STEPS;
  if (radio.step === 0) {
    const st = STATIONS[radio.station];
    radio.songIdx = (radio.songIdx + 1) % st.songs.length;
  }
  const st = STATIONS[radio.station];
  const song = st.songs[radio.songIdx];
  const note = song.notes[radio.step % song.notes.length];
  // A minor-pentatonic ladder on A3 (220 Hz).
  const scale = [0, 3, 5, 7, 10, 12, 15, 17, 19, 22, 24];
  const semi = scale[note % scale.length] + 12 * Math.floor(note / scale.length);
  const freq = 220 * Math.pow(2, semi / 12);
  playTone(audio, freq, 0.2, 'triangle', 0.08);
  // Soft bass on the downbeat.
  if (radio.step % 8 === 0) playTone(audio, 110, 0.25, 'sine', 0.12);
}
