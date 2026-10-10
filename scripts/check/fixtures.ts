/**
 * Test fixtures stay tests. Pond (the test-only simulation) and the
 * generated catalog fixtures live under hall/tests/ and are served only by
 * the harness page; nothing the site ships may import them, and the built
 * site must contain no trace of them (run `pnpm build` first).
 */
import { existsSync, readFileSync } from 'node:fs';
import { extname, join, relative, sep } from 'node:path';
import {
  REPO_ROOT,
  filesUnder,
  isShippedSource,
  matchingLines,
  repoFiles,
  type Problem,
} from './files.ts';

const IMPORTS_FIXTURE = /from ['"][^'"]*(?:tests\/fixtures|tests\/harness)[^'"]*['"]/;
// Strings that exist only in the fixtures: Pond's scene classes, its manifest and the harness.
const FIXTURE_TRACES = ['pond-scene', 'Pond (test fixture)', 'harness.html', 'fixture-manifests'];

export function checkFixtures(
  files = repoFiles(),
  dist = join(REPO_ROOT, 'hall', 'dist'),
): Problem[] {
  const problems: Problem[] = [];
  for (const file of files.filter(isShippedSource)) {
    for (const hit of matchingLines(file, IMPORTS_FIXTURE)) {
      problems.push({ file, line: hit.line, message: 'shipped code imports a test fixture' });
    }
  }
  if (!existsSync(dist)) return problems;
  for (const path of filesUnder(dist)) {
    if (!['.js', '.css', '.html'].includes(extname(path))) continue;
    const text = readFileSync(path, 'utf8');
    for (const trace of FIXTURE_TRACES) {
      if (text.includes(trace)) {
        problems.push({
          file: relative(REPO_ROOT, path).split(sep).join('/'),
          message: `built site contains "${trace}"`,
        });
      }
    }
  }
  return problems;
}
