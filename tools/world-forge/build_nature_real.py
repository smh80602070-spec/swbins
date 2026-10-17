"""K-0127 고돗 사실 자연물 — build_nature.py 레시피를 그대로 돌리되 잎 덩이(clump_crown·소나무 skirt)만 **잎 카드**(K-0104 아틀라스)로 바꾼다.
줄기·뿌리·크기·실루엣이 툰판과 같아 고돗 빌더의 배율 값이 그대로 맞는다. 줄기·바위는 자체 PBR 사실 재질(--style real 과 같은 길).

  blender -b --factory-startup -P tools/world-forge/build_nature_real.py -- --id tree_broadleaf_01 --out <절대>/tree_broadleaf_01_real.gltf
  blender -b --factory-startup -P tools/world-forge/build_nature_real.py -- --all --out-dir <절대 폴더>
  blender -b --factory-startup -P tools/world-forge/build_nature_real.py -- --list

산출 = <id>_real.gltf + .bin(+ 껍질·바위 결 그림) — 같은 폴더 공용 foliage_atlas.png·_n.png 를 나눠 쓴다(saga-assets/world/foliage, place 항목 world-foliage).
메시 하나·재질 칸 둘(잎 아틀라스 + PBR) — 고돗 MultiMesh 가 extract_mesh 로 한 번에 얹는다. 잎 카드 정점 법선은 수관 껍데기 바깥(빛이 덩어리로 읽힘).
"""
import json
import math
import os
import random
import sys

import bpy
from mathutils import Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import wf_common as W  # noqa: E402
import build_foliage as BF  # noqa: E402
import build_nature as BN  # noqa: E402

UP = Vector((0, 0, 1))
A = BF.A
BARK_REMAP = {'brown_planks_03': ('cliff_side', 0.9)}      # 툰판 판자 결 → 사실 껍질(바위 절벽 결을 껍질 색으로)
CUR = {}


class Ctx(BF.Ctx):
    """잎 카드(BF.Ctx.card) + build_nature 레시피가 부르는 C.s(PBR 칸)."""
    def __init__(self, name):
        super().__init__(name)
        self.mats = set()

    def s(self, mat, tile=1.0, tint=None, gain=1.0, sat=1.0):
        if mat in BARK_REMAP:
            mat, tile = BARK_REMAP[mat][0], tile * BARK_REMAP[mat][1]
        key = f'{mat}|{tile}|{tint}|{gain}|{sat}'
        self.mats.add(mat)
        return self.M.slot_of(key, W.pbr_material(mat, tile, tint, name=mat, gain=gain, sat=sat))


def card_crown(M, center, rx, ry, rz, n, size, slots, seed, jit=0.25, lon=7, lat=3, bottom=0.5, tile=2.0):
    """clump_crown 자리 — 타원체 겉 두 겹 + 속 채움 세운 카드. 덩이 n 개 = 카드 n×4 쯤(덩이 크기 size 로 카드 키)."""
    C = CUR['C']
    rnd = random.Random(seed)
    cx, cy, cz = center
    nf = BF.shell_normal(center, 1.0, 0.3)
    count = int(n * 6.0)
    golden = math.pi * (3 - math.sqrt(5))
    for i in range(count):
        t = (i + 0.5) / count
        zz = 1 - 2 * t
        r = math.sqrt(max(0.0, 1 - zz * zz))
        ph = golden * i + rnd.uniform(-0.3, 0.3)
        d = Vector((math.cos(ph) * r, math.sin(ph) * r, zz * (bottom if zz < 0 else 1.0)))
        depth = rnd.uniform(0.8, 1.02)
        p = (cx + d.x * rx * depth, cy + d.y * ry * depth, cz + d.z * rz * depth)
        yaw = math.atan2(d.x, d.y) + rnd.uniform(-0.6, 0.6)
        tilt = max(-0.4, min(0.7, math.asin(max(-1, min(1, d.z))) * 0.7)) + rnd.uniform(-0.25, 0.25)
        cell = 'leaf_small' if rnd.random() < 0.18 else 'leaf_broad'
        C.card(cell, p, size * rnd.uniform(1.6, 2.2), yaw, tilt, rnd.uniform(-0.6, 0.6), 'center', nf)
    for k in range(8):                                  # 속 채움 — 빈 구멍 없게
        yaw = k * math.pi / 8 + rnd.uniform(-0.1, 0.1)
        C.card('leaf_broad', (cx, cy, cz - rz * 0.75), rz * 1.6, yaw, 0.0, 0.0, 'bottom', nf)


