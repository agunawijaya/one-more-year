/**
 * The stele's relief, designed as data: a list of shapes, each an SVG path
 * with a height (how far it stands out of the stone). The same list is
 * rasterised into a height map for the three.js stele and written out as an
 * SVG for the share card, so the carved stone and the shared picture are
 * one design.
 *
 * Design space: 1000 × 2250 units (the stele's face, 4.2 × 9.45 world
 * units). Top to bottom: the rounded head with the emblem and the epithet
 * as an ornamental band; one register per year; the verdict at the foot.
 *
 * Motifs per year are read from what happened: wheat sheaves sized and
 * counted by the yield, a storage jar filled to the store, rats, the fever's
 * spirals, a row of lanterns for newcomers, a closed door for the hungry.
 * The ornamental band is our own pattern of rings, bars and chevrons built
 * from the epithet's letters; it is not a real script and never uses
 * wedge-shaped signs that could be mistaken for one.
 */

export const FACE = { width: 1000, height: 2250 } as const;

/** Heights of the relief: the stone's face, raised motifs, the sunk ground of a register. */
export const LEVEL = { face: 1, motif: 0.92, ground: 0.34, deep: 0.18 } as const;

export interface ReliefShape {
  /** SVG path data in design units. */
  d: string;
  height: number;
  /** Which register this belongs to (−1 for the head, 99 for the foot); the carving reveals by register. */
  register: number;
  /** Soften the shape's edges (design units): a rounded, chiselled profile. */
  bevel: number;
}

export interface ReliefText {
  text: string;
  x: number;
  y: number;
  size: number;
  height: number;
  register: number;
  letterSpacing: number;
}

export interface RegisterBox {
  index: number;
  top: number;
  bottom: number;
}

export interface Relief {
  shapes: ReliefShape[];
  texts: ReliefText[];
  registers: RegisterBox[];
  /** The rounded head's outline, so the slab can be cut to the same shape. */
  outline: string;
}

/** What one year left on the stone. */
export interface YearMark {
  year: number;
  yieldPerAcre: number;
  /** Grain in store at the end of the year, 0–1 of the term's fullest store. */
  storeShare: number;
  ratsAte: number;
  feverLost: number;
  newcomers: number;
  hungry: number;
}

export interface StelePlan {
  epithet: string;
  verdict: string;
  /** A short line under the verdict, e.g. "Ten years on the river · 1,320 acres". */
  footnote: string;
  years: readonly YearMark[];
  /** Registers to draw (10 for a term). Years not lived stay smooth stone. */
  registers: number;
}

const HEAD_BOTTOM = 400;
const FOOT_TOP = 1950;
const MARGIN = 64;

// ---- small path builders --------------------------------------------------------

const f = (value: number): string => (Math.round(value * 10) / 10).toString();

function rect(x: number, y: number, w: number, h: number, r = 0): string {
  if (r <= 0) return `M${f(x)} ${f(y)}h${f(w)}v${f(h)}h${f(-w)}Z`;
  return (
    `M${f(x + r)} ${f(y)}h${f(w - 2 * r)}a${f(r)} ${f(r)} 0 0 1 ${f(r)} ${f(r)}v${f(h - 2 * r)}` +
    `a${f(r)} ${f(r)} 0 0 1 ${f(-r)} ${f(r)}h${f(-(w - 2 * r))}a${f(r)} ${f(r)} 0 0 1 ${f(-r)} ${f(-r)}` +
    `v${f(-(h - 2 * r))}a${f(r)} ${f(r)} 0 0 1 ${f(r)} ${f(-r)}Z`
  );
}

function circle(cx: number, cy: number, r: number): string {
  return `M${f(cx - r)} ${f(cy)}a${f(r)} ${f(r)} 0 1 0 ${f(2 * r)} 0a${f(r)} ${f(r)} 0 1 0 ${f(-2 * r)} 0Z`;
}

