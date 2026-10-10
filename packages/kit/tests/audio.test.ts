import { describe, expect, it, vi } from 'vitest';
import { CUE_NAMES, createAudio, unlockOnFirstGesture } from '../src/audio.ts';

describe('audio', () => {
  it('stays silent and harmless where WebAudio is missing', async () => {
    const audio = createAudio(undefined);
    expect(audio.state).toBe('unavailable');
    audio.play('coin');
    audio.setAmbience({ noise: 'brown' });
    audio.setVolumes({ master: 1, music: 1, sfx: 1 }, false);
    await audio.unlock();
    audio.dispose();
  });

  it('names the calm cues the collection uses', () => {
    expect(CUE_NAMES).toEqual(
      expect.arrayContaining(['page-turn', 'seal-stamp', 'coin', 'harvest-chime', 'warning-bell']),
    );
  });

  it('waits for a gesture before starting', () => {
    const audio = createAudio(undefined);
    const unlock = vi.spyOn(audio, 'unlock');
    const target = new EventTarget();
    unlockOnFirstGesture(audio, target);
    expect(unlock).not.toHaveBeenCalled();
    target.dispatchEvent(new Event('keydown'));
    target.dispatchEvent(new Event('pointerdown'));
    expect(unlock).toHaveBeenCalledTimes(1);
  });
});
