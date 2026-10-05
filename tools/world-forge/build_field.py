"""world-forge 고돗 빈 자리 — 밭 작물·갈대·허수아비·디딤돌·폐허(field 13) · 사가블로 굴혈 방 키트(dkit 5×3) · 바닥 노획물(loot 20) (K-0057). 재질만 Poly Haven CC0 사진.

  blender -b --factory-startup -P tools/world-forge/build_field.py -- --id wheat_ripe_01 --out <절대>/wheat_ripe_01.glb [--style toon]
  blender -b --factory-startup -P tools/world-forge/build_field.py -- --all --out-dir <절대 폴더> [--style toon]
  blender -b --factory-startup -P tools/world-forge/build_field.py -- --list

원점 = 바닥 가운데(발 밑), 단위 미터, z 위. `data/set_plan.json` 의 `field`·`dkit`·`loot` 목록과 같은 id 48개.
삼각형: 작물·풀·허수아비·디딤돌·폐허 ≤1500, 지붕·다리·방 키트·노획물 ≤2500. 시대 이름·원작 형태 없음.
굴혈 방 키트는 한 변 4m·문 폭 2m·벽 높이 3m, 이음 단면이 모듈마다 같다. 재질 3(`_dirt·_limestone·_lava`)은 형태가 같고 재질 칸만 다르다.
노획물은 눕힌 자세, 등급 g0~g4 = 색 + 빛 줄(g0 무채·g1 청·g2 보라·g3 금·g4 주황 발광).
"""
import math
import os
import random
import sys

import bpy  # noqa: F401
from mathutils import Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import build_prop as BP  # noqa: E402
from build_prop import tube, obox, gable, annulus, A, arg  # noqa: E402

BP.TRIS_MAX = 1500
BP.GENERATOR = 'tools/world-forge/build_field.py'
BIG2500 = {'temple_roof_01', 'plank_bridge_01'}


def blade(M, base, h, w, lean, yaw, slot):
    """풀잎·이삭 줄기 한 장 — 아래 넓고 끝이 뾰족한 삼각형, 앞뒤 두 면."""
    c, s = math.cos(yaw), math.sin(yaw)
    ex, ey = Vector((c, s, 0)), Vector((-s, c, 0))
    b = Vector(base)
    l, r = b - ex * w / 2, b + ex * w / 2
    tip = b + ey * lean + Vector((0, 0, h))
    M.face([l, r, tip], [(0, 0), (1, 0), (0.5, 1)], slot)
    M.face([r, l, tip], [(1, 0), (0, 0), (0.5, 1)], slot)


def soil(C, tint='#6a4a30'):
    return C.s('brown_mud', 1.0, tint)


def wood(C, tint=None):
    return C.s('brown_planks_03', 1.0, tint)


def stone_mat(C, tint='#9b968c', tile=1.2):
    return C.s('castle_wall_slates', tile, tint)


def rock_mat(C, tint='#9b968c', tile=1.5):
    """흩어진 돌(디딤돌·잔해) — 판석 무늬는 작은 덩이에선 나무껍질처럼 보여(10-06 눈 판정) 자연 세트 바위와 같은 재질로."""
    return C.s('concrete_wall_001', tile, tint, gain=1.25)


# ---------------------------------------------------------------- field 13

def _wheat(C, n, h, hue, ear, seed, lean):
    M = C.M
    rnd = random.Random(seed)
    stalk = C.s('white_stucco', 1.0, hue, sat=1.1)
    earm = C.s('white_stucco', 1.0, ear, sat=1.2) if ear else None
    obox(M, (0, 0, 0), (1.3, 1.3, 0.06), 0, soil(C))
    for k in range(n):
        x, y = rnd.uniform(-0.55, 0.55), rnd.uniform(-0.55, 0.55)
        yaw = rnd.uniform(0, math.pi)
        hh = h * rnd.uniform(0.85, 1.1)
        if earm is None:
            blade(M, (x, y, 0.05), hh, 0.07, rnd.uniform(-lean, lean), yaw, stalk)
        else:
            lx, ly = rnd.uniform(-lean, lean) * 0.4, rnd.uniform(-lean, lean) * 0.4
            tube(M, (x, y, 0.05), (x + lx, y + ly, 0.05 + hh * 0.8), 0.012, 0.01, stalk, 0.5, 4, caps=False)
            tube(M, (x + lx, y + ly, 0.05 + hh * 0.78), (x + lx * 1.2, y + ly * 1.2, 0.05 + hh), 0.032, 0.0, earm, 0.5, 4)
            blade(M, (x, y, 0.05), hh * 0.45, 0.05, 0.12, yaw, stalk)


