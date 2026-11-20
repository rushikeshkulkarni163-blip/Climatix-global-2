/**
 * Point readout for NASA GIBS raster products.
 *
 * GIBS serves visualisation tiles whose palette maps one colour to one value
 * bin. We fetch the tile covering a location at the product's native zoom,
 * read the exact pixel (no colour-space conversion) and look the RGB up in the
 * product's official GIBS colormap. The result is the value *bin* the
 * visualisation encodes — accurate to the colormap's quantisation, which is
 * stated with every reading. It is not the original science-file value.
 */
import { gibsUrl, type GibsLayer } from "./layers";

interface CmEntry { r: number; g: number; b: number; nodata: boolean; value: string | null; label: string | null; units: string; title: string }

export interface Readout {
  status: "ok" | "nodata" | "unmatched" | "error";
  text: string;          // human value, e.g. "301.2–301.8 K (28.1 °C)"
  mid: number | null;    // numeric midpoint when the bin is numeric
  units: string;
  observed: string | null; // date GIBS actually served
  binWidth: string | null;
  layer: GibsLayer;
}

const cmCache = new Map<string, Promise<CmEntry[]>>();

function loadColormap(url: string): Promise<CmEntry[]> {
  if (!cmCache.has(url)) {
    cmCache.set(url, fetch(url).then((r) => r.text()).then((xml) => {
      const doc = new DOMParser().parseFromString(xml, "text/xml");
      const out: CmEntry[] = [];
      doc.querySelectorAll("ColorMap").forEach((cm) => {
        const units = cm.getAttribute("units") ?? "";
        const title = cm.getAttribute("title") ?? "";
        cm.querySelectorAll("ColorMapEntry").forEach((e) => {
          const [r, g, b] = (e.getAttribute("rgb") ?? "0,0,0").split(",").map(Number);
          out.push({ r, g, b, units, title, nodata: e.getAttribute("nodata") === "true" || e.getAttribute("transparent") === "true",
            value: e.getAttribute("value"), label: e.getAttribute("label") });
        });
      });
      return out;
    }).catch((err) => { cmCache.delete(url); throw err; }));
  }
  return cmCache.get(url)!;
}

function tileFor(lon: number, lat: number, z: number) {
  const n = 2 ** z;
  const latR = (Math.max(-85.05, Math.min(85.05, lat)) * Math.PI) / 180;
  const xf = ((lon + 180) / 360) * n;
  const yf = ((1 - Math.log(Math.tan(latR) + 1 / Math.cos(latR)) / Math.PI) / 2) * n;
  const x = Math.floor(xf), y = Math.floor(yf);
  return { x, y, px: Math.min(255, Math.floor((xf - x) * 256)), py: Math.min(255, Math.floor((yf - y) * 256)) };
}

function parseBin(v: string): { lo: number; hi: number } | null {
  const m = v.match(/^[[(]?\s*(-?[\d.eE+]+|-INF)\s*,\s*(-?[\d.eE+]+|INF)\s*[\])]?$/i);
  if (m) {
    const lo = /INF/i.test(m[1]) ? -Infinity : Number(m[1]);
    const hi = /INF/i.test(m[2]) ? Infinity : Number(m[2]);
    return { lo, hi };
  }
  const one = Number(v.replace(/[[\]()]/g, ""));
  return Number.isFinite(one) ? { lo: one, hi: one } : null;
}

function fmtNum(x: number) {
  const a = Math.abs(x);
  if (a !== 0 && (a < 0.01 || a >= 1e5)) return x.toExponential(2);
  return a >= 100 ? x.toFixed(1) : a >= 1 ? x.toFixed(2) : x.toFixed(3);
}

export async function readGibs(layer: GibsLayer, lon: number, lat: number, time = layer.time): Promise<Readout> {
  const base: Readout = { status: "error", text: "—", mid: null, units: "", observed: null, binWidth: null, layer };
  if (!layer.colormap) return { ...base, status: "error", text: "No colormap published for this product" };
  try {
    const { x, y, px, py } = tileFor(lon, lat, layer.maxLevel);
    const url = gibsUrl(layer, time).replace("{z}", String(layer.maxLevel)).replace("{y}", String(y)).replace("{x}", String(x));
    const [entries, res] = await Promise.all([loadColormap(layer.colormap), fetch(url)]);
    const observed = res.headers.get("layer-time-actual")?.slice(0, 10) ?? (layer.cadence === "static" ? "static" : null);
    if (!res.ok) return { ...base, observed, text: `Tile unavailable (${res.status})` };
    const bmp = await createImageBitmap(await res.blob(), { premultiplyAlpha: "none", colorSpaceConversion: "none" });
    const canvas = typeof OffscreenCanvas !== "undefined" ? new OffscreenCanvas(bmp.width, bmp.height) : Object.assign(document.createElement("canvas"), { width: bmp.width, height: bmp.height });
    const ctx = canvas.getContext("2d", { willReadFrequently: true }) as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
    ctx.drawImage(bmp, 0, 0);
    const sx = Math.floor((px * bmp.width) / 256), sy = Math.floor((py * bmp.height) / 256);
    const px4 = ctx.getImageData(sx, sy, 1, 1).data;
    const r = px4[0], g = px4[1], b = px4[2], a = px4[3];
    if (a === 0) return { ...base, status: "nodata", observed, text: "No valid observation at this location for this date (cloud, swath gap or outside coverage)" };
    let best: CmEntry | null = null, bd = Infinity;
    for (const e of entries) {
      const d = (e.r - r) ** 2 + (e.g - g) ** 2 + (e.b - b) ** 2;
      if (d < bd) { bd = d; best = e; }
    }
    if (!best || bd > 48) return { ...base, status: "unmatched", observed, text: `Colour ${r},${g},${b} not in the published colormap` };
    if (best.nodata) return { ...base, status: "nodata", observed, text: best.label ?? "No data" };
    const units = best.units;
    if (best.value) {
      const bin = parseBin(best.value);
      if (bin && Number.isFinite(bin.lo) && Number.isFinite(bin.hi)) {
        const mid = (bin.lo + bin.hi) / 2;
        let text = bin.lo === bin.hi ? `${fmtNum(bin.lo)} ${units}` : `${fmtNum(bin.lo)}–${fmtNum(bin.hi)} ${units}`;
        if (/^K$/i.test(units.trim())) text += ` (${(mid - 273.15).toFixed(1)} °C)`;
        return { status: "ok", text: text.trim(), mid, units, observed, binWidth: bin.lo === bin.hi ? null : fmtNum(bin.hi - bin.lo), layer };
      }
      if (bin) return { status: "ok", text: `${bin.lo === -Infinity ? "<" : ">"} ${fmtNum(Number.isFinite(bin.lo) ? bin.lo : bin.hi)} ${units}`.trim(), mid: null, units, observed, binWidth: null, layer };
    }
    return { status: "ok", text: best.label ?? best.title ?? "Class value", mid: null, units, observed, binWidth: null, layer };
  } catch (e) {
    return { ...base, text: `Readout failed: ${String((e as Error)?.message ?? e)}` };
  }
}
