"""world-forge 자연 소품 — 나무·덤불·풀·꽃·바위·통나무·버섯·언덕·산을 코드로 만든다 (K-0052). 재질만 Poly Haven CC0 사진.

  blender -b --factory-startup -P tools/world-forge/build_nature.py -- --id tree_pine_01 --out <절대>/tree_pine_01.glb [--style toon]
  blender -b --factory-startup -P tools/world-forge/build_nature.py -- --all --out-dir <절대 폴더> [--style toon]
  blender -b --factory-startup -P tools/world-forge/build_nature.py -- --list

원점 = 바닥 가운데, 단위 미터, z 위. `data/set_plan.json` 의 `nature` 목록과 같은 id. 화면에 수백 개 서는 것이라 **삼각형 ≤ 1500**
(언덕·산 조각만 ≤ 2500). 같은 모양을 웹 2D(스프라이트)·웹 3D·Godot·Unity 가 쓴다. 시대 이름 없음 — 어느 판·시대에도 선다.
build_prop.py 의 도형 도우미(tube·obox)와 빌더를 그대로 쓴다(삼각형 예산·license.json 만 다르다).
"""
import math
import os
import random
import sys

import bpy  # noqa: F401
from mathutils import Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import build_prop as BP  # noqa: E402
from build_prop import tube, obox, A, arg  # noqa: E402

BP.TRIS_MAX = 1500
BP.GENERATOR = 'tools/world-forge/build_nature.py'
BIG = {'hill_01': 2500, 'mountain_01': 2500}


def blob(M, c, rx, ry, rz, slot, tile=1.0, lon=8, lat=4, jit=0.0, seed=1, flat_bottom=False, tint_cap=None):
    """찌그러진 공(닫힌 덩어리). lat 단 × lon 칸, jit = 반지름 흔들림 비율. flat_bottom = 아래를 z0 에 평평하게(바위·언덕)."""
    rnd = random.Random(seed)
    c = Vector(c)
    rows = []
    for j in range(lat + 1):
        th = math.pi * j / lat                           # 0 = 위
        row = []
        for k in range(lon):
            ph = 2 * math.pi * k / lon
            f = 1.0 + (rnd.uniform(-jit, jit) if 0 < j < lat else 0.0)
            x = math.sin(th) * math.cos(ph) * rx * f
            y = math.sin(th) * math.sin(ph) * ry * f
            z = math.cos(th) * rz * f
            if flat_bottom and z < 0:
                z = z * 0.18
            row.append(c + Vector((x, y, z)))
        rows.append(row)
    top, bot = rows[0][0], rows[-1][0]
    for j in range(lat):
        for k in range(lon):
            k2 = (k + 1) % lon
            a, b = rows[j][k], rows[j][k2]
            d, e = rows[j + 1][k], rows[j + 1][k2]
            uv = lambda p: ((p.x - c.x) / tile, (p.y - c.y) / tile)
            if j == 0:
                M.face([top, e, d], [uv(top), uv(e), uv(d)], slot)
            elif j == lat - 1:
                M.face([a, b, bot], [uv(a), uv(b), uv(bot)], slot)
            else:
                M.face([a, b, e, d], [uv(a), uv(b), uv(e), uv(d)], slot)


def blade(M, base, h, w, lean, yaw, slot):
    """풀잎 한 장 — 아래 넓고 끝이 뾰족한 삼각형, 앞뒤 두 면(양면)."""
    c, s = math.cos(yaw), math.sin(yaw)
    ex = Vector((c, s, 0))
    ey = Vector((-s, c, 0))
    b = Vector(base)
    l, r = b - ex * w / 2, b + ex * w / 2
    tip = b + ey * lean + Vector((0, 0, h))
    M.face([l, r, tip], [(0, 0), (1, 0), (0.5, 1)], slot)
    M.face([r, l, tip], [(1, 0), (0, 0), (0.5, 1)], slot)


def ring_leaf_colors(C):
    return C.s('white_stucco', 1.0, '#4a8f3a', sat=1.1), C.s('white_stucco', 1.0, '#63a846', sat=1.1), C.s('white_stucco', 1.0, '#3d7a33', sat=1.0)


# ---------------------------------------------------------------- 18개