def card_skirt(M, z, r, h, n, slot_a, slot_b, seed, droop=0.14):
    """소나무 skirt 자리 — 층 가장자리로 뻗어 아래로 처지는 침엽 가지 카드(leaf_small) 둘레 + 안쪽 짧은 겹."""
    C = CUR['C']
    rnd = random.Random(seed)
    nf = lambda p: (Vector((p.x, p.y, 0)).normalized() * 0.75 + UP * 0.55).normalized()
    count = max(10, int(r * 13))
    for k in range(count):
        a = 2 * math.pi * k / count + rnd.uniform(-0.15, 0.15)
        yaw = -a                                         # 카드 면 법선 = 둘레 접선(yaw 는 +y 기준) → 카드 '위' 를 roll 로 바깥·아래로
        ln = r * rnd.uniform(0.85, 1.05)
        mid = Vector((math.cos(a) * ln * 0.62, math.sin(a) * ln * 0.62, z + h * 0.3))
        C.card('leaf_small', mid, ln * 1.3, yaw, 0.0, math.pi / 2 + 0.12 + droop * 1.2 + rnd.uniform(-0.15, 0.15), 'center', nf)
    for k in range(max(5, count // 3)):                 # 층 꼭대기 쪽 세운 카드(위에서 봐도 비지 않게)
        a = 2 * math.pi * k / max(5, count // 3) + rnd.uniform(-0.2, 0.2)
        C.card('leaf_small', (math.cos(a) * r * 0.2, math.sin(a) * r * 0.2, z + h * 0.15), h * 1.05, a, 0.35, 0.0, 'bottom', nf)



def real_rock(M, c, rx, ry, rz, slots, lon, lat, jit, seed, tile=1.5, flat_bottom=True):
    """rock 자리 — 이어진 이코스피어(큰 덩이 4단·작은 덩이 3단)를 크기대로 늘리고 겹 노이즈로 울퉁불퉁, 밑은 납작. 정점 공유라 매끈한 그늘."""
    import bmesh
    from mathutils import noise
    big = max(rx, ry, rz) > 0.8
    r = bmesh.ops.create_icosphere(M.bm, subdivisions=4 if big else 3, radius=1.0)
    vs = r['verts']
    off = Vector((seed * 1.7, seed * 0.3, seed * 2.1))
    cv = Vector(c)
    for v in vs:
        d = v.co.normalized()
        q = d * 1.3 + off
        n = noise.noise(q) * 0.55 + noise.noise(q * 2.3) * 0.28 + noise.noise(q * 5.1) * 0.12
        f = 1.0 + n * (jit * 1.4)
        x, y, z = d.x * rx * f, d.y * ry * f, d.z * rz * f
        if flat_bottom and z < 0:
            z *= 0.16
        v.co = cv + Vector((x, y, z))
    faces = {f for v in vs for f in v.link_faces}
    for fc in faces:
        h = (fc.calc_center_median().z - cv.z) / max(rz, 1e-3)
        fc.material_index = slots[0] if h > 0.45 else (slots[1] if h > -0.05 else slots[2])
        nz = fc.normal
        for l in fc.loops:                              # 면 방향 따라 평면 투영(세 축 중 큰 축 버림)
            p = l.vert.co
            ax = max(range(3), key=lambda k: abs(nz[k]))
            u, w = [p[k] for k in range(3) if k != ax]
            l[M.uv].uv = (u / tile, w / tile)


def real_rock_tints(C, tile=1.5, tints=('#aeaba5', '#97948e', '#76736e')):
    return [C.s('aerial_rocks_02', tile, t, gain=1.15, sat=0.35) for t in tints]


BN.rock = real_rock
BN.rock_tints = real_rock_tints

BN.clump_crown = card_crown
BN.skirt = card_skirt

KINDS = {k: getattr(BN, k) for k in ('tree_broadleaf_01', 'tree_broadleaf_02', 'tree_broadleaf_03', 'tree_birch_01', 'tree_pine_01', 'tree_pine_02',
                                       'tree_pine_03', 'tree_dead_01', 'rock_large_01', 'rock_large_02', 'rock_moss_01', 'rock_small_01', 'stump_01', 'log_01')}
TRIS_MAX = 6000


def build(pid, out):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    W.STYLE['mode'] = 'real'
    C = Ctx(pid)
    CUR['C'] = C
    KINDS[pid](C)
    n_card = len(C.normals)
    ob = C.M.build()
    me = ob.data
    for p in me.polygons:
        p.use_smooth = True
    lo, ok = [], True
    for i, p in enumerate(me.polygons):                 # 카드 = 만든 순서대로 앞쪽이 아닐 수 있어 재질 칸으로 가른다
        if p.material_index == C.slot and C.normals:
            face = C.normals.pop(0)
            if len(face) != p.loop_total:
                ok = False
                break
            lo.extend(face)
        else:
            lo.extend([p.normal.copy()] * p.loop_total)
    if ok and len(lo) == len(me.loops) and n_card:
        me.normals_split_custom_set([tuple(n) for n in lo])
    bpy.context.view_layer.objects.active = ob
    tris = sum(len(p.vertices) - 2 for p in me.polygons)
    pts = [Vector(c) for c in ob.bound_box]
    size = [round(max(p[i] for p in pts) - min(p[i] for p in pts), 2) for i in range(3)]
    os.makedirs(os.path.dirname(os.path.abspath(out)), exist_ok=True)
    bpy.ops.object.select_all(action='DESELECT')
    ob.select_set(True)
    bpy.ops.export_scene.gltf(filepath=out, export_format='GLTF_SEPARATE', use_selection=True, export_apply=True,
                              export_yup=True, export_image_format='AUTO')
    atlas_lic = json.load(open(os.path.join(BF.ATLAS, 'foliage_atlas.license.json'), encoding='utf-8'))
    lic = {'id': os.path.splitext(os.path.basename(out))[0], 'generator': 'tools/world-forge/build_nature_real.py', 'ticket': 'K-0127',
           'blender': bpy.app.version_string, 'recipe': 'tools/world-forge/build_nature.py ' + pid,
           'license': 'CC0-1.0 자체 생성 — 형태는 코드, 잎은 자체 아틀라스(foliage_atlas.py), 줄기·바위는 자체 PBR(K-0093·K-0113)', 'commercial_use': True,
           'inputs': ['saga-assets/world/foliage/_atlas/foliage_atlas.png'] + ['self-pbr: ' + m for m in sorted(C.mats)],
           'atlas_inputs': [i['file'] for i in atlas_lic['inputs']], 'size_m': size, 'tris': tris, 'card_normals': bool(ok and n_card)}
    json.dump(lic, open(os.path.splitext(out)[0] + '.license.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print('NATURE_REAL', json.dumps({'id': pid, 'tris': tris, 'size_m': size, 'cards': n_card, 'ok': tris <= TRIS_MAX}))


if __name__ == '__main__':
    if '--list' in A:
        print('NATURE_REAL_KINDS', ' '.join(KINDS))
    elif '--all' in A:
        d = BF.arg('--out-dir')
        for pid in KINDS:
            build(pid, os.path.join(d, pid + '_real.gltf'))
    else:
        build(BF.arg('--id'), BF.arg('--out'))
