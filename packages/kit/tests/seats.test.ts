import { afterEach, describe, expect, it, vi } from 'vitest';
import { createSeats, showHandover } from '../src/seats.ts';

afterEach(() => {
  document.body.replaceChildren();
});

describe('seats', () => {
  it('rotates through the seats', () => {
    const seats = createSeats(3);
    expect([0, 1, 2].map((seat) => seats.next(seat))).toEqual([1, 2, 0]);
    expect(seats.needsHandover(0, 1)).toBe(true);
    expect(seats.needsHandover(1, 1)).toBe(false);
    expect(createSeats(1).needsHandover(0, 0)).toBe(false);
  });

  it('names seats, falling back to their number', () => {
    const seats = createSeats(2, ['  Ada ', '']);
    expect(seats.name(0)).toBe('Ada');
    expect(seats.name(1)).toBe('Seat 2');
    expect(seats.label(0)).toBe('Seat 1');
  });

  it('allows one to six seats only', () => {
    expect(() => createSeats(0)).toThrow(RangeError);
    expect(() => createSeats(7)).toThrow(RangeError);
    expect(createSeats(6).count).toBe(6);
  });

  it('hides the previous seat behind the hand-over until Ready is pressed', () => {
    const host = document.createElement('div');
    const numbers = document.createElement('p');
    numbers.textContent = 'Seat 1 treasury: 4,000';
    host.append(numbers);
    document.body.append(host);

    const onReady = vi.fn();
    showHandover(host, { seat: 1, seats: createSeats(2), onReady });

    const cover = host.querySelector('.omy-handover');
    expect(cover?.textContent).toContain('Seat 2, the room is yours');
    expect(numbers.hasAttribute('inert')).toBe(true);
    expect(document.activeElement?.textContent).toBe('Ready');
    expect(onReady).not.toHaveBeenCalled();

    (host.querySelector('.omy-handover__ready') as HTMLButtonElement).click();
    expect(onReady).toHaveBeenCalledTimes(1);
    expect(host.querySelector('.omy-handover')).toBeNull();
    expect(numbers.hasAttribute('inert')).toBe(false);
  });

  it('can be closed from outside without calling Ready', () => {
    const host = document.createElement('div');
    host.append(document.createElement('p'));
    const onReady = vi.fn();
    const close = showHandover(host, { seat: 0, seats: createSeats(2), onReady });
    close();
    close();
    expect(host.querySelector('.omy-handover')).toBeNull();
    expect(onReady).not.toHaveBeenCalled();
  });
});