def log_01(C):
    M = C.M
    bark = C.s('brown_planks_03', 1.0, '#5e432d')
    cut = C.s('coated_pine', 1.0, '#c89a62')
    tube(M, (-0.8, 0, 0.24), (0.8, 0, 0.24), 0.24, 0.23, bark, 1.0, 8, caps=False)
    for sx in (-1, 1):
        tube(M, (sx * 0.8, 0, 0.24), (sx * 0.805, 0, 0.24), 0.23, 0.23, cut, 1.0, 8, caps=True)
    tube(M, (0.15, 0.0, 0.46), (0.45, 0.2, 0.8), 0.04, 0.02, bark, 1.0, 4)       # 잔가지


def stump_01(C):
    M = C.M
    bark = C.s('brown_planks_03', 1.0, '#5e432d')
    cut = C.s('coated_pine', 1.0, '#c89a62')
    tube(M, (0, 0, 0), (0, 0, 0.12), 0.46, 0.34, bark, 1.0, 8, caps=False)           # 뿌리 퍼짐
    tube(M, (0, 0, 0.12), (0, 0, 0.5), 0.34, 0.31, bark, 1.0, 8, caps=False)
    tube(M, (0, 0, 0.5), (0, 0, 0.505), 0.31, 0.31, cut, 1.0, 8, caps=True)
    tube(M, (0.2, 0.15, 0.2), (0.55, 0.3, 0.1), 0.06, 0.02, bark, 1.0, 4)


# ---------------------------------------------------------------- 고품질판 (K-0058) — 잎 덩이 군집·높이별 색 층·갈라지는 가지·들쭉날쭉한 소나무 치마·면 나뉜 바위

def leaf_slots(C, tints, sat=1.1, tile=1.0):
    return [C.s('white_stucco', tile, t, sat=sat) for t in tints]


def clump_crown(M, center, rx, ry, rz, n, size, slots, seed, jit=0.25, lon=7, lat=3, bottom=0.5, tile=2.0):
    """잎 덩이 군집 — 타원체 겉면에 작은 덩이 n 개(바닥 쪽은 납작·크기 들쭉날쭉), 높이로 색 층을 고른다(아래 어둡고 위 밝게)."""
    rnd = random.Random(seed)
    cx, cy, cz = center
    golden = math.pi * (3 - math.sqrt(5))
    for i in range(n):
        t = (i + 0.5) / n
        zz = 1 - 2 * t
        r = math.sqrt(max(0.0, 1 - zz * zz))
        ph = golden * i + rnd.uniform(-0.2, 0.2)
        x, y = math.cos(ph) * r, math.sin(ph) * r
        if zz < 0:
            zz *= bottom
        k = rnd.uniform(0.72, 0.95)
        s = size * rnd.uniform(0.75, 1.25)
        h = (zz + 1) / 2
        slot = slots[min(len(slots) - 1, int(max(0.0, min(0.999, h + rnd.uniform(-0.12, 0.12))) * len(slots)))]
        blob(M, (cx + x * rx * k, cy + y * ry * k, cz + zz * rz * k), s, s * rnd.uniform(0.85, 1.05), s * 0.82, slot, tile, lon, lat, jit, seed + 7 * i)
    blob(M, center, rx * 0.62, ry * 0.62, rz * 0.6, slots[1 if len(slots) > 1 else 0], tile, 8, 3, 0.1, seed + 999)      # 안쪽 채움(빈 구멍 없게)


def fork(M, p0, p1, r0, r1, slot, n=6):
    tube(M, p0, p1, r0, r1, slot, 1.0, n)


def roots(M, slot, r, n=4, seed=3, z=0.5):
    rnd = random.Random(seed)
    for k in range(n):
        a = 2 * math.pi * k / n + rnd.uniform(-0.3, 0.3)
        tube(M, (math.cos(a) * r * 0.45, math.sin(a) * r * 0.45, z), (math.cos(a) * r * 1.9, math.sin(a) * r * 1.9, 0.0), r * 0.42, r * 0.12, slot, 1.0, 4)


def skirt(M, z, r, h, n, slot_a, slot_b, seed, droop=0.14):
    """소나무 치마 한 층 — 꼭대기에서 안쪽 고리를 거쳐 가장자리가 톱니(반지름·높이 번갈아)로 내려오는 닫힌 원뿔."""
    rnd = random.Random(seed)
    apex = Vector((0, 0, z + h))
    ring = lambda rr, k, zz: Vector((math.cos(2 * math.pi * k / n) * rr, math.sin(2 * math.pi * k / n) * rr, zz))
    zig = [(r * (1.0 if k % 2 == 0 else 0.76) * rnd.uniform(0.94, 1.06), z + (0 if k % 2 == 0 else droop * h)) for k in range(n)]
    for k in range(n):
        k2 = (k + 1) % n
        sl = slot_a if k % 2 == 0 else slot_b
        mid, mid2 = ring(r * 0.52, k, z + h * 0.5), ring(r * 0.52, k2, z + h * 0.5)
        o, o2 = ring(zig[k][0], k, zig[k][1]), ring(zig[k2][0], k2, zig[k2][1])
        M.face([mid, mid2, apex], [(0, 0), (1, 0), (0.5, 1)], sl)
        M.quad(o, o2, mid2, mid, sl, (0, 0), (1, 0), (1, 1), (0, 1))
        M.face([o2, o, Vector((0, 0, z + h * 0.08))], [(0, 0), (1, 0), (0.5, 1)], slot_b)


