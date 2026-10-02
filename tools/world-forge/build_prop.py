"""world-forge 지물 — 우물·가로등·울타리·비석 같은 작은 물건을 코드로 만든다 (K-0017 단계 2). 재질만 Poly Haven CC0 사진.

  blender -b --factory-startup -P tools/world-forge/build_prop.py -- --id well_01 --out tools/world-forge/_out/set/well_01.glb [--style toon]
  blender -b --factory-startup -P tools/world-forge/build_prop.py -- --all --out-dir tools/world-forge/_out/set [--style toon]
  blender -b --factory-startup -P tools/world-forge/build_prop.py -- --list

원점 = 바닥 가운데, 단위 미터, z 위. `data/set_plan.json` 의 prop 15개가 전부 여기 있다(사람·얼굴·원작 형태 없음).
각 산출 옆에 `<id>.license.json`(재질 출처 + 만든 법 + 삼각형 수). 툰 GLB 예산은 삼각형 ≤ 5000, 파일 ≤ 0.5MB.
"""
import json
import math
import os
import sys

import bpy
from mathutils import Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import wf_common as W  # noqa: E402

TRIS_MAX = 5000
A = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []


def arg(k, d=None):
    return A[A.index(k) + 1] if k in A else d


# ---------------------------------------------------------------- 도형 도우미 (전부 닫힌 덩어리 — 법선은 Mesh.build 가 바깥으로 맞춘다)

def _basis(axis):
    a = Vector(axis).normalized()
    t = Vector((1, 0, 0)) if abs(a.x) < 0.9 else Vector((0, 1, 0))
    u = a.cross(t).normalized()
    v = a.cross(u).normalized()
    return a, u, v


def tube(M, p0, p1, r0, r1, slot, tile=1.0, n=8, caps=True):
    """p0 → p1 축의 (끝이 좁아지는) 원기둥. r1 == 0 이면 뿔."""
    p0, p1 = Vector(p0), Vector(p1)
    a, u, v = _basis(p1 - p0)
    length = (p1 - p0).length

    def ring(p, r, k):
        ang = 2 * math.pi * k / n
        return p + (u * math.cos(ang) + v * math.sin(ang)) * r

    rr = max(r0, 1e-3)
    for k in range(n):
        k2 = (k + 1) % n
        u0, u1 = 2 * math.pi * rr * k / n / tile, 2 * math.pi * rr * (k + 1) / n / tile
        vl = length / tile
        if r1 > 1e-6:
            M.quad(ring(p0, r0, k), ring(p0, r0, k2), ring(p1, r1, k2), ring(p1, r1, k), slot, (u0, 0), (u1, 0), (u1, vl), (u0, vl))
        else:
            M.face([ring(p0, r0, k), ring(p0, r0, k2), p1], [(u0, 0), (u1, 0), ((u0 + u1) / 2, vl)], slot)
    if caps:
        for p, r, flip in ((p0, r0, True), (p1, r1, False)):
            if r <= 1e-6:
                continue
            ks = list(range(n))
            if flip:
                ks.reverse()
            pts = [ring(p, r, k) for k in ks]
            uvs = [((q - p).dot(u) / tile, (q - p).dot(v) / tile) for q in pts]
            M.face(pts, uvs, slot)


def obox(M, base, size, yaw, slot, tile=1.0):
    """base = 바닥 가운데, size = (x, y, z) 길이, yaw = z 축 회전(도)."""
    c, s = math.cos(math.radians(yaw)), math.sin(math.radians(yaw))
    ex, ey = Vector((c, s, 0)), Vector((-s, c, 0))
    o = Vector(base) - ex * size[0] / 2 - ey * size[1] / 2
    M.box(o, ex * size[0], ey * size[1], Vector((0, 0, size[2])), slot, tile)


