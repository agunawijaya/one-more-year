/**
 * The panels without a browser: the year screen shows what the engine says,
 * the controls answer the keys the manual promises, and the hot-seat curtain
 * carries nothing of anyone's realm.
 */
import { describe, expect, it, vi } from 'vitest';
import { quickCourt } from '../src/engine/court.ts';
import { crownModel } from '../src/engine/model.ts';
import { openingPlan } from '../src/engine/plan.ts';
import { actingRealm, createWorld } from '../src/engine/world.ts';
import { projectPlan } from '../src/game/year-model.ts';
import { showCurtain } from '../src/game/screens/handover.ts';
import { problemsOf } from '../src/game/screens/court-setup.ts';
import { amountControl, sealsControl } from '../src/ui/controls.ts';
import { createTabs } from '../src/ui/tabs.ts';
import { createYearScreen, titleWords, type YearView } from '../src/ui/year-screen.ts';
import { forecastYear } from '../src/game/year-model.ts';
import { titleName } from '../src/content/names.ts';

const world = createWorld(11, { scenario: 'standard', court: quickCourt(11, 1, 3) });
const realm = actingRealm(world);

function view(step: YearView['step'], hidden: number[] = []): YearView {
  const plan = openingPlan(realm);
  return {
    appearance: 'light',
    world,
    realm,
    plan,
    step,
    issues: crownModel.validate(world, plan),
    projection: projectPlan(world, realm, plan),
    forecast: null,
    forecastsShown: true,
    hiddenSeats: new Set(hidden),
    ghost: null,
  };
}

function screen(): ReturnType<typeof createYearScreen> {
  return createYearScreen({
    step: () => undefined,
    change: () => undefined,
    seal: () => undefined,
    pillarRead: () => undefined,
    pickBuilding: () => undefined,
  });
}

describe('the year screen', () => {
  it('shows the five steps, the seal, and the step being planned', () => {
    const year = screen();
    year.update(view('bread'));
    const steps = [...year.element.querySelectorAll('.cf-step')].map((s) =>
      s.getAttribute('data-step'),
    );
    expect(steps).toEqual(['harvest', 'market', 'bread', 'taxes', 'builders']);
    expect(year.element.querySelector('[aria-current="step"]')?.getAttribute('data-step')).toBe(
      'bread',
    );
    expect(year.element.querySelector('[data-action="seal"]')).not.toBeNull();
    expect(year.element.querySelector('[data-panel="bread"]')).not.toBeNull();
  });

  it('opens the harvest step with the year’s weather and what the people need', () => {
    const year = screen();
    year.update(view('harvest'));
    const text = year.element.querySelector('[data-panel="harvest"]')?.textContent ?? '';
    expect(text).toContain('The people need');
    expect(text.replace(/\D/g, '')).toContain(String(realm.opening?.demand));
  });

  it('keeps a hot-seat rival’s numbers out of the rival bar until the year’s end', () => {
    const year = screen();
    year.update(view('harvest', [1]));
    const hidden = year.element.querySelector('.cf-rival[data-hidden]');
    expect(hidden?.textContent).toContain('numbers shown at the year’s end');
    expect(hidden?.textContent).not.toMatch(/pts|soldiers/);
  });
});

describe('the year screen tells the truth plainly', () => {
  it('puts “Seal the year” in one place only, the step bar', () => {
    const year = screen();
    year.update(view('builders'));
    expect(year.element.querySelectorAll('[data-action="seal"]')).toHaveLength(1);
    expect(year.element.querySelector('.cf-steps [data-action="seal"]')).not.toBeNull();
    expect(year.element.querySelector('[data-panel="builders"] .cf-next--seal')).toBeNull();
  });

  it('sets panel headings as words, with no boxed initial', () => {
    const year = screen();
    year.update(view('taxes'));
    expect(year.element.querySelector('.cf-initial')).toBeNull();
    const heading = year.element.querySelector('[data-panel="taxes"] .cf-heading__words');
    expect(heading?.textContent).toBe('Taxes and justice');
  });

  it('names the title the review would give, and whether it changes', () => {
    const form = realm.ruler.form;
    expect(titleWords({ kind: 'exact', value: realm.title }, realm)).toBe(
      `${titleName(realm.title, form)} → stays`,
    );
    expect(titleWords({ kind: 'exact', value: realm.title + 1 }, realm)).toBe(
      `→ ${titleName(realm.title + 1, form)}`,
    );
    const plan = openingPlan(realm);
    const year = screen();
    year.update({ ...view('builders'), forecast: forecastYear(world, plan, 11, 0) });
    const preview = year.element.querySelector('.cf-preview')?.textContent ?? '';
    expect(preview).toContain('Title after the review');
    expect(preview).toContain(titleName(realm.title, form));
  });

  it('tells the treasury one way: after this plan, and expected at the year’s end', () => {
    const plan = openingPlan(realm);
    const year = screen();
    year.update({ ...view('taxes'), forecast: forecastYear(world, plan, 11, 0) });
    const money = year.element.querySelector('.cf-money')?.textContent ?? '';
    expect(money).toContain('After this plan');
    expect(money).toContain('Expected at the year’s end');
    expect(year.element.textContent).not.toContain('in every trial year');
    expect(year.element.querySelector('.cf-money__how')?.textContent).toContain('Soldiers’ pay');
  });
});

