/**
 * The obituary as a page of an illuminated manuscript that writes itself.
 *
 * The decorated initial grows first, its vine climbing down the margin;
 * then the text is lettered word by word, with the quill at the point of
 * writing; the margin's small paintings appear as the lines that tell them
 * are written; and the candle at the foot of the page burns down and
 * gutters out as the last line is finished.
 *
 * `setProgress(t)` sets the whole page for any moment (0 blank, 1 done), so
 * it can be played, skipped, held for a screenshot or shown at once under
 * reduced motion.
 */
import type { Obituary } from '../content/obituary.ts';
import { el, svgNode } from './dom.ts';
import { miniatureSvg } from './miniatures.ts';
import { vellumMarkup, vellumSvg } from './vellum.ts';

export interface ManuscriptPage {
  readonly element: HTMLElement;
  setProgress(progress: number): void;
}

/** When each part of the page is done, as shares of the whole. */
const VINE_END = 0.14;
const TEXT_START = 0.12;
const TEXT_END = 0.9;

export function createManuscriptPage(
  obituary: Obituary,
  appearance: 'light' | 'dark',
): ManuscriptPage {
  const initialLetter = obituary.lead.charAt(0).toUpperCase();
  const words: HTMLElement[] = [];
  const text = el('div', { class: 'cf-ms__text' });
  obituary.paragraphs.forEach((sentences, index) => {
    const paragraph = el('p', { class: 'cf-ms__para' });
    let body = sentences.join(' ');
    if (index === 0 && body.startsWith(obituary.lead)) {
      // The opening words: the first letter is the decorated initial; the rest of the name is lettered in red.
      const rubric = el('span', { class: 'cf-ms__word cf-ms__rubric' }, obituary.lead.slice(1));
      words.push(rubric);
      paragraph.append(el('span', { class: 'cf-visually-hidden' }, initialLetter), rubric, ' ');
      body = body.slice(obituary.lead.length).trimStart();
    }
    for (const token of body.split(' ')) {
      const word = el('span', { class: 'cf-ms__word' }, token);
      words.push(word);
      paragraph.append(word, ' ');
    }
    text.append(paragraph);
  });
  const succession = el('p', { class: 'cf-ms__succession' });
  for (const token of obituary.succession.split(' ')) {
    const word = el('span', { class: 'cf-ms__word' }, token);
    words.push(word);
    succession.append(word, ' ');
  }
  text.append(succession);

  const quill = svgNode(QUILL);
  quill.classList.add('cf-ms__quill');
  const initial = svgNode(initialSvg(initialLetter, appearance));
  initial.classList.add('cf-ms__initial');
  const vine = svgNode(VINE);
  vine.classList.add('cf-ms__vine');
  const scenes = obituary.scenes.map((picture) => {
    const node = svgNode(miniatureSvg(picture));
    node.classList.add('cf-ms__scene');
    return node;
  });
  const candle = svgNode(CANDLE);
  candle.classList.add('cf-ms__candle');

  const element = el(
    'article',
    { class: 'cf-ms', 'data-appearance': appearance, 'aria-label': obituary.heading },
    svgNode(vellumSvg({ appearance, seed: obituary.lead.length * 31, id: 'cf-ms-vellum' })),
    el('div', { class: 'cf-ms__ruling', 'aria-hidden': 'true' }),
    el('header', { class: 'cf-ms__head' }, el('h1', {}, obituary.heading)),
    el('div', { class: 'cf-ms__margin', 'aria-hidden': 'true' }, vine),
    el('div', { class: 'cf-ms__body' }, initial, text, quill),
    el('aside', { class: 'cf-ms__scenes', 'aria-hidden': 'true' }, ...scenes),
    el('footer', { class: 'cf-ms__foot', 'aria-hidden': 'true' }, candle),
  );

  function setProgress(progress: number): void {
    const t = Math.min(1, Math.max(0, progress));
    const vineShare = Math.min(1, t / VINE_END);
    element.style.setProperty('--cf-vine', vineShare.toFixed(3));
    element.style.setProperty('--cf-initial', Math.min(1, t / (VINE_END * 0.8)).toFixed(3));
    const textShare = Math.min(1, Math.max(0, (t - TEXT_START) / (TEXT_END - TEXT_START)));
    const written = textShare * words.length;
    let current: HTMLElement | null = null;
    words.forEach((word, i) => {
      const share = Math.min(1, Math.max(0, written - i));
      word.style.setProperty('--cf-ink', share.toFixed(3));
      word.dataset.state = share >= 1 ? 'written' : share > 0 ? 'writing' : 'blank';
      if (share > 0 && share < 1) current = word;
    });
    // The quill rests at the end of whatever is being written.
    const writing = current as HTMLElement | null;
    const lastWritten = words[Math.min(words.length - 1, Math.floor(written) - 1)];
    const anchor = writing ?? (textShare < 1 ? lastWritten : null);
    if (anchor) {
      const share = writing ? Number(writing.style.getPropertyValue('--cf-ink')) : 1;
      quill.style.opacity = '1';
      quill.style.left = `${anchor.offsetLeft + anchor.offsetWidth * share}px`;
      quill.style.top = `${anchor.offsetTop}px`;
    } else {
      quill.style.opacity = '0';
    }
    scenes.forEach((scene, i) => {
      const appearAt = 0.25 + (i / Math.max(1, scenes.length)) * 0.55;
      scene.style.opacity = Math.min(1, Math.max(0, (textShare - appearAt) / 0.08)).toFixed(3);
    });
    const burnt = t;
    element.style.setProperty('--cf-candle', burnt.toFixed(3));
    element.style.setProperty(
      '--cf-flame',
      (t >= 0.98 ? 0 : 1 - (Math.max(0, t - 0.85) / 0.13) * 0.7).toFixed(3),
    );
  }
  setProgress(0);
  return { element, setProgress };
}

