"""K-0195 — 게임성 새 기능이 코드 도형으로 세우던 것의 자체 짝(웹 W-0421·0422·0426·0428 · 고돗 G-0387·0392 · 유니티 짝).
build_village.py 가 import 해서 VILLAGE 표에 붙인다(빌더·삼각형 예산 2500·license 는 거기와 같다). 원점 = 바닥 가운데, 앞 = -y, 단위 m.

  puzzle_stone_01        1만리 들판 수수께끼 — 들출 돌(이끼 낀 넓적 돌 + 밑동 풀)
  puzzle_stone_01_open   들춘 뒤 — 돌이 옆으로 비켜 누웠고 자리에 흙 구멍 + 빛나는 씨앗 셋
  flower_ring_01         꽃 고리 — 꽃 다섯이 원으로(지름 1.6), 핀 판
  flower_ring_01_wilt    같은 고리, 진 판(고개 숙인 줄기·바랜 색)
  pinwheel_01            바람개비 받침 — 나무 막대 + 축 머리(날개 없음 — 날개는 따로)
  pinwheel_01_blades     바람개비 날개 넷 — 원점 = 축 가운데, 돌리는 축 = y(앞 -y). 엔진이 pinwheel_01 의 축 높이(1.25)에 얹어 y 축으로 돌린다
  chest_cursed_01        2나락 저주받은 상자 — chest_01 꼴 + 감은 사슬·큰 자물쇠·뚜껑 틈 보랏빛(미래 퓨전: 빛나는 봉인 띠)
  chest_bounty_01        2나락 층 현상금 상자 — chest_01 꼴 + 금테·모서리 쇠·앞에 붙은 현상금 종이
  grain_pile_01          5천하 곡창 더미 — 낟알 무더기 + 자루 둘(일꾼 짐은 build_village sack_pile_01)
"""
import math

from build_prop import tube, obox, annulus
from wf_shapes import ball


def eball(M, c, r, slot, n=6, sc=(1.0, 1.0, 1.0)):
    """납작한/늘인 둥근 덩이 — ball 과 같은 원뿔대 셋, 가로 반지름 r*sc[0] · 높이 반지름 r*sc[2]."""
    x, y, z = c
    rh, rv = r * sc[0], r * sc[2]
    tube(M, (x, y, z - rv), (x, y, z - rv * 0.5), rh * 0.35, rh * 0.87, slot, 0.3, n)
    tube(M, (x, y, z - rv * 0.5), (x, y, z + rv * 0.5), rh * 0.87, rh * 0.87, slot, 0.3, n, caps=False)
    tube(M, (x, y, z + rv * 0.5), (x, y, z + rv), rh * 0.87, rh * 0.35, slot, 0.3, n)


def _mats(C):
    return dict(
        rock=C.s('castle_wall_slates', 1.0, '#8d8a80'), moss=C.s('white_stucco', 1.0, '#6f8f45', sat=1.1), dirt=C.s('clay_plaster', 0.8, '#5c4430'),
        hole=C.s('concrete_wall_001', 1.0, '#2a2018'), seed=C.s('beige_wall_001', 1.0, '#ffe08a', gain=1.5),
        stem=C.s('white_stucco', 1.0, '#4e8a35'), stem_d=C.s('white_stucco', 1.0, '#7d7a4a'),
        pole=C.s('brown_planks_03', 0.6, '#8a6a48'), hub=C.s('concrete_wall_001', 1.0, '#d8d4c8'),
        wd=C.s('black_painted_planks', 1.0), band=C.s('concrete_wall_001', 1.0, '#4a4036'), gold=C.s('white_stucco', 1.0, '#c9a24a', sat=1.2),
        chain=C.s('concrete_wall_001', 1.0, '#8a8d95', gain=1.2), curse=C.s('beige_wall_001', 1.0, '#a76bff', gain=1.6),
        paper=C.s('white_stucco', 1.0, '#e9dfc4'), ink=C.s('concrete_wall_001', 1.0, '#7a2a22'),
        grain=C.s('thatch_roof_angled', 0.5, '#d9b45a', gain=1.3, sat=1.2), sack=C.s('white_stucco', 1.0, '#c8b48a'))


PETAL = ('#f2c94c', '#e86a7a', '#f4f1ea', '#8fb8ff', '#ff9a4a')               # 꽃 다섯 색(핀 판)
PETAL_WILT = ('#a8946a', '#9a7a72', '#b8b2a2', '#8a8f9a', '#a8866a')


def _stone(M, m, x=0.0, y=0.0, z=0.0, tilt=0.0):
    """넓적 돌 — 납작한 공 셋을 겹친 덩이 + 윗면 이끼."""
    for dx, dy, r, sz in ((0.0, 0.0, 0.42, 0.55), (0.22, 0.12, 0.3, 0.5), (-0.2, -0.1, 0.28, 0.45)):
        eball(M, (x + dx, y + dy, z + 0.18 + tilt * dx), r, m['rock'], 7, (1.0, 1.0, sz))
    eball(M, (x + 0.05, y + 0.02, z + 0.36 + tilt * 0.05), 0.26, m['moss'], 6, (1.0, 1.0, 0.18))


