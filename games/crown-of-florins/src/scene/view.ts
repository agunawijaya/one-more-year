/**
 * The window onto the fresco: one WebGL renderer on a canvas that fills its
 * host, a long-lens camera on a gentle rig (high three-quarter view, the
 * perspective of a painted bird's-eye city), the fresco pass, an optional
 * gilding pass, the frame loop and the quality ladder.
 *
 * The same view draws the city and the valley: `setScene` swaps what it
 * paints. The loop runs only while the view is visible and not paused.
 */
import {
  MathUtils,
  NoToneMapping,
  PCFShadowMap,
  PerspectiveCamera,
  Vector3,
  WebGLRenderer,
  type Scene,
} from 'three';
import { createFrescoPass, type FrescoLook, type FrescoPass } from './fresco.ts';
import { createQualityLadder, PROFILES, type QualityLadder, type QualityLevel } from './quality.ts';

export interface CameraPose {
  target: { x: number; y: number; z: number };
  /** Radians around the target; 0 looks north from the south. */
  azimuth: number;
  /** Radians above the horizon. */
  elevation: number;
  distance: number;
  /** Vertical field of view in degrees: small for the flattened, painted perspective. */
  fov: number;
}

export interface FrameInfo {
  seconds: number;
  time: number;
}

/** Something drawn after the fresco, reading the finished painting (the coronation's gold). */
export interface Overlay {
  render(renderer: WebGLRenderer, painting: FrescoPass, time: number): void;
  setSize(width: number, height: number): void;
}

export interface Painted {
  scene: Scene;
  update(seconds: number, time: number): void;
  setShadowMap?(size: number): void;
  setCrowdShare?(share: number): void;
}

export interface FrescoView {
  readonly canvas: HTMLCanvasElement;
  readonly camera: PerspectiveCamera;
  readonly renderer: WebGLRenderer;
  readonly ladder: QualityLadder;
  readonly fresco: FrescoPass;
  readonly fps: number;
  readonly ready: Promise<void>;
  setScene(painted: Painted): void;
  setPose(pose: CameraPose, ease?: number): void;
  readonly pose: CameraPose;
  setLook(look: FrescoLook): void;
  setFrame(width: number): void;
  setOverlay(overlay: Overlay | null): void;
  setQualityCeiling(level: QualityLevel): void;
  onFrame(callback: (frame: FrameInfo) => void): () => void;
  attach(host: HTMLElement): void;
  setPaused(paused: boolean): void;
  renderOnce(): void;
  /** Projects a world point to the canvas, 0–1 from the top left. */
  project(point: { x: number; y: number; z: number }): { x: number; y: number };
  dispose(): void;
}

function poseVector(pose: CameraPose): Vector3 {
  const horizontal = Math.cos(pose.elevation) * pose.distance;
  return new Vector3(
    pose.target.x + Math.sin(pose.azimuth) * horizontal,
    pose.target.y + Math.sin(pose.elevation) * pose.distance,
    pose.target.z + Math.cos(pose.azimuth) * horizontal,
  );
}

export function blendPose(from: CameraPose, to: CameraPose, t: number): CameraPose {
  const lerp = (a: number, b: number): number => a + (b - a) * t;
  return {
    target: {
      x: lerp(from.target.x, to.target.x),
      y: lerp(from.target.y, to.target.y),
      z: lerp(from.target.z, to.target.z),
    },
    azimuth: lerp(from.azimuth, to.azimuth),
    elevation: lerp(from.elevation, to.elevation),
    distance: lerp(from.distance, to.distance),
    fov: lerp(from.fov, to.fov),
  };
}

/** The pose that frames a circle of `radius` around `target` for a canvas of this aspect. */
export function framingPose(
  target: { x: number; y: number; z: number },
  radius: number,
  aspect: number,
  options: { azimuth?: number; elevation?: number; fov?: number } = {},
): CameraPose {
  const fov = options.fov ?? 15;
  const half = MathUtils.degToRad(fov / 2);
  // Fit the circle's width (narrow canvases) or its foreshortened depth (wide ones).
  const elevation = options.elevation ?? 0.66;
  const fitWidth = radius / (Math.tan(half) * Math.max(0.2, aspect));
  const fitDepth = (radius * Math.sin(elevation) + 10) / Math.tan(half);
  return {
    target,
    azimuth: options.azimuth ?? 0.12,
    elevation,
    distance: Math.max(fitWidth, fitDepth),
    fov,
  };
}

