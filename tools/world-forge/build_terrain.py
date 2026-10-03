"""world-forge 지형 조각 — 16×16m 높이맵 조각 10종을 코드로 (K-0017 단계 2). 재질만 Poly Haven CC0.

  blender -b --factory-startup -P tools/world-forge/build_terrain.py -- --id river_bend_01 --out <절대경로>/river_bend_01.glb [--style toon]
  blender -b --factory-startup -P tools/world-forge/build_terrain.py -- --all --out-dir <절대경로> [--style toon]

높이맵(값 잡음 fbm + 모양 함수) → 간단한 침식(이웃 평균으로 가파른 곳 깎기) → 32×32 칸 삼각형 → 경사·높이·물 칸으로 재질 나눔.
바닥까지 내린 치마(skirt)와 밑면이 있어 닫힌 덩어리다(법선이 위로 맞는다). 원점 = 조각 바닥 가운데, 위쪽 z, 바닥 z = 0.
`data/set_plan.json` 의 terrain 10개와 같다. 산출 옆에 `<id>.license.json`.
"""
import json
import math
import os
import sys

import bpy
from mathutils import Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import wf_common as W  # noqa: E402
from build_prop import Ctx  # noqa: E402

N = 32            # 칸 수(한 변)
SIZE = 16.0       # 미터
BASE = 1.2        # 가장 낮은 땅 위 여유(치마 깊이)
TRIS_MAX = 5000
A = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []


def arg(k, d=None):
    return A[A.index(k) + 1] if k in A else d


# ---------------------------------------------------------------- 잡음·모양 도우미

def _h(ix, iy, seed):
    n = (ix * 374761393 + iy * 668265263 + seed * 1442695041) & 0xffffffff
    n = ((n ^ (n >> 13)) * 1274126177) & 0xffffffff
    return ((n ^ (n >> 16)) & 0xffffffff) / 0xffffffff


def vnoise(x, y, seed):
    ix, iy = math.floor(x), math.floor(y)
    fx, fy = x - ix, y - iy
    u, v = fx * fx * (3 - 2 * fx), fy * fy * (3 - 2 * fy)
    a, b, c, d = _h(ix, iy, seed), _h(ix + 1, iy, seed), _h(ix, iy + 1, seed), _h(ix + 1, iy + 1, seed)
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v


def fbm(x, y, seed=1, octaves=3):
    s, amp, f = 0.0, 0.5, 1.0
    for o in range(octaves):
        s += amp * vnoise(x * f, y * f, seed + o * 7)
        amp *= 0.5
        f *= 2.03
    return s / 0.875            # 대략 0..1


def smooth(a, b, x):
    t = max(0.0, min(1.0, (x - a) / (b - a)))
    return t * t * (3 - 2 * t)


# ---------------------------------------------------------------- 조각 10개: 높이 함수 + 재질 고르기

def river_bend(x, y):
    yc = 2.2 * math.sin(x * 0.35)
    c = max(0.0, 1.0 - abs(y - yc) / 2.3)
    return 1.0 + 0.45 * fbm(x * 0.25, y * 0.25, 3) - 1.15 * smooth(0, 1, c) + 0.12 * smooth(0.0, 0.35, c) * (1 - smooth(0.35, 0.7, c))


def ridge(x, y):
    d = abs(y - 0.6 * x) / math.sqrt(1 + 0.36)
    return 0.35 + 3.1 * math.exp(-(d / 3.2) ** 2) * (0.75 + 0.5 * fbm(x * 0.4, y * 0.4, 5)) + 0.4 * fbm(x * 0.5, y * 0.5, 6)


def cave_floor(x, y):
    r = math.hypot(x, y) / 8.0
    rim = 3.4 * smooth(0.5, 1.0, r) * (0.7 + 0.6 * fbm(x * 0.35, y * 0.35, 8))
    bumps = sum(1.3 * math.exp(-(((x - bx) ** 2 + (y - by) ** 2) / 0.55)) for bx, by in ((-2.2, 1.5), (1.8, -2.4), (0.6, 2.6)))
    return 0.25 + 0.5 * fbm(x * 0.5, y * 0.5, 9) + rim + bumps