def pine_layers(M, z0, r0, h0, count, shrink, n, tints, seed):
    sa, sb = tints
    z, r, h = z0, r0, h0
    for i in range(count):
        skirt(M, z, r, h, n, sa, sb, seed + i)
        z += h * 0.58
        r *= shrink
        h *= 0.93


def tree_broadleaf_01(C):
    M = C.M
    bark = C.s('brown_planks_03', 1.0, '#6d4b33')
    slots = leaf_slots(C, ('#2f6a2e', '#43883a', '#5da745', '#86c75a'))
    tube(M, (0, 0, 0), (0.05, 0.02, 2.7), 0.32, 0.17, bark, 1.0, 8)
    roots(M, bark, 0.3, 5, 4)
    fork(M, (0.05, 0.02, 1.8), (1.0, 0.25, 3.3), 0.11, 0.05, bark)
    fork(M, (0.05, 0.02, 1.9), (-0.9, -0.3, 3.2), 0.11, 0.05, bark)
    fork(M, (0.05, 0.02, 2.4), (0.1, -0.7, 3.9), 0.09, 0.04, bark)
    clump_crown(M, (0.0, 0.0, 4.4), 2.0, 1.9, 1.7, 30, 0.78, slots, 11)


def tree_broadleaf_02(C):
    """둥글고 낮은 활엽수 — 줄기가 굵고 잎이 넓게 퍼진다."""
    M = C.M
    bark = C.s('brown_planks_03', 1.0, '#58402c')
    slots = leaf_slots(C, ('#356b33', '#4a8d3b', '#68ac48', '#92cc5e'))
    tube(M, (0, 0, 0), (-0.05, 0.0, 2.0), 0.44, 0.23, bark, 1.0, 8)
    roots(M, bark, 0.44, 6, 5)
    fork(M, (0, 0, 1.5), (1.4, 0.2, 2.7), 0.16, 0.07, bark)
    fork(M, (0, 0, 1.6), (-1.3, 0.3, 2.6), 0.16, 0.07, bark)
    fork(M, (0, 0, 1.8), (0.1, -1.0, 2.8), 0.13, 0.06, bark)
    clump_crown(M, (0.0, 0.0, 3.5), 2.8, 2.5, 1.5, 36, 0.86, slots, 21)


def tree_broadleaf_03(C):
    """키 큰 갸름한 활엽수(노란 기가 도는 연두) — K-0058 변형."""
    M = C.M
    bark = C.s('brown_planks_03', 1.0, '#70563a')
    slots = leaf_slots(C, ('#4f7a2a', '#6b9a33', '#8ab83e', '#b0d14f'))
    tube(M, (0, 0, 0), (0.0, 0.05, 3.4), 0.26, 0.13, bark, 1.0, 7)
    roots(M, bark, 0.26, 4, 6)
    fork(M, (0, 0.05, 2.6), (0.7, 0.2, 4.0), 0.09, 0.04, bark)
    fork(M, (0, 0.05, 2.9), (-0.7, -0.1, 4.3), 0.09, 0.04, bark)
    clump_crown(M, (0.0, 0.0, 5.3), 1.45, 1.4, 2.3, 30, 0.66, slots, 61)


def tree_pine_01(C, snow=False):
    M = C.M
    bark = C.s('brown_planks_03', 1.0, '#5a3f2b')
    if snow:
        sa = C.s('snow_02', 1.0, '#f2f6fa')
        sb = C.s('snow_02', 1.0, '#d6e2ee')
    else:
        sa = C.s('white_stucco', 1.0, '#2b6238', sat=1.0)
        sb = C.s('white_stucco', 1.0, '#3f7e4b', sat=1.0)
    tube(M, (0, 0, 0), (0, 0, 2.5), 0.25, 0.1, bark, 1.0, 7)
    roots(M, bark, 0.25, 4, 7, z=0.4)
    pine_layers(M, 0.9, 1.7, 1.9, 8, 0.84, 14, (sa, sb), 5)


