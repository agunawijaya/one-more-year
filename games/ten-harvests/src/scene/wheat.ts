/**
 * The wheat: hundreds of thousands of instanced blades, each a short stalk
 * with an ear, standing on the parcels the city has planted.
 *
 * Everything that changes is decided on the GPU from the field state
 * texture (see fields.ts): whether a blade stands at all, how tall it is
 * and what colour, from bare earth through green to gold, and how the
 * harvest cuts it to stubble. The year's yield shows plainly: at one bushel
 * an acre a third of the blades stand, short and pale; at five the field is
 * dense, tall and burnished.
 *
 * Wind: a travelling gust field bends the blades and brightens the bent
 * ones, so visible waves roll across the plain.
 */
import type { Color } from 'three';
import {
  DoubleSide,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  Mesh,
  ShaderMaterial,
  BufferAttribute,
  type DataTexture,
} from 'three';
import { createRng } from '@one-more-year/kit';
import { NOISE_GLSL } from './glsl.ts';
import type { Parcel } from './layout.ts';
import type { ScenePalette } from './palette.ts';
import { FOG_GLSL, type SharedUniforms } from './uniforms.ts';

export interface Wheat {
  mesh: Mesh;
  /** Lays blades on the first `slots` parcels at `perParcel` blades each. */
  rebuild(slots: number, perParcel: number): void;
  setPalette(palette: ScenePalette): void;
  readonly blades: number;
}

