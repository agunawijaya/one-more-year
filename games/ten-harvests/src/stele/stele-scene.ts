/**
 * The Stele: a dark basalt slab standing in raking light, carving itself
 * register by register at the end of a term.
 *
 * The relief is not geometry: the face is one quad whose fragment shader
 * reads the height map, derives normals, marches toward the light for
 * self-shadowing (so every sheaf throws a long shadow across its register)
 * and offsets by parallax as the slab turns. Carving is a per-register
 * progress value: left of the chisel the relief shows, right of it the
 * stone is still smooth.
 *
 * By day the stele stands in a sunlit courtyard; by night between two
 * torches under the moon.
 */
import {
  ACESFilmicToneMapping,
  BoxGeometry,
  CylinderGeometry,
  AdditiveBlending,
  BufferGeometry,
  Float32BufferAttribute,
  Points,
  AmbientLight,
  HemisphereLight,
  CanvasTexture,
  Color,
  DirectionalLight,
  ExtrudeGeometry,
  Group,
  LinearFilter,
  Mesh,
  MeshStandardMaterial,
  PCFShadowMap,
  PerspectiveCamera,
  PlaneGeometry,
  PointLight,
  Scene,
  ShaderMaterial,
  Shape,
  NoColorSpace,
  Vector2,
  Vector3,
  WebGLRenderer,
} from 'three';
import type { Appearance } from '@one-more-year/kit';
import { NOISE_GLSL } from '../scene/glsl.ts';
import { drawHeightMap } from './heightmap.ts';
import { FACE, type Relief } from './relief.ts';

/** World size of the face: 4.2 × 9.45 units. */
const FACE_WIDTH = 4.2;
const FACE_HEIGHT = (FACE.height / FACE.width) * FACE_WIDTH;
const DEPTH = 1.1;
/** How deep the deepest cut goes, in world units: shadows are cast to this scale. */
const RELIEF_DEPTH = 0.1;
/** Register slots in the shader: the head, up to 30 years, the foot. */
const SLOTS = 32;

export interface SteleView {
  readonly canvas: HTMLCanvasElement;
  /** Carving steps in all: a head, one per register and a foot, for every slab. */
  readonly steps: number;
  /** 0 → 1 across the whole carving (head, each register, foot). */
  setCarving(progress: number): void;
  /** Turns the slab (radians); it eases back to rest when let go. */
  turn(radians: number): void;
  setAppearance(appearance: Appearance): void;
  renderOnce(): void;
  dispose(): void;
}

interface Looks {
  background: Color;
  stone: Color;
  key: { colour: Color; intensity: number };
  fill: Color;
  torches: boolean;
}

const LOOKS: Readonly<Record<Appearance, Looks>> = {
  light: {
    background: new Color('#d8bf93'),
    stone: new Color('#7c8290'),
    key: { colour: new Color('#ffe6bd'), intensity: 3.4 },
    fill: new Color('#8aa0c4'),
    torches: false,
  },
  dark: {
    background: new Color('#0c1030'),
    stone: new Color('#5d6274'),
    key: { colour: new Color('#9cb0f4'), intensity: 2.3 },
    fill: new Color('#5a6cc0'),
    torches: true,
  },
};

function slabGeometry(): ExtrudeGeometry {
  const shape = new Shape();
  const w = FACE_WIDTH;
  const h = FACE_HEIGHT;
  const shoulder = (300 / FACE.height) * h;
  shape.moveTo(-w / 2, -h / 2);
  shape.lineTo(w / 2, -h / 2);
  shape.lineTo(w / 2, h / 2 - shoulder);
  shape.absellipse(0, h / 2 - shoulder, w / 2, shoulder, 0, Math.PI, false, 0);
  shape.lineTo(-w / 2, -h / 2);
  const geometry = new ExtrudeGeometry(shape, {
    depth: DEPTH,
    bevelEnabled: true,
    bevelThickness: 0.06,
    bevelSize: 0.05,
    bevelSegments: 3,
    curveSegments: 48,
  });
  geometry.translate(0, 0, -DEPTH / 2);
  return geometry;
}

