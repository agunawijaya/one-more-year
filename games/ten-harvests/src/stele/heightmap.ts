/**
 * Rasterises the stele's relief into a height map on a 2D canvas: red is
 * height (0 deep, 1 the stone's face), alpha marks the stone itself (the
 * rounded head is cut out). The map is drawn once per finished run; the
 * GPU then lights it, carves it register by register and casts its shadows.
 */
import { FACE, LEVEL, type Relief } from './relief.ts';

export const MAP_SIZE = { width: 1024, height: 2304 } as const;

const DISPLAY_FONT = '"Fraunces Variable", "Fraunces", Georgia, serif';

function grey(height: number): string {
  const v = Math.round(Math.max(0, Math.min(1, height)) * 255);
  return `rgb(${v}, ${v}, ${v})`;
}

/** Waits for the carving font, so the verdict is cut in the right letters. */
export async function loadReliefFont(): Promise<void> {
  if (typeof document === 'undefined' || !('fonts' in document)) return;
  try {
    await document.fonts.load(`600 64px ${DISPLAY_FONT}`);
  } catch {
    // A fallback serif is acceptable; the stele still reads.
  }
}

export function drawHeightMap(relief: Relief): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = MAP_SIZE.width;
  canvas.height = MAP_SIZE.height;
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
  const scale = MAP_SIZE.width / FACE.width;
  ctx.setTransform(scale, 0, 0, MAP_SIZE.height / FACE.height, 0, 0);

  // The stone's face, cut to the stele's outline.
  const outline = new Path2D(relief.outline);
  ctx.fillStyle = grey(LEVEL.face);
  ctx.fill(outline);

  // Sunk grounds first, then everything raised on them.
  const ordered = [...relief.shapes].sort((a, b) => a.height - b.height);
  const grounds = ordered.filter((shape) => shape.height < 0.5);
  const raised = ordered.filter((shape) => shape.height >= 0.5);
  for (const shape of grounds) {
    ctx.fillStyle = grey(shape.height);
    ctx.fill(new Path2D(shape.d));
  }
  for (const shape of raised) {
    ctx.fillStyle = grey(shape.height);
    ctx.fill(new Path2D(shape.d));
  }
  for (const text of relief.texts) {
    ctx.save();
    ctx.fillStyle = grey(text.height);
    ctx.font = `600 ${text.size}px ${DISPLAY_FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if ('letterSpacing' in ctx)
      (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing =
        `${text.letterSpacing * text.size}px`;
    ctx.fillText(text.text, text.x, text.y);
    ctx.restore();
  }

  // Soften every edge a little: chisel cuts have slopes, not cliffs.
  const soft = document.createElement('canvas');
  soft.width = canvas.width;
  soft.height = canvas.height;
  const softCtx = soft.getContext('2d') as CanvasRenderingContext2D;
  softCtx.filter = 'blur(2.2px)';
  softCtx.drawImage(canvas, 0, 0);

  // Dome the raised motifs: their centres stand a little proud of their edges.
  const dome = document.createElement('canvas');
  dome.width = canvas.width;
  dome.height = canvas.height;
  const domeCtx = dome.getContext('2d') as CanvasRenderingContext2D;
  domeCtx.setTransform(scale, 0, 0, MAP_SIZE.height / FACE.height, 0, 0);
  domeCtx.fillStyle = '#ffffff';
  for (const shape of raised) domeCtx.fill(new Path2D(shape.d));
  softCtx.save();
  softCtx.filter = 'blur(7px)';
  softCtx.globalCompositeOperation = 'lighter';
  softCtx.globalAlpha = 0.07;
  softCtx.drawImage(dome, 0, 0);
  softCtx.restore();

  // Keep the stone's outline crisp: only the stone has alpha.
  softCtx.globalCompositeOperation = 'destination-in';
  softCtx.setTransform(scale, 0, 0, MAP_SIZE.height / FACE.height, 0, 0);
  softCtx.fill(outline);
  return soft;
}