function ellipse(cx: number, cy: number, rx: number, ry: number, turn = 0): string {
  // A rotated ellipse as two arcs.
  const cos = Math.cos(turn);
  const sin = Math.sin(turn);
  const x1 = cx - rx * cos;
  const y1 = cy - rx * sin;
  const x2 = cx + rx * cos;
  const y2 = cy + rx * sin;
  const degrees = (turn * 180) / Math.PI;
  return `M${f(x1)} ${f(y1)}A${f(rx)} ${f(ry)} ${f(degrees)} 1 0 ${f(x2)} ${f(y2)}A${f(rx)} ${f(ry)} ${f(degrees)} 1 0 ${f(x1)} ${f(y1)}Z`;
}

/** A thick stroke from a to b, as a filled quad with rounded ends. */
function stroke(x1: number, y1: number, x2: number, y2: number, width: number): string {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const length = Math.hypot(dx, dy) || 1;
  const nx = (-dy / length) * (width / 2);
  const ny = (dx / length) * (width / 2);
  const r = width / 2;
  return (
    `M${f(x1 + nx)} ${f(y1 + ny)}L${f(x2 + nx)} ${f(y2 + ny)}` +
    `A${f(r)} ${f(r)} 0 0 0 ${f(x2 - nx)} ${f(y2 - ny)}L${f(x1 - nx)} ${f(y1 - ny)}` +
    `A${f(r)} ${f(r)} 0 0 0 ${f(x1 + nx)} ${f(y1 + ny)}Z`
  );
}

// ---- motifs ---------------------------------------------------------------------

/**
 * A wheat sheaf: three to five stalks gathered at a tie, flaring below it
 * and fanning above, each crowned with a long ear of plump grains.
 */
function sheaf(x: number, baseY: number, size: number): string[] {
  const parts: string[] = [];
  const tieY = baseY - size * 0.36;
  const leans = [-0.36, -0.16, 0.04, 0.22, 0.4];
  for (const lean of leans) {
    const footX = x + lean * size * 0.34;
    const tipX = x + lean * size * 0.7;
    const tipY = baseY - size * (0.86 - Math.abs(lean) * 0.18);
    parts.push(stroke(footX, baseY, x + lean * size * 0.06, tieY, size * 0.045));
    parts.push(stroke(x + lean * size * 0.06, tieY, tipX, tipY, size * 0.04));
    // The ear: a column of grains, alternating left and right, along the stalk's direction.
    const angle = Math.atan2(tipY - tieY, tipX - (x + lean * size * 0.06));
    for (let g = 0; g < 5; g++) {
      const along = size * (0.04 + g * 0.055);
      const gx = tipX + Math.cos(angle) * along;
      const gy = tipY + Math.sin(angle) * along;
      const side = g % 2 === 0 ? 1 : -1;
      const ox = -Math.sin(angle) * side * size * 0.028;
      const oy = Math.cos(angle) * side * size * 0.028;
      parts.push(ellipse(gx + ox, gy + oy, size * 0.042, size * 0.024, angle));
    }
  }
  parts.push(rect(x - size * 0.13, tieY - size * 0.035, size * 0.26, size * 0.07, size * 0.03));
  return parts;
}

/** A storage jar with a band at the level of the store. */
function jar(x: number, baseY: number, height: number, share: number): string[] {
  const w = height * 0.62;
  const body = ellipse(x, baseY - height * 0.42, w / 2, height * 0.42);
  const neck = rect(x - w * 0.22, baseY - height * 0.98, w * 0.44, height * 0.2, 4);
  const level = baseY - height * 0.08 - Math.max(0, Math.min(1, share)) * height * 0.72;
  const band = rect(x - w * 0.52, level - 5, w * 1.04, 10, 4);
  return [body, neck, band];
}

