"""K-0209 — 1만리 땅 퓨전 소품 18의 자체 짝(빌린 Quaternius 대신). build_village.py 가 import 해서 VILLAGE 표에 붙인다(빌더·삼각형 예산 2500·license 는 거기와 같다).
원점 = 바닥 가운데, 앞 = -y, 단위 m. 이름은 뜻만 같고 모양은 전부 새로 — 원작·원본 모델 안 베낌.

  현대  traffic_light_01  stop_sign_01  ac_unit_01  antenna_mast_01  propane_tank_01  solar_array_01  solar_panel_low_01
  미래  capsule_house_01  radar_dish_01  rover_01  tank_01  turret_01
  신화  tree_floating_01  tree_glow_01  tree_lava_01  tree_spiral_01  cactus_01  palm_01
"""
import math

from build_prop import tube, obox, gable, annulus, frustum
from wf_shapes import ball


def _m(C):
    s = C.s
    return dict(
        steel=s('concrete_wall_001', 1.0, '#8a8f98'), dark=s('concrete_wall_001', 1.0, '#3a3d44'), white=s('white_stucco', 1.0, '#e8e8e2'),
        red=s('white_stucco', 1.0, '#c0382b'), yellow=s('white_stucco', 1.0, '#e0b030'), green=s('white_stucco', 1.0, '#3f8f4f'),
        glass=s('beige_wall_001', 1.0, '#7fb6d6', gain=1.2), blue=s('white_stucco', 1.0, '#2b4f8f'), olive=s('concrete_wall_001', 1.0, '#6b7350'),
        rust=s('corrugated_iron', 1.0, '#8a5a3a'), bark=s('brown_planks_03', 0.8, '#6a4e36'), leaf=s('white_stucco', 1.0, '#4e8f3a', sat=1.1),
        glow=s('beige_wall_001', 1.0, '#8fffe0', gain=1.7), lava=s('beige_wall_001', 1.0, '#ff7a2a', gain=1.7), ash=s('concrete_wall_001', 1.0, '#2e2a28'),
        sand=s('coast_sand_03', 1.0), cactus=s('white_stucco', 1.0, '#5f9a4a'), pink=s('white_stucco', 1.0, '#e8a0c0'), violet=s('beige_wall_001', 1.0, '#b27bff', gain=1.5))


# ── 현대 ─────────────────────────────────────────────────────────────
def traffic_light_01(C):
    """신호등: 기둥 + 가로 팔 + 세로 신호함(빨강·노랑·초록 등). 높이 4.5."""
    M = C.M; m = _m(C)
    tube(M, (0, 0, 0), (0, 0, 0.15), 0.22, 0.18, m['dark'], 1.0, 8)
    tube(M, (0, 0, 0.15), (0, 0, 4.2), 0.09, 0.07, m['steel'], 1.0, 8)
    obox(M, (0.7, 0, 4.0), (1.5, 0.1, 0.1), 0, m['steel'])
    for k, c in enumerate(('red', 'yellow', 'green')):
        z = 3.6 + k * 0.28 if False else 3.5 + k * 0.3
        obox(M, (0, -0.0, 3.35), (0.34, 0.22, 0.95), 0, m['dark'])
    for k, c in enumerate(('red', 'yellow', 'green')):
        tube(M, (0, -0.115, 3.35 + 0.8 - k * 0.3), (0, -0.14, 3.35 + 0.8 - k * 0.3), 0.09, 0.08, m[c], 1.0, 8)
    obox(M, (1.35, 0, 3.7), (0.3, 0.2, 0.3), 0, m['dark'])                                  # 가로 팔 끝 신호함
    tube(M, (1.35, -0.105, 3.85), (1.35, -0.125, 3.85), 0.07, 0.06, m['red'], 1.0, 6)
    tube(M, (1.35, -0.105, 3.7), (1.35, -0.125, 3.7), 0.07, 0.06, m['green'], 1.0, 6)


