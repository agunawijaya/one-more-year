/**
 * The end of a game, before the Hall's chronicle page: the verdict, the
 * dynasty as a tree of its rulers, every city's last fresco as a small
 * painting, and the race to the crown as a chart of title points for every
 * seat (with last time's run as a ghost on a replay).
 *
 * The run has already been chronicled; "Read the chronicle" hands the
 * player to the Hall's page for it (ADR-0008). Play again (R), the game
 * menu and the Hall (H) are offered here too, in the standard order.
 */
import {
  lineChart,
  ordinal,
  type Appearance,
  type ChartTokens,
  type ChronicleEntry,
} from '@one-more-year/kit';
import type { Realm, Ruler, World } from '../../engine/state.ts';
import { lifeView } from '../../engine/glass.ts';
import { isHuman } from '../../engine/world.ts';
import { titleName } from '../../content/names.ts';
import { VERDICT_LINES } from '../../content/verdicts.ts';
import { TINCTURE_COLOURS } from '../../ui/heraldry-svg.ts';
import { portraitSvg } from '../../ui/portrait.ts';
import { el, svgNode } from '../../ui/dom.ts';
import type { Stage } from '../stage.ts';

export interface EndingOptions {
  host: HTMLElement;
  stage: Stage;
  world: World;
  chronicle: ChronicleEntry;
  /** Last time's title points, on a replay. */
  ghost: readonly number[] | null;
  appearance: Appearance;
  onChronicle: () => void;
  onPlayAgain: () => void;
  onGameMenu: () => void;
  onHall: () => void;
}

const CAUSE_WORDS: Readonly<Record<string, string>> = {
  'old-age': 'full of years',
  'winter-chill': 'of a winter chill',
  fever: 'of a fever',
  fall: 'after a fall',
  heart: 'suddenly',
  sleep: 'in sleep',
};

export function showEnding(options: EndingOptions): () => void {
  const { world, chronicle } = options;
  const owner = world.realms[world.end?.seat ?? 0] ?? world.realms[0];
  if (!owner) return () => undefined;

  const read = el(
    'button',
    { type: 'button', class: 'cf-button cf-button--primary', 'data-action': 'read-chronicle' },
    'Read the chronicle',
  );
  const again = el(
    'button',
    { type: 'button', class: 'cf-button', 'data-action': 'play-again' },
    'Play again ',
    el('kbd', {}, 'R'),
  );
  const menu = el(
    'button',
    { type: 'button', class: 'cf-button', 'data-action': 'game-menu' },
    'Game menu',
  );
  const hall = el(
    'button',
    { type: 'button', class: 'cf-button', 'data-action': 'hall' },
    'Back to the Hall ',
    el('kbd', {}, 'H'),
  );
  read.addEventListener('click', options.onChronicle);
  again.addEventListener('click', options.onPlayAgain);
  menu.addEventListener('click', options.onGameMenu);
  hall.addEventListener('click', options.onHall);

  const lines: readonly string[] =
    (VERDICT_LINES as Readonly<Record<string, readonly string[] | undefined>>)[
      chronicle.outcome.verdict.id
    ] ?? [];
  const thumbs = el('ul', {
    class: 'cf-ending__frescos',
    'aria-label': 'Every city as it was left',
  });
  const page = el(
    'section',
    { class: 'cf-ending', 'aria-labelledby': 'cf-ending-title' },
    el(
      'header',
      { class: 'cf-ending__head' },
      el('p', { class: 'cf-scroll__eyebrow' }, chronicle.title),
      el(
        'h1',
        { id: 'cf-ending-title', class: 'cf-ending__verdict' },
        chronicle.outcome.verdict.label,
      ),
      ...lines.map((line) => el('p', { class: 'cf-ending__line' }, line)),
      el('p', { class: 'cf-ending__epithet' }, `Remembered as “${chronicle.epithet.text}”`),
    ),
    el(
      'div',
      { class: 'cf-ending__body' },
      el(
        'article',
        { class: 'cf-card cf-ending__tree' },
        el('h2', { class: 'cf-heading' }, 'The dynasty'),
        dynastyTree(owner, world.year, options.appearance),
      ),
      el(
        'article',
        { class: 'cf-card cf-ending__race' },
        el('h2', { class: 'cf-heading' }, 'The race to the crown'),
        raceChart(world, options.ghost, options.appearance),
      ),
      el(
        'article',
        { class: 'cf-card cf-ending__cities' },
        el('h2', { class: 'cf-heading' }, 'The valley’s cities'),
        thumbs,
      ),
    ),
    el('nav', { class: 'cf-ending__actions', 'aria-label': 'What next' }, read, again, menu, hall),
  );
  options.host.append(page);
  read.focus();

  // The last fresco of every city, painted once each on a small canvas and kept as a picture.
  const holder = el('div', { class: 'cf-thumb-stage', 'aria-hidden': 'true' });
  document.body.append(holder);
  const painting = { cancelled: false };
  void (async () => {
    options.stage.attach(holder);
    for (const realm of world.realms) {
      if (painting.cancelled) break;
      thumbs.append(await thumbnail(options.stage, realm));
    }
    holder.remove();
  })();

  return () => {
    painting.cancelled = true;
    holder.remove();
    page.remove();
  };
}