def rock_outcrop(x, y):
    r = math.hypot(x, y) / 5.8
    m = max(0.0, 1 - r * r) ** 1.2 * (0.6 + 0.8 * fbm(x * 0.45, y * 0.45, 11))
    h = 0.3 + 3.3 * m
    return h * 0.55 + (round(h * 2.5) / 2.5) * 0.45 + 0.1 * fbm(x, y, 12)      # 지층 계단


def meadow(x, y):
    return 0.6 + 0.9 * fbm(x * 0.18, y * 0.18, 13) + 0.25 * fbm(x * 0.6, y * 0.6, 14)


def pond(x, y):
    r = math.hypot(x, y)
    base = 0.9 + 0.35 * fbm(x * 0.22, y * 0.22, 15)
    return base - 1.5 * smooth(0, 1, 1 - r / 4.6) + 0.15 * smooth(3.4, 5.4, r) * (1 - smooth(5.4, 7.5, r))


def cliff_ledge(x, y):
    c = 1.0 + 1.3 * math.sin(y * 0.4) + 0.5 * fbm(y * 0.5, 0.3, 16)
    t = smooth(-0.5, 0.5, c - x)
    return 0.35 + 2.7 * t + 0.35 * fbm(x * 0.3, y * 0.3, 17) + 0.15 * fbm(x, y, 18)


def hill_slope(x, y):
    return 0.3 + 2.5 * ((x + 8) / 16) ** 1.2 + 0.4 * fbm(x * 0.25, y * 0.25, 19) + 0.12 * fbm(x * 0.9, y * 0.9, 20)


def dune(x, y):
    s = (x * 0.30 + 0.9 * fbm(y * 0.22, 1.5, 21)) % 1.0
    prof = s / 0.72 if s < 0.72 else (1 - s) / 0.28
    return 0.4 + 1.5 * (prof ** 1.4) * (0.8 + 0.4 * fbm(x * 0.2, y * 0.2, 22)) + 0.05 * fbm(x * 1.5, y * 1.5, 23)


def road_plain(x, y):
    yc = 1.8 * math.sin(x * 0.28)
    d = abs(y - yc)
    base = 0.7 + 0.5 * fbm(x * 0.2, y * 0.2, 24)
    road = 0.55
    t = smooth(1.3, 2.6, d)
    ditch = -0.12 * (smooth(1.4, 1.9, d) * (1 - smooth(1.9, 2.5, d)))
    return road + (base - road) * t + ditch


def _stone(C, tint=None, tile=1.6):
    return C.s('castle_wall_slates', tile, tint)


# 재질 고르기: cell = dict(x,y,z,slope,water) → 슬롯 번호. water 칸은 따로 처리.
def pick_grass_rock(C, cell, grass='forest_ground_04', rock=('aerial_grass_rock', None), steep=0.55):
    if cell['slope'] > steep:
        return C.s(rock[0], 2.0, rock[1])
    return C.s(grass, 2.2, '#8fbf55')