def wheat_sprout_01(C):
    _wheat(C, 26, 0.2, '#6fae45', None, 3, 0.05)


def wheat_growing_01(C):
    _wheat(C, 30, 0.6, '#9ab845', None, 5, 0.12)


def wheat_ripe_01(C):
    _wheat(C, 26, 0.95, '#c9a24a', '#e0b84a', 7, 0.22)


def vegetable_row_01(C):
    M = C.M
    sd = soil(C)
    leaf = C.s('white_stucco', 1.0, '#4f9a3a', sat=1.1)
    leaf2 = C.s('white_stucco', 1.0, '#74b84c', sat=1.1)
    obox(M, (0, 0, 0), (2.1, 0.7, 0.14), 0, sd)
    obox(M, (0, 0, 0.14), (2.1, 0.4, 0.08), 0, sd)
    for k in range(6):
        x = -0.85 + k * 0.34
        tube(M, (x, 0, 0.2), (x, 0, 0.36), 0.21, 0.19, leaf if k % 2 else leaf2, 0.5, 8)
        tube(M, (x, 0, 0.36), (x, 0, 0.46), 0.19, 0.08, leaf2 if k % 2 else leaf, 0.5, 8)
        for sy in (-1, 1):
            blade(M, (x, sy * 0.12, 0.22), 0.3, 0.2, sy * 0.15, math.pi / 2 if sy > 0 else -math.pi / 2, leaf)


def reed_clump_01(C):
    M = C.M
    rnd = random.Random(11)
    g = C.s('white_stucco', 1.0, '#6e9a48', sat=1.1)
    g2 = C.s('white_stucco', 1.0, '#8aae55', sat=1.1)
    brown = C.s('white_stucco', 1.0, '#6a4426')
    for k in range(16):
        x, y = rnd.uniform(-0.3, 0.3), rnd.uniform(-0.3, 0.3)
        blade(M, (x, y, 0), rnd.uniform(1.0, 1.7), 0.07, rnd.uniform(-0.3, 0.3), rnd.uniform(0, math.pi), g if k % 2 else g2)
    for x, y, h in ((0.05, 0.1, 1.55), (-0.14, -0.05, 1.35), (0.15, -0.12, 1.2)):             # 부들 이삭
        tube(M, (x, y, 0), (x, y, h), 0.012, 0.012, g, 0.5, 4, caps=False)
        tube(M, (x, y, h - 0.28), (x, y, h), 0.04, 0.035, brown, 0.5, 6)


def scarecrow_01(C):
    M = C.M
    wd = wood(C)
    sack = C.s('white_stucco', 1.0, '#cdb98a')
    straw = C.s('thatch_roof_angled', 1.0, '#b7933f')
    cloth = C.s('white_stucco', 1.0, '#8a4a3a')
    tube(M, (0, 0, 0), (0, 0, 1.9), 0.05, 0.04, wd, 0.6, 6)                                   # 기둥
    obox(M, (0, 0, 1.25), (1.5, 0.07, 0.07), 0, wd)                                           # 가로대
    tube(M, (0, 0, 1.0), (0, 0, 1.45), 0.2, 0.25, cloth, 0.6, 8)                              # 몸(자루 옷)
    tube(M, (0, 0, 1.45), (0, 0, 1.52), 0.25, 0.1, cloth, 0.6, 8)
    tube(M, (0, 0, 1.52), (0, 0, 1.8), 0.17, 0.15, sack, 0.5, 8)                              # 머리 자루
    tube(M, (0, 0, 1.78), (0, 0, 1.84), 0.14, 0.1, sack, 0.5, 8)
    tube(M, (0, 0, 1.82), (0, 0, 1.86), 0.34, 0.34, straw, 0.6, 10)                            # 밀짚모자 챙
    tube(M, (0, 0, 1.86), (0, 0, 2.1), 0.2, 0.08, straw, 0.6, 8)
    for sx in (-1, 1):                                                                       # 팔 끝 지푸라기
        for k in range(4):
            tube(M, (sx * 0.72, 0, 1.28), (sx * (0.88 + 0.03 * k), (k - 1.5) * 0.04, 1.14 - 0.05 * k), 0.015, 0.008, straw, 0.4, 4)
    for k in range(5):                                                                       # 옷 밑단 지푸라기
        a = 2 * math.pi * k / 5
        tube(M, (math.cos(a) * 0.15, math.sin(a) * 0.15, 1.02), (math.cos(a) * 0.2, math.sin(a) * 0.2, 0.8), 0.015, 0.008, straw, 0.4, 4)


