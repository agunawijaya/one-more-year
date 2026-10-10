/**
 * The plan screen's side panels.
 *
 * The decree tablet (left): land, food and seed, each with steppers and a
 * typed number, and the one button that ends the year. Limits are drawn,
 * never sprung: the seed line shows where the seed, the workers and the
 * land run out, and an impossible step gets a shake and one line of reason.
 *
 * The honest ledger (right): the city's numbers and, for this decree, the
 * exact consequences and the exact odds of what the year could bring.
 */
import { el, setText } from './dom.ts';
import {
  feverLine,
  foodResult,
  landNote,
  landResult,
  n,
  ratsLine,
  seedResult,
  WORDS,
} from './words.ts';
import { BUSHELS_PER_PERSON } from '../engine/rules.ts';
import { maxSownWith, peopleFedBy, seedFor, workersLimit } from '../engine/model.ts';
import type { Ledger } from '../engine/odds.ts';
import type { CityState, Decree } from '../engine/state.ts';
import { acresOf } from '../content/counts.ts';

type Field = 'land' | 'food' | 'plant';

export interface Tablet {
  element: HTMLElement;
  update(
    state: CityState,
    decree: Decree,
    issues: readonly { field?: string; message: string; level: string }[],
    notes: {
      lastYear: readonly string[];
      scribe: string | null;
      ghost: string | null;
      armed: boolean;
    },
  ): void;
  /** Moves focus to one decision (L, F, P). */
  focus(field: Field): void;
  /** A gentle no: shake the control and say why. */
  refuse(field: Field, reason: string): void;
}

interface StepperParts {
  root: HTMLElement;
  input: HTMLInputElement;
  result: HTMLElement;
  note: HTMLElement;
}

function stepper(
  field: Field,
  label: string,
  key: string,
  swatch: string,
  steps: readonly number[],
  keySteps: readonly [number, number],
  onStep: (field: Field, delta: number) => void,
  onType: (field: Field, value: number) => void,
  onCommit: () => void,
): StepperParts {
  const input = el('input', {
    type: 'text',
    inputmode: 'numeric',
    id: `th-${field}`,
    'aria-describedby': `th-${field}-result th-issue`,
    autocomplete: 'off',
  });
  // While a number is being typed the field keeps what the player wrote; otherwise it shows the decree.
  const apply = (): void => {
    if (input.dataset.typing !== 'true') return;
    delete input.dataset.typing;
    onType(field, Number(input.value.replace(/[^0-9-]/g, '')));
  };
  input.addEventListener('input', () => {
    input.dataset.typing = 'true';
  });
  input.addEventListener('change', apply);
  // Arrow keys step the value (Shift for the large step). Enter applies a typed number; with
  // nothing new typed, Enter ends the year, as it does anywhere else on the plan.
  input.addEventListener('keydown', (event) => {
    const up = event.key === 'ArrowUp' || event.key === 'ArrowRight';
    const down = event.key === 'ArrowDown' || event.key === 'ArrowLeft';
    if (up || down) {
      event.preventDefault();
      delete input.dataset.typing;
      onStep(field, (up ? 1 : -1) * (event.shiftKey ? keySteps[1] : keySteps[0]));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      if (input.dataset.typing === 'true') {
        apply();
        input.select();
      } else {
        onCommit();
      }
    }
  });
  const make = (delta: number): HTMLButtonElement => {
    const control = el(
      'button',
      {
        type: 'button',
        'aria-label': `${delta > 0 ? 'Add' : 'Take away'} ${Math.abs(delta)}`,
        tabindex: -1,
      },
      `${delta > 0 ? '+' : '−'}${Math.abs(delta)}`,
    );
    control.addEventListener('click', () => onStep(field, delta));
    return control;
  };
  const down = steps.map((step) => make(-step)).reverse();
  const up = steps.map((step) => make(step));
  const result = el('div', {
    class: 'th-decision__result',
    id: `th-${field}-result`,
    'aria-live': 'polite',
  });
  const note = el('div', { class: 'th-decision__note' });
  const root = el(
    'div',
    { class: 'th-decision', 'data-field': field },
    el(
      'div',
      { class: 'th-decision__head' },
      el(
        'label',
        { class: 'th-decision__name', for: `th-${field}`, style: `--swatch: ${swatch}` },
        el('i'),
        label,
        el('kbd', {}, key),
      ),
    ),
    note,
    el(
      'div',
      {
        class: 'th-stepper',
        style: `grid-template-columns: repeat(${down.length}, auto) 1fr repeat(${up.length}, auto)`,
      },
      ...down,
      input,
      ...up,
    ),
    result,
  );
  return { root, input, result, note };
}

