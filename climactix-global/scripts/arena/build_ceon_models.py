#!/usr/bin/env python3
"""
Procedural glTF models for the Climactix Earth Observation Network (CEON) —
four *virtual* mission concepts. Geometry follows small Earth-observation
spacecraft conventions (≈1.5 m bus, deployable solar wings, nadir instruments,
radiators, high-gain antenna, star trackers). Not models of real spacecraft.

Axes (glTF, y-up, metres): +X = flight direction (ram), −Y = nadir, ±Z = wings.
Cesium's Y-up→Z-up correction maps these to model X = velocity, Z = zenith.

Usage: python scripts/arena/build_ceon_models.py   (needs numpy, pillow)
"""
from __future__ import annotations

import io
import json
import math
import struct
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "public" / "arena" / "models"
LOGO = ROOT / "public" / "logo.png"
FONT = "/System/Library/Fonts/HelveticaNeue.ttc"


# ── textures ────────────────────────────────────────────────────────────────

def font(size: int, bold: bool = True):
    try:
        return ImageFont.truetype(FONT, size, index=1 if bold else 0)
    except Exception:
        return ImageFont.load_default()


def tex_mli(tint=(212, 160, 62), seed=1) -> bytes:
    rng = np.random.default_rng(seed)
    n = rng.normal(0, 1, (256, 256)).astype(np.float32)
    img = Image.fromarray(((n - n.min()) / (n.max() - n.min()) * 255).astype(np.uint8)).resize((1024, 1024), Image.BICUBIC)
    img = img.filter(ImageFilter.GaussianBlur(3.0))
    a = np.asarray(img, dtype=np.float32) / 255.0
    crease = np.abs(np.sin(a * 18.0)) ** 6  # foil crinkle highlights
    shade = 0.78 + 0.22 * a + 0.18 * crease
    rgb = np.clip(np.stack([shade * c for c in tint], -1), 0, 255).astype(np.uint8)
    im = Image.fromarray(rgb, "RGB")
    d = ImageDraw.Draw(im)
    for x in range(0, 1024, 256):  # blanket seams / kapton tape
        d.line([(x, 0), (x, 1024)], fill=tuple(int(c * 0.68) for c in tint), width=5)
    for y in range(0, 1024, 340):
        d.line([(0, y), (1024, y)], fill=tuple(int(c * 0.74) for c in tint), width=4)
    return png(im)


