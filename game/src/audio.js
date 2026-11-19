// Solmar Bay — WebAudio synth sound. No audio files: engine hum,
// siren, pickup blips, punch thuds, gunshots, explosions, mission
// jingles and a simple ambient bass loop. Everything is guarded so
// the module is a no-op in Node (no AudioContext there).

export function createAudio() {
  let ctx = null;
  let muted = false;
  let engineOsc = null;
  let engineGain = null;
  let bassTimer = null;
  let bassStep = 0;

  function ensure() {
    if (ctx) return true;
    try {
      const AC = (typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext)) || null;
      if (!AC) return false;
      ctx = new AC();
      return true;
    } catch (e) {
      return false;
    }
  }

  function tone(freq, dur, type, vol, slideTo) {
    if (!ctx || muted) return;
    try {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = type || 'sine';
      o.frequency.setValueAtTime(freq, ctx.currentTime);
      if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, ctx.currentTime + dur);
      g.gain.setValueAtTime(vol || 0.15, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
      o.connect(g);
      g.connect(ctx.destination);
      o.start();
      o.stop(ctx.currentTime + dur);
    } catch (e) { /* audio is best-effort */ }
  }

  function noise(dur, vol, lowpass) {
    if (!ctx || muted) return;
    try {
      const len = Math.floor(ctx.sampleRate * dur);
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const g = ctx.createGain();
      g.gain.value = vol || 0.2;
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = lowpass || 1200;
      src.connect(f);
      f.connect(g);
      g.connect(ctx.destination);
      src.start();
    } catch (e) { /* best-effort */ }
  }

  return {
    ensure,
    setMuted(m) { muted = m; },
    get muted() { return muted; },
    blip(freq, dur) { tone(freq || 880, dur || 0.08, 'sine', 0.15); },
    thud(freq) { tone(freq || 300, 0.12, 'triangle', 0.25, 90); },
    shot(weapon) {
      if (weapon === 'shotgun') { noise(0.25, 0.35, 900); tone(120, 0.15, 'square', 0.2, 60); }
      else if (weapon === 'smg') { noise(0.08, 0.2, 2000); tone(300, 0.06, 'square', 0.12, 150); }
      else { noise(0.12, 0.25, 1500); tone(220, 0.09, 'square', 0.15, 110); }
    },
    boom() { noise(0.6, 0.5, 500); tone(70, 0.5, 'sine', 0.4, 30); },
    jingle() {
      tone(523, 0.12, 'sine', 0.18);
      setTimeout(() => tone(659, 0.12, 'sine', 0.18), 110);
      setTimeout(() => tone(784, 0.2, 'sine', 0.18), 220);
    },
    siren() { tone(700, 0.4, 'sine', 0.08, 1100); },
    setEngine(speed, max) {
      if (!ctx || muted) return;
      try {
        if (!engineOsc) {
          engineOsc = ctx.createOscillator();
          engineGain = ctx.createGain();
          engineOsc.type = 'sawtooth';
          engineGain.gain.value = 0;
          const f = ctx.createBiquadFilter();
          f.type = 'lowpass';
          f.frequency.value = 500;
          engineOsc.connect(f);
          f.connect(engineGain);
          engineGain.connect(ctx.destination);
          engineOsc.start();
        }
        const frac = Math.min(1, speed / (max || 40));
        engineOsc.frequency.value = 50 + frac * 90;
        engineGain.gain.value = speed > 0.5 ? 0.04 + frac * 0.03 : 0;
      } catch (e) { /* best-effort */ }
    },
    startBass() {
      if (!ctx || bassTimer) return;
      const notes = [55, 55, 65.4, 49];
      bassTimer = setInterval(() => {
        if (muted) return;
        tone(notes[bassStep % notes.length], 0.5, 'triangle', 0.08);
        bassStep += 1;
      }, 500);
    },
  };
}