def stop_sign_01(C):
    """정지 표지: 기둥 + 여덟 각 판(붉은 바탕·흰 테두리, 글자 없음). 높이 2.5."""
    M = C.M; m = _m(C)
    tube(M, (0, 0, 0), (0, 0, 2.2), 0.045, 0.04, m['steel'], 1.0, 8)
    tube(M, (0, -0.04, 2.05), (0, -0.07, 2.05), 0.4, 0.4, m['white'], 1.0, 8)
    tube(M, (0, -0.07, 2.05), (0, -0.09, 2.05), 0.34, 0.34, m['red'], 1.0, 8)
    obox(M, (0, -0.095, 2.05), (0.26, 0.012, 0.07), 0, m['white'])                           # 가로 흰 줄(글자 자리, 글자는 없다)


def ac_unit_01(C):
    """실외기: 상자 + 앞 둥근 환풍구(살 둘레)·모서리 받침. 높이 ≈ 2.4(두 대 쌓음)."""
    M = C.M; m = _m(C)
    for k in range(2):
        z = 0.22 + k * 1.0
        obox(M, (0, 0, z), (1.1, 0.5, 0.9), 0, m['white'])
        tube(M, (-0.2, -0.255, z + 0.46), (-0.2, -0.27, z + 0.46), 0.32, 0.32, m['dark'], 1.0, 10)
        for a in range(4):
            ang = math.radians(a * 45 + 22)
            tube(M, (-0.2 - 0.27 * math.cos(ang), -0.28, z + 0.46 - 0.27 * math.sin(ang)), (-0.2 + 0.27 * math.cos(ang), -0.28, z + 0.46 + 0.27 * math.sin(ang)), 0.012, 0.012, m['steel'], 1.0, 4)
        obox(M, (0.38, -0.26, z + 0.15), (0.3, 0.02, 0.6), 0, m['steel'])                    # 옆 덮개(통풍 줄)
    for sx in (-0.45, 0.45):
        obox(M, (sx, 0, 0), (0.12, 0.45, 0.22), 0, m['dark'])
    obox(M, (0, 0, 2.12), (1.14, 0.54, 0.06), 0, m['steel'])


def antenna_mast_01(C):
    """안테나 철탑: 세 다리 + 가로 띠 + 위 접시·막대. 높이 7."""
    M = C.M; m = _m(C)
    base = [(math.cos(math.radians(90 + 120 * k)) * 0.5, math.sin(math.radians(90 + 120 * k)) * 0.5) for k in range(3)]
    for i, (x, y) in enumerate(base):
        tube(M, (x, y, 0), (x * 0.2, y * 0.2, 6.0), 0.04, 0.025, m['red'] if i == 0 else m['white'], 1.0, 5)
    for z, f in ((1.2, 0.82), (2.6, 0.66), (4.0, 0.5), (5.3, 0.34)):                            # 가로 띠(삼각)
        pts = [(x * f * 0.9, y * f * 0.9, z) for x, y in base]
        for a in range(3):
            b = (a + 1) % 3
            tube(M, pts[a], pts[b], 0.022, 0.022, m['steel'], 1.0, 4)
    tube(M, (0, 0, 5.9), (0, 0, 7.0), 0.03, 0.015, m['dark'], 1.0, 5)
    tube(M, (0.15, 0, 6.3), (0.5, 0, 6.5), 0.012, 0.012, m['dark'], 1.0, 4)
    tube(M, (0.15, 0, 6.5), (0.4, 0, 6.65), 0.012, 0.012, m['dark'], 1.0, 4)
    tube(M, (0, 0, 6.2), (0, -0.28, 6.2), 0.2, 0.02, m['white'], 1.0, 10)                  # 작은 접시
    tube(M, (0, 0, 7.0), (0, 0, 7.12), 0.04, 0.0, m['red'], 1.0, 5)


