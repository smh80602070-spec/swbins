"""world-forge 사가국지 RTS 건물 — 공방·밭·성벽 모서리·거점 성·적 기지 3단계 (K-0061 단계 ③④의 3D 밑그림). 재질만 Poly Haven CC0 사진.

  blender -b --factory-startup -P tools/world-forge/build_rts.py -- --all --out-dir <절대 폴더> [--style toon]
  blender -b --factory-startup -P tools/world-forge/build_rts.py -- --id rts_fortress_01 --out <절대>/x.glb
  blender -b --factory-startup -P tools/world-forge/build_rts.py -- --list

RTS 한 타일 = 2m. 건물은 w×h 타일 = 2w × 2h m 자리에 앉는다(원점 = 바닥 가운데). 이 GLB 는 AI 2D(그림체 B)의 밑그림 렌더용 — RTS 화면은 2D 한 장 스프라이트를 쓴다.
적 기지는 같은 양식의 어둡고 위협적인 3단계(a 온전·b 균열·c 불탐), 깃발은 따로(웹이 세력색으로 얹는다)라 장대만 둔다.
"""
import math
import os
import sys

import bpy  # noqa: F401
from mathutils import Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import build_prop as BP  # noqa: E402
from build_prop import tube, obox, gable, A, arg  # noqa: E402

BP.TRIS_MAX = 2500
BP.GENERATOR = 'tools/world-forge/build_rts.py'


def stone(C, tint='#a39d92', tile=1.2):
    return C.s('castle_wall_slates', tile, tint)


def tower(M, x, y, r, h, wall, roof, cap=True):
    tube(M, (x, y, 0), (x, y, h), r, r * 0.94, wall, 1.2, 10)
    tube(M, (x, y, h), (x, y, h + 0.18), r * 1.18, r * 1.18, wall, 1.2, 10)
    if cap:
        tube(M, (x, y, h + 0.18), (x, y, h + 1.1), r * 1.2, 0.0, roof, 1.0, 10)


def rts_workshop_01(C):
    M = C.M
    pl = C.s('clay_plaster', 1.5, '#cdb892')
    wd = C.s('brown_planks_03', 1.0, '#6a4a30')
    rf = C.s('clay_roof_tiles', 1.4, '#9a5a42')
    st = stone(C)
    obox(M, (0, 0, 0), (5.6, 3.6, 0.3), 0, st, 1.2)                                    # 기단
    obox(M, (0, 0.3, 0.3), (5.2, 3.0, 2.0), 0, pl, 1.5)                                   # 벽
    for sx in (-1, 1):
        obox(M, (sx * 2.5, -1.35, 0.3), (0.25, 0.25, 2.1), 0, wd, 1.0)                    # 앞 기둥
    obox(M, (0, -1.35, 2.3), (5.4, 0.3, 0.3), 0, wd, 1.0)
    gable(M, (0, 0.3, 2.3), (4.2, 5.6), 1.5, 90, rf, 1.4)                                 # 지붕(마루가 가로)
    obox(M, (1.9, 0.9, 2.3), (0.7, 0.7, 2.0), 0, st, 1.2)                                 # 굴뚝
    obox(M, (-1.2, -1.05, 0.3), (1.0, 0.7, 0.55), 0, st, 1.0)                              # 모루 받침
    obox(M, (-1.2, -1.05, 0.85), (0.8, 0.3, 0.2), 0, C.s('concrete_wall_001', 1.0, '#3a3d44'), 1.0)
    for k in range(5):
        tube(M, (0.9 + k * 0.18, -1.2, 0.3), (0.9 + k * 0.18, -1.2, 1.0), 0.07, 0.07, wd, 0.6, 6)   # 쌓은 장작
    obox(M, (0, 1.82, 0.3), (1.2, 0.1, 1.5), 0, C.s('black_painted_planks', 1.0), 1.0)         # 뒷문


def rts_field_01(C):
    M = C.M
    sd = C.s('brown_mud', 1.5, '#6a4a30')
    wd = C.s('brown_planks_03', 1.0, '#7a5a3a')
    g1 = C.s('white_stucco', 1.0, '#c9a24a', sat=1.2)
    g2 = C.s('white_stucco', 1.0, '#6fae45', sat=1.1)
    obox(M, (0, 0, 0), (5.9, 5.9, 0.12), 0, sd, 1.5)
    for r in range(6):
        y = -2.4 + r * 0.96
        obox(M, (0, y, 0.12), (5.5, 0.55, 0.14), 0, sd, 1.0)                                  # 이랑
        for k in range(14):
            x = -2.5 + k * 0.4
            gm = g1 if r % 2 == 0 else g2
            tube(M, (x, y, 0.2), (x + 0.03, y, 0.62), 0.03, 0.01, gm, 0.5, 4, caps=False)
            tube(M, (x + 0.03, y, 0.5), (x + 0.04, y, 0.74), 0.045, 0.0, gm, 0.5, 5)
    for sx in (-1, 1):
        for k in range(7):
            obox(M, (sx * 2.95, -2.7 + k * 0.9, 0.0), (0.12, 0.12, 0.7), 0, wd, 0.6)           # 울타리 말뚝(좌우)
        obox(M, (sx * 2.95, 0, 0.45), (0.06, 5.8, 0.08), 0, wd, 0.6)
    obox(M, (0, -2.95, 0.45), (5.9, 0.06, 0.08), 0, wd, 0.6)


