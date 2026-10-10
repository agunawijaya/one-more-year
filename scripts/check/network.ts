/**
 * Offline (hard rule 3): the built site never asks the network for anything.
 * This scans hall/dist for absolute http(s) URLs in code and styles. A few
 * URLs are names, not requests (the SVG and XHTML namespaces), the GitHub
 * links to each simulation's docs are plain anchors the player may choose to
 * follow, and one is a citation in a comment inside three.js's shader source
 * (PMREMGenerator cites the paper its sampling comes from); those are allowed.
 *
 * The end-to-end suite backs this up in a real browser (site/network.spec.ts).
 */
import { existsSync, readFileSync } from 'node:fs';
import { extname, join, relative, sep } from 'node:path';
import { REPO_ROOT, filesUnder, type Problem } from './files.ts';

const URL_PATTERN = /https?:\/\/[^\s"'`)<>\\]+/g;
const ALLOWED = [
  /^http:\/\/www\.w3\.org\//,
  /^https:\/\/github\.com\//,
  /^https:\/\/en\.wikipedia\.org\/wiki\//,
  /^https:\/\/jcgt\.org\/published\/0007\/04\/01\/$/,
];
const SCANNED = new Set(['.js', '.css', '.html']);

export function checkNetwork(dist = join(REPO_ROOT, 'hall', 'dist')): Problem[] {
  if (!existsSync(dist)) {
    return [{ file: 'hall/dist', message: 'no build found; run `pnpm build` before `pnpm check`' }];
  }
  const problems: Problem[] = [];
  for (const path of filesUnder(dist)) {
    if (!SCANNED.has(extname(path))) continue;
    const file = relative(REPO_ROOT, path).split(sep).join('/');
    const text = readFileSync(path, 'utf8');
    for (const match of text.matchAll(URL_PATTERN)) {
      const url = match[0];
      if (ALLOWED.some((allowed) => allowed.test(url))) continue;
      problems.push({ file, message: `network URL in built code: ${url}` });
    }
  }
  return problems;
}