def gable(M, base, size, rise, yaw, slot, tile=1.0):
    """박공 지붕(삼각기둥). base = 처마 높이 바닥 가운데, size = (폭 x, 길이 y), rise = 마루 높이. 마루는 y 방향."""
    c, s = math.cos(math.radians(yaw)), math.sin(math.radians(yaw))
    ex, ey = Vector((c, s, 0)), Vector((-s, c, 0))
    b = Vector(base)
    hx, hy = size[0] / 2, size[1] / 2
    p = lambda sx, sy, h: b + ex * (sx * hx) + ey * (sy * hy) + Vector((0, 0, h))
    a0, a1, a2, a3 = p(-1, -1, 0), p(1, -1, 0), p(1, 1, 0), p(-1, 1, 0)
    r0, r1 = p(0, -1, rise), p(0, 1, rise)
    sl = math.hypot(hx, rise) / tile
    ln = size[1] / tile
    M.quad(a0, r0, r1, a3, slot, (0, 0), (sl, 0), (sl, ln), (0, ln))      # -x 비탈
    M.quad(a1, a2, r1, r0, slot, (0, 0), (ln, 0), (ln, sl), (0, sl))      # +x 비탈
    M.face([a0, a1, r0], [(0, 0), (size[0] / tile, 0), (hx / tile, rise / tile)], slot)
    M.face([a2, a3, r1], [(0, 0), (size[0] / tile, 0), (hx / tile, rise / tile)], slot)
    M.quad(a0, a3, a2, a1, slot, (0, 0), (0, ln), (size[0] / tile, ln), (size[0] / tile, 0))


def annulus(M, c, r_in, r_out, h, slot, tile=1.0, n=14):
    """고리 기둥(우물 둘레). 닫힌 덩어리."""
    c = Vector(c)
    pt = lambda r, k, z: c + Vector((math.cos(2 * math.pi * k / n) * r, math.sin(2 * math.pi * k / n) * r, z))
    for k in range(n):
        k2 = (k + 1) % n
        u0, u1 = k * 2 * math.pi * r_out / n / tile, (k + 1) * 2 * math.pi * r_out / n / tile
        vl = h / tile
        M.quad(pt(r_out, k, 0), pt(r_out, k2, 0), pt(r_out, k2, h), pt(r_out, k, h), slot, (u0, 0), (u1, 0), (u1, vl), (u0, vl))
        M.quad(pt(r_in, k2, 0), pt(r_in, k, 0), pt(r_in, k, h), pt(r_in, k2, h), slot, (u1, 0), (u0, 0), (u0, vl), (u1, vl))
        M.quad(pt(r_in, k, h), pt(r_out, k, h), pt(r_out, k2, h), pt(r_in, k2, h), slot, (0, 0), (0.3, 0), (0.3, 0.3), (0, 0.3))
        M.quad(pt(r_in, k, 0), pt(r_in, k2, 0), pt(r_out, k2, 0), pt(r_out, k, 0), slot, (0, 0), (0.3, 0), (0.3, 0.3), (0, 0.3))


class Ctx:
    def __init__(self, name):
        self.M = W.Mesh(name)
        self.mats = set()

    def s(self, mat, tile=1.0, tint=None, gain=1.0, sat=1.0):
        key = f'{mat}|{tile}|{tint}|{gain}|{sat}'
        self.mats.add(mat)
        return self.M.slot_of(key, W.pbr_material(mat, tile, tint, name=mat, gain=gain, sat=sat))


# ---------------------------------------------------------------- 지물 15개 (id → 함수)

def well_01(C):
    M = C.M
    st = C.s('castle_wall_slates', 1.2)
    wd = C.s('brown_planks_03', 1.0)
    rf = C.s('clay_roof_tiles', 1.4)
    annulus(M, (0, 0, 0), 0.55, 0.85, 0.95, st, 1.2)
    for sx in (-1, 1):
        obox(M, (sx * 0.78, 0, 0.95), (0.13, 0.13, 1.45), 0, wd)
    obox(M, (0, 0, 2.28), (1.8, 0.16, 0.14), 0, wd)
    gable(M, (0, 0, 2.38), (1.7, 1.3), 0.5, 90, rf, 1.4)
    tube(M, (0, 0, 1.85), (0, 0, 2.28), 0.02, 0.02, wd, 1.0, 5)          # 두레박 줄
    tube(M, (0, 0, 1.55), (0, 0, 1.85), 0.15, 0.13, wd, 0.5, 8)          # 두레박


