/**
 * The court setup: who sits at the table before the first year.
 *
 * Up to six seats, each a human or one of the five AI rivals, with a ruler's
 * name (an invented suggestion, editable), a form of address, a town and a
 * coat of arms that a few clicks can change. Then the difficulty and the
 * fate (Dynasty or Classic). The arms editor keeps the rule of tincture by
 * itself: pick a field and the other tinctures turn to contrast with it.
 */
import { createRng, type ScenarioSummary } from '@one-more-year/kit';
import { MAX_SEATS, quickCourt, type Court, type SeatChoice } from '../../engine/court.ts';
import type { Difficulty, Personality, TitleForm } from '../../engine/state.ts';
import {
  CHARGES,
  DIVISIONS,
  TINCTURES,
  blazon,
  chargeGround,
  drawArms,
  holdsThree,
  isMetal,
  type ArmsSpec,
  type Charge,
  type Division,
  type Tincture,
} from '../../lib/heraldry.ts';
import { GIVEN_NAMES, PERSONALITIES, RIVALS, TOWNS, titleName } from '../../content/names.ts';
import { armsSvg } from '../../ui/heraldry-svg.ts';
import { el, svgNode } from '../../ui/dom.ts';

export type SetupMode = 'solo' | 'hotseat' | 'endless' | 'scenario';

export interface SetupOptions {
  host: HTMLElement;
  mode: SetupMode;
  scenario: ScenarioSummary;
  seed: number;
  /** The court set up last time, to start from. */
  previous: Court | null;
  onBegin: (court: Court) => void;
  onBack: () => void;
}

export const DIFFICULTY_NAMES: Readonly<Record<Difficulty, { name: string; line: string }>> = {
  1: { name: 'Apprentice', line: 'Points ÷ 6. The rivals have an off year in three.' },
  2: { name: 'Journeyman', line: 'Points ÷ 7. The rivals slip one year in ten.' },
  3: { name: 'Master', line: 'Points ÷ 8. The rivals rarely slip.' },
  4: { name: 'Grand Master', line: 'Points ÷ 9. The rivals never slip.' },
};

function startingCourt(options: SetupOptions): Court {
  const humans = (court: Court): number =>
    court.seats.filter((s) => s.controller.kind === 'human').length;
  const previous = options.previous;
  if (options.mode === 'hotseat') {
    if (previous && humans(previous) >= 2) return previous;
    return quickCourt(options.seed, 2, 2);
  }
  if (previous && humans(previous) === 1)
    return { ...previous, fate: options.mode === 'endless' ? 'dynasty' : previous.fate };
  return quickCourt(options.seed, 1, 3);
}

