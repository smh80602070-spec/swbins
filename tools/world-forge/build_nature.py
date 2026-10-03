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

def tree_broadleaf_01(C, seed=11, scale=1.0, hue=0):
    M = C.M
    bark = C.s('brown_planks_03', 1.0, '#6d4b33')
    l1, l2, l3 = ring_leaf_colors(C)
    tube(M, (0, 0, 0), (0.05, 0.02, 2.6 * scale), 0.3 * scale, 0.16 * scale, bark, 1.0, 7)
    tube(M, (0.05, 0.02, 1.8 * scale), (0.9 * scale, 0.2, 3.1 * scale), 0.1 * scale, 0.05 * scale, bark, 1.0, 5)
    tube(M, (0.05, 0.02, 1.9 * scale), (-0.8 * scale, -0.3, 3.0 * scale), 0.1 * scale, 0.05 * scale, bark, 1.0, 5)
    blob(M, (0.0, 0.0, 4.2 * scale), 1.9 * scale, 1.8 * scale, 1.5 * scale, l1, 2.0, 8, 4, 0.12, seed)
    blob(M, (1.0 * scale, 0.3, 3.5 * scale), 1.2 * scale, 1.2 * scale, 1.0 * scale, l2, 2.0, 7, 3, 0.12, seed + 1)
    blob(M, (-1.0 * scale, -0.4, 3.4 * scale), 1.2 * scale, 1.1 * scale, 1.0 * scale, l3, 2.0, 7, 3, 0.12, seed + 2)
    blob(M, (0.1, -0.5, 5.2 * scale), 1.0 * scale, 1.0 * scale, 0.8 * scale, l2, 2.0, 7, 3, 0.1, seed + 3)


def tree_broadleaf_02(C):
    """둥글고 낮은 활엽수 — 줄기가 굵고 잎이 넓게 퍼진다(01 과 모양이 다르다)."""
    M = C.M
    bark = C.s('brown_planks_03', 1.0, '#58402c')
    l1, l2, l3 = ring_leaf_colors(C)
    tube(M, (0, 0, 0), (-0.05, 0.0, 2.0), 0.42, 0.22, bark, 1.0, 7)
    tube(M, (0, 0, 1.5), (1.3, 0.2, 2.6), 0.14, 0.07, bark, 1.0, 5)
    tube(M, (0, 0, 1.6), (-1.2, 0.3, 2.5), 0.14, 0.07, bark, 1.0, 5)
    blob(M, (0.0, 0.0, 3.4), 2.5, 2.3, 1.4, l2, 2.0, 9, 4, 0.1, 21)
    blob(M, (1.5, 0.3, 2.9), 1.3, 1.2, 0.9, l1, 2.0, 7, 3, 0.12, 22)
    blob(M, (-1.5, 0.3, 2.9), 1.3, 1.2, 0.9, l3, 2.0, 7, 3, 0.12, 23)


def tree_pine_01(C, snow=False):
    M = C.M
    bark = C.s('brown_planks_03', 1.0, '#5a3f2b')
    if snow:
        l1 = C.s('snow_02', 1.0, '#eef3f8')
        l2 = C.s('snow_02', 1.0, '#dfe8f0')
    else:
        l1 = C.s('white_stucco', 1.0, '#2f6b3d', sat=1.0)
        l2 = C.s('white_stucco', 1.0, '#3d7c47', sat=1.0)
    tube(M, (0, 0, 0), (0, 0, 2.2), 0.24, 0.12, bark, 1.0, 6)
    layers = [(1.0, 1.6, 2.3), (1.9, 1.35, 2.0), (2.8, 1.1, 1.8), (3.6, 0.85, 1.6), (4.4, 0.6, 1.5)]
    for i, (z, r, h) in enumerate(layers):
        tube(M, (0, 0, z), (0, 0, z + h), r, 0.0, l1 if i % 2 == 0 else l2, 1.0, 8)
    # 스커트(아래 윗면)는 tube 의 caps 가 닫는다