def tree_pine_01_snow(C):
    tree_pine_01(C, snow=True)


def tree_pine_02(C):
    """키 큰 소나무 — 가늘고 층이 많다."""
    M = C.M
    bark = C.s('brown_planks_03', 1.0, '#5a3f2b')
    sa = C.s('white_stucco', 1.0, '#2a5e36', sat=1.0)
    sb = C.s('white_stucco', 1.0, '#3a7646', sat=1.0)
    tube(M, (0, 0, 0), (0.1, 0, 5.2), 0.2, 0.08, bark, 1.0, 6)
    roots(M, bark, 0.2, 4, 8, z=0.35)
    pine_layers(M, 1.5, 1.15, 1.35, 11, 0.9, 12, (sa, sb), 15)


def tree_pine_03(C):
    """넓고 짙은 가문비형 — 층이 적고 크게 늘어진다(K-0058 변형)."""
    M = C.M
    bark = C.s('brown_planks_03', 1.0, '#4e3626')
    sa = C.s('white_stucco', 1.0, '#244f31', sat=1.0)
    sb = C.s('white_stucco', 1.0, '#33663f', sat=1.0)
    tube(M, (0, 0, 0), (0, 0, 1.8), 0.3, 0.14, bark, 1.0, 7)
    roots(M, bark, 0.3, 5, 9, z=0.4)
    pine_layers(M, 0.6, 2.3, 2.3, 6, 0.74, 16, (sa, sb), 25)


def _grow(M, slot, p, d, ln, r, depth, rnd):
    q = p + d * ln
    tube(M, p, q, r, r * 0.55, slot, 1.0, 5 if depth > 1 else 4)
    if depth <= 0:
        return
    for _ in range(2):
        a = rnd.uniform(-0.9, 0.9)
        b = rnd.uniform(0.35, 0.85)
        nd = Vector((d.x + math.sin(a) * b, d.y + math.cos(a) * b * rnd.uniform(-1, 1), d.z * 0.8 + rnd.uniform(0.0, 0.4))).normalized()
        _grow(M, slot, q, nd, ln * rnd.uniform(0.62, 0.8), r * 0.55, depth - 1, rnd)


def tree_dead_01(C):
    M = C.M
    bark = C.s('brown_planks_03', 0.8, '#b0a08c', gain=1.15)                     # 바랜 회갈색(10-06 — 검정 칠 판자는 거의 검게 보였다)
    rnd = random.Random(5)
    tube(M, (0, 0, 0), (0.1, 0, 1.6), 0.3, 0.18, bark, 1.0, 7)
    roots(M, bark, 0.3, 5, 9, z=0.5)
    for k in range(4):
        a = 2 * math.pi * k / 4 + 0.4
        d = Vector((math.cos(a) * 0.55, math.sin(a) * 0.55, 0.85)).normalized()
        _grow(M, bark, Vector((0.08, 0, 1.4 + 0.45 * k)), d, 1.5 - 0.1 * k, 0.12, 3, rnd)
    _grow(M, bark, Vector((0.1, 0, 1.6)), Vector((0.05, 0.02, 1.0)), 1.9, 0.17, 2, rnd)


def tree_birch_01(C):
    M = C.M
    bark = C.s('white_stucco', 1.0, '#e8e4da')
    mark = C.s('white_stucco', 1.0, '#2e2a26')
    slots = leaf_slots(C, ('#6aa23c', '#86bd4a', '#a3d05a', '#c2de78'))
    tube(M, (0, 0, 0), (0.1, 0.05, 4.4), 0.15, 0.07, bark, 1.0, 7)
    for z in (0.5, 0.95, 1.5, 2.1, 2.7, 3.3, 3.9):
        rr = 0.155 - z * 0.017
        tube(M, (0.023 * z, 0.011 * z, z), (0.023 * z, 0.011 * z, z + 0.07), rr, rr, mark, 1.0, 7, caps=False)
    fork(M, (0.08, 0.04, 3.4), (0.8, 0.2, 4.4), 0.05, 0.025, bark, 5)
    fork(M, (0.08, 0.04, 3.0), (-0.7, -0.2, 4.0), 0.05, 0.025, bark, 5)
    clump_crown(M, (0.1, 0.05, 5.0), 1.25, 1.2, 1.45, 24, 0.5, slots, 41)