function reliefUniforms(map: CanvasTexture, relief: Relief, stone: Color) {
  const tops = new Array<number>(SLOTS).fill(2);
  const bottoms = new Array<number>(SLOTS).fill(2);
  // Slot 0 is the head, slot SLOTS-1 the foot, the rest are the year registers, top to bottom.
  tops[0] = 0;
  bottoms[0] = 400 / FACE.height;
  relief.registers.forEach((box, i) => {
    tops[i + 1] = box.top / FACE.height;
    bottoms[i + 1] = box.bottom / FACE.height;
  });
  tops[SLOTS - 1] = 1950 / FACE.height;
  bottoms[SLOTS - 1] = 1;
  return {
    uHeight: { value: map },
    uTexel: { value: new Vector2(1 / map.image.width, 1 / map.image.height) },
    uStone: { value: stone.clone() },
    uLight: { value: new Vector3(-0.9, 0.3, 0.32).normalize() },
    uLightColour: { value: new Color('#ffe8c4') },
    uFill: { value: new Color('#8aa0c4') },
    uDepth: { value: 0.045 },
    uTops: { value: tops },
    uBottoms: { value: bottoms },
    uProgress: { value: new Array<number>(SLOTS).fill(0) },
    uNight: { value: 0 },
    uTorches: { value: 0 },
  };
}

type ReliefUniforms = ReturnType<typeof reliefUniforms>;