/**
 * The page as one standalone SVG, the share card for a ruler: the initial,
 * the lettered text, the margin paintings and the candle out. Text is laid
 * out in lines by an estimate of the typeface's width, since a file opened
 * elsewhere has no page to measure against.
 */
export function obituaryCardSvg(obituary: Obituary, appearance: 'light' | 'dark'): string {
  const dark = appearance === 'dark';
  const ink = dark ? '#efe3c8' : '#2b1f15';
  const rubric = dark ? '#e3b65c' : '#a12e1a';
  const font = "'EB Garamond Variable', 'EB Garamond', Georgia, serif";
  const escape = (text: string): string =>
    text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const width = 1080;
  const height = 1350;

  const lines: { text: string; rubric: boolean; gap: boolean }[] = [];
  const wrap = (text: string, columns: number, isRubric: boolean): void => {
    let line = '';
    for (const word of text.split(' ')) {
      if (line.length > 0 && line.length + 1 + word.length > columns) {
        lines.push({ text: line, rubric: isRubric, gap: false });
        line = word;
      } else {
        line = line.length > 0 ? `${line} ${word}` : word;
      }
    }
    if (line.length > 0) lines.push({ text: line, rubric: isRubric, gap: true });
  };
  obituary.paragraphs.forEach((sentences, i) => {
    const body = sentences.join(' ');
    // Beside the initial the lines are shorter; below it they run the full width.
    wrap(i === 0 ? body.slice(1) : body, lines.length < 5 ? 40 : 56, false);
  });
  wrap(obituary.succession, 56, true);

  let y = 330;
  const text = lines
    .map((line, i) => {
      const x = i < 5 ? 330 : 120;
      const row = `<text x="${x}" y="${y}" font-family="${font}" font-size="31" fill="${line.rubric ? rubric : ink}"${line.rubric ? ' font-style="italic"' : ''}>${escape(line.text)}</text>`;
      y += line.gap ? 58 : 44;
      return row;
    })
    .join('');
  const inner = (markup: string, x: number, y: number, size: number): string =>
    markup
      .replace('<svg ', `<svg x="${x}" y="${y}" width="${size}" height="${size}" `)
      .replace(/ width="\d+" height="\d+" aria-hidden/, ' aria-hidden');
  const scenes = obituary.scenes
    .map((picture, i) => inner(miniatureSvg(picture, 200), 140 + i * 280, height - 330, 200))
    .join('');
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">` +
    vellumMarkup({ appearance, seed: obituary.lead.length * 31, id: 'cf-card-vellum' }) +
    `<rect x="36" y="36" width="${width - 72}" height="${height - 72}" fill="none" stroke="#c9973f" stroke-width="3"/>` +
    `<rect x="46" y="46" width="${width - 92}" height="${height - 92}" fill="none" stroke="${rubric}" stroke-width="1.5"/>` +
    `<text x="${width / 2}" y="140" text-anchor="middle" font-family="${font}" font-size="40" font-weight="600" letter-spacing="6" fill="${rubric}">${escape(obituary.heading.toUpperCase())}</text>` +
    inner(initialSvg(obituary.lead.charAt(0).toUpperCase(), appearance), 110, 190, 196) +
    text +
    scenes +
    `<text x="${width / 2}" y="${height - 70}" text-anchor="middle" font-family="${font}" font-size="24" letter-spacing="3" fill="${rubric}">ONE MORE YEAR · CROWN OF FLORINS</text>` +
    `</svg>`
  );
}

// A goose quill: the shaft from the nib, a broad vane with its barbs, the tip curling away.
const QUILL =
  '<svg viewBox="0 0 80 130" width="60" height="98" aria-hidden="true">' +
  '<path d="M10 126C14 100 22 80 30 64C40 42 52 22 74 4C70 20 66 30 58 44C66 40 70 34 76 26C70 46 58 62 44 76C36 86 26 98 16 112Z" fill="#f1e8d2" stroke="#4a3626" stroke-width="1.5" stroke-linejoin="round"/>' +
  '<path d="M12 122C28 90 46 52 72 8" fill="none" stroke="#7a5a3a" stroke-width="1.4"/>' +
  '<path d="M30 80L42 74M36 70L50 62M42 58L58 48M48 46L64 34M24 92L34 88" stroke="#b9a582" stroke-width="1"/>' +
  '<path d="M10 126L13 114" stroke="#1d140e" stroke-width="2.6" stroke-linecap="round"/>' +
  '</svg>';

