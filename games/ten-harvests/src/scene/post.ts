/**
 * The finishing passes: bloom (lamps and lanterns at night, the river's
 * glint by day), a tilt-shift blur that makes the city read as a model on a
 * table, a gentle vignette and grade, then tone mapping to the screen.
 *
 * Each pass can be switched off by the quality ladder.
 */
import {
  Color,
  HalfFloatType,
  Mesh,
  OrthographicCamera,
  PlaneGeometry,
  Scene,
  ShaderMaterial,
  Vector2,
  WebGLRenderTarget,
  type Camera,
  type Material,
  type WebGLRenderer,
} from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

export interface PostSettings {
  bloom: boolean;
  tiltShift: boolean;
  samples: number;
}

/** How a theme wants the city drawn: in colour, as an engraving, or as an instrument's schematic. */
export type DrawStyle = 'diorama' | 'engraving' | 'instrument';

export interface StyleColours {
  paper: Color;
  ink: Color;
  line: Color;
  accent: Color;
}

export interface Post {
  composer: EffectComposer;
  renderPass: RenderPass;
  /** For the Hall's demos: redraw the city in a theme's style and colours. */
  setStyle(style: DrawStyle, colours?: StyleColours): void;
  setSize(width: number, height: number, pixelRatio: number): void;
  setSettings(settings: PostSettings): void;
  setBloomStrength(strength: number): void;
  /** Where the sharp band sits (0 bottom, 1 top) and how wide it is. */
  setFocus(centre: number, width: number, strength: number): void;
  setNight(night: number): void;
  /**
   * Compiles every shader the first frame will need without blocking the page:
   * the scene's materials as they draw into the composer's target, and the
   * full-screen passes. Resolves when they are ready.
   */
  warm(): Promise<void>;
  render(): void;
  dispose(): void;
}

const PASS_VERTEX = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

/** A tilt-shift blur: sharp in a band across the middle, softening above and below. */
function tiltShiftPass(): {
  pass: ShaderPass;
  uniforms: {
    uResolution: { value: Vector2 };
    uFocus: { value: number };
    uBand: { value: number };
    uStrength: { value: number };
  };
} {
  const uniforms = {
    tDiffuse: { value: null },
    uResolution: { value: new Vector2(1, 1) },
    uFocus: { value: 0.45 },
    uBand: { value: 0.22 },
    uStrength: { value: 1.0 },
  };
  const material = new ShaderMaterial({
    uniforms,
    vertexShader: PASS_VERTEX,
    fragmentShader: TILT_SHIFT_FRAGMENT,
  });
  // Given a material (not a shader description), the pass uses these very uniforms.
  return { pass: new ShaderPass(material), uniforms };
}

/** The finishing grade: vignette, warm highlights by day, cool shadows by night. */
function finishPass(): { pass: ShaderPass; uniforms: { uNight: { value: number } } } {
  const uniforms = { tDiffuse: { value: null }, uNight: { value: 0 } };
  const material = new ShaderMaterial({
    uniforms,
    vertexShader: PASS_VERTEX,
    fragmentShader: FINISH_FRAGMENT,
  });
  return { pass: new ShaderPass(material), uniforms };
}

/**
 * The Hall's drawing styles, both sketches: a few clean lines where the city
 * really changes (a wall against the ground, the river's bank, a field's
 * edge), over a soft wash of two or three tones. The lines are found on a
 * slightly smoothed picture, so fine texture (bricks, ripples, fronds) never
 * becomes a line of its own. An engraving draws in ink on paper with a little
 * hatching in the deepest shade; an instrument draws in the theme's line
 * colour, washed with it, and marks the river and the grain in its accent.
 */
function stylePass(): {
  pass: ShaderPass;
  uniforms: {
    uStyle: { value: number };
    uPaper: { value: Color };
    uInk: { value: Color };
    uLine: { value: Color };
    uAccent: { value: Color };
    uResolution: { value: Vector2 };
  };
} {
  const uniforms = {
    tDiffuse: { value: null },
    uStyle: { value: 0 },
    uPaper: { value: new Color('#f3ead6') },
    uInk: { value: new Color('#3b2f22') },
    uLine: { value: new Color('#1f6f86') },
    uAccent: { value: new Color('#e09a2e') },
    uResolution: { value: new Vector2(1, 1) },
  };
  const material = new ShaderMaterial({
    uniforms,
    vertexShader: PASS_VERTEX,
    fragmentShader: STYLE_FRAGMENT,
  });
  return { pass: new ShaderPass(material), uniforms };
}