export function createTablet(handlers: {
  step: (field: Field, delta: number) => void;
  type: (field: Field, value: number) => void;
  commit: () => void;
}): Tablet {
  const title = el('h2', {}, WORDS.decree);
  const land = stepper(
    'land',
    WORDS.land,
    'L',
    'var(--th-land)',
    [1, 10],
    [1, 10],
    handlers.step,
    handlers.type,
    handlers.commit,
  );
  const food = stepper(
    'food',
    WORDS.food,
    'F',
    'var(--th-food)',
    [1, 10],
    [1, 10],
    handlers.step,
    handlers.type,
    handlers.commit,
  );
  const seed = stepper(
    'plant',
    WORDS.seed,
    'P',
    'var(--th-seed)',
    [10, 100],
    [10, 100],
    handlers.step,
    handlers.type,
    handlers.commit,
  );
  const limits = el('div', { class: 'th-limits', 'aria-hidden': 'true' });
  seed.root.append(limits);
  const issue = el('p', { class: 'th-issue', id: 'th-issue', 'aria-live': 'polite' });
  const lastYear = el('div', { class: 'th-last' });
  const scribe = el('p', { class: 'th-scribe' });
  const ghost = el('p', { class: 'th-ghost' });
  const commit = el('button', { type: 'button', class: 'th-primary', 'data-action': 'end-year' });
  commit.addEventListener('click', () => handlers.commit());
  const element = el(
    'section',
    { class: 'th-tablet th-panel th-clay', 'aria-label': WORDS.decree },
    title,
    el('hr', { class: 'th-rule' }),
    land.root,
    food.root,
    seed.root,
    lastYear,
    ghost,
    scribe,
    // The reason a decree is refused sits with the button, so it is in view whenever the button is.
    el('div', { class: 'th-commit' }, issue, commit, el('p', {}, WORDS.noUndo)),
  );
  const parts: Record<Field, StepperParts> = { land, food, plant: seed };

  function drawLimits(state: CityState, decree: Decree): void {
    const owned = state.acres + decree.land;
    const workers = workersLimit(state.people);
    const seedable = maxSownWith(
      state.grain -
        Math.max(0, decree.land) * state.landPrice +
        Math.max(0, -decree.land) * state.landPrice -
        decree.food,
    );
    const scale = Math.max(owned, workers, 1);
    // Limits that fall at (nearly) the same place share one mark and one label.
    const marks: { at: number; labels: string[] }[] = [];
    for (const [at, label] of [
      [Math.min(seedable, scale), 'seed'],
      [workers, 'hands'],
      [owned, 'land'],
    ] as const) {
      const near = marks.find((mark) => Math.abs(mark.at - at) / scale < 0.06);
      if (near) near.labels.push(label);
      else marks.push({ at, labels: [label] });
    }
    limits.replaceChildren(
      el('div', { class: 'th-limits__track' }),
      el('div', {
        class: 'th-limits__fill',
        style: `width: ${(Math.min(decree.plant, scale) / scale) * 100}%`,
      }),
      ...marks.map((mark) =>
        el(
          'div',
          {
            class: 'th-limits__mark',
            style: `left: ${(mark.at / scale) * 100}%`,
            'data-edge': mark.at / scale > 0.85 ? 'end' : undefined,
          },
          el('span', {}, mark.labels.join(' · ')),
        ),
      ),
    );
  }

  return {
    element,
    update(state, decree, issues, notes) {
      setText(title, WORDS.decree);
      lastYear.replaceChildren(
        el('strong', {}, state.year === 1 ? 'The year before you' : 'Last year'),
        el('ul', {}, ...notes.lastYear.map((line) => el('li', {}, line))),
      );
      setText(scribe, notes.scribe ?? '');
      scribe.hidden = notes.scribe === null;
      setText(ghost, notes.ghost ?? '');
      ghost.hidden = notes.ghost === null;
      setText(land.note, landNote(state.landPrice));
      setText(land.result, landResult(decree.land, state.landPrice));
      const fed = Math.min(state.people, peopleFedBy(decree.food));
      setText(food.note, `Each person needs ${BUSHELS_PER_PERSON} bushels a year.`);
      setText(food.result, foodResult(fed, state.people, decree.food));
      setText(seed.note, 'Half a bushel of seed an acre; each person tends fewer than ten acres.');
      setText(seed.result, seedResult(decree.plant, seedFor(decree.plant)));
      for (const [field, part] of Object.entries(parts) as [Field, StepperParts][]) {
        const value = field === 'food' ? fed : decree[field];
        if (part.input.dataset.typing !== 'true') part.input.value = n(value);
        part.input.setAttribute(
          'aria-invalid',
          String(issues.some((i) => i.field === field && i.level === 'error')),
        );
      }
      drawLimits(state, decree);
      const blocking = issues.find((i) => i.level === 'error');
      const warning = issues.find((i) => i.level === 'warning');
      setText(issue, blocking?.message ?? warning?.message ?? '');
      const ending = warning?.message.includes('end your rule') ?? false;
      const label = notes.armed
        ? WORDS.endYearConfirm
        : ending
          ? WORDS.endYearAnyway
          : WORDS.endYear;
      commit.replaceChildren(label, el('kbd', {}, 'Enter'));
      commit.dataset.warning = String(ending);
      commit.disabled = blocking !== undefined;
    },
    focus(field) {
      parts[field].input.focus();
      parts[field].input.select();
    },
    refuse(field, reason) {
      const root = parts[field].root;
      // Restarting the animation needs a layout between removing and adding the class.
      root.classList.remove('th-shake');
      root.getBoundingClientRect();
      root.classList.add('th-shake');
      setText(issue, reason);
    },
  };
}

