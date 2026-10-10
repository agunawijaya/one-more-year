/**
 * Whether WebGL runs on the CPU. Browsers without a usable GPU (no driver, a
 * blocked one, a virtual machine, a test runner) fall back to a software
 * rasteriser such as SwiftShader or llvmpipe. Shaders still compile there,
 * but each one can hold the page for a second or more, which is fine for a
 * player who opened the game and wrong for a demo on the Hall's home page.
 */

const SOFTWARE = /swiftshader|llvmpipe|softpipe|software|basic render/i;

/** The renderer's own name for itself, unmasked where the browser allows it. */
export function rendererName(gl: WebGLRenderingContext | WebGL2RenderingContext): string {
  const info = gl.getExtension('WEBGL_debug_renderer_info');
  return String(gl.getParameter(info ? info.UNMASKED_RENDERER_WEBGL : gl.RENDERER));
}

export function isSoftwareGl(gl: WebGLRenderingContext | WebGL2RenderingContext): boolean {
  return SOFTWARE.test(rendererName(gl));
}

let cached: boolean | null = null;

/** True when there is no WebGL2 at all, or it runs in software. Asked once, with a throwaway context. */
export function webglRunsOnCpu(): boolean {
  if (cached !== null) return cached;
  if (typeof document === 'undefined') return (cached = true);
  const gl = document.createElement('canvas').getContext('webgl2');
  if (!gl) return (cached = true);
  cached = isSoftwareGl(gl);
  gl.getExtension('WEBGL_lose_context')?.loseContext();
  return cached;
}
