// Solmar Bay — WebAudio synth sound: engine hum, siren, gunshots,
// explosion, pickup blips, mission jingle, ambient bass loop.
// No audio files. The context starts on the first user gesture.

export function createAudio() {
  const audio = {
    ctx: null,
    master: null,
    muted: false,
    engineOsc: null,
    engineGain: null,
    sirenOsc: null,
    sirenLfo: null,
    sirenGain: null,
    bassTimer: null,
    bassStep: 0,

    ensure() {
      if (audio.ctx) {
        if (audio.ctx.state === 'suspended') audio.ctx.resume();
        return true;
      }
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        audio.ctx = new AC();
        audio.master = audio.ctx.createGain();
        audio.master.gain.value = 0.5;
        audio.master.connect(audio.ctx.destination);
      } catch (e) {
        audio.ctx = null;
      }
      return !!audio.ctx;
    },

    setMuted(m) {
      audio.muted = m;
      if (audio.master) audio.master.gain.value = m ? 0 : 0.5;
    },

    // short sine blip
    blip(freq, dur = 0.1, type = 'sine', vol = 0.25) {
      if (!audio.ensure() || audio.muted) return;
      const t = audio.ctx.currentTime;
      const o = audio.ctx.createOscillator();
      const g = audio.ctx.createGain();
      o.type = type;
      o.frequency.value = freq;
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.connect(g); g.connect(audio.master);
      o.start(t); o.stop(t + dur + 0.02);
    },

    thud() {
      if (!audio.ensure() || audio.muted) return;
      const t = audio.ctx.currentTime;
      const o = audio.ctx.createOscillator();
      const g = audio.ctx.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(120, t);
      o.frequency.exponentialRampToValueAtTime(45, t + 0.15);
      g.gain.setValueAtTime(0.5, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
      o.connect(g); g.connect(audio.master);
      o.start(t); o.stop(t + 0.2);
    },

    shot(weapon) {
      if (!audio.ensure() || audio.muted) return;
      const t = audio.ctx.currentTime;
      const dur = weapon === 'shotgun' ? 0.22 : 0.09;
      const buf = audio.ctx.createBuffer(1, audio.ctx.sampleRate * dur, audio.ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < data.length; i++) {
        data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
      }
      const src = audio.ctx.createBufferSource();
      src.buffer = buf;
      const f = audio.ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = weapon === 'shotgun' ? 900 : 2400;
      const g = audio.ctx.createGain();
      g.gain.value = weapon === 'shotgun' ? 0.5 : 0.32;
      src.connect(f); f.connect(g); g.connect(audio.master);
      src.start(t);
    },

    explosion() {
      if (!audio.ensure() || audio.muted) return;
      const t = audio.ctx.currentTime;
      const dur = 0.7;
      const buf = audio.ctx.createBuffer(1, audio.ctx.sampleRate * dur, audio.ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < data.length; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 2);
      }
      const src = audio.ctx.createBufferSource();
      src.buffer = buf;
      const f = audio.ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.setValueAtTime(800, t);
      f.frequency.exponentialRampToValueAtTime(90, t + dur);
      const g = audio.ctx.createGain();
      g.gain.setValueAtTime(0.7, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      src.connect(f); f.connect(g); g.connect(audio.master);
      src.start(t);
      // low boom underneath
      const o = audio.ctx.createOscillator();
      const og = audio.ctx.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(90, t);
      o.frequency.exponentialRampToValueAtTime(35, t + 0.5);
      og.gain.setValueAtTime(0.6, t);
      og.gain.exponentialRampToValueAtTime(0.001, t + 0.55);
      o.connect(og); og.connect(audio.master);
      o.start(t); o.stop(t + 0.6);
    },

    jingle() {
      if (!audio.ensure() || audio.muted) return;
      const notes = [523, 659, 784, 1047];
      notes.forEach((f, i) => {
        setTimeout(() => audio.blip(f, 0.22, 'triangle', 0.3), i * 110);
      });
    },

    engineStart() {
      if (!audio.ensure() || audio.muted) return;
      if (audio.engineOsc) return;
      const o = audio.ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = 55;
      const f = audio.ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = 420;
      const g = audio.ctx.createGain();
      g.gain.value = 0.0;
      o.connect(f); f.connect(g); g.connect(audio.master);
      o.start();
      audio.engineOsc = o;
      audio.engineGain = g;
    },

    setEngine(speed, maxSpeed) {
      if (!audio.engineOsc || audio.muted) return;
      const t = audio.ctx.currentTime;
      const ratio = Math.min(1, Math.abs(speed) / (maxSpeed || 38));
      audio.engineOsc.frequency.setTargetAtTime(50 + ratio * 130, t, 0.08);
      audio.engineGain.gain.setTargetAtTime(0.05 + ratio * 0.06, t, 0.1);
    },

    engineStop() {
      if (!audio.engineOsc) return;
      try { audio.engineOsc.stop(); } catch (e) { /* already stopped */ }
      audio.engineOsc = null;
      audio.engineGain = null;
    },

    sirenStart() {
      if (!audio.ensure() || audio.muted) return;
      if (audio.sirenOsc) return;
      const o = audio.ctx.createOscillator();
      o.type = 'triangle';
      o.frequency.value = 750;
      const lfo = audio.ctx.createOscillator();
      lfo.type = 'square';
      lfo.frequency.value = 0.9;
      const lg = audio.ctx.createGain();
      lg.gain.value = 220;
      lfo.connect(lg); lg.connect(o.frequency);
      const g = audio.ctx.createGain();
      g.gain.value = 0.05;
      o.connect(g); g.connect(audio.master);
      o.start(); lfo.start();
      audio.sirenOsc = o;
      audio.sirenLfo = lfo;
      audio.sirenGain = g;
    },

    sirenStop() {
      if (!audio.sirenOsc) return;
      try { audio.sirenOsc.stop(); audio.sirenLfo.stop(); } catch (e) { /* already stopped */ }
      audio.sirenOsc = null;
      audio.sirenLfo = null;
      audio.sirenGain = null;
    },

    sirenBlip() {
      audio.blip(880, 0.09, 'square', 0.15);
      setTimeout(() => audio.blip(660, 0.09, 'square', 0.15), 110);
    },

    startBass() {
      if (!audio.ensure() || audio.bassTimer) return;
      const line = [55, 0, 55, 65.41, 55, 0, 82.41, 73.42];
      audio.bassTimer = setInterval(() => {
        if (audio.muted) return;
        const f = line[audio.bassStep % line.length];
        audio.bassStep++;
        if (f) audio.blip(f, 0.22, 'triangle', 0.12);
      }, 300);
    },

    stopBass() {
      if (audio.bassTimer) {
        clearInterval(audio.bassTimer);
        audio.bassTimer = null;
      }
    },
  };
  return audio;
}