def _stepping(C, spec, seed):
    M = C.M
    rnd = random.Random(seed)
    for k, (x, y, rx, ry, h) in enumerate(spec):
        st = rock_mat(C, ('#a39d90', '#8f8a80', '#b0a898')[k % 3], 1.0)
        tube(M, (x, y, 0), (x, y, h), rx, rx * 0.93, st, 1.0, 7)
        tube(M, (x, y, h), (x, y, h + 0.01), rx * 0.93 * ry / rx, rx * 0.8, st, 1.0, 7)


def stepping_stone_01(C):
    _stepping(C, [(0, -0.6, 0.34, 1.0, 0.1), (0.1, 0.0, 0.4, 1.0, 0.12), (-0.05, 0.64, 0.32, 1.0, 0.09)], 1)


def stepping_stone_02(C):
    M = C.M
    for k, (x, y, w, d, yaw, h) in enumerate([(-0.3, -0.7, 0.62, 0.5, 8, 0.1), (0.25, -0.1, 0.56, 0.6, -12, 0.12), (-0.25, 0.5, 0.64, 0.46, 15, 0.09), (0.3, 1.0, 0.5, 0.5, -6, 0.1)]):
        obox(M, (x, y, 0), (w, d, h), yaw, rock_mat(C, ('#a39d90', '#8f8a80')[k % 2], 1.0), 1.0)


def rubble_pillar_01(C):
    M = C.M
    st = rock_mat(C, '#9b968c')
    dk = rock_mat(C, '#7f7a72')
    obox(M, (0, 0, 0), (1.2, 1.2, 0.28), 0, dk)
    tube(M, (0, 0, 0.28), (0, 0, 1.15), 0.44, 0.42, st, 1.5, 8)                                # 부러진 몸통
    tube(M, (0, 0, 1.15), (0.1, 0.05, 1.42), 0.42, 0.22, st, 1.5, 8)                           # 삐죽한 부러진 끝
    tube(M, (0.9, 0.5, 0.2), (1.9, 0.9, 0.2), 0.38, 0.4, st, 1.5, 8)                            # 쓰러진 토막
    obox(M, (-0.85, -0.7, 0), (0.42, 0.34, 0.22), 25, dk)                                     # 부스러기
    obox(M, (1.0, -0.6, 0), (0.3, 0.26, 0.16), -15, st)
    obox(M, (-0.4, 0.95, 0), (0.28, 0.3, 0.14), 40, dk)


def rubble_wall_01(C):
    M = C.M
    st = rock_mat(C, '#8f8a80')
    st2 = rock_mat(C, '#a29d92')
    rows = [(0.0, 0.5, [0.9, 0.8, 1.0, 0.9]), (0.5, 0.45, [0.8, 1.1, 0.6]), (0.95, 0.4, [0.7, 0.9])]
    for z, h, parts in rows:
        x = -1.8 + (0 if z == 0 else 0.2 * (z > 0.9) + 0.4 * (z > 0.4 and z < 0.9))
        for i, ln in enumerate(parts):
            obox(M, (x + ln / 2, 0, z), (ln - 0.03, 0.5, h - 0.03), 0, st if i % 2 else st2)
            x += ln
    obox(M, (-0.5, 0, 1.35), (0.5, 0.45, 0.2), 6, st)                                          # 위 삐죽 블록
    for x, y, yaw, w, h in ((-1.2, 0.55, 20, 0.45, 0.3), (0.7, -0.6, -25, 0.5, 0.3), (1.5, 0.45, 10, 0.34, 0.24), (-0.1, 0.7, 40, 0.3, 0.2), (-1.9, -0.45, -8, 0.4, 0.26)):
        obox(M, (x, y, 0), (w, w * 0.8, h), yaw, st2 if h > 0.25 else st)                       # 무너진 돌덩이