def propane_tank_01(C):
    """가스통: 눕힌 알약 모양 + 받침 둘 + 위 밸브. 길이 1.5, 지름 0.7."""
    M = C.M; m = _m(C)
    z = 0.5
    tube(M, (-0.55, 0, z), (0.55, 0, z), 0.34, 0.34, m['white'], 1.0, 12, caps=False)
    tube(M, (-0.55, 0, z), (-0.72, 0, z), 0.34, 0.15, m['white'], 1.0, 12)
    tube(M, (0.55, 0, z), (0.72, 0, z), 0.34, 0.15, m['white'], 1.0, 12)
    tube(M, (0, 0.0, z + 0.34), (0, 0, z + 0.5), 0.07, 0.07, m['red'], 1.0, 6)
    tube(M, (0, 0, z + 0.5), (0.1, 0, z + 0.55), 0.03, 0.03, m['dark'], 1.0, 5)
    tube(M, (-0.3, 0, z + 0.3), (0.3, 0, z + 0.3), 0.01, 0.01, m['red'], 1.0, 4)            # 위 줄 무늬
    for sx in (-0.38, 0.38):
        obox(M, (sx, 0, 0), (0.1, 0.6, 0.22), 0, m['dark'])


def solar_array_01(C):
    """태양광 구조물: 기둥 둘 위에 기울어진 판 3×2. 높이 3."""
    M = C.M; m = _m(C)
    for sx in (-1.0, 1.0):
        tube(M, (sx, 0.3, 0), (sx, 0.3, 2.2), 0.06, 0.05, m['steel'], 1.0, 6)
        tube(M, (sx, -0.5, 0), (sx, -0.5, 1.3), 0.05, 0.045, m['steel'], 1.0, 6)
    for c in range(3):
        for r in range(2):
            x0 = -1.5 + c * 1.0; za = 1.45 + r * 0.7
            pts = [(x0 + 0.05, -0.55 + r * 0.55, 1.3 + r * 0.55), (x0 + 0.95, -0.55 + r * 0.55, 1.3 + r * 0.55), (x0 + 0.95, -0.05 + r * 0.55, 1.3 + r * 0.55 + 0.5), (x0 + 0.05, -0.05 + r * 0.55, 1.3 + r * 0.55 + 0.5)]
            from mathutils import Vector
            M.face([Vector(p) for p in pts], [(0, 0), (1, 0), (1, 1), (0, 1)], m['blue'])
            M.face([Vector(p) for p in reversed(pts)], [(0, 1), (1, 1), (1, 0), (0, 0)], m['dark'])
    obox(M, (0, 0.3, 2.15), (2.2, 0.08, 0.08), 0, m['steel'])
    obox(M, (0, 0.3, 2.65), (3.1, 0.06, 0.06), 0, m['steel'])


def solar_panel_low_01(C):
    """낮은 태양광: 짧은 다리 + 한 장짜리 기울어진 판(격자 줄). 높이 1.2, 폭 1.6."""
    M = C.M; m = _m(C)
    from mathutils import Vector
    pts = [(-0.8, -0.5, 0.4), (0.8, -0.5, 0.4), (0.8, 0.2, 1.1), (-0.8, 0.2, 1.1)]
    M.face([Vector(p) for p in pts], [(0, 0), (1, 0), (1, 1), (0, 1)], m['blue'])
    M.face([Vector(p) for p in reversed(pts)], [(0, 1), (1, 1), (1, 0), (0, 0)], m['dark'])
    for k in range(1, 4):                                                                    # 격자 줄(가는 상자)
        x = -0.8 + k * 0.4
        tube(M, (x, -0.5, 0.405), (x, 0.2, 1.105), 0.01, 0.01, m['steel'], 1.0, 4)
    tube(M, (0, -0.1, 0.0), (0, -0.1, 0.7), 0.04, 0.04, m['steel'], 1.0, 5)
    for sx in (-0.6, 0.6):
        tube(M, (sx, -0.45, 0.0), (sx, -0.45, 0.4), 0.035, 0.03, m['steel'], 1.0, 5)
        tube(M, (sx, 0.15, 0.0), (sx, 0.15, 1.1), 0.035, 0.03, m['steel'], 1.0, 5)


