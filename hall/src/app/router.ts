/**
 * Hash routes (ADR-0005). Hash routing keeps the site a set of static files
 * that GitHub Pages can serve from any sub-path, and makes the browser's
 * Back button walk the player's own steps:
 *
 *   #/                         the Hall (optionally ?sim=<id> to focus one world)
 *   #/sim/<id>                 a simulation's game menu
 *   #/play/<id>?run=<runId>    resume a run
 *   #/play/<id>?new=<scenario>[&seats=2]   begin a new run
 *   #/play/<id>?daily          today's daily scenario
 *   #/play/<id>?replay=<chronicleId>        the same world again, with a ghost
 *   #/chronicles               the Library
 *   #/chronicles/<id>[?results]   a chronicle (as a run's results when ?results)
 *   #/codex[?sim=<id>]         the Codex
 *   #/legacy                   Legacy: rank, milestones, stats, the streak
 *   #/about                    the story of these programs and this project
 */

export type PlayRequest =
  | { kind: 'resume'; runId: string }
  | { kind: 'new'; scenario: string | null; seats: number }
  | { kind: 'daily' }
  | { kind: 'replay'; chronicleId: string };

export type Route =
  | { name: 'hall'; focus: string | null }
  | { name: 'sim'; simId: string }
  | { name: 'play'; simId: string; request: PlayRequest }
  | { name: 'library' }
  | { name: 'chronicle'; id: string; results: boolean }
  | { name: 'codex'; simId: string | null }
  | { name: 'legacy' }
  | { name: 'about' };

export function parseRoute(hash: string): Route {
  const trimmed = hash.replace(/^#\/?/, '');
  const [path = '', query = ''] = trimmed.split('?');
  const params = new URLSearchParams(query);
  const parts = path.split('/').filter(Boolean).map(decodeURIComponent);
  const [first, second] = parts;

  switch (first) {
    case undefined:
      return { name: 'hall', focus: params.get('sim') };
    case 'sim':
      return second ? { name: 'sim', simId: second } : home();
    case 'play':
      return second ? { name: 'play', simId: second, request: playRequest(params) } : home();
    case 'chronicles':
      return second
        ? { name: 'chronicle', id: second, results: params.has('results') }
        : { name: 'library' };
    case 'codex':
      return { name: 'codex', simId: params.get('sim') };
    case 'legacy':
      return { name: 'legacy' };
    case 'about':
      return { name: 'about' };
    default:
      return home();
  }
}

function home(): Route {
  return { name: 'hall', focus: null };
}

function playRequest(params: URLSearchParams): PlayRequest {
  const run = params.get('run');
  if (run) return { kind: 'resume', runId: run };
  if (params.has('daily')) return { kind: 'daily' };
  const replay = params.get('replay');
  if (replay) return { kind: 'replay', chronicleId: replay };
  const seats = Number.parseInt(params.get('seats') ?? '1', 10);
  return {
    kind: 'new',
    scenario: emptyAsNull(params.get('new')),
    seats: Number.isInteger(seats) && seats >= 1 && seats <= 6 ? seats : 1,
  };
}

function emptyAsNull(value: string | null): string | null {
  return value === null || value === '' ? null : value;
}

export function routeHash(route: Route): string {
  const enc = encodeURIComponent;
  switch (route.name) {
    case 'hall':
      return route.focus ? `#/?sim=${enc(route.focus)}` : '#/';
    case 'sim':
      return `#/sim/${enc(route.simId)}`;
    case 'play':
      return `#/play/${enc(route.simId)}${requestQuery(route.request)}`;
    case 'library':
      return '#/chronicles';
    case 'chronicle':
      return `#/chronicles/${enc(route.id)}${route.results ? '?results' : ''}`;
    case 'codex':
      return route.simId ? `#/codex?sim=${enc(route.simId)}` : '#/codex';
    case 'legacy':
      return '#/legacy';
    case 'about':
      return '#/about';
  }
}

function requestQuery(request: PlayRequest): string {
  const enc = encodeURIComponent;
  switch (request.kind) {
    case 'resume':
      return `?run=${enc(request.runId)}`;
    case 'daily':
      return '?daily';
    case 'replay':
      return `?replay=${enc(request.chronicleId)}`;
    case 'new': {
      const params = [request.scenario ? `new=${enc(request.scenario)}` : 'new='];
      if (request.seats > 1) params.push(`seats=${request.seats}`);
      return `?${params.join('&')}`;
    }
  }
}

export interface Router {
  current(): Route;
  /** Adds a history entry (Back returns here). */
  go(route: Route): void;
  /** Replaces the current entry, e.g. when a new run gets its id. */
  replace(route: Route): void;
  subscribe(listener: (route: Route) => void): () => void;
  dispose(): void;
}

export function createRouter(target: Window = window): Router {
  const listeners = new Set<(route: Route) => void>();
  const notify = (): void => {
    const route = parseRoute(target.location.hash);
    for (const listener of listeners) listener(route);
  };
  target.addEventListener('hashchange', notify);
  return {
    current: () => parseRoute(target.location.hash),
    go(route) {
      const hash = routeHash(route);
      if (target.location.hash === hash) notify();
      else target.location.hash = hash;
    },
    replace(route) {
      // replaceState does not fire hashchange: the page already shows this route.
      target.history.replaceState(target.history.state, '', routeHash(route));
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    dispose() {
      target.removeEventListener('hashchange', notify);
      listeners.clear();
    },
  };
}