def wall_block_01(C):
    M = C.M
    st = stone_mat(C, '#9b968c', 1.0)
    dk = stone_mat(C, '#85807a', 1.0)
    obox(M, (0, 0, 0), (1.0, 0.6, 0.55), 0, st)
    obox(M, (0, 0, 0.55), (0.92, 0.52, 0.06), 0, dk)
    obox(M, (0, 0, -0.0), (1.02, 0.62, 0.05), 0, dk)


def plank_bridge_01(C):
    M = C.M
    wd = wood(C)
    dk = wood(C, '#6a4a30')
    rope = C.s('white_stucco', 1.0, '#a89060')
    for k in range(13):
        obox(M, (-1.55 + k * 0.258, 0, 0.3), (0.22, 1.3 + (k % 2) * 0.04, 0.06), 0, wd if k % 3 else dk, 0.8)       # 널
    for sy in (-1, 1):
        obox(M, (0, sy * 0.52, 0.2), (3.2, 0.1, 0.1), 0, dk, 0.8)                              # 밑 대들보
        for x in (-1.5, 0, 1.5):
            obox(M, (x, sy * 0.68, 0.3), (0.1, 0.1, 0.9), 0, dk, 0.8)                            # 난간 기둥
        tube(M, (-1.5, sy * 0.68, 1.1), (1.5, sy * 0.68, 1.1), 0.03, 0.03, rope, 0.5, 5)         # 윗줄
        tube(M, (-1.5, sy * 0.68, 0.7), (1.5, sy * 0.68, 0.7), 0.03, 0.03, rope, 0.5, 5)         # 아랫줄


def temple_roof_01(C):
    M = C.M
    rf = C.s('clay_roof_tiles', 1.4, '#7a8a8e')
    dk = C.s('black_painted_planks', 1.0)
    gable(M, (0, 0, 0), (3.6, 4.4), 1.5, 0, rf, 1.4)                                           # 넓은 박공
    obox(M, (0, 0, 1.45), (0.2, 4.5, 0.18), 0, dk)                                            # 마루 띠
    for sy in (-1, 1):
        tube(M, (0, sy * 2.2, 1.55), (0, sy * 2.2, 1.95), 0.14, 0.04, dk, 0.5, 6)              # 마루 끝 장식
    for sx in (-1, 1):
        for k in range(5):
            obox(M, (sx * 1.8, -1.9 + k * 0.95, -0.12), (0.18, 0.16, 0.2), 0, dk)                # 서까래 끝


# ---------------------------------------------------------------- dkit 5 × 3

VARIANTS = {
    'dirt': dict(floor=('brown_mud', 2.0, '#6f5236'), wall=('cliff_side', 3.0, '#6b5238'), glow=None),
    'limestone': dict(floor=('coast_sand_rocks_02', 2.0, '#c9c0aa'), wall=('coast_sand_rocks_02', 3.0, '#d8d0bb'), glow=None),
    'lava': dict(floor=('concrete_wall_001', 2.0, '#2a2523'), wall=('cliff_side', 3.0, '#3b2b28'), glow='#ff6a20'),
}
ROOM = 4.0
WALL_H = 3.0
OPEN = 2.0


def _mats(C, variant):
    v = VARIANTS[variant]
    fl = C.s(v['floor'][0], v['floor'][1], v['floor'][2])
    wl = C.s(v['wall'][0], v['wall'][1], v['wall'][2])
    gl = C.s('white_stucco', 1.0, v['glow'], gain=1.7) if v['glow'] else None
    return fl, wl, gl


