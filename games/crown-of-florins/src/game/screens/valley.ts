/**
 * Between years the camera pulls back and the fresco becomes a painted map
 * of the valley: every city-state at its true size, its banner rising with
 * its title points. Armies that marched this year march again here: a
 * column as long as its army on the road, the garrison formed before its
 * walls, the camera easing in for the clash of pennants, spear-lines and
 * dust, the result lettered on a ribbon and the loser's banner dipping,
 * then the camera easing back. Under reduced motion the march is three
 * still beats: on the road, the clash, the result.
 *
 * In hot-seat this is also the year's reveal: every realm's title and
 * standing, human or AI, shown to the whole table at once.
 */
import { formatNumber, type Appearance } from '@one-more-year/kit';
import type { BetweenNote, Realm, World } from '../../engine/state.ts';
import { titleName } from '../../content/names.ts';
import { el } from '../../ui/dom.ts';
import { clashPose, type March } from '../../scene/valley.ts';
import type { Stage } from '../stage.ts';
import type { AiSpeed } from '../options.ts';
import type { RaceWon } from '../year-model.ts';
import { raceAnnouncement, type RaceChoice } from './race.ts';

export interface ValleyOptions {
  host: HTMLElement;
  stage: Stage;
  world: World;
  /** The year just played. */
  year: number;
  appearance: Appearance;
  /** Seconds each march takes on the road; 0 shows the outcome at once. */
  marchLength: number;
  aiSpeed: AiSpeed;
  reducedMotion: boolean;
  continueLabel: string;
  sound: { drum(): void };
  /** The race to the crown, when it was won this year by someone else: the heralds announce it. */
  announce?: RaceWon | null;
  onContinue(choice: RaceChoice): void;
}

export interface ValleyRun {
  skip(): void;
  dispose(): void;
}

interface Clash {
  march: March;
  note: BetweenNote;
}