function rat(x: number, y: number, size: number): string[] {
  return [
    ellipse(x, y, size * 0.5, size * 0.26),
    circle(x - size * 0.42, y - size * 0.06, size * 0.17),
    circle(x - size * 0.48, y - size * 0.26, size * 0.09),
    stroke(x + size * 0.45, y + size * 0.05, x + size * 1.05, y - size * 0.2, size * 0.08),
  ];
}

/** The fever: a loose spiral, carved as a chain of shrinking beads. */
function spiral(cx: number, cy: number, radius: number): string[] {
  const parts: string[] = [];
  for (let i = 0; i < 26; i++) {
    const t = i / 25;
    const angle = t * Math.PI * 4.2;
    const r = radius * (1 - t * 0.85);
    parts.push(circle(cx + Math.cos(angle) * r, cy + Math.sin(angle) * r, 6 * (1 - t * 0.5)));
  }
  return parts;
}

function lantern(x: number, baseY: number, size: number): string[] {
  return [
    rect(x - size * 0.22, baseY - size * 0.62, size * 0.44, size * 0.5, size * 0.08),
    stroke(x, baseY - size * 0.62, x, baseY - size * 0.88, size * 0.07),
    ellipse(x, baseY - size * 0.37, size * 0.09, size * 0.16),
  ];
}

/** A closed door with a bar across: the households that went hungry. */
function door(x: number, baseY: number, height: number): string[] {
  const w = height * 0.62;
  const arch = `M${f(x - w / 2)} ${f(baseY)}V${f(baseY - height + w / 2)}A${f(w / 2)} ${f(w / 2)} 0 0 1 ${f(x + w / 2)} ${f(baseY - height + w / 2)}V${f(baseY)}Z`;
  return [
    arch,
    stroke(x - w * 0.62, baseY - height * 0.45, x + w * 0.62, baseY - height * 0.45, 12),
  ];
}

/** A calm river line, for a quiet year with nothing else to tell. */
function ripples(x1: number, x2: number, y: number): string[] {
  const parts: string[] = [];
  for (let row = 0; row < 2; row++) {
    for (let x = x1; x < x2; x += 46) {
      const yy = y + row * 22;
      parts.push(`M${f(x)} ${f(yy)}q11.5 -14 23 0t23 0v8q-11.5 -14 -23 0t-23 0Z`);
    }
  }
  return parts;
}

// ---- the ornamental band ----------------------------------------------------------

/** One ornament per letter: two or three of rings, bars, dots and chevrons, chosen by the letter. */
function ornament(code: number, x: number, y: number, size: number): string[] {
  const pick = (salt: number): number => ((code * 2654435761 + salt * 40503) >>> 0) % 6;
  const parts: string[] = [];
  const s = size;
  const choices = [pick(1), pick(2), code % 3 === 0 ? pick(3) : -1];
  choices.forEach((choice, slot) => {
    const cy = y + (slot - 1) * s * 0.36;
    switch (choice) {
      case 0:
        parts.push(circle(x, cy, s * 0.14), circle(x, cy, s * 0.05));
        break;
      case 1:
        parts.push(stroke(x - s * 0.22, cy, x + s * 0.22, cy, s * 0.08));
        break;
      case 2:
        parts.push(circle(x - s * 0.13, cy, s * 0.06), circle(x + s * 0.13, cy, s * 0.06));
        break;
      case 3:
        parts.push(
          stroke(x - s * 0.22, cy + s * 0.08, x, cy - s * 0.1, s * 0.07),
          stroke(x, cy - s * 0.1, x + s * 0.22, cy + s * 0.08, s * 0.07),
        );
        break;
      case 4:
        parts.push(stroke(x, cy - s * 0.15, x, cy + s * 0.15, s * 0.08));
        break;
      case 5:
        parts.push(rect(x - s * 0.12, cy - s * 0.12, s * 0.24, s * 0.24, s * 0.05));
        break;
      default:
        break;
    }
  });
  return parts;
}