def tree_pine_01_snow(C):
    tree_pine_01(C, snow=True)


def tree_pine_02(C):
    """키 큰 소나무 — 둥근 뾰족 잎 구름 두 층."""
    M = C.M
    bark = C.s('brown_planks_03', 1.0, '#5a3f2b')
    l1 = C.s('white_stucco', 1.0, '#2c6238', sat=1.0)
    l2 = C.s('white_stucco', 1.0, '#3a7344', sat=1.0)
    tube(M, (0, 0, 0), (0.15, 0, 4.6), 0.2, 0.1, bark, 1.0, 6)
    blob(M, (0.1, 0, 5.2), 1.3, 1.3, 0.8, l1, 2.0, 8, 3, 0.1, 31)
    blob(M, (0.6, 0.3, 4.2), 1.0, 0.9, 0.55, l2, 2.0, 7, 3, 0.1, 32)
    blob(M, (-0.6, -0.2, 3.9), 1.0, 0.9, 0.5, l2, 2.0, 7, 3, 0.1, 33)
    tube(M, (0.15, 0, 3.0), (1.0, 0.1, 3.7), 0.05, 0.03, bark, 1.0, 4)


def tree_dead_01(C):
    M = C.M
    bark = C.s('black_painted_planks', 1.0, '#6e6358')
    tube(M, (0, 0, 0), (0.1, 0, 3.4), 0.26, 0.09, bark, 1.0, 6)
    for z, x, y, up in ((1.4, 1.5, 0.3, 2.3), (2.0, -1.4, -0.2, 2.9), (2.7, 0.9, -0.9, 3.6), (3.0, -0.7, 0.9, 4.0)):
        tube(M, (0.05, 0, z), (x, y, up), 0.08, 0.025, bark, 1.0, 4)
        tube(M, (x, y, up), (x * 1.3, y * 1.3, up + 0.6), 0.025, 0.0, bark, 1.0, 4)
    tube(M, (0.1, 0, 3.4), (0.15, 0.05, 4.4), 0.09, 0.0, bark, 1.0, 5)


def tree_birch_01(C):
    M = C.M
    bark = C.s('white_stucco', 1.0, '#e8e4da')
    mark = C.s('white_stucco', 1.0, '#2e2a26')
    leaf = C.s('white_stucco', 1.0, '#8fc055', sat=1.1)
    leaf2 = C.s('white_stucco', 1.0, '#a8cc62', sat=1.1)
    tube(M, (0, 0, 0), (0.1, 0.05, 4.3), 0.14, 0.07, bark, 1.0, 6)
    for z in (0.7, 1.4, 2.2, 3.0):                                    # 껍질 가로 무늬
        tube(M, (0.02 * z, 0.01 * z, z), (0.02 * z, 0.01 * z, z + 0.08), 0.15 - z * 0.014, 0.15 - z * 0.014, mark, 1.0, 6, caps=False)
    blob(M, (0.15, 0.05, 4.7), 1.05, 1.0, 1.0, leaf, 2.0, 8, 4, 0.14, 41)
    blob(M, (-0.55, 0.2, 3.7), 0.7, 0.7, 0.6, leaf2, 2.0, 7, 3, 0.14, 42)
    blob(M, (0.7, -0.2, 3.5), 0.7, 0.7, 0.6, leaf2, 2.0, 7, 3, 0.14, 43)


def bush_01(C):
    M = C.M
    l1, l2, l3 = ring_leaf_colors(C)
    blob(M, (0, 0, 0.45), 0.8, 0.75, 0.55, l1, 1.0, 8, 4, 0.14, 51, flat_bottom=True)
    blob(M, (0.55, 0.25, 0.38), 0.5, 0.45, 0.4, l2, 1.0, 7, 3, 0.14, 52, flat_bottom=True)
    blob(M, (-0.5, -0.2, 0.35), 0.48, 0.45, 0.38, l3, 1.0, 7, 3, 0.14, 53, flat_bottom=True)