SPECS = {
    'river_bend_01': dict(h=river_bend, water=0.62,
                          pick=lambda C, c: C.s('white_stucco', 2.0, '#3d9be0', gain=1.1) if c['water'] else
                          (C.s('coast_sand_03', 2.0) if c['z'] < 0.95 else pick_grass_rock(C, c, 'forest_ground_04', steep=0.5))),
    'ridge_01': dict(h=ridge, water=None,
                     pick=lambda C, c: C.s('aerial_grass_rock', 2.0, '#b9b2a6') if c['slope'] > 0.62 or c['z'] > 2.3 else C.s('forest_ground_04', 2.2, '#8fbf55')),
    'cave_floor_01': dict(h=cave_floor, water=None,
                          pick=lambda C, c: _stone(C, '#6a665f') if c['slope'] > 0.5 or c['z'] > 1.6 else C.s('brown_mud', 2.0, '#6b5a4a')),
    'rock_outcrop_01': dict(h=rock_outcrop, water=None,
                            pick=lambda C, c: C.s('aerial_grass_rock', 2.0, '#aaa398') if c['z'] > 0.9 else C.s('forest_ground_04', 2.2, '#8fbf55')),
    'meadow_01': dict(h=meadow, water=None,
                      pick=lambda C, c: C.s('dry_ground_01', 2.2, '#a8b050') if fbm(c['x'] * 0.4, c['y'] * 0.4, 30) > 0.62 else C.s('forest_ground_04', 2.2, '#8fbf55')),
    'pond_01': dict(h=pond, water=0.52,
                    pick=lambda C, c: C.s('white_stucco', 2.0, '#3d9be0', gain=1.1) if c['water'] else
                    (C.s('brown_mud', 2.0) if math.hypot(c['x'], c['y']) < 5.3 else C.s('forest_ground_04', 2.2, '#8fbf55'))),
    'cliff_ledge_01': dict(h=cliff_ledge, water=None,
                           pick=lambda C, c: C.s('aerial_grass_rock', 2.0, '#b8b0a2') if c['slope'] > 0.7 else C.s('forest_ground_04', 2.2, '#8fbf55')),
    'hill_slope_01': dict(h=hill_slope, water=None,
                          pick=lambda C, c: C.s('aerial_grass_rock', 2.0, '#b0aa9c') if c['slope'] > 0.62 else C.s('forest_ground_04', 2.2, '#86b856')),
    'dune_01': dict(h=dune, water=None,
                    pick=lambda C, c: C.s('dry_ground_01', 2.0, '#d2a867') if c['slope'] > 0.55 else C.s('coast_sand_03', 2.0)),
    'road_plain_01': dict(h=road_plain, water=None,
                          pick=lambda C, c: C.s('cobblestone_floor_01', 1.6) if abs(c['y'] - 1.8 * math.sin(c['x'] * 0.28)) < 1.3 else C.s('forest_ground_04', 2.2, '#8fbf55')),
}


def heightmap(spec, erode=2):
    n1 = N + 1
    pts = [[spec['h'](-SIZE / 2 + SIZE * i / N, -SIZE / 2 + SIZE * j / N) for j in range(n1)] for i in range(n1)]
    for _ in range(erode):                       # 간단한 침식: 이웃 평균 쪽으로 20%(가장자리는 그대로)
        new = [row[:] for row in pts]
        for i in range(1, N):
            for j in range(1, N):
                avg = (pts[i - 1][j] + pts[i + 1][j] + pts[i][j - 1] + pts[i][j + 1]) / 4
                new[i][j] = pts[i][j] + (avg - pts[i][j]) * 0.2
        pts = new
    lo = min(min(r) for r in pts)
    return [[v - lo + BASE for v in r] for r in pts], lo


