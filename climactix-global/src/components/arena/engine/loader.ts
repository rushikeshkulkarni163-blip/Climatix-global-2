/**
 * Loads the prebuilt CesiumJS bundle from /cesium (copied there by
 * scripts/arena/copy-cesium.mjs). Keeping Cesium out of the webpack graph
 * avoids a 20+ MB client chunk and its worker/asset path problems.
 */
export type CesiumNS = typeof import("cesium");

declare global {
  interface Window { Cesium?: CesiumNS; CESIUM_BASE_URL?: string }
}

let pending: Promise<CesiumNS> | null = null;

export function loadCesium(base = "/cesium/"): Promise<CesiumNS> {
  if (typeof window === "undefined") return Promise.reject(new Error("Cesium requires a browser"));
  if (window.Cesium) return Promise.resolve(window.Cesium);
  if (pending) return pending;
  window.CESIUM_BASE_URL = base;
  pending = new Promise<CesiumNS>((resolve, reject) => {
    if (!document.querySelector(`link[data-cesium-css]`)) {
      const css = document.createElement("link");
      css.rel = "stylesheet";
      css.href = `${base}Widgets/widgets.css`;
      css.dataset.cesiumCss = "1";
      document.head.appendChild(css);
    }
    const s = document.createElement("script");
    s.src = `${base}Cesium.js`;
    s.async = true;
    s.onload = () => (window.Cesium ? resolve(window.Cesium) : reject(new Error("Cesium global missing after load")));
    s.onerror = () => { pending = null; reject(new Error("Could not load /cesium/Cesium.js — run `npm install` (postinstall copies CesiumJS)")); };
    document.head.appendChild(s);
  });
  return pending;
}
