"""world-forge 치수 맞춤 키트 — 고돗 G-0020 이 Kenney 원본을 걷어내며 요청한 다리 널판 + 사가블로 방 키트 (K-0063). 재질만 Poly Haven CC0 사진.

  blender -b --factory-startup -P tools/world-forge/build_kit.py -- --id dungeon_room_12_dirt --out <절대>/dungeon_room_12_dirt.glb [--style toon]
  blender -b --factory-startup -P tools/world-forge/build_kit.py -- --all --out-dir <절대 폴더> [--style toon]
  blender -b --factory-startup -P tools/world-forge/build_kit.py -- --list

10종: `plank_deck_01`(폭 6 × 길이 1 × 두께 0.12, 길이 방향 이음 타일) · `dungeon_room_12_<mood>`(12 × 4.4 × 12, 남북 벽 가운데 폭 4.4 개구부) ·
`dungeon_gate_44_<mood>`(4.4 × 4.4 × 깊이 1.4, 통로 3.4 × 3.4) · `dungeon_corridor_4_<mood>`(폭 4 × 높이 4.05 × 길이 4, 이음 타일). mood = dirt·limestone·lava.
원점 = 바닥 가운데(xy), 바닥 윗면이 z=0(GLB y=0), 단위 m. 방·복도 윗면은 열려 있다(탑뷰). 벽은 바깥 면이 규격 치수에 닿게 안쪽으로 들인다.
형태 도우미(거친 바위 벽·바닥·균열)는 build_field.py 와 같은 것을 쓴다 — 4m 굴혈 키트와 같은 재질 세 벌.
"""
import math
import os
import random
import sys

import bpy

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import build_field as BF  # noqa: E402
import wf_shapes as WS  # noqa: E402
import build_interior as BI  # noqa: E402
from build_prop import tube, obox, A, arg  # noqa: E402

MOODS = ('dirt', 'limestone', 'lava')
ROOM_W, ROOM_H = 12.0, 4.4
GATE_W, GATE_H, GATE_D = 4.4, 4.4, 1.4
COR_W, COR_H, COR_L = 4.0, 4.05, 4.0
FLOOR_TH = 0.05


def plank_deck_01(C):
    """널빤지 12장(결이 길이 방향) + 이음 사이 어두운 바닥판. 길이 방향 이음새는 널빤지 끝이 같은 줄이라 이어 붙이면 안 보인다."""
    M = C.M
    tints = ('#8a6644', '#7d5c3e', '#94704c')
    base = C.s('black_painted_planks', 1.2, '#2c2118')
    obox(M, (0, 0, 0), (6.0, 1.0, 0.08), 0, base, 1.2)
    n, gap = 12, 0.03
    bw = (6.0 - gap * (n + 1)) / n
    rnd = random.Random(63)
    for i in range(n):
        x = -3.0 + gap + bw / 2 + i * (bw + gap)
        slot = C.s('brown_planks_03', 1.0, tints[rnd.randrange(3)])
        obox(M, (x, 0, 0), (bw, 1.0, 0.12), 0, slot, 1.0)


def _kit_mats(C, mood):
    return BF._mats(C, mood)


def _glow_pools(M, gl, pools):
    for (x, y, w, d) in pools:
        obox(M, (x, y, 0.0), (w, d, 0.02), 0, gl, 0.5)


def _boulder(M, x, y, r, slot, rnd):
    """낮은 바위 하나 — 둥근 밑동(원뿔대) + 비스듬한 윗머리, 오각 단면(삼각형 ~26)."""
    h = r * rnd.uniform(0.55, 0.9)
    tx, ty = rnd.uniform(-0.25, 0.25) * r, rnd.uniform(-0.25, 0.25) * r
    tube(M, (x, y, -0.02), (x, y, h * 0.6), r, r * 0.8, slot, 1.0, 5, caps=False)          # 밑동은 곧게(기울면 고리가 바닥 아래로 파고든다)
    tube(M, (x, y, h * 0.6), (x + tx, y + ty, h), r * 0.8, r * 0.25, slot, 1.0, 5)


def _wall_rocks(M, slot, rnd, half, n, skip_gate=True, rmin=0.45, rmax=1.0):
    """벽 밑을 따라 바위 무더기 — 벽(±half) 안쪽 0.3~0.9m, 문 앞(가운데 ±2.6, 남북)은 비운다."""
    for _ in range(n):
        side = rnd.randrange(4)
        u = rnd.uniform(-half + 0.6, half - 0.6)
        inset = half - rnd.uniform(0.35, 0.8)
        x, y = [(u, -inset), (u, inset), (-inset, u), (inset, u)][side]
        if skip_gate and side < 2 and abs(u) < 2.6:
            continue
        _boulder(M, x, y, rnd.uniform(rmin, rmax), slot, rnd)