def street_lamp_01(C):
    M = C.M
    metal = C.s('concrete_wall_001', 1.0, '#3b3f46')
    glow = C.s('beige_wall_001', 1.0, '#ffe39a', gain=1.5)
    tube(M, (0, 0, 0), (0, 0, 0.35), 0.17, 0.12, metal, 1.0, 8)
    tube(M, (0, 0, 0.35), (0, 0, 4.2), 0.07, 0.045, metal, 1.0, 8)
    obox(M, (0.45, 0, 4.15), (1.0, 0.1, 0.07), 0, metal)               # 뻗은 팔
    obox(M, (0.9, 0, 3.7), (0.34, 0.34, 0.42), 0, glow)               # 등
    tube(M, (0.9, 0, 4.12), (0.9, 0, 4.3), 0.26, 0.05, metal, 1.0, 8)  # 갓
    obox(M, (0.9, 0, 3.62), (0.4, 0.4, 0.08), 0, metal)


def signal_pylon_01(C):
    M = C.M
    body = C.s('white_stucco', 1.0, '#c9d6e6')
    edge = C.s('grey_plaster', 1.0, '#566274')
    glow = C.s('white_stucco', 1.0, '#58e3ff', gain=1.6)
    tube(M, (0, 0, 0), (0, 0, 0.25), 0.62, 0.55, edge, 1.0, 6)
    tube(M, (0, 0, 0.25), (0, 0, 2.6), 0.32, 0.18, body, 1.0, 6)
    tube(M, (0, 0, 1.0), (0, 0, 1.2), 0.36, 0.36, glow, 1.0, 6)         # 빛 띠
    tube(M, (0, 0, 1.75), (0, 0, 1.9), 0.27, 0.27, glow, 1.0, 6)
    tube(M, (0, 0, 2.6), (0, 0, 3.4), 0.24, 0.0, glow, 1.0, 4)           # 결정 끝


def torch_stand_01(C):
    M = C.M
    wd = C.s('black_painted_planks', 1.0)
    fire = C.s('clay_roof_tiles', 1.0, '#ff8a2a', gain=1.7)
    obox(M, (0, 0, 0), (0.5, 0.5, 0.12), 0, wd)
    tube(M, (0, 0, 0.12), (0, 0, 1.45), 0.08, 0.07, wd, 1.0, 6)
    tube(M, (0, 0, 1.45), (0, 0, 1.8), 0.11, 0.24, wd, 0.6, 8)           # 불 그릇
    tube(M, (0, 0, 1.78), (0, 0, 2.35), 0.2, 0.0, fire, 1.0, 6)          # 불꽃


def altar_01(C):
    M = C.M
    st = C.s('castle_wall_slates', 1.5)
    dk = C.s('castle_wall_slates', 1.5, '#8f8a82')
    obox(M, (0, 0, 0), (2.6, 1.8, 0.28), 0, st, 1.5)
    obox(M, (0, 0, 0.28), (2.0, 1.25, 0.4), 0, dk, 1.5)
    obox(M, (0, 0, 0.68), (1.7, 0.95, 0.14), 0, st, 1.5)
    for sx in (-1, 1):
        tube(M, (sx * 0.72, -0.34, 0.82), (sx * 0.72, -0.34, 1.5), 0.1, 0.08, st, 1.0, 6)
        tube(M, (sx * 0.72, 0.34, 0.82), (sx * 0.72, 0.34, 1.5), 0.1, 0.08, st, 1.0, 6)


def iron_fence_01(C):
    M = C.M
    metal = C.s('concrete_wall_001', 1.0, '#2e3036')
    for k in range(13):
        x = -1.5 + k * 0.25
        tube(M, (x, 0, 0.1), (x, 0, 1.5), 0.025, 0.025, metal, 1.0, 4)
        tube(M, (x, 0, 1.5), (x, 0, 1.68), 0.04, 0.0, metal, 1.0, 4)     # 창끝
    for z in (0.35, 1.2):
        obox(M, (0, 0, z), (3.1, 0.05, 0.06), 0, metal)
    for sx in (-1.55, 1.55):
        obox(M, (sx, 0, 0), (0.14, 0.14, 1.9), 0, metal)
        tube(M, (sx, 0, 1.9), (sx, 0, 2.1), 0.1, 0.0, metal, 1.0, 4)


def wood_fence_01(C):
    M = C.M
    wd = C.s('brown_planks_03', 1.0)
    for sx in (-1.5, 0, 1.5):
        obox(M, (sx, 0, 0), (0.12, 0.12, 1.1), 0, wd)
    for z in (0.35, 0.78):
        obox(M, (0, -0.1, z), (3.1, 0.05, 0.1), 0, wd)
    for k in range(11):
        x = -1.4 + k * 0.28
        obox(M, (x, 0.04, 0), (0.15, 0.04, 0.95 + (0.04 if k % 2 else 0)), 0, wd)


