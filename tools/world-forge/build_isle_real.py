"""K-0128 떠 있는 섬 밑동(사실판) — 고돗 `games/saga_go/world/isle_rock.gd`(G-0130) 자리. **단위 크기**: 윗면 반지름 1·높이 1(원점 = 윗면 가운데, 아래 -z).
부르는 쪽이 x·y 를 윗반지름(예 sky_isle RADIUS-1 = 13)으로, z 를 높이(13)로 늘린다 — 구름섬·갈림길 끝·하늘 항로·먹구름 눈이 한 벌을 나눠 쓴다.

  blender -b --factory-startup -P tools/world-forge/build_isle_real.py -- --id isle_rock_01 --out <절대>/isle_rock_01_real.glb

꼴: 링 14 × 둘레 40 바위 뿔(윗띠 흙 → 바위 층 → 끝 어둡게), 반지름은 겹 노이즈로 울퉁불퉁 · 끝 아래 뜬 돌 셋 · 결 = 자체 PBR(흙 forest_ground_04 · 바위 aerial_rocks_02).
"""
import json
import math
import os
import random
import sys

import bpy
from mathutils import Vector, noise

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import wf_common as W  # noqa: E402

A = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
arg = lambda k, d=None: A[A.index(k) + 1] if k in A else d
SEEDS = {'isle_rock_01': 71, 'isle_rock_02': 4133}
RINGS, SEG, TIP_R = 14, 40, 0.115


def lump(M, c, r, slot, seed):
    import bmesh
    res = bmesh.ops.create_icosphere(M.bm, subdivisions=2, radius=1.0)
    off = Vector((seed * 1.3, seed * 0.7, seed * 2.9))
    for v in res['verts']:
        d = v.co.normalized()
        f = 1.0 + noise.noise(d * 1.4 + off) * 0.35 + noise.noise(d * 3.1 + off) * 0.12
        v.co = Vector(c) + Vector((d.x * r * f, d.y * r * f, d.z * r * 0.8 * f))
    for fc in {f for v in res['verts'] for f in v.link_faces}:
        fc.material_index = slot
        for l in fc.loops:
            l[M.uv].uv = (l.vert.co.x * 4, l.vert.co.z * 4)


def build(pid, out):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    W.STYLE['mode'] = 'real'
    seed = SEEDS[pid]
    rnd = random.Random(seed)
    M = W.Mesh(pid)
    soil = M.slot_of('soil', W.pbr_material('forest_ground_04', 0.18, '#8a7058', name='soil', sat=0.8))
    rock = M.slot_of('rock', W.pbr_material('aerial_rocks_02', 0.22, '#a39d95', name='rock', sat=0.4))
    dark = M.slot_of('rock_d', W.pbr_material('aerial_rocks_02', 0.22, '#6e6862', name='rock_d', sat=0.4))
    off = Vector((seed * 0.9, seed * 1.7, seed * 0.4))
    rings = []
    for j in range(RINGS):
        t = j / (RINGS - 1)                                   # 0 = 윗면 · 1 = 끝 바로 위
        z = -t * 0.92
        base = TIP_R + (1.0 - TIP_R) * (1 - t) ** 1.25
        row = []
        for k in range(SEG):
            a = 2 * math.pi * k / SEG
            q = Vector((math.cos(a), math.sin(a), z * 2.0)) + off
            n = noise.noise(q * 1.6) * 0.9 + noise.noise(q * 3.7) * 0.45 + noise.noise(q * 8.0) * 0.18
            ledge = 0.08 * math.sin(t * 19.0 + noise.noise(q * 0.8) * 3.0)          # 층진 턱
            rr = base * (1.0 + (0.0 if j == 0 else n * (0.42 + 0.15 * t) + ledge))
            row.append(Vector((math.cos(a) * rr, math.sin(a) * rr, z + (0 if j == 0 else noise.noise(q * 2.2) * 0.03))))
        rings.append(row)
    tip = Vector((noise.noise(off) * 0.03, noise.noise(off * 2) * 0.03, -1.0))
    for j in range(RINGS - 1):
        sl = soil if j == 0 else (rock if j < RINGS * 0.62 else dark)
        for k in range(SEG):
            k2 = (k + 1) % SEG
            a, b, c, d = rings[j][k], rings[j][k2], rings[j + 1][k2], rings[j + 1][k]
            u0, u1 = k / SEG * 6.0, (k + 1) / SEG * 6.0
            M.quad(a, d, c, b, sl, (u0, -a.z * 6), (u0, -d.z * 6), (u1, -c.z * 6), (u1, -b.z * 6))
    for k in range(SEG):
        k2 = (k + 1) % SEG
        a, b = rings[-1][k], rings[-1][k2]
        M.face([a, tip, b], [(k / SEG * 6, -a.z * 6), (k / SEG * 6, 6.0), ((k + 1) / SEG * 6, -b.z * 6)], dark)
    ctr = Vector((0, 0, 0))
    for k in range(SEG):                                        # 윗면 뚜껑(고돗 풀 원판 밑에 숨지만 빈 구멍 없게)
        k2 = (k + 1) % SEG
        a, b = rings[0][k], rings[0][k2]
        M.face([ctr, a, b], [(0.5, 0.5), (0.5 + a.x * 0.5, 0.5 + a.y * 0.5), (0.5 + b.x * 0.5, 0.5 + b.y * 0.5)], soil)
    for i in range(14):                                         # 겉에 박힌 바위 덩이(밋밋한 뿔 깨기)
        t = rnd.uniform(0.1, 0.8); ang = rnd.uniform(0, 2 * math.pi)
        rr = (TIP_R + (1.0 - TIP_R) * (1 - t) ** 1.25) * 0.97
        lump(M, (math.cos(ang) * rr, math.sin(ang) * rr, -t * 0.92), rnd.uniform(0.06, 0.13) * (1.2 - t), rock if t < 0.55 else dark, seed * 7 + i)
    for i in range(3):                                          # 끝 아래 뜬 돌
        ang = rnd.uniform(0, 2 * math.pi)
        lump(M, (math.cos(ang) * 0.12, math.sin(ang) * 0.12, -1.12 - i * 0.1), 0.05 - i * 0.01, dark, seed + i)
    import bmesh
    bmesh.ops.remove_doubles(M.bm, verts=M.bm.verts, dist=1e-5)
    ob = M.build()
    for p in ob.data.polygons:
        p.use_smooth = True
    tris = sum(len(p.vertices) - 2 for p in ob.data.polygons)
    W.export_glb([ob], out, 1024, 'JPEG')
    lic = {'id': os.path.splitext(os.path.basename(out))[0], 'generator': 'tools/world-forge/build_isle_real.py', 'ticket': 'K-0128',
           'blender': bpy.app.version_string, 'style': 'real', 'license': 'CC0-1.0 (형태는 코드, 결은 자체 PBR K-0093·K-0113)',
           'inputs': ['self-pbr: forest_ground_04', 'self-pbr: aerial_rocks_02'], 'unit': '윗반지름 1·높이 1(원점 윗면 가운데)', 'tris': tris}
    json.dump(lic, open(os.path.splitext(out)[0] + '.license.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print('ISLE_REAL', json.dumps({'id': pid, 'tris': tris, 'kb': os.path.getsize(out) // 1024}))


if __name__ == '__main__':
    build(arg('--id'), arg('--out'))
