// Solmar Bay — WebAudio synth sound + the radio.
// No audio files: every sound is a small oscillator pattern. All
// audio is guarded — with no AudioContext (headless tests, muted
// browser) the sequencer still advances so tests can verify songs,
// stations and timing, it just makes no noise.

import { STATIONS, SONG_STEPS } from './config.js';

const SCALE = [0, 2, 4, 5, 7, 9, 11, 12]; // major scale steps
const BASE_FREQ = 220;

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

function ensureCtx(audio) {
  if (audio.ctx) return audio.ctx;
  if (typeof window === 'undefined') return null;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  audio.ctx = new AC();
  audio.master = audio.ctx.createGain();
  audio.master.gain.value = audio.muted ? 0 : 0.35;
  audio.master.connect(audio.ctx.destination);
  return audio.ctx;
}

// One short synth blip. Safe to call headless: no-ops without a ctx.
export function playTone(audio, freq, dur, type, vol, when) {
  const ctx = ensureCtx(audio);
  if (!ctx || audio.muted) return;
  const t = ctx.currentTime + (when || 0);
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type || 'sine';
  osc.frequency.value = freq;
  g.gain.setValueAtTime(vol === undefined ? 0.2 : vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  osc.connect(g);
  g.connect(audio.master);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

export function playBlip(audio) {
  playTone(audio, 880, 0.08, 'sine', 0.2);
}
export function playThud(audio) {
  playTone(audio, 90, 0.15, 'square', 0.3);
}
export function playJingle(audio) {
  playTone(audio, 523, 0.12, 'sine', 0.25);
  playTone(audio, 659, 0.12, 'sine', 0.25, 0.12);
  playTone(audio, 784, 0.25, 'sine', 0.25, 0.24);
}
export function playSirenBlip(audio) {
  playTone(audio, 700, 0.18, 'triangle', 0.12);
  playTone(audio, 950, 0.18, 'triangle', 0.12, 0.18);
}

// Engine hum follows the driven car's speed.
export function engineHum(audio, speedNorm) {
  const ctx = ensureCtx(audio);
  if (!ctx || audio.muted) return;
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
  audio.engineOsc.frequency.value = 50 + speedNorm * 140;
  audio.engineGain.gain.value = 0.02 + speedNorm * 0.05;
}

export function setMuted(audio, m) {
  audio.muted = m;
  if (audio.master) audio.master.gain.value = m ? 0 : 0.35;
}

// ---- radio: 4 stations, 8 original synth songs ----
export function createRadio() {
  return {
    station: 0, // index into STATIONS
    songIdx: 0,
    step: 0, // sequencer step within the song (0..31)
    stepT: 0, // seconds since last step
    stepDur: 0.22, // seconds per 8th-note step
  };
}

// The station + song currently playing (for the HUD).
export function radioNow(radio) {
  const st = STATIONS[radio.station];
  return { station: st.name, freq: st.freq, genre: st.genre, song: st.songs[radio.songIdx].title };
}

export function nextStation(radio) {
  radio.station = (radio.station + 1) % STATIONS.length;
  radio.songIdx = 0;
  radio.step = 0;
  radio.stepT = 0;
  return radioNow(radio);
}

// Advance the sequencer. Plays notes when audio exists; advances the
// step counter regardless, so headless tests can verify the song
// moves on and the station changes.
export function advanceRadio(radio, audio, dt) {
  radio.stepT += dt;
  while (radio.stepT >= radio.stepDur) {
    radio.stepT -= radio.stepDur;
    radio.step++;
    const st = STATIONS[radio.station];
    const song = st.songs[radio.songIdx];
    const note = song.notes[radio.step % song.notes.length];
    const freq = BASE_FREQ * Math.pow(2, SCALE[note % SCALE.length] / 12);
    playTone(audio, freq, 0.18, 'triangle', 0.07);
    if (radio.step >= SONG_STEPS) {
      radio.step = 0;
      radio.songIdx = (radio.songIdx + 1) % st.songs.length;
    }
  }
}

export { STATIONS, SONG_STEPS };