export function runValley(options: ValleyOptions): ValleyRun {
  const { stage, world } = options;
  const notes = world.between;
  const clashes: Clash[] = notes
    .filter((note) => note.kind === 'invaded' && (note.numbers.by ?? -1) >= 0)
    .map((note) => {
      const by = note.numbers.by ?? 0;
      const march: March = {
        from: by,
        to: note.seat,
        progress: 0,
        soldiers: world.realms[by]?.people.soldiers ?? 0,
        defenders: world.realms[note.seat]?.people.soldiers ?? 0,
      };
      return { march, note };
    });
  const marches = clashes.map((c) => c.march);

  stage.attach(options.host);
  stage.paintValley(world.realms, marches);
  const valley = stage.valley();
  valley.bow(null, 0);
  const pose = stage.valleyPose({ elevation: 0.62 });
  valley.freeze(options.reducedMotion);
  if (options.reducedMotion) stage.view.setPose(pose);
  else {
    stage.view.setPose({
      ...pose,
      distance: pose.distance * 0.82,
      elevation: pose.elevation + 0.08,
    });
    stage.view.setPose(pose, 1.6);
  }

  const labels = el('div', { class: 'cf-valley__labels' });
  const news = el('ol', { class: 'cf-valley__news', 'aria-label': 'This year in the valley' });
  const button = el(
    'button',
    { type: 'button', class: 'cf-button cf-button--primary', 'data-action': 'continue' },
    options.continueLabel,
  );
  button.addEventListener('click', () => finish('play-on'));
  const herald = options.announce
    ? raceAnnouncement(options.announce, (choice) => finish(choice))
    : null;
  const panel = el(
    'section',
    { class: 'cf-valley__panel cf-card', 'aria-labelledby': 'cf-valley-title' },
    el('p', { class: 'cf-scroll__eyebrow' }, `Anno ${options.year}`),
    el('h2', { id: 'cf-valley-title', class: 'cf-valley__title' }, 'The valley'),
    news,
    herald ? null : el('div', { class: 'cf-scroll__actions' }, button),
  );
  const layer = el('div', { class: 'cf-valley' }, labels, panel, herald?.element ?? null);
  options.host.append(layer);

  // Each realm's ribbon under its city: town, ruler, title and points.
  const ribbons = world.realms.map((realm) => {
    const ribbon = el(
      'div',
      {
        class: 'cf-ribbon',
        'data-seat': realm.seat,
        'data-ended': realm.status === 'ended' ? true : null,
      },
      el('strong', {}, realm.city),
      el('span', {}, ribbonLine(realm, world)),
      realm.record.crownedYear !== null
        ? el(
            'em',
            { class: 'cf-ribbon__crown' },
            world.firstCrowned === realm.seat
              ? `first crowned, ${realm.record.crownedYear}`
              : `crowned ${realm.record.crownedYear}`,
          )
        : null,
    );
    labels.append(ribbon);
    return { realm, ribbon };
  });
  const placeRibbons = (): void => {
    for (const { realm, ribbon } of ribbons) {
      const site = valley.siteOf(realm.seat);
      const at = stage.view.project({ x: site.x, y: 0, z: site.z + 24 });
      ribbon.style.left = `${(at.x * 100).toFixed(2)}%`;
      ribbon.style.top = `${(at.y * 100).toFixed(2)}%`;
    }
  };

  // One line per piece of news; a summary leaves out the building works.
  const entries: { note: BetweenNote | null; line: string }[] = notes
    .filter((note) => note.kind !== 'built' || options.aiSpeed === 'show')
    .map((note) => ({ note, line: newsLine(note, world) }));
  if (entries.length === 0) {
    entries.push({
      note: null,
      line: 'A quiet year in the valley: no army on the roads, no new title in any town.',
    });
  }
  const lines = entries.map((entry) => entry.line);
  const visible = new Set<number>();
  const showLine = (index: number): void => {
    if (index < 0 || visible.has(index) || !lines[index]) return;
    visible.add(index);
    news.append(el('li', {}, lines[index] ?? ''));
  };

  // Marches play one after another ('show') or together ('summarise').
  const together = options.aiSpeed === 'summarise' || options.marchLength <= 0;
  const length = Math.max(0.001, options.marchLength);
  // The armies' clock runs on painted frames (each counts for a tenth of a second at most), so
  // they set out when the valley is on screen, not while it compiles.
  let elapsed = 0;
  let done = false;
  let drummed = -1;
  const isClash = (entry: (typeof entries)[number]): boolean =>
    clashes.some((clash) => clash.note === entry.note);
  if (clashes.length === 0 || options.marchLength <= 0) {
    lines.forEach((_, i) => showLine(i));
  } else {
    // Everything but the battles is news at once; each battle is told when its army arrives.
    entries.forEach((entry, i) => {
      if (!isClash(entry)) showLine(i);
    });
  }
  // While a column is on the road, say whose it is.
  const road = el('p', { class: 'cf-valley__road', role: 'status' });
  panel.insertBefore(road, news);

  // Each result, lettered on a ribbon over the field before the walls.
  const results = clashes.map(({ march, note }) => {
    const invader = world.realms[march.from]?.city ?? '';
    const town = world.realms[march.to]?.city ?? '';
    return el(
      'div',
      { class: 'cf-ribbon cf-ribbon--result', hidden: true },
      el('strong', {}, `${invader} takes ${formatNumber(note.numbers.hectares ?? 0)} hectares`),
      el('span', {}, `${town} yields before its walls`),
    );
  });
  labels.append(...results);
  const placeResults = (): void => {
    results.forEach((ribbon, i) => {
      const at = valley.clashPoint(i);
      if (!at || ribbon.hidden) return;
      const point = stage.view.project({ x: at.x, y: 0, z: at.z + 30 });
      ribbon.style.left = `${(point.x * 100).toFixed(2)}%`;
      ribbon.style.top = `${(point.y * 100).toFixed(2)}%`;
    });
  };

  // The camera eases in toward a clash (when the marches come one by one) and back out after it.
  const follow = !options.reducedMotion && options.aiSpeed !== 'summarise';
  let closeOn = -1;
  let backAt = -1;
  const ease = (index: number): void => {
    const at = valley.clashPoint(index);
    if (at) stage.view.setPose(clashPose(pose, at), 1.6);
    closeOn = index;
  };

  const stop = stage.view.onFrame(({ seconds }) => {
    placeRibbons();
    placeResults();
    if (done || clashes.length === 0 || options.marchLength <= 0) return;
    elapsed += seconds;
    const progresses = clashes.map((_, i) => {
      const start = together ? 0 : i * length;
      const share = (elapsed - start) / length;
      // Reduced motion: three still beats, a third of the march each.
      if (options.reducedMotion)
        return share < 0 ? 0 : share < 1 / 3 ? 0.5 : share < 2 / 3 ? 1.06 : 1.15;
      return Math.max(0, Math.min(1.15, share * 1.15));
    });
    progresses.forEach((p, i) => {
      if (p >= 1.08) results[i]?.removeAttribute('hidden');
      if (follow && p >= 0.62 && p < 1.15 && closeOn !== i) ease(i);
    });
    if (follow && closeOn >= 0 && (progresses[closeOn] ?? 0) >= 1.15) {
      if (backAt < 0) backAt = elapsed + 0.9;
      if (elapsed >= backAt) {
        stage.view.setPose(pose, 1.6);
        closeOn = -1;
        backAt = -1;
      }
    }
    const marching = progresses.findIndex((p) => p > 0 && p < 1);
    if (marching > drummed) {
      drummed = marching;
      options.sound.drum();
      const march = clashes[marching]?.march;
      const from = march ? world.realms[march.from]?.city : null;
      const to = march ? world.realms[march.to]?.city : null;
      if (from && to) road.textContent = `${from}’s banners are on the road to ${to}…`;
    }
    if (marching < 0) road.textContent = '';
    valley.setProgress(progresses);
    progresses.forEach((p, i) => {
      if (p >= 1) showLine(entries.findIndex((entry) => entry.note === clashes[i]?.note));
    });
    if (progresses.every((p) => p >= 1.15)) {
      lines.forEach((_, i) => showLine(i));
    }
  });
  if (clashes.length > 0 && options.marchLength <= 0) {
    valley.setProgress(clashes.map(() => 1.15));
    for (const ribbon of results) ribbon.removeAttribute('hidden');
  }
  (herald?.playOn ?? button).focus();

  function finish(choice: RaceChoice): void {
    if (done) return;
    done = true;
    options.onContinue(choice);
  }

  return {
    skip() {
      if (clashes.length > 0) valley.setProgress(clashes.map(() => 1.15));
      for (const ribbon of results) ribbon.removeAttribute('hidden');
      if (closeOn >= 0) stage.view.setPose(pose, options.reducedMotion ? 0 : 0.8);
      closeOn = -1;
      lines.forEach((_, i) => showLine(i));
    },
    dispose() {
      done = true;
      stop();
      valley.freeze(false);
      layer.remove();
    },
  };
}

