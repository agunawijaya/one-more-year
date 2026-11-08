/**
 * Whether WebGL would run on the CPU. Without a usable GPU (no driver, a
 * blocked one, a virtual machine, a test runner) browsers fall back to a
 * software rasteriser; the fresco's shaders still compile there, but each
 * can hold the page for a second or more. That is acceptable once a player
 * has opened the game, and not for a demo tile on the Hall's home page.
 *
 * Kit candidate: Ten Harvests carries the same check.
 */

const SOFTWARE_RENDERERS = /swiftshader|llvmpipe|softpipe|software|basic render/i;

let answer: boolean | null = null;

/** True when there is no WebGL2 at all, or it runs in software. Asked once, on a throwaway context. */
export function webglRunsOnCpu(): boolean {
  if (answer !== null) return answer;
  if (typeof document === 'undefined') return (answer = true);
  const gl = document.createElement('canvas').getContext('webgl2');
  if (!gl) return (answer = true);
  const info = gl.getExtension('WEBGL_debug_renderer_info');
  const name = String(gl.getParameter(info ? info.UNMASKED_RENDERER_WEBGL : gl.RENDERER));
  answer = SOFTWARE_RENDERERS.test(name);
  gl.getExtension('WEBGL_lose_context')?.loseContext();
  return answer;
}
