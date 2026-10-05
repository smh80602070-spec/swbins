"""world-forge 무기 세트 — 검·창·도끼·단검·활·지팡이·총·방패·장갑 9종 × 등급 3(보통·희귀·전설) = 27벌 (K-0030). 재질만 Poly Haven CC0 사진.

  blender -b --factory-startup -P tools/world-forge/build_weapon.py -- --id wpn_sword_rare --out <절대>/wpn_sword_rare.glb [--style toon]
  blender -b --factory-startup -P tools/world-forge/build_weapon.py -- --all --out-dir <절대 폴더> [--style toon]
  blender -b --factory-startup -P tools/world-forge/build_weapon.py -- --list

id = `wpn_<종류>_<common|rare|legend>`. 원점 = 손바닥 가운데(`grip`), 단위 m, z 위, +y 앞(날 면이 향하는 쪽).
**소켓 규약(빈 노드 이름 — 엔진이 이름으로 찾는다)**: `grip` 손바닥 중심(원점) · `tip` 날끝·총구·머리 위(조준축 끝) · `up` 무기의 "위쪽"(롤을 맞추는 점) ·
활은 `nock`(시위·화살 걸이)·`tip_low`(아래 끝), 방패는 `face`(방패 앞면 중심). grip→tip 벡터가 조준축이다 — 검·창·도끼·단검·지팡이는 +z, 총은 +y(총구), 활은 +z(위 끝),
방패는 +y(앞면 쪽), 장갑은 +y(주먹 앞). 엔진은 그 축을 손뼈 "앞" 방향에, up 을 손등 쪽에 맞추면 된다. 활·방패는 왼손, 나머지는 오른손(`license.json` 의 `hand`).
등급 = **실루엣이 다르다**(10-06 재설계 — 색만 바꾼 상자 형태가 눈 판정 불합격): 날은 `loft`(마름모 단면이 가늘어지는 날), 도끼날·날밑·방패·총은 `plate`(윤곽 → 가장자리가 얇은 판).
보통 = 기본꼴 / 희귀 = 꼴이 바뀜(나뭇잎 날·수염 도끼·리커브·연꼴 방패 …) + 강청색·황동·보석 / 전설 = 가장 화려한 꼴(물결 날·초승달 양날·고리 지팡이 …) + 금·발광 보석.
삼각형 ≤ 1500. 원작 무기 이름·고유 모양을 쓰지 않는다(일반 이름).
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
from wf_shapes import loft, plate, ball  # noqa: E402

BP.TRIS_MAX = 1500
BP.GENERATOR = 'tools/world-forge/build_weapon.py'
NODES = []
GRADES = ('common', 'rare', 'legend')
KINDS = ('sword', 'spear', 'axe', 'dagger', 'bow', 'staff', 'gun', 'shield', 'gauntlet')
HAND = {'bow': 'L', 'shield': 'L'}
PAL = {  # 등급 → 날 색, 장식 색, 자루 색, 보석 색(None=없음), 크기 배율
    'common': ('#8d8f94', '#6e6a62', '#5a4632', None, 1.0),
    'rare': ('#6fa6dc', '#b89a4a', '#3e4a64', '#ffd86a', 1.08),
    'legend': ('#e9d27a', '#f0b84a', '#6a2a2a', '#ff7a30', 1.15),
}


def node(name, pos):
    NODES.append((name, tuple(pos)))


class T:
    """등급 도우미 — 재질 칸과 배율."""

    def __init__(self, C, g):
        self.g = g
        self.rank = GRADES.index(g)
        blade, trim, grip, gem, k = PAL[g]
        self.k = k
        self.blade = C.s('concrete_wall_001', 1.0, blade, gain=1.3, sat=1.1)
        self.trim = C.s('concrete_wall_001', 1.0, trim, gain=1.25)
        self.grip = C.s('brown_planks_03', 0.6, grip)
        self.cloth = C.s('white_stucco', 0.6, grip)
        self.gem = C.s('white_stucco', 1.0, gem, gain=1.8) if gem else None
        self.dark = C.s('black_painted_planks', 0.8)

    def s(self, v):
        return v * self.k


def gem_at(M, t, pos, r=0.025):
    if t.gem is None:
        return
    x, y, z = pos
    tube(M, (x, y, z - r), (x, y, z + r), r, r * 0.4, t.gem, 0.3, 6)
    tube(M, (x, y, z - r * 1.6), (x, y, z - r), r * 0.4, r, t.gem, 0.3, 6)


def grip_wrap(M, t, z0, z1, r, rings):
    tube(M, (0, 0, z0), (0, 0, z1), r, r, t.grip, 0.4, 7)
    for i in range(rings):
        z = z0 + (z1 - z0) * (i + 0.5) / rings
        tube(M, (0, 0, z - 0.006), (0, 0, z + 0.006), r * 1.18, r * 1.18, t.trim if i % 2 else t.cloth, 0.3, 7, caps=False)


def mirror_x(pts):
    """오른쪽 반 윤곽(아래→위) 을 왼쪽에 거울로 붙여 반시계 윤곽으로."""
    return [(x, y) for x, y in pts] + [(-x, y) for x, y in reversed(pts) if abs(x) > 1e-6]


def sword(C, t):
    """보통 = 곧은 양날검 · 희귀 = 가운데가 부푼 나뭇잎 날 + 위로 휜 날밑 · 전설 = 물결 날(넓음) + 날개 날밑·발광 보석."""
    M = C.M
    s = t.s
    grip_wrap(M, t, -s(0.11), s(0.11), 0.021, 5)
    ball(M, (0, 0, -s(0.145)), 0.034 + 0.006 * t.rank, t.trim)
    g = s(0.115)
    if t.rank == 0:
        guard = [(0.0, -0.016), (0.11, -0.012), (0.125, 0.0), (0.11, 0.014), (0.0, 0.02)]
    elif t.rank == 1:
        guard = [(0.0, -0.018), (0.09, -0.016), (0.14, 0.02), (0.15, 0.06), (0.125, 0.045), (0.085, 0.016), (0.0, 0.024)]
    else:
        guard = [(0.0, -0.03), (0.06, -0.026), (0.12, 0.0), (0.2, 0.05), (0.23, 0.11), (0.17, 0.075), (0.15, 0.09), (0.1, 0.045), (0.05, 0.03), (0.0, 0.034)]
    plate(M, mirror_x(guard), (0, 0, g), (1, 0, 0), (0, 0, 1), 0.02, t.trim, bevel=0.008, te=0.008)
    z0 = g + 0.03
    L = s(0.8 + 0.06 * t.rank)
    if t.rank == 0:
        prof = [(0.0, 0.034), (0.15, 0.033), (0.7, 0.026), (0.88, 0.016), (1.0, 0.0)]
        secs = [(z0 + L * f, 0, w, 0.011 * (1 - 0.6 * f) + 0.002) for f, w in prof]
    elif t.rank == 1:
        prof = [(0.0, 0.03), (0.2, 0.029), (0.5, 0.036), (0.68, 0.045), (0.82, 0.036), (0.93, 0.018), (1.0, 0.0)]
        secs = [(z0 + L * f, 0, w, 0.011 * (1 - 0.6 * f) + 0.002) for f, w in prof]
    else:
        secs = []
        for i in range(13):
            f = i / 12
            w = (0.05 - 0.012 * f) * (1 + 0.16 * math.sin(f * math.pi * 7)) if i < 12 else 0.0
            secs.append((z0 + L * f, 0, w if i < 12 else 0.0, 0.012 * (1 - 0.5 * f) + 0.002))
    loft(M, secs, t.blade)
    if t.rank >= 1:
        loft(M, [(z0, 0, 0.012, 0.0135), (z0 + L * 0.55, 0, 0.008, 0.0125), (z0 + L * 0.6, 0, 0.0, 0.0)], t.trim)   # 등 줄(피 홈 장식)
    gem_at(M, t, (0, 0.024, g + 0.01), 0.018 + 0.006 * t.rank)
    node('grip', (0, 0, 0))
    node('tip', (0, 0, z0 + L))
    node('up', (0, 0, 0.5))


def dagger(C, t):
    """보통 = 곧은 단검 · 희귀 = 앞으로 휜 날(쿠크리 꼴) · 전설 = 물결 날 + 고리 손잡이."""
    M = C.M
    s = t.s
    grip_wrap(M, t, -s(0.08), s(0.07), 0.018, 3)
    ball(M, (0, 0, -s(0.1)), 0.026, t.trim)
    g = s(0.075)
    gw = 0.05 + 0.02 * t.rank
    plate(M, mirror_x([(0.0, -0.012), (gw, -0.008), (gw + 0.012, 0.006), (gw * 0.6, 0.014), (0.0, 0.016)]), (0, 0, g), (1, 0, 0), (0, 0, 1), 0.015, t.trim, bevel=0.006, te=0.006)
    z0 = g + 0.02
    L = s(0.3 + 0.03 * t.rank)
    n = 8
    secs = []
    for i in range(n + 1):
        f = i / n
        if t.rank == 0:
            cx, w = 0.0, 0.027 * (1 - f ** 1.6)
        elif t.rank == 1:
            cx, w = 0.05 * f * f, (0.026 + 0.018 * math.sin(f * math.pi * 0.9)) * (1 - f ** 2.2)
        else:
            cx, w = 0.012 * math.sin(f * math.pi * 4), 0.03 * (1 - f ** 1.4)
        secs.append((z0 + L * f, cx, w if i < n else 0.0, 0.009 * (1 - 0.6 * f) + 0.0015))
    loft(M, secs, t.blade)
    if t.rank == 2:
        for k in range(8):                                                                     # 손잡이 끝 고리
            a0, a1 = 2 * math.pi * k / 8, 2 * math.pi * (k + 1) / 8
            r, cz = 0.03, -s(0.1) - 0.04
            tube(M, (r * math.cos(a0), 0, cz + r * math.sin(a0)), (r * math.cos(a1), 0, cz + r * math.sin(a1)), 0.006, 0.006, t.trim, 0.3, 5)
    gem_at(M, t, (0, 0.02, g + 0.005), 0.014)
    node('grip', (0, 0, 0))
    node('tip', (secs[-1][1], 0, z0 + L))
    node('up', (0, 0, 0.5))


def spear(C, t):
    """보통 = 나뭇잎 창날 · 희귀 = 날개 달린 창(옆 갈고리 둘) · 전설 = 언월(휜 큰 날) + 뒤 가시."""
    M = C.M
    s = t.s
    tube(M, (0, 0, -s(0.7)), (0, 0, s(1.4)), 0.019, 0.017, t.grip, 0.4, 7)
    tube(M, (0, 0, -s(0.76)), (0, 0, -s(0.7)), 0.012, 0.022, t.trim, 0.3, 7)                     # 물미
    tube(M, (0, 0, s(1.38)), (0, 0, s(1.47)), 0.024, 0.018, t.trim, 0.3, 7)                     # 투겁
    for i in range(2 + t.rank):
        z = -s(0.15) + i * s(0.12)
        tube(M, (0, 0, z), (0, 0, z + 0.03), 0.022, 0.022, t.cloth, 0.3, 7, caps=False)
    z0 = s(1.47)
    if t.rank < 2:
        L = s(0.48 + 0.08 * t.rank)
        prof = [(0.0, 0.02), (0.25, 0.068), (0.45, 0.075), (0.75, 0.045), (1.0, 0.0)]
        loft(M, [(z0 + L * f, 0, w, 0.016 * (1 - 0.6 * f) + 0.002) for f, w in prof], t.blade)
        tip = z0 + L
        if t.rank == 1:
            for sx in (-1, 1):
                lug = [(0.015, 0.0), (0.17, -0.045), (0.2, -0.015), (0.045, 0.075)]                   # 옆 갈고리
                plate(M, [(sx * x, z) for x, z in lug], (0, 0, z0 - 0.02), (1, 0, 0), (0, 0, 1), 0.01, t.blade, bevel=0.006)
    else:
        L = s(0.7)
        crescent = [(x * 1.5, z * 1.5) for x, z in [(0.0, 0.0), (0.06, -0.02), (0.13, 0.02), (0.15, 0.12), (0.12, 0.26), (0.05, 0.42), (0.06, 0.25), (0.06, 0.12), (0.0, 0.08)]]
        plate(M, crescent, (0.0, 0, z0), (1, 0, 0), (0, 0, 1), 0.012, t.blade, bevel=0.025)
        loft(M, [(z0, 0, 0.012, 0.012), (z0 + L * 0.9, 0, 0.01, 0.008), (z0 + L, 0, 0.0, 0.0)], t.blade)   # 가운데 찌르는 끝
        plate(M, [(0.0, 0.02), (0.0, 0.08), (-0.11, 0.03)], (0, 0, z0), (1, 0, 0), (0, 0, 1), 0.01, t.trim, bevel=0.008)  # 뒤 가시
        tube(M, (0, 0, z0 - 0.02), (0, 0, z0 + 0.01), 0.04, 0.028, t.cloth, 0.3, 8)
        tip = z0 + L
    gem_at(M, t, (0, 0.022, z0 + 0.01), 0.016)
    node('grip', (0, 0, 0))
    node('tip', (0, 0, tip))
    node('up', (0, 0, 0.5))


def axe(C, t):
    """날은 +y. 보통 = 작은 외날 · 희귀 = 아래로 늘어진 수염 도끼 · 전설 = 큰 초승달 양날 + 위 가시."""
    M = C.M
    s = t.s
    H = s(0.92)
    tube(M, (0, 0, -s(0.28)), (0, 0, H + 0.04), 0.022, 0.019, t.grip, 0.4, 7)
    ball(M, (0, 0, -s(0.29)), 0.03, t.trim)
    for i in range(2 + t.rank):
        z = -s(0.2) + i * s(0.07)
        tube(M, (0, 0, z), (0, 0, z + 0.02), 0.025, 0.025, t.cloth, 0.3, 7, caps=False)
    obox(M, (0, 0, H - 0.1), (0.05, 0.06, 0.16), 0, t.trim, 0.3)                              # 자루 구멍 둘레
    k = s(1.0)
    if t.rank == 0:
        bit = [(0.02, -0.05), (0.1, -0.06), (0.19, -0.1), (0.215, -0.02), (0.215, 0.05), (0.19, 0.11), (0.1, 0.06), (0.02, 0.05)]
    elif t.rank == 1:
        bit = [(0.02, -0.04), (0.08, -0.06), (0.13, -0.2), (0.2, -0.24), (0.25, -0.12), (0.26, 0.02), (0.23, 0.12), (0.12, 0.07), (0.02, 0.05)]
    else:
        bit = [(0.02, -0.05), (0.09, -0.06), (0.2, -0.22), (0.27, -0.24), (0.3, -0.1), (0.31, 0.04), (0.29, 0.16), (0.22, 0.26), (0.18, 0.18), (0.1, 0.07), (0.02, 0.05)]
    bit = [(x * k, z * k) for x, z in bit]
    plate(M, bit, (0, 0, H - 0.02), (0, 1, 0), (0, 0, 1), 0.016, t.blade, bevel=0.035)
    if t.rank == 2:
        plate(M, [(-x, z) for x, z in reversed(bit)], (0, 0, H - 0.02), (0, 1, 0), (0, 0, 1), 0.016, t.blade, bevel=0.035)
        loft(M, [(H + 0.02, 0, 0.018, 0.018), (H + 0.13, 0, 0.0, 0.0)], t.trim)
    else:
        plate(M, [(-0.02, -0.035), (-0.02, 0.035), (-0.08, 0.012), (-0.08, -0.012)], (0, 0, H - 0.02), (0, 1, 0), (0, 0, 1), 0.02, t.trim, bevel=0.008)
    gem_at(M, t, (0.03, 0, H - 0.03), 0.018)
    node('grip', (0, 0, 0))
    node('tip', (0, 0, H + 0.05))
    node('up', (0, 0.5, 0))


def bow(C, t):
    """보통 = 단순 활 · 희귀 = 끝이 앞으로 젖혀진 리커브 · 전설 = 리커브 + 날개 장식판·발광 보석."""
    M = C.M
    s = t.s
    L = s(0.8)
    n = 10

    def limb(f):
        y = 0.16 * math.sin(f * math.pi / 2) ** 0.9
        if t.rank >= 1 and f > 0.78:
            y -= 0.26 * ((f - 0.78) / 0.22) ** 2                                             # 끝을 앞(-y)으로 젖힘
        return y

    for sgn in (1, -1):
        for i in range(n):
            f0, f1 = i / n, (i + 1) / n
            r0, r1 = 0.026 - 0.015 * f0, 0.026 - 0.015 * f1
            tube(M, (0, -limb(f0) + 0.16, sgn * L * f0), (0, -limb(f1) + 0.16, sgn * L * f1), r0, r1,
                 t.grip if (t.rank == 0 or i % 3) else t.blade, 0.4, 6)
    tube(M, (0, 0.16, -s(0.1)), (0, 0.16, s(0.1)), 0.03, 0.03, t.cloth, 0.3, 7)
    top, low = (0, -limb(1) + 0.16, L), (0, -limb(1) + 0.16, -L)
    tube(M, top, low, 0.003, 0.003, t.cloth, 0.2, 3, caps=False)
    if t.rank == 2:
        for sgn in (1, -1):
            plate(M, [(0.0, 0.0), (0.0, 0.16), (-0.1, 0.1), (-0.05, 0.04)] if sgn > 0 else [(0.0, 0.0), (-0.05, -0.04), (-0.1, -0.1), (0.0, -0.16)],
                  (0, 0.1, sgn * s(0.2)), (0, 1, 0), (0, 0, 1), 0.006, t.trim, bevel=0.01)
    gem_at(M, t, (0, 0.2, s(0.12)), 0.018)
    node('grip', (0, 0, 0))
    node('tip', top)
    node('tip_low', low)
    node('nock', (top[0], top[1], 0))
    node('up', (0, 0.5, 0))


def staff(C, t):
    """보통 = 옹이진 나무 지팡이 · 희귀 = 끝이 갈고리처럼 말려 보석을 문 지팡이 · 전설 = 머리에 큰 고리 + 가운데 떠 있는 보석·조각."""
    M = C.M
    s = t.s
    H = s(1.2)
    pts = [(0.012 * math.sin(i * 1.7), 0.01 * math.cos(i * 2.3), -s(0.65) + (H + s(0.65)) * i / 7) for i in range(8)]
    for i in range(7):
        tube(M, pts[i], pts[i + 1], 0.024 - 0.002 * i / 7, 0.024 - 0.002 * (i + 1) / 7, t.grip, 0.4, 7)
    for i in range(2 + t.rank):
        z = -s(0.1) + i * s(0.1)
        tube(M, (0, 0, z), (0, 0, z + 0.025), 0.027, 0.027, t.cloth, 0.3, 7, caps=False)
    top = Vector(pts[-1])
    orb = t.gem if t.gem is not None else t.blade
    if t.rank == 0:
        ball(M, tuple(top + Vector((0, 0, 0.06))), 0.075, t.grip)
        for a in (0.4, 2.5, 4.4):                                                              # 잔가지
            tube(M, tuple(top), tuple(top + Vector((math.cos(a) * 0.13, math.sin(a) * 0.13, 0.16))), 0.016, 0.004, t.grip, 0.3, 5)
        tip = top.z + 0.14
    elif t.rank == 1:
        prev = top
        for i in range(1, 9):                                                                  # 말린 갈고리
            a = i / 8 * math.pi * 1.3
            p = top + Vector((0.14 * (1 - math.cos(a)), 0, 0.14 * math.sin(a) + 0.05 * i / 8))
            tube(M, tuple(prev), tuple(p), 0.022 - 0.0012 * i, 0.022 - 0.0012 * (i + 1), t.grip, 0.3, 6)
            prev = p
        ball(M, tuple(top + Vector((0.13, 0, 0.09))), 0.06, orb)
        tip = top.z + 0.19
    else:
        c = top + Vector((0, 0, 0.24))
        R = 0.19
        for k in range(14):
            a0, a1 = 2 * math.pi * k / 14, 2 * math.pi * (k + 1) / 14
            tube(M, tuple(c + Vector((R * math.cos(a0), 0, R * math.sin(a0)))), tuple(c + Vector((R * math.cos(a1), 0, R * math.sin(a1)))), 0.014, 0.014, t.trim, 0.3, 6)
        tube(M, tuple(top), tuple(c - Vector((0, 0, R))), 0.03, 0.016, t.trim, 0.3, 7)
        loft(M, [(c.z - 0.09, 0, 0.0001, 0.0001), (c.z, 0, 0.075, 0.075), (c.z + 0.12, 0, 0.0, 0.0)], orb)            # 가운데 떠 있는 보석(팔면체)
        for a in (0.6, 2.2, 3.8, 5.3):
            p = c + Vector((R * 1.35 * math.cos(a), 0.02, R * 1.35 * math.sin(a)))
            loft(M, [(p.z - 0.025, p.x, 0.0001, 0.0001), (p.z, p.x, 0.016, 0.016), (p.z + 0.03, p.x, 0.0, 0.0)], orb)
        tip = c.z + R + 0.02
    node('grip', (0, 0, 0))
    node('tip', (0, 0, tip))
    node('up', (0, 0, 0.5))


def gun(C, t):
    """권총형 한 판(옆 윤곽 → 두께) — 총구 +y. 보통 = 짧은 권총 · 희귀 = 긴 총열·조준경 · 전설 = 에너지 고리 셋·발광 띠."""
    M = C.M
    s = t.s
    k = s(1.0)
    Lb = 0.24 + 0.08 * t.rank
    body = [(-0.04, -0.12), (0.0, -0.12), (0.03, -0.02), (0.06, -0.02), (0.07, -0.06), (0.1, -0.06), (0.1, 0.02),
            (Lb, 0.03), (Lb, 0.1), (-0.06, 0.1), (-0.07, 0.04), (-0.02, 0.0)]
    body = [(y * k, z * k) for y, z in body]
    plate(M, body, (0, 0, 0.0), (0, 1, 0), (0, 0, 1), 0.022, t.blade, bevel=0.012, te=0.012)
    plate(M, [(0.035, -0.015), (0.06, -0.015), (0.06, -0.05), (0.035, -0.035)], (0, 0, 0), (0, 1, 0), (0, 0, 1), 0.006, t.trim, bevel=0.003, te=0.003)   # 방아쇠
    plate(M, [(-0.03, -0.1), (0.0, -0.1), (0.022, -0.02), (-0.02, 0.0)], (0.023, 0, 0), (0, 1, 0), (0, 0, 1), 0.003, t.grip, bevel=0.004)          # 손잡이 판
    zb = 0.065 * k
    tube(M, (0, Lb * k, zb), (0, (Lb + 0.06) * k, zb), 0.016, 0.016, t.trim, 0.3, 8)
    if t.rank >= 1:
        tube(M, (0, 0.0, 0.125 * k), (0, 0.14 * k, 0.125 * k), 0.016, 0.016, t.dark, 0.3, 8)                     # 조준경
        tube(M, (0, 0.14 * k, 0.125 * k), (0, 0.155 * k, 0.125 * k), 0.02, 0.02, t.trim, 0.3, 8)
        for y in (0.03, 0.11):
            obox(M, (0, y * k, 0.1 * k), (0.012, 0.012, 0.016), 0, t.trim, 0.3)
    if t.rank == 2:
        for i in range(3):
            y = (0.14 + i * 0.06) * k
            tube(M, (0, y, zb), (0, y + 0.02, zb), 0.03, 0.03, t.gem, 0.3, 8)
    if t.gem is not None:
        obox(M, (0.023, 0.12 * k, 0.04 * k), (0.004, 0.12 * k, 0.012), 0, t.gem, 0.3)
    node('grip', (0, 0, 0))
    node('tip', (0, (Lb + 0.06) * k, zb))
    node('up', (0, 0, 0.5))


def shield(C, t):
    """앞면 +y. 보통 = 둥근 나무 방패 · 희귀 = 연(凧)꼴 금속 방패 · 전설 = 날개 달린 방패꼴 + 가운데 큰 보석."""
    M = C.M
    s = t.s
    R = s(0.4)
    if t.rank == 0:
        face = C.s('brown_planks_03', 1.0, '#7a5a3a')
        tube(M, (0, 0.0, 0.0), (0, 0.05, 0.0), R, R * 0.97, face, 0.8, 16)
        tube(M, (0, 0.045, 0.0), (0, 0.062, 0.0), R * 1.03, R * 1.03, t.trim, 0.3, 16, caps=False)
        tube(M, (0, 0.05, 0.0), (0, 0.11, 0.0), R * 0.22, R * 0.1, t.trim, 0.3, 10)
        for k in range(8):
            a = 2 * math.pi * k / 8
            tube(M, (math.cos(a) * R * 0.85, 0.05, math.sin(a) * R * 0.85), (math.cos(a) * R * 0.85, 0.065, math.sin(a) * R * 0.85), 0.012, 0.008, t.trim, 0.3, 5)
    else:
        if t.rank == 1:
            out = [(0.0, -0.62), (0.2, -0.25), (0.3, 0.12), (0.26, 0.3), (0.0, 0.36), (-0.26, 0.3), (-0.3, 0.12), (-0.2, -0.25)]
        else:
            out = [(0.0, -0.5), (0.24, -0.28), (0.32, 0.05), (0.34, 0.3), (0.5, 0.42), (0.36, 0.44), (0.0, 0.36), (-0.36, 0.44), (-0.5, 0.42), (-0.34, 0.3), (-0.32, 0.05), (-0.24, -0.28)]
        out = [(x * R / 0.4, z * R / 0.4) for x, z in out]
        plate(M, out, (0, 0.03, 0), (-1, 0, 0), (0, 0, 1), 0.03, t.blade, bevel=0.06, te=0.012)                    # U×V = +y 앞
        inner = [(x * 0.55, z * 0.55 + 0.02) for x, z in out]
        plate(M, inner, (0, 0.062, 0), (-1, 0, 0), (0, 0, 1), 0.006, t.trim, bevel=0.015)
    obox(M, (0, -0.02, -0.03), (R * 0.9, 0.025, 0.04), 0, t.dark, 0.3)
    obox(M, (0, -0.045, -0.05), (0.05, 0.04, 0.1), 0, t.grip, 0.3)
    gem_at(M, t, (0, 0.1, 0.02), 0.03 + 0.015 * t.rank)
    node('grip', (0, 0, 0))
    node('tip', (0, 0.12, 0))
    node('face', (0, 0.07, 0))
    node('up', (0, 0, 0.5))


def gauntlet(C, t):
    """맨손 장갑 — 주먹 앞 +y. 보통 = 가죽 + 너클 판 · 희귀 = 판금 손등 + 너클 가시 · 전설 = 발톱 셋 + 넓은 팔뚝 갑."""
    M = C.M
    s = t.s
    tube(M, (0, -0.17, -0.005), (0, -0.09, -0.005), 0.06 + 0.008 * t.rank, 0.048, t.trim if t.rank else t.cloth, 0.3, 9)   # 팔뚝(나팔꼴)
    tube(M, (0, -0.09, -0.005), (0, -0.02, -0.005), 0.046, 0.044, t.cloth, 0.3, 9)
    tube(M, (0, -0.03, -0.01), (0, 0.06, -0.01), 0.045, 0.04, t.cloth, 0.3, 8)                   # 손
    for i in range(4):
        x = -0.03 + i * 0.02
        tube(M, (x, 0.055, 0.0), (x, 0.085, -0.02), 0.011, 0.01, t.cloth, 0.3, 6)                   # 접은 손가락 두 마디
        tube(M, (x, 0.085, -0.02), (x, 0.07, -0.05), 0.01, 0.009, t.cloth, 0.3, 6)
    plate(M, [(-0.05, -0.01), (0.05, -0.01), (0.052, 0.012), (-0.052, 0.012)], (0, 0.075, 0.004), (1, 0, 0), (0, 0, 1), 0.012, t.blade, bevel=0.005)   # 너클 판
    if t.rank >= 1:
        plate(M, [(-0.04, -0.08), (0.04, -0.08), (0.045, 0.05), (0.0, 0.07), (-0.045, 0.05)], (0, -0.01, 0.04), (1, 0, 0), (0, 1, 0), 0.006, t.blade, bevel=0.012)   # 손등 판금
        for i in range(4):
            x = -0.03 + i * 0.02
            tube(M, (x, 0.088, 0.004), (x, 0.088 + 0.03 + 0.03 * (t.rank == 2), 0.004), 0.008, 0.0, t.blade, 0.3, 5)
    if t.rank == 2:
        for i in range(3):
            x = -0.025 + i * 0.025
            tube(M, (x, 0.06, 0.03), (x, 0.2, 0.05), 0.008, 0.0, t.gem, 0.3, 4)
    gem_at(M, t, (0, -0.02, 0.05), 0.016)
    node('grip', (0, 0, 0))
    node('tip', (0, s(0.13), 0))
    node('up', (0, 0, 0.5))


FN = {'sword': sword, 'spear': spear, 'axe': axe, 'dagger': dagger, 'bow': bow, 'staff': staff, 'gun': gun, 'shield': shield, 'gauntlet': gauntlet}
ALL = {f'wpn_{k}_{g}': (k, g) for k in KINDS for g in GRADES}


def build_scene(pid, out, style):
    del NODES[:]
    kind, grade = ALL[pid]
    bpy.ops.wm.read_factory_settings(use_empty=True)
    W._mat_cache.clear()
    W.set_style(style)
    C = BP.Ctx(pid)
    FN[kind](C, T(C, grade))
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
    lic = {'id': pid, 'generator': BP.GENERATOR, 'blender': bpy.app.version_string, 'style': style, 'kind': kind, 'grade': grade, 'hand': HAND.get(kind, 'R'),
           'license': 'CC0-1.0 (재질 사진 전부 Poly Haven CC0, 형태는 전부 코드)', 'inputs': sorted(f'polyhaven: {m}' for m in C.mats),
           'size_m': size, 'tris': tris, 'nodes': [n[0] for n in NODES]}
    json.dump(lic, open(os.path.splitext(out)[0] + '.license.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    kb = os.path.getsize(out) // 1024
    print('WORLDFORGE', json.dumps({'id': pid, 'tris': tris, 'size_m': size, 'kb': kb, 'nodes': len(NODES), 'ok': tris <= 1500 and (style != 'toon' or kb <= 300)}))


if __name__ == '__main__':
    style = arg('--style', 'real')
    if '--list' in A:
        print('WEAPONS', ' '.join(ALL))
    elif '--all' in A:
        d = arg('--out-dir')
        for pid in ALL:
            build_scene(pid, os.path.join(d, pid + '.glb'), style)
    else:
        build_scene(arg('--id'), arg('--out'), style)