def grass_tuft_01(C):
    M = C.M
    g1 = C.s('white_stucco', 1.0, '#6aab3e', sat=1.1)
    g2 = C.s('white_stucco', 1.0, '#83bd4a', sat=1.1)
    rnd = random.Random(61)
    for k in range(11):
        a = 2 * math.pi * k / 11 + rnd.uniform(-0.2, 0.2)
        r = rnd.uniform(0.02, 0.12)
        blade(M, (math.cos(a) * r, math.sin(a) * r, 0), rnd.uniform(0.35, 0.7), 0.1, rnd.uniform(0.08, 0.22), a + 1.5708, g1 if k % 2 else g2)


def flower_patch_01(C):
    M = C.M
    stem = C.s('white_stucco', 1.0, '#5a9a3a')
    pet = [C.s('white_stucco', 1.0, c, sat=1.3) for c in ('#f0d23c', '#e8588c', '#f5f0e6', '#9a6ad8')]
    rnd = random.Random(71)
    for k in range(8):
        a = 2 * math.pi * k / 8 + rnd.uniform(-0.3, 0.3)
        r = rnd.uniform(0.06, 0.32)
        x, y = math.cos(a) * r, math.sin(a) * r
        h = rnd.uniform(0.3, 0.5)
        tube(M, (x, y, 0), (x, y, h), 0.012, 0.01, stem, 1.0, 4)
        blob(M, (x, y, h + 0.03), 0.07, 0.07, 0.045, pet[k % 4], 1.0, 6, 2, 0.0, 70 + k)
    blade(M, (0, 0, 0), 0.3, 0.1, 0.05, 0.3, stem)
    blade(M, (0.1, 0.05, 0), 0.26, 0.1, -0.05, 2.0, stem)


def rock_small_01(C):
    M = C.M
    r = C.s('concrete_wall_001', 1.0, '#a6a39e', gain=1.25)
    blob(M, (0, 0, 0.0), 0.45, 0.38, 0.4, r, 1.0, 7, 4, 0.2, 81, flat_bottom=True)
    blob(M, (0.45, 0.2, 0.0), 0.22, 0.2, 0.2, r, 1.0, 6, 3, 0.2, 82, flat_bottom=True)


def rock_large_01(C):
    M = C.M
    r = C.s('concrete_wall_001', 1.5, '#9c9993', gain=1.25)
    d = C.s('concrete_wall_001', 1.5, '#8a8782', gain=1.25)
    blob(M, (0, 0, 0.0), 1.5, 1.2, 1.3, r, 2.0, 9, 5, 0.2, 91, flat_bottom=True)
    blob(M, (1.3, 0.5, 0.0), 0.7, 0.6, 0.6, d, 1.5, 7, 3, 0.2, 92, flat_bottom=True)
    blob(M, (-1.1, -0.7, 0.0), 0.6, 0.55, 0.5, d, 1.5, 7, 3, 0.2, 93, flat_bottom=True)


def rock_moss_01(C):
    M = C.M
    r = C.s('concrete_wall_001', 1.2, '#a6a39e', gain=1.25)
    mo = C.s('white_stucco', 1.0, '#6f9e45', sat=1.1)
    blob(M, (0, 0, 0.0), 0.95, 0.85, 0.75, r, 1.5, 9, 4, 0.18, 101, flat_bottom=True)
    blob(M, (0.05, 0.0, 0.42), 0.8, 0.72, 0.45, mo, 1.5, 8, 3, 0.18, 102)        # 이끼 덮개
    blob(M, (0.7, 0.4, 0.0), 0.4, 0.35, 0.3, r, 1.0, 6, 3, 0.2, 103, flat_bottom=True)


