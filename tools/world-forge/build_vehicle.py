"""world-forge 탈것 — 돛단배·광차·뗏목·소달구지·대상 수레 다섯을 코드로 (K-0017 단계 2). 재질만 Poly Haven CC0.

  blender -b --factory-startup -P tools/world-forge/build_vehicle.py -- --id raft_01 --out <절대경로>/raft_01.glb [--style toon]
  blender -b --factory-startup -P tools/world-forge/build_vehicle.py -- --all --out-dir <절대경로> [--style toon]

원점 = 바닥(수레는 바퀴 닿는 자리, 배는 용골 아래) 가운데, y = 앞(+)·뒤(-), x = 오른쪽, z 위. 사람·동물은 없다(소달구지는 멍에 막대만).
`data/set_plan.json` 의 vehicle 5개와 같다. 산출 옆에 `<id>.license.json`.
"""
import json
import math
import os
import sys

import bpy
from mathutils import Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import wf_common as W  # noqa: E402
from build_prop import Ctx, tube, obox, gable  # noqa: E402

TRIS_MAX = 5000
A = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []


def arg(k, d=None):
    return A[A.index(k) + 1] if k in A else d


def loft(M, stations, slot_hull, slot_deck, tile=1.2):
    """단면 (y, 위 반폭, 아래 반폭, 아래 z, 위 z) 을 이어 붙인 닫힌 선체."""
    def corners(s):
        y, ht, hb, zb, zt = s
        return (Vector((-hb, y, zb)), Vector((hb, y, zb)), Vector((ht, y, zt)), Vector((-ht, y, zt)))
    for a, b in zip(stations, stations[1:]):
        BL0, BR0, TR0, TL0 = corners(a)
        BL1, BR1, TR1, TL1 = corners(b)
        d = (b[0] - a[0]) / tile
        M.quad(BL0, BR0, BR1, BL1, slot_hull, (0, 0), (1, 0), (1, d), (0, d))
        M.quad(BR0, TR0, TR1, BR1, slot_hull, (0, 0), (1, 0), (1, d), (0, d))
        M.quad(TL0, BL0, BL1, TL1, slot_hull, (0, 0), (1, 0), (1, d), (0, d))
        M.quad(TR0, TL0, TL1, TR1, slot_deck, (0, 0), (1, 0), (1, d), (0, d))
    for s in (stations[0], stations[-1]):
        BL, BR, TR, TL = corners(s)
        M.quad(BL, TL, TR, BR, slot_hull, (0, 0), (0, 1), (1, 1), (1, 0))


def tri_prism(M, p0, p1, p2, thick, slot, tile=1.0):
    """얇은 삼각기둥(돛). thick = 두께 벡터."""
    p0, p1, p2, t = Vector(p0), Vector(p1), Vector(p2), Vector(thick)
    uv = lambda p: (p.y / tile, p.z / tile)
    M.face([p0, p1, p2], [uv(p0), uv(p1), uv(p2)], slot)
    M.face([p0 + t, p2 + t, p1 + t], [uv(p0), uv(p2), uv(p1)], slot)
    for a, b in ((p0, p1), (p1, p2), (p2, p0)):
        M.quad(a, b, b + t, a + t, slot, (0, 0), (1, 0), (1, 1), (0, 1))


def wheel(C, cx, cy, r, wood, metal, spokes=8, rim_seg=12, hub=0.09):
    """축이 x 방향인 수레 바퀴. 바닥에 닿게 중심 z = r."""
    M = C.M
    c = Vector((cx, cy, r))
    tube(M, c + Vector((-0.07, 0, 0)), c + Vector((0.07, 0, 0)), hub, hub, metal, 1.0, 8)
    for k in range(spokes):
        a = 2 * math.pi * k / spokes
        tip = c + Vector((0, math.cos(a) * (r - 0.05), math.sin(a) * (r - 0.05)))
        tube(M, c, tip, 0.03, 0.026, wood, 1.0, 4)
    pts = [c + Vector((0, math.cos(2 * math.pi * k / rim_seg) * r, math.sin(2 * math.pi * k / rim_seg) * r)) for k in range(rim_seg)]
    for k in range(rim_seg):
        tube(M, pts[k], pts[(k + 1) % rim_seg], 0.05, 0.05, metal, 1.0, 5)