/** The decorated initial: a gold square, a lapis ground with white filigree, the letter in vermilion. */
function initialSvg(letter: string, appearance: 'light' | 'dark'): string {
  const ink = appearance === 'dark' ? '#e9d8b0' : '#2b1f15';
  return (
    `<svg viewBox="0 0 200 200" width="200" height="200" aria-hidden="true">` +
    `<defs><pattern id="cf-ms-filigree" width="16" height="16" patternUnits="userSpaceOnUse"><rect width="16" height="16" fill="#23417a"/><path d="M8 2C11 5 11 8 8 11C5 8 5 5 8 2ZM0 14H16" fill="none" stroke="#e8e0cc" stroke-width="0.8" opacity="0.8"/><circle cx="2" cy="2" r="1" fill="#e8e0cc"/></pattern>` +
    `<linearGradient id="cf-ms-leaf" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f3d27a"/><stop offset="0.5" stop-color="#c9973f"/><stop offset="1" stop-color="#f0cc70"/></linearGradient></defs>` +
    `<g class="cf-ms__initial-art">` +
    `<rect x="6" y="6" width="188" height="188" fill="url(#cf-ms-leaf)" stroke="${ink}" stroke-width="2"/>` +
    `<rect x="20" y="20" width="160" height="160" fill="url(#cf-ms-filigree)" stroke="#9e2b18" stroke-width="3"/>` +
    `<path d="M22 22C60 40 70 70 40 100C70 130 60 160 22 178" fill="none" stroke="#3f7a4f" stroke-width="5" opacity="0.85"/>` +
    `<path d="M178 22C140 40 130 70 160 100C130 130 140 160 178 178" fill="none" stroke="#3f7a4f" stroke-width="5" opacity="0.85"/>` +
    `<text x="100" y="152" text-anchor="middle" font-family="'EB Garamond Variable', 'EB Garamond', Georgia, serif" font-size="150" font-weight="700" fill="#b8321c" stroke="#f3e2b0" stroke-width="3" paint-order="stroke">${letter}</text>` +
    `</g></svg>`
  );
}

/** The vine that grows from the initial down the margin, with leaves and gold berries. */
const VINE =
  '<svg viewBox="0 0 120 900" width="120" height="900" preserveAspectRatio="xMidYMin meet" aria-hidden="true">' +
  '<path class="cf-ms__vine-stem" pathLength="1" d="M70 0C40 60 96 110 66 170C36 230 92 290 62 350C32 410 90 470 60 530C30 590 88 650 58 710C34 760 70 820 60 890" fill="none" stroke="#3f7a4f" stroke-width="4" stroke-linecap="round"/>' +
  Array.from({ length: 14 }, (_, i) => {
    const y = 40 + i * 62;
    const left = i % 2 === 0;
    const x = left ? 42 : 90;
    const leaf = left
      ? `M${x + 18} ${y}C${x} ${y - 16} ${x - 22} ${y - 4} ${x - 20} ${y + 14}C${x - 4} ${y + 16} ${x + 10} ${y + 8} ${x + 18} ${y}Z`
      : `M${x - 18} ${y}C${x} ${y - 16} ${x + 22} ${y - 4} ${x + 20} ${y + 14}C${x + 4} ${y + 16} ${x - 10} ${y + 8} ${x - 18} ${y}Z`;
    const colour = ['#3f7a4f', '#2a5a96', '#b3301e'][i % 3] ?? '#3f7a4f';
    return `<path class="cf-ms__vine-leaf" style="--at:${(i / 14).toFixed(3)}" d="${leaf}" fill="${colour}" stroke="#2b1f15" stroke-width="0.8"/><circle class="cf-ms__vine-leaf" style="--at:${(i / 14).toFixed(3)}" cx="${left ? x + 26 : x - 26}" cy="${y + 22}" r="4.5" fill="#d8aa3a" stroke="#7a5a1a" stroke-width="0.8"/>`;
  }).join('') +
  '</svg>';

const CANDLE =
  '<svg viewBox="0 0 120 160" width="120" height="160" aria-hidden="true">' +
  '<path d="M20 150H100L92 140H28Z" fill="#a08a64" stroke="#3a2a1e" stroke-width="1.5"/>' +
  '<path d="M40 140H80V136H40Z" fill="#7a6a52"/>' +
  '<rect class="cf-ms__wax" x="50" y="40" width="20" height="96" fill="#f1e6cc" stroke="#3a2a1e" stroke-width="1.2"/>' +
  '<g class="cf-ms__flame"><path d="M60 6C70 20 72 30 60 38C48 30 50 20 60 6Z" fill="#f2b23e" stroke="#b5641c" stroke-width="1"/><path d="M60 20C64 26 64 31 60 35C56 31 56 26 60 20Z" fill="#fff1c4"/></g>' +
  '<path class="cf-ms__smoke" d="M60 30C52 18 68 8 58 -6" fill="none" stroke="#8a7e70" stroke-width="2" stroke-linecap="round"/>' +
  '</svg>';