def bush_01(C):
    M = C.M
    slots = leaf_slots(C, ('#2f6a2e', '#43883a', '#5da745', '#80c25a'))
    clump_crown(M, (0, 0, 0.5), 1.0, 0.9, 0.62, 16, 0.36, slots, 51, bottom=0.25, tile=1.0)


def bush_02(C):
    """꽃 핀 덤불 — K-0058 변형."""
    M = C.M
    slots = leaf_slots(C, ('#2c6430', '#3f8239', '#58a044', '#7bbc58'))
    clump_crown(M, (0, 0, 0.45), 0.9, 0.85, 0.55, 14, 0.33, slots, 55, bottom=0.25, tile=1.0)
    rnd = random.Random(56)
    pet = [C.s('white_stucco', 1.0, c, sat=1.3) for c in ('#e8588c', '#f5f0e6', '#f0d23c')]
    for k in range(10):
        a = rnd.uniform(0, 2 * math.pi)
        rr = rnd.uniform(0.15, 0.75)
        blob(M, (math.cos(a) * rr, math.sin(a) * rr * 0.9, 0.45 + 0.55 * math.sqrt(max(0.0, 1 - (rr / 0.95) ** 2)) + 0.03), 0.07, 0.07, 0.05, pet[k % 3], 1.0, 6, 2, 0.0, 570 + k)


def blade2(M, base, h, w, lean, yaw, slot):
    """두 마디 풀잎 — 아래 사다리꼴 + 끝 삼각형(휘어짐), 앞뒤 두 면."""
    c, s = math.cos(yaw), math.sin(yaw)
    ex, ey = Vector((c, s, 0)), Vector((-s, c, 0))
    b = Vector(base)
    m = b + ey * lean * 0.35 + Vector((0, 0, h * 0.55))
    tip = b + ey * lean + Vector((0, 0, h))
    l0, r0 = b - ex * w / 2, b + ex * w / 2
    l1, r1 = m - ex * w * 0.3, m + ex * w * 0.3
    M.quad(l0, r0, r1, l1, slot, (0, 0), (1, 0), (1, 0.5), (0, 0.5))
    M.face([l1, r1, tip], [(0, 0.5), (1, 0.5), (0.5, 1)], slot)
    M.quad(r0, l0, l1, r1, slot, (1, 0), (0, 0), (0, 0.5), (1, 0.5))
    M.face([r1, l1, tip], [(1, 0.5), (0, 0.5), (0.5, 1)], slot)


def grass_tuft_01(C):
    M = C.M
    g = [C.s('white_stucco', 1.0, t, sat=1.1) for t in ('#4f8f33', '#6aab3e', '#83bd4a')]
    rnd = random.Random(61)
    for k in range(20):
        a = 2 * math.pi * k / 20 + rnd.uniform(-0.2, 0.2)
        r = rnd.uniform(0.02, 0.14)
        blade2(M, (math.cos(a) * r, math.sin(a) * r, 0), rnd.uniform(0.4, 0.8), 0.1, rnd.uniform(0.1, 0.3), a + 1.5708, g[k % 3])


def grass_tuft_02(C):
    """키 크고 가는 풀 — 끝에 이삭이 달린다(K-0058 변형)."""
    M = C.M
    g = [C.s('white_stucco', 1.0, t, sat=1.1) for t in ('#6b9a3a', '#8bb446', '#a8c75a')]
    seed = C.s('white_stucco', 1.0, '#c7a54a', sat=1.2)
    rnd = random.Random(62)
    for k in range(16):
        a = 2 * math.pi * k / 16 + rnd.uniform(-0.2, 0.2)
        r = rnd.uniform(0.02, 0.1)
        blade2(M, (math.cos(a) * r, math.sin(a) * r, 0), rnd.uniform(0.7, 1.1), 0.07, rnd.uniform(0.1, 0.35), a + 1.5708, g[k % 3])
    for k in range(4):
        a = 2 * math.pi * k / 4 + 0.5
        x, y = math.cos(a) * 0.09, math.sin(a) * 0.09
        tube(M, (x, y, 0), (x + 0.05, y, 0.9), 0.01, 0.008, g[0], 0.5, 4, caps=False)
        tube(M, (x + 0.05, y, 0.78), (x + 0.06, y, 1.0), 0.03, 0.0, seed, 0.5, 5)