/**
 * The pose that paints a city against its sky: the bottom edge of the
 * picture falls on the ground at `bottomZ`, and a ridge crest of height
 * `crest` at `ridgeZ` sits at `crestAt` of the picture's height (0 bottom,
 * 1 top), so the band above it is sky. Solved in the vertical plane through
 * the target (the small azimuth is ignored).
 */
export function skylinePose(options: {
  x: number;
  bottomZ: number;
  ridgeZ: number;
  crest: number;
  crestAt?: number;
  elevation?: number;
  fov?: number;
  azimuth?: number;
}): CameraPose {
  const elevation = options.elevation ?? 0.5;
  const fov = options.fov ?? 15;
  const half = MathUtils.degToRad(fov / 2);
  const crestNdc = (options.crestAt ?? 0.8) * 2 - 1;
  const bottomSlope = Math.tan(elevation + half);
  const crestSlope = Math.tan(elevation - Math.atan(crestNdc * Math.tan(half)));
  const distance =
    (options.crest + crestSlope * (options.bottomZ - options.ridgeZ)) /
    (Math.sin(elevation) * (1 - crestSlope / bottomSlope));
  const targetZ =
    (distance * Math.sin(elevation)) / bottomSlope -
    distance * Math.cos(elevation) +
    options.bottomZ;
  return {
    target: { x: options.x, y: 0, z: targetZ },
    azimuth: options.azimuth ?? 0.1,
    elevation,
    distance,
    fov,
  };
}