def rts_wall_corner_01(C):
    M = C.M
    st = stone(C, '#a39d92')
    dk = stone(C, '#85807a')
    obox(M, (0, 0, 0), (2.0, 2.0, 0.2), 0, dk, 1.2)
    obox(M, (0.5, 0, 0.2), (1.0, 2.0, 1.7), 0, st, 1.2)
    obox(M, (0, 0.5, 0.2), (2.0, 1.0, 1.7), 0, st, 1.2)
    for pos in ((0.7, -0.7), (0.7, 0.7), (-0.7, 0.7), (0, 0), (0.7, 0.0), (0.0, 0.7)):
        obox(M, (pos[0], pos[1], 1.9), (0.45, 0.45, 0.4), 0, st, 1.0)                      # 총안
    tower(M, 0.3, 0.3, 0.55, 1.9, st, C.s('roof_slates_02', 1.2, '#5a606a'), cap=True)


def rts_fortress_01(C):
    M = C.M
    st = stone(C, '#b3ac9e')
    dk = stone(C, '#8a857a')
    roof = C.s('clay_roof_tiles', 1.4, '#8a4a3a')
    wd = C.s('brown_planks_03', 1.0, '#5a3f2b')
    obox(M, (0, 0, 0), (6.0, 6.0, 0.3), 0, dk, 1.5)                                       # 기단
    for a, b, y in ((-2.4, 2.4, -2.5), (-2.4, 2.4, 2.5)):
        obox(M, (0, y, 0.3), (4.8, 0.7, 2.2), 0, st, 1.2)
    for x in (-2.5, 2.5):
        obox(M, (x, 0, 0.3), (0.7, 4.8, 2.2), 0, st, 1.2)
    for sx in (-1, 1):                                                                   # 정문(앞 -y): 문 양옆 기둥 + 어두운 문
        obox(M, (sx * 0.6, -2.85, 0.3), (0.4, 0.4, 2.0), 0, dk, 1.0)
    obox(M, (0, -2.88, 0.3), (0.9, 0.3, 1.5), 0, C.s('black_painted_planks', 1.0), 1.0)
    for x, y in ((-2.7, -2.7), (2.7, -2.7), (-2.7, 2.7), (2.7, 2.7)):
        tower(M, x, y, 0.75, 3.0, st, roof)                                              # 모서리 탑 4
    obox(M, (0, 0, 0.3), (2.6, 2.6, 2.6), 0, st, 1.2)                                     # 가운데 본채
    gable(M, (0, 0, 2.9), (3.2, 3.0), 1.2, 0, roof, 1.4)
    tube(M, (0, 0, 4.1), (0, 0, 5.4), 0.05, 0.04, wd, 0.5, 6)                              # 깃대(깃발은 웹이 따로)
    for x in (-2.0, -0.7, 0.7, 2.0):
        for y in (-2.5, 2.5):
            obox(M, (x, y, 2.5), (0.5, 0.5, 0.35), 0, st, 1.0)                           # 성가퀴(앞뒤)