export function showCourtSetup(options: SetupOptions): () => void {
  const court: Court = structuredClone(startingCourt(options));
  if (options.mode === 'endless') court.fate = 'dynasty';
  let draws = 0;
  const rng = createRng(options.seed).fork('setup');

  const seatsHost = el('ol', { class: 'cf-seats', 'aria-label': 'The seats at the table' });
  const problems = el('p', { class: 'cf-setup__problems', role: 'alert' });
  const add = el(
    'button',
    { type: 'button', class: 'cf-button', 'data-action': 'add-seat' },
    'Add a seat',
  );
  const begin = el(
    'button',
    { type: 'button', class: 'cf-button cf-button--primary', 'data-action': 'begin' },
    'Begin in 1400',
  );
  const back = el(
    'button',
    { type: 'button', class: 'cf-back', 'data-action': 'back' },
    '← Game menu',
  );

  const difficulty = el(
    'div',
    { class: 'cf-choices', role: 'radiogroup', 'aria-label': 'Difficulty' },
    ...([1, 2, 3, 4] as Difficulty[]).map((level) => {
      const node = el(
        'button',
        { type: 'button', role: 'radio', class: 'cf-choice', 'data-difficulty': level },
        el('strong', {}, DIFFICULTY_NAMES[level].name),
        el('span', {}, DIFFICULTY_NAMES[level].line),
      );
      node.addEventListener('click', () => {
        court.difficulty = level;
        render();
      });
      return node;
    }),
  );
  const fate = el(
    'div',
    { class: 'cf-choices', role: 'radiogroup', 'aria-label': 'Fate' },
    ...(
      [
        ['dynasty', 'Dynasty', 'When a ruler dies an heir takes the throne one title lower.'],
        ['classic', 'Classic fate', 'As in 1978: when a ruler dies, that seat’s game is over.'],
      ] as const
    ).map(([id, name, line]) => {
      const node = el(
        'button',
        {
          type: 'button',
          role: 'radio',
          class: 'cf-choice',
          'data-fate': id,
          disabled: options.mode === 'endless' && id === 'classic',
        },
        el('strong', {}, name),
        el('span', {}, line),
      );
      node.addEventListener('click', () => {
        court.fate = id;
        render();
      });
      return node;
    }),
  );

  const page = el(
    'section',
    { class: 'cf-setup', 'aria-labelledby': 'cf-setup-title' },
    back,
    el(
      'header',
      { class: 'cf-setup__head' },
      el('p', { class: 'cf-menu__eyebrow' }, options.scenario.title),
      el(
        'h1',
        { id: 'cf-setup-title', class: 'cf-setup__title' },
        options.mode === 'hotseat' ? 'Seat the table' : 'The court',
      ),
      el('p', { class: 'cf-setup__twist' }, options.scenario.twist),
    ),
    seatsHost,
    el('div', { class: 'cf-setup__row' }, add),
    el(
      'div',
      { class: 'cf-setup__options' },
      el(
        'fieldset',
        { class: 'cf-card' },
        el('legend', { class: 'cf-heading' }, 'Difficulty'),
        difficulty,
      ),
      el('fieldset', { class: 'cf-card' }, el('legend', { class: 'cf-heading' }, 'Fate'), fate),
    ),
    problems,
    el('div', { class: 'cf-setup__actions' }, begin),
  );
  options.host.append(page);

  add.addEventListener('click', () => {
    if (court.seats.length >= MAX_SEATS) return;
    const used = new Set(
      court.seats.map((s) => (s.controller.kind === 'ai' ? s.controller.personality : null)),
    );
    const personality = PERSONALITIES.find((p) => !used.has(p)) ?? 'merchant';
    court.seats.push(aiSeat(personality, court, rng.fork(`add:${draws++}`)));
    render();
  });
  back.addEventListener('click', options.onBack);
  begin.addEventListener('click', () => {
    if (problemsOf(court, options.mode).length === 0) options.onBegin(structuredClone(court));
  });

  function render(): void {
    seatsHost.replaceChildren(...court.seats.map((seat, i) => seatCard(seat, i)));
    for (const node of difficulty.querySelectorAll<HTMLButtonElement>('[data-difficulty]')) {
      const chosen = Number(node.dataset.difficulty) === court.difficulty;
      node.setAttribute('aria-checked', String(chosen));
    }
    for (const node of fate.querySelectorAll<HTMLButtonElement>('[data-fate]')) {
      node.setAttribute('aria-checked', String(node.dataset.fate === court.fate));
    }
    add.disabled = court.seats.length >= MAX_SEATS;
    const found = problemsOf(court, options.mode);
    problems.textContent = found.join(' ');
    begin.disabled = found.length > 0;
  }

  function seatCard(seat: SeatChoice, index: number): HTMLElement {
    const id = `cf-seat-${index}`;
    const who = el(
      'select',
      { id: `${id}-who`, class: 'cf-field__input' },
      el(
        'option',
        { value: 'human', selected: seat.controller.kind === 'human' },
        'A human player',
      ),
      ...PERSONALITIES.map((p) =>
        el(
          'option',
          {
            value: p,
            selected: seat.controller.kind === 'ai' && seat.controller.personality === p,
          },
          `AI: ${RIVALS[p].label}`,
        ),
      ),
    );
    who.addEventListener('change', () => {
      const value = who.value;
      court.seats[index] =
        value === 'human'
          ? { ...seat, controller: { kind: 'human' } }
          : aiSeat(value as Personality, court, rng.fork(`ai:${draws++}`), seat.arms);
      render();
    });

    const name = el('input', {
      id: `${id}-name`,
      class: 'cf-field__input',
      value: seat.name,
      maxlength: 40,
      autocomplete: 'off',
    });
    name.addEventListener('change', () => {
      seat.name = name.value.trim() || seat.name;
      render();
    });
    const reroll = el(
      'button',
      {
        type: 'button',
        class: 'cf-icon-button',
        'aria-label': `Suggest another name for seat ${index + 1}`,
      },
      '↻',
    );
    reroll.addEventListener('click', () => {
      const pool = GIVEN_NAMES[seat.form].filter((n) => !court.seats.some((s) => s.name === n));
      seat.name = rng.fork(`name:${draws++}`).pick(pool.length > 0 ? pool : GIVEN_NAMES[seat.form]);
      render();
    });

    const form = el(
      'div',
      {
        class: 'cf-toggle',
        role: 'radiogroup',
        'aria-label': `Form of address for seat ${index + 1}`,
      },
      ...(['m', 'f'] as TitleForm[]).map((f) => {
        const node = el(
          'button',
          { type: 'button', role: 'radio', 'aria-checked': String(seat.form === f) },
          `${titleName(1, f)} · ${titleName(8, f)}`,
        );
        node.addEventListener('click', () => {
          seat.form = f;
          render();
        });
        return node;
      }),
    );

    const town = el(
      'select',
      { id: `${id}-town`, class: 'cf-field__input' },
      ...TOWNS.map((t) => el('option', { value: t, selected: t === seat.town }, t)),
    );
    town.addEventListener('change', () => {
      seat.town = town.value;
      render();
    });
    const randomTown = el(
      'button',
      {
        type: 'button',
        class: 'cf-icon-button',
        'aria-label': `A random town for seat ${index + 1}`,
      },
      '↻',
    );
    randomTown.addEventListener('click', () => {
      const free = TOWNS.filter((t) => !court.seats.some((s) => s.town === t));
      seat.town = rng.fork(`town:${draws++}`).pick(free.length > 0 ? free : TOWNS);
      render();
    });

    const remove = el(
      'button',
      { type: 'button', class: 'cf-icon-button', 'aria-label': `Remove seat ${index + 1}` },
      '×',
    );
    remove.disabled = court.seats.length <= 2;
    remove.addEventListener('click', () => {
      court.seats.splice(index, 1);
      render();
    });

    return el(
      'li',
      { class: 'cf-seat cf-card', 'data-seat': index, 'data-kind': seat.controller.kind },
      el(
        'div',
        { class: 'cf-seat__arms' },
        svgNode(armsSvg(seat.arms, { width: 72, label: blazon(seat.arms) })),
        el('span', { class: 'cf-seat__number' }, `Seat ${index + 1}`),
        remove,
      ),
      el(
        'div',
        { class: 'cf-seat__fields' },
        field(`${id}-who`, 'Who rules', who),
        seat.controller.kind === 'ai'
          ? el('p', { class: 'cf-seat__manner' }, RIVALS[seat.controller.personality].manner)
          : null,
        field(`${id}-name`, 'Ruler', el('span', { class: 'cf-field__pair' }, name, reroll)),
        el(
          'div',
          { class: 'cf-field' },
          el('span', { class: 'cf-field__label' }, 'Form of address'),
          form,
        ),
        field(`${id}-town`, 'Town', el('span', { class: 'cf-field__pair' }, town, randomTown)),
        armsEditor(seat, index),
      ),
    );
  }

  function armsEditor(seat: SeatChoice, index: number): HTMLElement {
    const select = <T extends string>(
      label: string,
      values: readonly T[],
      value: T,
      change: (v: T) => void,
    ): HTMLElement => {
      const node = el(
        'select',
        { class: 'cf-field__input', 'aria-label': `${label}, seat ${index + 1}` },
        ...values.map((v) =>
          el('option', { value: v, selected: v === value }, v.replace('-', ' ')),
        ),
      );
      node.addEventListener('change', () => {
        change(node.value as T);
        render();
      });
      return el('label', { class: 'cf-arms-edit__part' }, el('span', {}, label), node);
    };
    const arms = seat.arms;
    const fresh = el(
      'button',
      { type: 'button', class: 'cf-button cf-button--small' },
      'Draw new arms',
    );
    fresh.addEventListener('click', () => {
      const taken = {
        fields: new Set(court.seats.filter((s) => s !== seat).map((s) => s.arms.field)),
        divisions: new Set(court.seats.filter((s) => s !== seat).map((s) => s.arms.division)),
      };
      seat.arms = drawArms(rng.fork(`arms:${draws++}`), taken);
      render();
    });
    return el(
      'details',
      { class: 'cf-arms-edit' },
      el('summary', {}, 'Change the arms'),
      el(
        'div',
        { class: 'cf-arms-edit__grid' },
        select<Tincture>(
          'Field',
          TINCTURES,
          arms.field,
          (v) => (seat.arms = lawful({ ...arms, field: v }, 'field')),
        ),
        select<Division>(
          'Division',
          DIVISIONS,
          arms.division,
          (v) => (seat.arms = lawful({ ...arms, division: v }, 'division')),
        ),
        select<Tincture>(
          'Second',
          TINCTURES,
          arms.second,
          (v) => (seat.arms = lawful({ ...arms, second: v }, 'second')),
        ),
        select<Charge>(
          'Charge',
          ['none', ...CHARGES],
          arms.charge,
          (v) => (seat.arms = lawful({ ...arms, charge: v }, 'charge')),
        ),
        select<Tincture>(
          'Charge colour',
          TINCTURES,
          arms.chargeTincture,
          (v) => (seat.arms = lawful({ ...arms, chargeTincture: v }, 'chargeTincture')),
        ),
        select<'1' | '3'>(
          'How many',
          ['1', '3'],
          String(arms.chargeCount) as '1' | '3',
          (v) => (seat.arms = lawful({ ...arms, chargeCount: v === '3' ? 3 : 1 }, 'count')),
        ),
      ),
      fresh,
    );
  }

  render();
  page.querySelector<HTMLElement>('select, input, button')?.focus();
  return () => page.remove();
}

