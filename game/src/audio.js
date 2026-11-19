// Solmar Bay — WebAudio synth sound only (no audio files).
// Node-safe: every method no-ops when there is no AudioContext.

// Radio stations with ORIGINAL synth tracks (nothing copyrighted,
// nothing from the leaders' games). Each song is a small pattern of
// scale degrees over a root note; the sequencer below plays it.
export const STATIONS = [
  {
    name: 'BAY FM', freq: '94.7', genre: 'Sunset Drive',
    songs: [
      { title: 'Golden Hour', artist: 'Marina Lights', root: 110, scale: [0, 3, 5, 7, 10], pattern: [0, 2, 4, 3, 2, 0, 1, 2], bpm: 96 },
      { title: 'Coastal Cruise', artist: 'The Palms', root: 98, scale: [0, 2, 4, 7, 9], pattern: [0, 1, 2, 4, 3, 2, 1, 0], bpm: 104 },
    ],
  },
  {
    name: 'PALM 102.3', freq: '102.3', genre: 'Tropical House',
    songs: [
      { title: 'Coconut Sky', artist: 'DJ Frond', root: 130.8, scale: [0, 2, 4, 7, 9], pattern: [0, 2, 1, 4, 2, 0, 3, 1], bpm: 112 },
      { title: 'Beachcomber', artist: 'The Palms', root: 123.5, scale: [0, 3, 5, 7, 10], pattern: [0, 1, 3, 2, 4, 3, 1, 0], bpm: 108 },
    ],
  },
  {
    name: 'NEON 89.1', freq: '89.1', genre: 'Electro',
    songs: [
      { title: 'Midnight Grid', artist: 'Volt Avenue', root: 87.3, scale: [0, 2, 3, 7, 8], pattern: [0, 0, 2, 0, 3, 0, 2, 4], bpm: 122 },
      { title: 'Chrome Rain', artist: 'Volt Avenue', root: 92.5, scale: [0, 2, 3, 7, 10], pattern: [0, 3, 2, 1, 0, 1, 2, 3], bpm: 118 },
    ],
  },
  {
    name: 'CORAL 105.5', freq: '105.5', genre: 'Chill',
    songs: [
      { title: 'Slow Tide', artist: 'Marina Lights', root: 146.8, scale: [0, 2, 4, 7, 9], pattern: [0, 4, 2, 1, 0, 2, 3, 4], bpm: 80 },
      { title: 'Harbour Lights', artist: 'DJ Frond', root: 138.6, scale: [0, 3, 5, 7, 10], pattern: [0, 2, 3, 4, 3, 2, 1, 2], bpm: 84 },
    ],
  },
];

// A song is 32 sequencer steps (4 bars of 8th notes); then the next
// song on the station starts.
export const SONG_STEPS = 32;

