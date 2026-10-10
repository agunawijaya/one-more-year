/**
 * Shared helpers for the guardrail checks: which files belong to the repo,
 * which of them ship to players, and a line-by-line matcher that reports
 * where a pattern was found.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, relative, sep } from 'node:path';

export interface Problem {
  file: string;
  line?: number;
  message: string;
}

export const REPO_ROOT = join(import.meta.dirname, '..', '..');

const SKIPPED_FOLDERS = new Set([
  'node_modules',
  '.git',
  'dist',
  'coverage',
  'test-results',
  'playwright-report',
  'blob-report',
  '.vite',
]);

const TEXT_EXTENSIONS = new Set([
  '.ts',
  '.js',
  '.mjs',
  '.cjs',
  '.css',
  '.html',
  '.json',
  '.md',
  '.svg',
  '.yml',
  '.yaml',
  '.txt',
]);

/** Every file in the repo as a forward-slash path relative to the root. */
export function repoFiles(root = REPO_ROOT): string[] {
  const found: string[] = [];
  const walk = (folder: string): void => {
    for (const name of readdirSync(folder)) {
      if (SKIPPED_FOLDERS.has(name)) continue;
      const path = join(folder, name);
      if (statSync(path).isDirectory()) walk(path);
      else found.push(relative(root, path).split(sep).join('/'));
    }
  };
  walk(root);
  return found.sort();
}

/** Every file under a folder (used for the built site in dist/). */
export function filesUnder(folder: string): string[] {
  const found: string[] = [];
  const walk = (current: string): void => {
    for (const name of readdirSync(current)) {
      const path = join(current, name);
      if (statSync(path).isDirectory()) walk(path);
      else found.push(path);
    }
  };
  walk(folder);
  return found.sort();
}

export function isText(file: string): boolean {
  return TEXT_EXTENSIONS.has(extname(file).toLowerCase());
}

/** Source that ends up in the website: the Hall, the kit and the simulations (tests excluded). */
export function isShippedSource(file: string): boolean {
  if (/(^|\/)(tests|e2e)\//.test(file)) return false;
  return /^(hall\/src|hall\/index\.html|packages\/[^/]+\/src|games\/[^/]+\/(src|manifest\.ts))/.test(
    file,
  );
}

export function readText(file: string, root = REPO_ROOT): string {
  return readFileSync(join(root, file), 'utf8');
}

export function matchingLines(
  file: string,
  pattern: RegExp,
  root = REPO_ROOT,
): { line: number; text: string }[] {
  const hits: { line: number; text: string }[] = [];
  readText(file, root)
    .split('\n')
    .forEach((text, index) => {
      if (pattern.test(text)) hits.push({ line: index + 1, text });
    });
  return hits;
}
