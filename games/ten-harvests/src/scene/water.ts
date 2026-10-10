/**
 * The river, the canals and the yearly flood.
 *
 * One water shader serves all three: slow flow along the channel, the sky
 * mirrored by a Fresnel term (using the same sky function as the dome),
 * a sun glint by day and a long moon path by night, and foam where the
 * water meets the bank. Canals carry water only beside the city's own
 * fields (they read the field state, like the parcels). The flood is the
 * same water spread thin over the plain, faded in and out by the cinematic.
 */
import type { Color } from 'three';
import {
  BufferAttribute,
  BufferGeometry,
  DoubleSide,
  FrontSide,
  Group,
  Mesh,
  PlaneGeometry,
  ShaderMaterial,
  type DataTexture,
} from 'three';
import { NOISE_GLSL, SKY_GLSL, SKY_UNIFORMS_GLSL } from './glsl.ts';
import { RIVER_WIDTH, riverPath, type CanalPiece, type CityLayout } from './layout.ts';
import type { ScenePalette } from './palette.ts';
import { ribbon } from './terrain.ts';
import { FOG_GLSL, type SharedUniforms } from './uniforms.ts';

export interface Water {
  group: Group;
  /** 0 dry fields, 1 the flood at its height. */
  setFlood(amount: number): void;
  setPalette(palette: ScenePalette): void;
}

type WaterKind = 'river' | 'canal' | 'flood';

interface WaterUniforms {
  uDeep: { value: Color };
  uShallow: { value: Color };
  uFoam: { value: Color };
  uBank: { value: Color };
  uFlow: { value: number };
  uOpacity: { value: number };
  uFieldState: { value: DataTexture | null };
}

const SURFACE: Record<
  WaterKind,
  { coordinates: string; across: string; waviness: string; foam: string }
> = {
  river: {
    coordinates: 'vec2(vChannel.x, vChannel.y * 7.0)',
    across: 'abs(vChannel.y * 2.0 - 1.0)',
    waviness: '0.3',
    foam: `float foamLine = smoothstep(0.86, 0.98, across + (valueNoise(p * 1.7 + vec2(uTime * 0.4, 0.0)) - 0.5) * 0.1);
           float foam = foamLine * (0.45 + 0.55 * valueNoise(p * 4.0 - vec2(uTime * 0.7, 0.0)));`,
  },
  canal: {
    coordinates: 'vec2(vChannel.x, vChannel.y * 2.0)',
    across: 'abs(vChannel.y * 2.0 - 1.0)',
    waviness: '0.05',
    foam: 'float foam = 0.0;',
  },
  flood: {
    coordinates: 'vWorld.xz * 0.6',
    across: '0.5',
    waviness: '0.07',
    foam: 'float foam = 0.0;',
  },
};

function waterMaterial(
  shared: SharedUniforms,
  own: WaterUniforms,
  kind: WaterKind,
): ShaderMaterial {
  const surface = SURFACE[kind];
  return new ShaderMaterial({
    transparent: kind === 'flood',
    depthWrite: kind !== 'flood',
    side: kind === 'flood' ? DoubleSide : FrontSide,
    uniforms: { ...shared, ...own },
    vertexShader: /* glsl */ `
      uniform sampler2D uFieldState;
      ${kind === 'canal' ? 'attribute float aSlot;' : ''}
      varying vec2 vChannel;
      varying vec3 vWorld;
      varying float vDepth;
      void main() {
        vChannel = uv;
        vec3 placed = position;
        ${
          kind === 'canal'
            ? `// A canal carries water only beside the city's own fields.
               if (texelFetch(uFieldState, ivec2(int(aSlot), 0), 0).r < 0.75) placed.y = -50.0;`
            : ''
        }
        vec4 world = modelMatrix * vec4(placed, 1.0);
        vWorld = world.xyz;
        vec4 view = viewMatrix * world;
        vDepth = -view.z;
        gl_Position = projectionMatrix * view;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform vec3 uKeyColor;
      uniform float uNight;
      uniform vec3 uDeep;
      uniform vec3 uShallow;
      uniform vec3 uFoam;
      uniform vec3 uBank;
      uniform float uFlow;
      uniform float uOpacity;
      ${SKY_UNIFORMS_GLSL}
      ${NOISE_GLSL}
      ${SKY_GLSL}
      ${FOG_GLSL}
      varying vec2 vChannel;
      varying vec3 vWorld;
      varying float vDepth;

      float waves(vec2 p) {
        vec2 flow = vec2(uTime * uFlow, 0.0);
        return fbm(p * vec2(0.22, 0.5) - flow * 0.22) * 0.6 + valueNoise(p * vec2(0.9, 1.6) - flow * 0.9) * 0.4;
      }

      void main() {
        vec2 p = ${surface.coordinates};
        float e = 0.08;
        float h = waves(p);
        float hx = waves(p + vec2(e, 0.0));
        float hz = waves(p + vec2(0.0, e));
        float strength = ${surface.waviness};
        vec3 normal = normalize(vec3(-(hx - h) / e * strength, 1.0, -(hz - h) / e * strength));

        vec3 toEye = normalize(cameraPosition - vWorld);
        float fresnel = 0.02 + 0.98 * pow(1.0 - max(dot(normal, toEye), 0.0), 5.0);
        vec3 reflected = skyColour(reflect(-toEye, normal), false);

        float across = ${surface.across};
        vec3 body = mix(uDeep, uShallow, smoothstep(0.3, 1.0, across));
        vec3 colour = mix(body, reflected, fresnel * mix(0.6, 0.85, uNight));

        // Sun glint by day; a broad glittering moon path by night.
        vec3 halfway = normalize(uKeyDirection + toEye);
        float facing = max(dot(normal, halfway), 0.0);
        float glint = pow(facing, mix(420.0, 140.0, uNight));
        // By night the moon path breaks into fine, slowly shifting glitter.
        float glitter = mix(1.0, 0.35 + 0.65 * smoothstep(0.45, 0.85, valueNoise(p * vec2(6.0, 9.0) + uTime * 0.5)), uNight);
        colour += uKeyColor * glint * glitter * mix(4.0, 3.0, uNight) * ${kind === 'canal' ? 'mix(1.0, 0.25, uNight)' : '1.0'};

        ${surface.foam}
        colour = mix(colour, uFoam, foam * mix(0.6, 0.12, uNight));
        ${
          kind === 'canal'
            ? `// Earthen banks along both sides of the channel.
               float bank = smoothstep(0.55, 0.7, across);
               colour = mix(colour, uBank * (0.85 + 0.2 * valueNoise(vWorld.xz * 2.0)), bank);`
            : ''
        }
        colour = applyFog(colour, vDepth);
        gl_FragColor = vec4(colour, uOpacity);
      }
    `,
  });
}

