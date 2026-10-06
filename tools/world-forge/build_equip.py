"""world-forge 장비 외형 조각 — 갑옷 54(시대 3 × 등급 3 × 슬롯 6) + 악세사리 30 (K-0037). 재질만 Poly Haven CC0 사진.

  blender -b --factory-startup -P tools/world-forge/build_equip.py -- --id eq_past_2_chest --out <절대>/eq_past_2_chest.glb [--style toon]
  blender -b --factory-startup -P tools/world-forge/build_equip.py -- --all --out-dir <절대 폴더> [--style toon]
  blender -b --factory-startup -P tools/world-forge/build_equip.py -- --list

**좌표 규약(엔진이 읽는 규칙)**: 조각의 원점 = 붙일 뼈의 머리(head) 위치, 몸은 T-자세(VRM 쉼 자세), 인물이 보는 쪽 = Blender -Y(glTF +Z).
단위 m, 기준 몸 = UAL 표준 몸(골반 0.92m·어깨 1.44m). 엔진은 조각을 그 뼈의 자식으로 붙이고, 몸마다 `ref_len` 대비 뼈 길이 비로 균등 배율을 곱한다(`data/equip_slots.json`).
슬롯 6 = head(J_Bip_C_Head)·chest(J_Bip_C_Chest)·shoulder(L UpperArm)·arm(L LowerArm)·leg(L LowerLeg)·boot(L Foot). shoulder·arm·leg·boot 는 **왼쪽** 한 짝만 있고 오른쪽은 X 축 -1 배율로 거울.
GLB 안 빈 노드: `attach`(원점, 뼈 머리). license.json 에 `bone`(J_Bip 이름)·`slot`·`mirror`·`era`·`grade`.
시대 = past(가죽·강철) / present(전술복·플라스틱) / future(흰 장갑·발광 띠). 등급 1 민무늬 · 2 장식·발광 한 줄 · 3 금·보석·크기 +8%.
삼각형 ≤ 600(조각), 악세사리 ≤ 500. 원작 장비 이름·모양 모사 금지(일반 이름).
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
from build_prop import tube, obox, A, arg  # noqa: E402
from wf_shapes import loft, plate, surf, ring, ball  # noqa: E402,F401

BP.TRIS_MAX = 600
BP.GENERATOR = 'tools/world-forge/build_equip.py'
NODES = []
ERAS = ('past', 'present', 'future')
SLOTS = ('head', 'chest', 'shoulder', 'arm', 'leg', 'boot')
BONE = {'head': 'J_Bip_C_Head', 'chest': 'J_Bip_C_Chest', 'shoulder': 'J_Bip_L_UpperArm', 'arm': 'J_Bip_L_LowerArm', 'leg': 'J_Bip_L_LowerLeg', 'boot': 'J_Bip_L_Foot'}
MIRROR = {'head': False, 'chest': False, 'shoulder': True, 'arm': True, 'leg': True, 'boot': True}
# 시대 × 등급 → (주 색, 보조 색, 발광 색 또는 None)
PAL = {
    ('past', 1): ('#7a5a3c', '#8d8f94', None), ('past', 2): ('#a9b4c2', '#b89a4a', '#ffd86a'), ('past', 3): ('#e6bc48', '#8a2a2a', '#ff7a30'),
    ('present', 1): ('#5a6a4a', '#2c2e33', None), ('present', 2): ('#a08a62', '#3a3d44', '#ffe7a8'), ('present', 3): ('#1c1e22', '#4a4e58', '#ff4a3a'),
    ('future', 1): ('#dfe6ee', '#8a94a2', None), ('future', 2): ('#dfe6ee', '#4a5a6a', '#58e3ff'), ('future', 3): ('#f2ead0', '#d8b56a', '#c06aff'),
}


def node(name, pos=(0, 0, 0)):
    NODES.append((name, tuple(pos)))


class Pal:
    def __init__(self, C, era, g):
        main, sec, glow = PAL[(era, g)]
        self.era, self.g, self.k = era, g, 1.0 + 0.04 * (g - 1)
        mat = {'past': ('brown_planks_03', 0.6), 'present': ('white_stucco', 0.6), 'future': ('white_stucco', 0.6)}[era]
        metal_era = era == 'past' and g >= 2
        self.main = C.s('concrete_wall_001', 0.8, main, gain=1.3, sat=1.1) if (metal_era or era == 'future') else C.s(mat[0], mat[1], main)
        self.sec = C.s('concrete_wall_001', 0.8, sec, gain=1.2)
        self.cloth = C.s('white_stucco', 0.6, sec if era != 'past' else '#6a3a30')
        self.glow = C.s('white_stucco', 1.0, glow, gain=1.8) if glow else None
        self.dark = C.s('black_painted_planks', 0.8)

    def s(self, v):
        return v * self.k


# ---------------------------------------------------------------- 갑옷 슬롯 6 (뼈 기준 좌표, T-자세)
# 10-06 재설계: 상자·원통 → 몸을 따라가는 곡면 껍데기(surf). 눈 판정 "종이 상자 갑옷" 후속.

def head(C, p):
    """투구 — 얼굴 앞이 열린 돔(아래 줄은 뒤·옆 260°, 이마 위로 갈수록 닫힘). 시대: 옛 = 코 가리개·깃, 지금 = 가림 띠, 미래 = 발광 바이저·지느러미."""
    M, s = C.M, p.s
    prof = [(-0.01, 0.132, 1.25), (0.05, 0.142, 1.2), (0.11, 0.141, 1.0), (0.15, 0.130, 0.0), (0.19, 0.104, 0.0), (0.22, 0.062, 0.0), (0.236, 0.004, 0.0)]
    rows, cen = [], []
    for i, (z, r, gap) in enumerate(prof):              # gap = 앞(얼굴)을 비우는 반각(라디안) — 10-06 얼굴 전체가 보이게 넓힘, 볼 가리개만 남는다
        rows.append(ring('z', (0, 0.01, s(z)), s(r), s(r * 1.08), 16, gap, 2 * math.pi - gap, closed=False))   # 각 0 = 앞 — 앞을 비운다
        cen.append((0, 0.01, s(z)))
    surf(M, rows, cen, p.main, closed=False)
    if p.era == 'past':
        plate(M, [(-0.010, 0.0), (0.010, 0.0), (0.016, 0.075), (-0.016, 0.075)], (0, -s(0.146), s(0.075)), (1, 0, 0), (0, 0, 1), 0.005, p.sec, bevel=0.004)   # 코 가리개 — 이마에서 콧등까지만
        if p.g >= 2:
            plate(M, [(0.0, 0.0), (0.16, 0.02), (0.20, 0.10), (0.04, 0.09)], (0, s(0.08), s(0.2)), (0, -1, 0), (0, 0, 1), 0.008, p.cloth, bevel=0.01)
    elif p.era == 'present':
        surf(M, [ring('z', (0, 0.0, s(0.10)), s(0.148), s(0.158), 10, -1.0, 1.0, closed=False),
                 ring('z', (0, 0.0, s(0.13)), s(0.148), s(0.158), 10, -1.0, 1.0, closed=False)],
             [(0, 0, s(0.10)), (0, 0, s(0.13))], p.dark, closed=False)
    else:
        surf(M, [ring('z', (0, 0.0, s(0.08)), s(0.15), s(0.16), 10, -1.1, 1.1, closed=False),
                 ring('z', (0, 0.0, s(0.12)), s(0.15), s(0.16), 10, -1.1, 1.1, closed=False)],
             [(0, 0, s(0.08)), (0, 0, s(0.12))], p.glow or p.sec, closed=False)
        plate(M, [(0.0, 0.0), (0.16, 0.0), (0.1, 0.12)], (0, s(0.02), s(0.2)), (0, 1, 0), (0, 0, 1), 0.008, p.sec, bevel=0.01)
    if p.g == 3 and p.glow is not None:
        tube(M, (0, -s(0.15), s(0.15)), (0, -s(0.165), s(0.15)), 0.022, 0.012, p.glow, 0.3, 6)
    node('attach')


def _cuirass_prof(z):
    """흉갑 단면 (rx, 앞 깊이, 등 깊이, 가운데 y) — 높이 z 에서 선형 보간. 앞은 부풀고 등은 평평하다."""
    P = ((-0.15, 0.170, 0.120, 0.104, -0.004), (-0.07, 0.150, 0.110, 0.098, -0.006), (0.02, 0.154, 0.116, 0.098, -0.010),
         (0.12, 0.166, 0.130, 0.100, -0.016), (0.21, 0.168, 0.128, 0.100, -0.014), (0.31, 0.156, 0.110, 0.098, -0.006))
    if z <= P[0][0]:
        return P[0][1:]
    for a, b in zip(P, P[1:]):
        if z <= b[0]:
            f = (z - a[0]) / (b[0] - a[0])
            return tuple(a[k] + (b[k] - a[k]) * f for k in range(1, 5))
    return P[-1][1:]


def _cuirass_pt(t, z, out=0.0):
    """각 t(0 = 앞)·높이 z 의 껍데기 점. 앞 가운데는 능선(keel)이 살짝 솟는다. out = 바깥으로 더 민 거리(가장자리 말림)."""
    rx, ryf, ryb, cy = _cuirass_prof(z)
    c, sn = math.cos(t), math.sin(t)
    ry = ryf if c >= 0 else ryb
    keel = 0.010 * max(0.0, c) ** 8 * max(0.0, min(1.0, (z + 0.06) / 0.1, (0.3 - z) / 0.08))
    return (sn * (rx + out), cy - c * (ry + out) - keel, z)


def _cuirass_top(t):
    """윗선 — 앞 가운데 목 파임, 등은 조금 높게, 옆(팔 밑)은 깊게 판 팔 구멍."""
    c, sn = math.cos(t), abs(math.sin(t))
    return 0.30 - 0.04 * max(0.0, c) ** 2 + 0.015 * max(0.0, -c) ** 2 - 0.12 * sn ** 4


def _cuirass_bot(t):
    """밑선 — 앞 가운데가 뾰족하게 내려온다(배를 덮는 끝)."""
    return -0.13 - 0.035 * max(0.0, math.cos(t)) ** 4


def cuirass(M, s, slot, rim, n=20, fr=(0.0, 0.14, 0.32, 0.5, 0.68, 0.84, 1.0)):
    """흉갑 껍데기(목 파임·팔 구멍·앞 능선·뾰족한 밑선) + 위·아래 가장자리 말림 테(rim 재질)."""
    ts = [2 * math.pi * k / n for k in range(n)]
    pt = lambda t, z, out=0.0: tuple(s(v) for v in _cuirass_pt(t, z, out))
    rows = [[pt(t, _cuirass_bot(t) + (_cuirass_top(t) - _cuirass_bot(t)) * f) for t in ts] for f in fr]
    cen = [(0, s(-0.01), sum(r[2] for r in row) / n) for row in rows]
    surf(M, rows, cen, slot)
    for edge, dz in ((_cuirass_top, -0.014), (_cuirass_bot, 0.014)):       # 말림 테: 가장자리에서 바깥으로 접힌 띠
        a = [pt(t, edge(t)) for t in ts]
        b = [pt(t, edge(t) + dz, 0.012) for t in ts]
        surf(M, [a, b], [(0, s(-0.01), s(edge(0.0)))] * 2, rim)
    return pt


def chest(C, p):
    """흉갑 — 앞은 부풀고 등은 평평한 껍데기에 목 파임·팔 구멍·앞 능선·뾰족한 밑선·말림 테(10-06 "술통" 후속).
    옛 = 밑에 늘어진 허리 비늘판 둘, 지금 = 조끼 주머니·어깨 끈, 미래 = 동력핵·발광 선."""
    M, s = C.M, p.s
    pt = cuirass(M, s, p.main, p.sec)
    fy = lambda z: pt(0.0, z)[1]                          # 앞 가운데 겉면 y
    if p.era == 'past':
        for k in range(2 if p.g >= 2 else 1):            # 허리 비늘판 — 밑선을 따라 바깥으로 벌어지며 겹친다
            z0 = -0.004 - 0.042 * k
            ts = [2 * math.pi * j / 20 for j in range(20)]
            surf(M, [[pt(t, _cuirass_bot(t) + z0, 0.008 + 0.012 * k) for t in ts],
                     [pt(t, _cuirass_bot(t) + z0 - 0.055, 0.024 + 0.012 * k) for t in ts]],
                 [(0, 0, s(_cuirass_bot(0.0) + z0))] * 2, p.sec)
        if p.g >= 2:
            plate(M, [(-0.07, 0.0), (0.07, 0.0), (0.055, 0.11), (0.0, 0.135), (-0.055, 0.11)], (0, fy(0.06) - 0.003, s(0.06)), (1, 0, 0), (0, 0, 1), 0.005, p.sec, bevel=0.012)
    elif p.era == 'present':
        for sx in (-1, 0, 1):
            obox(M, (sx * s(0.075), fy(-0.07) + 0.006 + 0.002 * abs(sx), -s(0.075)), (s(0.06), 0.032, s(0.08)), 0, p.dark, 0.3)  # 탄창 주머니
        for sx in (-1, 1):
            surf(M, [ring('x', (sx * s(0.09), -s(0.01), s(0.29)), s(0.115), s(0.05), 8, -1.4, 1.4, closed=False),
                     ring('x', (sx * s(0.09) + 0.04 * sx, -s(0.01), s(0.29)), s(0.115), s(0.05), 8, -1.4, 1.4, closed=False)],
                 [(sx * s(0.09), -s(0.01), s(0.27)), (sx * s(0.13), -s(0.01), s(0.27))], p.cloth, closed=False)   # 어깨 끈
    else:
        tube(M, (0, fy(0.13) + 0.006, s(0.13)), (0, fy(0.13) - 0.018, s(0.13)), s(0.048), s(0.038), p.glow or p.sec, 0.3, 10)   # 가슴 동력핵
        for sx in (-1, 1):
            t = math.asin(min(0.95, 0.1 / 0.16)) * sx
            for z0, z1 in ((-0.08, 0.04),):
                a, b = pt(t, z0, 0.004), pt(t, z1, 0.004)
                tube(M, a, b, 0.006, 0.006, p.glow or p.sec, 0.3, 4)
    if p.g == 3 and p.glow is not None and p.era != 'future':
        tube(M, (0, fy(0.13) + 0.004, s(0.13)), (0, fy(0.13) - 0.014, s(0.13)), 0.03, 0.02, p.glow, 0.3, 8)
    node('attach')


def shoulder(C, p):
    """어깨 덮개 — 어깨 관절을 덮는 낮은 돔(바깥 끝이 벌어짐) + 팔을 따라 내려가는 겹판 0~2장. 옛 = 뾰족 장식, 지금 = 덧댄 패드, 미래 = 발광 줄.
    10-06: 반지름 0.11 관에 끝이 오므라든 "공" → 팔에 붙는 돔(0.08)·종 모양 끝."""
    M, s = C.M, p.s
    zc = 0.008
    prof = [(-0.035, 0.050), (0.0, 0.078), (0.04, 0.088), (0.085, 0.088), (0.12, 0.095), (0.132, 0.103)]
    rows = [ring('x', (s(x), 0, s(zc)), s(r), s(r * 0.94), 12, -1.75, 1.75, closed=False) for x, r in prof]
    surf(M, rows, [(s(x), 0, s(zc - 0.04)) for x, r in prof], p.main, closed=False)
    for L in range(1, 1 + min(2, p.g - 1 + (p.era == 'past'))):           # 겹판 — 돔 아래로 팔을 따라 한 장씩
        x0, r0 = 0.112 + (L - 1) * 0.042, 0.084 + 0.004 * L
        rows = [ring('x', (s(x0 + dx), 0, s(zc - 0.004 * L)), s(r0 + dr), s((r0 + dr) * 0.94), 10, -1.6, 1.6, closed=False) for dx, dr in ((0.0, 0.0), (0.05, 0.012))]
        surf(M, rows, [(s(x0), 0, s(zc - 0.05)), (s(x0 + 0.05), 0, s(zc - 0.05))], p.sec, closed=False)
    top = zc + 0.088 * 0.94
    if p.era == 'past' and p.g >= 2:
        tube(M, (s(0.05), 0, s(top - 0.01)), (s(0.06), 0, s(top + 0.07)), 0.014, 0.0, p.sec, 0.3, 5)
    if p.era == 'future' and p.glow is not None:
        surf(M, [ring('x', (s(0.07), 0, s(zc)), s(0.092), s(0.087), 12, -1.75, 1.75, closed=False),
                 ring('x', (s(0.08), 0, s(zc)), s(0.092), s(0.087), 12, -1.75, 1.75, closed=False)],
             [(s(0.07), 0, 0), (s(0.08), 0, 0)], p.glow, closed=False)
    if p.era == 'present':
        obox(M, (s(0.05), 0, s(top - 0.012)), (s(0.1), s(0.09), 0.022), 0, p.dark, 0.3)
    node('attach')


def arm(C, p):
    """팔뚝 보호대 — 손목 쪽으로 가늘어지고 양끝이 살짝 벌어지는 타원 관."""
    M, s = C.M, p.s
    prof = [(0.02, 0.058, 0.052), (0.05, 0.052, 0.047), (0.15, 0.047, 0.043), (0.22, 0.044, 0.040), (0.25, 0.050, 0.046)]
    rows = [ring('x', (s(x), 0, 0), s(ry), s(rz), 12) for x, ry, rz in prof]
    surf(M, rows, [(s(x), 0, 0) for x, ry, rz in prof], p.main)
    for x in (0.03, 0.235):
        surf(M, [ring('x', (s(x), 0, 0), s(0.055), s(0.05), 12), ring('x', (s(x + 0.018), 0, 0), s(0.055), s(0.05), 12)],
             [(s(x), 0, 0), (s(x + 0.018), 0, 0)], p.sec)
    if p.glow is not None and p.era != 'present':
        surf(M, [ring('x', (s(0.12), 0, 0), s(0.05), s(0.046), 12), ring('x', (s(0.135), 0, 0), s(0.05), s(0.046), 12)],
             [(s(0.12), 0, 0), (s(0.135), 0, 0)], p.glow)
    if p.g == 3:
        plate(M, [(0.0, 0.0), (0.12, 0.0), (0.1, 0.04), (0.02, 0.04)], (s(0.07), 0, s(0.045)), (1, 0, 0), (0, 1, 0), 0.006, p.sec, bevel=0.008)
    node('attach')


def _lerp_prof(P, z):
    """(z, 값…) 표를 높이 z 에서 선형 보간(양끝 밖은 끝값)."""
    if z <= P[0][0]:
        return P[0][1:]
    for a, b in zip(P, P[1:]):
        if z <= b[0]:
            f = (z - a[0]) / (b[0] - a[0])
            return tuple(a[k] + (b[k] - a[k]) * f for k in range(1, len(a)))
    return P[-1][1:]


def leg(C, p):
    """정강이 받이 — 앞은 정강이에 붙고 뒤는 종아리로 불룩한 단면, 앞 능선, 무릎 뒤가 파인 윗선(발목 위에서 끝나 장화 속으로 들어감) + 무릎 덮개.
    10-06: 무릎~발목 원통(장화 목과 겹쳐 굵은 장대) → 다리 모양 껍데기."""
    M, s = C.M, p.s
    # (z, 옆, 앞, 뒤, 가운데 y) — 무릎~발목 0.43. 반지름은 몸 5명 실측(옷 겉면, 보통 체형 옆 ≤0.075·종아리 뒤 ≤0.10)을 덮게
    P = ((-0.36, 0.060, 0.062, 0.070, 0.0), (-0.30, 0.058, 0.060, 0.076, 0.0), (-0.22, 0.072, 0.064, 0.098, 0.0),
         (-0.13, 0.076, 0.066, 0.104, 0.0), (-0.04, 0.070, 0.068, 0.076, 0.0), (0.03, 0.068, 0.070, 0.068, 0.0))
    n = 14
    ts = [2 * math.pi * k / n for k in range(n)]

    def pt(t, z):
        rx, ryf, ryb, cy = _lerp_prof(P, z)
        c = math.cos(t)
        return (s(math.sin(t) * rx), s(cy - c * (ryf if c >= 0 else ryb) - 0.006 * max(0.0, c) ** 8), s(z))
    zt = lambda t: -0.015 + 0.045 * math.cos(t)          # 앞(무릎) 높고 뒤(오금) 낮다
    rows = [[pt(t, -0.36 + (zt(t) + 0.36) * f) for t in ts] for f in (0.0, 0.2, 0.42, 0.64, 0.84, 1.0)]
    surf(M, rows, [(0, s(0.004), sum(r[2] for r in row) / n) for row in rows], p.main)
    kp = [(0.07, 0.03), (0.03, 0.058), (-0.01, 0.064), (-0.05, 0.055), (-0.08, 0.03)]
    surf(M, [ring('z', (0, -s(0.035), s(z)), s(r), s(r * 0.7), 10, -1.5, 1.5, closed=False) for z, r in kp],
         [(0, -s(0.025), s(z)) for z, r in kp], p.sec, closed=False)
    if p.glow is not None and p.era != 'present':
        a, b = pt(0.0, -0.25), pt(0.0, -0.11)
        tube(M, (a[0], a[1] - 0.004, a[2]), (b[0], b[1] - 0.004, b[2]), 0.006, 0.006, p.glow, 0.3, 4)
    node('attach')


def boot(C, p):
    """장화 — 발목에서 종아리 아래까지 올라가는 낮은 목(위 접단) + 앞으로 둥글게 좁아지는 발등(앞 = -y) + 밑창.
    10-06: 목 0.23 → 0.16(정강이 받이가 위에서 들어온다), 발을 몸 신발 높이로 내림."""
    M, s = C.M, p.s
    shaft = [(-0.06, 0.066, 0.082, -0.012), (0.02, 0.064, 0.078, -0.008), (0.09, 0.062, 0.070, 0.0), (0.15, 0.064, 0.072, 0.0)]   # 아래는 앞으로 부풂(몸 신발 앞코 실측 0.086)
    surf(M, [ring('z', (0, s(cy), s(z)), s(rx), s(ry), 12) for z, rx, ry, cy in shaft], [(0, s(cy), s(z)) for z, rx, ry, cy in shaft], p.main)
    toe = [(0.05, 0.06, 0.064), (-0.02, 0.062, 0.066), (-0.1, 0.057, 0.056), (-0.17, 0.047, 0.042), (-0.205, 0.024, 0.024), (-0.215, 0.002, 0.002)]   # 발등 높임(몸 신발 끝이 비침)
    fz = -0.065                                           # 발 가운데 높이 — 기준 몸 발목은 밑창 위 ~0.13(10-06 실측 4명), 옛 0.015 는 9cm 떠서 몸 신발이 밑으로 보였다
    surf(M, [ring('y', (0, s(y), s(fz)), s(rx), s(rz), 12) for y, rx, rz in toe], [(0, s(y), s(fz)) for y, rx, rz in toe], p.main)
    obox(M, (0, -s(0.075), -s(0.135)), (s(0.12), s(0.29), 0.022), 0, p.dark, 0.3)                                  # 밑창
    surf(M, [ring('z', (0, 0, s(0.13)), s(0.066), s(0.074), 12), ring('z', (0, 0, s(0.165)), s(0.074), s(0.082), 12)],
         [(0, 0, s(0.13)), (0, 0, s(0.165))], p.sec)                                                                  # 위 접단(밖으로 벌어짐)
    if p.era == 'future' and p.glow is not None:
        obox(M, (0, -s(0.17), -s(0.10)), (s(0.1), 0.01, 0.015), 0, p.glow, 0.3)
    node('attach')


SLOT_FN = {'head': head, 'chest': chest, 'shoulder': shoulder, 'arm': arm, 'leg': leg, 'boot': boot}


# ---------------------------------------------------------------- 악세사리 30 (뼈, 거울 여부)

def _m(C, tint, gain=1.2):
    return C.s('concrete_wall_001', 0.8, tint, gain=gain)


def _c(C, tint):
    return C.s('white_stucco', 0.6, tint)


def _g(C, tint, gain=1.8):
    return C.s('white_stucco', 1.0, tint, gain=gain)


ACC = {}


def acc(name, bone, mirror=False):
    def deco(f):
        ACC[name] = (f, bone, mirror)
        return f
    return deco


@acc('acc_cap', 'J_Bip_C_Head')
def a_cap(C):
    M = C.M
    tube(M, (0, 0, 0.1), (0, 0, 0.17), 0.13, 0.11, _c(C, '#3a5a8a'), 0.6, 10)
    tube(M, (0, 0, 0.17), (0, 0, 0.21), 0.11, 0.05, _c(C, '#3a5a8a'), 0.6, 10)
    obox(M, (0, -0.13, 0.12), (0.16, 0.1, 0.015), 0, _c(C, '#2c4a70'), 0.3)
    node('attach')


@acc('acc_hat_wide', 'J_Bip_C_Head')
def a_hat_wide(C):
    M = C.M
    tube(M, (0, 0, 0.11), (0, 0, 0.125), 0.3, 0.3, _c(C, '#b79a5a'), 0.6, 14)
    tube(M, (0, 0, 0.125), (0, 0, 0.22), 0.13, 0.1, _c(C, '#b79a5a'), 0.6, 10)
    tube(M, (0, 0, 0.14), (0, 0, 0.16), 0.135, 0.135, _c(C, '#6a3a30'), 0.3, 10, caps=False)
    node('attach')


@acc('acc_hat_pointed', 'J_Bip_C_Head')
def a_hat_pointed(C):
    M = C.M
    tube(M, (0, 0, 0.11), (0, 0, 0.125), 0.23, 0.23, _c(C, '#4a3a7a'), 0.6, 12)
    tube(M, (0, 0, 0.125), (0, 0.0, 0.4), 0.13, 0.0, _c(C, '#4a3a7a'), 0.6, 10)
    tube(M, (0, 0, 0.14), (0, 0, 0.16), 0.133, 0.133, _g(C, '#ffd86a', 1.4), 0.3, 10, caps=False)
    node('attach')


@acc('acc_headband', 'J_Bip_C_Head')
def a_headband(C):
    tube(C.M, (0, 0, 0.1), (0, 0, 0.13), 0.125, 0.125, _c(C, '#a02a2a'), 0.3, 12, caps=False)
    obox(C.M, (0.12, 0.09, 0.07), (0.02, 0.1, 0.1), 0, _c(C, '#a02a2a'), 0.3)
    node('attach')


@acc('acc_glasses_round', 'J_Bip_C_Head')
def a_glasses(C):
    M = C.M
    m = _m(C, '#3a3d44')
    for sx in (-1, 1):
        tube(M, (sx * 0.045, -0.115, 0.075), (sx * 0.045, -0.125, 0.075), 0.032, 0.032, m, 0.3, 10, caps=False)
        tube(M, (sx * 0.045, -0.118, 0.075), (sx * 0.045, -0.12, 0.075), 0.028, 0.028, _g(C, '#cfe6ff', 0.9), 0.3, 10)
    obox(M, (0, -0.122, 0.078), (0.03, 0.01, 0.008), 0, m, 0.3)
    for sx in (-1, 1):
        obox(M, (sx * 0.095, -0.06, 0.078), (0.008, 0.11, 0.008), 0, m, 0.3)
    node('attach')


@acc('acc_goggles', 'J_Bip_C_Head')
def a_goggles(C):
    M = C.M
    for sx in (-1, 1):
        tube(M, (sx * 0.05, -0.1, 0.1), (sx * 0.05, -0.135, 0.1), 0.045, 0.04, _m(C, '#6a5a3a'), 0.3, 10)
        tube(M, (sx * 0.05, -0.132, 0.1), (sx * 0.05, -0.138, 0.1), 0.034, 0.034, _g(C, '#58e3ff', 1.3), 0.3, 10)
    tube(M, (0, 0, 0.1), (0, 0, 0.125), 0.128, 0.128, _c(C, '#3a2a20'), 0.3, 12, caps=False)
    node('attach')


@acc('acc_mask_half', 'J_Bip_C_Head')
def a_mask(C):
    """반 가면 — 코 아래 얼굴을 감싸는 곡면(콧등 솟음) + 옆 숨구멍. 10-06: 얼굴 앞 납작 상자 → 곡면."""
    M = C.M
    prof = [(-0.015, 0.072, 0.100), (0.015, 0.084, 0.112), (0.045, 0.090, 0.120), (0.07, 0.088, 0.118)]
    rows = []
    for z, rx, ry in prof:
        r = ring('z', (0, 0.0, z), rx, ry, 12, -1.35, 1.35, closed=False)
        rows.append([(x, y - (0.012 * max(0.0, 1 - abs(x) / 0.03) if z > 0.02 else 0.0), zz) for x, y, zz in r])   # 콧등
    surf(M, rows, [(0, 0.0, z) for z, rx, ry in prof], _c(C, '#e8e0d0'), closed=False)
    for sx in (-1, 1):
        tube(M, (sx * 0.062, -0.088, 0.015), (sx * 0.068, -0.096, 0.012), 0.016, 0.016, _c(C, '#2a2a2a'), 0.3, 8)
    node('attach')


@acc('acc_eyepatch', 'J_Bip_C_Head')
def a_eyepatch(C):
    M = C.M
    obox(M, (0.045, -0.12, 0.075), (0.06, 0.012, 0.05), 0, _c(C, '#1a1a1a'), 0.3)
    tube(M, (0, 0, 0.1), (0, 0, 0.115), 0.127, 0.127, _c(C, '#1a1a1a'), 0.3, 12, caps=False)
    node('attach')


@acc('acc_ear_cat', 'J_Bip_C_Head')
def a_ear_cat(C):
    M = C.M
    for sx in (-1, 1):
        tube(M, (sx * 0.07, 0.0, 0.2), (sx * 0.08, 0.0, 0.31), 0.05, 0.0, _c(C, '#c8a070'), 0.3, 4)
        tube(M, (sx * 0.07, -0.01, 0.205), (sx * 0.077, -0.01, 0.285), 0.03, 0.0, _c(C, '#e8a0a0'), 0.3, 4)
    node('attach')


@acc('acc_ear_elf', 'J_Bip_C_Head')
def a_ear_elf(C):
    M = C.M
    for sx in (-1, 1):
        tube(M, (sx * 0.12, 0.0, 0.07), (sx * 0.24, 0.02, 0.15), 0.025, 0.0, _c(C, '#e8c8a8'), 0.3, 4)
    node('attach')


@acc('acc_horns', 'J_Bip_C_Head')
def a_horns(C):
    M = C.M
    for sx in (-1, 1):
        tube(M, (sx * 0.08, 0.0, 0.19), (sx * 0.15, 0.01, 0.27), 0.03, 0.018, _c(C, '#3a2a2a'), 0.3, 6)
        tube(M, (sx * 0.15, 0.01, 0.27), (sx * 0.17, 0.02, 0.36), 0.018, 0.0, _c(C, '#3a2a2a'), 0.3, 6)
    node('attach')


@acc('acc_halo', 'J_Bip_C_Head')
def a_halo(C):
    tube(C.M, (0, 0, 0.31), (0, 0, 0.325), 0.14, 0.14, _g(C, '#ffe07a', 1.8), 0.3, 16, caps=False)
    tube(C.M, (0, 0, 0.315), (0, 0, 0.33), 0.12, 0.12, _g(C, '#ffe07a', 1.8), 0.3, 16, caps=False)
    node('attach')


@acc('acc_crown', 'J_Bip_C_Head')
def a_crown(C):
    M = C.M
    gm = _m(C, '#e6bc48', 1.4)
    tube(M, (0, 0, 0.17), (0, 0, 0.21), 0.125, 0.12, gm, 0.3, 12)
    for k in range(6):
        a = 2 * math.pi * k / 6
        tube(M, (math.cos(a) * 0.12, math.sin(a) * 0.12, 0.21), (math.cos(a) * 0.12, math.sin(a) * 0.12, 0.27), 0.022, 0.0, gm, 0.3, 4)
    tube(M, (0, -0.125, 0.185), (0, -0.13, 0.195), 0.018, 0.012, _g(C, '#ff4a6a', 1.5), 0.3, 6)
    node('attach')


@acc('acc_ribbon', 'J_Bip_C_Head')
def a_ribbon(C):
    M = C.M
    c = _c(C, '#e85a8a')
    for sx in (-1, 1):
        obox(M, (sx * 0.055, 0.1, 0.19), (0.09, 0.025, 0.07), -sx * 25, c, 0.3)
    tube(M, (0, 0.1, 0.19), (0, 0.105, 0.19), 0.018, 0.018, c, 0.3, 6)
    node('attach')


@acc('acc_antenna', 'J_Bip_C_Head')
def a_antenna(C):
    M = C.M
    for sx in (-1, 1):
        tube(M, (sx * 0.1, 0.02, 0.1), (sx * 0.12, 0.0, 0.3), 0.01, 0.008, _m(C, '#8a94a2'), 0.3, 5)
        tube(M, (sx * 0.12, 0.0, 0.3), (sx * 0.12, 0.0, 0.33), 0.02, 0.0, _g(C, '#58e3ff', 1.8), 0.3, 6)
    node('attach')


@acc('acc_holo_visor', 'J_Bip_C_Head')
def a_visor(C):
    M = C.M
    obox(M, (0, -0.14, 0.07), (0.2, 0.01, 0.07), 0, _g(C, '#58e3ff', 1.4), 0.3)
    for sx in (-1, 1):
        obox(M, (sx * 0.105, -0.07, 0.07), (0.01, 0.14, 0.02), 0, _m(C, '#4a5a6a'), 0.3)
    node('attach')


@acc('acc_necklace', 'J_Bip_C_Neck')
def a_necklace(C):
    M = C.M
    tube(M, (0, -0.02, 0.02), (0, -0.02, 0.035), 0.075, 0.075, _m(C, '#e6bc48', 1.3), 0.3, 12, caps=False)
    tube(M, (0, -0.1, -0.045), (0, -0.1, 0.0), 0.025, 0.0, _g(C, '#58b8ff', 1.4), 0.3, 6)
    node('attach')


@acc('acc_scarf', 'J_Bip_C_Neck')
def a_scarf(C):
    M = C.M
    c = _c(C, '#a02a2a')
    tube(M, (0, 0, -0.02), (0, 0, 0.05), 0.085, 0.085, c, 0.4, 12)
    obox(M, (0.04, 0.06, -0.2), (0.07, 0.025, 0.22), 8, c, 0.3)
    obox(M, (0.0, 0.065, -0.17), (0.07, 0.025, 0.18), -6, _c(C, '#c04a4a'), 0.3)
    node('attach')


def _cape(M, slot, rows_p, clasp):
    """망토 — 어깨에서 등으로 늘어지는 곡면(아래로 갈수록 넓고 주름 물결). rows_p = (z, rx, ry). 10-06: 납작한 판 → 곡면."""
    rows = []
    for i, (z, rx, ry) in enumerate(rows_p):
        w = min(1.0, i / 2) * 0.05                       # 아래로 갈수록 주름이 깊다
        r = ring('z', (0, 0.0, z), rx, ry, 14, math.pi - 1.4, math.pi + 1.4, closed=False)
        rows.append([(x * (1 + w * math.sin(k * 2.2)), y * (1 + w * math.sin(k * 2.2)), z) for k, (x, y, _) in enumerate(r)])
    surf(M, rows, [(0, 0.0, z) for z, rx, ry in rows_p], slot, closed=False)
    z0, rx0, ry0 = rows_p[0]
    surf(M, [ring('z', (0, 0.0, z0 + 0.01), rx0 * 0.98, ry0 * 0.98, 14, math.pi - 1.75, math.pi + 1.75, closed=False),
             ring('z', (0, 0.0, z0 - 0.035), rx0 * 1.04, ry0 * 1.04, 14, math.pi - 1.75, math.pi + 1.75, closed=False)],
         [(0, 0, z0), (0, 0, z0 - 0.03)], clasp, closed=False)                                        # 깃


@acc('acc_cape_short', 'J_Bip_C_UpperChest')
def a_cape_short(C):
    M = C.M
    _cape(M, _c(C, '#6a2a3a'), [(0.07, 0.15, 0.115), (-0.05, 0.19, 0.15), (-0.22, 0.21, 0.175), (-0.42, 0.23, 0.195)], _c(C, '#4a1a28'))
    for sx in (-1, 1):
        ball(M, (sx * 0.1, -0.075, 0.05), 0.018, _m(C, '#e6bc48'))
    node('attach')


@acc('acc_cape_long', 'J_Bip_C_UpperChest')
def a_cape_long(C):
    M = C.M
    _cape(M, _c(C, '#2a3a6a'), [(0.07, 0.15, 0.115), (-0.05, 0.19, 0.15), (-0.25, 0.215, 0.18), (-0.5, 0.24, 0.205), (-0.72, 0.26, 0.225), (-0.9, 0.275, 0.24)], _c(C, '#e8e0d0'))
    node('attach')


@acc('acc_backpack', 'J_Bip_C_UpperChest')
def a_backpack(C):
    """배낭 — 둥근 모서리 몸통(위 돔) + 앞주머니 + 아래 말이 + 어깨끈. 10-06: 상자 → 곡면."""
    M = C.M
    cy = 0.205
    prof = [(-0.42, 0.115, 0.055), (-0.40, 0.135, 0.072), (-0.12, 0.14, 0.078), (0.0, 0.13, 0.072), (0.04, 0.10, 0.056), (0.06, 0.04, 0.03)]
    surf(M, [ring('z', (0, cy, z), rx, ry, 14) for z, rx, ry in prof], [(0, cy, z) for z, rx, ry in prof], _c(C, '#6a5a3a'))
    pk = [(-0.36, 0.1, 0.098), (-0.33, 0.11, 0.108), (-0.16, 0.11, 0.108), (-0.13, 0.095, 0.096)]
    surf(M, [ring('z', (0, cy - 0.01, z), rx, ry, 10, math.pi - 1.0, math.pi + 1.0, closed=False) for z, rx, ry in pk],
         [(0, cy, z) for z, rx, ry in pk], _c(C, '#4a3a22'), closed=False)                           # 앞주머니
    tube(M, (-0.15, cy, -0.47), (0.15, cy, -0.47), 0.05, 0.05, _c(C, '#a0a8b0'), 0.4, 10)            # 아래 말이(담요)
    for sx in (-1, 1):
        pts = [(sx * 0.09, 0.13, -0.02), (sx * 0.09, 0.07, 0.085), (sx * 0.09, -0.04, 0.09), (sx * 0.09, -0.1, 0.0), (sx * 0.1, -0.11, -0.22)]
        for a, b in zip(pts, pts[1:]):
            tube(M, a, b, 0.014, 0.014, _c(C, '#4a3a22'), 0.3, 5)
    node('attach')


@acc('acc_quiver', 'J_Bip_C_UpperChest')
def a_quiver(C):
    M = C.M
    tube(M, (0.06, 0.16, -0.3), (-0.04, 0.2, 0.0), 0.06, 0.06, _c(C, '#5a3a22'), 0.4, 8)
    for k in range(4):
        tube(M, (-0.04 + 0.025 * (k % 2), 0.2, -0.01), (-0.07 + 0.025 * (k % 2) - 0.02 * k, 0.22, 0.14), 0.008, 0.008, _m(C, '#c8b88a'), 0.3, 4)
        obox(M, (-0.07 + 0.025 * (k % 2) - 0.02 * k, 0.22, 0.13), (0.03, 0.01, 0.04), 0, _c(C, '#a02a2a'), 0.3)
    node('attach')


@acc('acc_wings_small', 'J_Bip_C_UpperChest')
def a_wings(C):
    """작은 날개 — 등에서 옆·위로 펼친 깃 두 겹(아래 끝 깃 물결). 10-06: 세로 막대 여섯 → 날개 판."""
    M = C.M
    big = [(0.0, 0.0), (0.08, 0.1), (0.2, 0.2), (0.32, 0.24), (0.36, 0.2), (0.3, 0.1), (0.25, 0.05), (0.27, -0.02), (0.2, -0.03),
           (0.21, -0.1), (0.14, -0.08), (0.13, -0.15), (0.07, -0.1), (0.02, -0.06)]
    small = [(0.0, 0.0), (0.08, 0.08), (0.18, 0.13), (0.24, 0.12), (0.2, 0.06), (0.21, 0.0), (0.14, 0.0), (0.13, -0.06), (0.06, -0.04)]
    for sx in (-1, 1):
        for out, y, tint in ((big, 0.13, '#f0f0f8'), (small, 0.122, '#d8dce8')):
            o = [(sx * u, v) for u, v in out]
            if sx < 0:
                o = list(reversed(o))
            plate(M, o, (sx * 0.035, y, 0.0), (1, 0, 0), (0, 0, 1), 0.008, _c(C, tint), bevel=0.03)
    node('attach')


@acc('acc_tail_fox', 'J_Bip_C_Hips')
def a_tail_fox(C):
    M = C.M
    for z, r, y in ((0.0, 0.05, 0.1), (0.1, 0.09, 0.2), (0.22, 0.12, 0.3), (0.36, 0.09, 0.36)):
        tube(M, (0, y - 0.06, z - 0.05), (0, y + 0.03, z + 0.1), r, r * 0.9, _c(C, '#c8783a'), 0.3, 8)
    tube(M, (0, 0.38, 0.4), (0, 0.42, 0.52), 0.07, 0.0, _c(C, '#f2ead8'), 0.3, 8)
    node('attach')


@acc('acc_tail_cat', 'J_Bip_C_Hips')
def a_tail_cat(C):
    M = C.M
    pts = [(0, 0.08, -0.02), (0, 0.2, 0.05), (0, 0.3, 0.2), (0, 0.32, 0.38), (0, 0.28, 0.52)]
    for i in range(4):
        tube(M, pts[i], pts[i + 1], 0.035 - 0.004 * i, 0.03 - 0.004 * i, _c(C, '#4a4a52'), 0.3, 6)
    tube(M, pts[4], (0, 0.26, 0.58), 0.02, 0.0, _c(C, '#4a4a52'), 0.3, 6)
    node('attach')


@acc('acc_belt_pouch', 'J_Bip_C_Hips')
def a_belt_pouch(C):
    M = C.M
    tube(M, (0, 0, -0.04), (0, 0, 0.02), 0.19, 0.19, _c(C, '#4a3a22'), 0.4, 12, caps=False)
    pc = (0.175, -0.05)                                    # 10-06: 상자 → 둥근 주머니(아래 볼록) + 덮개
    prof = [(-0.15, 0.025, 0.018), (-0.14, 0.048, 0.036), (-0.08, 0.052, 0.04), (-0.03, 0.05, 0.038), (-0.02, 0.03, 0.02)]
    surf(M, [ring('z', (pc[0], pc[1], z), rx, ry, 10) for z, rx, ry in prof], [(pc[0], pc[1], z) for z, rx, ry in prof], _c(C, '#6a5a3a'))
    fl = [(-0.015, 0.054, 0.042), (-0.07, 0.056, 0.044)]
    surf(M, [ring('z', (pc[0], pc[1], z), rx, ry, 10, -1.6, 1.6, closed=False) for z, rx, ry in fl], [(pc[0], pc[1], z) for z, rx, ry in fl], _c(C, '#4a3a22'), closed=False)
    ball(M, (pc[0], pc[1] - 0.046, -0.068), 0.01, _m(C, '#c8b88a'), n=5)
    node('attach')


@acc('acc_sash', 'J_Bip_C_Hips')
def a_sash(C):
    M = C.M
    c = _c(C, '#c04a3a')
    tube(M, (0, 0, -0.04), (0, 0, 0.04), 0.195, 0.195, c, 0.4, 12, caps=False)
    for x0, ln, lean, tint in ((-0.1, 0.3, -0.05, c), (-0.05, 0.25, 0.04, _c(C, '#a0302a'))):   # 10-06: 상자 → 끝이 갈라진 띠 자락
        plate(M, [(-0.03, 0.0), (0.03, 0.0), (0.035 + lean, -ln), (lean, -ln + 0.035), (-0.035 + lean, -ln)], (x0, -0.2, -0.02), (1, 0, 0), (0, 0, 1), 0.006, tint, bevel=0.01)
    ball(M, (-0.075, -0.205, -0.01), 0.03, c, n=6)                                                   # 매듭
    node('attach')


def _pad(M, slot, r=0.068):
    """어깨 받침 — 위팔 뼈 머리를 덮는 낮은 돔(갑옷 어깨와 같은 꼴, 작게). 어깨 겉면 실측 ~0.06."""
    prof = [(-0.03, r * 0.66), (0.0, r), (0.05, r * 1.1), (0.10, r * 1.03), (0.12, r * 1.1)]
    surf(M, [ring('x', (x, 0, 0.004), rr, rr * 0.94, 12, -1.7, 1.7, closed=False) for x, rr in prof],
         [(x, 0, -0.04) for x, rr in prof], slot, closed=False)
    return 0.004 + r * 1.1 * 0.94                       # 돔 꼭대기 높이


@acc('acc_shoulder_gem', 'J_Bip_L_UpperArm', True)
def a_shoulder_gem(C):
    M = C.M
    top = _pad(M, _m(C, '#e6bc48', 1.3), 0.062)
    tube(M, (0.05, 0, top - 0.01), (0.05, 0, top + 0.012), 0.03, 0.026, _m(C, '#b8902a', 1.2), 0.3, 8)
    ball(M, (0.05, 0, top + 0.03), 0.024, _g(C, '#ff4a6a', 1.6))
    node('attach')


@acc('acc_shoulder_fur', 'J_Bip_L_UpperArm', True)
def a_shoulder_fur(C):
    """털 어깨 — 받침 돔 위 둥근 털 뭉치가 어깨선을 따라 줄지어 덮는다."""
    M = C.M
    c = _c(C, '#d8d0c0')
    _pad(M, _c(C, '#6a5a3a'), 0.064)
    for k in range(9):
        x = -0.02 + 0.13 * (k // 3) / 2
        a = (k % 3 - 1) * 0.95
        ball(M, (x, math.sin(a) * 0.07, 0.006 + math.cos(a) * 0.066), 0.034 - 0.004 * (k // 3), c, n=5)
    node('attach')


@acc('acc_earring', 'J_Bip_C_Head', True)
def a_earring(C):
    M = C.M
    tube(M, (0.115, 0.0, 0.03), (0.115, 0.0, -0.03), 0.01, 0.01, _m(C, '#e6bc48', 1.3), 0.3, 5)
    tube(M, (0.115, 0.0, -0.03), (0.115, 0.0, -0.07), 0.022, 0.0, _g(C, '#58b8ff', 1.4), 0.3, 6)
    node('attach')


@acc('acc_jetpack_small', 'J_Bip_C_UpperChest')
def a_jetpack(C):
    M = C.M
    for sx in (-1, 1):
        tube(M, (sx * 0.09, 0.18, -0.4), (sx * 0.09, 0.18, 0.0), 0.06, 0.055, _m(C, '#8a94a2'), 0.4, 8)
        tube(M, (sx * 0.09, 0.18, -0.4), (sx * 0.09, 0.18, -0.46), 0.055, 0.04, _g(C, '#58e3ff', 1.8), 0.3, 8)
    obox(M, (0, 0.12, -0.1), (0.3, 0.05, 0.2), 0, _m(C, '#4a5a6a'), 0.4)
    node('attach')


@acc('acc_pauldron_spike', 'J_Bip_L_UpperArm', True)
def a_pauldron_spike(C):
    M = C.M
    top = _pad(M, _m(C, '#6a6a72'), 0.07)
    for k in range(3):
        x = 0.0 + 0.045 * k
        tube(M, (x, 0, top - 0.02), (x + 0.02 * (k - 1), 0, top + 0.07 + 0.015 * (1 - abs(k - 1))), 0.02, 0.0, _m(C, '#8a8a92'), 0.3, 5)
    node('attach')


@acc('acc_wrist_band', 'J_Bip_L_LowerArm', True)
def a_wrist_band(C):
    M = C.M
    tube(M, (0.18, 0, 0), (0.23, 0, 0), 0.04, 0.04, _c(C, '#3a3a42'), 0.3, 8, caps=False)
    tube(M, (0.2, 0, 0), (0.21, 0, 0), 0.043, 0.043, _g(C, '#58e3ff', 1.5), 0.3, 8, caps=False)
    node('attach')


def acc_names():
    return list(ACC)


# ---------------------------------------------------------------- 만들기

ARMOR_IDS = [f'eq_{e}_{g}_{s}' for e in ERAS for g in (1, 2, 3) for s in SLOTS]
ALL_IDS = ARMOR_IDS + acc_names()


def build_scene(pid, out, style):
    del NODES[:]
    bpy.ops.wm.read_factory_settings(use_empty=True)
    W._mat_cache.clear()
    W.set_style(style)
    C = BP.Ctx(pid)
    meta = {}
    if pid.startswith('eq_'):
        _, era, g, slot = pid.split('_')
        SLOT_FN[slot](C, Pal(C, era, int(g)))
        meta = {'kind': 'armor', 'era': era, 'grade': int(g), 'slot': slot, 'bone': BONE[slot], 'mirror': MIRROR[slot]}
        lim = 600
    else:
        f, bone, mirror = ACC[pid]
        f(C)
        meta = {'kind': 'accessory', 'bone': bone, 'mirror': mirror}
        lim = 500
    ob = C.M.build()
    tris = sum(len(p.vertices) - 2 for p in ob.data.polygons)
    pts = [Vector(c) for c in ob.bound_box]
    lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
    hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    size = [round(hi[i] - lo[i], 2) for i in range(3)]
    objs = [ob]
    for name, pos in NODES:
        e = bpy.data.objects.new(name, None)
        e.empty_display_type = 'ARROWS'
        e.empty_display_size = 0.05
        e.location = Vector(pos)
        bpy.context.scene.collection.objects.link(e)
        objs.append(e)
    bpy.context.view_layer.objects.active = ob
    os.makedirs(os.path.dirname(os.path.abspath(out)), exist_ok=True)
    W.export_glb(objs, out, int(os.environ.get('WF_TOON_PX', '256')) if style == 'toon' else 1024, 'JPEG' if style == 'toon' else 'AUTO')
    lic = {'id': pid, 'generator': BP.GENERATOR, 'blender': bpy.app.version_string, 'style': style, 'license': 'CC0-1.0 (재질 사진 전부 Poly Haven CC0, 형태는 전부 코드)',
           'inputs': sorted(f'polyhaven: {m}' for m in C.mats), 'size_m': size, 'tris': tris, 'nodes': [n[0] for n in NODES],
           'origin': '붙일 뼈의 머리(T-자세 기준 몸, 인물 앞 = Blender -Y)'}
    lic.update(meta)
    json.dump(lic, open(os.path.splitext(out)[0] + '.license.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    kb = os.path.getsize(out) // 1024
    print('WORLDFORGE', json.dumps({'id': pid, 'tris': tris, 'size_m': size, 'kb': kb, 'ok': tris <= lim and (style != 'toon' or kb <= 300)}))


if __name__ == '__main__':
    style = arg('--style', 'real')
    if '--list' in A:
        print('ARMOR', ' '.join(ARMOR_IDS))
        print('ACCESSORY', ' '.join(acc_names()))
    elif '--all' in A:
        d = arg('--out-dir')
        for pid in ALL_IDS:
            build_scene(pid, os.path.join(d, pid + '.glb'), style)
    else:
        build_scene(arg('--id'), arg('--out'), style)
