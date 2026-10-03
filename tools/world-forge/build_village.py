"""world-forge 마을·장터 소품 + 던전 방 키트 — 좌판·낮은 돌담·표지판·상자·통·천막·모닥불 장작·벤치·손수레, 기둥·벽 토막·궤·항아리·제단 받침·창살 문 (K-0053). 재질만 Poly Haven CC0 사진.

  blender -b --factory-startup -P tools/world-forge/build_village.py -- --id market_stall_01 --out <절대>/market_stall_01.glb [--style toon]
  blender -b --factory-startup -P tools/world-forge/build_village.py -- --all --out-dir <절대 폴더> [--style toon]
  blender -b --factory-startup -P tools/world-forge/build_village.py -- --list

원점 = 바닥 가운데, 단위 미터, z 위. `data/set_plan.json` 의 `village` 목록과 같은 id 18개. 삼각형 ≤ 2500(한 장면에 여러 개 서는 소품이라 지물 한도 5000 의 절반).
시대 이름·원작 형태 없음 — 어느 판·시대 마을에도 선다. build_prop.py 의 도형 도우미(tube·obox·gable·annulus)와 빌더를 그대로 쓴다.
돌담·벽 토막은 양 끝 단면이 같게(줄 나눔이 가운데 기준 좌우 대칭) 이어 붙여 쓸 수 있다.
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
BP.GENERATOR = 'tools/world-forge/build_village.py'

CLOTH_RED, CLOTH_CREAM = '#b5453a', '#e3d3a6'


def cloth(C, tint, tile=1.0):
    return C.s('white_stucco', tile, tint)


def wood(C, tint=None, tile=1.0):
    return C.s('brown_planks_03', tile, tint)


def dark_wood(C, tile=1.0):
    return C.s('black_painted_planks', tile)


def iron(C, tint='#3a3d44'):
    return C.s('concrete_wall_001', 1.0, tint)


def stone(C, tile=1.2, tint=None):
    return C.s('castle_wall_slates', tile, tint)


def sheared_slab(M, o, w, d, dz, thick, slot, tile=1.0):
    """앞(y 작은 쪽)이 낮고 뒤가 dz 만큼 높은 판. o = 최소 모서리, w = x 길이, d = y 길이, thick = 두께."""
    M.box(o, Vector((w, 0, 0)), Vector((0, d, dz)), Vector((0, 0, thick)), slot, tile)


def wheel_y(M, c, r, slot_rim, slot_hub, y0, y1, spokes=6, rim_n=10):
    """y 축을 도는 바퀴 — 테(짧은 막대 이음)·바퀴통·살."""
    cx, cz = c
    for k in range(rim_n):
        a0, a1 = 2 * math.pi * k / rim_n, 2 * math.pi * (k + 1) / rim_n
        p = lambda a, y: (cx + math.cos(a) * r, y, cz + math.sin(a) * r)
        tube(M, p(a0, (y0 + y1) / 2), p(a1, (y0 + y1) / 2), 0.05, 0.05, slot_rim, 1.0, 4, caps=False)
    tube(M, (cx, y0 - 0.02, cz), (cx, y1 + 0.02, cz), 0.08, 0.08, slot_hub, 0.5, 6)
    for k in range(spokes):
        a = 2 * math.pi * k / spokes
        tube(M, (cx, (y0 + y1) / 2, cz), (cx + math.cos(a) * r, (y0 + y1) / 2, cz + math.sin(a) * r), 0.025, 0.025, slot_rim, 1.0, 4)


def sack(M, base, r, h, slot, tie, lean=(0.0, 0.0)):
    """자루 한 개 — 아래가 넓은 몸통 + 목 + 묶은 끝."""
    b = Vector(base)
    l = Vector((lean[0], lean[1], 0))
    tube(M, b, b + Vector((0, 0, h * 0.62)) + l * 0.4, r * 0.92, r, slot, 0.8, 8)
    tube(M, b + Vector((0, 0, h * 0.62)) + l * 0.4, b + Vector((0, 0, h * 0.9)) + l, r, r * 0.3, slot, 0.8, 8)
    tube(M, b + Vector((0, 0, h * 0.88)) + l, b + Vector((0, 0, h * 0.96)) + l, r * 0.3, r * 0.2, tie, 0.5, 6)


def crate(M, base, size, yaw, slot, slot_frame):
    """상자 하나 — 몸통 + 모서리 널(살짝 튀어나온 테)."""
    obox(M, base, size, yaw, slot, 0.8)
    c, s = math.cos(math.radians(yaw)), math.sin(math.radians(yaw))
    ex, ey = Vector((c, s, 0)), Vector((-s, c, 0))
    b = Vector(base)
    t = 0.06
    for sx in (-1, 1):
        for sy in (-1, 1):
            p = b + ex * (sx * (size[0] / 2 - t / 2 + 0.005)) + ey * (sy * (size[1] / 2 - t / 2 + 0.005))
            obox(M, p, (t + 0.01, t + 0.01, size[2] + 0.01), yaw, slot_frame, 0.5)
    for z in (0.0, size[2] - 0.07):
        obox(M, b + Vector((0, 0, z)), (size[0] + 0.02, size[1] + 0.02, 0.07), yaw, slot_frame, 0.5)


# ---------------------------------------------------------------- 마을·장터 12

def market_stall_01(C):
    M = C.M
    wd, dk = wood(C), dark_wood(C)
    red, cream = cloth(C, CLOTH_RED), cloth(C, CLOTH_CREAM)
    obox(M, (0, 0, 0), (2.2, 1.0, 0.86), 0, wd, 1.0)                                   # 판매대 몸통
    obox(M, (0, 0, 0.86), (2.35, 1.12, 0.07), 0, dk, 1.0)                              # 판 위
    for sx in (-1, 1):
        for sy in (-1, 1):
            obox(M, (sx * 1.08, sy * 0.62, 0), (0.12, 0.12, 2.5), 0, dk, 1.0)         # 기둥 네 개
    for k in range(6):                                                               # 줄무늬 차양(앞 낮게·뒤 높게 기울임)
        x0 = -1.5 + k * 0.5
        sheared_slab(M, (x0, -0.85, 2.38), 0.5, 1.75, 0.24, 0.05, red if k % 2 == 0 else cream, 1.0)
    obox(M, (0, -0.86, 2.28), (3.0, 0.05, 0.14), 0, red, 1.0)                           # 앞 처마 자락
    crate(M, (-0.62, 0.05, 0.93), (0.52, 0.42, 0.34), 8, wd, dk)                       # 판 위 물건: 상자
    fruit = C.s('white_stucco', 1.0, '#c9462d', sat=1.2)
    for k in range(4):
        tube(M, (0.2 + (k % 2) * 0.28, -0.12 + (k // 2) * 0.28, 0.93), (0.2 + (k % 2) * 0.28, -0.12 + (k // 2) * 0.28, 1.17), 0.13, 0.11, fruit, 0.5, 6)
    sack(M, (0.82, 0.12, 0.93), 0.16, 0.34, cloth(C, '#cbb98a'), dk)


def low_stone_wall_01(C):
    M = C.M
    st = stone(C, 1.2)
    st2 = stone(C, 1.2, '#b8b2a4')
    rows = [(0.0, 0.28, [0.7, 0.6, 0.7]), (0.28, 0.27, [0.5, 0.5, 0.5, 0.5]), (0.55, 0.22, [0.65, 0.7, 0.65])]
    for z, h, parts in rows:                                                          # 길이 2.0 에 줄마다 다른 이음 — 좌우 대칭이라 이어 붙인다
        x = -1.0
        for i, ln in enumerate(parts):
            obox(M, (x + ln / 2, 0, z), (ln - 0.03, 0.5 - (i % 2) * 0.04, h - 0.02), 0, st if i % 2 == 0 else st2, 1.0)
            x += ln
    obox(M, (0, 0, 0.77), (2.0, 0.56, 0.1), 0, st2, 1.2)                                # 갓돌


def signpost_01(C):
    M = C.M
    wd, dk = wood(C), dark_wood(C)
    obox(M, (0, 0, 0), (0.45, 0.45, 0.12), 0, stone(C), 1.0)
    obox(M, (0, 0, 0.12), (0.16, 0.16, 2.2), 0, dk, 1.0)
    for z, yaw, ln, dirn in ((1.75, 0, 1.2, 1), (1.32, 25, 1.0, -1)):                # 이정표 팔 둘, 끝이 뾰족
        c, s = math.cos(math.radians(yaw)), math.sin(math.radians(yaw))
        ex = Vector((c, s, 0)) * dirn
        base = Vector((0, 0, z)) + ex * (ln / 2 + 0.05)
        obox(M, base, (ln, 0.05, 0.28), yaw, wd, 0.6)
        tip = Vector((0, 0, z)) + ex * (ln + 0.05)
        obox(M, tip, (0.2, 0.05, 0.2), yaw + 45, wd, 0.6)
    tube(M, (0, 0, 2.32), (0, 0, 2.5), 0.1, 0.0, dk, 0.5, 6)                         # 기둥 끝 뾰족


def notice_board_01(C):
    M = C.M
    wd, dk = wood(C), dark_wood(C)
    paper = cloth(C, '#e9e0c6')
    for sx in (-1, 1):
        obox(M, (sx * 0.85, 0, 0), (0.14, 0.14, 2.0), 0, dk, 1.0)
    obox(M, (0, 0.02, 0.85), (1.7, 0.08, 1.05), 0, wd, 1.0)                           # 판
    for z in (0.82, 1.88):
        obox(M, (0, 0.02, z), (1.9, 0.12, 0.08), 0, dk, 1.0)                            # 테
    gable(M, (0, 0, 2.0), (0.6, 2.1), 0.3, 90, dk, 0.8)                                # 작은 지붕
    for x, z, w, h, yaw in ((-0.5, 1.45, 0.4, 0.5, 4), (0.05, 1.35, 0.45, 0.35, -3), (0.55, 1.5, 0.35, 0.45, 5), (-0.3, 1.0, 0.4, 0.28, -5), (0.4, 1.0, 0.45, 0.3, 3)):
        obox(M, (x, -0.04, z - h / 2), (w, 0.015, h), yaw, paper, 0.5)                  # 붙은 쪽지


def crate_stack_01(C):
    M = C.M
    wd, dk = wood(C), dark_wood(C)
    crate(M, (-0.42, 0, 0), (0.8, 0.8, 0.7), 4, wd, dk)
    crate(M, (0.5, 0.1, 0), (0.7, 0.7, 0.62), -9, wd, dk)
    crate(M, (-0.2, 0.05, 0.7), (0.62, 0.62, 0.55), 18, wd, dk)
    crate(M, (0.5, 0.65, 0), (0.48, 0.42, 0.4), 30, wd, dk)


def barrel_01(C):
    M = C.M
    wd, hoop = wood(C, None, 0.7), iron(C)
    segs = [(0.0, 0.42, 0.31, 0.40), (0.42, 0.84, 0.40, 0.31)]
    for z0, z1, r0, r1 in segs:
        tube(M, (0, 0, z0), (0, 0, z1), r0, r1, wd, 0.7, 12)
    for z, r in ((0.08, 0.325), (0.28, 0.395), (0.56, 0.395), (0.76, 0.325)):          # 쇠테
        tube(M, (0, 0, z - 0.025), (0, 0, z + 0.025), r + 0.012, r + 0.012, hoop, 1.0, 12, caps=False)
    tube(M, (0, 0, 0.835), (0, 0, 0.86), 0.28, 0.28, dark_wood(C), 0.7, 12)           # 뚜껑


def sack_pile_01(C):
    M = C.M
    s1, s2, tie = cloth(C, '#cdb98a'), cloth(C, '#b9a373'), dark_wood(C)
    sack(M, (-0.4, 0.15, 0), 0.32, 0.78, s1, tie, (0.0, 0.05))
    sack(M, (0.28, 0.2, 0), 0.34, 0.74, s2, tie, (0.02, -0.05))
    sack(M, (-0.05, -0.38, 0), 0.33, 0.7, s2, tie, (0.0, -0.05))
    sack(M, (-0.08, 0.1, 0.58), 0.29, 0.62, s1, tie, (0.05, 0.0))                       # 위에 한 자루
    sack(M, (0.62, -0.32, 0), 0.27, 0.55, s1, tie, (0.08, 0.0))


def tent_small_01(C):
    M = C.M
    cv, dk, rope = cloth(C, '#c9b98c'), dark_wood(C), wood(C)
    gable(M, (0, 0, 0), (2.4, 2.6), 1.55, 0, cv, 1.0)                                  # 마루가 y 방향인 A 자 천막
    obox(M, (0, 1.32, 0), (0.8, 0.04, 1.0), 0, dk, 0.5)                                # 입구 안쪽(어둡게)
    tube(M, (0, -1.35, 0), (0, -1.35, 1.6), 0.04, 0.04, rope, 0.5, 5)                 # 앞뒤 기둥
    tube(M, (0, 1.35, 0), (0, 1.35, 1.6), 0.04, 0.04, rope, 0.5, 5)
    for sx in (-1, 1):                                                              # 말뚝·줄
        for y in (-1.05, 1.05):
            tube(M, (sx * 1.55, y, 0), (sx * 1.55, y, 0.2), 0.03, 0.02, rope, 0.5, 4)
            tube(M, (sx * 1.2, y, 0.5), (sx * 1.55, y, 0.18), 0.012, 0.012, rope, 0.5, 4)


def tent_large_01(C):
    M = C.M
    red, cream = cloth(C, CLOTH_RED), cloth(C, CLOTH_CREAM)
    dk = dark_wood(C)
    n, R, wall_h, top = 12, 2.3, 1.0, 3.4
    ring = lambda r, k, z: Vector((math.cos(2 * math.pi * k / n) * r, math.sin(2 * math.pi * k / n) * r, z))
    apex = Vector((0, 0, top))
    for k in range(n):                                                                # 줄무늬 벽 + 지붕(문이 되는 칸 하나는 어둡게)
        k2 = (k + 1) % n
        sl = red if k % 2 == 0 else cream
        if k == 0:
            sl = dk
        M.quad(ring(R, k, 0), ring(R, k2, 0), ring(R, k2, wall_h), ring(R, k, wall_h), sl, (0, 0), (1, 0), (1, 1), (0, 1))
        M.face([ring(R, k, wall_h), ring(R, k2, wall_h), apex], [(0, 0), (1, 0), (0.5, 1)], sl)
    tube(M, (0, 0, top - 0.05), (0, 0, top + 0.9), 0.05, 0.03, dk, 0.5, 6)           # 꼭대기 장대
    M.quad(Vector((0, 0, top + 0.9)), Vector((0, 0, top + 0.55)), Vector((0.62, 0, top + 0.6)), Vector((0.62, 0, top + 0.85)), red, (0, 0), (0, 1), (1, 1), (1, 0))
    M.quad(Vector((0, 0, top + 0.9)), Vector((0.62, 0, top + 0.85)), Vector((0.62, 0, top + 0.6)), Vector((0, 0, top + 0.55)), red, (0, 0), (1, 0), (1, 1), (0, 1))
    for k in range(n):                                                                # 말뚝
        a = 2 * math.pi * (k + 0.5) / n
        p = Vector((math.cos(a) * (R + 0.35), math.sin(a) * (R + 0.35), 0))
        tube(M, p, p + Vector((0, 0, 0.25)), 0.035, 0.025, dk, 0.5, 4)


def campfire_logs_01(C):
    M = C.M
    rock = stone(C, 1.0, '#a39d92')
    wd = wood(C, '#8a6a4a', 0.7)
    char = dark_wood(C)
    ash = C.s('concrete_wall_001', 1.0, '#34322f')
    for k in range(9):                                                                # 돌 둘레
        a = 2 * math.pi * k / 9
        obox(M, (math.cos(a) * 0.75, math.sin(a) * 0.75, 0), (0.32, 0.28, 0.22 + 0.04 * (k % 3)), math.degrees(a) + 90, rock, 0.6)
    tube(M, (0, 0, 0.02), (0, 0, 0.06), 0.62, 0.6, ash, 1.0, 10)                      # 재
    for k in range(6):                                                                # 세워 기댄 장작
        a = 2 * math.pi * k / 6 + 0.3
        tube(M, (math.cos(a) * 0.45, math.sin(a) * 0.45, 0.07), (math.cos(a) * 0.04, math.sin(a) * 0.04, 0.78), 0.075, 0.06, wd if k % 2 == 0 else char, 0.6, 6)
    for a, ln in ((0.0, 0.7), (1.9, 0.6)):                                            # 바닥에 누운 장작
        c, s = math.cos(a), math.sin(a)
        tube(M, (-c * ln / 2 + s * 0.12, -s * ln / 2 - c * 0.12, 0.1), (c * ln / 2 + s * 0.12, s * ln / 2 - c * 0.12, 0.1), 0.08, 0.07, wd, 0.6, 6)


def bench_01(C):
    M = C.M
    wd, dk = wood(C), dark_wood(C)
    for k in range(3):                                                                # 앉는 판 세 장
        obox(M, (0, -0.15 + k * 0.15, 0.45), (1.7, 0.13, 0.06), 0, wd, 0.8)
    for k in range(2):                                                                # 등받이 두 장
        obox(M, (0, -0.22, 0.78 + k * 0.17), (1.7, 0.05, 0.13), 0, wd, 0.8)
    for sx in (-1, 1):
        obox(M, (sx * 0.72, 0.0, 0), (0.09, 0.45, 0.45), 0, dk, 0.8)                  # 다리 판
        obox(M, (sx * 0.72, -0.22, 0.4), (0.09, 0.06, 0.95), 0, dk, 0.8)              # 뒷다리 연장(등받이 기둥)


def handcart_01(C):
    M = C.M
    wd, dk, hb = wood(C), dark_wood(C), iron(C)
    obox(M, (0, 0, 0.5), (1.5, 0.95, 0.08), 0, wd, 0.8)                                # 바닥
    for sy in (-1, 1):
        obox(M, (0, sy * 0.45, 0.58), (1.5, 0.05, 0.38), 0, wd, 0.8)                    # 옆 판
    for sx in (-1, 1):
        obox(M, (sx * 0.72, 0, 0.58), (0.05, 0.95, 0.38), 0, wd, 0.8)                  # 앞·뒤 판
    tube(M, (0, -0.62, 0.4), (0, 0.62, 0.4), 0.03, 0.03, hb, 0.5, 5)                  # 굴대
    for sy in (-1, 1):
        wheel_y(M, (0, 0.4), 0.4, dk, hb, sy * 0.52 - 0.04, sy * 0.52 + 0.04)
        tube(M, (0.55, sy * 0.3, 0.52), (1.95, sy * 0.3, 0.38), 0.035, 0.035, dk, 0.5, 6)  # 손잡이 둘
    obox(M, (1.9, 0, 0.36), (0.05, 0.7, 0.05), 0, dk, 0.5)                              # 손잡이 가로대
    tube(M, (-0.75, 0.0, 0.5), (-0.95, 0.0, 0.0), 0.04, 0.035, dk, 0.5, 5)            # 받침 다리


# ---------------------------------------------------------------- 던전 방 키트 6

def dungeon_pillar_01(C):
    M = C.M
    st = stone(C, 1.5, '#9b968c')
    dk = stone(C, 1.5, '#7f7a72')
    obox(M, (0, 0, 0), (1.3, 1.3, 0.3), 0, dk, 1.5)                                   # 기단
    obox(M, (0, 0, 0.3), (1.0, 1.0, 0.18), 0, st, 1.5)
    tube(M, (0, 0, 0.48), (0, 0, 3.1), 0.46, 0.4, st, 1.5, 8)                         # 몸통
    for z in (0.62, 2.95):
        tube(M, (0, 0, z), (0, 0, z + 0.1), 0.52, 0.52, dk, 1.5, 8)                     # 띠
    obox(M, (0, 0, 3.1), (1.1, 1.1, 0.2), 0, dk, 1.5)                                 # 머리
    obox(M, (0, 0, 3.3), (1.3, 1.3, 0.25), 0, st, 1.5)


def wall_piece_01(C):
    M = C.M
    st = stone(C, 1.5, '#8f8a80')
    st2 = stone(C, 1.5, '#a29d92')
    rows = [(0.0, 0.62, [1.0, 1.0, 1.0]), (0.62, 0.56, [0.7, 1.0, 0.6, 0.7]), (1.18, 0.62, [1.0, 1.0, 1.0]), (1.8, 0.56, [0.7, 1.0, 0.6, 0.7]), (2.36, 0.64, [1.0, 1.0, 1.0])]
    for z, h, parts in rows:                                                          # 폭 3.0·두께 0.6·높이 3.0 — 줄마다 가운데 대칭
        x = -1.5
        for i, ln in enumerate(parts):
            obox(M, (x + ln / 2, 0, z), (ln - 0.03, 0.6 - 0.03 * (i % 2), h - 0.03), 0, st if (i + int(z * 3)) % 2 == 0 else st2, 1.0)
            x += ln
    obox(M, (-1.0, 0, 3.0), (0.94, 0.58, 0.1), 0, st, 1.0)                              # 위가 울퉁불퉁한 턱(양 끝은 평평)
    obox(M, (0.0, 0, 3.0), (0.94, 0.58, 0.22), 0, st2, 1.0)
    obox(M, (1.0, 0, 3.0), (0.94, 0.58, 0.1), 0, st, 1.0)


def chest_01(C):
    M = C.M
    wd, band = dark_wood(C), iron(C, '#4a4036')
    gold = C.s('white_stucco', 1.0, '#c9a24a', sat=1.2)
    obox(M, (0, 0, 0), (1.1, 0.65, 0.5), 0, wd, 0.8)                                   # 몸통
    tube(M, (-0.55, 0, 0.5), (0.55, 0, 0.5), 0.32, 0.32, wd, 0.8, 8)                    # 둥근 뚜껑
    for x in (-0.38, 0.38):                                                           # 쇠띠
        obox(M, (x, 0, 0.0), (0.09, 0.68, 0.5), 0, band, 0.5)
        tube(M, (x - 0.045, 0, 0.5), (x + 0.045, 0, 0.5), 0.345, 0.345, band, 0.5, 8)
    obox(M, (0, -0.335, 0.32), (0.16, 0.04, 0.2), 0, gold, 0.5)                          # 자물쇠


def jar_01(C):
    M = C.M
    clay = C.s('clay_plaster', 0.8, '#9c6a46')
    dk = C.s('clay_plaster', 0.8, '#6b4630')
    tube(M, (0, 0, 0), (0, 0, 0.32), 0.19, 0.33, clay, 0.8, 10)
    tube(M, (0, 0, 0.32), (0, 0, 0.62), 0.33, 0.37, clay, 0.8, 10)
    tube(M, (0, 0, 0.62), (0, 0, 0.88), 0.37, 0.27, clay, 0.8, 10)
    tube(M, (0, 0, 0.88), (0, 0, 1.02), 0.27, 0.19, clay, 0.8, 10)
    tube(M, (0, 0, 1.02), (0, 0, 1.08), 0.23, 0.23, dk, 0.8, 10)                        # 입술
    for sy in (-1, 1):                                                                # 손잡이 둘
        tube(M, (0, sy * 0.3, 0.72), (0, sy * 0.4, 0.62), 0.035, 0.035, dk, 0.5, 5)
        tube(M, (0, sy * 0.4, 0.62), (0, sy * 0.34, 0.5), 0.035, 0.035, dk, 0.5, 5)
    tube(M, (0, 0, 0.5), (0, 0, 0.55), 0.372, 0.372, dk, 0.8, 10, caps=False)            # 무늬 띠


def altar_base_01(C):
    M = C.M
    st = stone(C, 1.5, '#8f8a80')
    dk = stone(C, 1.5, '#6f6a62')
    glow = C.s('white_stucco', 1.0, '#9a6bff', gain=1.7)
    tube(M, (0, 0, 0), (0, 0, 0.3), 1.6, 1.5, dk, 1.5, 14)                              # 세 단 받침
    tube(M, (0, 0, 0.3), (0, 0, 0.58), 1.3, 1.22, st, 1.5, 14)
    tube(M, (0, 0, 0.58), (0, 0, 0.82), 0.98, 0.92, dk, 1.5, 14)
    tube(M, (0, 0, 0.82), (0, 0, 0.86), 0.78, 0.78, glow, 1.0, 14)                      # 빛 고리(그림 위에 빛은 코드가 얹는다)
    tube(M, (0, 0, 0.84), (0, 0, 0.9), 0.62, 0.62, dk, 1.5, 14)
    for k in range(4):                                                                # 가장자리 돌기둥 토막
        a = math.pi / 4 + k * math.pi / 2
        p = Vector((math.cos(a) * 1.15, math.sin(a) * 1.15, 0.58))
        tube(M, p, p + Vector((0, 0, 0.5)), 0.09, 0.07, st, 1.0, 6)


def bars_door_01(C):
    M = C.M
    st = stone(C, 1.5, '#8f8a80')
    metal = iron(C, '#2f3238')
    for sx in (-1, 1):
        obox(M, (sx * 1.0, 0, 0), (0.4, 0.55, 2.7), 0, st, 1.2)                         # 기둥
    obox(M, (0, 0, 2.6), (2.4, 0.55, 0.45), 0, st, 1.2)                                  # 상인방
    for k in range(9):                                                                # 창살
        x = -0.72 + k * 0.18
        tube(M, (x, 0, 0.05), (x, 0, 2.62), 0.028, 0.028, metal, 1.0, 5)
    for z in (0.35, 1.3, 2.25):
        obox(M, (0, 0, z - 0.04), (1.64, 0.07, 0.08), 0, metal, 1.0)                    # 가로대 셋
    tube(M, (0.72, -0.08, 1.05), (0.72, -0.08, 1.25), 0.08, 0.08, metal, 0.5, 6)       # 자물쇠 덩이
    for k in range(9):
        x = -0.72 + k * 0.18
        tube(M, (x, 0, 2.62), (x, 0, 2.74), 0.028, 0.0, metal, 1.0, 4)                  # 창끝


VILLAGE = {f.__name__: f for f in (
    market_stall_01, low_stone_wall_01, signpost_01, notice_board_01, crate_stack_01, barrel_01, sack_pile_01, tent_small_01, tent_large_01,
    campfire_logs_01, bench_01, handcart_01, dungeon_pillar_01, wall_piece_01, chest_01, jar_01, altar_base_01, bars_door_01)}

if __name__ == '__main__':
    BP.PROPS.clear()
    BP.PROPS.update(VILLAGE)
    style = arg('--style', 'real')
    if '--list' in A:
        print('VILLAGE', ' '.join(VILLAGE))
    elif '--all' in A:
        d = arg('--out-dir')
        for pid in VILLAGE:
            BP.build(pid, os.path.join(d, pid + '.glb'), style)
    else:
        BP.build(arg('--id'), arg('--out'), style)