def build(pid, out, style):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    W._mat_cache.clear()
    W.set_style(style)
    spec = SPECS[pid]
    C = Ctx(pid)
    M = C.M
    Z, lo = heightmap(spec)
    wl = None if spec['water'] is None else spec['water'] - lo + BASE
    step = SIZE / N
    pos = lambda i, j: (-SIZE / 2 + step * i, -SIZE / 2 + step * j)
    # 물 칸 높이 고정(물보다 낮은 점은 수면으로 올린다)
    low = [[wl is not None and Z[i][j] < wl for j in range(N + 1)] for i in range(N + 1)]
    ztop = [[(wl if low[i][j] else Z[i][j]) for j in range(N + 1)] for i in range(N + 1)]
    V = lambda i, j: Vector((*pos(i, j), ztop[i][j]))
    uvp = lambda i, j: (pos(i, j)[0] / 2.0 + 8, pos(i, j)[1] / 2.0 + 8)
    for i in range(N):
        for j in range(N):
            zc = (Z[i][j] + Z[i + 1][j] + Z[i][j + 1] + Z[i + 1][j + 1]) / 4
            gx = (Z[i + 1][j] + Z[i + 1][j + 1] - Z[i][j] - Z[i][j + 1]) / (2 * step)
            gy = (Z[i][j + 1] + Z[i + 1][j + 1] - Z[i][j] - Z[i + 1][j]) / (2 * step)
            x, y = pos(i, j)
            water = wl is not None and all(low[a][b] for a, b in ((i, j), (i + 1, j), (i, j + 1), (i + 1, j + 1)))
            cell = dict(x=x + step / 2, y=y + step / 2, z=zc, slope=math.hypot(gx, gy), water=water)
            s = spec['pick'](C, cell)
            # 두 삼각형, 위에서 보아 반시계
            M.face([V(i, j), V(i + 1, j), V(i + 1, j + 1)], [uvp(i, j), uvp(i + 1, j), uvp(i + 1, j + 1)], s)
            M.face([V(i, j), V(i + 1, j + 1), V(i, j + 1)], [uvp(i, j), uvp(i + 1, j + 1), uvp(i, j + 1)], s)
    # 치마 + 밑면(닫힌 덩어리)
    side = C.s('castle_wall_slates', 2.0, '#6d665c')
    ring = [(i, 0) for i in range(N)] + [(N, j) for j in range(N)] + [(i, N) for i in range(N, 0, -1)] + [(0, j) for j in range(N, 0, -1)]
    for k, (i, j) in enumerate(ring):
        i2, j2 = ring[(k + 1) % len(ring)]
        a, b = V(i, j), V(i2, j2)
        M.quad(Vector((a.x, a.y, 0)), Vector((b.x, b.y, 0)), b, a, side, (0, 0), (step / 2, 0), (step / 2, a.z / 2), (0, a.z / 2))
    M.face([Vector((*pos(i, j), 0)) for i, j in reversed(ring)], [((pos(i, j)[0]) / 2, (pos(i, j)[1]) / 2) for i, j in reversed(ring)], side)
    ob = M.build()
    tris = sum(len(p.vertices) - 2 for p in ob.data.polygons)
    pts = [Vector(c) for c in ob.bound_box]
    size = [round(max(p[i] for p in pts) - min(p[i] for p in pts), 2) for i in range(3)]
    os.makedirs(os.path.dirname(os.path.abspath(out)), exist_ok=True)
    W.export_glb([ob], out, int(os.environ.get('WF_TOON_PX', '256')) if style == 'toon' else 1024, 'JPEG' if style == 'toon' else 'AUTO')
    lic = {'id': pid, 'generator': 'tools/world-forge/build_terrain.py', 'blender': bpy.app.version_string, 'style': style,
           'license': 'CC0-1.0 (재질 사진 전부 Poly Haven CC0, 높이맵은 전부 코드 — 값 잡음 fbm + 모양 함수 + 간단한 침식)',
           'inputs': sorted(f'polyhaven: {m}' for m in C.mats), 'size_m': size, 'tris': tris, 'grid': N}
    json.dump(lic, open(os.path.splitext(out)[0] + '.license.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    kb = os.path.getsize(out) // 1024
    print('WORLDFORGE', json.dumps({'id': pid, 'tris': tris, 'size_m': size, 'kb': kb, 'ok': tris <= TRIS_MAX and (style != 'toon' or kb <= 512)}))


if __name__ == '__main__':
    style = arg('--style', 'real')
    if '--list' in A:
        print('TERRAINS', ' '.join(SPECS))
    elif '--all' in A:
        d = arg('--out-dir')
        for pid in SPECS:
            build(pid, os.path.join(d, pid + '.glb'), style)
    else:
        build(arg('--id'), arg('--out'), style)
