/**
 * Street-level and free-roam camera controls.
 *  street: W/S/A/D walk on the ground plane (eye height 1.8 m), drag to look, Shift to run.
 *  free:   W/S/A/D/Q/E fly, speed scales with altitude, drag to look.
 * Arrow keys mirror WASD. Esc is handled by the UI to leave the mode.
 */
import type * as CT from "cesium";
import type { CesiumNS } from "./loader";

export class WalkControls {
  private C: CesiumNS;
  private viewer: CT.Viewer;
  private mode: "street" | "free" | null = null;
  private keys = new Set<string>();
  private drag: { x: number; y: number } | null = null;
  private ground = 0;
  private last = performance.now();
  private off: (() => void)[] = [];

  constructor(C: CesiumNS, viewer: CT.Viewer) { this.C = C; this.viewer = viewer; }

  start(mode: "street" | "free", ground: number) {
    this.stop();
    this.mode = mode;
    this.ground = ground;
    this.last = performance.now();
    const canvas = this.viewer.scene.canvas;
    const kd = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest?.("input,textarea,select")) return;
      this.keys.add(e.key.toLowerCase());
      if (["arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(e.key.toLowerCase())) e.preventDefault();
    };
    const ku = (e: KeyboardEvent) => this.keys.delete(e.key.toLowerCase());
    const pd = (e: PointerEvent) => { this.drag = { x: e.clientX, y: e.clientY }; canvas.setPointerCapture(e.pointerId); };
    const pm = (e: PointerEvent) => {
      if (!this.drag) return;
      const dx = e.clientX - this.drag.x, dy = e.clientY - this.drag.y;
      this.drag = { x: e.clientX, y: e.clientY };
      this.look(dx, dy);
    };
    const pu = () => { this.drag = null; };
    const wheel = (e: WheelEvent) => { if (this.mode === "free") { e.preventDefault(); this.viewer.camera.moveForward(-e.deltaY * this.speed() * 0.01); } };
    const blur = () => this.keys.clear();
    window.addEventListener("keydown", kd);
    window.addEventListener("keyup", ku);
    window.addEventListener("blur", blur);
    canvas.addEventListener("pointerdown", pd);
    canvas.addEventListener("pointermove", pm);
    canvas.addEventListener("pointerup", pu);
    canvas.addEventListener("wheel", wheel, { passive: false });
    this.off = [
      () => window.removeEventListener("keydown", kd), () => window.removeEventListener("keyup", ku),
      () => window.removeEventListener("blur", blur),
      () => canvas.removeEventListener("pointerdown", pd), () => canvas.removeEventListener("pointermove", pm),
      () => canvas.removeEventListener("pointerup", pu), () => canvas.removeEventListener("wheel", wheel),
    ];
  }

  stop() {
    this.off.forEach((f) => f());
    this.off = [];
    this.mode = null;
    this.keys.clear();
    this.drag = null;
  }

  active() { return this.mode; }

  private speed() {
    const h = this.viewer.camera.positionCartographic.height - this.ground;
    if (this.mode === "street") return this.keys.has("shift") ? 9 : 3.2;
    return Math.max(15, Math.min(h * 0.6, 4000)) * (this.keys.has("shift") ? 3 : 1);
  }

  private look(dx: number, dy: number) {
    const { C, viewer } = this;
    const cam = viewer.camera;
    const k = 0.0032;
    const up = C.Ellipsoid.WGS84.geodeticSurfaceNormal(cam.positionWC, new C.Cartesian3());
    cam.look(up, -dx * k);
    const pitch = cam.pitch - dy * k;
    if (pitch > -1.45 && pitch < 1.2) cam.lookDown(dy * k);
  }

  step() {
    if (!this.mode) return;
    const { C, viewer } = this;
    const now = performance.now();
    const dt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    const cam = viewer.camera;
    const k = this.keys;
    const f = (k.has("w") || k.has("arrowup") ? 1 : 0) - (k.has("s") || k.has("arrowdown") ? 1 : 0);
    const r = (k.has("d") || k.has("arrowright") ? 1 : 0) - (k.has("a") || k.has("arrowleft") ? 1 : 0);
    const u = (k.has("e") ? 1 : 0) - (k.has("q") ? 1 : 0);
    if (!f && !r && !u && this.mode !== "street") return;
    const d = this.speed() * dt;
    if (this.mode === "street") {
      const up = C.Ellipsoid.WGS84.geodeticSurfaceNormal(cam.positionWC, new C.Cartesian3());
      const fwd = C.Cartesian3.subtract(cam.directionWC, C.Cartesian3.multiplyByScalar(up, C.Cartesian3.dot(cam.directionWC, up), new C.Cartesian3()), new C.Cartesian3());
      if (C.Cartesian3.magnitude(fwd) < 1e-6) return;
      C.Cartesian3.normalize(fwd, fwd);
      const right = C.Cartesian3.normalize(C.Cartesian3.cross(fwd, up, new C.Cartesian3()), new C.Cartesian3());
      if (f) cam.move(fwd, f * d);
      if (r) cam.move(right, r * d);
      // clamp to eye height above ground
      const c = cam.positionCartographic.clone();
      const target = this.ground + 1.8;
      if (Math.abs(c.height - target) > 0.05) {
        cam.setView({
          destination: C.Cartesian3.fromRadians(c.longitude, c.latitude, target),
          orientation: { heading: cam.heading, pitch: cam.pitch, roll: 0 },
        });
      }
      return;
    }
    if (f) cam.moveForward(f * d);
    if (r) cam.moveRight(r * d);
    if (u) cam.moveUp(u * d);
  }
}
