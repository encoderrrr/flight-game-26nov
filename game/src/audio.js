// Ridge Runner sound: everything is synthesised with WebAudio, no audio
// files. A low engine hum follows the throttle, rings chime, landings thud.
export function createAudio() {
  return { ctx: null, muted: false, engine: null, engineGain: null, started: false };
}

/** Call from a user gesture; browsers block audio before one. */
export function ensureAudio(audio) {
  if (audio.ctx || audio.started) return;
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    audio.ctx = new Ctx();
    audio.started = true;
    const osc = audio.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = 55;
    const filter = audio.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 320;
    const gain = audio.ctx.createGain();
    gain.gain.value = 0;
    osc.connect(filter).connect(gain).connect(audio.ctx.destination);
    osc.start();
    audio.engine = osc;
    audio.engineGain = gain;
    audio.engineFilter = filter;
  } catch {
    audio.ctx = null;
  }
}

export function setEngine(audio, throttle, speed, airborne) {
  if (!audio.ctx || !audio.engine || audio.muted) return;
  const t = audio.ctx.currentTime;
  audio.engine.frequency.setTargetAtTime(46 + throttle * 62 + speed * 0.35, t, 0.08);
  audio.engineFilter.frequency.setTargetAtTime(240 + throttle * 700, t, 0.1);
  const level = airborne ? 0.045 + throttle * 0.05 : 0.02 + throttle * 0.05;
  audio.engineGain.gain.setTargetAtTime(level, t, 0.1);
}

function blip(audio, freq, dur, type, level, when = 0) {
  if (!audio.ctx || audio.muted) return;
  const t = audio.ctx.currentTime + when;
  const osc = audio.ctx.createOscillator();
  osc.type = type;
  osc.frequency.value = freq;
  const gain = audio.ctx.createGain();
  gain.gain.setValueAtTime(level, t);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(gain).connect(audio.ctx.destination);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

export function ringChime(audio, centered) {
  blip(audio, 880, 0.35, 'sine', 0.16);
  blip(audio, 1318, 0.4, 'sine', 0.12, 0.07);
  if (centered) blip(audio, 1760, 0.5, 'sine', 0.1, 0.14);
}

export function thud(audio) {
  blip(audio, 70, 0.3, 'triangle', 0.25);
  blip(audio, 48, 0.4, 'sine', 0.2, 0.05);
}

export function fanfare(audio) {
  [523, 659, 784, 1046].forEach((f, i) => blip(audio, f, 0.45, 'triangle', 0.14, i * 0.12));
}

export function toggleMute(audio) {
  audio.muted = !audio.muted;
  if (audio.engineGain && audio.ctx) {
    audio.engineGain.gain.setTargetAtTime(audio.muted ? 0 : 0.05, audio.ctx.currentTime, 0.05);
  }
  return audio.muted;
}
