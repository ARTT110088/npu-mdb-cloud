// Web Audio API Sound Synthesizer for Emergency Alarm & Breaker Clicks
let audioCtx: AudioContext | null = null;
let sirenOscillator: OscillatorNode | null = null;
let sirenGain: GainNode | null = null;
let isSirenActive = false;

function getAudioContext(): AudioContext {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    audioCtx = new AudioContextClass();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

export function playBreakerClick(type: 'trip' | 'toggle') {
  try {
    const ctx = getAudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type === 'trip' ? 'sawtooth' : 'triangle';
    osc.frequency.setValueAtTime(type === 'trip' ? 120 : 350, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(type === 'trip' ? 40 : 80, ctx.currentTime + 0.08);

    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.09);
  } catch {
    // ignore audio autoplay restriction
  }
}

export function playWarningBeep() {
  try {
    const ctx = getAudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.setValueAtTime(1760, ctx.currentTime + 0.08);

    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.22);
  } catch {
    // ignore
  }
}

export function startEmergencySiren() {
  if (isSirenActive) return;
  try {
    const ctx = getAudioContext();
    isSirenActive = true;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    gain.gain.setValueAtTime(0.25, ctx.currentTime);

    // Siren sweep LFO
    const now = ctx.currentTime;
    for (let i = 0; i < 20; i++) {
      osc.frequency.setValueAtTime(650, now + i * 0.8);
      osc.frequency.linearRampToValueAtTime(1100, now + i * 0.8 + 0.4);
      osc.frequency.linearRampToValueAtTime(650, now + i * 0.8 + 0.8);
    }

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    sirenOscillator = osc;
    sirenGain = gain;
  } catch {
    // ignore
  }
}

export function stopEmergencySiren() {
  if (!isSirenActive) return;
  try {
    if (sirenOscillator) {
      sirenOscillator.stop();
      sirenOscillator.disconnect();
      sirenOscillator = null;
    }
    if (sirenGain) {
      sirenGain.disconnect();
      sirenGain = null;
    }
  } catch {
    // ignore
  }
  isSirenActive = false;
}