/** One row of ornaments between two raised rules: one ornament for each word's first letters. */
function ornamentalBand(text: string, top: number, width: number): string[] {
  const letters = Array.from(text.replace(/[^A-Za-z]/g, '')).slice(0, 13);
  const span = width - 260;
  const step = span / Math.max(1, letters.length);
  const start = (FACE.width - span) / 2 + step / 2;
  const parts: string[] = [
    rect((FACE.width - span) / 2 - 20, top - 44, span + 40, 7, 3),
    rect((FACE.width - span) / 2 - 20, top + 37, span + 40, 7, 3),
  ];
  letters.forEach((letter, i) =>
    parts.push(...ornament(letter.charCodeAt(0), start + i * step, top, 62)),
  );
  return parts;
}

/** The collection's wheat-over-river emblem, large, for the head of the stele. */
function emblem(cx: number, cy: number): string[] {
  return [...sheaf(cx, cy + 70, 132), ...ripples(cx - 115, cx + 115, cy + 92)];
}

// ---- the layout ---------------------------------------------------------------------

export function steleOutline(): string {
  // A slab with a rounded head: straight sides, a semi-elliptical top.
  const w = FACE.width;
  const shoulder = 300;
  return `M0 ${FACE.height}V${shoulder}A${w / 2} ${shoulder} 0 0 1 ${w} ${shoulder}V${FACE.height}Z`;
}

export function buildRelief(plan: StelePlan): Relief {
  const shapes: ReliefShape[] = [];
  const texts: ReliefText[] = [];
  const add = (paths: readonly string[], height: number, register: number, bevel = 6): void => {
    for (const d of paths) shapes.push({ d, height, register, bevel });
  };

  // The head: a sunk field inside the arch, the emblem and the ornamental band raised in it.
  const shoulder = 300;
  const inset = 46;
  const headField = `M${inset} ${HEAD_BOTTOM - 14}V${shoulder}A${FACE.width / 2 - inset} ${shoulder - inset} 0 0 1 ${FACE.width - inset} ${shoulder}V${HEAD_BOTTOM - 14}Z`;
  add([headField], LEVEL.ground, -1, 10);
  add(emblem(FACE.width / 2, 112), LEVEL.motif, -1, 7);
  add(ornamentalBand(plan.epithet, 300, FACE.width), LEVEL.motif, -1, 5);

  // The registers, one per year, each a sunk band framed by the stone.
  const registers: RegisterBox[] = [];
  const count = Math.max(1, plan.registers);
  const span = (FOOT_TOP - HEAD_BOTTOM) / count;
  for (let i = 0; i < count; i++) {
    const top = HEAD_BOTTOM + i * span + 7;
    const bottom = HEAD_BOTTOM + (i + 1) * span - 7;
    registers.push({ index: i, top, bottom });
    add([rect(MARGIN, top, FACE.width - MARGIN * 2, bottom - top, 10)], LEVEL.ground, i, 8);
    const mark = plan.years[i];
    if (mark) addYear(mark, top, bottom, i);
  }

  function addYear(mark: YearMark, top: number, bottom: number, register: number): void {
    const height = bottom - top;
    const base = bottom - height * 0.16;
    // The year in a small cartouche at the left.
    add(
      [rect(MARGIN + 14, top + height * 0.18, 96, height * 0.64, 18)],
      LEVEL.face - 0.06,
      register,
      6,
    );
    texts.push({
      text: String(mark.year),
      x: MARGIN + 62,
      y: top + height * 0.5,
      size: height * 0.44,
      height: LEVEL.ground + 0.05,
      register,
      letterSpacing: 0,
    });
    let x = MARGIN + 160;
    // Sheaves: one per bushel an acre, taller in better years.
    const sheafSize = height * (0.42 + mark.yieldPerAcre * 0.085);
    for (let s = 0; s < mark.yieldPerAcre; s++) {
      add(sheaf(x, base, sheafSize), LEVEL.motif, register);
      x += sheafSize * 0.56;
    }
    x += 34;
    add(jar(x, base, height * 0.74, mark.storeShare), LEVEL.motif, register);
    x += height * 0.66;
    // Events, in the order the year had them. Each motif is drawn around its own origin;
    // `rise` lifts it from the register's floor (rats run along it, spirals float in the air).
    const events: { paths: string[]; rise: number }[] = [];
    if (mark.ratsAte > 0) {
      const rats = Math.min(3, 1 + Math.floor(mark.ratsAte / 700));
      for (let r = 0; r < rats; r++) events.push({ paths: rat(0, 0, height * 0.24), rise: 0.12 });
    }
    if (mark.feverLost > 0) {
      events.push(
        { paths: spiral(0, 0, height * 0.24), rise: 0.36 },
        { paths: spiral(0, 0, height * 0.17), rise: 0.36 },
      );
    }
    if (mark.newcomers > 0) {
      const lanterns = Math.min(6, Math.max(1, Math.round(mark.newcomers / 3)));
      for (let l = 0; l < lanterns; l++)
        events.push({ paths: lantern(0, 0, height * 0.42), rise: 0 });
    }
    if (mark.hungry > 0) events.push({ paths: door(0, 0, height * 0.6), rise: 0 });
    if (events.length === 0) {
      add(ripples(x, FACE.width - MARGIN - 30, base - height * 0.25), LEVEL.motif, register);
      return;
    }
    const room = FACE.width - MARGIN - 30 - x;
    const step = Math.min(height * 0.62, room / events.length);
    events.forEach((motif, e) => {
      const ex = x + step * (e + 0.5);
      add(
        motif.paths.map((d) => translate(d, ex, base - height * motif.rise)),
        LEVEL.motif,
        register,
      );
    });
  }

  // The foot: the verdict, cut deep in plain capitals, and a short footnote.
  add([rect(MARGIN, FOOT_TOP + 14, FACE.width - MARGIN * 2, 6, 3)], LEVEL.motif, 99, 3);
  texts.push({
    text: plan.verdict.toUpperCase(),
    x: FACE.width / 2,
    y: FOOT_TOP + 108,
    size: fitSize(plan.verdict, 64),
    height: LEVEL.deep,
    register: 99,
    letterSpacing: 0.12,
  });
  texts.push({
    text: plan.footnote,
    x: FACE.width / 2,
    y: FOOT_TOP + 196,
    size: 36,
    height: LEVEL.ground,
    register: 99,
    letterSpacing: 0.04,
  });

  return { shapes, texts, registers, outline: steleOutline() };
}