describe('a card of tabs', () => {
  it('moves between tabs with the arrow keys, Home and End, keeping one tab in the Tab order', () => {
    const tabs = createTabs('cf-test', 'Test', [
      { id: 'a', label: 'First', body: document.createElement('p') },
      { id: 'b', label: 'Second', body: document.createElement('p') },
      { id: 'c', label: 'Third', body: document.createElement('p') },
    ]);
    document.body.append(tabs.element);
    const tab = (id: string): HTMLElement =>
      tabs.element.querySelector<HTMLElement>(`[data-tab="${id}"]`) as HTMLElement;
    expect(tabs.selected).toBe('a');
    tab('a').dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(tabs.selected).toBe('b');
    expect(tab('b').getAttribute('aria-selected')).toBe('true');
    expect(tab('a').tabIndex).toBe(-1);
    tab('b').dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
    expect(tabs.selected).toBe('c');
    tab('c').dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(tabs.selected).toBe('a');
    expect(tabs.element.querySelector('[data-tab-panel="b"]')?.hasAttribute('hidden')).toBe(true);
    tabs.mark('c', 'in debt');
    expect(tab('c').hasAttribute('data-marked')).toBe(true);
    expect(tab('c').textContent).toContain('in debt');
    tabs.element.remove();
  });
});

describe('the controls', () => {
  it('move an amount by one step, ten with Shift, a hundred with Ctrl, and stop at the limits', () => {
    const onChange = vi.fn();
    const control = amountControl({
      id: 'x',
      label: 'Grain',
      unit: 'bushels',
      step: 100,
      big: 1000,
      onChange,
    });
    control.update(0, { min: -500, max: 50_000 }, '');
    const range = control.element.querySelector('input[type="range"]') as HTMLInputElement;
    range.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(onChange).toHaveBeenLastCalledWith(100);
    range.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowRight', shiftKey: true, bubbles: true }),
    );
    expect(onChange).toHaveBeenLastCalledWith(1100);
    range.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowRight', ctrlKey: true, bubbles: true }),
    );
    expect(onChange).toHaveBeenLastCalledWith(11_100);
    range.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
    expect(onChange).toHaveBeenLastCalledWith(-500);
  });

  it('move the seal of justice with the arrow keys', () => {
    const onChange = vi.fn();
    const seals = sealsControl(onChange);
    seals.update(2);
    const second = seals.element.querySelector('[data-level="2"]') as HTMLButtonElement;
    second.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(onChange).toHaveBeenLastCalledWith(3);
  });
});

describe('hot-seat', () => {
  it('draws a curtain with the arms and the ruler, and nothing of the realm’s numbers', () => {
    const host = document.createElement('div');
    const onReady = vi.fn();
    showCurtain(host, realm, world.year, onReady);
    const text = host.textContent;
    expect(text).toContain(realm.city);
    expect(text).not.toContain(String(realm.treasury));
    expect(text).not.toContain(String(realm.people.serfs));
    (host.querySelector('[data-action="ready"]') as HTMLButtonElement).click();
    expect(onReady).toHaveBeenCalled();
    expect(host.querySelector('.cf-curtain')).toBeNull();
  });

  it('asks for two humans at least before a hot-seat game begins', () => {
    expect(problemsOf(quickCourt(4, 1, 3), 'hotseat')).toContain(
      'Hot-seat needs two human players or more.',
    );
    expect(problemsOf(quickCourt(4, 2, 2), 'hotseat')).toEqual([]);
  });
});
