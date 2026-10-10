/**
 * The window onto the city: one WebGL renderer on a canvas that fills its
 * host, the camera rig (a gentle orbit around a target, eased), the frame
 * loop, the finishing passes and the quality ladder.
 *
 * The loop runs only while the view is visible and not paused; a frame
 * callback lets the cinematic and the interface animate on the same clock.
 */
import {
  ACESFilmicToneMapping,
  MathUtils,
  PCFShadowMap,
  PerspectiveCamera,
  Vector3,
  WebGLRenderer,
} from 'three';
import { createPost, type Post } from './post.ts';
import { createQualityLadder, PROFILES, type QualityLadder, type QualityLevel } from './quality.ts';
import type { CityWorld } from './world.ts';
import { isSoftwareGl } from './gpu.ts';

export interface CameraPose {
  target: { x: number; y: number; z: number };
  /** Radians around the target, 0 looking north from the south. */
  azimuth: number;
  /** Radians above the horizon. */
  elevation: number;
  distance: number;
  fov: number;
}

/** The plan screen's view: the fields in front, the city beyond, the river behind. */
export const PLAN_POSE: CameraPose = {
  target: { x: -6, y: 0, z: -4 },
  azimuth: 0.36,
  elevation: 0.6,
  distance: 168,
  fov: 30,
};

export interface FrameInfo {
  seconds: number;
  time: number;
}