# ── 미래 ─────────────────────────────────────────────────────────────
def capsule_house_01(C):
    """캡슐 집: 눕히지 않은 알약 몸통 + 둥근 창 둘 + 문 + 받침·안테나. 높이 5, 지름 2.6."""
    M = C.M; m = _m(C)
    tube(M, (0, 0, 0), (0, 0, 0.35), 1.3, 1.3, m['dark'], 1.0, 14)
    tube(M, (0, 0, 0.35), (0, 0, 3.7), 1.25, 1.25, m['white'], 1.0, 14, caps=False)
    tube(M, (0, 0, 3.7), (0, 0, 4.7), 1.25, 0.5, m['white'], 1.0, 14)
    tube(M, (0, 0, 4.7), (0, 0, 4.95), 0.5, 0.0, m['steel'], 1.0, 14)
    for a in (-30, 30):                                                                      # 둥근 창
        ang = math.radians(a - 90)
        tube(M, (math.cos(ang) * 1.22, math.sin(ang) * 1.22, 2.6), (math.cos(ang) * 1.3, math.sin(ang) * 1.3, 2.6), 0.28, 0.26, m['glass'], 1.0, 10)
    obox(M, (0, -1.22, 0.35), (0.7, 0.1, 1.4), 0, m['blue'])                              # 문
    tube(M, (0, 0, 4.95), (0, 0, 5.6), 0.03, 0.015, m['steel'], 1.0, 5)
    tube(M, (0, 0, 3.7), (0, 0, 3.78), 1.28, 1.28, m['steel'], 1.0, 14)                    # 허리 띠


def radar_dish_01(C):
    """레이더: 돌아가는 판(그대로 정적) + 받침 + 기둥. 높이 3."""
    M = C.M; m = _m(C)
    tube(M, (0, 0, 0), (0, 0, 0.3), 0.55, 0.45, m['dark'], 1.0, 10)
    tube(M, (0, 0, 0.3), (0, 0, 1.5), 0.14, 0.1, m['white'], 1.0, 8)
    obox(M, (0, 0, 1.45), (0.4, 0.4, 0.3), 0, m['steel'])
    tube(M, (0, -0.05, 2.2), (0, 0.15, 2.2), 1.15, 1.0, m['white'], 1.0, 16)                 # 접시(납작 원판 둘)
    tube(M, (0, 0.15, 2.2), (0, 0.2, 2.2), 1.0, 0.0, m['steel'], 1.0, 16)
    tube(M, (0, -0.05, 2.2), (0, -0.7, 2.2), 0.02, 0.02, m['dark'], 1.0, 4)               # 받침대
    tube(M, (0, -0.7, 2.2), (0, -0.74, 2.2), 0.1, 0.08, m['red'], 1.0, 6)
    tube(M, (0, 0, 1.75), (0, 0, 2.2), 0.06, 0.05, m['steel'], 1.0, 6)


def rover_01(C):
    """로버: 여섯 바퀴 + 상자 몸 + 위 마스트·접시. 길이 2.4, 높이 ≈ 2."""
    M = C.M; m = _m(C)
    obox(M, (0, 0, 0.55), (1.7, 0.95, 0.5), 0, m['white'])
    obox(M, (0.15, 0, 1.05), (0.9, 0.6, 0.32), 0, m['steel'])
    for sx in (-0.7, 0.0, 0.7):
        for sy in (-0.62, 0.62):
            tube(M, (sx, sy - 0.07, 0.34), (sx, sy + 0.07, 0.34), 0.34, 0.34, m['dark'], 1.0, 10)
            tube(M, (sx, sy * 0.55, 0.34), (sx, sy * 0.85, 0.34), 0.04, 0.04, m['steel'], 1.0, 4)
    tube(M, (0.55, 0, 1.37), (0.55, 0, 1.95), 0.03, 0.02, m['steel'], 1.0, 5)
    tube(M, (0.55, -0.05, 1.95), (0.55, -0.22, 1.95), 0.17, 0.02, m['yellow'], 1.0, 8)
    tube(M, (-0.1, 0.2, 1.37), (-0.1, 0.2, 1.7), 0.04, 0.04, m['dark'], 1.0, 5)
    tube(M, (-0.1, 0.2, 1.7), (-0.1, 0.2, 1.76), 0.1, 0.1, m['red'], 1.0, 6)                # 카메라
    obox(M, (-0.55, 0, 1.05), (0.5, 0.7, 0.04), 0, m['blue'])                              # 작은 태양광 판