def _rough_wall(M, a, b, y0, slot, seed, h=WALL_H, thick=0.5, axis='x'):
    """a→b 선분 위 거친 바위 벽. 0.5m 마디마다 두께·높이 흔들림, 양 끝은 고정(이어 붙임)."""
    rnd = random.Random(seed)
    n = max(1, int(round(abs(b - a) / 0.5)))
    step = (b - a) / n
    for i in range(n):
        end = i == 0 or i == n - 1
        t = thick * (1.0 if end else rnd.uniform(0.85, 1.15))
        hh = h * (1.0 if end else rnd.uniform(0.9, 1.0))
        c = a + step * (i + 0.5)
        size = (abs(step) + 0.01, t, hh) if axis == 'x' else (t, abs(step) + 0.01, hh)
        pos = (c, y0, 0.0) if axis == 'x' else (y0, c, 0.0)
        obox(M, pos, size, 0, slot, 1.5)
    # 윗단 울퉁불퉁
    for i in range(n):
        if i in (0, n - 1):
            continue
        c = a + step * (i + 0.5)
        hh = rnd.uniform(0.05, 0.22)
        size = (abs(step) * 0.8, thick * 0.8, hh) if axis == 'x' else (thick * 0.8, abs(step) * 0.8, hh)
        pos = (c, y0, h) if axis == 'x' else (y0, c, h)
        obox(M, pos, size, rnd.uniform(-8, 8), slot, 1.5)


def _floor(M, w, d, slot, cx=0.0, cy=0.0, th=0.2):
    obox(M, (cx, cy, -th), (w, d, th), 0, slot, 2.0)


def _cracks(M, gl, pts):
    if gl is None:
        return
    for (x0, y0, x1, y1) in pts:
        tube(M, (x0, y0, 0.01), (x1, y1, 0.01), 0.05, 0.05, gl, 0.5, 4, caps=False)


def cave_room(C, variant):
    M = C.M
    fl, wl, gl = _mats(C, variant)
    h = ROOM / 2
    _floor(M, ROOM, ROOM, fl)
    _rough_wall(M, -h, -OPEN / 2, -h, wl, 1, axis='x')                                          # 남쪽 벽(가운데 2m 열림)
    _rough_wall(M, OPEN / 2, h, -h, wl, 2, axis='x')
    _rough_wall(M, -h, -OPEN / 2, h, wl, 3, axis='x')                                           # 북쪽 벽(가운데 열림)
    _rough_wall(M, OPEN / 2, h, h, wl, 4, axis='x')
    _rough_wall(M, -h, h, -h, wl, 5, axis='y')                                                  # 서·동 벽(막힘)
    _rough_wall(M, -h, h, h, wl, 6, axis='y')
    _cracks(M, gl, [(-1.4, -0.8, -0.3, 0.2), (-0.3, 0.2, 0.9, 0.7), (0.9, 0.7, 1.5, 1.6), (-0.3, 0.2, 0.2, -1.1)])


def cave_gate(C, variant):
    M = C.M
    fl, wl, gl = _mats(C, variant)
    h = ROOM / 2
    _floor(M, ROOM, 0.8, fl)
    _rough_wall(M, -h, -OPEN / 2, 0.0, wl, 7, axis='x')                                         # 문 양옆 벽
    _rough_wall(M, OPEN / 2, h, 0.0, wl, 8, axis='x')
    obox(M, (0, 0, 2.3), (OPEN + 0.4, 0.55, 0.7), 0, wl, 1.5)                                  # 상인방
    obox(M, (-OPEN / 2 - 0.05, 0, 0), (0.22, 0.6, 2.4), 0, wl, 1.5)                            # 문설주
    obox(M, (OPEN / 2 + 0.05, 0, 0), (0.22, 0.6, 2.4), 0, wl, 1.5)
    _cracks(M, gl, [(-0.4, -0.2, 0.4, 0.2)])


def cave_corridor(C, variant):
    M = C.M
    fl, wl, gl = _mats(C, variant)
    _floor(M, OPEN, ROOM, fl)
    _rough_wall(M, -2.0, 2.0, -1.0 - 0.25, wl, 9, axis='y')
    _rough_wall(M, -2.0, 2.0, 1.0 + 0.25, wl, 10, axis='y')
    _cracks(M, gl, [(0.0, -1.7, 0.2, -0.5), (0.2, -0.5, -0.1, 0.8), (-0.1, 0.8, 0.1, 1.8)])


def cave_corner(C, variant):
    M = C.M
    fl, wl, gl = _mats(C, variant)
    _floor(M, OPEN, OPEN, fl)                                                                    # 가운데 2x2
    _floor(M, OPEN, 2.0, fl, cx=0.0, cy=-2.0)                                                    # 남쪽 팔
    _floor(M, 2.0, OPEN, fl, cx=2.0, cy=0.0)                                                     # 동쪽 팔
    _rough_wall(M, -3.0, 1.25, -1.25, wl, 11, axis='y')                                          # 서쪽 바깥 벽
    _rough_wall(M, -1.25, 3.0, 1.25, wl, 12, axis='x')                                           # 북쪽 바깥 벽
    _rough_wall(M, 1.25, 3.0, -1.25, wl, 13, axis='x')                                           # 동쪽 팔 남쪽 벽
    _rough_wall(M, -3.0, -1.25, 1.25, wl, 14, axis='y')                                          # 남쪽 팔 동쪽 벽
    _cracks(M, gl, [(0.0, -2.5, 0.1, -0.2), (0.1, -0.2, 2.5, 0.1)])