def sail_boat_01(C):
    M = C.M
    hull = C.s('brown_planks_03', 1.2, '#7a5538')
    deck = C.s('coated_pine', 1.2)
    cloth = C.s('white_stucco', 1.5, '#efe6d2')
    dark = C.s('black_painted_planks', 1.0)
    stations = [(-2.5, 0.7, 0.5, 0.2, 0.78), (-1.8, 0.95, 0.6, 0.08, 0.72), (-0.8, 1.0, 0.62, 0.0, 0.64),
                (0.4, 0.95, 0.58, 0.0, 0.64), (1.6, 0.7, 0.4, 0.1, 0.72), (2.5, 0.36, 0.18, 0.3, 0.98), (3.1, 0.06, 0.03, 0.55, 1.25)]
    loft(M, stations, hull, deck)
    tube(M, (0, 0.2, 0.64), (0, 0.2, 5.0), 0.09, 0.06, dark, 1.0, 6)                  # 돛대
    obox(M, (0, -0.6, 1.5), (0.07, 2.2, 0.07), 0, dark)                               # 아래 활대
    tri_prism(M, (0, 0.28, 1.55), (0, 0.28, 4.7), (0, -1.55, 1.55), (0.03, 0, 0), cloth)
    tri_prism(M, (0, 0.4, 1.9), (0, 0.4, 4.4), (0, 2.45, 1.0), (0.03, 0, 0), cloth)   # 앞 돛
    obox(M, (0, -2.35, 0.78), (0.14, 0.9, 0.5), 0, dark)                              # 키 손잡이 자리


def mine_cart_01(C):
    M = C.M
    metal = C.s('concrete_wall_001', 1.0, '#4a4d54')
    wood = C.s('brown_planks_03', 1.0, '#6b4a30')
    rust = C.s('corrugated_iron', 1.0, '#7d5a44')
    obox(M, (0, 0, 0.32), (1.0, 1.5, 0.08), 0, metal)                                 # 바닥
    for sx in (-0.5, 0.5):
        obox(M, (sx, 0, 0.32), (0.07, 1.5, 0.62), 0, rust)
    for sy in (-0.75, 0.75):
        obox(M, (0, sy, 0.32), (1.0, 0.07, 0.62), 0, rust)
    for sx in (-0.53, 0.53):                                                          # 윗테(뚜껑 아님, 네 줄)
        obox(M, (sx, 0, 0.94), (0.07, 1.64, 0.06), 0, metal)
    for sy in (-0.79, 0.79):
        obox(M, (0, sy, 0.94), (1.14, 0.07, 0.06), 0, metal)
    for sy in (-0.45, 0.45):                                                          # 차축 + 바퀴
        tube(M, (-0.62, sy, 0.2), (0.62, sy, 0.2), 0.035, 0.035, metal, 1.0, 5)
        for sx in (-0.62, 0.62):
            tube(M, (sx - 0.04, sy, 0.2), (sx + 0.04, sy, 0.2), 0.2, 0.2, metal, 1.0, 10)
    tube(M, (0, 0.78, 0.4), (0, 1.15, 0.4), 0.03, 0.03, metal, 1.0, 5)                # 연결 고리 막대
    for k in range(3):                                                                # 광석 더미
        obox(M, (-0.25 + k * 0.25, 0.1 * (k - 1), 0.4), (0.3, 0.3, 0.3 + 0.06 * k), 20 * k, rust)


def raft_01(C):
    M = C.M
    log = C.s('brown_planks_03', 0.8, '#8a6a45')
    dark = C.s('black_painted_planks', 1.0)
    for k in range(8):
        x = -1.12 + k * 0.32
        tube(M, (x, -1.7, 0.2), (x, 1.7, 0.2), 0.17, 0.15, log, 0.8, 8)
    for y in (-0.9, 0.9):
        obox(M, (0, y, 0.4), (2.6, 0.16, 0.1), 0, dark)
    tube(M, (0.9, -0.2, 0.42), (0.9, -0.2, 2.1), 0.05, 0.04, dark, 1.0, 5)            # 삿대 꽂이
    tube(M, (-0.9, 0.5, 0.42), (-1.15, 0.5, 1.9), 0.04, 0.035, dark, 1.0, 5)