/** All canal stretches as one mesh: a quad per piece, tagged with its parcel slot. */
function canalGeometry(pieces: readonly CanalPiece[]): BufferGeometry {
  const positions = new Float32Array(pieces.length * 4 * 3);
  const uvs = new Float32Array(pieces.length * 4 * 2);
  const slots = new Float32Array(pieces.length * 4);
  const indices: number[] = [];
  pieces.forEach((piece, i) => {
    const dx = piece.to.x - piece.from.x;
    const dz = piece.to.z - piece.from.z;
    const length = Math.hypot(dx, dz) || 1;
    const nx = (-dz / length) * piece.width * 0.5;
    const nz = (dx / length) * piece.width * 0.5;
    const corners = [
      [piece.from.x + nx, piece.from.z + nz, 0, 0],
      [piece.from.x - nx, piece.from.z - nz, 0, 1],
      [piece.to.x + nx, piece.to.z + nz, length, 0],
      [piece.to.x - nx, piece.to.z - nz, length, 1],
    ] as const;
    corners.forEach(([x, z, u, v], c) => {
      positions.set([x, 0.07, z], (i * 4 + c) * 3);
      uvs.set([u + piece.from.x + piece.from.z, v], (i * 4 + c) * 2);
      slots[i * 4 + c] = piece.slot;
    });
    const base = i * 4;
    indices.push(base, base + 2, base + 1, base + 1, base + 2, base + 3);
  });
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new BufferAttribute(uvs, 2));
  geometry.setAttribute('aSlot', new BufferAttribute(slots, 1));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

export function createWater(
  shared: SharedUniforms,
  layout: CityLayout,
  fieldState: DataTexture,
  palette: ScenePalette,
): Water {
  const group = new Group();
  group.name = 'water';
  const own = (opacity: number, flow: number): WaterUniforms => ({
    uDeep: { value: palette.waterDeep.clone() },
    uShallow: { value: palette.waterShallow.clone() },
    uFoam: { value: palette.foam.clone() },
    uBank: { value: palette.wetBank.clone() },
    uFlow: { value: flow },
    uOpacity: { value: opacity },
    uFieldState: { value: fieldState },
  });
  const riverUniforms = own(1, 1.4);
  const canalUniforms = own(1, 0.5);
  const floodUniforms = own(0, 0.2);

  const river = new Mesh(
    ribbon(riverPath(), RIVER_WIDTH, 0.12),
    waterMaterial(shared, riverUniforms, 'river'),
  );
  river.name = 'river';
  group.add(river);

  const canals = new Mesh(
    canalGeometry(layout.canals),
    waterMaterial(shared, canalUniforms, 'canal'),
  );
  canals.name = 'canals';
  canals.frustumCulled = false;
  group.add(canals);

  // The flood spreads over the floodplain in front of the city.
  const floodGeometry = new PlaneGeometry(330, 190, 1, 1);
  floodGeometry.rotateX(-Math.PI / 2);
  const flood = new Mesh(floodGeometry, waterMaterial(shared, floodUniforms, 'flood'));
  flood.position.set(-5, 0.5, 40);
  flood.visible = false;
  flood.renderOrder = 2;
  flood.name = 'flood';
  group.add(flood);

  const all = [riverUniforms, canalUniforms, floodUniforms];
  function paint(next: ScenePalette): void {
    for (const uniforms of all) {
      uniforms.uDeep.value.copy(next.waterDeep);
      uniforms.uShallow.value.copy(next.waterShallow);
      uniforms.uFoam.value.copy(next.foam);
      uniforms.uBank.value.copy(next.wetBank);
    }
    canalUniforms.uShallow.value.copy(next.waterDeep).lerp(next.waterShallow, 0.4);
    floodUniforms.uShallow.value.copy(next.waterShallow).lerp(next.foam, 0.4);
  }
  paint(palette);
  return {
    group,
    setFlood(amount) {
      floodUniforms.uOpacity.value = Math.max(0, Math.min(1, amount)) * 0.72;
      flood.visible = amount > 0.001;
    },
    setPalette: paint,
  };
}
