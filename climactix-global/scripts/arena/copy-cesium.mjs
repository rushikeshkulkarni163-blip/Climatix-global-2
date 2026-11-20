// Copies the prebuilt CesiumJS bundle into public/cesium so it is served as
// static assets (Workers, Assets, ThirdParty, Widgets) instead of being bundled.
import { cpSync, existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const src = join(root, "node_modules", "cesium", "Build", "Cesium");
const dest = join(root, "public", "cesium");
const version = JSON.parse(readFileSync(join(root, "node_modules", "cesium", "package.json"), "utf8")).version;
const stamp = join(dest, ".version");

if (!existsSync(src)) {
  console.warn("[arena] cesium not installed; skipping copy");
  process.exit(0);
}
if (existsSync(stamp) && readFileSync(stamp, "utf8").trim() === version) process.exit(0);
mkdirSync(dest, { recursive: true });
for (const d of ["Cesium.js", "Workers", "Assets", "ThirdParty", "Widgets"]) {
  cpSync(join(src, d), join(dest, d), { recursive: true });
}
writeFileSync(stamp, version);
console.log(`[arena] copied CesiumJS ${version} to public/cesium`);