export interface LedgerPanel {
  element: HTMLElement;
  update(state: CityState, ledger: Ledger, hidden: boolean): void;
}

export function createLedgerPanel(): LedgerPanel {
  const city = el('dl');
  const lines = el('div', { class: 'th-lines', style: 'display: grid; gap: 12px' });
  const warning = el('p', { class: 'th-warning-line', hidden: true, role: 'alert' });
  const element = el(
    'section',
    // Focusable so that keyboard players can scroll it when it runs long.
    { class: 'th-ledger th-panel th-clay', 'aria-label': WORDS.ledger, tabindex: 0 },
    el('h2', {}, WORDS.ledger, el('small', {}, WORDS.ledgerNote)),
    el('hr', { class: 'th-rule' }),
    city,
    el('hr', { class: 'th-rule' }),
    warning,
    lines,
  );

  function line(
    name: string,
    value: string,
    kind: 'exact' | 'odds' | 'range',
    ...body: (Node | string)[]
  ): HTMLElement {
    const label = kind === 'exact' ? 'exact' : kind === 'odds' ? 'exact odds' : 'all outcomes';
    return el(
      'div',
      { class: 'th-line' },
      el(
        'div',
        { class: 'th-line__head' },
        el('strong', {}, name, el('em', { class: 'th-line__kind' }, label)),
        el('span', {}, value),
      ),
      ...body,
    );
  }

  function harvestBars(ledger: Ledger): HTMLElement {
    const top = Math.max(1, ...ledger.harvests.map((h) => h.bushels));
    return el(
      'div',
      {
        class: 'th-odds',
        style: `--faces: ${ledger.harvests.length}`,
        role: 'img',
        'aria-label': ledger.harvests
          .map((h) => `${h.yieldPerAcre} an acre: ${n(h.bushels)}`)
          .join('; '),
      },
      ...ledger.harvests.map((h) =>
        el(
          'div',
          { class: 'th-odds__bar' },
          el('i', {
            style: `height: calc((100% - 16px) * ${Math.max(0.06, h.bushels / top).toFixed(3)})`,
          }),
          el('span', {}, `${h.yieldPerAcre}×`),
        ),
      ),
    );
  }

  return {
    element,
    update(state, ledger, hidden) {
      const perPerson = state.acres / Math.max(1, state.people);
      city.replaceChildren(
        el('dt', {}, 'People'),
        el('dd', {}, n(state.people)),
        el('dt', {}, 'Grain'),
        el('dd', {}, n(state.grain)),
        el('dt', {}, 'Acres'),
        el('dd', {}, n(state.acres)),
        el('dt', {}, 'Acres each'),
        el('dd', {}, perPerson.toFixed(1)),
      );
      warning.hidden = !ledger.endsRule;
      warning.textContent =
        'This decree would end your rule: more than 45 in every 100 would go hungry.';
      if (hidden) {
        lines.replaceChildren(
          el('p', { class: 'th-decision__note' }, 'Forecasts are hidden in Settings.'),
        );
        return;
      }
      const low = ledger.harvests[0]?.bushels ?? 0;
      const high = ledger.harvests.at(-1)?.bushels ?? 0;
      lines.replaceChildren(
        line(
          'Fed',
          `${n(ledger.fed)} / ${n(ledger.people)}`,
          'exact',
          el(
            'p',
            {},
            ledger.hungry > 0 ? `${n(ledger.hungry)} would go hungry.` : 'No one goes hungry.',
          ),
        ),
        line(
          'Seed and hands',
          `${n(ledger.seed)} bu`,
          'exact',
          el(
            'p',
            {},
            `${n(ledger.workersNeeded)} of ${acresOf(ledger.workersLimit)} the people can tend.`,
          ),
        ),
        line(
          'Harvest',
          `${n(low)}–${n(high)}`,
          'odds',
          el(
            'p',
            {},
            `${ledger.harvests[0]?.yieldPerAcre ?? 1} to ${ledger.harvests.at(-1)?.yieldPerAcre ?? 5} bushels an acre, each equally likely.`,
          ),
          harvestBars(ledger),
        ),
        line(
          'Rats',
          `${ledger.rats.faces} in ${ledger.rats.of}`,
          'odds',
          el(
            'p',
            {},
            ratsLine(ledger.rats.faces, ledger.rats.of, ledger.rats.eaten, ledger.leftInStore),
          ),
        ),
        line(
          'Fever',
          `1 in ${ledger.fever.oneIn}`,
          'odds',
          el('p', {}, feverLine(ledger.fever.oneIn)),
        ),
        line(
          'Newcomers',
          `${n(ledger.newcomers.low)}–${n(ledger.newcomers.high)}`,
          'range',
          el('p', {}, 'More come when the store is full and the land is wide.'),
        ),
      );
    },
  };
}
