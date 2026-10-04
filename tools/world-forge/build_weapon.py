"""world-forge 무기 세트 — 검·창·도끼·단검·활·지팡이·총·방패·장갑 9종 × 등급 3(보통·희귀·전설) = 27벌 (K-0030). 재질만 Poly Haven CC0 사진.

  blender -b --factory-startup -P tools/world-forge/build_weapon.py -- --id wpn_sword_rare --out <절대>/wpn_sword_rare.glb [--style toon]
  blender -b --factory-startup -P tools/world-forge/build_weapon.py -- --all --out-dir <절대 폴더> [--style toon]
  blender -b --factory-startup -P tools/world-forge/build_weapon.py -- --list

id = `wpn_<종류>_<common|rare|legend>`. 원점 = 손바닥 가운데(`grip`), 단위 m, z 위, +y 앞(날 면이 향하는 쪽).
**소켓 규약(빈 노드 이름 — 엔진이 이름으로 찾는다)**: `grip` 손바닥 중심(원점) · `tip` 날끝·총구·머리 위(조준축 끝) · `up` 무기의 "위쪽"(롤을 맞추는 점) ·
활은 `nock`(시위·화살 걸이)·`tip_low`(아래 끝), 방패는 `face`(방패 앞면 중심). grip→tip 벡터가 조준축이다 — 검·창·도끼·단검·지팡이는 +z, 총은 +y(총구), 활은 +z(위 끝),
방패는 +y(앞면 쪽), 장갑은 +y(주먹 앞). 엔진은 그 축을 손뼈 "앞" 방향에, up 을 손등 쪽에 맞추면 된다. 활·방패는 왼손, 나머지는 오른손(`license.json` 의 `hand`).
등급 = 색만 바꾸지 않는다 — 보통: 철·민무늬 / 희귀: 강청색 날·황동 장식·보석 한 점·크기 +8% / 전설: 금 장식·날개 날밑·발광 보석·크기 +15%.
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


def sword(C, t):
    M = C.M
    s = t.s
    tube(M, (0, 0, -s(0.12)), (0, 0, s(0.12)), 0.022, 0.022, t.grip, 0.4, 7)
    for i in range(4 + t.rank):
        z = -s(0.10) + i * s(0.045)
        tube(M, (0, 0, z), (0, 0, z + 0.012), 0.027, 0.027, t.trim, 0.3, 7, caps=False)
    tube(M, (0, 0, -s(0.17)), (0, 0, -s(0.12)), 0.032, 0.026, t.trim, 0.4, 7)
    gw = 0.20 + 0.06 * t.rank
    obox(M, (0, 0, s(0.13)), (s(gw), 0.04, 0.035), 0, t.trim, 0.4)
    if t.rank >= 1:
        for sx in (-1, 1):
            tube(M, (sx * s(gw) / 2, 0, s(0.13)), (sx * s(gw) / 2, 0, s(0.16)), 0.026, 0.018, t.trim, 0.3, 6)
    if t.rank == 2:
        for sx in (-1, 1):
            obox(M, (sx * s(gw) * 0.62, 0, s(0.15)), (s(0.12), 0.03, 0.05), 0, t.trim, 0.3)
    bl = 0.78 + 0.0 * t.rank
    obox(M, (0, 0, s(0.165)), (0.085, 0.02, s(bl) * 0.82), 0, t.blade, 0.5)
    tube(M, (0, 0, s(0.165 + bl * 0.82)), (0, 0, s(0.165 + bl)), 0.0425, 0.0, t.blade, 0.5, 4)
    obox(M, (0, 0.012, s(0.2)), (0.02, 0.006, s(bl * 0.7)), 0, t.trim, 0.3)                 # 피 홈(밝은 줄)
    gem_at(M, t, (0, 0.03, s(0.13)), 0.022)
    node('grip', (0, 0, 0))
    node('tip', (0, 0, s(0.165 + bl)))
    node('up', (0, 0, 0.5))


def spear(C, t):
    M = C.M
    s = t.s
    tube(M, (0, 0, -s(0.7)), (0, 0, s(1.4)), 0.02, 0.018, t.grip, 0.4, 7)
    tube(M, (0, 0, s(1.4)), (0, 0, s(1.46)), 0.028, 0.028, t.trim, 0.3, 7)
    obox(M, (0, 0, s(1.46)), (0.09, 0.022, s(0.32)), 0, t.blade, 0.5)
    tube(M, (0, 0, s(1.78)), (0, 0, s(1.98)), 0.045, 0.0, t.blade, 0.5, 4)
    if t.rank >= 1:
        for sx in (-1, 1):
            tube(M, (sx * 0.03, 0, s(1.48)), (sx * 0.1, 0, s(1.4)), 0.012, 0.01, t.trim, 0.3, 4)
    for i in range(3 + t.rank * 2):
        z = -s(0.55) + i * s(0.2)
        tube(M, (0, 0, z), (0, 0, z + 0.015), 0.024, 0.024, t.trim, 0.3, 7, caps=False)
    if t.rank >= 1:
        tube(M, (0, 0, s(1.4)), (0, 0, s(1.42)), 0.05, 0.03, t.cloth, 0.3, 8)
    gem_at(M, t, (0, 0.03, s(1.55)), 0.02)
    node('grip', (0, 0, 0))
    node('tip', (0, 0, s(1.98)))
    node('up', (0, 0, 0.5))


def axe(C, t):
    M = C.M
    s = t.s
    tube(M, (0, 0, -s(0.25)), (0, 0, s(0.95)), 0.024, 0.02, t.grip, 0.4, 7)
    tube(M, (0, 0, -s(0.28)), (0, 0, -s(0.22)), 0.032, 0.03, t.trim, 0.3, 7)
    obox(M, (0, 0, s(0.78)), (0.05, 0.07, s(0.2)), 0, t.trim, 0.3)                       # 머리 중심
    wid = 0.24 + 0.04 * t.rank
    obox(M, (0, s(wid) * 0.55, s(0.78)), (0.025, s(wid), s(0.27)), 0, t.blade, 0.5)       # 날(+y)
    tube(M, (0, s(wid) * 1.05, s(0.77)), (0, s(wid) * 1.05, s(0.99)), 0.014, 0.014, t.blade, 0.3, 4)
    obox(M, (0, -s(0.08), s(0.82)), (0.04, s(0.1), s(0.1)), 0, t.trim, 0.3)               # 뒷면 못
    if t.rank == 2:
        obox(M, (0, -s(wid) * 0.55, s(0.78)), (0.025, s(wid), s(0.27)), 0, t.blade, 0.5)   # 양날
    for i in range(3 + t.rank):
        z = -s(0.15) + i * s(0.16)
        tube(M, (0, 0, z), (0, 0, z + 0.014), 0.028, 0.028, t.trim, 0.3, 7, caps=False)
    gem_at(M, t, (0.03, 0, s(0.8)), 0.02)
    node('grip', (0, 0, 0))
    node('tip', (0, 0, s(1.0)))
    node('up', (0, 0.5, 0))


def dagger(C, t):
    M = C.M
    s = t.s
    tube(M, (0, 0, -s(0.09)), (0, 0, s(0.08)), 0.02, 0.02, t.grip, 0.4, 7)
    tube(M, (0, 0, -s(0.13)), (0, 0, -s(0.09)), 0.028, 0.022, t.trim, 0.3, 7)
    obox(M, (0, 0, s(0.09)), (s(0.1 + 0.03 * t.rank), 0.03, 0.025), 0, t.trim, 0.3)
    obox(M, (0, 0, s(0.11)), (0.055, 0.016, s(0.28)), 0, t.blade, 0.5)
    tube(M, (0, 0, s(0.39)), (0, 0, s(0.53)), 0.0275, 0.0, t.blade, 0.5, 4)
    if t.rank >= 1:
        obox(M, (0, 0.009, s(0.14)), (0.012, 0.005, s(0.22)), 0, t.trim, 0.3)
    gem_at(M, t, (0, 0.025, s(0.09)), 0.016)
    node('grip', (0, 0, 0))
    node('tip', (0, 0, s(0.53)))
    node('up', (0, 0, 0.5))


def bow(C, t):
    M = C.M
    s = t.s
    L = s(0.78)
    n = 8
    pts = [(0.0, 0.18 * (1 - (i / n) ** 2) * (1.0 if i else 1.0), L * i / n) for i in range(n + 1)]
    seg = []
    for sgn in (1, -1):
        for i in range(n):
            a = (0, pts[i][1], sgn * pts[i][2])
            b = (0, pts[i + 1][1], sgn * pts[i + 1][2])
            r0 = 0.03 - 0.015 * i / n
            r1 = 0.03 - 0.015 * (i + 1) / n
            tube(M, a, b, r0, r1, t.grip if t.rank == 0 else t.blade if i % 2 else t.grip, 0.4, 5)
    tube(M, (0, 0.0, -s(0.1)), (0, 0.0, s(0.1)), 0.034, 0.034, t.cloth, 0.3, 7)                # 손잡이 감개
    top, low = (0, pts[n][1], L), (0, pts[n][1], -L)
    tube(M, top, low, 0.004, 0.004, t.cloth, 0.2, 3, caps=False)                                # 시위
    if t.rank >= 1:
        for sgn in (-1, 1):
            tube(M, (0, pts[n][1], sgn * L), (0, pts[n][1] + 0.03, sgn * (L + 0.04)), 0.014, 0.01, t.trim, 0.3, 5)
    gem_at(M, t, (0, 0.05, s(0.12)), 0.02)
    node('grip', (0, 0, 0))
    node('tip', top)
    node('tip_low', low)
    node('nock', (0, -0.04, 0))
    node('up', (0, 0.5, 0))


def staff(C, t):
    M = C.M
    s = t.s
    tube(M, (0, 0, -s(0.65)), (0, 0, s(1.15)), 0.026, 0.022, t.grip, 0.4, 7)
    for i in range(3 + t.rank * 2):
        z = -s(0.5) + i * s(0.22)
        tube(M, (0, 0, z), (0, 0, z + 0.016), 0.03, 0.03, t.trim, 0.3, 7, caps=False)
    tube(M, (0, 0, s(1.15)), (0, 0, s(1.22)), 0.04, 0.05, t.trim, 0.3, 7)
    for k in range(3 + t.rank):                                                                 # 머리를 감싼 발톱
        a = 2 * math.pi * k / (3 + t.rank)
        tube(M, (math.cos(a) * 0.045, math.sin(a) * 0.045, s(1.22)), (math.cos(a) * 0.1, math.sin(a) * 0.1, s(1.4)), 0.014, 0.008, t.trim, 0.3, 4)
    orb = t.gem if t.gem is not None else t.blade
    for z, r in ((s(1.27), 0.05), (s(1.33), 0.07), (s(1.4), 0.06), (s(1.46), 0.035)):
        tube(M, (0, 0, z), (0, 0, z + s(0.06)), r, r, orb, 0.3, 8, caps=False)
    tube(M, (0, 0, s(1.24)), (0, 0, s(1.27)), 0.04, 0.05, orb, 0.3, 8)
    tube(M, (0, 0, s(1.52)), (0, 0, s(1.56)), 0.03, 0.0, orb, 0.3, 8)
    node('grip', (0, 0, 0))
    node('tip', (0, 0, s(1.56)))
    node('up', (0, 0, 0.5))


def gun(C, t):
    """권총형(원작 모양 모사 없음) — 총구 +y, 손잡이는 아래 +z 쪽이 아니라 -z, grip = 손잡이 가운데."""
    M = C.M
    s = t.s
    tube(M, (0, -0.01, -s(0.1)), (0, 0.02, s(0.06)), 0.024, 0.024, t.grip, 0.4, 7)         # 손잡이(살짝 기움)
    obox(M, (0, s(0.05), s(0.1)), (0.05, s(0.26), 0.07), 0, t.blade, 0.5)                    # 몸통(슬라이드)
    tube(M, (0, s(0.16), s(0.135)), (0, s(0.42), s(0.135)), 0.019, 0.017, t.blade, 0.5, 7)      # 총열
    tube(M, (0, s(0.42), s(0.135)), (0, s(0.45), s(0.135)), 0.024, 0.024, t.trim, 0.3, 7)       # 총구 테
    obox(M, (0, s(0.06), s(0.062)), (0.02, 0.035, 0.05), 0, t.trim, 0.3)                      # 방아쇠 울
    obox(M, (0, s(0.0), s(0.17)), (0.02, 0.025, 0.02), 0, t.trim, 0.3)                       # 가늠자
    if t.rank >= 1:
        obox(M, (0, s(0.17), s(0.165)), (0.012, s(0.18), 0.012), 0, t.trim, 0.3)               # 위 레일
    gem_at(M, t, (0.03, s(0.12), s(0.1)), 0.014)
    if t.gem is not None:
        obox(M, (0, s(0.2), s(0.07)), (0.052, s(0.12), 0.01), 0, t.gem, 0.3)                    # 발광 띠
    node('grip', (0, 0, 0))
    node('tip', (0, s(0.45), s(0.135)))
    node('up', (0, 0, 0.5))


def shield(C, t):
    """방패 — 앞면 +y, 원판형 + 테. grip = 안쪽 손잡이."""
    M = C.M
    s = t.s
    R = s(0.4)
    face = t.blade if t.rank else C.s('brown_planks_03', 1.0, '#7a5a3a')
    n = 16
    # 원판은 y 축 방향 원기둥 — tube 는 p0→p1 축을 그대로 쓴다
    tube(M, (0, 0.0, 0.0), (0, 0.05, 0.0), R, R * 0.97, face, 0.8, n)
    tube(M, (0, 0.045, 0.0), (0, 0.06, 0.0), R * 1.02, R * 1.02, t.trim, 0.3, n, caps=False)       # 테
    tube(M, (0, 0.05, 0.0), (0, 0.11, 0.0), R * 0.2, R * 0.12, t.trim, 0.3, 10)                      # 가운데 볼록
    if t.rank >= 1:
        for k in range(6):
            a = 2 * math.pi * k / 6
            tube(M, (math.cos(a) * R * 0.72, 0.052, math.sin(a) * R * 0.72), (math.cos(a) * R * 0.72, 0.075, math.sin(a) * R * 0.72), 0.02, 0.014, t.trim, 0.3, 6)
    if t.rank == 2:
        for k in range(8):
            a = 2 * math.pi * k / 8
            obox(M, (math.cos(a) * R * 0.45, 0.056, math.sin(a) * R * 0.45), (0.03, 0.01, R * 0.34), -math.degrees(a) + 90, t.trim, 0.3)
    obox(M, (0, -0.02, 0), (R * 0.9, 0.025, 0.04), 0, t.dark, 0.3)                                  # 안쪽 가로대
    obox(M, (0, -0.04, 0), (0.05, 0.04, 0.1), 0, t.grip, 0.3)                                       # 손잡이
    gem_at(M, t, (0, 0.12, 0.0), 0.04)
    node('grip', (0, 0, 0))
    node('tip', (0, 0.12, 0))
    node('face', (0, 0.06, 0))
    node('up', (0, 0, 0.5))


def gauntlet(C, t):
    """맨손 장갑 — 주먹 앞 +y. 한쪽 손에 낀다."""
    M = C.M
    s = t.s
    leather = t.cloth
    obox(M, (0, 0.0, -s(0.04)), (0.09, 0.1, 0.08), 0, leather, 0.3)                              # 손바닥·손등
    for i in range(4):
        x = -0.033 + i * 0.022
        obox(M, (x, s(0.06), -s(0.03)), (0.02, s(0.07), 0.05), 0, leather, 0.3)                   # 접힌 손가락
    obox(M, (0.0, s(0.095), 0.0), (0.09, 0.03, 0.04), 0, t.trim, 0.3)                           # 너클 판
    for i in range(4):
        tube(M, (-0.033 + i * 0.022, s(0.115), 0.0), (-0.033 + i * 0.022, s(0.13), 0.0), 0.012, 0.008, t.blade, 0.3, 5)
    tube(M, (0, -0.1, -0.005), (0, -0.0, -0.005), 0.052, 0.046, t.cloth, 0.3, 8)                    # 손목 소매
    tube(M, (0, -0.16, -0.005), (0, -0.1, -0.005), 0.062, 0.052, t.trim, 0.3, 8)                    # 팔뚝 보호대
    if t.rank >= 1:
        obox(M, (0, -0.06, 0.04), (0.06, 0.1, 0.012), 0, t.trim, 0.3)
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
