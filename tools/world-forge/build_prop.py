"""world-forge 지물 — 우물·가로등·울타리·비석 같은 작은 물건을 코드로 만든다 (K-0017 단계 2). 재질만 자체 PBR(K-0113).

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
GENERATOR = 'tools/world-forge/build_prop.py'
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
        self.glows = set()

    def s(self, mat, tile=1.0, tint=None, gain=1.0, sat=1.0):
        key = f'{mat}|{tile}|{tint}|{gain}|{sat}'
        self.mats.add(mat)
        return self.M.slot_of(key, W.pbr_material(mat, tile, tint, name=mat, gain=gain, sat=sat))

    def glow(self, name):
        """K-0155 불빛 면 칸 — `glow_fire`(횃불·화로·초) · `glow_lamp`(등·가로등·석등 창)."""
        self.glows.add(name)
        return self.M.slot_of(name, W.glow_material(name))


NODES = []                                                       # K-0155 빈 노드(이름, 위치, scale|None) — build 가 메시와 한 GLB 에 싣는다


def node(name, pos, scale=None):
    NODES.append((name, tuple(pos), scale))


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
    glow = C.glow('glow_lamp')                                         # K-0155 (옛 beige_wall_001 #ffe39a ×1.5)
    tube(M, (0, 0, 0), (0, 0, 0.35), 0.17, 0.12, metal, 1.0, 8)
    tube(M, (0, 0, 0.35), (0, 0, 4.2), 0.07, 0.045, metal, 1.0, 8)
    obox(M, (0.45, 0, 4.15), (1.0, 0.1, 0.07), 0, metal)               # 뻗은 팔
    obox(M, (0.9, 0, 3.7), (0.34, 0.34, 0.42), 0, glow)               # 등
    tube(M, (0.9, 0, 4.12), (0.9, 0, 4.3), 0.26, 0.05, metal, 1.0, 8)  # 갓
    obox(M, (0.9, 0, 3.62), (0.4, 0.4, 0.08), 0, metal)
    node('light_point', (0.9, 0, 3.91))                               # 등 가운데


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
    fire = C.glow('glow_fire')                                         # K-0155 (옛 clay_roof_tiles #ff8a2a ×1.7)
    obox(M, (0, 0, 0), (0.5, 0.5, 0.12), 0, wd)
    tube(M, (0, 0, 0.12), (0, 0, 1.45), 0.08, 0.07, wd, 1.0, 6)
    tube(M, (0, 0, 1.45), (0, 0, 1.8), 0.11, 0.24, wd, 0.6, 8)           # 불 그릇
    tube(M, (0, 0, 1.78), (0, 0, 2.35), 0.2, 0.0, fire, 1.0, 6)          # 불꽃
    node('light_point', (0, 0, 1.95))


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
    glow = C.glow('glow_lamp')                                         # K-0155 (옛 beige_wall_001 #ffd37a ×1.4)
    tube(M, (0, 0, 0), (0, 0, 0.2), 0.34, 0.3, dk, 1.0, 6)
    tube(M, (0, 0, 0.2), (0, 0, 1.05), 0.13, 0.11, st, 1.0, 6)
    tube(M, (0, 0, 1.05), (0, 0, 1.2), 0.34, 0.3, dk, 1.0, 6)
    obox(M, (0, 0, 1.2), (0.38, 0.38, 0.42), 0, glow)                 # 불집(불빛 면)
    tube(M, (0, 0, 1.62), (0, 0, 1.78), 0.5, 0.42, dk, 1.0, 6)       # 지붕 처마
    tube(M, (0, 0, 1.78), (0, 0, 2.15), 0.42, 0.0, dk, 1.0, 6)
    tube(M, (0, 0, 2.15), (0, 0, 2.3), 0.06, 0.0, st, 1.0, 5)
    node('light_point', (0, 0, 1.41))                                 # 불집 가운데


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
    fire = C.glow('glow_fire')                                         # K-0155 (옛 clay_roof_tiles #ff7a22 ×1.8)
    for k in range(3):
        ang = 2 * math.pi * k / 3 + 0.4
        x, y = math.cos(ang) * 0.42, math.sin(ang) * 0.42
        tube(M, (x, y, 0), (x * 0.4, y * 0.4, 0.85), 0.04, 0.035, metal, 1.0, 5)
    tube(M, (0, 0, 0.78), (0, 0, 1.22), 0.2, 0.55, metal, 1.0, 10, caps=True)   # 그릇
    tube(M, (0, 0, 1.2), (0, 0, 1.28), 0.5, 0.5, fire, 1.0, 10)           # 숯
    tube(M, (0, 0, 1.28), (0, 0, 1.85), 0.34, 0.0, fire, 1.0, 6)          # 불꽃
    node('light_point', (0, 0, 1.45))



# ---------------------------------------------------------------- K-0172 유니티 PolyHaven 짝 10 (상표·글자 없는 일반 물건, 크기 = 옛 것 최대 변)

def road_barrier_01(C):
    """콘크리트 도로 방벽 1.56 × 0.44 × 1.1m — 넓은 밑·좁은 위 단면, 빨강 띠."""
    M = C.M
    cc = C.s('concrete_wall_001', 1.0)
    red = C.s('grey_plaster', 0.6, tint='#c8372d')
    L = 1.56
    prof = [(-0.22, 0.0), (0.22, 0.0), (0.22, 0.08), (0.12, 0.3), (0.08, 1.1), (-0.08, 1.1), (-0.12, 0.3), (-0.22, 0.08)]
    for i in range(len(prof)):
        (y0, z0), (y1, z1) = prof[i], prof[(i + 1) % len(prof)]
        M.quad(Vector((-L / 2, y0, z0)), Vector((L / 2, y0, z0)), Vector((L / 2, y1, z1)), Vector((-L / 2, y1, z1)), cc, (0, 0), (L, 0), (L, 0.3), (0, 0.3))
    for x, flip in ((-L / 2, True), (L / 2, False)):
        pts = [Vector((x, y, z)) for y, z in (list(reversed(prof)) if flip else prof)]
        M.face(pts, [(q.y, q.z) for q in pts], cc)
    for k in range(4):
        obox(M, (-L / 2 + 0.22 + k * 0.38, -0.105, 0.62), (0.2, 0.012, 0.36), 0, red)


def covered_car_01(C):
    """덮개 씌운 승용차 4.4 × 1.8 × 1.7m — 둥근 천 덮개 덩어리 + 바퀴 아래쪽."""
    M = C.M
    cloth = C.s('white_stucco', 0.8, tint='#8a96a3')      # 회청색 천(갈색 바탕 clay_plaster 에 곱하면 갈색이 됨)
    tyre = C.s('bitumen', 0.5, tint='#2a2a2a')
    for x in (-1.35, 1.35):
        for y in (-0.78, 0.78):
            tube(M, (x, y - 0.11, 0.33), (x, y + 0.11, 0.33), 0.33, 0.33, tyre, 0.5, 12)
    n, m = 14, 9
    rows = []
    for i in range(n + 1):
        t = i / n
        x = -2.2 + 4.4 * t
        roof = 0.85 + 0.8 * math.sin(math.pi * min(1.0, max(0.0, (t - 0.18) / 0.62)))
        hh = roof if 0.06 < t < 0.94 else 0.8
        ring = []
        for j in range(m + 1):
            a = math.pi * j / m
            ring.append(Vector((x, -math.cos(a) * 0.92, 0.22 + math.sin(a) * (hh - 0.22))))
        rows.append(ring)
    for i in range(n):
        for j in range(m):
            M.quad(rows[i][j], rows[i + 1][j], rows[i + 1][j + 1], rows[i][j + 1], cloth,
                   (i * 0.3, j * 0.3), ((i + 1) * 0.3, j * 0.3), ((i + 1) * 0.3, (j + 1) * 0.3), (i * 0.3, (j + 1) * 0.3))
    for i, flip in ((0, False), (n, True)):
        pts = rows[i][::-1] if flip else rows[i]
        M.face(pts, [(q.y, q.z) for q in pts], cloth)
    obox(M, (0, 0, 0.16), (4.3, 1.82, 0.08), 0, cloth)


def old_tyre_01(C):
    """낡은 타이어(눕힘) 지름 0.6 · 폭 0.17m — 도넛."""
    M = C.M
    tyre = C.s('bitumen', 0.3, tint='#2b2b2b')
    n, m, R, r = 20, 8, 0.215, 0.085

    def pt(i, j):
        u, v = 2 * math.pi * i / n, 2 * math.pi * j / m
        return Vector((math.cos(u) * (R + r * math.cos(v)), math.sin(u) * (R + r * math.cos(v)), 0.085 + r * math.sin(v)))
    for i in range(n):
        for j in range(m):
            M.quad(pt(i, j), pt(i + 1, j), pt(i + 1, j + 1), pt(i, j + 1), tyre,
                   (i * 0.1, j * 0.1), ((i + 1) * 0.1, j * 0.1), ((i + 1) * 0.1, (j + 1) * 0.1), (i * 0.1, (j + 1) * 0.1))


def generator_01(C):
    """휴대 발전기 0.82 × 0.59 × 0.56m — 관 틀 안 엔진·연료 탱크."""
    M = C.M
    frame = C.s('corrugated_iron', 0.4, tint='#2d2f33')
    body = C.s('grey_plaster', 0.5, tint='#d9a21b')
    dark = C.s('bitumen', 0.4, tint='#3a3a3a')
    for x in (-0.38, 0.38):
        for y in (-0.26, 0.26):
            tube(M, (x, y, 0.0), (x, y, 0.54), 0.018, 0.018, frame, 0.4, 6)
        tube(M, (x, -0.26, 0.54), (x, 0.26, 0.54), 0.018, 0.018, frame, 0.4, 6)
        tube(M, (x, -0.26, 0.02), (x, 0.26, 0.02), 0.018, 0.018, frame, 0.4, 6)
    for y in (-0.26, 0.26):
        tube(M, (-0.38, y, 0.54), (0.38, y, 0.54), 0.018, 0.018, frame, 0.4, 6)
    obox(M, (0.1, 0, 0.32), (0.5, 0.44, 0.2), 0, body)
    obox(M, (-0.12, 0, 0.04), (0.42, 0.4, 0.28), 0, dark)
    tube(M, (0.22, -0.1, 0.52), (0.22, -0.1, 0.56), 0.04, 0.04, dark, 0.3, 8)
    obox(M, (-0.3, 0.2, 0.12), (0.1, 0.06, 0.12), 0, body)


def searchlight_01(C):
    """이동식 탐조등 높이 0.25m — 세발 받침·등통·빛(light_point)."""
    M = C.M
    metal = C.s('corrugated_iron', 0.3, tint='#3b4048')
    for k in range(3):
        a = 2 * math.pi * k / 3
        tube(M, (0, 0, 0.12), (math.cos(a) * 0.08, math.sin(a) * 0.08, 0.0), 0.006, 0.006, metal, 0.3, 5)
    tube(M, (0, 0, 0.12), (0, 0, 0.15), 0.012, 0.012, metal, 0.3, 6)
    tube(M, (-0.07, 0, 0.19), (0.05, 0, 0.19), 0.055, 0.065, metal, 0.3, 12)
    tube(M, (0.05, 0, 0.19), (0.056, 0, 0.19), 0.062, 0.062, C.glow('glow_lamp'), 0.3, 12)
    node('light_point', (0.09, 0, 0.19))


def power_box_01(C):
    """전기 분전함 0.52 × 0.43 × 1.12m — 받침·문 틈·손잡이·환기 줄."""
    M = C.M
    box = C.s('corrugated_iron', 0.6, tint='#8c949a')
    dark = C.s('bitumen', 0.3, tint='#33363a')
    obox(M, (0, 0, 0), (0.52, 0.43, 0.08), 0, dark)
    obox(M, (0, 0, 0.08), (0.5, 0.4, 1.0), 0, box)
    obox(M, (0, 0, 1.08), (0.54, 0.44, 0.04), 0, box)
    obox(M, (0, -0.205, 0.12), (0.006, 0.01, 0.9), 0, dark)
    for x in (-0.06, 0.06):
        obox(M, (x, -0.21, 0.55), (0.02, 0.02, 0.1), 0, dark)
    for k in range(5):
        obox(M, (0, -0.205, 0.86 + k * 0.03), (0.3, 0.012, 0.01), 0, dark)


def security_camera_01(C):
    """벽걸이 보안 카메라 0.34m — 벽판(뒤 +y)·팔·몸통·렌즈(-y)·차양."""
    M = C.M
    white = C.s('grey_plaster', 0.3, tint='#e6e8ea')
    dark = C.s('bitumen', 0.2, tint='#1d1f22')
    obox(M, (0, 0, 0.0), (0.09, 0.03, 0.14), 0, white)
    tube(M, (0, 0, 0.1), (0, -0.12, 0.17), 0.016, 0.016, white, 0.3, 6)
    tube(M, (0, -0.06, 0.2), (0, -0.3, 0.17), 0.05, 0.045, white, 0.3, 10)
    tube(M, (0, -0.3, 0.17), (0, -0.33, 0.17), 0.035, 0.03, dark, 0.3, 10)
    obox(M, (0, -0.18, 0.245), (0.12, 0.28, 0.01), 0, white)


def wicker_basket_01(C):
    """버들 바구니 지름 0.38 · 높이 0.3m — 테·손잡이 반고리."""
    M = C.M
    wk = C.s('thatch_roof_angled', 0.25, tint='#c49a5c')
    wd = C.s('coated_pine', 0.3, tint='#8a6436')
    tube(M, (0, 0, 0), (0, 0, 0.2), 0.15, 0.19, wk, 0.25, 16, caps=False)
    tube(M, (0, 0, 0), (0, 0, 0.004), 0.15, 0.15, wk, 0.25, 16)
    annulus(M, (0, 0, 0.2), 0.18, 0.195, 0.02, wd, 0.3, 16)
    n = 10
    for k in range(n):
        a0, a1 = math.pi * k / n, math.pi * (k + 1) / n
        tube(M, (math.cos(a0) * 0.17, 0, 0.21 + math.sin(a0) * 0.08), (math.cos(a1) * 0.17, 0, 0.21 + math.sin(a1) * 0.08), 0.01, 0.01, wd, 0.3, 6)


def wooden_bucket_01(C):
    """나무 들통 지름 0.36 · 높이 0.34m — 쇠테 둘·쇠 손잡이."""
    M = C.M
    wd = C.s('brown_planks_03', 0.4)
    iron = C.s('corrugated_iron', 0.3, tint='#3c3a36')
    tube(M, (0, 0, 0), (0, 0, 0.3), 0.15, 0.175, wd, 0.4, 16, caps=False)
    tube(M, (0, 0, 0.02), (0, 0, 0.03), 0.152, 0.152, wd, 0.4, 16)
    annulus(M, (0, 0, 0.05), 0.155, 0.162, 0.025, iron, 0.3, 16)
    annulus(M, (0, 0, 0.24), 0.17, 0.177, 0.025, iron, 0.3, 16)
    n = 10
    for k in range(n):
        a0, a1 = math.pi * k / n, math.pi * (k + 1) / n
        tube(M, (math.cos(a0) * 0.17, 0, 0.3 + math.sin(a0) * 0.05), (math.cos(a1) * 0.17, 0, 0.3 + math.sin(a1) * 0.05), 0.006, 0.006, iron, 0.3, 5)


def pocket_compass_01(C):
    """회중 나침반(허리 꾸밈) 지름 0.08 · 고리 포함 0.12m — 놋쇠 통·흰 판(-y)·붉은 바늘."""
    M = C.M
    brass = C.s('corrugated_iron', 0.1, tint='#b8913f')
    face = C.s('white_stucco', 0.1)
    red = C.s('grey_plaster', 0.1, tint='#b0302a')
    c = Vector((0, 0, 0.045))
    tube(M, c + Vector((0, 0.011, 0)), c + Vector((0, -0.011, 0)), 0.04, 0.04, brass, 0.1, 18)
    tube(M, c + Vector((0, -0.011, 0)), c + Vector((0, -0.0118, 0)), 0.034, 0.034, face, 0.1, 18)
    tube(M, c + Vector((0, -0.012, -0.022)), c + Vector((0, -0.012, 0.022)), 0.003, 0.0, red, 0.1, 4)
    tube(M, (0, 0, 0.085), (0, 0, 0.095), 0.006, 0.006, brass, 0.1, 6)
    annulus(M, (0, 0, 0.098), 0.009, 0.013, 0.004, brass, 0.1, 10)



def pen_fence_01(C):
    """가축 우리 울타리 한 칸 가로 2.0 · 높이 0.85m (K-0181) — 껍질 남은 통나무 기둥 둘 + 가로대 둘, 옆 칸과 기둥을 나눠 가로로 이어 붙인다."""
    M = C.M
    log = C.s('coated_pine', 0.6, tint='#8a6a48')
    rail = C.s('brown_planks_03', 0.6, tint='#b48a5c')
    for sx in (-1.0, 1.0):
        tube(M, (sx, 0, 0), (sx, 0, 0.85), 0.07, 0.06, log, 0.6, 8)
        tube(M, (sx, 0, 0.85), (sx, 0, 0.9), 0.06, 0.0, log, 0.6, 8)
    for z, sag in ((0.32, 0.015), (0.66, 0.02)):
        n = 6
        for k in range(n):
            x0, x1 = -1.0 + 2.0 * k / n, -1.0 + 2.0 * (k + 1) / n
            z0 = z - sag * math.sin(math.pi * k / n)
            z1 = z - sag * math.sin(math.pi * (k + 1) / n)
            tube(M, (x0, -0.06, z0), (x1, -0.06, z1), 0.05, 0.05, rail, 0.6, 6)


def pen_gate_01(C):
    """가축 우리 문 한 칸 가로 1.2 · 높이 0.9m (K-0181) — 기둥 둘 + 판문(가로대 셋·대각 버팀·쇠 경첩·고리)."""
    M = C.M
    log = C.s('coated_pine', 0.6, tint='#8a6a48')
    wd = C.s('brown_planks_03', 0.6, tint='#c29a68')
    iron = C.s('corrugated_iron', 0.3, tint='#3c3a36')
    for sx in (-0.6, 0.6):
        tube(M, (sx, 0, 0), (sx, 0, 0.95), 0.07, 0.06, log, 0.6, 8)
        tube(M, (sx, 0, 0.95), (sx, 0, 1.0), 0.06, 0.0, log, 0.6, 8)
    for z in (0.2, 0.5, 0.8):
        obox(M, (0, -0.07, z), (1.05, 0.05, 0.1), 0, wd)
    for k in range(5):
        obox(M, (-0.42 + k * 0.21, -0.1, 0.12), (0.14, 0.03, 0.76), 0, wd)
    b0, b1 = Vector((-0.45, -0.11, 0.22)), Vector((0.45, -0.11, 0.78))
    tube(M, b0, b1, 0.035, 0.035, wd, 0.6, 6)
    for z in (0.2, 0.8):
        obox(M, (-0.5, -0.12, z), (0.14, 0.02, 0.05), 0, iron)
    tube(M, (0.5, -0.13, 0.5), (0.5, -0.17, 0.5), 0.025, 0.025, iron, 0.3, 6)


# ---------------------------------------------------------------- K-0193 4종횡 옆보기 발판 키트(폭이 가변이라 이어 붙인다)
# 원점 = **윗면 가운데**(z 0 = 밟는 면, 아래로 내려감) · x = 발판 길이 · y = 깊이(화면 안쪽 +). 가운데 마디는 x 1.0m 를 이음매 없이 반복,
# 끝 마디는 +x 쪽이 끝(왼쪽 끝은 엔진이 x −1 거울) · 사다리 마디는 원점 = 아래 가운데, z 1.0m 반복.

def _plank_deck(M, wd, x0, x1, seed):
    """x0→x1 을 깊이 방향 판자(폭 0.19·틈 0.01)로 덮는다 — 판마다 두께·높이 조금씩 다름."""
    n = max(1, round((x1 - x0) / 0.2))
    w = (x1 - x0) / n
    for k in range(n):
        h = 0.055 + 0.01 * ((k * 7 + seed) % 3) / 2
        dz = -0.004 * ((k * 5 + seed) % 2)
        obox(M, (x0 + w * (k + 0.5), 0, dz - h), (w - 0.012, 0.8, h), 0, wd)


def plat_wood_mid_01(C):
    """나무 발판 가운데 마디 1.0 × 0.8m — 판자 다섯 + 밑 각재 둘(깊이 앞뒤) + 받침 쐐기."""
    M = C.M
    wd = C.s('brown_planks_03', 0.8, tint='#b58a5e')
    beam = C.s('coated_pine', 0.6, tint='#6e5034')
    _plank_deck(M, wd, -0.5, 0.5, 1)
    for y in (-0.28, 0.28):
        obox(M, (0, y, -0.18), (1.0, 0.1, 0.12), 0, beam)
    obox(M, (0, 0, -0.16), (0.12, 0.5, 0.08), 0, beam)


def plat_wood_end_01(C):
    """나무 발판 끝 마디 0.5 × 0.8m — 판자 둘 + 각재 끝 + 끝 통나무 마구리(깊이 방향)·밧줄 감기."""
    M = C.M
    wd = C.s('brown_planks_03', 0.8, tint='#b58a5e')
    beam = C.s('coated_pine', 0.6, tint='#6e5034')
    rope = C.s('thatch_roof_angled', 0.3, tint='#b9a070')
    _plank_deck(M, wd, -0.25, 0.14, 2)
    for y in (-0.28, 0.28):
        obox(M, (-0.07, y, -0.18), (0.36, 0.1, 0.12), 0, beam)
    tube(M, (0.2, -0.43, -0.07), (0.2, 0.43, -0.07), 0.075, 0.075, beam, 0.6, 10)
    for y in (-0.33, 0.33):
        tube(M, (0.2, y - 0.03, -0.07), (0.2, y + 0.03, -0.07), 0.085, 0.085, rope, 0.3, 10)


def _stone_chunk(M, rock, x0, x1, taper_end):
    """윗판 아래 흙돌 덩어리 — 깊이·높이로 둥글게 좁아지는 얇은 층 아홉(계단이 안 보이게, taper_end 면 +x 끝도 안으로)."""
    n, z = 9, -0.12
    for i in range(n):
        t = (i + 1) / n
        d = 0.76 * math.sqrt(max(0.0, 1 - t * t)) + 0.1      # 깊이 — 아래로 갈수록 둥글게
        h = 0.06
        e = (0.3 * t * t) if taper_end else 0.0
        z -= h
        obox(M, ((x0 + x1 - e) / 2, 0.015 * ((i * 3) % 2), z), (x1 - e - x0, d, h + 0.004), 0, rock)


def plat_stone_mid_01(C):
    """돌 발판 가운데 마디 1.0 × 0.8m — 판석 윗판(두 장) + 풀 앞 가장자리 + 아래로 좁아지는 돌 덩어리."""
    M = C.M
    top = C.s('cobblestone_floor_01', 0.8)
    rock = C.s('japanese_stone_wall', 0.9, tint='#9a8f80')
    grass = C.s('aerial_grass_rock', 0.6, tint='#7fa25a')
    for k, x in enumerate((-0.25, 0.25)):
        obox(M, (x, 0, -0.12 - 0.005 * k), (0.49, 0.8, 0.12 - 0.005 * k), 0, top)
    obox(M, (0, -0.41, -0.06), (1.0, 0.05, 0.07), 0, grass)
    _stone_chunk(M, rock, -0.5, 0.5, False)


def plat_stone_end_01(C):
    """돌 발판 끝 마디 0.5 × 0.8m — 판석 한 장 + 둥근 모서리 돌 + 풀 + +x 로 좁아지는 덩어리."""
    M = C.M
    top = C.s('cobblestone_floor_01', 0.8)
    rock = C.s('japanese_stone_wall', 0.9, tint='#9a8f80')
    grass = C.s('aerial_grass_rock', 0.6, tint='#7fa25a')
    obox(M, (-0.06, 0, -0.12), (0.38, 0.8, 0.12), 0, top)
    tube(M, (0.18, -0.36, -0.07), (0.18, 0.36, -0.07), 0.07, 0.07, rock, 0.6, 10)
    obox(M, (-0.06, -0.41, -0.06), (0.38, 0.05, 0.07), 0, grass)
    _stone_chunk(M, rock, -0.25, 0.22, True)


def ladder_01(C):
    """사다리 마디 높이 1.0m · 폭 0.5m — 기둥 둘(통나무) + 디딤 셋(간격 0.33, 마디 이어도 같은 간격) + 밧줄 묶음."""
    M = C.M
    log = C.s('coated_pine', 0.6, tint='#8a6a48')
    rope = C.s('thatch_roof_angled', 0.3, tint='#b9a070')
    for sx in (-0.22, 0.22):
        tube(M, (sx, 0, 0), (sx, 0, 1.0), 0.035, 0.035, log, 0.6, 8)
    for z in (0.165, 0.5, 0.835):
        tube(M, (-0.25, 0, z), (0.25, 0, z), 0.024, 0.024, log, 0.6, 6)
        for sx in (-0.22, 0.22):
            tube(M, (sx, 0, z - 0.03), (sx, 0, z + 0.03), 0.042, 0.042, rope, 0.3, 8)

PROPS = {f.__name__: f for f in (
    plat_wood_mid_01, plat_wood_end_01, plat_stone_mid_01, plat_stone_end_01, ladder_01,
    pen_fence_01, pen_gate_01, well_01, street_lamp_01, signal_pylon_01, torch_stand_01, altar_01, iron_fence_01, wood_fence_01, mailbox_01,
    haystack_01, bamboo_clump_01, stele_01, stone_lantern_01, banner_pole_01, city_wall_segment_01, brazier_01,
    road_barrier_01, covered_car_01, old_tyre_01, generator_01, searchlight_01, power_box_01, security_camera_01, wicker_basket_01,
    wooden_bucket_01, pocket_compass_01)}


def build(pid, out, style):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    W._mat_cache.clear()
    W.set_style(style)
    del NODES[:]
    C = Ctx(pid)
    PROPS[pid](C)
    ob = C.M.build()
    objs = [ob]
    for name, pos, scale in NODES:                                       # K-0155 빈 노드(light_point …) — build_interior 와 같은 꼴
        e = bpy.data.objects.new(name, None)
        e.empty_display_type = 'CUBE' if scale else 'ARROWS'
        e.empty_display_size = 0.5 if scale else 0.2
        e.location = Vector(pos)
        if scale:
            e.scale = Vector(scale)
        bpy.context.scene.collection.objects.link(e)
        objs.append(e)
    bpy.context.view_layer.objects.active = ob
    tris = sum(len(p.vertices) - 2 for p in ob.data.polygons)
    pts = [Vector(c) for c in ob.bound_box]
    lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
    hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    os.makedirs(os.path.dirname(os.path.abspath(out)), exist_ok=True)
    W.export_glb(objs, out, int(os.environ.get('WF_TOON_PX', '256')) if style == 'toon' else 1024, 'JPEG' if style == 'toon' or os.environ.get('WF_JPEG') else 'AUTO')   # WF_JPEG=1 — 사실판도 JPEG(K-0128 고돗 방 킷, 알파 없는 결만)
    size = [round(hi[i] - lo[i], 2) for i in range(3)]
    lic = {'id': pid, 'generator': GENERATOR, 'blender': bpy.app.version_string, 'style': style,
           'license': 'CC0-1.0 (재질 전부 자체 PBR(K-0093·K-0113, 남의 사진 0), 형태는 전부 코드)',
           'inputs': sorted(f'self-pbr: {m}' for m in C.mats), 'size_m': size, 'tris': tris}
    if NODES:
        lic['nodes'] = [n[0] for n in NODES]
    if C.glows:
        lic['glow'] = {g: W.GLOW[g] for g in sorted(C.glows)}
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
