import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createModelDemo, type DemoFrame, type DemoLook, type DemoRenderer } from '../src/demo.ts';
import { orchard, type OrchardState } from './orchard-model.ts';

const look: DemoLook = {
  appearance: 'light',
  style: 'engraving',
  reducedMotion: true,
  palette: {
    paper: '#fff',
    ink: '#000',
    muted: '#777',
    accent: '#c00',
    line: '#333',
    glow: '#ff0',
    good: '#0a0',
    warning: '#a60',
    disaster: '#a00',
  },
};

function recordingRenderer() {
  const calls = { mount: 0, draw: 0, setLook: 0, dispose: 0 };
  const renderer: DemoRenderer<OrchardState> = {
    mount: () => {
      calls.mount++;
    },
    draw: () => {
      calls.draw++;
    },
    setLook: () => {
      calls.setLook++;
    },
    dispose: () => {
      calls.dispose++;
    },
  };
  return { renderer, calls };
}

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('model demo', () => {
  it('plays a turn every pace and streams the signals', () => {
    const { renderer, calls } = recordingRenderer();
    const frames: DemoFrame[] = [];
    const demo = createModelDemo({
      host: document.createElement('div'),
      seed: 3,
      model: orchard,
      bot: () => ({ sell: 0, plant: 1 }),
      renderer,
      look,
      pace: 1000,
    });
    demo.subscribe((frame) => frames.push(frame));
    expect(calls.mount).toBe(1);
    expect(frames).toHaveLength(1);
    expect(frames[0]?.turn).toBe(0);

    vi.advanceTimersByTime(3000);
    expect(frames.map((frame) => frame.turn)).toEqual([0, 1, 2, 3]);
    expect(frames[3]?.signals.trees).toBe(13);
    demo.dispose();
    expect(calls.dispose).toBe(1);
    vi.advanceTimersByTime(5000);
    expect(frames).toHaveLength(4);
  });

  it('starts a fresh world when one ends', () => {
    const frames: DemoFrame[] = [];
    const demo = createModelDemo({
      host: document.createElement('div'),
      seed: 3,
      model: orchard,
      bot: () => ({ sell: 0, plant: 0 }),
      renderer: recordingRenderer().renderer,
      look,
      pace: 100,
    });
    demo.subscribe((frame) => frames.push(frame));
    vi.advanceTimersByTime(100 * 6 + 160 + 50);
    expect(frames.some((frame) => frame.ended)).toBe(true);
    expect(frames.at(-1)?.cycle).toBe(1);
    expect(frames.at(-1)?.turn).toBe(0);
    demo.dispose();
  });

  it('redraws in a new look without restarting', () => {
    const { renderer, calls } = recordingRenderer();
    const demo = createModelDemo({
      host: document.createElement('div'),
      seed: 1,
      model: orchard,
      bot: () => ({ sell: 0, plant: 0 }),
      renderer,
      look,
    });
    const before = calls.draw;
    demo.setLook({ ...look, appearance: 'dark' });
    expect(calls.setLook).toBe(1);
    expect(calls.draw).toBe(before + 1);
    demo.dispose();
  });
});
