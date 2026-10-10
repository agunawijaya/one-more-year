/**
 * `pnpm docs:sims`: rewrites the list of simulations in README.md from the
 * same sources the Hall's registry uses, so the README never disagrees with
 * the site. The list sits between two markers:
 *
 *   <!-- sims:start --> … <!-- sims:end -->
 *
 * Planned worlds come from hall/src/data/coming-soon.ts; built ones from
 * games/<id>/manifest.ts, which replace a placeholder with the same id.
 * Original titles stay out of the README (they belong in CREDITS and About),
 * so each row describes its original by the manifest's generic uiTitle.
 *
 * `pnpm docs:sims --check` changes nothing and fails if the list is stale.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { format, resolveConfig } from 'prettier';
import type { SimManifest } from '../packages/kit/src/contract.ts';
import { REPO_ROOT } from './check/files.ts';
import { catalogManifests } from './manifests.ts';

const README = join(REPO_ROOT, 'README.md');
const START = '<!-- sims:start -->';
const END = '<!-- sims:end -->';

function span([low, high]: readonly [number, number]): string {
  return low === high ? String(low) : `${low}–${high}`;
}

function row(manifest: SimManifest): string {
  const about = join(REPO_ROOT, 'games', manifest.id, 'docs', 'ABOUT.md');
  const title = existsSync(about)
    ? `[${manifest.title}](games/${manifest.id}/docs/ABOUT.md)`
    : manifest.title;
  const status = manifest.status === 'playable' ? 'Playable' : 'In preparation';
  const length = `${span(manifest.typicalTurns)} ${manifest.turnUnit}s · ${span(manifest.sessionMinutes)} min`;
  return `| ${title} | ${manifest.tagline} | ${manifest.domain} | ${length} | ${manifest.players} | ${manifest.inspiredBy.uiTitle} | ${status} |`;
}

function table(manifests: readonly SimManifest[]): string {
  return [
    '| World | In one line | Domain | A run | Players | After | Status |',
    '|---|---|---|---|---|---|---|',
    ...manifests.map(row),
  ].join('\n');
}

const checkOnly = process.argv.includes('--check');
const readme = readFileSync(README, 'utf8');
const start = readme.indexOf(START);
const end = readme.indexOf(END);
if (start < 0 || end < start) {
  console.error(`README.md needs the markers ${START} and ${END} around the simulation list.`);
  process.exit(1);
}

const list = table(await catalogManifests());
// Formatted as Prettier would, so `pnpm lint` and this script never disagree about the table.
const next = await format(
  `${readme.slice(0, start + START.length)}\n\n${list}\n\n${readme.slice(end)}`,
  { ...(await resolveConfig(README)), filepath: README },
);

if (next === readme) {
  console.warn('README.md simulation list is up to date.');
} else if (checkOnly) {
  console.error('README.md simulation list is stale: run `pnpm docs:sims`.');
  process.exit(1);
} else {
  writeFileSync(README, next);
  console.warn('README.md simulation list rewritten.');
}
