import { describe, expect, it, vi } from 'vitest';
import { createSlot, createStorage, upgrade } from '../src/save.ts';
import { BlockedStorage, MemoryStorage, TinyStorage } from './storage-doubles.ts';

describe('createStorage', () => {
  it('reads and writes through to the backing storage', () => {
    const backing = new MemoryStorage();
    const store = createStorage(backing);
    expect(store.set('omy:a', '1')).toBe(true);
    expect(backing.getItem('omy:a')).toBe('1');
    expect(store.get('omy:a')).toBe('1');
    expect(store.keys('omy:')).toEqual(['omy:a']);
    store.remove('omy:a');
    expect(store.get('omy:a')).toBeNull();
    expect(store.degraded).toBe(false);
  });

  it('falls back to memory when storage is blocked, and says so once', () => {
    const store = createStorage(new BlockedStorage());
    const onDegraded = vi.fn();
    store.onDegraded(onDegraded);
    expect(store.get('omy:a')).toBeNull();
    expect(store.set('omy:a', 'kept')).toBe(false);
    expect(store.get('omy:a')).toBe('kept');
    store.set('omy:b', 'also kept');
    expect(store.degraded).toBe(true);
    expect(onDegraded).toHaveBeenCalledTimes(1);
    expect(onDegraded).toHaveBeenCalledWith('unavailable');
  });

  it('keeps going when storage is full, carrying over what was saved', () => {
    const store = createStorage(new TinyStorage(40));
    const onDegraded = vi.fn();
    store.onDegraded(onDegraded);
    expect(store.set('omy:small', 'x')).toBe(true);
    expect(store.set('omy:big', 'y'.repeat(100))).toBe(false);
    expect(onDegraded).toHaveBeenCalledWith('full');
    expect(store.get('omy:small')).toBe('x');
    expect(store.get('omy:big')).toBe('y'.repeat(100));
  });

  it('works with no storage at all', () => {
    const store = createStorage(null);
    store.set('omy:a', '1');
    expect(store.get('omy:a')).toBe('1');
  });

  it('tells late listeners that it has already degraded', () => {
    const store = createStorage(new BlockedStorage());
    store.get('omy:x');
    const late = vi.fn();
    store.onDegraded(late);
    expect(late).toHaveBeenCalledWith('unavailable');
  });
});

describe('createSlot', () => {
  interface Profile {
    name: string;
    volume: number;
  }

  const defaults = (): Profile => ({ name: 'nobody', volume: 50 });

  it('returns defaults when nothing is stored, then round-trips', () => {
    const slot = createSlot(createStorage(new MemoryStorage()), 'omy:profile', {
      version: 1,
      defaults,
    });
    expect(slot.load()).toEqual(defaults());
    slot.save({ name: 'ada', volume: 70 });
    expect(slot.load()).toEqual({ name: 'ada', volume: 70 });
  });

  it('migrates old envelopes step by step', () => {
    const backing = new MemoryStorage();
    backing.setItem('omy:profile', JSON.stringify({ v: 1, d: { name: 'ada', loudness: 0.7 } }));
    const slot = createSlot<Profile>(createStorage(backing), 'omy:profile', {
      version: 3,
      defaults,
      migrations: {
        1: (data) => {
          const old = data as { name: string; loudness: number };
          return { name: old.name, volume: old.loudness * 100 };
        },
        2: (data) => ({ ...(data as Profile), name: (data as Profile).name.toUpperCase() }),
      },
    });
    expect(slot.load()).toEqual({ name: 'ADA', volume: 70 });
  });

  it('falls back to defaults for damaged, unknown or future data', () => {
    const backing = new MemoryStorage();
    const slot = createSlot(createStorage(backing), 'omy:profile', { version: 2, defaults });
    backing.setItem('omy:profile', '{not json');
    expect(slot.load()).toEqual(defaults());
    backing.setItem('omy:profile', JSON.stringify({ v: 9, d: { name: 'future' } }));
    expect(slot.load()).toEqual(defaults());
    backing.setItem('omy:profile', JSON.stringify({ v: 1, d: { name: 'no migration' } }));
    expect(slot.load()).toEqual(defaults());
  });

  it('lets a parser reject unusable data', () => {
    const backing = new MemoryStorage();
    backing.setItem('omy:profile', JSON.stringify({ v: 1, d: 'a string' }));
    const slot = createSlot(createStorage(backing), 'omy:profile', {
      version: 1,
      defaults,
      parse: (data) => (typeof data === 'object' ? (data as Profile) : null),
    });
    expect(slot.load()).toEqual(defaults());
  });

  it('upgrade returns undefined for envelopes it cannot read', () => {
    expect(upgrade('[]', { version: 1 })).toBeUndefined();
    expect(upgrade(JSON.stringify({ v: 1, d: 5 }), { version: 1 })).toBe(5);
  });
});
