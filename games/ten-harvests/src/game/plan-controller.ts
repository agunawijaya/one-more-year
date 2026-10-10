/**
 * The plan screen at work: one decree, three ways to shape it (the granary
 * bar, the decree tablet and the city itself), always in step.
 *
 * In the city: drag the glowing edge of the fields outward to buy land or
 * inward to sell it (snapping to ten-acre parcels, Escape to cancel); click
 * a field to sow it or leave it fallow, or drag across fields to paint.
 * Right-drag or Q / E turn the view. The decree is the play session's
 * draft, so leaving and coming back finds it as it was.
 */
import { formatNumber, type PlaySession, type SimContext } from '@one-more-year/kit';
import { maxSownWith, seedFor, workersLimit } from '../engine/model.ts';
import { ledgerFor } from '../engine/odds.ts';
import { rulesFor } from '../engine/rules.ts';
import type { CityState, Decree } from '../engine/state.ts';
import { glyphFor, scribeAdvice } from '../content/text.ts';
import { HIGHLIGHT } from '../scene/fields.ts';
import type { Parcel } from '../scene/layout.ts';
import { groundPoint } from '../scene/picking.ts';
import { PLAN_POSE, type CityView } from '../scene/view.ts';
import type { CityWorld } from '../scene/world.ts';
import { el } from '../ui/dom.ts';
import { createPlanScreen, type PlanScreen } from '../ui/plan-screen.ts';
import type { YearTile } from '../ui/strip.ts';
import type { OptionStore } from './options.ts';
import { acresOf, bushelsOf } from '../content/counts.ts';

const n = (value: number): string => formatNumber(value);

export interface PlanDeps {
  ctx: SimContext;
  session: PlaySession<CityState, Decree>;
  world: CityWorld;
  view: CityView;
  options: OptionStore;
  scenarioTitle: string;
  /** Asked to end the year with the current draft. */
  endYear(): void;
  openConsole(): void;
}

export interface PlanController {
  readonly element: HTMLElement;
  readonly screen: PlanScreen;
  refresh(): void;
  dispose(): void;
}

/** The years of the current term as strip tiles: lived ones with their glyph, then now, then to come. */
export function termTiles(session: PlaySession<CityState, Decree>): YearTile[] {
  const state = session.engine.state;
  const rules = rulesFor(state.scenario);
  const first = state.term.firstYear;
  return Array.from({ length: rules.yearsPerTerm }, (_, i) => {
    const year = first + i;
    const record = session.engine.history.find((r) => r.turn === year);
    const harvest = record?.events.find((e) => e.kind === 'harvest');
    const yieldPerAcre = harvest?.numbers.yield ?? 0;
    return {
      year: year - first + 1,
      state: record ? 'past' : year === state.year ? 'now' : 'future',
      glyph: record ? glyphFor(record) : '',
      caption: record ? `harvest ${yieldPerAcre}×` : year === state.year ? 'now' : '',
    } satisfies YearTile;
  });
}

/** Short lines about the year just lived, for the decree tablet. */
export function lastYearLines(state: CityState): string[] {
  const last = state.last;
  const lines = [`Harvest ${bushelsOf(last.yieldPerAcre)} an acre: ${n(last.harvest)} in all`];
  lines.push(last.ratsAte > 0 ? `Rats ate ${bushelsOf(last.ratsAte)}` : 'The rats stayed away');
  if (last.hungry > 0) lines.push(`${n(last.hungry)} went hungry`);
  lines.push(
    last.newcomers === 1 ? 'One newcomer arrived' : `${n(last.newcomers)} newcomers arrived`,
  );
  if (last.feverLost > 0) lines.push(`Fever took ${n(last.feverLost)}`);
  return lines;
}