export function createAudio() {
  const audio = {
    ctx: null,
    muted: false,
    engineOsc: null,
    engineGain: null,
    musicT: 0,
    sirenOn: false,
    station: 0, // index into STATIONS
    songIdx: 0,
    step: 0, // sequencer step within the song (0..31)
    stepT: 0, // seconds into the current step
  };

  // The station + song currently playing (for the HUD).
  audio.currentSong = () => {
    const st = STATIONS[audio.station];
    return { station: st.name, freq: st.freq, genre: st.genre, song: st.songs[audio.songIdx] };
  };

  // R: change station (wired in main.js). Returns the new station
  // so the caller can show a toast.
  audio.nextStation = () => {
    audio.station = (audio.station + 1) % STATIONS.length;
    audio.songIdx = 0;
    audio.step = 0;
    audio.stepT = 0;
    return audio.currentSong();
  };

  audio.ensure = () => {
    if (audio.ctx || typeof AudioContext === 'undefined') return;
    try {
      audio.ctx = new AudioContext();
      const gain = audio.ctx.createGain();
      gain.gain.value = 0.05;
      gain.connect(audio.ctx.destination);
      audio.master = gain;
    } catch (e) {
      audio.ctx = null;
    }
  };

  function tone(freq, dur, type, vol, slideTo) {
    if (!audio.ctx || audio.muted) return;
    try {
      const t = audio.ctx.currentTime;
      const osc = audio.ctx.createOscillator();
      const g = audio.ctx.createGain();
      osc.type = type || 'square';
      osc.frequency.setValueAtTime(freq, t);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
      g.gain.setValueAtTime(vol || 0.15, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      osc.connect(g);
      g.connect(audio.master);
      osc.start(t);
      osc.stop(t + dur + 0.02);
    } catch (e) {
      // audio is best-effort
    }
  }

  audio.play = (name) => {
    if (!audio.ctx || audio.muted) return;
    switch (name) {
      case 'pickup': tone(880, 0.12, 'sine', 0.2, 1320); break;
      case 'punch': tone(140, 0.12, 'sawtooth', 0.25, 70); break;
      case 'shoot': tone(1200, 0.08, 'square', 0.18, 300); break;
      case 'throw': tone(500, 0.15, 'sine', 0.15, 900); break;
      case 'explosion': tone(90, 0.7, 'sawtooth', 0.3, 30); break;
      case 'steal': tone(300, 0.2, 'square', 0.15, 600); break;
      case 'win': tone(523, 0.15, 'sine', 0.2); setTimeout(() => tone(659, 0.15, 'sine', 0.2), 120); setTimeout(() => tone(784, 0.3, 'sine', 0.2), 240); break;
      case 'mission': tone(440, 0.15, 'sine', 0.2); setTimeout(() => tone(587, 0.25, 'sine', 0.2), 140); break;
      case 'busted': tone(220, 0.4, 'sawtooth', 0.25, 110); break;
      case 'respawn': tone(330, 0.2, 'sine', 0.2, 660); break;
      case 'siren': tone(700, 0.5, 'sine', 0.1, 1000); break;
      default: tone(440, 0.1, 'sine', 0.12); break;
    }
  };

  // Engine hum by speed: called every frame with the driven speed.
  audio.engine = (speed) => {
    if (!audio.ctx || audio.muted) return;
    try {
      if (!audio.engineOsc) {
        audio.engineOsc = audio.ctx.createOscillator();
        audio.engineGain = audio.ctx.createGain();
        audio.engineOsc.type = 'sawtooth';
        audio.engineOsc.frequency.value = 60;
        audio.engineGain.gain.value = 0;
        audio.engineOsc.connect(audio.engineGain);
        audio.engineGain.connect(audio.master);
        audio.engineOsc.start();
      }
      const target = speed > 0.5 ? 0.03 + Math.min(0.05, speed * 0.001) : 0;
      audio.engineGain.gain.setTargetAtTime(target, audio.ctx.currentTime, 0.1);
      audio.engineOsc.frequency.setTargetAtTime(55 + speed * 3, audio.ctx.currentTime, 0.1);
    } catch (e) {
      // best-effort
    }
  };

  // Radio sequencer: plays the current station's song as 8th-note
  // steps (a lead note from the song's pattern + a bass note on the
  // beat). The step counter advances even with no AudioContext —
  // only tone() is ctx-guarded — so headless tests can verify the
  // sequencer runs and songs change.
  audio.music = (dt) => {
    const now = audio.currentSong();
    const song = now.song;
    const stepDur = 60 / song.bpm / 2;
    audio.stepT += dt;
    if (audio.stepT < stepDur) return;
    audio.stepT -= stepDur;
    audio.step += 1;
    if (audio.step >= SONG_STEPS) {
      audio.step = 0;
      audio.songIdx = (audio.songIdx + 1) % STATIONS[audio.station].songs.length;
      return;
    }
    if (!audio.ctx || audio.muted) return;
    const degree = song.pattern[audio.step % song.pattern.length];
    const semis = song.scale[degree % song.scale.length];
    const freq = song.root * Math.pow(2, semis / 12) * 2;
    tone(freq, stepDur * 0.9, 'triangle', 0.07);
    if (audio.step % 4 === 0) tone(song.root, stepDur * 1.8, 'triangle', 0.06);
  };

  return audio;
}
