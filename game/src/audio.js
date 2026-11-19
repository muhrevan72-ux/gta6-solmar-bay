// Sound, all synthesised with WebAudio: no audio files, no network.
// Every method is a no-op until init() runs after a user gesture, and
// the whole bank stays silent where there is no AudioContext at all
// (a headless check, a muted tab), so importing this file never throws.
export function createAudio() {
  let ctx = null;
  let master = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let sirenPhase = 0;
  let musicT = 0;
  let musicStep = 0;
  let muted = false;

  function hasAudio() {
    return typeof window !== 'undefined'
      && (window.AudioContext || window.webkitAudioContext) && !muted;
  }

  function init() {
    if (ctx || !hasAudio()) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
    } catch {
      ctx = null;
    }
  }

  function tone(freq, dur, type, vol, slideTo) {
    if (!ctx || !master) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type || 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, ctx.currentTime + dur);
      gain.gain.setValueAtTime(vol || 0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
      osc.connect(gain);
      gain.connect(master);
      osc.start();
      osc.stop(ctx.currentTime + dur);
    } catch {
      // A sound failing never stops the game.
    }
  }

  function engine(speed01) {
    if (!ctx || !master) return;
    try {
      if (!engineOsc) {
        engineOsc = ctx.createOscillator();
        engineGain = ctx.createGain();
        engineOsc.type = 'sawtooth';
        engineOsc.frequency.value = 50;
        engineGain.gain.value = 0;
        engineOsc.connect(engineGain);
        engineGain.connect(master);
        engineOsc.start();
      }
      engineOsc.frequency.setTargetAtTime(45 + speed01 * 110, ctx.currentTime, 0.08);
      engineGain.gain.setTargetAtTime(speed01 > 0.02 ? 0.05 + speed01 * 0.05 : 0, ctx.currentTime, 0.1);
    } catch {
      // Engine hum is decoration; ignore failures.
    }
  }

  function siren(on) {
    if (!ctx || !master) return;
    try {
      if (on && !sirenOsc) {
        sirenOsc = ctx.createOscillator();
        sirenGain = ctx.createGain();
        sirenOsc.type = 'triangle';
        sirenOsc.frequency.value = 660;
        sirenGain.gain.value = 0.045;
        sirenOsc.connect(sirenGain);
        sirenGain.connect(master);
        sirenOsc.start();
      } else if (!on && sirenOsc) {
        sirenOsc.stop();
        sirenOsc = null;
        sirenGain = null;
      }
    } catch {
      sirenOsc = null;
    }
  }

  function update(dt, speed01, wanted) {
    if (!ctx) return;
    engine(speed01);
    siren(wanted > 0);
    if (sirenOsc) {
      sirenPhase += dt * 2.2;
      const twoTone = Math.sin(sirenPhase * Math.PI) > 0 ? 660 : 880;
      try { sirenOsc.frequency.setTargetAtTime(twoTone, ctx.currentTime, 0.05); } catch { /* ignore */ }
    }
    // A quiet bass line: A1, C2, G1, Bb1, one note a beat, 112 bpm.
    musicT += dt;
    const beat = 60 / 112;
    if (musicT >= beat) {
      musicT -= beat;
      const notes = [55, 0, 65.41, 0, 49, 0, 58.27, 0];
      const note = notes[musicStep % notes.length];
      musicStep += 1;
      if (note) tone(note, beat * 0.9, 'square', 0.045);
    }
  }

  return {
    init,
    update,
    blip() { tone(880, 0.12, 'sine', 0.18); },
    pickup() { tone(660, 0.1, 'sine', 0.2); tone(990, 0.14, 'sine', 0.16); },
    thud() { tone(90, 0.18, 'sine', 0.3, 50); },
    crash() { tone(140, 0.25, 'sawtooth', 0.22, 60); },
    jingle() {
      tone(523, 0.12, 'sine', 0.2);
      setTimeout(() => tone(659, 0.12, 'sine', 0.2), 120);
      setTimeout(() => tone(784, 0.22, 'sine', 0.2), 240);
    },
    fail() { tone(220, 0.3, 'sawtooth', 0.16, 110); },
    setMuted(value) {
      muted = value;
      if (master) master.gain.value = muted ? 0 : 0.5;
    },
    isMuted() { return muted; },
  };
}
