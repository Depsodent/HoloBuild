import { create } from "zustand";
export function isSoftwareRenderer(renderer: string) {
  return /swiftshader|llvmpipe|softpipe|software|microsoft basic render|\bwarp\b/i.test(
    renderer,
  );
}
export const useGraphicsInfo = create(() => ({
  renderer: "Not reported",
  webgl2: false,
  software: false,
  reported: false,
}));
export function recordGraphics(
  gl: WebGLRenderingContext | WebGL2RenderingContext,
) {
  try {
    const ext = gl.getExtension("WEBGL_debug_renderer_info");
    const renderer = String(
      ext
        ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)
        : gl.getParameter(gl.RENDERER),
    );
    useGraphicsInfo.setState({
      renderer,
      reported: !!ext,
      webgl2: String(gl.getParameter(gl.VERSION)).includes("WebGL 2"),
      software: isSoftwareRenderer(renderer),
    });
  } catch {
    /* Privacy settings may restrict renderer details. */
  }
}
export function autoUsesGpu() {
  const info = useGraphicsInfo.getState();
  return info.webgl2 && !info.software;
}