def flower_patch_01(C):
    M = C.M
    stem = C.s('white_stucco', 1.0, '#5a9a3a')
    pet = [C.s('white_stucco', 1.0, c, sat=1.3) for c in ('#f0d23c', '#e8588c', '#f5f0e6', '#9a6ad8')]
    cen = C.s('white_stucco', 1.0, '#e0a020')
    rnd = random.Random(71)
    for k in range(9):
        a = 2 * math.pi * k / 9 + rnd.uniform(-0.3, 0.3)
        r = rnd.uniform(0.06, 0.34)
        x, y = math.cos(a) * r, math.sin(a) * r
        h = rnd.uniform(0.3, 0.55)
        tube(M, (x, y, 0), (x + 0.02, y, h), 0.012, 0.01, stem, 1.0, 4, caps=False)
        for j in range(4):
            b = 2 * math.pi * j / 4 + rnd.uniform(0, 1)
            blob(M, (x + math.cos(b) * 0.06, y + math.sin(b) * 0.06, h + 0.03), 0.05, 0.05, 0.035, pet[k % 4], 1.0, 5, 2, 0.0, 70 + k * 4 + j)
        blob(M, (x, y, h + 0.045), 0.03, 0.03, 0.025, cen, 1.0, 5, 2, 0.0, 700 + k)
    g = C.s('white_stucco', 1.0, '#4f8f33', sat=1.1)
    for k in range(6):
        a = 2 * math.pi * k / 6
        blade2(M, (math.cos(a) * 0.08, math.sin(a) * 0.08, 0), 0.32, 0.09, 0.12, a + 1.5, g)


def rock(M, c, rx, ry, rz, slots, lon, lat, jit, seed, tile=1.5, flat_bottom=True):
    """면 나뉜 바위 — 위 칸은 밝게·옆은 중간·아래는 어둡게, 반지름 흔들림이 커서 각이 진다."""
    rnd = random.Random(seed)
    c = Vector(c)
    rows = []
    for j in range(lat + 1):
        th = math.pi * j / lat
        row = []
        for k in range(lon):
            ph = 2 * math.pi * k / lon
            f = 1.0 + (rnd.uniform(-jit, jit) if 0 < j < lat else 0.0)
            x, y, z = math.sin(th) * math.cos(ph) * rx * f, math.sin(th) * math.sin(ph) * ry * f, math.cos(th) * rz * f
            if flat_bottom and z < 0:
                z *= 0.16
            row.append(c + Vector((x, y, z)))
        rows.append(row)
    top, bot = rows[0][0], rows[-1][0]
    for j in range(lat):
        sl = slots[0] if j < lat * 0.34 else (slots[1] if j < lat * 0.72 else slots[2])
        for k in range(lon):
            k2 = (k + 1) % lon
            a, b, d, e = rows[j][k], rows[j][k2], rows[j + 1][k], rows[j + 1][k2]
            uv = lambda p: ((p.x - c.x) / tile, (p.z - c.z) / tile)
            if j == 0:
                M.face([top, e, d], [uv(top), uv(e), uv(d)], sl)
            elif j == lat - 1:
                M.face([a, b, bot], [uv(a), uv(b), uv(bot)], sl)
            else:
                M.face([a, b, e, d], [uv(a), uv(b), uv(e), uv(d)], sl)


def rock_tints(C, tile=1.5, tints=('#aeaba5', '#97948e', '#76736e')):
    return [C.s('concrete_wall_001', tile, t, gain=1.25) for t in tints]


def rock_small_01(C):
    M = C.M
    sl = rock_tints(C, 1.0, ('#b3b0aa', '#9c9993', '#7c7974'))
    rock(M, (0, 0, 0.0), 0.5, 0.42, 0.44, sl, 9, 5, 0.26, 81)
    rock(M, (0.5, 0.22, 0.0), 0.24, 0.21, 0.22, sl, 7, 4, 0.26, 82)
    rock(M, (-0.35, -0.3, 0.0), 0.2, 0.18, 0.16, sl, 6, 3, 0.26, 83)


def rock_large_01(C):
    M = C.M
    sl = rock_tints(C)
    rock(M, (0, 0, 0.0), 1.55, 1.25, 1.4, sl, 12, 7, 0.28, 91)
    rock(M, (1.4, 0.55, 0.0), 0.75, 0.62, 0.65, sl, 8, 4, 0.26, 92)
    rock(M, (-1.2, -0.75, 0.0), 0.65, 0.58, 0.55, sl, 8, 4, 0.26, 93)
    rock(M, (0.3, -1.3, 0.0), 0.45, 0.4, 0.35, sl, 7, 3, 0.26, 94)
    rock(M, (-0.9, 0.95, 0.0), 0.38, 0.34, 0.3, sl, 6, 3, 0.26, 95)