def tank_01(C):
    """전차: 캐터필러 둘 + 몸통 + 포탑 + 긴 포신. 길이 ≈ 3.6, 높이 1.5."""
    M = C.M; m = _m(C)
    for sy in (-0.7, 0.7):
        obox(M, (0, sy, 0.0), (2.4, 0.4, 0.55), 0, m['dark'])
        for sx in (-0.9, -0.3, 0.3, 0.9):
            tube(M, (sx, sy - 0.22, 0.28), (sx, sy + 0.22, 0.28), 0.26, 0.26, m['steel'], 1.0, 8)
    frustum(M, (0, 0, 0.5), (2.2, 1.3), (1.8, 1.0), 0.4, m['olive'], 1.0)
    tube(M, (0.1, 0, 0.9), (0.1, 0, 1.2), 0.5, 0.42, m['olive'], 1.0, 10)
    tube(M, (0.4, 0, 1.0), (1.9, 0, 1.0), 0.07, 0.06, m['dark'], 1.0, 6)                  # 포신
    tube(M, (1.9, 0, 1.0), (2.05, 0, 1.0), 0.09, 0.09, m['steel'], 1.0, 6)
    obox(M, (-0.15, -0.25, 1.15), (0.2, 0.2, 0.18), 0, m['steel'])                         # 해치
    tube(M, (-0.4, 0.3, 1.2), (-0.4, 0.3, 1.7), 0.015, 0.015, m['dark'], 1.0, 4)           # 안테나


def turret_01(C):
    """포탑: 둥근 받침 + 몸통 + 쌍 포신. 높이 3."""
    M = C.M; m = _m(C)
    tube(M, (0, 0, 0), (0, 0, 0.4), 0.9, 0.8, m['dark'], 1.0, 12)
    tube(M, (0, 0, 0.4), (0, 0, 1.5), 0.2, 0.18, m['steel'], 1.0, 8)
    frustum(M, (0, 0, 1.5), (1.1, 1.0), (0.8, 0.7), 0.7, m['olive'], 1.0)
    for sy in (-0.18, 0.18):
        tube(M, (0.3, sy, 2.0), (1.6, sy, 2.0), 0.06, 0.05, m['dark'], 1.0, 6)
        tube(M, (1.6, sy, 2.0), (1.72, sy, 2.0), 0.08, 0.08, m['steel'], 1.0, 6)
    tube(M, (0, 0, 2.2), (0, 0, 2.4), 0.3, 0.2, m['steel'], 1.0, 8)
    tube(M, (0, 0, 2.4), (0, 0, 2.9), 0.02, 0.01, m['dark'], 1.0, 4)
    tube(M, (0, 0, 2.9), (0, 0, 2.95), 0.07, 0.07, m['red'], 1.0, 5)


# ── 신화 ─────────────────────────────────────────────────────────────
def _tree(C, trunk, canopy, glowc=None, h=6.0):
    pass