def pebbles_01(C):
    M = C.M
    cols = ['#aaa7a2', '#b3ada3', '#999690', '#bcb6aa']
    rnd = random.Random(111)
    for k in range(7):
        a = 2 * math.pi * k / 7 + rnd.uniform(-0.3, 0.3)
        r = rnd.uniform(0.1, 0.35)
        s = C.s('concrete_wall_001', 1.0, cols[k % 4], gain=1.25)
        sz = rnd.uniform(0.07, 0.14)
        blob(M, (math.cos(a) * r, math.sin(a) * r, 0), sz, sz * 0.85, sz * 0.6, s, 1.0, 6, 3, 0.2, 110 + k, flat_bottom=True)


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


def mushroom_01(C):
    M = C.M
    stalk = C.s('white_stucco', 1.0, '#efe6d2')
    cap1 = C.s('white_stucco', 1.0, '#c4452f', sat=1.2)
    cap2 = C.s('white_stucco', 1.0, '#d98a3a', sat=1.2)
    dots = C.s('white_stucco', 1.0, '#faf4e6')
    for (x, y, h, r, cs) in ((0, 0, 0.34, 0.2, cap1), (0.28, 0.12, 0.2, 0.12, cap2), (-0.22, 0.2, 0.15, 0.09, cap2)):
        tube(M, (x, y, 0), (x, y, h), r * 0.32, r * 0.26, stalk, 1.0, 6)
        blob(M, (x, y, h), r, r, r * 0.6, cs, 1.0, 8, 3, 0.0, 120, flat_bottom=True)
    blob(M, (0.04, 0.04, 0.52), 0.035, 0.035, 0.02, dots, 1.0, 5, 2, 0.0, 121)


def hill_01(C):
    M = C.M
    g = C.s('white_stucco', 4.0, '#7db352', sat=1.1)
    blob(M, (0, 0, 0.0), 5.5, 4.8, 2.6, g, 4.0, 14, 5, 0.1, 131, flat_bottom=True)
    blob(M, (3.4, 1.2, 0.0), 2.6, 2.4, 1.3, g, 4.0, 10, 4, 0.1, 132, flat_bottom=True)


def mountain_01(C):
    M = C.M
    rk = C.s('concrete_wall_001', 6.0, '#a29d94', gain=1.25)
    sn = C.s('snow_02', 3.0, '#f1f5f9')
    base = [(0.0, 7.0, 3.5), (3.2, 5.4, 6.0), (6.4, 3.6, 4.4), (9.2, 1.9, 2.4)]
    rnd = random.Random(141)
    lon = 10
    rows = []
    for z, r, _ in base:
        row = []
        for k in range(lon):
            ph = 2 * math.pi * k / lon
            f = 1 + rnd.uniform(-0.18, 0.18)
            row.append(Vector((math.cos(ph) * r * f, math.sin(ph) * r * 0.82 * f, z)))
        rows.append(row)
    peak = Vector((0.3, 0.1, 11.8))
    for j in range(len(rows) - 1):
        for k in range(lon):
            k2 = (k + 1) % lon
            a, b, d, e = rows[j][k], rows[j][k2], rows[j + 1][k], rows[j + 1][k2]
            slot = sn if j >= 2 else rk
            M.face([a, b, e, d], [(a.x / 6, a.z / 6), (b.x / 6, b.z / 6), (e.x / 6, e.z / 6), (d.x / 6, d.z / 6)], slot)
    top = rows[-1]
    for k in range(lon):
        k2 = (k + 1) % lon
        M.face([top[k], top[k2], peak], [(0, 0), (1, 0), (0.5, 1)], sn)
    M.face(list(reversed(rows[0])), [(p.x / 6, p.y / 6) for p in reversed(rows[0])], rk)


NATURE = {f.__name__: f for f in (
    tree_broadleaf_01, tree_broadleaf_02, tree_pine_01, tree_pine_01_snow, tree_pine_02, tree_dead_01, tree_birch_01, bush_01,
    grass_tuft_01, flower_patch_01, rock_small_01, rock_large_01, rock_moss_01, pebbles_01, log_01, stump_01, mushroom_01, hill_01,
    mountain_01)}

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