function reliefMaterial(uniforms: ReliefUniforms): ShaderMaterial {
  return new ShaderMaterial({
    uniforms,
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      varying vec3 vViewTangent;
      void main() {
        vUv = vec2(uv.x, 1.0 - uv.y);
        vec4 world = modelMatrix * vec4(position, 1.0);
        // The face is flat: its tangent frame is the model's x, y and z.
        vec3 toEye = cameraPosition - world.xyz;
        mat3 frame = mat3(modelMatrix);
        vViewTangent = vec3(dot(toEye, normalize(frame[0])), dot(toEye, normalize(frame[1])), dot(toEye, normalize(frame[2])));
        gl_Position = projectionMatrix * viewMatrix * world;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D uHeight;
      uniform vec2 uTexel;
      uniform vec3 uStone;
      uniform vec3 uLight;
      uniform vec3 uLightColour;
      uniform vec3 uFill;
      uniform float uDepth;
      uniform float uTops[${SLOTS}];
      uniform float uBottoms[${SLOTS}];
      uniform float uProgress[${SLOTS}];
      uniform float uNight;
      uniform float uTorches;
      varying vec2 vUv;
      varying vec3 vViewTangent;
      ${NOISE_GLSL}

      // Uncarved stone is the flat face; carved stone shows the relief.
      float carvedAt(vec2 uv, out float chisel) {
        chisel = 0.0;
        for (int i = 0; i < ${SLOTS}; i++) {
          if (uv.y >= uTops[i] && uv.y <= uBottoms[i]) {
            float edge = uProgress[i];
            chisel = smoothstep(0.03, 0.0, abs(uv.x - edge)) * step(0.001, edge) * step(edge, 0.999);
            return step(uv.x, edge);
          }
        }
        return 1.0;
      }

      float heightAt(vec2 uv) {
        float chisel;
        float carved = carvedAt(uv, chisel);
        // Explicit level 0: this is sampled in loops and after a discard.
        return mix(1.0, textureLod(uHeight, uv, 0.0).r, carved);
      }

      void main() {
        vec4 sampleAt = texture2D(uHeight, vUv);
        if (sampleAt.a < 0.5) discard;
        // Parallax: deeper relief shifts away from the eye as the slab turns.
        vec3 view = normalize(vViewTangent);
        float h0 = heightAt(vUv);
        vec2 uv = vUv - vec2(view.x, -view.y) / max(view.z, 0.25) * (1.0 - h0) * uDepth * 0.5;

        float h = heightAt(uv);
        float hx = heightAt(uv + vec2(uTexel.x * 1.5, 0.0)) - heightAt(uv - vec2(uTexel.x * 1.5, 0.0));
        float hy = heightAt(uv + vec2(0.0, uTexel.y * 1.5)) - heightAt(uv - vec2(0.0, uTexel.y * 1.5));
        vec3 normal = normalize(vec3(-hx * 20.0, hy * 20.0 * (uTexel.x / uTexel.y) * 2.25, 1.0));

        // March toward the light across the height map: anything taller in the way casts a shadow.
        float shadow = 1.0;
        // A step of 3 texels toward the light climbs as far as the light's slope allows,
        // measured in relief heights: the face is ${FACE_WIDTH} units wide, the relief ${RELIEF_DEPTH} deep.
        float stepUv = uTexel.x * 3.0;
        vec2 toward = normalize(vec2(uLight.x, -uLight.y) + 1e-5) * stepUv;
        float rise = uLight.z / max(length(uLight.xy), 0.05) * stepUv * ${(FACE_WIDTH / 0.1).toFixed(1)};
        for (int i = 1; i <= 28; i++) {
          vec2 p = uv + toward * float(i);
          float blocker = heightAt(p) - (h + rise * float(i));
          shadow = min(shadow, 1.0 - smoothstep(0.0, 0.04, blocker));
        }

        float chisel;
        float carved = carvedAt(uv, chisel);
        // Basalt: near black, flecked; cut surfaces come out paler and matte, polished faces darker.
        float fleck = valueNoise(uv * vec2(900.0, 2000.0)) * 0.5 + valueNoise(uv * vec2(260.0, 590.0)) * 0.5;
        float cut = (1.0 - h) * carved;
        // Polished face darker and glossier; fresh cuts paler and dusty.
        vec3 albedo = uStone * (0.78 + 0.34 * fleck) * mix(0.72, 1.35, smoothstep(0.0, 0.5, cut));
        float diffuse = max(dot(normal, uLight), 0.0) * shadow;
        float occlusion = mix(1.0, 0.5, smoothstep(0.0, 0.7, cut));
        vec3 halfway = normalize(uLight + view);
        float shine = pow(max(dot(normal, halfway), 0.0), 48.0) * (1.0 - cut) * shadow * 0.9;
        vec3 colour = albedo * (uLightColour * diffuse * mix(2.1, 1.3, uNight) + uFill * 0.38 * occlusion) + uLightColour * shine * mix(1.0, 0.5, uNight);
        // By night two torches graze the face from either side and gild every edge.
        vec3 torchL = normalize(vec3(-0.92, 0.19, 0.36));
        vec3 torchR = normalize(vec3(0.92, 0.19, 0.36));
        float warm = max(dot(normal, torchL), 0.0) + max(dot(normal, torchR), 0.0);
        colour += albedo * vec3(1.0, 0.56, 0.24) * warm * uTorches * 1.7 * (0.55 + 0.45 * shadow);
        // Fresh chisel dust glows at the edge being cut.
        colour += uLightColour * chisel * 0.6 * (0.6 + 0.4 * valueNoise(uv * 400.0));
        gl_FragColor = vec4(colour, 1.0);
      }
    `,
  });
}

/** A torch flame: a teardrop of light, white-gold at its heart, with a wide warm halo. */
function flameSprite(): Points {
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute([0, 0, 0], 3));
  const material = new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    uniforms: { uFlicker: { value: 1 } },
    vertexShader: `
      uniform float uFlicker;
      void main() {
        vec4 view = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = 2600.0 * uFlicker / max(-view.z, 1.0);
        gl_Position = projectionMatrix * view;
      }
    `,
    fragmentShader: `
      uniform float uFlicker;
      void main() {
        vec2 c = gl_PointCoord - vec2(0.5, 0.58);
        c.y = -c.y;
        // Narrow toward the tip: a flame, not a ball.
        float width = 0.07 + max(0.0, -c.y) * 0.3 - max(0.0, c.y) * 0.2;
        float body = smoothstep(width, width * 0.2, abs(c.x)) * smoothstep(0.3, 0.0, c.y) * smoothstep(-0.14, -0.05, c.y);
        float halo = pow(max(0.0, 1.0 - length(gl_PointCoord - 0.5) * 2.0), 2.5) * 0.35;
        vec3 colour = mix(vec3(1.0, 0.42, 0.08), vec3(1.0, 0.92, 0.7), body * body);
        gl_FragColor = vec4(colour * (body * 3.2 + halo) * uFlicker, 1.0);
      }
    `,
  });
  const points = new Points(geometry, material);
  points.frustumCulled = false;
  return points;
}

function dustMotes(): { points: Points; setTime(seconds: number): void } {
  const count = 260;
  const positions = new Float32Array(count * 3);
  const seeds = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const r = (n: number): number =>
      (((Math.sin(i * 12.9898 + n * 78.233) * 43758.5453) % 1) + 1) % 1;
    positions.set([-9 + r(1) * 14, -4 + r(2) * 10, -1 + r(3) * 6], i * 3);
    seeds[i] = r(4);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('aSeed', new Float32BufferAttribute(seeds, 1));
  const material = new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    uniforms: { uTime: { value: 0 } },
    vertexShader: `
      uniform float uTime;
      attribute float aSeed;
      varying float vGlow;
      void main() {
        vec3 p = position;
        p.x += sin(uTime * 0.15 + aSeed * 30.0) * 0.6 + uTime * 0.05;
        p.y += sin(uTime * 0.11 + aSeed * 17.0) * 0.4;
        vec4 view = modelViewMatrix * vec4(p, 1.0);
        gl_PointSize = (1.0 + aSeed * 2.0) * (40.0 / max(-view.z, 1.0));
        // Only motes inside the beam (left of the stone, high up) catch the light.
        vGlow = smoothstep(4.0, -6.0, p.x - p.y * 0.4) * (0.4 + 0.6 * aSeed);
        gl_Position = projectionMatrix * view;
      }
    `,
    fragmentShader: `
      varying float vGlow;
      void main() {
        float d = length(gl_PointCoord - 0.5) * 2.0;
        gl_FragColor = vec4(vec3(1.0, 0.86, 0.62) * smoothstep(1.0, 0.0, d) * vGlow * 0.5, 1.0);
      }
    `,
  });
  const points = new Points(geometry, material);
  points.frustumCulled = false;
  return {
    points,
    setTime(seconds) {
      (material.uniforms.uTime as { value: number }).value = seconds;
    },
  };
}

/** Space between the slabs of a Dynasty, which stand side by side. */
const SLAB_SPACING = 6.4;

export function createSteleView(
  host: HTMLElement,
  reliefs: readonly Relief[],
  appearance: Appearance,
): SteleView {
  const renderer = new WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFShadowMap;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  const canvas = renderer.domElement;
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', 'The stele of this term');
  canvas.style.display = 'block';
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  host.append(canvas);

  const scene = new Scene();
  const count = Math.max(1, reliefs.length);
  const span = (count - 1) * SLAB_SPACING;
  const camera = new PerspectiveCamera(28, 1, 0.1, 200);
  camera.position.set(-2.6 - span * 0.1, 0.2, 23.5 + span * 1.25);
  camera.lookAt(0, 0.95, 0);

  // One slab per term, each with its own height map and its own face uniforms.
  const stele = new Group();
  const bodyMaterial = new MeshStandardMaterial({
    color: LOOKS[appearance].stone,
    roughness: 0.62,
    metalness: 0.05,
  });
  const maps: CanvasTexture[] = [];
  const faces: ReliefUniforms[] = [];
  reliefs.forEach((relief, i) => {
    // The height map is data, not colour: no colour-space conversion.
    const map = new CanvasTexture(drawHeightMap(relief));
    map.colorSpace = NoColorSpace;
    // Rows run top to bottom as in the design; the shader flips v itself.
    map.flipY = false;
    map.minFilter = LinearFilter;
    map.magFilter = LinearFilter;
    map.generateMipmaps = false;
    maps.push(map);
    const slab = new Group();
    slab.position.x = i * SLAB_SPACING - span / 2;
    const body = new Mesh(slabGeometry(), bodyMaterial);
    body.castShadow = true;
    body.receiveShadow = true;
    slab.add(body);
    const uniforms = reliefUniforms(map, relief, LOOKS[appearance].stone);
    faces.push(uniforms);
    const face = new Mesh(new PlaneGeometry(FACE_WIDTH, FACE_HEIGHT), reliefMaterial(uniforms));
    face.position.z = DEPTH / 2 + 0.065;
    slab.add(face);
    stele.add(slab);
  });
  stele.position.y = FACE_HEIGHT / 2 - 4.2;
  scene.add(stele);

  // The ground and the wall behind: a sunlit courtyard by day, the dark by night.
  const groundMaterial = new MeshStandardMaterial({ color: '#cbb28a', roughness: 1 });
  groundMaterial.onBeforeCompile = (shader) => {
    // The floor fades into the backdrop, so there is no hard horizon behind the stone.
    shader.uniforms.uFade = fade;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vFloor;')
      .replace(
        '#include <worldpos_vertex>',
        '#include <worldpos_vertex>\nvFloor = (modelMatrix * vec4(transformed, 1.0)).xyz;',
      );
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 uFade;\nvarying vec3 vFloor;')
      .replace(
        '#include <dithering_fragment>',
        '#include <dithering_fragment>\ngl_FragColor.rgb = mix(gl_FragColor.rgb, uFade, smoothstep(2.0, 13.0, -vFloor.z) * 0.85);',
      );
  };
  const ground = new Mesh(new PlaneGeometry(80, 40), groundMaterial);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -4.2;
  ground.receiveShadow = true;
  scene.add(ground);
  // The backdrop: a soft pool of light behind the stone, darkening to the edges.
  const fade = { value: new Color('#c9a26c') };
  const backdrop = {
    uCentre: { value: new Color('#f0d3a0') },
    uEdge: { value: new Color('#a87a46') },
  };
  const backdropMaterial = new ShaderMaterial({
    depthWrite: false,
    uniforms: backdrop,
    vertexShader:
      'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `
      uniform vec3 uCentre;
      uniform vec3 uEdge;
      varying vec2 vUv;
      void main() {
        float d = length((vUv - vec2(0.42, 0.55)) * vec2(1.6, 1.0));
        gl_FragColor = vec4(mix(uCentre, uEdge, smoothstep(0.05, 0.75, d)), 1.0);
      }
    `,
  });
  const wall = new Mesh(new PlaneGeometry(90, 50), backdropMaterial);
  wall.position.set(0, 8, -16);
  scene.add(wall);

  const key = new DirectionalLight('#ffffff', 3);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.left = -12;
  key.shadow.camera.right = 12;
  key.shadow.camera.top = 12;
  key.shadow.camera.bottom = -12;
  key.shadow.bias = -0.0005;
  key.shadow.radius = 7;
  key.shadow.blurSamples = 16;
  scene.add(key, key.target);
  const ambient = new AmbientLight('#ffffff', 0.4);
  scene.add(ambient);
  const sky = new HemisphereLight('#bcd2f0', '#8a6a44', 0.6);
  scene.add(sky);
  const torches = [new PointLight('#ff9a48', 0, 24, 1.5), new PointLight('#ff9a48', 0, 24, 1.5)];
  torches[0]?.position.set(-4.6 - span / 2, 1.9, 2.4);
  torches[1]?.position.set(4.6 + span / 2, 1.9, 2.4);
  for (const torch of torches) scene.add(torch);

  // A stepped mud-brick plinth for the stone to stand on, and a torch stand either side.
  const plinthMaterial = new MeshStandardMaterial({ color: '#b98d5a', roughness: 1 });
  for (const [width, height, depth, y] of [
    [7.4 + span, 0.45, 3.6, -4.2],
    [5.8 + span, 0.4, 2.8, -3.75],
  ] as const) {
    const step = new Mesh(new BoxGeometry(width, height, depth), plinthMaterial);
    step.position.set(0, y + height / 2, 0.2);
    step.castShadow = true;
    step.receiveShadow = true;
    scene.add(step);
  }
  stele.position.y += 0.85;
  const standMaterial = new MeshStandardMaterial({
    color: '#3a2c20',
    roughness: 0.8,
    metalness: 0.3,
  });
  const flames: Points[] = [];
  const stands: Mesh[] = [];
  for (const side of [-1, 1]) {
    const x = side * (4.6 + span / 2);
    const pole = new Mesh(new CylinderGeometry(0.07, 0.1, 5.2, 8), standMaterial);
    pole.position.set(x, -1.6, 2.4);
    pole.castShadow = true;
    scene.add(pole);
    stands.push(pole);
    const bowl = new Mesh(new CylinderGeometry(0.42, 0.18, 0.34, 12), standMaterial);
    bowl.position.set(x, 1.15, 2.4);
    scene.add(bowl);
    stands.push(bowl);
    const flame = flameSprite();
    flame.position.set(x, 1.75, 2.4);
    scene.add(flame);
    flames.push(flame);
  }

  // Dust motes drifting through the raking light.
  const motes = dustMotes();
  scene.add(motes.points);

  let restTurn = 0;
  let turn = 0;
  let carving = 1;
  let look = LOOKS[appearance];
  let night = appearance === 'dark';
  /** The light's angle across the face: it sweeps while a register is being cut. */
  let lightSweep = 0;

  function applyLook(next: Appearance): void {
    look = LOOKS[next];
    night = next === 'dark';
    scene.background = look.background;
    bodyMaterial.color.copy(look.stone);
    for (const face of faces) {
      face.uStone.value.copy(look.stone);
      face.uFill.value.copy(look.fill);
      face.uNight.value = night ? 1 : 0;
      face.uTorches.value = look.torches ? 1 : 0;
    }
    groundMaterial.color.set(night ? '#20244a' : '#d6bd92');
    backdrop.uCentre.value.set(night ? '#323a7c' : '#f2d6a2');
    backdrop.uEdge.value.set(night ? '#070a1c' : '#9c6d3c');
    fade.value.set(night ? '#0d1030' : '#c49a62');
    ambient.color.copy(look.fill);
    ambient.intensity = night ? 0.25 : 0.45;
    sky.color.set(night ? '#3a4a9a' : '#bcd2f0');
    sky.groundColor.set(night ? '#141633' : '#8a6a44');
    sky.intensity = night ? 0.5 : 0.8;
    for (const torch of torches) torch.intensity = look.torches ? 34 : 0;
    for (const flame of flames) flame.visible = look.torches;
    // By day there is no need for torches at all.
    for (const stand of stands) stand.visible = look.torches;
    plinthMaterial.color.set(night ? '#4a4870' : '#c49763');
    renderer.toneMappingExposure = night ? 1.25 : 1.0;
  }

  function placeLight(): void {
    // A low raking light from the upper left; during carving it sweeps across the face.
    const angle = -0.85 + lightSweep * 0.5;
    const direction = new Vector3(Math.sin(angle) * 0.95, 0.5, Math.cos(angle) * 0.7).normalize();
    key.position.copy(direction.clone().multiplyScalar(30));
    key.target.position.set(0, 0, 0);
    key.color.copy(look.key.colour);
    key.intensity = look.key.intensity;
    // The face shader works in the slab's own frame.
    const local = direction.clone().applyAxisAngle(new Vector3(0, 1, 0), -turn);
    for (const face of faces) {
      face.uLight.value.copy(local);
      face.uLightColour.value.copy(look.key.colour).multiplyScalar(night ? 1.1 : 1.0);
    }
  }

  /** Head, registers, foot, slab after slab: every carving step in order. */
  const totalSteps = reliefs.reduce((sum, relief) => sum + relief.registers.length + 2, 0);

  function applyCarving(): void {
    let done = 0;
    reliefs.forEach((relief, r) => {
      const progress = (faces[r] as ReliefUniforms).uProgress.value;
      const order = [0, ...relief.registers.map((_, i) => i + 1), SLOTS - 1];
      order.forEach((slot, i) => {
        progress[slot] = Math.max(0, Math.min(1, carving * totalSteps - done - i));
      });
      done += order.length;
    });
    // The light sweeps once per register while it is being cut, then rests.
    const current = carving * totalSteps;
    lightSweep = carving >= 1 ? 0 : Math.sin((current % 1) * Math.PI) * 0.8;
  }

  function resize(): void {
    const width = Math.max(1, host.clientWidth);
    const height = Math.max(1, host.clientHeight);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }

  function render(): void {
    const seconds = performance.now() / 1000;
    motes.setTime(seconds);
    // The flames flicker; their light flickers with them.
    flames.forEach((flame, i) => {
      const flicker =
        1 + Math.sin(seconds * 11 + i * 2) * 0.08 + Math.sin(seconds * 17.3 + i) * 0.05;
      ((flame.material as ShaderMaterial).uniforms.uFlicker as { value: number }).value = flicker;
      const torch = torches[i];
      if (torch && look.torches) torch.intensity = 34 * flicker;
    });
    turn += (restTurn - turn) * 0.12;
    stele.rotation.y = turn;
    placeLight();
    renderer.render(scene, camera);
  }

  const observer = new ResizeObserver(() => {
    resize();
    render();
  });
  observer.observe(host);
  applyLook(appearance);
  applyCarving();
  resize();
  render();

  return {
    canvas,
    steps: totalSteps,
    setCarving(progress) {
      carving = Math.max(0, Math.min(1, progress));
      applyCarving();
    },
    turn(radians) {
      restTurn = Math.max(-0.7, Math.min(0.7, radians));
    },
    setAppearance(next) {
      applyLook(next);
    },
    renderOnce() {
      render();
    },
    dispose() {
      observer.disconnect();
      for (const map of maps) map.dispose();
      renderer.dispose();
      canvas.remove();
    },
  };
}