const STYLE_FRAGMENT = /* glsl */ `
  uniform sampler2D tDiffuse;
  uniform float uStyle;
  uniform vec3 uPaper;
  uniform vec3 uInk;
  uniform vec3 uLine;
  uniform vec3 uAccent;
  uniform vec2 uResolution;
  varying vec2 vUv;

  vec3 colourAt(vec2 uv) {
    return textureLod(tDiffuse, uv, 0.0).rgb;
  }

  float luma(vec3 c) {
    return dot(c, vec3(0.299, 0.587, 0.114));
  }

  // The tone of a small neighbourhood: texture finer than a few pixels averages away.
  float toneAt(vec2 uv, vec2 r) {
    return (luma(colourAt(uv)) * 2.0 +
            luma(colourAt(uv + vec2(r.x, 0.0))) + luma(colourAt(uv - vec2(r.x, 0.0))) +
            luma(colourAt(uv + vec2(0.0, r.y))) + luma(colourAt(uv - vec2(0.0, r.y)))) / 6.0;
  }

  void main() {
    vec3 colour = colourAt(vUv);
    if (uStyle < 0.5) { gl_FragColor = vec4(colour, 1.0); return; }

    vec2 texel = 1.0 / uResolution;
    vec2 r = texel * 1.2;
    vec2 d = texel;
    // Sobel on the smoothed tone.
    float tl = toneAt(vUv + vec2(-d.x, d.y), r);
    float tc = toneAt(vUv + vec2(0.0, d.y), r);
    float tr = toneAt(vUv + vec2(d.x, d.y), r);
    float ml = toneAt(vUv + vec2(-d.x, 0.0), r);
    float mr = toneAt(vUv + vec2(d.x, 0.0), r);
    float bl = toneAt(vUv + vec2(-d.x, -d.y), r);
    float bc = toneAt(vUv + vec2(0.0, -d.y), r);
    float br = toneAt(vUv + vec2(d.x, -d.y), r);
    float gx = (tr + 2.0 * mr + br) - (tl + 2.0 * ml + bl);
    float gy = (tl + 2.0 * tc + tr) - (bl + 2.0 * bc + br);
    float edge = length(vec2(gx, gy));
    float tone = toneAt(vUv, r);
    // One line per boundary, not two: only the darker side of an edge is inked.
    float around = (tl + tc + tr + ml + mr + bl + bc + br) / 8.0;
    float line = smoothstep(0.2, 0.34, edge) * step(tone, around + 0.004);

    // Two or three soft tones instead of every shade.
    float shade = smoothstep(0.62, 0.52, tone) * 0.5 + smoothstep(0.36, 0.28, tone) * 0.5;
    vec2 px = vUv * uResolution;

    if (uStyle < 1.5) {
      // Engraving: an ink wash, and widely spaced hatching only in the deepest shade.
      vec3 paper = mix(uPaper, uInk, shade * 0.16);
      float hatch = step(0.82, fract((px.x + px.y) / 7.0)) * step(0.75, shade);
      vec3 drawn = mix(paper, uInk, max(hatch * 0.55, line * 0.9));
      gl_FragColor = vec4(drawn, 1.0);
      return;
    }
    // Instrument: washed in the line colour; water and ripe grain picked out in the accent.
    vec3 panel = mix(uPaper, uLine, 0.08 + shade * 0.16);
    float water = smoothstep(0.06, 0.16, colour.b - colour.r) * smoothstep(0.3, 0.45, colour.b);
    float grain = smoothstep(0.12, 0.26, colour.r - colour.b) * smoothstep(0.35, 0.55, tone);
    panel = mix(panel, mix(uPaper, uAccent, 0.38), max(water, grain) * 0.8);
    gl_FragColor = vec4(mix(panel, uLine, line * 0.95), 1.0);
  }
`;

const TILT_SHIFT_FRAGMENT = /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform vec2 uResolution;
    uniform float uFocus;
    uniform float uBand;
    uniform float uStrength;
    varying vec2 vUv;
    void main() {
      float away = max(0.0, abs(vUv.y - uFocus) - uBand);
      float radius = smoothstep(0.0, 0.35, away) * 7.0 * uStrength;
      vec4 sum = texture2D(tDiffuse, vUv);
      if (radius < 0.3) { gl_FragColor = sum; return; }
      float weight = 1.0;
      // A golden-angle spiral of taps: a soft disc blur in one pass. Explicit level 0, since
      // the taps sit behind a branch and implicit derivatives are undefined there.
      for (int i = 1; i < 18; i++) {
        float r = sqrt(float(i) / 17.0) * radius;
        float a = float(i) * 2.39996;
        vec2 offset = vec2(cos(a), sin(a)) * r / uResolution;
        sum += textureLod(tDiffuse, vUv + offset, 0.0);
        weight += 1.0;
      }
      gl_FragColor = sum / weight;
    }
