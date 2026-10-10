/**
 * The field parcels and their state.
 *
 * Every parcel slot of the layout has four numbers in a small float
 * texture, which both the parcel ground and the wheat read on the GPU:
 *
 *   r  ownership: 0 not the city's, 0.5 for sale at the edge, 1 owned
 *   g  planted (1) or fallow (0)
 *   b  season: 0 bare earth, 0–1 growing to ripe, 1–2 being cut to stubble
 *   a  quality: the year's yield ÷ 6 (or 0.5 for "not yet known")
 *
 * A second row holds a highlight per parcel for direct manipulation
 * (0 none, 1 about to be bought, 2 about to be sold, 3 hovered).
 *
 * Changing what the player plans is a few writes to an array and one
 * texture upload, so the fields answer a drag within the same frame.
 */
import {
  BufferAttribute,
  BufferGeometry,
  Color,
  DataTexture,
  FloatType,
  Mesh,
  MeshStandardMaterial,
  NearestFilter,
  RGBAFormat,
  type WebGLProgramParametersWithUniforms,
} from 'three';
import { NOISE_GLSL } from './glsl.ts';
import type { Parcel } from './layout.ts';
import type { ScenePalette } from './palette.ts';

export const OWNERSHIP = { none: 0, forSale: 0.5, owned: 1 } as const;
export const HIGHLIGHT = { none: 0, buy: 1, sell: 2, hover: 3 } as const;
/** Quality when the year's yield is not known yet (plans and previews). */
export const UNKNOWN_QUALITY = 0.5;

export interface FieldState {
  readonly texture: DataTexture;
  readonly slots: number;
  set(slot: number, ownership: number, planted: number, season: number, quality: number): void;
  setSeason(slot: number, season: number): void;
  setQuality(slot: number, quality: number): void;
  setHighlight(slot: number, highlight: number): void;
  get(slot: number): { ownership: number; planted: number; season: number; quality: number };
  /** Uploads the changes made since the last call. */
  commit(): void;
}

export function createFieldState(slots: number): FieldState {
  const data = new Float32Array(slots * 2 * 4);
  const texture = new DataTexture(data, slots, 2, RGBAFormat, FloatType);
  texture.magFilter = NearestFilter;
  texture.minFilter = NearestFilter;
  texture.needsUpdate = true;
  let dirty = false;
  return {
    texture,
    slots,
    set(slot, ownership, planted, season, quality) {
      const i = slot * 4;
      data[i] = ownership;
      data[i + 1] = planted;
      data[i + 2] = season;
      data[i + 3] = quality;
      dirty = true;
    },
    setSeason(slot, season) {
      data[slot * 4 + 2] = season;
      dirty = true;
    },
    setQuality(slot, quality) {
      data[slot * 4 + 3] = quality;
      dirty = true;
    },
    setHighlight(slot, highlight) {
      data[(slots + slot) * 4] = highlight;
      dirty = true;
    },
    get(slot) {
      const i = slot * 4;
      return {
        ownership: data[i] ?? 0,
        planted: data[i + 1] ?? 0,
        season: data[i + 2] ?? 0,
        quality: data[i + 3] ?? 0,
      };
    },
    commit() {
      if (!dirty) return;
      texture.needsUpdate = true;
      dirty = false;
    },
  };
}

interface ParcelUniforms {
  uFieldState: { value: DataTexture };
  uTilled: { value: Color };
  uScrub: { value: Color };
  uPlantedSoil: { value: Color };
  uWheatGreen: { value: Color };
  uBuy: { value: Color };
  uSell: { value: Color };
  uTime: { value: number };
}

export interface ParcelGround {
  mesh: Mesh;
  setPalette(palette: ScenePalette): void;
}

