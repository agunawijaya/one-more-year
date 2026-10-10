/**
 * The simulation contract: what every simulation gives the Hall and what
 * the Hall gives every simulation (ADR-0002).
 *
 * A simulation is one folder, `games/<id>/`, with two entry points:
 *
 * - `manifest.ts` exports a `SimManifest`: plain data the Hall reads at
 *   start-up to draw the catalog, so it must stay small and import nothing
 *   heavy;
 * - `src/index.ts` exports a `SimModule` as its default export, loaded with
 *   import() only when the simulation is opened or its demo comes into view.
 *
 * A simulation that is only planned is a manifest with status 'coming-soon'
 * and no module; every theme still draws it.
 */
import type { AmbienceBed, AudioEngine, CueName } from './audio.ts';
import type { ChronicleEntry, RunHistory } from './chronicle.ts';
import type { CodexEntryDef, Discovery, SimCodex } from './codex.ts';
import type { DemoHandle, DemoLook } from './demo.ts';
import type { MilestoneDef, SimMilestones } from './milestones.ts';
import type { Migration } from './save.ts';
import type { RunStore } from './runs.ts';
import type { HandoverOptions, Seats } from './seats.ts';
import type { Appearance, ResolvedSettings, SimSettings } from './settings.ts';
import type { NumberStyle, Unit } from './format.ts';
import type { Signals, TurnRecord } from './turns.ts';

export type SimStatus = 'playable' | 'coming-soon';
export type Domain = 'governance' | 'economy' | 'ecology' | 'society' | 'journey' | 'physics';
export type TurnUnit = 'year' | 'season' | 'month' | 'week' | 'day';

/** One of the 2–4 headline numbers a world produces (§4.1 of the foundation prompt). */
export interface SignalDef {
  id: string;
  label: string;
  /** Null for pure counts that read fine on their own ("People 120"). */
  unit: Unit | null;
  format: NumberStyle;
  /** True if more is better, false if less is better, null if neither (a balance). */
  higherIsBetter: boolean | null;
}

/** A curated starting world with its own twist (§6.4). */
export interface ScenarioSummary {
  id: string;
  title: string;
  /** One sentence: what makes this world different. */
  twist: string;
  /** 1 gentle, 2 standard, 3 demanding. */
  difficulty: 1 | 2 | 3;
}

export interface InspiredBy {
  originalTitle: string;
  /** A generic description for on-screen use, e.g. "the 1968 grain-and-land simulation". */
  uiTitle: string;
  year: number;
  credit: string;
}

export interface SimManifest {
  /** kebab-case: the folder name and the route. */
  id: string;
  /** Our own title. */
  title: string;
  /** One line for the card. */
  tagline: string;
  /** Two or three sentences: why play this today. */
  teaser: string;
  domain: Domain;
  turnUnit: TurnUnit;
  /** Typical length in turns, e.g. [10, 10] or [20, 45]. */
  typicalTurns: readonly [number, number];
  /** '1–6P' means hot-seat on one device, players taking turns. */
  players: '1P' | '1–6P';
  sessionMinutes: readonly [number, number];
  status: SimStatus;
  /** The simulation's colour as ribbon, rubric and highlight; each must pass AA on its theme's paper. */
  accent: { light: string; dark: string };
  /** SVG path data in a 24×24 viewBox, drawn by every theme. */
  emblem: string;
  inspiredBy: InspiredBy;
  hasDailyScenario: boolean;
  /** Curated starting worlds; the first is the default. May be empty while coming soon. */
  scenarios: readonly ScenarioSummary[];
  signals: readonly SignalDef[];
  /** The signal the Hall leads with (sparklines, Continue cards); defaults to the first. */
  primarySignal?: string;
}

/** What a run is opened for. */
export type Launch =
  | { kind: 'menu' }
  | { kind: 'new'; scenario: string | null; seats: number; seatNames: readonly string[] }
  | { kind: 'resume'; runId: string }
  | { kind: 'daily' }
  | { kind: 'replay'; chronicle: ChronicleEntry };

/** The four places a simulation's screen can be, for the Hall's chrome and URL. */
export type SimView = 'menu' | 'plan' | 'report' | 'results';

export interface PauseItem {
  id: string;
  label: string;
  onSelect: () => void;
}

export interface AppearanceFeed {
  readonly current: Appearance;
  readonly reducedMotion: boolean;
  subscribe(listener: (appearance: Appearance, reducedMotion: boolean) => void): () => void;
}

