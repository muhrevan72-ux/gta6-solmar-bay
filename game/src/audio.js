// Solmar Bay — WebAudio synth sound.
//
// No audio files: engine hum, sirens, pickup blips, punch thuds,
// mission jingles and 4 radio stations of original synth songs
// are all generated with WebAudio oscillators. In Node (no
// AudioContext) every method is a silent no-op, so headless tests
// can call the audio system freely.

import { STATIONS, SONG_STEPS } from './config.js';

// Note frequencies for the radio sequencer (A minor pentatonic).
const SCALE = [220, 261.63, 293.66, 329.63, 392, 440, 523.25, 587.33, 659.25, 698.46];

export function createAudio(game) {
  const audio = {
    game,
    ctx: null,
    master: null,
    engineOsc: null,
    engineGain: null,
    sirenOsc: null,
    sirenGain: null,
    radioTimer: 0,
    started: false,
  };

  audio.ensure = function () {
    if (audio.ctx || typeof window === 'undefined') return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      audio.ctx = new AC();
      audio.master = audio.ctx.createGain();
      audio.master.gain.value = game.muted ? 0 : 0.5;
      audio.master.connect(audio.ctx.destination);
      // Engine hum: low sawtooth, pitch follows speed.
      audio.engineOsc = audio.ctx.createOscillator();
      audio.engineOsc.type = 'sawtooth';
      audio.engineOsc.frequency.value = 60;
      audio.engineGain = audio.ctx.createGain();
      audio.engineGain.gain.value = 0;
      audio.engineOsc.connect(audio.engineGain);
      audio.engineGain.connect(audio.master);
      audio.engineOsc.start();
      // Police siren: two-tone triangle, quiet until wanted.
      audio.sirenOsc = audio.ctx.createOscillator();
      audio.sirenOsc.type = 'triangle';
      audio.sirenOsc.frequency.value = 700;
      audio.sirenGain = audio.ctx.createGain();
      audio.sirenGain.gain.value = 0;
      audio.sirenOsc.connect(audio.sirenGain);
      audio.sirenGain.connect(audio.master);
      audio.sirenOsc.start();
      audio.started = true;
    } catch (e) {
      audio.ctx = null;
    }
  };

  audio.blip = function (freq = 880, dur = 0.08, type = 'sine', vol = 0.2) {
    if (!audio.ctx) return;
    const o = audio.ctx.createOscillator();
    const g = audio.ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(vol, audio.ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, audio.ctx.currentTime + dur);
    o.connect(g);
    g.connect(audio.master);
    o.start();
    o.stop(audio.ctx.currentTime + dur);
  };

  audio.jingle = function () {
    if (!audio.ctx) return;
    [523, 659, 784, 1046].forEach((f, i) => {
      setTimeout(() => audio.blip(f, 0.18, 'triangle', 0.25), i * 110);
    });
  };

  audio.thud = function () {
    audio.blip(120, 0.12, 'square', 0.3);
  };

  audio.siren = function (on) {
    if (!audio.ctx) return;
    audio.sirenGain.gain.value = on && !game.muted ? 0.05 : 0;
  };

  // Radio: 8th-note sequencer. One step every 0.22 s; the song
  // pattern repeats every 8 notes, the song changes every 32 steps.
  audio.stepRadio = function (dt) {
    if (!audio.ctx || game.muted) return;
    audio.radioTimer += dt;
    const stepDur = 0.22;
    while (audio.radioTimer >= stepDur) {
      audio.radioTimer -= stepDur;
      const st = STATIONS[game.station];
      const song = st.songs[game.song];
      const note = song.notes[game.songStep % 8];
      if (note > 0) audio.blip(SCALE[note % SCALE.length], 0.2, 'square', 0.06);
      game.songStep += 1;
      if (game.songStep >= SONG_STEPS) {
        game.songStep = 0;
        game.song = (game.song + 1) % st.songs.length;
      }
    }
  };

  audio.nextStation = function () {
    game.station = (game.station + 1) % STATIONS.length;
    game.song = 0;
    game.songStep = 0;
    return stationLabel(game);
  };

  audio.setMuted = function (m) {
    game.muted = m;
    if (audio.master) audio.master.gain.value = m ? 0 : 0.5;
  };

  // Engine + siren follow the game state each frame.
  audio.update = function (dt) {
    if (!audio.ctx) return;
    const speed = game.player.inCar ? Math.abs(game.player.inCar.speed || 0) : 0;
    audio.engineGain.gain.value = game.player.inCar && !game.muted ? 0.04 + speed * 0.002 : 0;
    audio.engineOsc.frequency.value = 50 + speed * 4;
    audio.siren(game.wanted > 0);
    if (audio.sirenGain.gain.value > 0) {
      audio.sirenOsc.frequency.value = 650 + Math.sin(game.time * 6) * 150;
    }
    audio.stepRadio(dt);
  };

  return audio;
}

export function stationLabel(game) {
  const st = STATIONS[game.station];
  return `${st.name} ${st.freq} — ${st.songs[game.song].title}`;
}

export function currentSong(game) {
  const st = STATIONS[game.station];
  return st.songs[game.song].title;
}