def tree_floating_01(C):
    """떠 있는 나무: 위에 흙덩이 섬 + 나무 + 아래 뿌리 + 떠 있는 작은 돌. 높이 8."""
    M = C.M; m = _m(C)
    tube(M, (0, 0, 3.0), (0, 0, 3.6), 0.0, 1.3, m['rust'], 0.8, 10)
    tube(M, (0, 0, 3.6), (0, 0, 4.0), 1.3, 1.45, m['green'], 1.0, 10)
    for a in range(5):
        ang = math.radians(a * 72)
        tube(M, (math.cos(ang) * 0.5, math.sin(ang) * 0.5, 3.0), (math.cos(ang) * 0.25, math.sin(ang) * 0.25, 1.6 - a * 0.1), 0.1, 0.02, m['bark'], 0.8, 5)
    tube(M, (0, 0, 4.0), (0, 0, 6.2), 0.2, 0.12, m['bark'], 0.8, 7)
    for (x, y, z, r) in ((0, 0, 6.8, 1.1), (0.8, 0.2, 6.2, 0.7), (-0.7, -0.2, 6.3, 0.75), (0.1, 0.8, 7.5, 0.6)):
        ball(M, (x, y, z), r, m['leaf'], 7)
    for (x, y, z, r) in ((1.9, 0.4, 3.0, 0.25), (-1.7, -0.5, 2.4, 0.2), (0.4, -1.8, 3.4, 0.18)):
        ball(M, (x, y, z), r, m['rust'], 5)


def tree_glow_01(C):
    """빛 나무: 흰 줄기 + 파랗게 빛나는 둥근 잎 뭉치 + 땅 위 빛 이끼. 높이 6."""
    M = C.M; m = _m(C)
    tube(M, (0, 0, 0), (0, 0, 4.2), 0.3, 0.14, m['white'], 0.8, 8)
    for k in range(3):
        ang = math.radians(k * 120 + 20)
        tube(M, (0, 0, 2.5 + k * 0.4), (math.cos(ang) * 1.1, math.sin(ang) * 1.1, 3.9 + k * 0.3), 0.12, 0.05, m['white'], 0.8, 5)
    for (x, y, z, r) in ((0, 0, 5.0, 1.3), (1.1, 0.2, 4.2, 0.85), (-1.0, -0.3, 4.4, 0.9), (0.2, 1.0, 5.6, 0.7), (0.2, -0.9, 5.3, 0.75)):
        ball(M, (x, y, z), r, m['glow'], 7)
    for k in range(5):
        ang = math.radians(k * 72)
        ball(M, (math.cos(ang) * 0.9, math.sin(ang) * 0.9, 0.12), 0.2, m['glow'], 5)


def tree_lava_01(C):
    """용암 나무: 검은 재 줄기 + 갈라진 빨간 빛 줄 + 앙상한 가지 + 불빛 열매. 높이 6."""
    M = C.M; m = _m(C)
    tube(M, (0, 0, 0), (0, 0, 3.8), 0.34, 0.14, m['ash'], 0.8, 7)
    for k in range(4):
        z = 0.5 + k * 0.8
        tube(M, (0.02, -0.28 + k * 0.02, z), (0.02, -0.3 + k * 0.02, z + 0.5), 0.045, 0.03, m['lava'], 1.0, 4)   # 갈라진 빛 줄
    for k in range(5):
        ang = math.radians(k * 72 + 15)
        tube(M, (0, 0, 3.0 + (k % 3) * 0.3), (math.cos(ang) * 1.6, math.sin(ang) * 1.6, 4.6 + (k % 2) * 0.7), 0.1, 0.03, m['ash'], 0.8, 5)
        ball(M, (math.cos(ang) * 1.6, math.sin(ang) * 1.6, 4.5 + (k % 2) * 0.7), 0.16, m['lava'], 5)
    ball(M, (0, 0, 4.3), 0.28, m['lava'], 6)