def tex_cells() -> bytes:
    im = Image.new("RGB", (1024, 1024), (16, 24, 46))
    d = ImageDraw.Draw(im)
    cw, ch = 1024 // 8, 1024 // 12
    for i in range(8):
        for j in range(12):
            x0, y0 = i * cw + 5, j * ch + 5
            shade = 70 + ((i * 7 + j * 3) % 5) * 3
            d.rectangle([x0, y0, x0 + cw - 10, y0 + ch - 10], fill=(18, 30, shade))
            for k in range(1, 6):
                d.line([(x0 + k * (cw - 10) // 6, y0), (x0 + k * (cw - 10) // 6, y0 + ch - 10)], fill=(92, 102, 124), width=1)
            d.line([(x0, y0 + (ch - 10) // 2), (x0 + cw - 10, y0 + (ch - 10) // 2)], fill=(120, 126, 140), width=2)
    d.rectangle([0, 0, 1023, 1023], outline=(160, 162, 168), width=12)
    return png(im)


def tex_brand(code: str, name: str) -> bytes:
    W, H = 2048, 1024
    im = Image.new("RGB", (W, H), (236, 237, 239))
    d = ImageDraw.Draw(im)
    if LOGO.exists():
        lg = Image.open(LOGO).convert("RGBA")
        s = 600
        lg.thumbnail((s, s))
        tile = Image.new("RGB", (s + 80, s + 80), (0, 0, 0))
        tile.paste(lg, ((s + 80 - lg.width) // 2, (s + 80 - lg.height) // 2), lg)
        im.paste(tile, (100, (H - tile.height) // 2))
    x = 840
    d.text((x, 240), "CLIMACTIX GLOBAL", font=font(108), fill=(17, 17, 17))
    d.text((x, 392), code, font=font(168), fill=(11, 61, 145))
    d.text((x, 600), name.upper(), font=font(60), fill=(60, 60, 64))
    d.text((x, 700), "EARTH OBSERVATION NETWORK · MISSION CONCEPT", font=font(46, False), fill=(90, 90, 96))
    d.rectangle([0, 0, W - 1, H - 1], outline=(150, 150, 156), width=16)
    return png(im)


def png(im: Image.Image) -> bytes:
    b = io.BytesIO()
    im.save(b, "PNG", optimize=True)
    return b.getvalue()


# ── geometry ────────────────────────────────────────────────────────────────

class Mesh:
    def __init__(self):
        self.p, self.n, self.uv, self.i = [], [], [], []

    def quad(self, a, b, c, d, nrm, uvs=((0, 1), (1, 1), (1, 0), (0, 0))):
        base = len(self.p)
        for v, t in zip((a, b, c, d), uvs):
            self.p.append(v); self.n.append(nrm); self.uv.append(t)
        self.i += [base, base + 1, base + 2, base, base + 2, base + 3]

    def tri(self, a, b, c, nrm):
        base = len(self.p)
        for v in (a, b, c):
            self.p.append(v); self.n.append(nrm); self.uv.append((0.5, 0.5))
        self.i += [base, base + 1, base + 2]


def box(m: Mesh, c, s):
    cx, cy, cz = c
    hx, hy, hz = s[0] / 2, s[1] / 2, s[2] / 2
    X0, X1, Y0, Y1, Z0, Z1 = cx - hx, cx + hx, cy - hy, cy + hy, cz - hz, cz + hz
    m.quad((X1, Y0, Z1), (X1, Y0, Z0), (X1, Y1, Z0), (X1, Y1, Z1), (1, 0, 0))
    m.quad((X0, Y0, Z0), (X0, Y0, Z1), (X0, Y1, Z1), (X0, Y1, Z0), (-1, 0, 0))
    m.quad((X0, Y1, Z1), (X1, Y1, Z1), (X1, Y1, Z0), (X0, Y1, Z0), (0, 1, 0))
    m.quad((X0, Y0, Z0), (X1, Y0, Z0), (X1, Y0, Z1), (X0, Y0, Z1), (0, -1, 0))
    m.quad((X0, Y0, Z1), (X1, Y0, Z1), (X1, Y1, Z1), (X0, Y1, Z1), (0, 0, 1))
    m.quad((X1, Y0, Z0), (X0, Y0, Z0), (X0, Y1, Z0), (X1, Y1, Z0), (0, 0, -1))


def face(m: Mesh, c, s, axis: str):
    """Single textured quad on the −X face (branding plate), facing −X."""
    cx, cy, cz = c
    hy, hz = s[1] / 2, s[2] / 2
    m.quad((cx, cy - hy, cz - hz), (cx, cy - hy, cz + hz), (cx, cy + hy, cz + hz), (cx, cy + hy, cz - hz), (-1, 0, 0),
           uvs=((1, 1), (0, 1), (0, 0), (1, 0)))


def cyl(m: Mesh, c, r, length, axis="y", seg=40, cap=True, r2=None):
    r2 = r if r2 is None else r2
    cx, cy, cz = c

    def P(a, t, rr):
        u, v = rr * math.cos(a), rr * math.sin(a)
        if axis == "y":
            return (cx + u, cy + t, cz + v)
        if axis == "x":
            return (cx + t, cy + u, cz + v)
        return (cx + u, cy + v, cz + t)

    def N(a):
        u, v = math.cos(a), math.sin(a)
        return (u, 0, v) if axis == "y" else (0, u, v) if axis == "x" else (u, v, 0)

    h = length / 2
    for k in range(seg):
        a0, a1 = 2 * math.pi * k / seg, 2 * math.pi * (k + 1) / seg
        m.quad(P(a0, -h, r), P(a1, -h, r), P(a1, h, r2), P(a0, h, r2), N((a0 + a1) / 2),
               uvs=((k / seg, 1), ((k + 1) / seg, 1), ((k + 1) / seg, 0), (k / seg, 0)))
        if cap:
            ax = {"y": (0, 1, 0), "x": (1, 0, 0), "z": (0, 0, 1)}[axis]
            m.tri(P(a1, h, r2), P(a0, h, r2), P(0, h, 0), ax)
            m.tri(P(a0, -h, r), P(a1, -h, r), P(0, -h, 0), tuple(-x for x in ax))


def dish(m: Mesh, c, r, depth, seg=48, rings=10):
    """Parabolic reflector opening towards +Y (zenith), double-sided via material."""
    cx, cy, cz = c
    for j in range(rings):
        r0, r1 = r * j / rings, r * (j + 1) / rings
        y0, y1 = depth * (r0 / r) ** 2, depth * (r1 / r) ** 2
        for k in range(seg):
            a0, a1 = 2 * math.pi * k / seg, 2 * math.pi * (k + 1) / seg
            pts = [(cx + rr * math.cos(a), cy + yy, cz + rr * math.sin(a)) for rr, yy, a in
                   ((r0, y0, a0), (r0, y0, a1), (r1, y1, a1), (r1, y1, a0))]
            nrm = (-math.cos((a0 + a1) / 2) * 0.4, 1.0, -math.sin((a0 + a1) / 2) * 0.4)
            L = math.sqrt(sum(x * x for x in nrm))
            m.quad(*pts, tuple(x / L for x in nrm))


# ── missions ────────────────────────────────────────────────────────────────

MISSIONS = {
    "ceon-01": {"name": "Carbon Observation", "mli": (212, 160, 62), "wings": 3},
    "ceon-02": {"name": "Thermal Intelligence", "mli": (212, 160, 62), "wings": 2},
    "ceon-03": {"name": "Atmospheric Intelligence", "mli": (196, 198, 204), "wings": 3},
    "ceon-04": {"name": "Climate & Environment", "mli": (212, 160, 62), "wings": 2},
}


def build(code: str, spec: dict) -> bytes:
    parts: dict[str, Mesh] = {k: Mesh() for k in
                              ["mli", "cells", "panelback", "radiator", "baffle", "alu", "glass", "brand"]}
    B = (1.4, 1.5, 1.3)  # bus x, y, z
    box(parts["mli"], (0, 0, 0), B)
    face(parts["brand"], (-B[0] / 2 - 0.004, 0.05, 0), (0, 0.62, 1.1), "x")
    # top deck radiator + star trackers
    box(parts["radiator"], (0.1, B[1] / 2 + 0.02, 0), (1.1, 0.04, 1.0))
    for z in (-0.35, 0.35):
        box(parts["alu"], (-0.45, B[1] / 2 + 0.12, z), (0.18, 0.16, 0.18))
        cyl(parts["baffle"], (-0.45, B[1] / 2 + 0.28, z), 0.07, 0.18, "y", 16, True, 0.09)
    # high-gain antenna on boom
    cyl(parts["alu"], (0.45, B[1] / 2 + 0.45, -0.3), 0.025, 0.85, "y", 10)
    dish(parts["alu"], (0.45, B[1] / 2 + 0.88, -0.3), 0.32, 0.12)
    # magnetometer boom
    cyl(parts["alu"], (-1.35, -0.2, 0.5), 0.018, 1.3, "x", 8)
    # bus edge frames (aluminium longerons) for crisp silhouettes
    hx, hy, hz = B[0] / 2, B[1] / 2, B[2] / 2
    for sx in (-1, 1):
        for sz in (-1, 1):
            box(parts["alu"], (sx * hx, 0, sz * hz), (0.04, B[1] + 0.02, 0.04))
        for sy in (-1, 1):
            box(parts["alu"], (sx * hx, sy * hy, 0), (0.04, 0.04, B[2] + 0.02))
    for sy in (-1, 1):
        for sz in (-1, 1):
            box(parts["alu"], (0, sy * hy, sz * hz), (B[0] + 0.02, 0.04, 0.04))
    # propulsion: four hydrazine thrusters on the aft (−X) face
    for ty in (-0.45, 0.45):
        for tz in (-0.4, 0.4):
            cyl(parts["alu"], (-hx - 0.06, ty, tz), 0.035, 0.12, "x", 16, True, 0.06)
    # coarse sun sensors and GNSS patch on the top deck
    for sx, sz in ((0.55, 0.5), (-0.55, -0.5), (0.55, -0.5)):
        box(parts["glass"], (sx, hy + 0.05, sz), (0.08, 0.02, 0.08))
    cyl(parts["radiator"], (-0.1, hy + 0.06, 0.45), 0.08, 0.03, "y", 24)
    # X-band downlink antenna (nadir)
    cyl(parts["alu"], (0.5, -B[1] / 2 - 0.08, 0.45), 0.06, 0.16, "y", 12, True, 0.02)
    # solar wings (±Z), yoke + panels
    n = spec["wings"]
    for sgn in (-1, 1):
        cyl(parts["alu"], (0, 0.15, sgn * (B[2] / 2 + 0.3)), 0.03, 0.6, "z", 10)
        for k in range(n):
            zc = sgn * (B[2] / 2 + 0.6 + 0.78 + k * 1.58)
            for hxp in (-0.45, 0.45):  # hinge brackets between panels
                box(parts["alu"], (hxp, 0.13, zc - sgn * 0.78), (0.08, 0.05, 0.06))
            box(parts["panelback"], (0, 0.13, zc), (1.25, 0.03, 1.52))
            # sun-facing cells (+Y)
            parts["cells"].quad((-0.62, 0.146, zc - 0.75), (0.62, 0.146, zc - 0.75), (0.62, 0.146, zc + 0.75),
                                (-0.62, 0.146, zc + 0.75), (0, 1, 0))
    # instruments on nadir deck (−Y)
    y0 = -B[1] / 2
    if code == "ceon-01":  # SWIR/NIR imaging grating spectrometer: three co-boresighted channels
        box(parts["mli"], (0.05, y0 - 0.28, 0), (0.95, 0.56, 0.8))
        for z in (-0.25, 0, 0.25):
            cyl(parts["baffle"], (0.25, y0 - 0.62, z), 0.085, 0.18, "y", 18)
            cyl(parts["glass"], (0.25, y0 - 0.715, z), 0.07, 0.01, "y", 18)
        box(parts["radiator"], (-0.4, y0 - 0.3, 0.42), (0.5, 0.5, 0.02))
    elif code == "ceon-02":  # thermal-infrared imager with cryocooler radiators
        cyl(parts["alu"], (0.1, y0 - 0.38, 0), 0.34, 0.76, "y", 32)
        cyl(parts["baffle"], (0.1, y0 - 0.86, 0), 0.30, 0.22, "y", 32, False, 0.33)
        cyl(parts["glass"], (0.1, y0 - 0.77, 0), 0.28, 0.01, "y", 32)
        for z in (-0.5, 0.5):
            box(parts["radiator"], (-0.35, y0 - 0.35, z), (0.55, 0.6, 0.02))
    elif code == "ceon-03":  # UV–VIS–NIR–SWIR push-broom spectrometer, 108° cross-track slit
        box(parts["mli"], (0, y0 - 0.22, 0), (0.75, 0.44, 1.15))
        box(parts["baffle"], (0.12, y0 - 0.45, 0), (0.12, 0.04, 0.95))
        box(parts["glass"], (0.12, y0 - 0.472, 0), (0.06, 0.006, 0.85))
        box(parts["alu"], (-0.25, y0 - 0.48, 0), (0.2, 0.1, 0.4))
    else:  # ceon-04: multispectral push-broom imager (VNIR + SWIR) and calibration unit
        box(parts["alu"], (0.1, y0 - 0.3, 0), (0.85, 0.6, 0.7))
        for z in (-0.18, 0.18):
            cyl(parts["baffle"], (0.25, y0 - 0.68, z), 0.12, 0.18, "y", 20)
            cyl(parts["glass"], (0.25, y0 - 0.775, z), 0.1, 0.01, "y", 20)
        box(parts["radiator"], (-0.42, y0 - 0.3, 0), (0.02, 0.5, 0.6))

    images = {"mli": tex_mli(spec["mli"], seed=int(code[-2:])), "cells": tex_cells(), "brand": tex_brand(code.upper(), spec["name"])}
    mats = {
        "mli": dict(base=[1, 1, 1, 1], metal=0.85, rough=0.38, tex="mli"),
        "cells": dict(base=[1, 1, 1, 1], metal=0.25, rough=0.22, tex="cells"),
        "panelback": dict(base=[0.16, 0.16, 0.17, 1], metal=0.2, rough=0.7),
        "radiator": dict(base=[0.92, 0.92, 0.90, 1], metal=0.0, rough=0.45),
        "baffle": dict(base=[0.025, 0.025, 0.03, 1], metal=0.1, rough=0.95),
        "alu": dict(base=[0.78, 0.79, 0.81, 1], metal=1.0, rough=0.4),
        "glass": dict(base=[0.05, 0.07, 0.10, 1], metal=0.9, rough=0.06),
        "brand": dict(base=[1, 1, 1, 1], metal=0.0, rough=0.6, tex="brand"),
    }
    return write_glb(parts, mats, images)


def write_glb(parts: dict[str, Mesh], mats: dict, images: dict[str, bytes]) -> bytes:
    blobs: list[bytes] = []
    views, accessors, prims, materials, textures, imgs = [], [], [], [], [], []

    def add_view(data: bytes, target=None):
        off = sum(len(b) for b in blobs)
        pad = (4 - len(data) % 4) % 4
        blobs.append(data + b"\x00" * pad)
        v = {"buffer": 0, "byteOffset": off, "byteLength": len(data)}
        if target:
            v["target"] = target
        views.append(v)
        return len(views) - 1

    tex_index = {}
    for k, data in images.items():
        bv = add_view(data)
        imgs.append({"bufferView": bv, "mimeType": "image/png"})
        textures.append({"source": len(imgs) - 1, "sampler": 0})
        tex_index[k] = len(textures) - 1

    for name, m in parts.items():
        if not m.i:
            continue
        spec = mats[name]
        mat = {"name": name, "doubleSided": True,
               "pbrMetallicRoughness": {"baseColorFactor": spec["base"], "metallicFactor": spec["metal"], "roughnessFactor": spec["rough"]}}
        if "tex" in spec:
            mat["pbrMetallicRoughness"]["baseColorTexture"] = {"index": tex_index[spec["tex"]]}
        materials.append(mat)
        p = np.array(m.p, np.float32); n = np.array(m.n, np.float32)
        n /= np.linalg.norm(n, axis=1, keepdims=True).clip(1e-6)
        uv = np.array(m.uv, np.float32); idx = np.array(m.i, np.uint32)
        a0 = len(accessors)
        accessors += [
            {"bufferView": add_view(p.tobytes(), 34962), "componentType": 5126, "count": len(p), "type": "VEC3",
             "min": p.min(0).tolist(), "max": p.max(0).tolist()},
            {"bufferView": add_view(n.tobytes(), 34962), "componentType": 5126, "count": len(n), "type": "VEC3"},
            {"bufferView": add_view(uv.tobytes(), 34962), "componentType": 5126, "count": len(uv), "type": "VEC2"},
            {"bufferView": add_view(idx.tobytes(), 34963), "componentType": 5125, "count": len(idx), "type": "SCALAR"},
        ]
        prims.append({"attributes": {"POSITION": a0, "NORMAL": a0 + 1, "TEXCOORD_0": a0 + 2}, "indices": a0 + 3,
                      "material": len(materials) - 1})

    binary = b"".join(blobs)
    gltf = {
        "asset": {"version": "2.0", "generator": "climactix-ceon-models"},
        "scene": 0, "scenes": [{"nodes": [0]}], "nodes": [{"mesh": 0, "name": "spacecraft"}],
        "meshes": [{"primitives": prims}], "materials": materials, "textures": textures, "images": imgs,
        "samplers": [{"magFilter": 9729, "minFilter": 9987, "wrapS": 10497, "wrapT": 10497}],
        "buffers": [{"byteLength": len(binary)}], "bufferViews": views, "accessors": accessors,
    }
    js = json.dumps(gltf, separators=(",", ":")).encode()
    js += b" " * ((4 - len(js) % 4) % 4)
    total = 12 + 8 + len(js) + 8 + len(binary)
    return (struct.pack("<III", 0x46546C67, 2, total) + struct.pack("<II", len(js), 0x4E4F534A) + js
            + struct.pack("<II", len(binary), 0x004E4942) + binary)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    for code, spec in MISSIONS.items():
        data = build(code, spec)
        (OUT / f"{code}.glb").write_bytes(data)
        print(f"[ceon] {code}.glb {len(data)/1e3:.0f} kB")


if __name__ == "__main__":
    main()
