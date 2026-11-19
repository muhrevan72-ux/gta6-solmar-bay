// Solmar Bay — WebAudio synth sound only (no audio files).
// Node-safe: every method no-ops when there is no AudioContext.

export function createAudio() {
  const audio = {
    ctx: null,
    muted: false,
    engineOsc: null,
    engineGain: null,
    musicT: 0,
    sirenOn: false,
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

  // Simple ambient bass loop: a note every beat.
  audio.music = (dt) => {
    if (!audio.ctx || audio.muted) return;
    audio.musicT += dt;
    if (audio.musicT > 0.5) {
      audio.musicT = 0;
      const notes = [55, 55, 65.4, 49];
      const n = notes[Math.floor(Math.random() * notes.length)];
      tone(n, 0.4, 'triangle', 0.06);
    }
  };

  return audio;
}