export function createPlanController(deps: PlanDeps): PlanController {
  const { ctx, session, world, view } = deps;
  const engine = session.engine;
  let armed = false;
  let armTimer: ReturnType<typeof setTimeout> | null = null;
  /** The fields chosen for sowing once the player has painted; null means "the nearest ones". */
  let mask: Set<number> | null = null;

  const screen = createPlanScreen(ctx.manifest.emblem, {
    change: (decree) => setDecree(decree),
    commit: () => tryEndYear(),
  });
  view.attach(screen.dioramaHost);
  view.setPose(PLAN_POSE, ctx.appearance.reducedMotion ? 0 : 1.2);
  view.setDrift(0);
  const tip = el('div', { class: 'th-field-tip', hidden: true, role: 'status' });
  screen.dioramaHost.append(tip);

  function state(): CityState {
    return engine.state;
  }

  function setDecree(decree: Decree): void {
    if (engine.phase !== 'plan') return;
    engine.setDraft(decree);
    disarm();
    fitMask();
    refresh();
  }

  /** Keeps painted fields in step when the acres sown change elsewhere (bar, steppers). */
  function fitMask(): void {
    if (!mask) return;
    const owned = world.ownedParcels;
    const want = Math.round(engine.draft.plant / 10);
    for (const slot of [...mask]) if (slot >= owned) mask.delete(slot);
    for (let slot = 0; mask.size < want && slot < owned; slot++) mask.add(slot);
    const extra = [...mask].sort((a, b) => b - a);
    while (mask.size > want && extra.length > 0) mask.delete(extra.shift() as number);
  }

  function disarm(): void {
    armed = false;
    if (armTimer !== null) clearTimeout(armTimer);
    armTimer = null;
  }

  function tryEndYear(): void {
    if (engine.phase !== 'plan') return;
    const blocking = engine.issues().find((issue) => issue.level === 'error');
    if (blocking) {
      const field =
        blocking.field === 'land' || blocking.field === 'food' ? blocking.field : 'plant';
      screen.refuse(field, blocking.message);
      return;
    }
    if (ledgerFor(state(), engine.draft).endsRule && !armed) {
      armed = true;
      armTimer = setTimeout(() => {
        disarm();
        refresh();
      }, 5000);
      refresh();
      return;
    }
    disarm();
    deps.endYear();
  }

  function refresh(): void {
    const city = state();
    const decree = engine.draft;
    const ledger = ledgerFor(city, decree);
    const settings = ctx.settings.get();
    const ghost = session.lastTime('people');
    screen.update({
      state: city,
      decree,
      issues: engine.issues(),
      ledger,
      turnLabel: session.turnLabel,
      scenarioTitle: deps.scenarioTitle,
      years: termTiles(session),
      forecastsHidden: settings.forecasts === 'hidden',
      lastYear: lastYearLines(city),
      scribe: scribeAdvice(city, decree, ledger, settings.advisorHints),
      ghost:
        ghost !== null && session.ghost ? `Last time, at this point: ${n(ghost)} people.` : null,
      armed,
    });
    world.show({
      people: city.people,
      grain: Math.max(0, ledger.leftInStore),
      acres: city.acres + decree.land,
      planted: decree.plant,
      season: 1,
      yieldPerAcre: null,
      landChange: decree.land,
      sacks: {
        food: decree.food,
        seed: seedFor(decree.plant),
        land: Math.max(0, decree.land) * city.landPrice,
      },
      ...(mask ? { plantedSlots: mask } : {}),
      showFrontier: true,
    });
    paintHover();
  }

  // ---- the city under the pointer ---------------------------------------------------

  type Drag =
    | { kind: 'land'; startLand: number }
    | { kind: 'paint'; sow: boolean }
    | { kind: 'orbit'; lastX: number };
  let drag: Drag | null = null;
  let hovered: Parcel | null = null;

  function pointAt(event: PointerEvent): { x: number; z: number } | null {
    return groundPoint(view.camera, view.canvas, event.clientX, event.clientY);
  }

  function nearFrontier(point: { x: number; z: number }): boolean {
    const handle = world.frontier.group;
    return (
      handle.visible && Math.hypot(point.x - handle.position.x, point.z - handle.position.z) < 3.4
    );
  }

  function showTip(event: PointerEvent, text: string | null): void {
    tip.hidden = text === null;
    if (text === null) return;
    const box = screen.dioramaHost.getBoundingClientRect();
    tip.textContent = text;
    tip.style.left = `${event.clientX - box.left + 16}px`;
    tip.style.top = `${event.clientY - box.top + 12}px`;
  }

  function landTo(parcel: Parcel): void {
    const city = state();
    const decree = engine.draft;
    const target = (parcel.index + 1) * 10 - city.acres;
    // Buying draws on what would otherwise be kept; selling may go down to the last acre.
    const keep = city.grain - decree.food - seedFor(decree.plant);
    const most = Math.max(0, Math.floor(keep / city.landPrice));
    const land = Math.max(-(city.acres - 1), Math.min(most, target));
    if (land !== decree.land) setDecree({ ...decree, land });
  }

  function sowingCap(decree: Decree): number {
    const city = state();
    const left = city.grain - decree.land * city.landPrice - decree.food;
    return Math.max(
      0,
      Math.min(city.acres + decree.land, workersLimit(city.people), maxSownWith(left)),
    );
  }

  function paint(parcel: Parcel, sow: boolean): void {
    if (parcel.index >= world.ownedParcels) return;
    mask ??= new Set(Array.from({ length: Math.round(engine.draft.plant / 10) }, (_, i) => i));
    if (sow === mask.has(parcel.index)) return;
    const decree = engine.draft;
    if (sow) {
      const cap = sowingCap(decree);
      if ((mask.size + 1) * 10 > cap) {
        screen.refuse('plant', `Seed and hands for ${acresOf(cap)} at most.`);
        return;
      }
      mask.add(parcel.index);
    } else {
      mask.delete(parcel.index);
    }
    engine.setDraft({ ...decree, plant: Math.min(mask.size * 10, sowingCap(decree)) });
    disarm();
    refresh();
  }

  function paintHover(): void {
    if (!hovered) return;
    const slot = hovered.index;
    if (slot < world.ownedParcels + 40) world.fields.setHighlight(slot, HIGHLIGHT.hover);
    world.fields.commit();
  }

  function onPointerDown(event: PointerEvent): void {
    if (engine.phase !== 'plan') return;
    if (event.button === 2) {
      if (deps.options.get('orbit')) drag = { kind: 'orbit', lastX: event.clientX };
      return;
    }
    const point = pointAt(event);
    if (!point) return;
    view.canvas.setPointerCapture(event.pointerId);
    if (nearFrontier(point)) {
      drag = { kind: 'land', startLand: engine.draft.land };
      world.frontier.setActive(true);
      return;
    }
    const parcel = world.picker.parcelAt(point.x, point.z);
    if (parcel && parcel.index < world.ownedParcels) {
      const sown = mask
        ? mask.has(parcel.index)
        : parcel.index < Math.round(engine.draft.plant / 10);
      drag = { kind: 'paint', sow: !sown };
      paint(parcel, !sown);
    }
  }

  function onPointerMove(event: PointerEvent): void {
    if (drag?.kind === 'orbit') {
      view.orbit((event.clientX - drag.lastX) * -0.006);
      drag.lastX = event.clientX;
      return;
    }
    const point = pointAt(event);
    const parcel = point ? world.picker.parcelAt(point.x, point.z) : null;
    if (drag?.kind === 'land' && parcel) landTo(parcel);
    if (drag?.kind === 'paint' && parcel) paint(parcel, drag.sow);
    if (parcel?.index !== hovered?.index) {
      hovered = parcel;
      refresh();
    }
    view.canvas.style.cursor =
      drag?.kind === 'land' || (point && nearFrontier(point))
        ? 'grab'
        : parcel
          ? 'pointer'
          : 'default';
    showTip(event, tipFor(parcel, point));
  }

  function tipFor(parcel: Parcel | null, point: { x: number; z: number } | null): string | null {
    const city = state();
    const decree = engine.draft;
    if (drag?.kind === 'land' || (point && nearFrontier(point))) {
      if (decree.land > 0)
        return `Buy ${acresOf(decree.land)} · ${bushelsOf(decree.land * city.landPrice)}`;
      if (decree.land < 0)
        return `Sell ${acresOf(-decree.land)} · ${bushelsOf(-decree.land * city.landPrice)}`;
      return `Drag to buy or sell land · ${city.landPrice} bushels an acre`;
    }
    if (!parcel) return null;
    if (parcel.index >= world.ownedParcels)
      return `On offer · ${bushelsOf(10 * city.landPrice)} for ten acres`;
    const sown = mask ? mask.has(parcel.index) : parcel.index < Math.round(decree.plant / 10);
    return sown ? 'Sown · click to leave it fallow' : 'Fallow · click to sow it';
  }

  function onPointerUp(event: PointerEvent): void {
    if (view.canvas.hasPointerCapture(event.pointerId))
      view.canvas.releasePointerCapture(event.pointerId);
    if (drag?.kind === 'land') world.frontier.setActive(false);
    drag = null;
  }

  function onPointerLeave(): void {
    tip.hidden = true;
    hovered = null;
  }

  function onKey(event: KeyboardEvent): void {
    if (engine.phase !== 'plan' || event.defaultPrevented) return;
    const target = event.target as HTMLElement | null;
    const typing = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement;
    if (event.key === 'Escape' && drag?.kind === 'land') {
      setDecree({ ...engine.draft, land: drag.startLand });
      drag = null;
      world.frontier.setActive(false);
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }
    if (typing || event.altKey || event.ctrlKey || event.metaKey) return;
    switch (event.key.toLowerCase()) {
      case 'enter':
        if (target?.tagName === 'BUTTON' && target.dataset.action !== 'end-year') return;
        event.preventDefault();
        tryEndYear();
        break;
      case 'l':
        event.preventDefault();
        screen.focusField('land');
        break;
      case 'f':
        event.preventDefault();
        screen.focusField('food');
        break;
      case 'p':
        event.preventDefault();
        screen.focusField('plant');
        break;
      case 't':
        event.preventDefault();
        deps.openConsole();
        break;
      case 'q':
        if (deps.options.get('orbit')) view.orbit(0.22);
        break;
      case 'e':
        if (deps.options.get('orbit')) view.orbit(-0.22);
        break;
    }
  }

  const canvas = view.canvas;
  const preventMenu = (event: Event): void => event.preventDefault();
  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', onPointerUp);
  canvas.addEventListener('pointerleave', onPointerLeave);
  canvas.addEventListener('contextmenu', preventMenu);
  window.addEventListener('keydown', onKey, true);
  const stopSettings = ctx.settings.subscribe(() => refresh());

  refresh();

  return {
    element: screen.element,
    screen,
    refresh,
    dispose() {
      disarm();
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointercancel', onPointerUp);
      canvas.removeEventListener('pointerleave', onPointerLeave);
      canvas.removeEventListener('contextmenu', preventMenu);
      window.removeEventListener('keydown', onKey, true);
      stopSettings();
      canvas.style.cursor = 'default';
      world.frontier.placeAt(null, world.layout.granary);
      tip.remove();
    },
  };
}