def mailbox_01(C):
    M = C.M
    wd = C.s('brown_planks_03', 1.0)
    red = C.s('clay_roof_tiles', 1.0, '#b3322b')
    obox(M, (0, 0, 0), (0.12, 0.12, 1.15), 0, wd)
    obox(M, (0, 0, 1.15), (0.34, 0.5, 0.26), 0, red)
    gable(M, (0, 0, 1.41), (0.34, 0.5), 0.12, 90, red, 0.6)
    obox(M, (0.0, 0.3, 1.2), (0.05, 0.06, 0.18), 0, wd)                # 깃발 대


def haystack_01(C):
    M = C.M
    hay = C.s('thatch_roof_angled', 1.2, '#e2bc62', gain=1.7, sat=1.3)
    tube(M, (0, 0, 0), (0, 0, 1.0), 1.05, 0.9, hay, 1.2, 10)
    tube(M, (0, 0, 1.0), (0, 0, 2.0), 0.9, 0.0, hay, 1.2, 10)


def bamboo_clump_01(C):
    M = C.M
    green = C.s('white_stucco', 1.0, '#78a845', sat=1.1)
    leaf = C.s('white_stucco', 1.0, '#4f9a35', gain=1.0)
    culms = [(-0.25, 0.1, 4.6, -0.05, 0.03), (0.2, -0.12, 5.4, 0.04, -0.02), (0.05, 0.3, 4.2, 0.0, 0.06),
             (-0.05, -0.3, 5.0, -0.03, -0.05), (0.35, 0.2, 3.8, 0.07, 0.03), (-0.4, -0.15, 3.9, -0.06, 0.02), (0.1, 0.0, 5.8, 0.02, 0.01)]
    for x, y, h, tx, ty in culms:
        top = Vector((x + tx * h, y + ty * h, h))
        tube(M, (x, y, 0), top, 0.05, 0.035, green, 1.0, 5)
        for f in (0.25, 0.5, 0.75):                                      # 마디
            c = Vector((x + tx * h * f, y + ty * h * f, h * f))
            tube(M, c, c + Vector((0, 0, 0.04)), 0.06, 0.06, green, 1.0, 5, caps=False)
        tube(M, top - Vector((0, 0, 0.5)), top + Vector((0, 0, 0.55)), 0.28, 0.0, leaf, 1.0, 5)   # 잎 뭉치


def stele_01(C):
    M = C.M
    st = C.s('japanese_stone_wall', 1.2)
    dk = C.s('japanese_stone_wall', 1.2, '#8a8478')
    obox(M, (0, 0, 0), (1.3, 0.7, 0.25), 0, dk, 1.2)                  # 받침
    obox(M, (0, 0, 0.25), (0.95, 0.24, 2.0), 0, st, 1.2)
    gable(M, (0, 0, 2.25), (1.05, 0.34), 0.26, 90, dk, 1.0)         # 갓


def stone_lantern_01(C):
    M = C.M
    st = C.s('japanese_stone_wall', 1.0)
    dk = C.s('japanese_stone_wall', 1.0, '#8a8478')
    glow = C.s('beige_wall_001', 1.0, '#ffd37a', gain=1.4)
    tube(M, (0, 0, 0), (0, 0, 0.2), 0.34, 0.3, dk, 1.0, 6)
    tube(M, (0, 0, 0.2), (0, 0, 1.05), 0.13, 0.11, st, 1.0, 6)
    tube(M, (0, 0, 1.05), (0, 0, 1.2), 0.34, 0.3, dk, 1.0, 6)
    obox(M, (0, 0, 1.2), (0.38, 0.38, 0.42), 0, glow)                 # 불집(불빛 면)
    tube(M, (0, 0, 1.62), (0, 0, 1.78), 0.5, 0.42, dk, 1.0, 6)       # 지붕 처마
    tube(M, (0, 0, 1.78), (0, 0, 2.15), 0.42, 0.0, dk, 1.0, 6)
    tube(M, (0, 0, 2.15), (0, 0, 2.3), 0.06, 0.0, st, 1.0, 5)