def rock_large_02(C):
    """세로로 긴 바위기둥 — K-0058 변형."""
    M = C.M
    sl = rock_tints(C, 1.5, ('#b2aea6', '#98948c', '#716e69'))
    rock(M, (0, 0, 0.0), 0.95, 0.75, 2.0, sl, 11, 7, 0.24, 96)
    rock(M, (0.7, 0.35, 0.0), 0.55, 0.5, 0.9, sl, 8, 4, 0.26, 97)
    rock(M, (-0.75, -0.3, 0.0), 0.5, 0.45, 0.65, sl, 8, 4, 0.26, 98)
    rock(M, (0.1, 0.85, 0.0), 0.35, 0.3, 0.3, sl, 6, 3, 0.26, 99)


def rock_moss_01(C):
    M = C.M
    sl = rock_tints(C, 1.2)
    mo = leaf_slots(C, ('#58853a', '#6f9e45', '#88b857'))
    rock(M, (0, 0, 0.0), 1.0, 0.9, 0.8, sl, 11, 6, 0.26, 101)
    rock(M, (0.8, 0.45, 0.0), 0.42, 0.37, 0.32, sl, 7, 3, 0.26, 103)
    rnd = random.Random(104)
    for k in range(7):
        a = rnd.uniform(0, 2 * math.pi)
        rr = rnd.uniform(0.0, 0.55)
        blob(M, (math.cos(a) * rr, math.sin(a) * rr * 0.9, 0.62 + rnd.uniform(-0.05, 0.1) - rr * 0.35), rnd.uniform(0.22, 0.34), rnd.uniform(0.2, 0.3), 0.14, mo[k % 3], 1.0, 7, 3, 0.2, 105 + k)


def pebbles_01(C):
    M = C.M
    cols = ['#aaa7a2', '#b3ada3', '#999690', '#bcb6aa']
    rnd = random.Random(111)
    for k in range(10):
        a = 2 * math.pi * k / 10 + rnd.uniform(-0.3, 0.3)
        r = rnd.uniform(0.08, 0.4)
        s = C.s('concrete_wall_001', 1.0, cols[k % 4], gain=1.25)
        sz = rnd.uniform(0.07, 0.15)
        blob(M, (math.cos(a) * r, math.sin(a) * r, 0), sz, sz * 0.85, sz * 0.6, s, 1.0, 7, 3, 0.22, 110 + k, flat_bottom=True)


def mushroom_01(C):
    M = C.M
    stalk = C.s('white_stucco', 1.0, '#efe6d2')
    cap1 = C.s('white_stucco', 1.0, '#c4452f', sat=1.2)
    cap2 = C.s('white_stucco', 1.0, '#d98a3a', sat=1.2)
    dots = C.s('white_stucco', 1.0, '#faf4e6')
    for (x, y, h, r, cs) in ((0, 0, 0.36, 0.22, cap1), (0.3, 0.12, 0.22, 0.13, cap2), (-0.24, 0.2, 0.17, 0.1, cap2), (0.18, -0.26, 0.26, 0.15, cap1), (-0.3, -0.18, 0.12, 0.08, cap2)):
        tube(M, (x, y, 0), (x + 0.015, y, h), r * 0.32, r * 0.26, stalk, 1.0, 8)
        blob(M, (x, y, h), r, r, r * 0.62, cs, 1.0, 10, 4, 0.0, 120, flat_bottom=True)
        if cs is cap1:
            for k in range(5):
                a = 2 * math.pi * k / 5
                blob(M, (x + math.cos(a) * r * 0.5, y + math.sin(a) * r * 0.5, h + r * 0.42), r * 0.14, r * 0.14, r * 0.06, dots, 1.0, 5, 2, 0.0, 121 + k)