def enemy_base(C, state):
    """state 0 온전 · 1 균열(일부 무너짐) · 2 불탐(많이 무너지고 불길)."""
    M = C.M
    dkst = C.s('castle_wall_slates', 1.2, '#4a4650')
    blk = C.s('black_painted_planks', 1.0)
    spike = C.s('concrete_wall_001', 1.0, '#2a2a30')
    red = C.s('white_stucco', 1.0, '#ff4a2a', gain=1.8)
    ember = C.s('white_stucco', 1.0, '#ff9a3a', gain=1.8)
    obox(M, (0, 0, 0), (6.0, 6.0, 0.3), 0, C.s('castle_wall_slates', 1.2, '#3a3840'), 1.5)
    walls = [((0, -2.5), (4.8, 0.7)), ((0, 2.5), (4.8, 0.7)), ((-2.5, 0), (0.7, 4.8)), ((2.5, 0), (0.7, 4.8))]
    for i, ((x, y), (w, d)) in enumerate(walls):
        if state == 2 and i in (0, 3):
            obox(M, (x * 0.9, y * 0.9, 0.3), (w * 0.5, d, 0.7), 5 * i, dkst, 1.0)       # 무너진 낮은 잔해
            continue
        h = 2.4 if state == 0 else (2.0 if i % 2 else 2.4)
        obox(M, (x, y, 0.3), (w, d, h), 0, dkst, 1.2)
        if state >= 1 and i == 1:
            obox(M, (x + 1.2, y, 0.3 + h), (1.4, d * 0.9, -0.9), 12, blk, 1.0)         # 위가 뜯긴 구멍(어둡게)
    for k, (x, y) in enumerate(((-2.7, -2.7), (2.7, -2.7), (-2.7, 2.7), (2.7, 2.7))):
        h = 3.4 - (0.9 if state == 1 and k == 1 else 0) - (1.6 if state == 2 and k in (0, 3) else 0)
        tube(M, (x, y, 0), (x, y, h), 0.75, 0.68, dkst, 1.2, 8)
        tube(M, (x, y, h), (x, y, h + 0.15), 0.9, 0.9, blk, 1.0, 8)
        if state < 2 or k in (1, 2):
            tube(M, (x, y, h + 0.15), (x, y, h + 1.6), 0.85, 0.0, blk, 1.0, 8)           # 뾰족한 검은 지붕
        for j in range(5):                                                              # 가시
            a = j * 2 * math.pi / 5
            tube(M, (x + math.cos(a) * 0.78, y + math.sin(a) * 0.78, h - 0.2), (x + math.cos(a) * 1.15, y + math.sin(a) * 1.15, h + 0.35), 0.07, 0.0, spike, 0.5, 4)
    obox(M, (0, 0, 0.3), (2.6, 2.6, 2.8 if state == 0 else 2.2), 0, dkst, 1.2)
    if state == 0:
        tube(M, (0, 0, 3.1), (0, 0, 5.2), 1.5, 0.0, blk, 1.0, 4)
    elif state == 1:
        obox(M, (0.5, 0.2, 2.5), (1.8, 1.8, 0.5), 18, dkst, 1.0)
        tube(M, (-0.3, -0.2, 2.5), (-0.3, -0.2, 3.8), 1.1, 0.0, blk, 1.0, 4)
    if state == 2:
        for (x, y, hh) in ((0, 0, 1.8), (-1.2, 0.8, 1.1), (1.1, -0.6, 1.4), (2.6, -2.6, 1.0), (-2.7, 2.7, 1.2), (0.6, 2.5, 0.8)):
            tube(M, (x, y, 2.2 if hh > 1.3 else 1.0), (x, y, 2.2 + hh if hh > 1.3 else 1.0 + hh), 0.45, 0.0, ember, 0.5, 6)
            tube(M, (x, y, 2.2 if hh > 1.3 else 1.0), (x, y, 2.2 + hh * 0.6 if hh > 1.3 else 1.0 + hh * 0.6), 0.28, 0.0, red, 0.5, 6)
    else:
        for sx in (-1, 1):                                                              # 문 앞 붉은 화로
            tube(M, (sx * 1.3, -3.4, 0), (sx * 1.3, -3.4, 0.7), 0.2, 0.15, spike, 0.5, 6)
            tube(M, (sx * 1.3, -3.4, 0.7), (sx * 1.3, -3.4, 1.15), 0.2, 0.0, red, 0.5, 6)
    tube(M, (-2.2, 2.2, 0.3), (-2.2, 2.2, 3.4), 0.05, 0.04, blk, 0.5, 6)                  # 깃대(깃발은 웹이 따로)


def rts_enemy_base_a(C):
    enemy_base(C, 0)


def rts_enemy_base_b(C):
    enemy_base(C, 1)


def rts_enemy_base_c(C):
    enemy_base(C, 2)


MODELS = {f.__name__.replace('rts_enemy_base_', 'rts_enemy_base_'): f for f in (rts_workshop_01, rts_field_01, rts_wall_corner_01, rts_fortress_01, rts_enemy_base_a, rts_enemy_base_b, rts_enemy_base_c)}

if __name__ == '__main__':
    BP.PROPS.clear()
    BP.PROPS.update(MODELS)
    style = arg('--style', 'real')
    if '--list' in A:
        print('RTS', ' '.join(MODELS))
    elif '--all' in A:
        d = arg('--out-dir')
        for pid in MODELS:
            BP.build(pid, os.path.join(d, pid + '.glb'), style)
    else:
        BP.build(arg('--id'), arg('--out'), style)