function ribbonLine(realm: Realm, world: World): string {
  if (realm.status === 'ended') return 'the line has ended';
  const standing = world.standings.find((s) => s.seat === realm.seat);
  const points = standing?.points ?? realm.pointsHistory.at(-1) ?? 0;
  return `${titleName(realm.title, realm.ruler.form)} ${realm.ruler.name} · ${formatNumber(points)} ${points === 1 ? 'point' : 'points'}`;
}

/** One line of the valley's news, in the heralds' words. */
export function newsLine(note: BetweenNote, world: World): string {
  const city = world.realms[note.seat]?.city ?? 'A city';
  const n = (name: string): number => note.numbers[name] ?? 0;
  switch (note.kind) {
    case 'invaded': {
      const by = n('by');
      const invader = by >= 0 ? world.realms[by]?.city : null;
      return invader
        ? `${invader} marched on ${city} and took ${formatNumber(n('hectares'))} hectares.`
        : `Mercenaries fell on ${city} and took ${formatNumber(n('hectares'))} hectares.`;
    }
    case 'promoted': {
      const realm = world.realms[note.seat];
      return `${city}: the heralds raised its ruler to ${titleName(n('title'), realm?.ruler.form ?? 'm')}.`;
    }
    case 'crowned': {
      // Only the first crown wins the race; a later one is a crown of that city's own chronicle.
      if (world.firstCrowned === note.seat) {
        return `${city} crowned its ruler: the first crown of the valley. The race is won.`;
      }
      const first = world.firstCrowned === null ? null : world.realms[world.firstCrowned];
      return first
        ? `${city} crowned its ruler too, a crown won after ${first.city}’s.`
        : `${city} crowned its ruler.`;
    }
    case 'died':
      return `${city} rang its bells for a ruler who died.`;
    case 'bankrupt':
      return `The creditors came to ${city}.`;
    case 'built': {
      const parts = [
        n('cathedral') > 0 ? 'the cathedral' : null,
        n('palace') > 0 ? 'the palace' : null,
        n('markets') > 0 ? 'markets' : null,
        n('mills') > 0 ? 'mills' : null,
      ].filter((p): p is string => p !== null);
      return `${city} built ${parts.join(' and ')}.`;
    }
    default:
      return city;
  }
}
