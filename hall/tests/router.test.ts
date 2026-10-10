import { describe, expect, it } from 'vitest';
import { parseRoute, routeHash, type Route } from '../src/app/router.ts';

describe('router', () => {
  const routes: [string, Route][] = [
    ['#/', { name: 'hall', focus: null }],
    ['#/?sim=pond', { name: 'hall', focus: 'pond' }],
    ['#/sim/pond', { name: 'sim', simId: 'pond' }],
    [
      '#/play/pond?run=abc',
      { name: 'play', simId: 'pond', request: { kind: 'resume', runId: 'abc' } },
    ],
    [
      '#/play/pond?new=overgrown',
      { name: 'play', simId: 'pond', request: { kind: 'new', scenario: 'overgrown', seats: 1 } },
    ],
    [
      '#/play/pond?new=still-water&seats=2',
      { name: 'play', simId: 'pond', request: { kind: 'new', scenario: 'still-water', seats: 2 } },
    ],
    ['#/play/pond?daily', { name: 'play', simId: 'pond', request: { kind: 'daily' } }],
    [
      '#/play/pond?replay=c-1',
      { name: 'play', simId: 'pond', request: { kind: 'replay', chronicleId: 'c-1' } },
    ],
    ['#/chronicles', { name: 'library' }],
    ['#/chronicles/c-1', { name: 'chronicle', id: 'c-1', results: false }],
    ['#/chronicles/c-1?results', { name: 'chronicle', id: 'c-1', results: true }],
    ['#/codex', { name: 'codex', simId: null }],
    ['#/codex?sim=pond', { name: 'codex', simId: 'pond' }],
    ['#/legacy', { name: 'legacy' }],
    ['#/about', { name: 'about' }],
  ];

  it.each(routes)('reads %s', (hash, route) => {
    expect(parseRoute(hash)).toEqual(route);
  });

  it.each(routes)('writes %s back', (hash, route) => {
    expect(parseRoute(routeHash(route))).toEqual(parseRoute(hash));
  });

  it('falls back to the Hall for anything unknown', () => {
    expect(parseRoute('')).toEqual({ name: 'hall', focus: null });
    expect(parseRoute('#/nowhere/at/all')).toEqual({ name: 'hall', focus: null });
    expect(parseRoute('#/play')).toEqual({ name: 'hall', focus: null });
  });

  it('keeps hot-seat counts within one to six', () => {
    expect(parseRoute('#/play/pond?new=x&seats=9')).toMatchObject({ request: { seats: 1 } });
  });
});