def banner_pole_01(C):
    M = C.M
    st = C.s('castle_wall_slates', 1.2)
    wd = C.s('black_painted_planks', 1.0)
    cloth = C.s('clay_roof_tiles', 1.0, '#8b1e2d', sat=0.9)
    obox(M, (0, 0, 0), (0.7, 0.7, 0.3), 0, st, 1.2)
    tube(M, (0, 0, 0.3), (0, 0, 5.2), 0.07, 0.05, wd, 1.0, 6)
    obox(M, (0.55, 0, 4.5), (1.1, 0.06, 0.06), 0, wd)                  # 가로대
    obox(M, (0.55, 0, 2.6), (0.95, 0.025, 1.9), 0, cloth)             # 무늬 없는 천
    tube(M, (0, 0, 5.2), (0, 0, 5.45), 0.09, 0.0, wd, 1.0, 5)


def city_wall_segment_01(C):
    M = C.M
    st = C.s('castle_wall_slates', 1.6)
    dk = C.s('castle_wall_slates', 1.6, '#9b958b')
    obox(M, (0, 0, 0), (4.0, 1.0, 3.1), 0, st, 1.6)
    obox(M, (0, 0, 3.1), (4.0, 1.12, 0.14), 0, dk, 1.6)               # 윗띠
    for k in range(5):
        obox(M, (-1.6 + k * 0.8, 0, 3.24), (0.5, 1.12, 0.55), 0, st, 1.6)   # 총안 사이 돌출부
    obox(M, (0, -0.52, 0.0), (4.0, 0.12, 0.35), 0, dk, 1.6)           # 밑둥 보강


def brazier_01(C):
    M = C.M
    metal = C.s('concrete_wall_001', 1.0, '#34363c')
    fire = C.s('clay_roof_tiles', 1.0, '#ff7a22', gain=1.8)
    for k in range(3):
        ang = 2 * math.pi * k / 3 + 0.4
        x, y = math.cos(ang) * 0.42, math.sin(ang) * 0.42
        tube(M, (x, y, 0), (x * 0.4, y * 0.4, 0.85), 0.04, 0.035, metal, 1.0, 5)
    tube(M, (0, 0, 0.78), (0, 0, 1.22), 0.2, 0.55, metal, 1.0, 10, caps=True)   # 그릇
    tube(M, (0, 0, 1.2), (0, 0, 1.28), 0.5, 0.5, fire, 1.0, 10)           # 숯
    tube(M, (0, 0, 1.28), (0, 0, 1.85), 0.34, 0.0, fire, 1.0, 6)          # 불꽃


PROPS = {f.__name__: f for f in (
    well_01, street_lamp_01, signal_pylon_01, torch_stand_01, altar_01, iron_fence_01, wood_fence_01, mailbox_01,
    haystack_01, bamboo_clump_01, stele_01, stone_lantern_01, banner_pole_01, city_wall_segment_01, brazier_01)}


def build(pid, out, style):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    W._mat_cache.clear()
    W.set_style(style)
    C = Ctx(pid)
    PROPS[pid](C)
    ob = C.M.build()
    bpy.context.view_layer.objects.active = ob
    tris = sum(len(p.vertices) - 2 for p in ob.data.polygons)
    pts = [Vector(c) for c in ob.bound_box]
    lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
    hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    os.makedirs(os.path.dirname(os.path.abspath(out)), exist_ok=True)
    W.export_glb([ob], out, 256 if style == 'toon' else 1024)
    size = [round(hi[i] - lo[i], 2) for i in range(3)]
    lic = {'id': pid, 'generator': 'tools/world-forge/build_prop.py', 'blender': bpy.app.version_string, 'style': style,
           'license': 'CC0-1.0 (재질 사진 전부 Poly Haven CC0, 형태는 전부 코드)',
           'inputs': sorted(f'polyhaven: {m}' for m in C.mats), 'size_m': size, 'tris': tris}
    json.dump(lic, open(os.path.splitext(out)[0] + '.license.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    kb = os.path.getsize(out) // 1024
    print('WORLDFORGE', json.dumps({'id': pid, 'tris': tris, 'size_m': size, 'kb': kb, 'ok': tris <= TRIS_MAX and (style != 'toon' or kb <= 512)}))


if __name__ == '__main__':
    style = arg('--style', 'real')
    if '--list' in A:
        print('PROPS', ' '.join(PROPS))
    elif '--all' in A:
        d = arg('--out-dir')
        for pid in PROPS:
            build(pid, os.path.join(d, pid + '.glb'), style)
    else:
        build(arg('--id'), arg('--out'), style)