/** Large enough to read, small enough to fit the face in one line. */
function fitSize(text: string, largest: number): number {
  const room = FACE.width - MARGIN * 2 - 40;
  return Math.min(largest, room / Math.max(1, text.length * 0.78));
}

/** Moves a path drawn around the origin to (dx, dy) by shifting every absolute command. */
export function translate(d: string, dx: number, dy: number): string {
  // Absolute commands (M, L, H, V, A, Q, C, T, S) carry coordinates; relative ones move with them.
  let out = '';
  const pattern = /([MLHVACQTSZmlhvacqtsz])([^MLHVACQTSZmlhvacqtsz]*)/g;
  for (const match of d.matchAll(pattern)) {
    const command = match[1] as string;
    const numbers = (match[2] ?? '')
      .trim()
      .split(/[\s,]+/)
      .filter(Boolean)
      .map(Number);
    if (command === command.toLowerCase() || command === 'Z') {
      out += command + numbers.map(f).join(' ');
      continue;
    }
    const shifted = numbers.map((value, i) => {
      if (command === 'H') return value + dx;
      if (command === 'V') return value + dy;
      if (command === 'A') {
        const slot = i % 7;
        return slot === 5 ? value + dx : slot === 6 ? value + dy : value;
      }
      return i % 2 === 0 ? value + dx : value + dy;
    });
    out += command + shifted.map(f).join(' ');
  }
  return out;
}