export interface DailyInfo {
  /** UTC day key, e.g. "2026-10-09". */
  day: string;
  /** #1 on launch day. */
  number: number;
  seed: number;
  /** True once a daily run of this simulation was begun today. */
  played: boolean;
}

/** Sent after every resolved turn. */
export interface TurnSummary {
  runId: string;
  record: TurnRecord<unknown>;
  turnLabel: string;
  signals: Signals;
  discoveries: readonly Discovery[];
}

/** Sent once when a run ends. */
export interface RunReport {
  chronicle: ChronicleEntry;
  /** 'hall': the Hall shows the chronicle page; 'game': the simulation shows its own end screen. */
  presentation: 'hall' | 'game';
}

/** Where the simulation asks the Hall to go. */
export type Destination = 'game-menu' | 'hall' | { launch: Launch };

export interface SimAudio {
  play(cue: CueName | (string & {})): void;
  define: AudioEngine['define'];
  setAmbience: AudioEngine['setAmbience'];
}

/** Everything the Hall hands a simulation when it mounts. */
export interface SimContext {
  readonly manifest: SimManifest;
  readonly launch: Launch;
  readonly audio: SimAudio;
  readonly settings: {
    /** Global settings (read-only here; the Hall's settings panel changes them). */
    get(): ResolvedSettings;
    subscribe(listener: (settings: ResolvedSettings) => void): () => void;
    /** This simulation's own options. */
    readonly sim: SimSettings;
  };
  readonly appearance: AppearanceFeed;
  /** This simulation's runs (saves), already set to its save version. */
  readonly runs: RunStore;
  readonly milestones: SimMilestones;
  readonly codex: SimCodex;
  readonly daily: DailyInfo;
  readonly seats: {
    create(count: number, names?: readonly string[]): Seats;
    handover(host: HTMLElement, options: HandoverOptions): () => void;
  };
  /** Milliseconds since the epoch; the Hall's clock, so tests can fix it. */
  now(): number;
  reportTurn(summary: TurnSummary): void;
  reportRun(report: RunReport): void;
  /** Marks today's daily scenario as begun (it keeps the Almanac streak). */
  markDailyPlayed(): void;
  /** Opens the Hall's share sheet for a chronicle. */
  share(chronicle: ChronicleEntry): void;
  /**
   * Tells the Hall where the player is. Pass the run id with 'plan' and
   * 'report' so the address bar can resume that run after a reload.
   */
  setView(view: SimView, runId?: string | null): void;
  /** Items the pause menu shows between Resume and How to play. */
  setPauseItems(items: readonly PauseItem[]): void;
  openSettings(): void;
  openHowToPlay(): void;
  /** Asks the Hall to forget this simulation's data (the Hall confirms first). */
  forgetData(): void;
  navigate(to: Destination): void;
}

export interface SimInstance {
  pause(reason: 'menu' | 'hidden'): void;
  resume(): void;
  /** Shows the simulation's own title screen. */
  gameMenu(): void;
  /** With autosave per turn this is almost always 'safe'; a half-edited plan is the exception. */
  leaveCheck(): 'safe' | 'would-lose-progress';
  /** Keeps the half-edited plan with the run, when the player chooses to on leaving. */
  keepDraft?(): void;
  dispose(): void;
}

/** What the Hall gives a demo. */
export type DemoContext = DemoLook;

/** How a simulation's saves are versioned (see runs.ts). */
export interface SaveFormat {
  version: number;
  migrations?: Readonly<Record<number, Migration>>;
}

/** A milestone the play session can check by itself. */
export type AutoMilestoneDef = MilestoneDef & {
  /** Checked when a run ends. */
  atRunEnd?: (history: RunHistory) => boolean;
  /** Unlocks when this many codex entries are discovered ('all' for every one). */
  codexDiscovered?: number | 'all';
};

/** One section of the How to play dialog. */
export interface HowToPlaySection {
  heading: string;
  text: string;
}

export interface SimModule {
  manifest: SimManifest;
  /** The short manual the pause menu's How to play shows; the full one is HOW-TO-PLAY.md. */
  howToPlay: readonly HowToPlaySection[];
  milestones: readonly AutoMilestoneDef[];
  codex: readonly CodexEntryDef[];
  saves: SaveFormat;
  /** The world's ambience bed, which the Hall may play faintly when the world is hovered. */
  ambience?: AmbienceBed;
  mount(host: HTMLElement, ctx: SimContext): SimInstance;
  demo(host: HTMLElement, seed: number, ctx: DemoContext): DemoHandle;
}
