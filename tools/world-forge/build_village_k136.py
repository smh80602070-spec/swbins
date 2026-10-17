"""K-0136 4단계 — 2나락 마을 표식이 코드 상자로 그리던 것 중 자체 짝이 없던 둘(`saga-dungeon/js/dungeon3d.js` kind 'mark').
build_village.py 가 import 해서 VILLAGE 표에 붙인다(빌더·삼각형 예산·license 는 거기와 같다). 원점 = 바닥 가운데, 앞 = -y, 단위 m.

비율은 옛 도형과 같게 — 웹은 AS.build(kind, seed, mul) 로 **높이**를 mul 에 맞추므로 가로:높이 비가 같아야 발자리가 그대로다.
  mark_pad_01  밟는 발판(모든 표식 바닥) — 옛 상자 46×46×5   → 2.30 × 2.30 × 0.25 m(가로/높이 9.2) · 웹 mul 5
               가운데 34 폭은 낮게 패어 있다 — 웹이 그 위(5.4)에 표식 색 빛 판 34×34 를 그대로 얹는다(색은 웹 몫, 여기선 안 칠함).
  cave_hole_01 굴혈 입구(gate·exit_dungeon) — 옛 상자 46×46×5 + 검은 구멍 30 + 빛 22 → 2.30 × 2.30 × 0.45 m · 웹 mul 9
               돌 테 안이 검게 패고 계단 세 칸이 안쪽으로 내려간다(z 0 위에서만 — normalize 가 아래쪽 끝을 바닥으로 잡는다).
               전체 퓨전: 옛 나무 버팀목 · 지금의 줄무늬 차단봉 · 미래의 빛 결정.
"""
import math

from build_prop import tube, obox, annulus
from wf_shapes import ball


def _mats(C):
    return dict(
        st=C.s('japanese_stone_wall', 1.2, '#8e939c'), dk=C.s('japanese_stone_wall', 1.2, '#5f646e'),
        pale=C.s('castle_wall_slates', 1.0, '#b9bcc2'), bronze=C.s('concrete_wall_001', 1.0, '#8c6a3a', gain=1.2),
        pit=C.s('concrete_wall_001', 1.0, '#0b0c10'), pit2=C.s('concrete_wall_001', 1.0, '#1c1e24'), pit3=C.s('concrete_wall_001', 1.0, '#2c2f37'),
        wd=C.s('brown_planks_03', 1.0, '#6e4e30'), yel=C.s('concrete_wall_001', 1.0, '#e0b43a', gain=1.1), blk=C.s('concrete_wall_001', 1.0, '#202226'),
        glow=C.s('beige_wall_001', 1.0, '#ffd37a', gain=1.4))


def mark_pad_01(C):
    """밟는 발판 — 팔각 돌판 + 테 + 가운데 낮은 판(웹 빛 판 자리) + 홈 고리."""
    M, m = C.M, _mats(C)
    tube(M, (0, 0, 0), (0, 0, 0.14), 1.15, 1.12, m['dk'], 1.2, 8)                 # 바닥 판(꼭짓점 1.15 → 가로 2.30)
    annulus(M, (0, 0, 0.14), 0.86, 1.07, 0.11, m['st'], 1.2, 8)                  # 테
    tube(M, (0, 0, 0.14), (0, 0, 0.17), 0.87, 0.87, m['pale'], 1.0, 8)            # 가운데 낮은 판
    annulus(M, (0, 0, 0.17), 0.52, 0.6, 0.012, m['dk'], 1.0, 16)                  # 홈 고리(빛 판 아래 살짝 비침)


def cave_hole_01(C):
    """굴혈 입구 — 무너진 돌 테 안의 검은 구멍, 안쪽으로 내려가는 계단 셋, 뒤 나무 버팀목, 옆 차단봉, 테에 박힌 빛 결정."""
    M, m = C.M, _mats(C)
    annulus(M, (0, 0, 0), 0.82, 1.15, 0.22, m['st'], 1.2, 10)                     # 돌 테
    tube(M, (0, 0, 0), (0, 0, 0.02), 0.84, 0.84, m['pit'], 1.0, 10)               # 구멍 바닥(가장 어두움)
    for i, (h, s) in enumerate(((0.17, 'pit3'), (0.11, 'pit2'), (0.05, 'pit'))):   # 앞(-y)에서 안쪽으로 내려가는 계단
        obox(M, (0, -0.62 + 0.24 * i, 0.0), (0.74 - 0.08 * i, 0.24, h), 0, m[s], 1.0)
    rocks = ((-1.05, -0.45, 0.16), (0.98, -0.6, 0.13), (1.08, 0.38, 0.18), (-0.86, 0.72, 0.12), (0.2, -1.12, 0.11), (-0.35, 1.1, 0.14))
    for x, y, r in rocks:                                                          # 테 위 무너진 돌
        ball(M, (x, y, 0.2 + r * 0.5), r, m['dk'], 6)
    for sx in (-0.72, 0.72):                                                       # 뒤 버팀목 둘 + 가로대
        tube(M, (sx, 0.78, 0.0), (sx * 0.92, 0.74, 0.45), 0.06, 0.05, m['wd'], 0.6, 6)
    obox(M, (0, 0.74, 0.37), (1.6, 0.1, 0.08), 0, m['wd'], 1.0)
    for j in range(4):                                                             # 줄무늬 차단봉(앞 오른쪽)
        tube(M, (1.02, -0.92, 0.1 * j), (1.02, -0.92, 0.1 * (j + 1)), 0.05, 0.05, m['yel' if j % 2 == 0 else 'blk'], 0.3, 8, caps=(j in (0, 3)))
    tube(M, (-0.98, -0.18, 0.18), (-1.02, -0.22, 0.42), 0.07, 0.0, m['glow'], 0.4, 5)   # 빛 결정 둘(테에 박힘)
    tube(M, (-0.9, -0.05, 0.18), (-0.84, -0.04, 0.33), 0.05, 0.0, m['glow'], 0.4, 5)


K136 = {f.__name__: f for f in (mark_pad_01, cave_hole_01)}