def ox_cart_01(C):
    M = C.M
    wood = C.s('brown_planks_03', 1.0)
    dark = C.s('black_painted_planks', 1.0)
    metal = C.s('concrete_wall_001', 1.0, '#3b3e44')
    obox(M, (0, 0, 0.62), (1.5, 2.2, 0.1), 0, wood)                                    # 바닥
    for sx in (-0.72, 0.72):
        obox(M, (sx, 0, 0.72), (0.08, 2.2, 0.5), 0, wood)
    obox(M, (0, -1.06, 0.72), (1.36, 0.08, 0.5), 0, wood)
    tube(M, (-0.95, 0, 0.55), (0.95, 0, 0.55), 0.045, 0.045, dark, 1.0, 6)            # 차축
    for sx in (-0.88, 0.88):
        wheel(C, sx, 0.0, 0.55, wood, metal)
    tube(M, (0, 0.9, 0.66), (0, 3.3, 0.9), 0.06, 0.05, wood, 1.0, 6)                  # 끌채
    obox(M, (0, 3.3, 0.88), (0.9, 0.08, 0.08), 0, dark)                               # 멍에


def caravan_wagon_01(C):
    M = C.M
    wood = C.s('brown_planks_03', 1.0, '#7a5a3a')
    dark = C.s('black_painted_planks', 1.0)
    cloth = C.s('white_stucco', 1.5, '#e4d2a8')
    metal = C.s('concrete_wall_001', 1.0, '#3b3e44')
    obox(M, (0, 0, 0.72), (2.0, 4.0, 0.1), 0, wood)
    for sx in (-0.95, 0.95):
        obox(M, (sx, 0, 0.82), (0.08, 4.0, 0.6), 0, wood)
    for sy in (-1.96, 1.96):
        obox(M, (0, sy, 0.82), (1.82, 0.08, 0.6), 0, wood)
    for sy in (-1.5, -0.5, 0.5, 1.5):                                                  # 덮개 뼈대 기둥
        for sx in (-0.9, 0.9):
            tube(M, (sx, sy, 1.42), (sx, sy, 2.1), 0.035, 0.035, dark, 1.0, 5)
        obox(M, (0, sy, 2.1), (1.9, 0.06, 0.06), 0, dark)
    gable(M, (0, 0, 2.1), (2.1, 4.1), 0.55, 0, cloth, 1.5)                            # 천 덮개
    for sy in (-1.3, 1.3):
        tube(M, (-1.12, sy, 0.62), (1.12, sy, 0.62), 0.05, 0.05, dark, 1.0, 6)
        for sx in (-1.05, 1.05):
            wheel(C, sx, sy, 0.62, wood, metal, spokes=10, rim_seg=14, hub=0.1)
    tube(M, (0, 1.9, 0.76), (0, 4.6, 0.95), 0.07, 0.055, wood, 1.0, 6)                # 끌채
    obox(M, (0, 4.6, 0.93), (1.2, 0.08, 0.08), 0, dark)
    obox(M, (0, 1.55, 1.45), (1.2, 0.5, 0.08), 0, wood)                                # 마부석


BUILDERS = {f.__name__: f for f in (sail_boat_01, mine_cart_01, raft_01, ox_cart_01, caravan_wagon_01)}


def build(pid, out, style):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    W._mat_cache.clear()
    W.set_style(style)
    C = Ctx(pid)
    BUILDERS[pid](C)
    ob = C.M.build()
    tris = sum(len(p.vertices) - 2 for p in ob.data.polygons)
    pts = [Vector(c) for c in ob.bound_box]
    size = [round(max(p[i] for p in pts) - min(p[i] for p in pts), 2) for i in range(3)]
    os.makedirs(os.path.dirname(os.path.abspath(out)), exist_ok=True)
    W.export_glb([ob], out, int(os.environ.get('WF_TOON_PX', '256')) if style == 'toon' else 1024, 'JPEG' if style == 'toon' else 'AUTO')
    lic = {'id': pid, 'generator': 'tools/world-forge/build_vehicle.py', 'blender': bpy.app.version_string, 'style': style,
           'license': 'CC0-1.0 (재질 사진 전부 Poly Haven CC0, 형태는 전부 코드)',
           'inputs': sorted(f'polyhaven: {m}' for m in C.mats), 'size_m': size, 'tris': tris}
    json.dump(lic, open(os.path.splitext(out)[0] + '.license.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    kb = os.path.getsize(out) // 1024
    print('WORLDFORGE', json.dumps({'id': pid, 'tris': tris, 'size_m': size, 'kb': kb, 'ok': tris <= TRIS_MAX and (style != 'toon' or kb <= 512)}))


if __name__ == '__main__':
    style = arg('--style', 'real')
    if '--list' in A:
        print('VEHICLES', ' '.join(BUILDERS))
    elif '--all' in A:
        d = arg('--out-dir')
        for pid in BUILDERS:
            build(pid, os.path.join(d, pid + '.glb'), style)
    else:
        build(arg('--id'), arg('--out'), style)
