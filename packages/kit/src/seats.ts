/**
 * Hot-seat play: one to six players sharing one device, taking turns.
 *
 * The bookkeeping is small (whose turn, what each seat is called); the part
 * that matters is the hand-over. Between seats the screen is covered by an
 * opaque interstitial ("Seat 3, the room is yours") and stays covered until
 * the next player presses Ready, so nobody glimpses another realm's numbers
 * while the device changes hands.
 */

export const MAX_SEATS = 6;

export interface Seats {
  readonly count: number;
  /** The player's chosen name, or "Seat 3". */
  name(seat: number): string;
  /** "Seat 3" always, for places where names would leak identity (share strings). */
  label(seat: number): string;
  next(seat: number): number;
  /** True when moving from one seat to the other needs a hand-over screen. */
  needsHandover(from: number, to: number): boolean;
}

export function createSeats(count: number, names: readonly string[] = []): Seats {
  if (!Number.isInteger(count) || count < 1 || count > MAX_SEATS) {
    throw new RangeError(`Seats must be 1 to ${MAX_SEATS}, got ${count}`);
  }
  const label = (seat: number): string => `Seat ${seat + 1}`;
  return {
    count,
    name(seat) {
      const chosen = names[seat]?.trim() ?? '';
      return chosen === '' ? label(seat) : chosen;
    },
    label,
    next: (seat) => (seat + 1) % count,
    needsHandover: (from, to) => count > 1 && from !== to,
  };
}

export interface HandoverOptions {
  seat: number;
  seats: Seats;
  /** Defaults to "Seat 3, the room is yours". */
  title?: string;
  /** A line under the title, e.g. "Year 4 · your realm awaits your decisions". */
  detail?: string;
  readyLabel?: string;
  onReady: () => void;
}

/**
 * Covers the host with the hand-over screen; returns a function that removes
 * it. The cover is opaque and takes focus, so neither eyes nor a screen
 * reader can wander into the previous seat's numbers behind it.
 */
export function showHandover(host: HTMLElement, options: HandoverOptions): () => void {
  const { seat, seats } = options;
  const cover = document.createElement('div');
  cover.className = 'omy-handover';
  cover.setAttribute('role', 'dialog');
  cover.setAttribute('aria-modal', 'true');
  cover.setAttribute('aria-labelledby', 'omy-handover-title');
  cover.dataset.seat = String(seat);

  const title = document.createElement('h2');
  title.id = 'omy-handover-title';
  title.className = 'omy-handover__title';
  title.textContent = options.title ?? `${seats.name(seat)}, the room is yours`;

  const detail = document.createElement('p');
  detail.className = 'omy-handover__detail';
  detail.textContent =
    options.detail ?? 'Pass the device over. Nothing is shown until you are ready.';

  const ready = document.createElement('button');
  ready.type = 'button';
  ready.className = 'omy-handover__ready';
  ready.textContent = options.readyLabel ?? 'Ready';

  cover.append(title, detail, ready);

  // Everything behind the cover leaves the accessibility tree while it shows.
  const hidden = [...host.children].filter((child) => !child.hasAttribute('inert'));
  for (const child of hidden) child.setAttribute('inert', '');
  host.append(cover);
  ready.focus();

  let closed = false;
  const close = (): void => {
    if (closed) return;
    closed = true;
    cover.remove();
    for (const child of hidden) child.removeAttribute('inert');
  };
  ready.addEventListener('click', () => {
    close();
    options.onReady();
  });
  return close;
}