export function createFrescoView(
  initialHost: HTMLElement,
  options: { quality: QualityLevel; label: string; loop?: boolean },
): FrescoView {
  const renderer = new WebGLRenderer({
    antialias: false,
    powerPreference: 'high-performance',
    preserveDrawingBuffer: false,
  });
  renderer.toneMapping = NoToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFShadowMap;
  renderer.setClearColor('#000000', 1);
  const canvas = renderer.domElement;
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', options.label);
  canvas.style.display = 'block';
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  let host = initialHost;
  host.append(canvas);

  const camera = new PerspectiveCamera(15, 1, 20, 5000);
  const fresco = createFrescoPass(renderer);
  const ladder = createQualityLadder({ ceiling: options.quality });

  let painted: Painted | null = null;
  let overlay: Overlay | null = null;
  let pose: CameraPose = {
    target: { x: 0, y: 0, z: 0 },
    azimuth: 0,
    elevation: 0.6,
    distance: 700,
    fov: 15,
  };
  let from = pose;
  let to = pose;
  let easeFor = 0;
  let easeElapsed = 0;
  let paused = false;
  let visible = true;
  let frameRequest: number | null = null;
  let ready = false;
  let last = performance.now();
  const started = last;
  let applied: QualityLevel | null = null;
  let fps = 0;
  let framesThisSecond = 0;
  let secondStarted = last;
  const listeners = new Set<(frame: FrameInfo) => void>();

  function applyQuality(level: QualityLevel): void {
    if (applied === level) return;
    applied = level;
    const profile = PROFILES[level];
    fresco.setSettings({
      brush: profile.brush,
      resolution: profile.postResolution,
      strokeLayers: profile.strokeLayers,
      plaster: profile.plaster,
    });
    painted?.setShadowMap?.(profile.shadowMap);
    painted?.setCrowdShare?.(profile.crowd);
    resize();
  }

  function resize(): void {
    const width = Math.max(1, host.clientWidth);
    const height = Math.max(1, host.clientHeight);
    const ratio =
      Math.min(window.devicePixelRatio || 1, 2) * PROFILES[applied ?? options.quality].resolution;
    renderer.setPixelRatio(ratio);
    renderer.setSize(width, height, false);
    fresco.setSize(width, height, ratio);
    overlay?.setSize(Math.round(width * ratio), Math.round(height * ratio));
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }

  function placeCamera(): void {
    camera.position.copy(poseVector(pose));
    camera.lookAt(pose.target.x, pose.target.y, pose.target.z);
    if (Math.abs(camera.fov - pose.fov) > 1e-3) {
      camera.fov = pose.fov;
      camera.updateProjectionMatrix();
    }
  }

  function render(time: number): void {
    if (!ready || !painted) return;
    placeCamera();
    fresco.setTime(time);
    fresco.setFocus(pose.distance);
    if (overlay) {
      fresco.render(painted.scene, camera, true);
      overlay.render(renderer, fresco, time);
    } else {
      fresco.render(painted.scene, camera, false);
    }
  }

  function frame(now: number): void {
    frameRequest = null;
    const seconds = Math.min(0.1, (now - last) / 1000);
    const elapsed = now - last;
    last = now;
    applyQuality(ladder.frame(elapsed));
    if (easeFor > 0) {
      easeElapsed = Math.min(easeFor, easeElapsed + seconds);
      pose = blendPose(from, to, MathUtils.smootherstep(easeElapsed / easeFor, 0, 1));
      if (easeElapsed >= easeFor) easeFor = 0;
    }
    const time = (now - started) / 1000;
    painted?.update(seconds, time);
    for (const listener of listeners) listener({ seconds, time });
    render(time);
    framesThisSecond++;
    if (now - secondStarted >= 1000) {
      fps = (framesThisSecond * 1000) / (now - secondStarted);
      framesThisSecond = 0;
      secondStarted = now;
    }
    schedule();
  }

  function schedule(): void {
    if (frameRequest !== null || paused || !visible || options.loop === false) return;
    frameRequest = requestAnimationFrame(frame);
  }

  const resizeObserver = new ResizeObserver(() => {
    resize();
    ladder.settle();
    if (paused || !visible || options.loop === false) render((performance.now() - started) / 1000);
  });
  resizeObserver.observe(host);

  const onVisibility = (): void => {
    visible = document.visibilityState !== 'hidden';
    if (visible) {
      last = performance.now();
      ladder.settle();
      schedule();
    }
  };
  document.addEventListener('visibilitychange', onVisibility);

  applyQuality(ladder.level);
  resize();

  let markReady: () => void = () => undefined;
  const readyPromise = new Promise<void>((resolve) => {
    markReady = resolve;
  });

  async function warm(target: Painted): Promise<void> {
    // Compile the scene's shaders for the fresco's target before the first frame, so nothing stalls.
    const previous = renderer.getRenderTarget();
    renderer.setRenderTarget(fresco.sceneTarget);
    const compiled = renderer.compileAsync(target.scene, camera);
    renderer.setRenderTarget(previous);
    await compiled.catch(() => undefined);
  }

  const view: FrescoView = {
    canvas,
    camera,
    renderer,
    ladder,
    fresco,
    get fps() {
      return fps;
    },
    ready: readyPromise,
    get pose() {
      return pose;
    },
    setScene(next) {
      painted = next;
      applied = null;
      applyQuality(ladder.level);
      void warm(next).then(() => {
        ready = true;
        markReady();
        render((performance.now() - started) / 1000);
      });
      schedule();
    },
    setPose(next, ease = 0) {
      if (ease <= 0) {
        pose = next;
        easeFor = 0;
        return;
      }
      from = pose;
      to = next;
      easeFor = ease;
      easeElapsed = 0;
    },
    setLook(look) {
      fresco.setLook(look);
    },
    setFrame(width) {
      fresco.setFrame(width);
    },
    setOverlay(next) {
      overlay = next;
      if (overlay) resize();
    },
    setQualityCeiling(level) {
      ladder.setCeiling(level);
      applyQuality(level);
    },
    onFrame(callback) {
      listeners.add(callback);
      return () => listeners.delete(callback);
    },
    attach(next) {
      if (next === host) return;
      resizeObserver.unobserve(host);
      host = next;
      host.append(canvas);
      resizeObserver.observe(host);
      resize();
      ladder.settle();
    },
    setPaused(next) {
      paused = next;
      if (!paused) {
        last = performance.now();
        ladder.settle();
        schedule();
      } else if (frameRequest !== null) {
        cancelAnimationFrame(frameRequest);
        frameRequest = null;
      }
    },
    renderOnce() {
      const time = (performance.now() - started) / 1000;
      painted?.update(0, time);
      render(time);
    },
    project(point) {
      placeCamera();
      camera.updateMatrixWorld();
      const v = new Vector3(point.x, point.y, point.z).project(camera);
      return { x: (v.x + 1) / 2, y: (1 - v.y) / 2 };
    },
    dispose() {
      if (frameRequest !== null) cancelAnimationFrame(frameRequest);
      resizeObserver.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      listeners.clear();
      fresco.dispose();
      renderer.dispose();
      canvas.remove();
    },
  };
  return view;
}