export interface CityView {
  readonly canvas: HTMLCanvasElement;
  readonly camera: PerspectiveCamera;
  readonly renderer: WebGLRenderer;
  readonly ladder: QualityLadder;
  readonly post: Post;
  /** Moves the camera; with `ease` seconds it glides there. */
  setPose(pose: CameraPose, ease?: number): void;
  /** Adds to the orbit's azimuth (Q / E, right-drag). */
  orbit(radians: number): void;
  /** A slow circling, radians per second (the game menu); 0 to stop. */
  setDrift(radiansPerSecond: number): void;
  /** Moves the canvas into another element (screens share one renderer). */
  attach(host: HTMLElement): void;
  setOrbitEnabled(enabled: boolean): void;
  setQualityCeiling(level: QualityLevel): void;
  onFrame(callback: (frame: FrameInfo) => void): () => void;
  setPaused(paused: boolean): void;
  /** Renders one frame now (screenshots, reduced motion stills). */
  renderOnce(): void;
  /** Frames per second over the last second, for the performance notes. */
  readonly fps: number;
  /** Resolves once the shaders are compiled; nothing is drawn before then. */
  readonly ready: Promise<void>;
  /** True when WebGL runs on the CPU (no GPU, or a blocked driver): draw as little as possible. */
  readonly software: boolean;
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

function blendPose(from: CameraPose, to: CameraPose, t: number): CameraPose {
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

export function createCityView(
  initialHost: HTMLElement,
  world: CityWorld,
  options: {
    quality: QualityLevel;
    label: string;
    /** False for the Hall's demos: draw only when asked (renderOnce), never on a loop. */
    loop?: boolean;
  },
): CityView {
  const renderer = new WebGLRenderer({
    antialias: false,
    powerPreference: 'high-performance',
    preserveDrawingBuffer: false,
  });
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = world.palette.exposure;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFShadowMap;
  const canvas = renderer.domElement;
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', options.label);
  canvas.style.display = 'block';
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  let host = initialHost;
  host.append(canvas);

  const software = isSoftwareGl(renderer.getContext());
  const camera = new PerspectiveCamera(30, 1, 0.5, 2400);
  const post = createPost(renderer, world.scene, camera);
  // Without a GPU, begin at the lightest level; the ladder still climbs if frames allow.
  const ladder = createQualityLadder({
    ceiling: options.quality,
    ...(software ? { start: 'light' as const } : {}),
  });

  let pose = PLAN_POSE;
  let from = PLAN_POSE;
  let to = PLAN_POSE;
  let easeFor = 0;
  let easeElapsed = 0;
  let orbitOffset = 0;
  let orbitTarget = 0;
  let orbitEnabled = true;
  let drift = 0;
  let drifted = 0;
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
    world.setWheatDensity(profile.bladesPerParcel);
    world.setShadows(profile.shadowMap);
    renderer.shadowMap.enabled = profile.shadowMap > 0;
    post.setSettings({
      bloom: profile.bloom,
      tiltShift: profile.tiltShift,
      samples: profile.samples,
    });
    resize();
  }

  function resize(): void {
    const width = Math.max(1, host.clientWidth);
    const height = Math.max(1, host.clientHeight);
    const ratio =
      Math.min(window.devicePixelRatio || 1, 2) *
      PROFILES[applied ?? options.quality].resolution *
      (software ? 0.6 : 1);
    renderer.setPixelRatio(ratio);
    renderer.setSize(width, height, false);
    post.setSize(width, height, ratio);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }

  function placeCamera(): void {
    const current: CameraPose = { ...pose, azimuth: pose.azimuth + orbitOffset + drifted };
    camera.position.copy(poseVector(current));
    camera.lookAt(current.target.x, current.target.y, current.target.z);
    if (Math.abs(camera.fov - current.fov) > 1e-3) {
      camera.fov = current.fov;
      camera.updateProjectionMatrix();
    }
  }

  function render(): void {
    // Until the shaders are compiled, drawing would compile them on the spot and stall the page.
    if (!ready) return;
    const night = world.palette.appearance === 'dark' ? 1 : 0;
    renderer.toneMappingExposure = world.palette.exposure;
    post.setBloomStrength(world.palette.bloomStrength);
    post.setNight(night);
    placeCamera();
    post.render();
  }

  function frame(now: number): void {
    frameRequest = null;
    const seconds = Math.min(0.1, (now - last) / 1000);
    const elapsed = now - last;
    last = now;
    applyQuality(ladder.frame(elapsed));
    if (easeFor > 0) {
      easeElapsed = Math.min(easeFor, easeElapsed + seconds);
      const t = MathUtils.smootherstep(easeElapsed / easeFor, 0, 1);
      pose = blendPose(from, to, t);
      if (easeElapsed >= easeFor) easeFor = 0;
    }
    orbitOffset += (orbitTarget - orbitOffset) * Math.min(1, seconds * 4);
    drifted += drift * seconds;
    // Without a drift, ease back to the composed view.
    if (drift === 0) drifted += (0 - drifted) * Math.min(1, seconds * 1.5);
    const time = (now - started) / 1000;
    world.update(seconds, time);
    for (const listener of listeners) listener({ seconds, time });
    render();
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
    if (paused || !visible) render();
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
  const warmed = post
    .warm()
    .catch(() => undefined)
    .then(() => {
      ready = true;
      // A view that is not looping (a demo, a paused screen) still shows its first frame.
      if (paused || !visible || options.loop === false) render();
    });
  schedule();

  return {
    canvas,
    camera,
    renderer,
    ladder,
    post,
    get fps() {
      return fps;
    },
    ready: warmed,
    software,
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
    orbit(radians) {
      if (!orbitEnabled) return;
      orbitTarget = MathUtils.clamp(orbitTarget + radians, -0.9, 0.9);
    },
    setDrift(radiansPerSecond) {
      drift = radiansPerSecond;
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
    setOrbitEnabled(enabled) {
      orbitEnabled = enabled;
      if (!enabled) orbitTarget = 0;
    },
    setQualityCeiling(level) {
      ladder.setCeiling(level);
      applyQuality(level);
    },
    onFrame(callback) {
      listeners.add(callback);
      return () => listeners.delete(callback);
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
      world.update(0, (performance.now() - started) / 1000);
      render();
    },
    dispose() {
      if (frameRequest !== null) cancelAnimationFrame(frameRequest);
      resizeObserver.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      listeners.clear();
      post.dispose();
      renderer.dispose();
      canvas.remove();
    },
  };
}