/** One quad per parcel slot, merged into a single mesh that reads the state texture. */
export function createParcelGround(
  parcels: readonly Parcel[],
  state: FieldState,
  time: { value: number },
  palette: ScenePalette,
): ParcelGround {
  const positions = new Float32Array(parcels.length * 4 * 3);
  const local = new Float32Array(parcels.length * 4 * 2);
  const slotOf = new Float32Array(parcels.length * 4);
  const normals = new Float32Array(parcels.length * 4 * 3);
  const indices: number[] = [];
  parcels.forEach((parcel, p) => {
    const corners = [
      [-1, -1],
      [1, -1],
      [-1, 1],
      [1, 1],
    ] as const;
    corners.forEach(([u, v], c) => {
      const vertex = p * 4 + c;
      positions.set(
        [parcel.x + (u * parcel.width) / 2, 0.05, parcel.z + (v * parcel.depth) / 2],
        vertex * 3,
      );
      normals.set([0, 1, 0], vertex * 3);
      local.set([u, v], vertex * 2);
      slotOf[vertex] = parcel.index;
    });
    const base = p * 4;
    indices.push(base, base + 2, base + 1, base + 1, base + 2, base + 3);
  });
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new BufferAttribute(normals, 3));
  geometry.setAttribute('aLocal', new BufferAttribute(local, 2));
  geometry.setAttribute('aSlot', new BufferAttribute(slotOf, 1));
  geometry.setIndex(indices);

  const uniforms: ParcelUniforms = {
    uFieldState: { value: state.texture },
    uTilled: { value: palette.tilled.clone() },
    uScrub: { value: palette.scrub.clone() },
    uPlantedSoil: { value: palette.tilled.clone().multiplyScalar(0.78) },
    uWheatGreen: { value: palette.wheatGreen.clone() },
    uBuy: { value: new Color('#ff8a6a') },
    uSell: { value: new Color('#7aa6ff') },
    uTime: time,
  };
  const material = new MeshStandardMaterial({ roughness: 1, metalness: 0 });
  material.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform sampler2D uFieldState;
        attribute vec2 aLocal;
        attribute float aSlot;
        varying vec2 vLocal;
        varying vec4 vState;
        varying float vHighlight;
        varying vec2 vParcelWorld;`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        vState = texelFetch(uFieldState, ivec2(int(aSlot), 0), 0);
        vHighlight = texelFetch(uFieldState, ivec2(int(aSlot), 1), 0).r;
        vLocal = aLocal;
        vParcelWorld = (modelMatrix * vec4(transformed, 1.0)).xz;
        // Land that is neither the city's nor on offer simply is not drawn.
        if (vState.r < 0.25 && vHighlight < 0.5) transformed.y = -50.0;`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform vec3 uTilled;
        uniform vec3 uScrub;
        uniform vec3 uPlantedSoil;
        uniform vec3 uWheatGreen;
        uniform vec3 uBuy;
        uniform vec3 uSell;
        uniform float uTime;
        varying vec2 vLocal;
        varying vec4 vState;
        varying float vHighlight;
        varying vec2 vParcelWorld;
        ${NOISE_GLSL}`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        {
          float owned = step(0.75, vState.r);
          float planted = vState.g * owned;
          float season = vState.b;
          float furrows = 0.5 + 0.5 * sin(vLocal.y * 22.0 + valueNoise(vParcelWorld * 0.7) * 1.5);
          float clods = valueNoise(vParcelWorld * 3.1);
          vec3 tilled = uTilled * (0.82 + 0.26 * furrows) * (0.9 + 0.2 * clods);
          vec3 soil = uPlantedSoil * (0.86 + 0.2 * furrows);
          // Young shoots tint the soil green before the blades are tall enough to see.
          soil = mix(soil, uWheatGreen * 0.7, planted * smoothstep(0.05, 0.4, season) * (1.0 - smoothstep(0.7, 1.0, season)) * 0.5);
          float bushes = smoothstep(0.62, 0.7, valueNoise(vParcelWorld * 1.3));
          vec3 scrub = mix(uScrub, uScrub * 0.72, bushes) * (0.94 + 0.1 * clods);
          vec3 colour = mix(scrub, mix(tilled, soil, planted), owned);
          // A low earthen bank around every owned parcel.
          float edge = max(abs(vLocal.x), abs(vLocal.y));
          colour *= mix(1.0, 1.18, smoothstep(0.9, 0.98, edge) * owned);
          float pulse = 0.65 + 0.35 * sin(uTime * 4.0);
          if (vHighlight > 0.5 && vHighlight < 1.5) colour = mix(colour, uBuy, 0.55 * pulse);
          if (vHighlight > 1.5 && vHighlight < 2.5) colour = mix(colour, uSell, 0.55 * pulse);
          if (vHighlight > 2.5) colour = mix(colour, vec3(1.0, 0.95, 0.8), 0.25);
          diffuseColor.rgb = colour;
        }`,
      );
  };
  const mesh = new Mesh(geometry, material);
  mesh.receiveShadow = true;
  mesh.name = 'parcels';
  mesh.frustumCulled = false;
  return {
    mesh,
    setPalette(next) {
      uniforms.uTilled.value.copy(next.tilled);
      uniforms.uScrub.value.copy(next.scrub);
      uniforms.uPlantedSoil.value.copy(next.tilled).multiplyScalar(0.78);
      uniforms.uWheatGreen.value.copy(next.wheatGreen);
    },
  };
}