def tree_spiral_01(C):
    """나선 나무: 꼬여 올라가는 줄기 + 층층이 작아지는 잎 고리. 높이 6."""
    M = C.M; m = _m(C)
    pts = [(math.cos(k * 0.75) * (0.25 + 0.0 * k), math.sin(k * 0.75) * 0.25, k * 0.5) for k in range(12)]
    for a, b in zip(pts, pts[1:]):
        tube(M, a, b, 0.2 - a[2] * 0.012, 0.2 - b[2] * 0.012, m['bark'], 0.8, 6)
    for k in range(5):
        z = 1.6 + k * 0.85; r = 1.25 - k * 0.2
        tube(M, (0, 0, z), (0, 0, z + 0.4), r, r * 0.88, m['violet'], 1.0, 9, caps=False)
        tube(M, (0, 0, z + 0.4), (0, 0, z + 0.55), r * 0.88, r * 0.55, m['violet'], 1.0, 9)
    ball(M, (0, 0, 6.0), 0.2, m['glow'], 5)


def cactus_01(C):
    """선인장: 둥근 줄기 + 팔 둘(꺾임) + 세로 줄 + 꽃. 높이 3.5."""
    M = C.M; m = _m(C)
    tube(M, (0, 0, 0), (0, 0, 2.8), 0.34, 0.3, m['cactus'], 0.8, 8)
    tube(M, (0, 0, 2.8), (0, 0, 3.15), 0.3, 0.0, m['cactus'], 0.8, 8)
    for sgn, z0, up in ((1, 1.3, 1.1), (-1, 0.9, 0.9)):
        tube(M, (0.2 * sgn, 0, z0), (0.9 * sgn, 0, z0), 0.17, 0.16, m['cactus'], 0.8, 7)
        tube(M, (0.9 * sgn, 0, z0), (0.9 * sgn, 0, z0 + up), 0.16, 0.14, m['cactus'], 0.8, 7)
        tube(M, (0.9 * sgn, 0, z0 + up), (0.9 * sgn, 0, z0 + up + 0.25), 0.14, 0.0, m['cactus'], 0.8, 7)
    for a in range(4):
        ang = math.radians(a * 90 + 45)
        tube(M, (math.cos(ang) * 0.3, math.sin(ang) * 0.3, 0.2), (math.cos(ang) * 0.27, math.sin(ang) * 0.27, 2.7), 0.012, 0.012, m['green'], 1.0, 4)
    ball(M, (0, 0, 3.2), 0.12, m['pink'], 5)


def palm_01(C):
    """야자: 살짝 굽은 줄기(마디) + 위 잎 여덟 + 열매. 높이 9."""
    M = C.M; m = _m(C)
    prev = (0, 0, 0)
    for k in range(1, 9):
        p = (math.sin(k * 0.12) * 0.7, 0, k * 1.0)
        tube(M, prev, p, 0.42 - (k - 1) * 0.03, 0.42 - k * 0.03, m['bark'], 0.8, 8)
        prev = p
    top = prev
    for a in range(8):
        ang = math.radians(a * 45)
        d = (math.cos(ang), math.sin(ang))
        tube(M, top, (top[0] + d[0] * 2.0, top[1] + d[1] * 2.0, top[2] + 0.5), 0.17, 0.1, m['leaf'], 1.0, 5)
        tube(M, (top[0] + d[0] * 2.0, top[1] + d[1] * 2.0, top[2] + 0.5), (top[0] + d[0] * 3.1, top[1] + d[1] * 3.1, top[2] - 0.6), 0.1, 0.0, m['leaf'], 1.0, 5)
    for k in range(3):
        ang = math.radians(k * 120)
        ball(M, (top[0] + math.cos(ang) * 0.22, top[1] + math.sin(ang) * 0.22, top[2] - 0.15), 0.17, m['rust'], 5)


K209 = {f.__name__: f for f in (
    traffic_light_01, stop_sign_01, ac_unit_01, antenna_mast_01, propane_tank_01, solar_array_01, solar_panel_low_01,
    capsule_house_01, radar_dish_01, rover_01, tank_01, turret_01,
    tree_floating_01, tree_glow_01, tree_lava_01, tree_spiral_01, cactus_01, palm_01)}