def cave_stairs(C, variant):
    M = C.M
    fl, wl, gl = _mats(C, variant)
    steps = 8
    for k in range(steps):
        obox(M, (0, -2.0 + (k + 0.5) * ROOM / steps, -0.2), (OPEN, ROOM / steps + 0.01, 0.2 + 0.15 * (k + 1)), 0, fl, 1.0)
    _rough_wall(M, -2.0, 2.0, -1.25, wl, 17, axis='y')
    _rough_wall(M, -2.0, 2.0, 1.25, wl, 18, axis='y')
    _cracks(M, gl, [(0.0, -1.5, 0.0, 1.5)])


DKIT_FORMS = {'cave_room_01': cave_room, 'cave_gate_01': cave_gate, 'cave_corridor_01': cave_corridor, 'cave_corner_01': cave_corner, 'cave_stairs_01': cave_stairs}


def _dkit(form, variant):
    def f(C):
        form(C, variant)
    f.__name__ = f'{form.__name__}_01_{variant}'
    return f


# ---------------------------------------------------------------- loot 20

TIERS = [  # g0~g4: 금속색, 날 광택, 빛 줄(없으면 None), 자루색
    ('#8d8f94', None, '#5a4a38'),
    ('#69a6e8', '#69a6e8', '#4a5a78'),
    ('#a66af0', '#a66af0', '#4a3a68'),
    ('#e6bc48', '#ffd86a', '#6a4a22'),
    ('#ff8a3a', '#ff7a30', '#3a2a22'),
]


def _tier(C, g):
    metal, glow, grip = TIERS[g]
    mm = C.s('concrete_wall_001', 1.0, metal, sat=1.1 + 0.05 * g)
    gm = C.s('brown_planks_03', 1.0, grip)
    gl = C.s('white_stucco', 1.0, glow, gain=1.6 + 0.1 * g) if glow else None
    return mm, gm, gl


def _aura(C, g, gl, r):
    if gl is not None:
        annulus(C.M, (0, 0, 0), r, r + 0.03 + 0.012 * g, 0.015 + 0.004 * g, gl, 0.5, 16)


def loot_sword(C, g):
    M = C.M
    mm, gm, gl = _tier(C, g)
    z = 0.06
    obox(M, (0.28, 0, z), (0.95, 0.1, 0.035), 0, mm, 0.5)                                    # 날
    tube(M, (0.75, 0, z + 0.0175), (0.96, 0, z + 0.0175), 0.05, 0.0, mm, 0.5, 4)              # 끝 뾰족
    if gl is not None:
        obox(M, (0.28, 0, z + 0.035), (0.9, 0.025, 0.012), 0, gl, 0.5)                       # 날 빛 줄
    obox(M, (-0.22, 0, z - 0.005), (0.07, 0.38 + 0.03 * g, 0.045), 0, mm, 0.5)                # 날밑
    tube(M, (-0.55, 0, z + 0.02), (-0.24, 0, z + 0.02), 0.028, 0.026, gm, 0.5, 6)              # 손잡이
    tube(M, (-0.6, 0, z + 0.02), (-0.55, 0, z + 0.02), 0.045, 0.04, mm, 0.5, 6)                # 쇠 장식
    _aura(C, g, gl, 0.62)