/** One blade: a tapering stalk of four segments and a spindle-shaped ear. */
function bladeGeometry(): {
  position: Float32Array;
  part: Float32Array;
  along: Float32Array;
  index: number[];
} {
  const position: number[] = [];
  const part: number[] = [];
  const along: number[] = [];
  const index: number[] = [];
  const segments = 4;
  const stalkTop = 0.74;
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const width = 0.05 * (1 - t * 0.55);
    position.push(-width, t * stalkTop, 0, width, t * stalkTop, 0);
    part.push(0, 0);
    along.push(t * stalkTop, t * stalkTop);
    if (i > 0) {
      const a = (i - 1) * 2;
      index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
  // The ear: two crossed spindles so it reads from every side.
  const earProfile = [
    [0, stalkTop - 0.02],
    [0.075, stalkTop + 0.08],
    [0.07, stalkTop + 0.18],
    [0, stalkTop + 0.3],
  ] as const;
  for (const plane of [0, 1]) {
    const start = position.length / 3;
    for (const [w, y] of earProfile) {
      if (plane === 0) position.push(-w, y, 0, w, y, 0);
      else position.push(0, y, -w, 0, y, w);
      part.push(1, 1);
      along.push(y, y);
    }
    for (let i = 1; i < earProfile.length; i++) {
      const a = start + (i - 1) * 2;
      index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
  return {
    position: new Float32Array(position),
    part: new Float32Array(part),
    along: new Float32Array(along),
    index,
  };
}

interface WheatUniforms {
  uFieldState: { value: DataTexture };
  uGreen: { value: Color };
  uGold: { value: Color };
  uBurnished: { value: Color };
  uPale: { value: Color };
}

export function createWheat(
  parcels: readonly Parcel[],
  fieldState: DataTexture,
  shared: SharedUniforms,
  palette: ScenePalette,
): Wheat {
  const blade = bladeGeometry();
  const geometry = new InstancedBufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(blade.position, 3));
  geometry.setAttribute('aPart', new BufferAttribute(blade.part, 1));
  geometry.setAttribute('aAlong', new BufferAttribute(blade.along, 1));
  geometry.setIndex(blade.index);

  const own: WheatUniforms = {
    uFieldState: { value: fieldState },
    uGreen: { value: palette.wheatGreen.clone() },
    uGold: { value: palette.wheatGold.clone() },
    uBurnished: { value: palette.wheatBurnished.clone() },
    uPale: { value: palette.wheatPale.clone() },
  };
  const material = new ShaderMaterial({
    side: DoubleSide,
    uniforms: { ...shared, ...own },
    vertexShader: /* glsl */ `
      uniform sampler2D uFieldState;
      uniform float uTime;
      uniform vec2 uWind;
      uniform float uGust;
      uniform vec3 uGreen;
      uniform vec3 uGold;
      uniform vec3 uBurnished;
      uniform vec3 uPale;
      attribute float aPart;
      attribute float aAlong;
      attribute vec4 aBlade;   // x, z, density key, slot
      attribute vec2 aVariety; // height variety, facing angle
      varying vec3 vColour;
      varying float vAlong;
      varying float vSheen;
      varying float vDepth;
      varying vec3 vNormal;
      ${NOISE_GLSL}

      void main() {
        vec4 state = texelFetch(uFieldState, ivec2(int(aBlade.w), 0), 0);
        float owned = step(0.75, state.r);
        float planted = state.g * owned;
        float season = state.b;
        float grow = clamp(season, 0.0, 1.0);
        float cut = clamp(season - 1.0, 0.0, 1.0);
        float quality = state.a;
        // Yield 1 → a third of the blades; yield 5 → all of them.
        float density = mix(0.32, 1.0, smoothstep(0.16, 0.84, quality));
        // Stubble keeps fewer stalks than the standing crop.
        bool standing = planted > 0.5 && season > 0.02 && aBlade.z < density * mix(1.0, 0.55, step(0.01, cut));

        float height = (0.12 + 0.88 * grow) * mix(0.62, 1.22, quality) * (0.78 + 0.44 * aVariety.x);
        // The harvest cuts blades back to short stubble as it sweeps past.
        height *= mix(1.0, 0.13, cut);
        float earShow = smoothstep(0.5, 0.8, grow) * (1.0 - step(0.35, cut));
        vec3 local = position;
        if (aPart > 0.5) {
          local.xz *= earShow;
          local.y = mix(0.74, local.y, earShow);
        }
        local.y *= height;
        local.xz *= mix(0.8, 1.2, quality);

        float c = cos(aVariety.y);
        float s = sin(aVariety.y);
        local.xz = mat2(c, -s, s, c) * local.xz;

        // Wind: slow gust bands travelling downwind, plus a small flutter.
        vec2 base = aBlade.xy;
        float band = dot(base, uWind) * 0.085 - uTime * 1.35 + fbm(base * 0.018 + uTime * 0.04) * 3.5;
        float gust = pow(0.5 + 0.5 * sin(band), 3.0);
        float flutter = sin(uTime * 3.1 + aBlade.z * 40.0) * 0.06;
        float bend = (0.12 + 0.55 * gust * uGust + flutter * uGust) * (1.0 - cut);
        float lever = (local.y / max(height, 0.001));
        lever *= lever;
        local.xz += uWind * bend * lever * height;
        local.y -= bend * bend * lever * height * 0.35;

        vec3 world = vec3(base.x, 0.06, base.y) + local;
        if (!standing) world = vec3(0.0, -60.0, 0.0);

        // Colour by season and by the year's yield.
        vec3 young = uGreen * (0.85 + 0.3 * aVariety.x);
        vec3 ripe = mix(uPale, mix(uGold, uBurnished, smoothstep(0.5, 0.9, quality)), smoothstep(0.12, 0.6, quality));
        vec3 colour = mix(young, ripe, smoothstep(0.5, 0.92, grow));
        colour = mix(colour, mix(ripe, uPale, 0.55) * 0.92, cut);
        colour *= 0.88 + 0.24 * aVariety.x;
        vColour = colour;
        vAlong = aAlong;
        vSheen = gust * uGust * (1.0 - cut);
        vNormal = normalize(vec3(uWind.x * 0.4, 1.0, uWind.y * 0.4));

        vec4 view = viewMatrix * vec4(world, 1.0);
        vDepth = -view.z;
        gl_Position = projectionMatrix * view;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uKeyDirection;
      uniform vec3 uKeyColor;
      uniform vec3 uHemiSky;
      uniform vec3 uHemiGround;
      uniform float uNight;
      ${FOG_GLSL}
      varying vec3 vColour;
      varying float vAlong;
      varying float vSheen;
      varying float vDepth;
      varying vec3 vNormal;

      void main() {
        // Blades darken toward the root, where the field shades itself.
        float occlusion = mix(0.38, 1.0, smoothstep(0.0, 0.85, vAlong));
        float light = max(dot(vNormal, uKeyDirection), 0.0) * 0.65 + 0.35;
        // Moonlight is a thin light: by night the field is silver at the tips and dark below.
        float gain = mix(1.05, 0.55, uNight);
        vec3 lit = vColour * (uKeyColor * light * gain + mix(uHemiGround, uHemiSky, vAlong) * mix(0.85, 0.45, uNight));
        // Bent blades catch the light: this is what makes the wind visible.
        lit += vColour * vSheen * mix(0.38, 0.5, uNight) * occlusion;
        lit *= occlusion;
        gl_FragColor = vec4(applyFog(lit, vDepth), 1.0);
      }
    `,
  });

  const mesh = new Mesh(geometry, material);
  mesh.name = 'wheat';
  mesh.frustumCulled = false;
  let blades = 0;

  function rebuild(slots: number, perParcel: number): void {
    const count = Math.max(0, Math.min(slots, parcels.length)) * perParcel;
    const placement = new Float32Array(count * 4);
    const variety = new Float32Array(count * 2);
    const rng = createRng(`wheat:${perParcel}`);
    let n = 0;
    for (let p = 0; p < Math.min(slots, parcels.length); p++) {
      const parcel = parcels[p] as Parcel;
      // Rows sown along the parcel, jittered: fields read as cultivated, not scattered.
      const rows = Math.max(4, Math.round(Math.sqrt(perParcel * (parcel.depth / parcel.width))));
      const perRow = Math.ceil(perParcel / rows);
      for (let i = 0; i < perParcel; i++) {
        const row = i % rows;
        const column = Math.floor(i / rows);
        const u = (column + rng.float(0.15, 0.85)) / perRow - 0.5;
        const v = (row + rng.float(0.2, 0.8)) / rows - 0.5;
        placement[n * 4] = parcel.x + u * parcel.width * 0.94;
        placement[n * 4 + 1] = parcel.z + v * parcel.depth * 0.92;
        placement[n * 4 + 2] = rng.next();
        placement[n * 4 + 3] = parcel.index;
        variety[n * 2] = rng.next();
        variety[n * 2 + 1] = rng.float(0, Math.PI);
        n++;
      }
    }
    geometry.setAttribute('aBlade', new InstancedBufferAttribute(placement, 4));
    geometry.setAttribute('aVariety', new InstancedBufferAttribute(variety, 2));
    geometry.instanceCount = count;
    blades = count;
  }

  return {
    mesh,
    rebuild,
    get blades() {
      return blades;
    },
    setPalette(next) {
      own.uGreen.value.copy(next.wheatGreen);
      own.uGold.value.copy(next.wheatGold);
      own.uBurnished.value.copy(next.wheatBurnished);
      own.uPale.value.copy(next.wheatPale);
    },
  };
}
