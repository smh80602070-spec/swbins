"""world-forge 건물 실내(3D) — 건물 12종마다 들어가는 방 한 칸(room 12) + 실내 물건(furniture 40) (K-0026). 재질만 Poly Haven CC0 사진.

  blender -b --factory-startup -P tools/world-forge/build_interior.py -- --id int_inn_01 --out <절대>/int_inn_01.glb [--style toon]
  blender -b --factory-startup -P tools/world-forge/build_interior.py -- --all --out-dir <절대 폴더> [--style toon]
  blender -b --factory-startup -P tools/world-forge/build_interior.py -- --list

원점 = 바닥 가운데, 단위 미터, z 위. `data/set_plan.json` 의 `interior`(방)·`furniture`(물건) 목록과 같은 id.
방 크기 3종 — 소 4×4 · 중 6×5 · 대 9×7 m, 높이 3.0(전각·헛간 4.2). 문은 남쪽(-y) 벽 가운데, 창은 동서(대형은 북쪽도).
GLB 안 빈 노드 규약(엔진이 이름으로 찾는다): 방 = `spawn_in`(들어와 서는 자리)·`door_out`(나가는 문 앞)·`light_0..`(천장 조명 자리)·`col_room`(방 안 크기 상자),
물건 = `use_point`(상호작용 자리)·`col_box`(충돌 상자, 크기 = 노드 scale). 노드는 메시와 한 파일에 같이 실린다.
"""
import json
import math
import os
import sys

import bpy
from mathutils import Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import build_prop as BP  # noqa: E402
import wf_common as W  # noqa: E402
from build_prop import tube, obox, gable, A, arg  # noqa: E402

BP.TRIS_MAX = 2500
BP.GENERATOR = 'tools/world-forge/build_interior.py'
SIZES = {'S': (4.0, 4.0), 'M': (6.0, 5.0), 'L': (9.0, 7.0)}
NODES = []                                                       # 이번 빌드에서 만든 (이름, 위치, scale|None)


def node(name, pos, scale=None):
    NODES.append((name, tuple(pos), scale))


# ---------------------------------------------------------------- 방

# 건물 id → (방 크기, 높이, 바닥 재질(tile,tint), 벽 재질(tile,tint), 천장 재질, 보 여부, 부가)
ROOMS = {
    'int_eu_house_01': ('M', 3.0, ('brown_planks_03', 1.2, '#7a5a3c'), ('clay_plaster', 2.0, '#d9c7a4'), ('brown_planks_03', 1.2, '#5a3f2b'), True, 'hearth'),
    'int_modern_block_01': ('M', 3.0, ('brown_planks_03', 1.4, '#a88a64'), ('white_stucco', 2.0, '#e8e6e0'), ('white_stucco', 2.0, '#f2f1ec'), False, 'strip'),
    'int_future_dome_01': ('M', 3.0, ('concrete_wall_001', 1.5, '#aab4c0'), ('white_stucco', 2.0, '#d6e0ee'), ('white_stucco', 2.0, '#eaf2fc'), False, 'glow'),
    'int_stone_tower_01': ('S', 3.2, ('cobblestone_floor_01', 1.2, '#8f8a80'), ('castle_wall_slates', 1.5, '#9b968c'), ('brown_planks_03', 1.2, '#4f3a28'), True, 'torch'),
    'int_chinese_hall_01': ('L', 4.2, ('cobblestone_floor_01', 1.6, '#6e6a64'), ('clay_plaster', 2.0, '#b8956a'), ('brown_planks_03', 1.2, '#6a2a1e'), True, 'pillars'),
    'int_dungeon_gate_01': ('M', 3.0, ('cobblestone_floor_01', 1.4, '#6f6b64'), ('castle_wall_slates', 1.5, '#7f7a72'), ('castle_wall_slates', 1.5, '#5f5b55'), False, 'torch'),
    'int_forest_cottage_01': ('S', 2.7, ('brown_planks_03', 1.2, '#6a4c32'), ('clay_plaster', 2.0, '#cdb892'), ('thatch_roof_angled', 1.5, '#8a6a3a'), True, 'hearth'),
    'int_inn_01': ('L', 3.2, ('brown_planks_03', 1.4, '#6c4c30'), ('beam_wall_01', 2.4, '#e1cfb2'), ('brown_planks_03', 1.2, '#4a3220'), True, 'hearth'),
    'int_barn_01': ('L', 4.2, ('dry_ground_01', 2.0, '#7a6648'), ('brown_planks_03', 1.6, '#8a5a3c'), ('brown_planks_03', 1.2, '#5a3a28'), True, 'loft'),
    'int_hanok_01': ('M', 3.0, ('brown_planks_03', 1.2, '#a67c52'), ('white_stucco', 2.0, '#efe6d2'), ('brown_planks_03', 1.2, '#7a5236'), True, 'paper'),
    'int_jp_minka_01': ('M', 3.2, ('brown_planks_03', 1.3, '#8a6a42'), ('clay_plaster', 2.0, '#c9b38b'), ('thatch_roof_angled', 1.5, '#7a5e34'), True, 'hearth'),
    'int_silkroad_house_01': ('M', 3.0, ('dry_ground_01', 1.6, '#a88a5e'), ('clay_plaster', 2.0, '#d3b88c'), ('clay_plaster', 2.0, '#b99c6e'), False, 'arch'),
}