function field(id: string, label: string, control: HTMLElement): HTMLElement {
  return el(
    'div',
    { class: 'cf-field' },
    el('label', { class: 'cf-field__label', for: id }, label),
    control,
  );
}

/** An AI seat for a personality, with its own character's name and town when they are free. */
function aiSeat(
  personality: Personality,
  court: Court,
  rng: ReturnType<typeof createRng>,
  arms?: ArmsSpec,
): SeatChoice {
  const character = RIVALS[personality];
  const names = new Set(court.seats.map((s) => s.name));
  const towns = new Set(court.seats.map((s) => s.town));
  const freeTowns = TOWNS.filter((t) => !towns.has(t));
  const freeNames = GIVEN_NAMES[character.form].filter((n) => !names.has(n));
  return {
    controller: { kind: 'ai', personality },
    name: names.has(character.name)
      ? rng.pick(freeNames.length > 0 ? freeNames : GIVEN_NAMES[character.form])
      : character.name,
    form: character.form,
    town: towns.has(character.town)
      ? rng.pick(freeTowns.length > 0 ? freeTowns : TOWNS)
      : character.town,
    arms: arms ?? drawArms(rng.fork('arms')),
  };
}

/**
 * The arms after one change, kept lawful: metal never on metal, colour never
 * on colour. The part just chosen stays; the others turn to contrast with it.
 */