`;

const FINISH_FRAGMENT = /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uNight;
    varying vec2 vUv;
    void main() {
      vec3 colour = texture2D(tDiffuse, vUv).rgb;
      vec2 centred = vUv - 0.5;
      float vignette = 1.0 - dot(centred, centred) * mix(0.55, 0.9, uNight);
      colour *= vignette;
      // Warm the highlights by day, cool the shadows by night.
      float luma = dot(colour, vec3(0.2126, 0.7152, 0.0722));
      colour = mix(colour, colour * vec3(1.04, 1.0, 0.94), (1.0 - uNight) * smoothstep(0.2, 1.0, luma));
      colour = mix(colour, colour * vec3(0.92, 0.96, 1.08), uNight * (1.0 - smoothstep(0.0, 0.5, luma)));
      gl_FragColor = vec4(colour, 1.0);
    }
`;

export function createPost(renderer: WebGLRenderer, scene: Scene, camera: Camera): Post {
  const target = new WebGLRenderTarget(1, 1, { type: HalfFloatType, samples: 4 });
  const composer = new EffectComposer(renderer, target);
  const renderPass = new RenderPass(scene, camera);
  const bloom = new UnrealBloomPass(new Vector2(256, 256), 0.2, 0.55, 0.82);
  const tilt = tiltShiftPass();
  const finish = finishPass();
  const style = stylePass();
  style.pass.enabled = false;
  const output = new OutputPass();
  composer.addPass(renderPass);
  composer.addPass(bloom);
  composer.addPass(tilt.pass);
  composer.addPass(finish.pass);
  composer.addPass(output);
  // Styles work on the finished, tone-mapped picture, so they come last.
  composer.addPass(style.pass);

  return {
    composer,
    renderPass,
    setSize(width, height, pixelRatio) {
      composer.setPixelRatio(pixelRatio);
      composer.setSize(width, height);
      tilt.uniforms.uResolution.value.set(width * pixelRatio, height * pixelRatio);
      style.uniforms.uResolution.value.set(width * pixelRatio, height * pixelRatio);
    },
    setSettings(settings) {
      bloom.enabled = settings.bloom;
      tilt.pass.enabled = settings.tiltShift;
      composer.renderTarget1.samples = settings.samples;
      composer.renderTarget2.samples = settings.samples;
    },
    setStyle(next, colours) {
      style.pass.enabled = next !== 'diorama';
      style.uniforms.uStyle.value = next === 'engraving' ? 1 : next === 'instrument' ? 2 : 0;
      if (colours) {
        // This pass draws after tone mapping, straight to the screen: its colours are display colours.
        style.uniforms.uPaper.value.copy(colours.paper).convertLinearToSRGB();
        style.uniforms.uInk.value.copy(colours.ink).convertLinearToSRGB();
        style.uniforms.uLine.value.copy(colours.line).convertLinearToSRGB();
        style.uniforms.uAccent.value.copy(colours.accent).convertLinearToSRGB();
      }
    },
    setBloomStrength(strength) {
      bloom.strength = strength;
    },
    setFocus(centre, width, strength) {
      tilt.uniforms.uFocus.value = centre;
      tilt.uniforms.uBand.value = width;
      tilt.uniforms.uStrength.value = strength;
    },
    setNight(night) {
      finish.uniforms.uNight.value = night;
    },
    async warm() {
      // Drawing into a render target needs its own shader variants (no tone mapping, linear
      // colour), so the scene is compiled with the composer's target bound. compileAsync starts
      // the compile at once, so the previous target can be restored before waiting.
      const previous = renderer.getRenderTarget();
      renderer.setRenderTarget(composer.renderTarget1);
      const sceneReady = renderer.compileAsync(scene, camera);
      renderer.setRenderTarget(previous);
      const quads = new Scene();
      const geometry = new PlaneGeometry(2, 2);
      const materials: Material[] = [
        tilt.pass.material,
        finish.pass.material,
        style.pass.material,
        output.material,
        bloom.materialHighPassFilter,
        bloom.compositeMaterial,
        bloom.blendMaterial,
        ...bloom.separableBlurMaterials,
      ];
      for (const material of materials) quads.add(new Mesh(geometry, material));
      const passesReady = renderer.compileAsync(quads, new OrthographicCamera(-1, 1, 1, -1, 0, 1));
      await Promise.all([sceneReady, passesReady]);
      geometry.dispose();
    },
    render() {
      composer.render();
    },
    dispose() {
      composer.dispose();
      target.dispose();
    },
  };
}