def _lava_veins(M, gl, rnd, paths, w0=0.42):
    """용암 균열 — 들쭉날쭉한 띠(가운데 넓고 끝 좁음), 바닥 바로 위 평면."""
    for path in paths:
        pts = []
        for (x0, y0), (x1, y1) in zip(path, path[1:]):
            for k in range(4):
                f = k / 4
                pts.append((x0 + (x1 - x0) * f + rnd.uniform(-0.12, 0.12), y0 + (y1 - y0) * f + rnd.uniform(-0.12, 0.12)))
        pts.append(path[-1])
        for i, (p, q) in enumerate(zip(pts, pts[1:])):
            dx, dy = q[0] - p[0], q[1] - p[1]
            L = math.hypot(dx, dy) or 1
            nx, ny = -dy / L, dx / L
            w1 = w0 * math.sin(math.pi * (i + 0.5) / len(pts)) * rnd.uniform(0.7, 1.2) + 0.04
            w2 = w0 * math.sin(math.pi * (i + 1.5) / len(pts)) * rnd.uniform(0.7, 1.2) + 0.04
            M.quad((p[0] - nx * w1 / 2, p[1] - ny * w1 / 2, 0.012), (p[0] + nx * w1 / 2, p[1] + ny * w1 / 2, 0.012),
                   (q[0] + nx * w2 / 2, q[1] + ny * w2 / 2, 0.012), (q[0] - nx * w2 / 2, q[1] - ny * w2 / 2, 0.012), gl,
                   (0, 0), (1, 0), (1, 1), (0, 1))


def _lava_pool(M, gl, rim, x, y, r, rnd):
    """불규칙한 용암 웅덩이 + 굳은 테(어두운 바위 고리)."""
    k = 10
    pts = [(math.cos(2 * math.pi * i / k) * r * rnd.uniform(0.75, 1.15), math.sin(2 * math.pi * i / k) * r * rnd.uniform(0.75, 1.15)) for i in range(k)]
    WS.plate(M, pts, (x, y, 0.035), (1, 0, 0), (0, 1, 0), 0.01, gl, bevel=0.05)                          # 용암이 테보다 위(테 윗면 0.02)
    WS.plate(M, [(px * 1.22, py * 1.22) for px, py in pts], (x, y, -0.01), (1, 0, 0), (0, 1, 0), 0.03, rim, bevel=0.15)


def dungeon_room_12(C, mood):
    M = C.M
    fl, wl, gl = _kit_mats(C, mood)
    hw = ROOM_W / 2
    t = 0.5
    c = hw - t / 2                                                                 # 벽 중심선 — 바깥 면이 ±6.0
    wh = ROOM_H - 0.33                                                             # 윗단 울퉁불퉁(최대 +0.3)까지 4.4 안
    obox(M, (0, 0, -FLOOR_TH), (ROOM_W, ROOM_W, FLOOR_TH), 0, fl, 2.0)
    op = GATE_W / 2
    for k, (y0, s0) in enumerate(((-c, 1), (c, 3))):                               # 남·북 벽(가운데 4.4 개구부) — 들고남은 방 안쪽으로만
        inw = 1 if y0 < 0 else -1
        BF._rough_wall(M, -hw, -op, y0, wl, s0, h=wh, thick=t, axis='x', step=0.42, meander=1.0, inward=inw)
        BF._rough_wall(M, op, hw, y0, wl, s0 + 1, h=wh, thick=t, axis='x', step=0.42, meander=1.0, inward=inw)
    BF._rough_wall(M, -hw, hw, -c, wl, 5, h=wh, thick=t, axis='y', meander=1.0, inward=1)       # 서·동 벽(닫힘)
    BF._rough_wall(M, -hw, hw, c, wl, 6, h=wh, thick=t, axis='y', meander=1.0, inward=-1)
    rnd = random.Random(12)
    _wall_rocks(M, wl, rnd, hw - t, 20)                                            # 10-06 저녁: 벽 밑 바위 무더기(모든 분위기) — 빈 바닥·반듯한 벽 아래가 휑했다
    if mood == 'dirt':                                                             # 흙: 바닥에 흩어진 둥근 돌
        for _ in range(8):
            x, y = rnd.uniform(-4.2, 4.2), rnd.uniform(-4.2, 4.2)
            if abs(x) < 2.4:
                continue                                                           # 남북 문 사이 길은 비운다
            _boulder(M, x, y, rnd.uniform(0.25, 0.5), wl, rnd)
    elif mood == 'limestone':                                                      # 석회: 종유석·석순 기둥
        for sx in (-1, 1):
            for sy in (-1, 1):
                x, y = sx * 4.6, sy * 4.0
                tube(M, (x, y, 0), (x, y, 2.6), 0.55, 0.16, wl, 1.0, 8)
                tube(M, (x * 0.9, y * 1.05, 0), (x * 0.9, y * 1.05, 1.0), 0.28, 0.08, wl, 1.0, 6)
    else:                                                                          # 용암: 들쭉날쭉한 발광 균열 + 굳은 테 두른 웅덩이 둘
        _lava_veins(M, gl, rnd, [[(-4.5, -3.6), (-2.0, -1.2), (0.6, -1.9), (3.8, -0.6)], [(-2.0, -1.2), (-1.5, 2.2), (1.2, 3.8), (4.4, 3.2)], [(0.6, -1.9), (1.4, 0.6)]])
        _lava_pool(M, gl, wl, -3.6, 3.4, 1.0, rnd)
        _lava_pool(M, gl, wl, 3.7, -3.5, 0.95, rnd)
    BI.node('col_room', (0, 0, ROOM_H / 2), (ROOM_W, ROOM_W, ROOM_H))