def hill_01(C):
    M = C.M
    g = leaf_slots(C, ('#6aa042', '#7db352', '#93c561'), tile=4.0)
    rk = rock_tints(C, 3.0, ('#a8a59f', '#8e8b86', '#74716c'))
    blob(M, (0, 0, 0.0), 5.6, 4.9, 2.7, g[1], 4.0, 18, 7, 0.1, 131, flat_bottom=True)
    blob(M, (3.4, 1.2, 0.0), 2.7, 2.5, 1.4, g[2], 4.0, 12, 5, 0.12, 132, flat_bottom=True)
    blob(M, (-3.1, -1.6, 0.0), 2.4, 2.2, 1.2, g[0], 4.0, 12, 5, 0.12, 133, flat_bottom=True)
    rnd = random.Random(134)
    for k in range(6):
        a = rnd.uniform(0, 2 * math.pi)
        rr = rnd.uniform(1.2, 4.0)
        blob(M, (math.cos(a) * rr, math.sin(a) * rr * 0.85, 1.5 - rr * 0.2), rnd.uniform(0.6, 0.9), rnd.uniform(0.55, 0.8), 0.4, g[k % 3], 2.0, 7, 3, 0.2, 140 + k)
    rock(M, (2.0, -2.0, 0.55), 0.55, 0.5, 0.4, rk, 7, 4, 0.26, 150)
    rock(M, (-1.2, 2.4, 0.5), 0.45, 0.4, 0.35, rk, 7, 4, 0.26, 151)


def mountain_01(C):
    M = C.M
    rk = rock_tints(C, 6.0, ('#aaa59c', '#8f8a82', '#6c6862'))
    sn = C.s('snow_02', 3.0, '#f1f5f9')
    sn2 = C.s('snow_02', 3.0, '#dce6ef')
    levels = [(0.0, 7.2), (1.6, 6.5), (3.2, 5.6), (4.8, 4.6), (6.4, 3.6), (8.0, 2.7), (9.4, 1.8), (10.7, 0.9)]
    rnd = random.Random(141)
    lon = 16
    ridge = [rnd.uniform(-0.18, 0.18) for _ in range(lon)]
    rows = []
    for zi, (z, r) in enumerate(levels):
        row = []
        for k in range(lon):
            ph = 2 * math.pi * k / lon
            f = 1 + ridge[k] * (1 - zi / 9) + 0.12 * math.sin(3 * ph + zi) + rnd.uniform(-0.07, 0.07)
            row.append(Vector((math.cos(ph) * r * f, math.sin(ph) * r * 0.82 * f, z + rnd.uniform(-0.12, 0.12) * (zi > 0))))
        rows.append(row)
    peak = Vector((0.3, 0.1, 11.8))
    for j in range(len(rows) - 1):
        for k in range(lon):
            k2 = (k + 1) % lon
            a, b, d, e = rows[j][k], rows[j][k2], rows[j + 1][k], rows[j + 1][k2]
            slot = (sn if (k % 2) else sn2) if j >= 5 else (rk[0] if j >= 3 else (rk[1] if j >= 1 else rk[2]))
            if k % 3 == 0 and j < 5:
                slot = rk[(j + 1) % 3]
            M.face([a, b, e, d], [(a.x / 6, a.z / 6), (b.x / 6, b.z / 6), (e.x / 6, e.z / 6), (d.x / 6, d.z / 6)], slot)
    top = rows[-1]
    for k in range(lon):
        k2 = (k + 1) % lon
        M.face([top[k], top[k2], peak], [(0, 0), (1, 0), (0.5, 1)], sn)
    M.face(list(reversed(rows[0])), [(p.x / 6, p.y / 6) for p in reversed(rows[0])], rk[2])
    for ox, oy, s_ in ((4.2, 2.0, 1.5), (-3.8, -2.2, 1.2), (1.5, -4.0, 1.0)):
        rock(M, (ox, oy, 0.6), s_, s_ * 0.85, s_ * 0.8, rk, 8, 4, 0.28, int(ox * 10))


NATURE = {f.__name__: f for f in (
    tree_broadleaf_01, tree_broadleaf_02, tree_broadleaf_03, tree_pine_01, tree_pine_01_snow, tree_pine_02, tree_pine_03, tree_dead_01, tree_birch_01,
    bush_01, bush_02, grass_tuft_01, grass_tuft_02, flower_patch_01, rock_small_01, rock_large_01, rock_large_02, rock_moss_01, pebbles_01, log_01,
    stump_01, mushroom_01, hill_01, mountain_01)}

if __name__ == '__main__':
    BP.PROPS.clear()
    BP.PROPS.update(NATURE)
    style = arg('--style', 'real')
    if '--list' in A:
        print('NATURE', ' '.join(NATURE))
    elif '--all' in A:
        d = arg('--out-dir')
        for pid in NATURE:
            BP.TRIS_MAX = BIG.get(pid, 1500)
            BP.build(pid, os.path.join(d, pid + '.glb'), style)
    else:
        pid = arg('--id')
        BP.TRIS_MAX = BIG.get(pid, 1500)
        BP.build(pid, arg('--out'), style)
