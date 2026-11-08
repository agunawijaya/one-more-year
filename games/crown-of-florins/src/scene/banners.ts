/**
 * Banners of arms: a gonfalon hanging from a crossbar on a pole, the way
 * Italian towns carried their colours. The cloth is the coat of arms
 * painted onto a canvas (drawn in code from ui/heraldry-svg.ts), and it
 * sways in the vertex shader.
 */
import {
  CanvasTexture,
  Color,
  Group,
  Mesh,
  PlaneGeometry,
  SRGBColorSpace,
  type Material,
} from 'three';
import type { ArmsSpec } from '../lib/heraldry.ts';
import { drawArms } from '../ui/heraldry-svg.ts';
import { createPigmentMaterial, type FrescoUniforms } from './materials.ts';
import { PartsBuilder, SURFACE } from './parts.ts';

export interface Banner {
  group: Group;
  /**
   * Bows the banner (the coronation's salute from every rival): 0 upright, 1 dipped, leaning
   * toward `toward` (a direction on the ground) or toward the viewer when none is given.
   */
  setBow(amount: number, toward?: { x: number; z: number }): void;
  dispose(): void;
}

/** The arms painted onto cloth, with a gold fringe at the hem. */
export function armsTexture(arms: ArmsSpec): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 200;
  canvas.height = 260;
  const context = canvas.getContext('2d');
  if (context) {
    drawArms(context, arms, 0, 0, 200, { shield: false });
    // The hem cut into three tongues, and a fringe of gold thread.
    context.globalCompositeOperation = 'destination-out';
    context.beginPath();
    context.moveTo(0, 240);
    context.lineTo(33, 260);
    context.lineTo(67, 240);
    context.lineTo(100, 260);
    context.lineTo(133, 240);
    context.lineTo(167, 260);
    context.lineTo(200, 240);
    context.lineTo(200, 260);
    context.lineTo(0, 260);
    context.fill();
    context.globalCompositeOperation = 'source-over';
    context.fillStyle = '#d8aa3a';
    context.fillRect(0, 0, 200, 8);
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

export function createBanner(
  arms: ArmsSpec,
  uniforms: FrescoUniforms,
  poleMaterial: Material,
  options: { pole: number; size: number },
): Banner {
  const group = new Group();
  const texture = armsTexture(arms);
  const cloth = new Mesh(
    new PlaneGeometry(options.size, options.size * 1.3, 6, 10),
    createPigmentMaterial({ uniforms, banner: texture }),
  );
  // Hang from the top edge.
  cloth.geometry.translate(options.size * 0.55, -options.size * 0.65, 0);
  cloth.material.transparent = false;
  cloth.material.alphaTest = 0.5;
  cloth.position.y = options.pole;
  cloth.castShadow = true;

  const parts = new PartsBuilder();
  const wood = new Color('#6a4b30');
  parts.object(1).box(0, 0, 0.18, 0.18, options.pole + 0.4, wood, { sides: SURFACE.wood });
  parts.box(options.size * 0.55, 0, options.size * 1.2, 0.12, 0.12, wood, {
    base: options.pole,
    sides: SURFACE.wood,
  });
  parts.prism(0, 0, 0.22, 0.4, 6, wood, SURFACE.gilt, options.pole + 0.4);
  const pole = new Mesh(parts.build(), poleMaterial);
  pole.castShadow = true;

  const mast = new Group();
  mast.add(pole, cloth);
  group.add(mast);
  return {
    group,
    setBow(amount, toward = { x: 0, z: 1 }) {
      // Pivot at the foot of the pole. The cloth keeps facing the viewer, so a banner leaning to the
      // side is still seen whole: its top swings left or right (about z) and a little forward (about x).
      const length = Math.hypot(toward.x, toward.z) || 1;
      mast.rotation.z = (-toward.x / length) * amount * 0.75;
      mast.rotation.x = (toward.z / length) * amount * 0.45;
    },
    dispose() {
      cloth.geometry.dispose();
      cloth.material.dispose();
      texture.dispose();
      pole.geometry.dispose();
    },
  };
}
