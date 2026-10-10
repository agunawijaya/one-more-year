/**
 * `pnpm check`: the collection's guardrails, run in CI next to lint and the
 * tests. Each check prints its problems; any problem fails the run.
 *
 * - zero raster: no image files outside docs/media/, no inline raster data;
 * - offline: no network URLs in the built site (run `pnpm build` first);
 * - provenance: nothing imports or copies from the reference folder;
 * - fixtures: Pond and the catalog fixtures never reach the site.
 *
 * The phrase-level provenance scan needs the originals, which never enter
 * the repo, so it runs separately: `pnpm provenance <reference folder>`.
 */
import type { Problem } from './files.ts';
import { checkFixtures } from './fixtures.ts';
import { checkNetwork } from './network.ts';
import { checkRaster } from './raster.ts';
import { checkReferenceFolder } from './reference.ts';

const CHECKS: readonly [string, () => Problem[]][] = [
  ['Zero raster', checkRaster],
  ['No network URLs in the build', checkNetwork],
  ['Reference folder stays outside', checkReferenceFolder],
  ['Test fixtures stay out of the site', checkFixtures],
];

let failed = 0;
for (const [name, check] of CHECKS) {
  const problems = check();
  if (problems.length === 0) {
    console.warn(`✓ ${name}`);
    continue;
  }
  failed++;
  console.error(`✗ ${name}: ${problems.length} problem${problems.length === 1 ? '' : 's'}`);
  for (const problem of problems) {
    const where = problem.line === undefined ? problem.file : `${problem.file}:${problem.line}`;
    console.error(`    ${where}  ${problem.message}`);
  }
}
if (failed > 0) process.exitCode = 1;