def dungeon_gate_44(C, mood):
    M = C.M
    fl, wl, gl = _kit_mats(C, mood)
    pw = 0.5                                                                       # 문설주 폭 → 통로 3.4
    for sx in (-1, 1):
        obox(M, (sx * (GATE_W / 2 - pw / 2), 0, 0), (pw, GATE_D, GATE_H - 1.0), 0, wl, 1.5)
        obox(M, (sx * (GATE_W / 2 - pw / 2), 0, GATE_H - 1.6), (pw, GATE_D, 0.18), 0, wl, 0.8)          # 문설주 머리 띠
    obox(M, (0, 0, GATE_H - 1.0), (GATE_W, GATE_D, 1.0), 0, wl, 1.5)                                    # 상인방
    obox(M, (0, 0, GATE_H - 1.18), (GATE_W - pw * 2 + 0.3, GATE_D - 0.2, 0.18), 0, wl, 1.5)             # 상인방 밑 장식 띠
    if gl is not None:
        obox(M, (0, -GATE_D / 2 + 0.02, GATE_H - 1.45), (GATE_W - pw * 2 - 0.4, 0.04, 0.08), 0, gl, 0.5)
    BI.node('col_gate', (0, 0, GATE_H / 2), (GATE_W, GATE_D, GATE_H))
    BI.node('passage', (0, 0, (GATE_H - 1.18) / 2), (GATE_W - pw * 2, GATE_D, GATE_H - 1.18))


def dungeon_corridor_4(C, mood):
    M = C.M
    fl, wl, gl = _kit_mats(C, mood)
    t = 0.4
    c = COR_W / 2 - t / 2
    wh = COR_H - 0.25
    obox(M, (0, 0, -FLOOR_TH), (COR_W, COR_L, FLOOR_TH), 0, fl, 2.0)
    BF._rough_wall(M, -COR_L / 2, COR_L / 2, -c, wl, 9, h=wh, thick=t, axis='y', meander=1.0, inward=1)
    BF._rough_wall(M, -COR_L / 2, COR_L / 2, c, wl, 10, h=wh, thick=t, axis='y', meander=1.0, inward=-1)
    rnd = random.Random(40)
    for sx in (-1, 1):                                                             # 벽 밑 바위(이음 끝 0.4m 는 비움)
        for _ in range(3):
            _boulder(M, sx * (c - t / 2 - rnd.uniform(0.3, 0.5)), rnd.uniform(-1.5, 1.5), rnd.uniform(0.3, 0.55), wl, rnd)
    if gl is not None:
        _lava_veins(M, gl, rnd, [[(0.0, -2.0), (0.3, -0.6), (-0.2, 0.7), (0.0, 2.0)]], 0.22)
    BI.node('col_corridor', (0, 0, COR_H / 2), (COR_W, COR_L, COR_H))


KIT = {'plank_deck_01': plank_deck_01}
for _m in MOODS:
    KIT[f'dungeon_room_12_{_m}'] = (lambda C, m=_m: dungeon_room_12(C, m))
    KIT[f'dungeon_gate_44_{_m}'] = (lambda C, m=_m: dungeon_gate_44(C, m))
    KIT[f'dungeon_corridor_4_{_m}'] = (lambda C, m=_m: dungeon_corridor_4(C, m))
SPEC = {'plank_deck_01': (6.0, 1.0, 0.12)}                                           # 규격 AABB (x, y, 높이) — 점검에 쓴다
for _m in MOODS:
    SPEC[f'dungeon_room_12_{_m}'] = (ROOM_W, ROOM_W, ROOM_H)
    SPEC[f'dungeon_gate_44_{_m}'] = (GATE_W, GATE_D, GATE_H)
    SPEC[f'dungeon_corridor_4_{_m}'] = (COR_W, COR_L, COR_H)
BI.ALL.update(KIT)
BI.BIG.update(k for k in KIT if k.startswith('dungeon_room_'))                      # 12m 방은 방 예산(2500) — 소품 예산(1500)이 아니다
BI.BP.GENERATOR = 'tools/world-forge/build_kit.py'


def build(pid, out, style):
    BI.build_scene(pid, out, style)
    BI.BP.GENERATOR = 'tools/world-forge/build_kit.py'


if __name__ == '__main__':
    style = arg('--style', 'real')
    if '--list' in A:
        print('KIT', ' '.join(KIT))
    elif '--all' in A:
        d = arg('--out-dir')
        for pid in KIT:
            build(pid, os.path.join(d, pid + '.glb'), style)
    else:
        build(arg('--id'), arg('--out'), style)
