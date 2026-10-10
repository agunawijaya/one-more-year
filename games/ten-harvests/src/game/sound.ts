/**
 * Ten Harvests' sounds, synthesised with the kit's audio engine: no audio
 * files. A swell that rises with the wheat, a soft rush of grain into the
 * granary, a scatter of tiny feet for the rats, the teletype's clatter and
 * the chisel on stone. The ambience is wind over a wide plain.
 */
import type { AmbienceBed, CueRecipe, SimAudio } from '@one-more-year/kit';

/** Wind over the fields: soft pink noise, far away, breathing slowly. */
export const PLAIN_WIND: AmbienceBed = {
  noise: 'pink',
  cutoff: 520,
  gain: 0.16,
  swell: 11,
  drone: [110, 165],
  droneGain: 0.025,
};

function noiseBuffer(context: AudioContext, seconds: number): AudioBuffer {
  const buffer = context.createBuffer(
    1,
    Math.max(1, Math.floor(context.sampleRate * seconds)),
    context.sampleRate,
  );
  const data = buffer.getChannelData(0);
  // A fixed pseudo-random sequence: the same rush every time, no Math.random.
  let seed = 1234567;
  for (let i = 0; i < data.length; i++) {
    seed = (seed * 1103515245 + 12345) >>> 0;
    data[i] = (seed / 4294967296) * 2 - 1;
  }
  return buffer;
}

const swell: CueRecipe = (context, out, at) => {
  const gain = context.createGain();
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(0.16, at + 1.6);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + 2.8);
  const filter = context.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(300, at);
  filter.frequency.exponentialRampToValueAtTime(2400, at + 2.2);
  filter.connect(gain).connect(out);
  for (const [frequency, detune] of [
    [196, -6],
    [294, 4],
    [392, 0],
  ] as const) {
    const voice = context.createOscillator();
    voice.type = 'sawtooth';
    voice.frequency.setValueAtTime(frequency, at);
    voice.detune.setValueAtTime(detune, at);
    voice.connect(filter);
    voice.start(at);
    voice.stop(at + 2.9);
  }
};

const grainRush: CueRecipe = (context, out, at) => {
  const source = context.createBufferSource();
  source.buffer = noiseBuffer(context, 2.4);
  const band = context.createBiquadFilter();
  band.type = 'bandpass';
  band.frequency.setValueAtTime(1800, at);
  band.frequency.linearRampToValueAtTime(900, at + 2.2);
  band.Q.value = 0.7;
  const gain = context.createGain();
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(0.22, at + 0.5);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + 2.3);
  source.connect(band).connect(gain).connect(out);
  source.start(at);
};

const tinyFeet: CueRecipe = (context, out, at) => {
  for (let i = 0; i < 16; i++) {
    const t = at + i * 0.045 + (i % 3) * 0.012;
    const click = context.createOscillator();
    click.type = 'square';
    click.frequency.setValueAtTime(2600 + (i % 5) * 300, t);
    const gain = context.createGain();
    gain.gain.setValueAtTime(0.05, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.02);
    click.connect(gain).connect(out);
    click.start(t);
    click.stop(t + 0.025);
  }
};

const clatter: CueRecipe = (context, out, at) => {
  const source = context.createBufferSource();
  source.buffer = noiseBuffer(context, 0.03);
  const high = context.createBiquadFilter();
  high.type = 'highpass';
  high.frequency.value = 3000;
  const gain = context.createGain();
  gain.gain.setValueAtTime(0.06, at);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.03);
  source.connect(high).connect(gain).connect(out);
  source.start(at);
};

const chisel: CueRecipe = (context, out, at) => {
  const ring = context.createOscillator();
  ring.type = 'triangle';
  ring.frequency.setValueAtTime(1760, at);
  ring.frequency.exponentialRampToValueAtTime(1200, at + 0.12);
  const gain = context.createGain();
  gain.gain.setValueAtTime(0.09, at);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.18);
  ring.connect(gain).connect(out);
  ring.start(at);
  ring.stop(at + 0.2);
  clatter(context, out, at);
};

export const SOUND = {
  swell: 'th-swell',
  grain: 'th-grain',
  feet: 'th-feet',
  clatter: 'th-clatter',
  chisel: 'th-chisel',
} as const;

export function defineSounds(audio: SimAudio): void {
  audio.define(SOUND.swell, swell);
  audio.define(SOUND.grain, grainRush);
  audio.define(SOUND.feet, tinyFeet);
  audio.define(SOUND.clatter, clatter);
  audio.define(SOUND.chisel, chisel);
}