def _grass(M, m, cx, cy, n, r, h):
    for k in range(n):
        a = 2 * math.pi * k / n + 0.3
        x, y = cx + math.cos(a) * r, cy + math.sin(a) * r
        tube(M, (x, y, 0), (x + math.cos(a) * 0.06, y + math.sin(a) * 0.06, h), 0.02, 0.0, m['stem'], 0.3, 3)


def puzzle_stone_01(C):
    M, m = C.M, _mats(C)
    _stone(M, m)
    _grass(M, m, 0, 0, 9, 0.5, 0.22)


def puzzle_stone_01_open(C):
    M, m = C.M, _mats(C)
    tube(M, (0, 0, 0), (0, 0, 0.02), 0.4, 0.4, m['dirt'], 0.8, 10)                 # 들춘 자리 흙
    tube(M, (0, 0, 0.0), (0, 0, 0.025), 0.22, 0.22, m['hole'], 1.0, 10)            # 구멍
    for k in range(3):                                                              # 빛나는 씨앗 셋
        a = 2 * math.pi * k / 3
        ball(M, (math.cos(a) * 0.08, math.sin(a) * 0.08, 0.05), 0.04, m['seed'], 5)
    _stone(M, m, x=0.75, y=0.15, z=0.0, tilt=0.4)                                  # 비켜 누운 돌
    _grass(M, m, 0, 0, 9, 0.5, 0.22)


def _flower(M, C, x, y, h, col, droop):
    stem = C.s('white_stucco', 1.0, '#7d7a4a' if droop else '#4e8a35')
    top = (x + droop * 0.12, y, h - droop * 0.1)
    tube(M, (x, y, 0), top, 0.025, 0.02, stem, 0.3, 4)
    pet = C.s('white_stucco', 1.0, col, sat=1.0 if droop else 1.2)
    for k in range(5):                                                              # 꽃잎 다섯
        a = 2 * math.pi * k / 5
        eball(M, (top[0] + math.cos(a) * 0.1, top[1] + math.sin(a) * 0.1, top[2] - droop * 0.04), 0.08, pet, 5, (1.0, 1.0, 0.35))
    ball(M, top, 0.05, C.s('white_stucco', 1.0, '#c9922a'), 5)
    for s in (-1, 1):                                                               # 잎 둘
        tube(M, (x, y, h * 0.35), (x + s * 0.16, y + 0.03, h * 0.45), 0.04, 0.0, stem, 0.3, 3)


def _ring(C, cols, droop):
    M, m = C.M, _mats(C)
    annulus(M, (0, 0, 0), 0.62, 0.86, 0.015, m['moss'], 1.0, 20)                   # 풀 고리 바닥
    for k, col in enumerate(cols):
        a = 2 * math.pi * k / 5 + math.pi / 2
        _flower(M, C, math.cos(a) * 0.74, math.sin(a) * 0.74, 0.42 + 0.06 * (k % 2), col, droop)


def flower_ring_01(C):
    _ring(C, PETAL, 0.0)


def flower_ring_01_wilt(C):
    _ring(C, PETAL_WILT, 1.0)


def pinwheel_01(C):
    M, m = C.M, _mats(C)
    tube(M, (0, 0, 0), (0, 0, 1.25), 0.03, 0.025, m['pole'], 0.6, 6)              # 막대
    tube(M, (0, 0.0, 1.25), (0, -0.06, 1.25), 0.035, 0.035, m['hub'], 1.0, 8)       # 축 머리(앞 -y)
    eball(M, (0, 0, 0.03), 0.07, m['rock'], 5, (1.0, 1.0, 0.5))                       # 박은 돌


def pinwheel_01_blades(C, oz=0.0):
    """원점 = 축 가운데, 앞 -y. 날개 넷(빨·노·파·하양) — 접힌 끝이 앞으로 휘어 바람을 받는다. oz = 높이 올림(합친 판)."""
    M = C.M
    cols = ('#e2433a', '#f2c94c', '#3d7be0', '#f4f1ea')
    tube(M, (0, 0.02, oz), (0, -0.08, oz), 0.04, 0.04, C.s('concrete_wall_001', 1.0, '#d8d4c8'), 1.0, 8)
    for k, col in enumerate(cols):
        a = math.pi / 2 * k
        s = C.s('white_stucco', 1.0, col, sat=1.2)
        d = (math.cos(a), math.sin(a))
        n = (-math.sin(a), math.cos(a))
        p0 = (d[0] * 0.03, -0.04, oz + d[1] * 0.03)
        p1 = (d[0] * 0.32, -0.04, oz + d[1] * 0.32)
        p2 = (d[0] * 0.3 + n[0] * 0.2, -0.12, oz + d[1] * 0.3 + n[1] * 0.2)                 # 접혀 앞으로 나온 끝
        p3 = (n[0] * 0.1, -0.06, oz + n[1] * 0.1)
        M.face([p0, p1, p2, p3], [(0, 0), (1, 0), (1, 1), (0, 1)], s)
        M.face([p0, p3, p2, p1], [(0, 0), (0, 1), (1, 1), (1, 0)], s)                # 뒷면