def wall_run(M, p0, p1, thick, h, openings, slot, tile=1.5):
    """p0→p1 직선 벽(축에 나란함) — openings = [(중심 거리, 폭, 아래 z, 위 z)] 가 뚫린다. 구멍 위·아래는 보로 메운다."""
    p0, p1 = Vector(p0), Vector(p1)
    d = p1 - p0
    L = d.length
    u = d.normalized()
    yaw = 0 if abs(u.x) > 0.5 else 90
    pts = []
    t = 0.0
    for c, w, z0, z1 in sorted(openings):
        a, b = c - w / 2, c + w / 2
        if a > t:
            pts.append((t, a, 0.0, h))
        if z0 > 0:
            pts.append((a, b, 0.0, z0))
        if z1 < h:
            pts.append((a, b, z1, h))
        t = b
    if t < L:
        pts.append((t, L, 0.0, h))
    for a, b, z0, z1 in pts:
        mid = p0 + u * ((a + b) / 2)
        obox(M, (mid.x, mid.y, z0), (b - a, thick, z1 - z0) if yaw == 0 else (b - a, thick, z1 - z0), yaw, slot, tile)


def room(C, rid):
    size, h, fl, wl, ce, beams, extra = ROOMS[rid]
    w, d = SIZES[size]
    M = C.M
    sf = C.s(fl[0], fl[1], fl[2])
    sw = C.s(wl[0], wl[1], wl[2])
    sc = C.s(ce[0], ce[1], ce[2])
    sb = C.s('brown_planks_03', 1.0, '#3e2a1c')                                    # 걸레받이·문틀
    th = 0.2
    hw, hd = w / 2, d / 2
    obox(M, (0, 0, -0.12), (w + th * 2, d + th * 2, 0.12), 0, sf, fl[1])                  # 바닥
    obox(M, (0, 0, h), (w + th * 2, d + th * 2, 0.14), 0, sc, ce[1])                      # 천장
    win = lambda c: (c, 1.2, 1.0, 2.0)
    wall_run(M, (-hw - th / 2, -hd - th / 2 + 0.0), (hw + th / 2, -hd - th / 2), th, h, [(hw + th / 2, 1.3, 0.0, 2.2)], sw, wl[1])           # 남쪽(문)
    wall_run(M, (-hw - th / 2, hd + th / 2), (hw + th / 2, hd + th / 2), th, h, [win(w / 3), win(w * 2 / 3)] if size == 'L' else [], sw, wl[1])  # 북쪽
    wall_run(M, (-hw - th / 2, -hd - th / 2), (-hw - th / 2, hd + th / 2), th, h, [win(d / 2)] if extra not in ('hearth',) else [], sw, wl[1])      # 서쪽
    wall_run(M, (hw + th / 2, -hd - th / 2), (hw + th / 2, hd + th / 2), th, h, [win(d / 2)], sw, wl[1])                                          # 동쪽
    for k in (0, 1):                                                                    # 걸레받이(안쪽)
        obox(M, (0, (-hd + 0.03) if k == 0 else (hd - 0.03), 0), (w, 0.06, 0.12), 0, sb, 1.0)
    for sx in (-1, 1):
        obox(M, (sx * (hw - 0.03), 0, 0), (0.06, d, 0.12), 0, sb, 1.0)
    obox(M, (0, -hd - th / 2, 0), (1.5, th + 0.05, 0.05), 0, sb, 1.0)                            # 문 문턱
    if beams:
        n = max(2, int(w // 1.6))
        for i in range(n + 1):
            x = -hw + w * i / n
            obox(M, (x, 0, h - 0.22), (0.2, d, 0.22), 0, sb, 1.0)
        obox(M, (0, 0, h - 0.22), (w, 0.22, 0.22), 0, sb, 1.0)
    glow = C.s('white_stucco', 1.0, '#ffe7a8', gain=1.5)
    if extra == 'pillars':
        for sx in (-1, 1):
            for sy in (-1, 0, 1):
                tube(M, (sx * (hw - 1.2), sy * (hd - 1.4), 0), (sx * (hw - 1.2), sy * (hd - 1.4), h - 0.15), 0.28, 0.25, C.s('brown_planks_03', 1.0, '#8a2a1e'), 1.0, 8)
    elif extra == 'strip' or extra == 'glow':
        gm = C.s('white_stucco', 1.0, '#9fd8ff' if extra == 'glow' else '#fff4d8', gain=1.7)
        obox(M, (0, 0, h - 0.04), (w * 0.6, 0.2, 0.04), 0, gm, 1.0)
    elif extra == 'loft':
        obox(M, (0, hd - 1.4, 2.4), (w, 2.8, 0.14), 0, C.s('brown_planks_03', 1.2, '#6a4a30'), 1.2)       # 위층 마루(북쪽 반)
        for sx in (-1, 1):
            obox(M, (sx * (hw - 0.3), hd - 2.6, 0), (0.22, 0.22, 2.4), 0, sb, 1.0)
    elif extra == 'arch':
        for sx in (-1, 1):
            tube(M, (sx * 0.85, -hd + 0.05, 2.1), (sx * 0.85, -hd + 0.05, 2.3), 0.22, 0.22, sw, 1.0, 8)
    elif extra == 'hearth':
        st = C.s('castle_wall_slates', 1.5, '#8a8478')
        obox(M, (-hw + 0.5, 0, 0), (0.9, 1.8, 1.0), 0, st, 1.2)
        obox(M, (-hw + 0.35, 0, 1.0), (0.6, 1.3, 1.6), 0, st, 1.2)
    elif extra == 'paper':
        pm = C.s('white_stucco', 1.0, '#f4eddc')
        obox(M, (0, hd - 0.12, 0.3), (w - 0.6, 0.05, 2.1), 0, pm, 1.0)
    for i, (lx, ly) in enumerate(((-w / 4, -d / 4), (w / 4, d / 4)) if size != 'L' else ((-w / 4, 0), (w / 4, 0), (0, d / 3))):
        obox(M, (lx, ly, h - 0.5), (0.28, 0.28, 0.3), 0, glow, 1.0)                              # 조명 갓(발광)
        node(f'light_{i}', (lx, ly, h - 0.55))
    node('spawn_in', (0, -hd + 1.2, 0))
    node('door_out', (0, -hd - th - 0.6, 0))
    node('col_room', (0, 0, h / 2), (w, d, h))


# ---------------------------------------------------------------- 물건

def wd(C, tint=None):
    return C.s('brown_planks_03', 1.0, tint)


def dk(C):
    return C.s('black_painted_planks', 1.0)


def metal(C, tint='#3a3d44'):
    return C.s('concrete_wall_001', 1.0, tint)


def cloth(C, tint):
    return C.s('white_stucco', 1.0, tint)


def glowm(C, tint='#ffe7a8', gain=1.6):
    return C.s('white_stucco', 1.0, tint, gain=gain)


def table_wood_01(C):
    M, w = C.M, wd(C)
    obox(M, (0, 0, 0.72), (1.4, 0.8, 0.07), 0, w)
    for sx in (-1, 1):
        for sy in (-1, 1):
            obox(M, (sx * 0.62, sy * 0.32, 0), (0.08, 0.08, 0.72), 0, dk(C))
    node('use_point', (0, -0.6, 0))


def table_round_01(C):
    M = C.M
    tube(M, (0, 0, 0.7), (0, 0, 0.76), 0.55, 0.55, wd(C), 1.0, 12)
    tube(M, (0, 0, 0.0), (0, 0, 0.7), 0.1, 0.08, dk(C), 1.0, 8)
    tube(M, (0, 0, 0.0), (0, 0, 0.04), 0.35, 0.35, dk(C), 1.0, 10)
    node('use_point', (0, -0.8, 0))


def chair_wood_01(C):
    M, w = C.M, wd(C)
    obox(M, (0, 0, 0.45), (0.42, 0.42, 0.05), 0, w)
    for sx in (-1, 1):
        for sy in (-1, 1):
            obox(M, (sx * 0.17, sy * 0.17, 0), (0.05, 0.05, 0.45), 0, dk(C))
    obox(M, (0, 0.19, 0.5), (0.42, 0.05, 0.5), 0, w)
    node('use_point', (0, -0.4, 0))


def stool_01(C):
    M = C.M
    tube(M, (0, 0, 0.42), (0, 0, 0.47), 0.2, 0.2, wd(C), 1.0, 8)
    for k in range(3):
        a = 2 * math.pi * k / 3
        tube(M, (math.cos(a) * 0.14, math.sin(a) * 0.14, 0.42), (math.cos(a) * 0.2, math.sin(a) * 0.2, 0.0), 0.03, 0.025, dk(C), 1.0, 5)
    node('use_point', (0, -0.35, 0))


def bed_wood_01(C):
    M, w = C.M, wd(C)
    obox(M, (0, 0, 0.25), (0.95, 1.95, 0.18), 0, w)
    obox(M, (0, 0.02, 0.43), (0.85, 1.85, 0.16), 0, cloth(C, '#d8cdb8'))
    obox(M, (0, 0.65, 0.59), (0.55, 0.35, 0.10), 0, cloth(C, '#efe8d8'))
    obox(M, (0, -0.2, 0.59), (0.85, 1.1, 0.05), 0, cloth(C, '#7a3a34'))
    obox(M, (0, 0.98, 0), (0.95, 0.07, 0.9), 0, w)
    obox(M, (0, -0.98, 0), (0.95, 0.07, 0.5), 0, w)
    node('use_point', (0.75, 0, 0))


def bed_futon_01(C):
    M = C.M
    obox(M, (0, 0, 0), (0.95, 1.9, 0.1), 0, cloth(C, '#c8b898'))
    obox(M, (0, -0.1, 0.1), (0.85, 1.5, 0.05), 0, cloth(C, '#4a5f86'))
    obox(M, (0, 0.72, 0.1), (0.5, 0.32, 0.09), 0, cloth(C, '#efe8d8'))
    node('use_point', (0.7, 0, 0))


def shelf_wall_01(C):
    M, w = C.M, wd(C)
    for z in (0.5, 1.0, 1.5):
        obox(M, (0, 0, z), (1.2, 0.25, 0.04), 0, w)
    for sx in (-1, 1):
        obox(M, (sx * 0.58, 0, 0.3), (0.04, 0.25, 1.4), 0, dk(C))
    for x, z, h in ((-0.4, 0.54, 0.2), (0.0, 0.54, 0.16), (0.35, 0.54, 0.24), (-0.2, 1.04, 0.22), (0.3, 1.04, 0.18)):
        obox(M, (x, 0, z), (0.18, 0.15, h), 0, cloth(C, '#8a6a4a'))
    node('use_point', (0, -0.6, 0))


def bookshelf_01(C):
    M, w = C.M, wd(C)
    obox(M, (0, 0, 0), (1.0, 0.35, 2.0), 0, w)
    for z in (0.35, 0.75, 1.15, 1.55):
        obox(M, (0, -0.02, z), (0.92, 0.32, 0.03), 0, dk(C))
    cols = ['#8a3a30', '#3a5a86', '#4a7a4a', '#a08a4a', '#6a4a7a']
    for z in (0.38, 0.78, 1.18, 1.58):
        for k in range(6):
            obox(M, (-0.4 + k * 0.16, -0.05, z), (0.1, 0.24, 0.28 + 0.03 * (k % 3)), 0, cloth(C, cols[(k + int(z * 10)) % 5]))
    node('use_point', (0, -0.7, 0))


def hearth_stone_01(C):
    M = C.M
    st = C.s('castle_wall_slates', 1.5, '#8a8478')
    obox(M, (0, 0, 0), (1.6, 0.8, 0.3), 0, st, 1.2)
    obox(M, (-0.7, 0.0, 0.3), (0.2, 0.7, 1.4), 0, st, 1.2)
    obox(M, (0.7, 0.0, 0.3), (0.2, 0.7, 1.4), 0, st, 1.2)
    obox(M, (0, 0, 1.7), (1.8, 0.8, 0.3), 0, st, 1.2)
    obox(M, (0, 0.15, 1.9), (0.9, 0.5, 0.9), 0, st, 1.2)
    for k in range(3):
        tube(M, (-0.3 + k * 0.3, 0.0, 0.32), (-0.2 + k * 0.28, 0.05, 0.6), 0.06, 0.05, wd(C, '#4a3626'), 0.6, 5)
    tube(M, (0, 0.0, 0.32), (0, 0.0, 0.5), 0.16, 0.0, glowm(C, '#ff8a2a', 1.7), 0.5, 6)
    node('use_point', (0, -0.8, 0))


def stove_iron_01(C):
    M = C.M
    m = metal(C, '#2c2e33')
    obox(M, (0, 0, 0.1), (0.6, 0.5, 0.7), 0, m)
    for sx in (-1, 1):
        for sy in (-1, 1):
            obox(M, (sx * 0.25, sy * 0.2, 0), (0.06, 0.06, 0.1), 0, m)
    tube(M, (0.15, 0.0, 0.8), (0.15, 0.0, 2.2), 0.07, 0.07, m, 1.0, 7)
    obox(M, (0, -0.255, 0.3), (0.3, 0.02, 0.25), 0, glowm(C, '#ff8a2a', 1.6))
    node('use_point', (0, -0.6, 0))


def trunk_01(C):
    M = C.M
    obox(M, (0, 0, 0), (0.9, 0.5, 0.45), 0, wd(C, '#5a3f2b'))
    tube(M, (-0.45, 0, 0.45), (0.45, 0, 0.45), 0.25, 0.25, wd(C, '#5a3f2b'), 0.8, 8)
    for x in (-0.28, 0.28):
        obox(M, (x, 0, 0), (0.07, 0.52, 0.45), 0, metal(C))
    obox(M, (0, -0.26, 0.28), (0.1, 0.03, 0.12), 0, cloth(C, '#c9a24a'))
    node('use_point', (0, -0.55, 0))


def crate_small_01(C):
    M = C.M
    obox(M, (0, 0, 0), (0.5, 0.5, 0.45), 0, wd(C))
    for sx in (-1, 1):
        for sy in (-1, 1):
            obox(M, (sx * 0.23, sy * 0.23, 0), (0.06, 0.06, 0.46), 0, dk(C))
    node('use_point', (0, -0.45, 0))


def counter_01(C):
    M, w = C.M, wd(C)
    obox(M, (0, 0, 0), (2.0, 0.65, 1.0), 0, w)
    obox(M, (0, 0, 1.0), (2.1, 0.75, 0.06), 0, dk(C))
    obox(M, (0.6, 0.0, 1.06), (0.3, 0.25, 0.2), 0, metal(C, '#8a7a4a'))
    node('use_point', (0, -0.7, 0))


def display_stand_01(C):
    M = C.M
    obox(M, (0, 0, 0), (1.0, 0.6, 0.8), 0, wd(C))
    obox(M, (0, 0, 0.8), (1.05, 0.65, 0.05), 0, cloth(C, '#5a2a30'))
    for x, h in ((-0.3, 0.2), (0.0, 0.14), (0.3, 0.18)):
        tube(M, (x, 0, 0.85), (x, 0, 0.85 + h), 0.07, 0.06, glowm(C, '#e0b84a', 1.2), 0.5, 6)
    node('use_point', (0, -0.55, 0))


def mirror_stand_01(C):
    M = C.M
    obox(M, (0, 0, 0), (0.7, 0.3, 0.06), 0, dk(C))
    for sx in (-1, 1):
        obox(M, (sx * 0.3, 0, 0.0), (0.06, 0.06, 1.7), 0, dk(C))
    obox(M, (0, 0, 0.35), (0.58, 0.03, 1.2), 0, glowm(C, '#cfe3ee', 1.0))
    node('use_point', (0, -0.5, 0))


def vase_tall_01(C):
    M = C.M
    c = C.s('clay_plaster', 0.8, '#7a8aa8')
    tube(M, (0, 0, 0), (0, 0, 0.3), 0.12, 0.2, c, 0.8, 8)
    tube(M, (0, 0, 0.3), (0, 0, 0.7), 0.2, 0.14, c, 0.8, 8)
    tube(M, (0, 0, 0.7), (0, 0, 0.95), 0.14, 0.08, c, 0.8, 8)
    tube(M, (0, 0, 0.95), (0, 0, 1.05), 0.12, 0.12, c, 0.8, 8)
    node('use_point', (0, -0.4, 0))


def candlestick_01(C):
    M = C.M
    m = metal(C, '#8a7a4a')
    tube(M, (0, 0, 0), (0, 0, 0.04), 0.1, 0.1, m, 0.5, 8)
    tube(M, (0, 0, 0.04), (0, 0, 0.5), 0.025, 0.02, m, 0.5, 6)
    tube(M, (0, 0, 0.5), (0, 0, 0.56), 0.06, 0.06, m, 0.5, 8)
    tube(M, (0, 0, 0.56), (0, 0, 0.78), 0.03, 0.03, cloth(C, '#efe8d0'), 0.5, 6)
    tube(M, (0, 0, 0.78), (0, 0, 0.88), 0.03, 0.0, glowm(C, '#ffb84a', 1.8), 0.5, 5)
    node('use_point', (0, -0.3, 0))


def rug_rect_01(C):
    M = C.M
    obox(M, (0, 0, 0), (2.0, 1.4, 0.025), 0, cloth(C, '#8a3a34'))
    obox(M, (0, 0, 0.025), (1.7, 1.1, 0.012), 0, cloth(C, '#d8b86a'))
    obox(M, (0, 0, 0.037), (1.4, 0.8, 0.008), 0, cloth(C, '#4a5a86'))
    node('use_point', (0, -0.9, 0))


def rug_round_01(C):
    M = C.M
    tube(M, (0, 0, 0), (0, 0, 0.025), 0.9, 0.9, cloth(C, '#4a6a4a'), 1.0, 16)
    tube(M, (0, 0, 0.025), (0, 0, 0.037), 0.65, 0.65, cloth(C, '#d8c890'), 1.0, 16)
    tube(M, (0, 0, 0.037), (0, 0, 0.047), 0.35, 0.35, cloth(C, '#8a3a34'), 1.0, 16)
    node('use_point', (0, -1.0, 0))


def oil_lamp_01(C):
    M = C.M
    m = metal(C, '#6a5a3a')
    tube(M, (0, 0, 0), (0, 0, 0.05), 0.12, 0.1, m, 0.5, 8)
    tube(M, (0, 0, 0.05), (0, 0, 0.16), 0.1, 0.12, m, 0.5, 8)
    tube(M, (0, 0, 0.16), (0, 0, 0.2), 0.12, 0.05, m, 0.5, 8)
    tube(M, (0, 0, 0.2), (0, 0, 0.32), 0.03, 0.0, glowm(C, '#ffb84a', 1.8), 0.5, 5)
    obox(M, (0.13, 0, 0.1), (0.1, 0.03, 0.03), 0, m)
    node('use_point', (0, -0.25, 0))


def table_lamp_01(C):
    M = C.M
    m = metal(C, '#2c2e33')
    tube(M, (0, 0, 0), (0, 0, 0.03), 0.12, 0.12, m, 0.5, 8)
    tube(M, (0, 0, 0.03), (0, 0, 0.38), 0.02, 0.02, m, 0.5, 6)
    tube(M, (0, 0, 0.36), (0, 0, 0.58), 0.1, 0.17, glowm(C, '#fff0c8', 1.5), 0.5, 10)
    node('use_point', (0, -0.3, 0))


def holo_panel_01(C):
    M = C.M
    m = metal(C, '#2c3440')
    tube(M, (0, 0, 0), (0, 0, 0.06), 0.18, 0.15, m, 0.5, 8)
    tube(M, (0, 0, 0.06), (0, 0, 0.9), 0.03, 0.03, m, 0.5, 6)
    obox(M, (0, 0, 0.9), (0.7, 0.03, 0.5), 0, glowm(C, '#58e3ff', 1.8))
    obox(M, (0, 0, 0.88), (0.76, 0.05, 0.03), 0, m)
    node('use_point', (0, -0.4, 0))


def sofa_01(C):
    M = C.M
    c = cloth(C, '#6a4a3a')
    obox(M, (0, 0, 0.1), (1.9, 0.8, 0.35), 0, c)
    obox(M, (0, 0.3, 0.45), (1.9, 0.2, 0.5), 0, c)
    for sx in (-1, 1):
        obox(M, (sx * 0.88, 0, 0.1), (0.14, 0.8, 0.55), 0, c)
    obox(M, (0, -0.05, 0.45), (1.55, 0.55, 0.12), 0, cloth(C, '#7a5a4a'))
    for sx in (-1, 1):
        obox(M, (sx * 0.85, -0.3, 0), (0.06, 0.06, 0.1), 0, dk(C))
    node('use_point', (0, -0.7, 0))


def desk_01(C):
    M, w = C.M, wd(C, '#6a4a30')
    obox(M, (0, 0, 0.7), (1.3, 0.65, 0.05), 0, w)
    obox(M, (-0.5, 0, 0), (0.3, 0.6, 0.7), 0, w)
    obox(M, (0.58, 0, 0), (0.06, 0.6, 0.7), 0, dk(C))
    for z in (0.15, 0.4):
        obox(M, (-0.5, -0.31, z), (0.24, 0.02, 0.18), 0, dk(C))
    node('use_point', (0.2, -0.65, 0))


def wardrobe_01(C):
    M, w = C.M, wd(C, '#6a4a30')
    obox(M, (0, 0, 0), (1.1, 0.55, 1.9), 0, w)
    obox(M, (0, -0.28, 0.05), (0.02, 0.02, 1.8), 0, dk(C))
    for sx in (-1, 1):
        obox(M, (sx * 0.1, -0.29, 0.9), (0.04, 0.04, 0.14), 0, metal(C, '#8a7a4a'))
    node('use_point', (0, -0.7, 0))


def cabinet_low_01(C):
    M, w = C.M, wd(C)
    obox(M, (0, 0, 0), (1.3, 0.45, 0.85), 0, w)
    obox(M, (0, 0, 0.85), (1.36, 0.5, 0.04), 0, dk(C))
    for sx in (-1, 1):
        obox(M, (sx * 0.33, -0.23, 0.2), (0.5, 0.02, 0.5), 0, dk(C))
    node('use_point', (0, -0.6, 0))


def kitchen_pot_01(C):
    M = C.M
    m = metal(C, '#2c2e33')
    for k in range(3):
        a = 2 * math.pi * k / 3
        tube(M, (math.cos(a) * 0.5, math.sin(a) * 0.5, 0), (0, 0, 1.3), 0.025, 0.025, dk(C), 0.5, 5)
    tube(M, (0, 0, 0.55), (0, 0, 1.0), 0.03, 0.03, m, 0.5, 5)
    tube(M, (0, 0, 0.35), (0, 0, 0.55), 0.22, 0.1, m, 0.5, 10)
    tube(M, (0, 0, 0.55), (0, 0, 0.58), 0.22, 0.2, m, 0.5, 10)
    tube(M, (0, 0, 0.0), (0, 0, 0.05), 0.3, 0.3, glowm(C, '#ff8a2a', 1.4), 0.5, 8)
    node('use_point', (0, -0.7, 0))


def keg_01(C):
    M = C.M
    w, h = wd(C, '#6a4a30'), metal(C)
    tube(M, (0, 0, 0), (0, 0, 0.3), 0.22, 0.28, w, 0.7, 10)
    tube(M, (0, 0, 0.3), (0, 0, 0.6), 0.28, 0.22, w, 0.7, 10)
    for z in (0.08, 0.5):
        tube(M, (0, 0, z - 0.02), (0, 0, z + 0.02), 0.255, 0.255, h, 1.0, 10, caps=False)
    tube(M, (0, -0.26, 0.2), (0, -0.4, 0.18), 0.03, 0.03, metal(C, '#8a7a4a'), 0.5, 5)
    node('use_point', (0, -0.55, 0))


def spinning_wheel_01(C):
    M, w = C.M, wd(C)
    for sx in (-1, 1):
        tube(M, (sx * 0.2, 0, 0), (sx * 0.1, 0, 0.75), 0.03, 0.025, w, 0.5, 5)
    obox(M, (0, 0, 0.0), (0.6, 0.12, 0.04), 0, w)
    for k in range(10):
        a0, a1 = 2 * math.pi * k / 10, 2 * math.pi * (k + 1) / 10
        tube(M, (0, 0.1 + math.cos(a0) * 0.3, 0.7 + math.sin(a0) * 0.3), (0, 0.1 + math.cos(a1) * 0.3, 0.7 + math.sin(a1) * 0.3), 0.025, 0.025, w, 0.5, 4, caps=False)
    for k in range(5):
        a = 2 * math.pi * k / 5
        tube(M, (0, 0.1, 0.7), (0, 0.1 + math.cos(a) * 0.3, 0.7 + math.sin(a) * 0.3), 0.012, 0.012, w, 0.5, 4)
    obox(M, (0.0, -0.3, 0.55), (0.04, 0.5, 0.04), 0, w)
    node('use_point', (0, -0.6, 0))


def cushion_01(C):
    M = C.M
    c = cloth(C, '#9a3a34')
    tube(M, (0, 0, 0), (0, 0, 0.08), 0.28, 0.3, c, 0.5, 10)
    tube(M, (0, 0, 0.08), (0, 0, 0.12), 0.3, 0.22, c, 0.5, 10)
    node('use_point', (0, -0.4, 0))


def low_table_01(C):
    M, w = C.M, wd(C, '#7a5236')
    obox(M, (0, 0, 0.3), (1.0, 0.6, 0.05), 0, w)
    for sx in (-1, 1):
        for sy in (-1, 1):
            obox(M, (sx * 0.42, sy * 0.24, 0), (0.07, 0.07, 0.3), 0, w)
    node('use_point', (0, -0.5, 0))


def screen_folding_01(C):
    M = C.M
    p = cloth(C, '#e8dcc0')
    for k in range(4):
        x = -0.6 + k * 0.4
        yaw = 12 if k % 2 == 0 else -12
        obox(M, (x, 0.04 * (k % 2), 0), (0.4, 0.04, 1.7), yaw, p, 1.0)
        obox(M, (x, 0.04 * (k % 2), 0), (0.42, 0.05, 0.06), yaw, dk(C), 1.0)
        obox(M, (x, 0.04 * (k % 2), 1.64), (0.42, 0.05, 0.06), yaw, dk(C), 1.0)
    node('use_point', (0, -0.6, 0))


def tatami_mat_01(C):
    M = C.M
    obox(M, (0, 0, 0), (1.8, 0.9, 0.05), 0, cloth(C, '#b8b078'))
    obox(M, (0, 0.44, 0.0), (1.8, 0.04, 0.052), 0, dk(C))
    obox(M, (0, -0.44, 0.0), (1.8, 0.04, 0.052), 0, dk(C))
    node('use_point', (0, -0.7, 0))


def hanging_lantern_01(C):
    M = C.M
    m = metal(C, '#4a3a2a')
    tube(M, (0, 0, 1.0), (0, 0, 1.5), 0.01, 0.01, m, 0.5, 4)
    obox(M, (0, 0, 0.75), (0.3, 0.3, 0.05), 0, m)
    obox(M, (0, 0, 0.8), (0.24, 0.24, 0.3), 0, glowm(C, '#ffb84a', 1.5))
    tube(M, (0, 0, 1.1), (0, 0, 1.2), 0.2, 0.05, m, 0.5, 8)
    node('use_point', (0, 0, 0.7))


def weapon_rack_01(C):
    M, w = C.M, wd(C, '#5a3f2b')
    for sx in (-1, 1):
        obox(M, (sx * 0.7, 0, 0), (0.08, 0.35, 1.6), 0, w)
    obox(M, (0, 0, 0.5), (1.4, 0.1, 0.06), 0, w)
    obox(M, (0, 0, 1.1), (1.4, 0.1, 0.06), 0, w)
    m = metal(C, '#8d8f94')
    for x in (-0.4, -0.1, 0.25):
        tube(M, (x, 0.02, 0.45), (x + 0.02, 0.02, 1.5), 0.02, 0.015, m, 0.5, 5)
    node('use_point', (0, -0.5, 0))


def armor_stand_01(C):
    M = C.M
    m = metal(C, '#8d8f94')
    obox(M, (0, 0, 0), (0.5, 0.5, 0.05), 0, dk(C))
    tube(M, (0, 0, 0.05), (0, 0, 1.1), 0.03, 0.03, dk(C), 0.5, 5)
    tube(M, (0, 0, 0.7), (0, 0, 1.25), 0.2, 0.23, m, 0.8, 8)
    tube(M, (0, 0, 1.25), (0, 0, 1.4), 0.23, 0.1, m, 0.8, 8)
    tube(M, (0, 0, 1.45), (0, 0, 1.68), 0.12, 0.12, m, 0.8, 8)
    node('use_point', (0, -0.5, 0))


def map_table_01(C):
    M, w = C.M, wd(C, '#6a4a30')
    obox(M, (0, 0, 0.78), (1.5, 1.0, 0.06), 0, w)
    obox(M, (0, 0, 0.84), (1.3, 0.8, 0.012), 0, cloth(C, '#d8c898'))
    for sx in (-1, 1):
        for sy in (-1, 1):
            obox(M, (sx * 0.65, sy * 0.4, 0), (0.1, 0.1, 0.78), 0, dk(C))
    obox(M, (0.25, 0.1, 0.85), (0.12, 0.08, 0.04), 0, cloth(C, '#8a3a34'))
    node('use_point', (0, -0.8, 0))


def globe_stand_01(C):
    M = C.M
    tube(M, (0, 0, 0), (0, 0, 0.05), 0.2, 0.18, dk(C), 0.5, 8)
    tube(M, (0, 0, 0.05), (0, 0, 0.9), 0.03, 0.03, dk(C), 0.5, 5)
    BP_blob = C.s('clay_plaster', 0.8, '#4a6a8a')
    for z, r in ((0.9, 0.12), (1.0, 0.2), (1.12, 0.24), (1.24, 0.2), (1.34, 0.12)):
        tube(M, (0, 0, z), (0, 0, z + 0.1), r, r, BP_blob, 0.8, 10, caps=False)
    tube(M, (0, 0, 0.88), (0, 0, 0.9), 0.12, 0.12, BP_blob, 0.8, 10)
    tube(M, (0, 0, 1.44), (0, 0, 1.46), 0.12, 0.12, BP_blob, 0.8, 10)
    node('use_point', (0, -0.5, 0))


def hologram_globe_01(C):
    M = C.M
    m = metal(C, '#2c3440')
    tube(M, (0, 0, 0), (0, 0, 0.12), 0.28, 0.22, m, 0.5, 10)
    g = glowm(C, '#58e3ff', 1.8)
    for z, r in ((0.5, 0.1), (0.62, 0.18), (0.76, 0.22), (0.9, 0.18), (1.02, 0.1)):
        tube(M, (0, 0, z), (0, 0, z + 0.12), r, r, g, 0.5, 10, caps=False)
    tube(M, (0, 0, 0.12), (0, 0, 0.5), 0.02, 0.02, g, 0.5, 5)
    node('use_point', (0, -0.5, 0))


def terminal_01(C):
    M = C.M
    m = metal(C, '#2c3440')
    obox(M, (0, 0, 0), (0.7, 0.5, 0.9), 0, m)
    obox(M, (0, -0.1, 0.9), (0.7, 0.35, 0.05), 0, m)
    obox(M, (0, 0.22, 0.95), (0.6, 0.04, 0.5), 0, glowm(C, '#58e3ff', 1.6))
    obox(M, (0, -0.2, 0.93), (0.45, 0.14, 0.03), 0, glowm(C, '#ffe7a8', 1.2))
    node('use_point', (0, -0.6, 0))


def barrel_stack_01(C):
    M, w = C.M, wd(C, '#6a4a30')
    for x, y in ((-0.3, 0), (0.3, 0), (0.0, 0.0)):
        z0 = 0.0 if abs(x) > 0.1 else 0.55
        yy = y if z0 == 0.0 else 0.0
        tube(M, (x, yy, z0), (x, yy, z0 + 0.5), 0.26, 0.26, w, 0.7, 10)
        tube(M, (x, yy, z0 + 0.12), (x, yy, z0 + 0.16), 0.275, 0.275, metal(C), 1.0, 10, caps=False)
        tube(M, (x, yy, z0 + 0.36), (x, yy, z0 + 0.4), 0.275, 0.275, metal(C), 1.0, 10, caps=False)
    node('use_point', (0, -0.7, 0))


def hay_bale_01(C):
    M = C.M
    h = C.s('thatch_roof_angled', 1.0, '#b79a4a')
    obox(M, (0, 0, 0), (0.9, 0.5, 0.45), 0, h)
    for x in (-0.25, 0.25):
        obox(M, (x, 0, 0), (0.03, 0.52, 0.47), 0, dk(C))
    node('use_point', (0, -0.5, 0))


FURNITURE = {f.__name__: f for f in (
    table_wood_01, table_round_01, chair_wood_01, stool_01, bed_wood_01, bed_futon_01, shelf_wall_01, bookshelf_01, hearth_stone_01, stove_iron_01,
    trunk_01, crate_small_01, counter_01, display_stand_01, mirror_stand_01, vase_tall_01, candlestick_01, rug_rect_01, rug_round_01, oil_lamp_01,
    table_lamp_01, holo_panel_01, sofa_01, desk_01, wardrobe_01, cabinet_low_01, kitchen_pot_01, keg_01, spinning_wheel_01, cushion_01,
    low_table_01, screen_folding_01, tatami_mat_01, hanging_lantern_01, weapon_rack_01, armor_stand_01, map_table_01, globe_stand_01,
    hologram_globe_01, terminal_01)}
ROOM_FN = {rid: (lambda C, r=rid: room(C, r)) for rid in ROOMS}
ALL = {}
ALL.update({rid: fn for rid, fn in ROOM_FN.items()})
ALL.update(FURNITURE)


def build_scene(pid, out, style):
    """BP.build 와 같되 빈 노드(spawn_in·use_point·col_box …)를 메시와 같은 GLB 에 싣는다."""
    del NODES[:]
    bpy.ops.wm.read_factory_settings(use_empty=True)
    W._mat_cache.clear()
    W.set_style(style)
    C = BP.Ctx(pid)
    ALL[pid](C)
    ob = C.M.build()
    tris = sum(len(p.vertices) - 2 for p in ob.data.polygons)
    pts = [Vector(c) for c in ob.bound_box]
    lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
    hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    size = [round(hi[i] - lo[i], 2) for i in range(3)]
    objs = [ob]
    if pid in FURNITURE:                                                                # 물건: 충돌 상자 = 메시 바운딩 박스
        NODES.append(('col_box', ((lo.x + hi.x) / 2, (lo.y + hi.y) / 2, (lo.z + hi.z) / 2), (size[0], size[1], size[2])))
    for name, pos, scale in NODES:
        e = bpy.data.objects.new(name, None)
        e.empty_display_type = 'CUBE' if scale else 'ARROWS'
        e.empty_display_size = 0.5 if scale else 0.2
        e.location = Vector(pos)
        if scale:
            e.scale = Vector(scale)
        bpy.context.scene.collection.objects.link(e)
        objs.append(e)
    bpy.context.view_layer.objects.active = ob
    os.makedirs(os.path.dirname(os.path.abspath(out)), exist_ok=True)
    W.export_glb(objs, out, int(os.environ.get('WF_TOON_PX', '256')) if style == 'toon' else 1024, 'JPEG' if style == 'toon' else 'AUTO')
    lic = {'id': pid, 'generator': BP.GENERATOR, 'blender': bpy.app.version_string, 'style': style,
           'license': 'CC0-1.0 (재질 사진 전부 Poly Haven CC0, 형태는 전부 코드)',
           'inputs': sorted(f'polyhaven: {m}' for m in C.mats), 'size_m': size, 'tris': tris, 'nodes': [n[0] for n in NODES]}
    json.dump(lic, open(os.path.splitext(out)[0] + '.license.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    kb = os.path.getsize(out) // 1024
    lim = 2500 if pid in ROOMS else 1500
    print('WORLDFORGE', json.dumps({'id': pid, 'tris': tris, 'size_m': size, 'kb': kb, 'nodes': len(NODES), 'ok': tris <= lim and (style != 'toon' or kb <= 512)}))


if __name__ == '__main__':
    style = arg('--style', 'real')
    if '--list' in A:
        print('ROOMS', ' '.join(ROOMS))
        print('FURNITURE', ' '.join(FURNITURE))
    elif '--all' in A:
        d = arg('--out-dir')
        for pid in ALL:
            build_scene(pid, os.path.join(d, pid + '.glb'), style)
    else:
        pid = arg('--id')
        build_scene(pid, arg('--out'), style)