def loot_axe(C, g):
    M = C.M
    mm, gm, gl = _tier(C, g)
    z = 0.06
    tube(M, (-0.55, 0, z + 0.03), (0.6, 0, z + 0.03), 0.032, 0.03, gm, 0.5, 6)                 # 자루
    obox(M, (0.45, 0.13, z), (0.2, 0.24, 0.05), 0, mm, 0.5)                                  # 도끼머리 한쪽 날
    tube(M, (0.45, 0.13, z + 0.025), (0.45, 0.27, z + 0.025), 0.05, 0.0, mm, 0.5, 4, caps=False)
    obox(M, (0.45, 0.0, z), (0.14, 0.1, 0.07), 0, mm, 0.5)                                    # 머리 중심
    if g >= 3:
        obox(M, (0.45, -0.13, z), (0.2, 0.2, 0.05), 0, mm, 0.5)                              # 양날
    if gl is not None:
        obox(M, (0.45, 0.2, z + 0.05), (0.18, 0.05, 0.012), 0, gl, 0.5)
    _aura(C, g, gl, 0.62)


def loot_dagger(C, g):
    M = C.M
    mm, gm, gl = _tier(C, g)
    z = 0.06
    obox(M, (0.15, 0, z), (0.42, 0.07, 0.03), 0, mm, 0.5)
    tube(M, (0.36, 0, z + 0.015), (0.52, 0, z + 0.015), 0.04, 0.0, mm, 0.5, 4)
    if gl is not None:
        obox(M, (0.15, 0, z + 0.03), (0.38, 0.018, 0.01), 0, gl, 0.5)
    obox(M, (-0.07, 0, z - 0.005), (0.05, 0.2, 0.04), 0, mm, 0.5)
    tube(M, (-0.3, 0, z + 0.02), (-0.09, 0, z + 0.02), 0.024, 0.022, gm, 0.5, 6)
    _aura(C, g, gl, 0.45)


def loot_staff(C, g):
    M = C.M
    mm, gm, gl = _tier(C, g)
    z = 0.06
    tube(M, (-0.75, 0, z + 0.03), (0.7, 0, z + 0.03), 0.032, 0.028, gm, 0.5, 6)               # 지팡이 몸
    tube(M, (0.7, 0, z + 0.03), (0.78, 0, z + 0.03), 0.06, 0.045, mm, 0.5, 6)                 # 쇠 받침
    orb = gl if gl is not None else mm
    tube(M, (0.78, 0, z + 0.03), (0.98, 0, z + 0.03), 0.075, 0.0, orb, 0.5, 8)                # 보주(뾰족한 결정)
    tube(M, (0.78, 0, z + 0.03), (0.66, 0, z + 0.03), 0.075, 0.0, orb, 0.5, 8)
    for sy in (-1, 1):
        tube(M, (0.7, 0, z + 0.03), (0.86, sy * 0.1, z + 0.03), 0.014, 0.014, mm, 0.5, 4)    # 감싼 쇠 발톱
    _aura(C, g, gl, 0.75)


LOOT_FORMS = {'sword': loot_sword, 'axe': loot_axe, 'dagger': loot_dagger, 'staff': loot_staff}


def _loot(kind, g):
    def f(C):
        LOOT_FORMS[kind](C, g)
    f.__name__ = f'loot_{kind}_g{g}'
    return f


FIELD = {f.__name__: f for f in (
    wheat_sprout_01, wheat_growing_01, wheat_ripe_01, vegetable_row_01, reed_clump_01, scarecrow_01, stepping_stone_01, stepping_stone_02,
    rubble_pillar_01, rubble_wall_01, wall_block_01, plank_bridge_01, temple_roof_01)}
DKIT = {f.__name__: f for f in (_dkit(form, v) for form in DKIT_FORMS.values() for v in VARIANTS)}
LOOT = {f.__name__: f for f in (_loot(k, g) for k in LOOT_FORMS for g in range(5))}
ALL = {}
ALL.update(FIELD)
ALL.update(DKIT)
ALL.update(LOOT)


def tris_max(pid):
    return 2500 if pid in BIG2500 or pid in DKIT or pid in LOOT else 1500


if __name__ == '__main__':
    BP.PROPS.clear()
    BP.PROPS.update(ALL)
    style = arg('--style', 'real')
    if '--list' in A:
        print('FIELD', ' '.join(FIELD))
        print('DKIT', ' '.join(DKIT))
        print('LOOT', ' '.join(LOOT))
    elif '--all' in A:
        d = arg('--out-dir')
        for pid in ALL:
            BP.TRIS_MAX = tris_max(pid)
            BP.build(pid, os.path.join(d, pid + '.glb'), style)
    else:
        pid = arg('--id')
        BP.TRIS_MAX = tris_max(pid)
        BP.build(pid, arg('--out'), style)