def pinwheel_01_full(C):
    """2D 그림용 한 덩이 — 받침 + 날개(축 높이 1.25). 3D 는 pinwheel_01 + pinwheel_01_blades 를 따로 쓴다."""
    pinwheel_01(C)
    pinwheel_01_blades(C, 1.25)


def _chest(M, m):
    obox(M, (0, 0, 0), (1.1, 0.65, 0.5), 0, m['wd'], 0.8)
    tube(M, (-0.55, 0, 0.5), (0.55, 0, 0.5), 0.32, 0.32, m['wd'], 0.8, 8)
    for x in (-0.38, 0.38):
        obox(M, (x, 0, 0.0), (0.09, 0.68, 0.5), 0, m['band'], 0.5)
        tube(M, (x - 0.045, 0, 0.5), (x + 0.045, 0, 0.5), 0.345, 0.345, m['band'], 0.5, 8)


def chest_cursed_01(C):
    M, m = C.M, _mats(C)
    _chest(M, m)
    tube(M, (-0.56, -0.33, 0.5), (0.56, -0.33, 0.5), 0.012, 0.012, m['curse'], 0.3, 4)   # 뚜껑 틈 보랏빛
    for x in (-0.18, 0.18):                                                              # 감은 사슬 둘(고리 줄)
        for k in range(9):
            a0, a1 = 2 * math.pi * k / 9, 2 * math.pi * (k + 1) / 9
            tube(M, (x, math.cos(a0) * 0.37, 0.4 + math.sin(a0) * 0.47), (x, math.cos(a1) * 0.37, 0.4 + math.sin(a1) * 0.47), 0.028, 0.028, m['chain'], 0.3, 5)
    obox(M, (0, -0.36, 0.26), (0.24, 0.06, 0.26), 0, m['chain'], 0.5)                   # 큰 자물쇠
    annulus(M, (0, -0.36, 0.52), 0.06, 0.09, 0.03, m['chain'], 0.5, 8)
    obox(M, (0, -0.395, 0.3), (0.05, 0.01, 0.1), 0, m['curse'], 0.3)                    # 열쇠 구멍 빛
    for x in (-0.5, 0.5):                                                                # 봉인 띠(미래 — 빛 줄)
        obox(M, (x, 0, 0.18), (0.03, 0.67, 0.03), 0, m['curse'], 0.3)


def chest_bounty_01(C):
    M, m = C.M, _mats(C)
    _chest(M, m)
    for x in (-0.56, 0.56):                                                              # 옆 금테(테두리만)
        for z in (0.0, 0.44):
            obox(M, (x, 0, z), (0.02, 0.67, 0.06), 0, m['gold'], 0.5)
        for y in (-0.3, 0.3):
            obox(M, (x, y, 0.0), (0.02, 0.06, 0.5), 0, m['gold'], 0.5)
    obox(M, (0, -0.335, 0.0), (1.12, 0.02, 0.06), 0, m['gold'], 0.5)                    # 앞 아래 금띠
    for x in (-0.55, 0.55):
        for y in (-0.32, 0.32):
            obox(M, (x, y, 0.0), (0.08, 0.08, 0.08), 0, m['gold'], 0.5)                   # 모서리 쇠
    obox(M, (0, -0.345, 0.12), (0.34, 0.012, 0.3), 0.06, m['paper'], 0.5)              # 현상금 종이
    for k in range(3):                                                                   # 종이 위 붉은 줄
        obox(M, (0, -0.352, 0.34 - 0.07 * k), (0.24 - 0.05 * k, 0.004, 0.025), 0.06, m['ink'], 0.3)
    obox(M, (0, -0.335, 0.32), (0.16, 0.04, 0.2), 0, m['gold'], 0.5)                    # 자물쇠


def grain_pile_01(C):
    M, m = C.M, _mats(C)
    tube(M, (0, 0, 0), (0, 0, 0.35), 0.9, 0.55, m['grain'], 0.5, 12)                    # 낟알 무더기
    tube(M, (0, 0, 0.35), (0, 0, 0.62), 0.55, 0.0, m['grain'], 0.5, 12)
    for x, y, yaw in ((0.95, -0.3, 0.3), (0.85, 0.35, -0.4)):                          # 자루 둘
        eball(M, (x, y, 0.22), 0.24, m['sack'], 7, (0.8, 0.8, 1.0))
        tube(M, (x, y, 0.42), (x, y, 0.5), 0.07, 0.04, m['sack'], 0.5, 6)


K195 = {f.__name__: f for f in (puzzle_stone_01, puzzle_stone_01_open, flower_ring_01, flower_ring_01_wilt, pinwheel_01, pinwheel_01_blades, pinwheel_01_full,
                                chest_cursed_01, chest_bounty_01, grain_pile_01)}
