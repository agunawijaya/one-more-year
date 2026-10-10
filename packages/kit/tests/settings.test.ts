import { describe, expect, it, vi } from 'vitest';
import { createStorage } from '../src/save.ts';
import {
  DEFAULT_SETTINGS,
  SETTINGS_KEY,
  createSettings,
  parseSettings,
  type SystemPreferences,
} from '../src/settings.ts';
import { MemoryStorage } from './storage-doubles.ts';

function fakeSystem(dark = false, reduce = false) {
  let onChange = (): void => undefined;
  const system: SystemPreferences & { setDark(value: boolean): void } = {
    prefersDark: () => dark,
    prefersReducedMotion: () => reduce,
    watch(listener) {
      onChange = listener;
      return () => undefined;
    },
    setDark(value) {
      dark = value;
      onChange();
    },
  };
  return system;
}

describe('settings', () => {
  it('starts from the defaults', () => {
    const settings = createSettings(createStorage(new MemoryStorage()), fakeSystem());
    expect(settings.get()).toMatchObject(DEFAULT_SETTINGS);
    expect(settings.get().resolvedAppearance).toBe('light');
    expect(settings.get().reducedMotion).toBe(false);
  });

  it('persists changes across instances', () => {
    const backing = new MemoryStorage();
    const first = createSettings(createStorage(backing), fakeSystem());
    first.update({ theme: 'terrarium', appearance: 'dark', textSize: 130 });
    first.update({ volumes: { master: 0.2, music: 0.5, sfx: 0.8 } });
    const second = createSettings(createStorage(backing), fakeSystem());
    expect(second.get()).toMatchObject({
      theme: 'terrarium',
      appearance: 'dark',
      textSize: 130,
      volumes: { master: 0.2, music: 0.5, sfx: 0.8 },
    });
    expect(JSON.parse(backing.getItem(SETTINGS_KEY) ?? '{}')).toMatchObject({ v: 1 });
  });

  it('follows the system appearance live while set to system', () => {
    const system = fakeSystem(false);
    const settings = createSettings(createStorage(new MemoryStorage()), system);
    const listener = vi.fn();
    settings.subscribe(listener);
    system.setDark(true);
    expect(settings.get().resolvedAppearance).toBe('dark');
    expect(listener).toHaveBeenCalledTimes(1);
    expect([...(listener.mock.calls[0]?.[1] as Set<string>)]).toEqual(['resolvedAppearance']);

    settings.update({ appearance: 'light' });
    listener.mockClear();
    system.setDark(false);
    system.setDark(true);
    expect(settings.get().resolvedAppearance).toBe('light');
    expect(listener).not.toHaveBeenCalled();
  });

  it('reduces motion by setting or by system', () => {
    const settings = createSettings(createStorage(new MemoryStorage()), fakeSystem(false, true));
    expect(settings.get().reducedMotion).toBe(true);
    settings.update({ motion: 'full' });
    expect(settings.get().reducedMotion).toBe(false);
    settings.update({ motion: 'reduce' });
    expect(settings.get().reducedMotion).toBe(true);
  });

  it('only notifies when something actually changed', () => {
    const settings = createSettings(createStorage(new MemoryStorage()), fakeSystem());
    const listener = vi.fn();
    settings.subscribe(listener);
    settings.update({ theme: 'almanac' });
    expect(listener).not.toHaveBeenCalled();
  });

  it('resets to defaults', () => {
    const settings = createSettings(createStorage(new MemoryStorage()), fakeSystem());
    settings.update({ forecasts: 'hidden', introSeen: true });
    settings.reset();
    expect(settings.get().forecasts).toBe('shown');
    expect(settings.get().introSeen).toBe(false);
  });

  it('repairs damaged fields one by one', () => {
    expect(
      parseSettings({ theme: 'situation-room', textSize: 999, volumes: { master: 7 } }),
    ).toMatchObject({
      theme: 'situation-room',
      textSize: 100,
      volumes: { master: 0.8 },
    });
    expect(parseSettings('nonsense')).toBeNull();
  });

  it('keeps each simulation in its own namespace', () => {
    const backing = new MemoryStorage();
    const settings = createSettings(createStorage(backing), fakeSystem());
    const pond = settings.forSim('pond');
    const other = settings.forSim('other');
    const heard = vi.fn();
    pond.subscribe(heard);
    pond.set('units', 'metric');
    expect(pond.get('units', 'imperial')).toBe('metric');
    expect(other.get('units', 'imperial')).toBe('imperial');
    expect(heard).toHaveBeenCalledWith('units');
    const reopened = createSettings(createStorage(backing), fakeSystem()).forSim('pond');
    expect(reopened.get('units', 'imperial')).toBe('metric');
  });
});