interface TreeRuler {
  ruler: Ruler;
  /** The year the reign ended; null while it goes on. */
  to: number | null;
  title: number;
  age: number;
  candle: number;
  note: string;
}

function dynastyTree(realm: Realm, year: number, appearance: Appearance): HTMLElement {
  const rulers: TreeRuler[] = realm.pastRulers.map((past) => {
    const age = past.ruler.ageAtAccession + (past.died - past.ruler.accession);
    return {
      ruler: past.ruler,
      to: past.died,
      title: past.title,
      age,
      // A ruler who has died is drawn with the candle burnt out.
      candle: 1,
      note: `died ${CAUSE_WORDS[past.cause] ?? ''} at ${age}`,
    };
  });
  if (realm.status !== 'ended') {
    const life = lifeView(realm.ruler, year);
    rulers.push({
      ruler: realm.ruler,
      to: null,
      title: realm.title,
      age: life.age,
      candle: life.candle,
      note: `reigning, aged ${life.age}`,
    });
  }
  return el(
    'ol',
    { class: 'cf-tree' },
    ...rulers.map((r) =>
      el(
        'li',
        { class: 'cf-tree__ruler', 'data-crowned': r.title >= 8 ? true : null },
        el('span', { class: 'cf-tree__medal', 'aria-hidden': 'true' }, String(r.ruler.generation)),
        svgNode(
          portraitSvg({
            ruler: r.ruler,
            age: r.age,
            title: r.title,
            candle: r.candle,
            appearance,
            width: 56,
          }),
        ),
        el(
          'div',
          { class: 'cf-tree__text' },
          el('strong', {}, `${titleName(r.title, r.ruler.form)} ${r.ruler.name}`),
          el(
            'span',
            { class: 'cf-tree__years cf-num' },
            r.to === null ? `${r.ruler.accession}–` : `${r.ruler.accession}–${r.to}`,
          ),
          el(
            'span',
            { class: 'cf-tree__note' },
            `${ordinal(r.ruler.generation)} of the line · ${r.note}`,
          ),
        ),
      ),
    ),
  );
}

function raceChart(
  world: World,
  ghost: readonly number[] | null,
  appearance: Appearance,
): HTMLElement {
  const tokens: ChartTokens =
    appearance === 'dark'
      ? {
          ink: '#e3b65c',
          muted: '#c8b694',
          grid: '#5c4832',
          accent: '#f39478',
          ghost: '#8a7a64',
          band: 'rgba(227,182,92,0.15)',
          paper: '#251d16',
        }
      : {
          ink: '#5b4532',
          muted: '#5b4532',
          grid: '#b8996b',
          accent: '#a12e1a',
          ghost: '#8a7a64',
          band: 'rgba(161,46,26,0.08)',
          paper: '#f4e8cf',
        };
  // The players' cities are drawn last, so their lines stay on top where the race is close.
  const drawOrder = [...world.realms.filter((r) => !isHuman(r)), ...world.realms.filter(isHuman)];
  const chart = lineChart({
    label: 'Title points of every city, year by year',
    series: drawOrder.map((realm) => ({
      label: realm.city,
      values: realm.pointsHistory,
      color: chartColour(realm, appearance),
    })),
    ...(ghost && ghost.length > 1 ? { ghost: { label: 'Last time', values: ghost } } : {}),
    tokens,
    width: 560,
    height: 240,
    turnName: 'year',
    includeZero: true,
  });
  const holder = el('figure', { class: 'cf-race' });
  holder.innerHTML = chart.markup;
  holder.append(
    el(
      'figcaption',
      { class: 'cf-race__key' },
      ...world.realms.map((realm) =>
        el(
          'span',
          {},
          el('i', { style: `background:${chartColour(realm, appearance)}`, 'aria-hidden': 'true' }),
          isHuman(realm) ? el('strong', {}, realm.city) : realm.city,
        ),
      ),
    ),
  );
  return holder;
}

/** A realm's colour in charts: its field tincture, lightened on dark paper where it would sink. */
function chartColour(realm: Realm, appearance: Appearance): string {
  const tincture = realm.arms.field;
  if (
    appearance === 'dark' &&
    (tincture === 'sable' || tincture === 'azure' || tincture === 'purpure')
  ) {
    return tincture === 'sable' ? '#c8b694' : tincture === 'azure' ? '#8fb3e8' : '#c9a6ec';
  }
  if (appearance === 'light' && (tincture === 'argent' || tincture === 'or')) {
    return tincture === 'argent' ? '#4d4a46' : '#84590e';
  }
  return TINCTURE_COLOURS[tincture];
}

async function thumbnail(stage: Stage, realm: Realm): Promise<HTMLElement> {
  stage.paintCity(realm, { crowned: realm.status === 'crowned', frame: 6 });
  stage.view.setPose(stage.cityPose({ elevation: 0.5, crestAt: 0.84 }));
  await stage.view.ready;
  await new Promise((resolve) => requestAnimationFrame(resolve));
  stage.view.renderOnce();
  const picture = stage.view.canvas.toDataURL('image/jpeg', 0.82);
  return el(
    'li',
    { class: 'cf-ending__fresco' },
    el('img', { src: picture, alt: `${realm.city}, as its last ruler left it` }),
    el('span', {}, realm.city),
  );
}