export function lawful(
  arms: ArmsSpec,
  changed: 'field' | 'division' | 'second' | 'charge' | 'chargeTincture' | 'count',
): ArmsSpec {
  const next = { ...arms };
  const opposite = (t: Tincture): Tincture => (isMetal(t) ? 'azure' : 'or');
  const clash = (a: Tincture, b: Tincture): boolean => isMetal(a) === isMetal(b);
  if (next.division === 'paly') next.charge = 'none';
  if (!holdsThree(next.division)) next.chargeCount = 1;
  const divided = next.division !== 'plain';
  // On a fess, a pale or a bend the charge rides on the second tincture, elsewhere on the field.
  const onSecond = next.division === 'fess' || next.division === 'pale' || next.division === 'bend';

  if (changed === 'chargeTincture' && next.charge !== 'none') {
    // The charge's colour was chosen: its ground turns to contrast, then the other part to that.
    if (onSecond) {
      if (clash(next.chargeTincture, next.second)) next.second = opposite(next.chargeTincture);
      if (divided && clash(next.field, next.second)) next.field = opposite(next.second);
    } else {
      if (clash(next.chargeTincture, next.field)) next.field = opposite(next.chargeTincture);
      if (divided && clash(next.field, next.second)) next.second = opposite(next.field);
    }
    return next;
  }
  if (divided && clash(next.field, next.second)) {
    if (changed === 'second') next.field = opposite(next.second);
    else next.second = opposite(next.field);
  }
  if (next.charge !== 'none' && clash(next.chargeTincture, chargeGround(next))) {
    next.chargeTincture = opposite(chargeGround(next));
  }
  return next;
}

export function problemsOf(court: Court, mode: SetupMode): string[] {
  const problems: string[] = [];
  const humans = court.seats.filter((s) => s.controller.kind === 'human').length;
  if (humans === 0) problems.push('At least one seat must be a human player.');
  if (mode === 'hotseat' && humans < 2) problems.push('Hot-seat needs two human players or more.');
  if (court.seats.length < 2) problems.push('A race needs at least one rival.');
  const towns = court.seats.map((s) => s.town);
  if (new Set(towns).size !== towns.length)
    problems.push('Two seats share a town; give each its own.');
  if (court.seats.some((s) => s.name.trim() === '')) problems.push('Every ruler needs a name.');
  return problems;
}
