/**
 * What a Hall theme is (ADR-0004).
 *
 * A theme is a renderer for the Hall's main view plus a set of tokens that
 * skin the shared chrome (top bar, dialogs, chronicle page, Library, Codex,
 * Legacy, About). It reads the Hall snapshot and calls Hall actions; it
 * never reads storage and never knows which simulations exist beyond what
 * the snapshot lists, so adding a simulation never touches a theme.
 *
 * Each theme also tells demos how to draw (engraving, instrument, diorama)
 * and in which colours, and gives charts their tokens, separately for light
 * and dark: six art-directed variants, never one palette recoloured.
 */
import type { Appearance, ChartTokens, DemoPalette, DemoStyle } from '@one-more-year/kit';
import type { DemoHost } from '../app/demos.ts';
import type { HallServices } from '../app/services.ts';
import type { HallSnapshot } from '../data/hall-model.ts';
import type { ThemeId } from './theme-ids.ts';

export interface HallActions {
  /** Focus a simulation (the Almanac's right page, a briefing panel, a lifted dome). */
  focus(simId: string): void;
  begin(simId: string, scenario?: string | null): void;
  continueRun(simId: string, runId: string): void;
  playDaily(simId: string): void;
  gameMenu(simId: string): void;
  howToPlay(simId: string): void;
  openChronicle(id: string): void;
  openLibrary(): void;
  openCodex(simId?: string): void;
  openLegacy(): void;
  openAbout(): void;
}

export interface ThemeContext {
  services: HallServices;
  actions: HallActions;
  demos: DemoHost;
  appearance(): Appearance;
  reducedMotion(): boolean;
  /** The simulation to show focused when the view opens (from #/?sim=…). */
  initialFocus: string | null;
}

export interface ThemeView {
  update(snapshot: HallSnapshot): void;
  focus(simId: string | null): void;
  setAppearance(appearance: Appearance, reducedMotion: boolean): void;
  dispose(): void;
}

export interface Theme {
  id: ThemeId;
  demoStyle: DemoStyle;
  demoPalette(appearance: Appearance): DemoPalette;
  chartTokens(appearance: Appearance): ChartTokens;
  /** The main Hall view. */
  mount(container: HTMLElement, snapshot: HallSnapshot, context: ThemeContext): ThemeView;
}
