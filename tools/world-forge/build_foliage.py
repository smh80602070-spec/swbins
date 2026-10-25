"""K-0104 사실 들풀 — 잎 카드(알파 잘라내기) 덤불·풀포기·꽃무리·고사리. 결은 자체 생성 아틀라스 하나(foliage_atlas.py)만 쓴다(빌린 사진 0).

  blender -b --factory-startup -P tools/world-forge/build_foliage.py -- --id bush_leafy_01 --out <절대>/bush_leafy_01.gltf
  blender -b --factory-startup -P tools/world-forge/build_foliage.py -- --all --out-dir <절대 폴더>
  blender -b --factory-startup -P tools/world-forge/build_foliage.py -- --list

산출 = <id>.gltf + <id>.bin + 같은 폴더 공용 foliage_atlas.png·foliage_atlas_n.png. 원점 = 바닥 가운데, 미터, z 위. 카드 = 네모 한 장(양면 재질), 법선은 덤불 = 덩어리 바깥, 풀·꽃 = 위로 기울여 뒷면이 까맣지 않게.
build_nature.py 의 bush_01·grass_tuft_01(정육면체 잎·자체 PBR 재질)은 그대로 두고 새 id 만 만든다. 삼각형 덤불 ≤ 1500 · 풀·꽃 ≤ 600.
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

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
ATLAS = os.environ.get('FOLIAGE_ATLAS') or os.path.join(ROOT, 'saga-assets', 'world', 'foliage', '_atlas')   # FOLIAGE_ATLAS = 시험용
A = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
UP = Vector((0, 0, 1))


def arg(k, d=None):
    return A[A.index(k) + 1] if k in A else d


class Ctx:
    def __init__(self, name):
        self.M = W.Mesh(name)
        self.cells = json.load(open(os.path.join(ATLAS, 'foliage_atlas.json'), encoding='utf-8'))['cells']
        self.slot = self.M.slot_of('foliage', atlas_material())
        self.normals = []          # 면마다 정점 법선 4개(만든 순서)

    def card(self, cell, base, h, yaw, tilt=0.0, roll=0.0, anchor='bottom', nrm=None):
        """cell 칸 그림 한 장. base = 밑동(anchor bottom) 또는 가운데(center). yaw = 카드 면이 보는 방향(라디안, 0 = +y),
        tilt = 바깥(면 방향)으로 눕힘, roll = 면 축으로 비틂. nrm(점) → 정점 법선, 없으면 면 법선."""
        c = self.cells[cell]
        u0, v0, u1, v1 = c['uv']
        w = h * c['aspect']
        n = Vector((math.sin(yaw), math.cos(yaw), 0))
        ex = UP.cross(n).normalized()
        ey = UP.copy()
        # 바깥으로 눕힘(ex 축 회전) · 비틂(n 축 회전)
        ey = (ey * math.cos(tilt) + n * math.sin(tilt)).normalized()
        nn = ex.cross(ey).normalized()
        if roll:
            ex, ey = (ex * math.cos(roll) + ey * math.sin(roll)), (ey * math.cos(roll) - ex * math.sin(roll))
        b = Vector(base)
        if anchor == 'center':
            b = b - ey * (h / 2)
        pts = [b - ex * w / 2, b + ex * w / 2, b + ex * w / 2 + ey * h, b - ex * w / 2 + ey * h]
        f = self.M.quad(*pts, self.slot, (u0, v0), (u1, v0), (u1, v1), (u0, v1))
        if f is not None:
            self.normals.append([(nrm(p) if nrm else nn) for p in pts])


def atlas_material():
    mat = bpy.data.materials.new('foliage')
    mat.use_nodes = True
    mat.use_backface_culling = False
    nt = mat.node_tree
    bsdf = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
    col = nt.nodes.new('ShaderNodeTexImage')
    col.image = bpy.data.images.load(os.path.join(ATLAS, 'foliage_atlas.png'))
    nt.links.new(col.outputs['Color'], bsdf.inputs['Base Color'])
    rnd = nt.nodes.new('ShaderNodeMath')          # glTF 내보내기: 알파 → Round = MASK(잘라내기 0.5)
    rnd.operation = 'ROUND'
    nt.links.new(col.outputs['Alpha'], rnd.inputs[0])
    nt.links.new(rnd.outputs['Value'], bsdf.inputs['Alpha'])
    nor = nt.nodes.new('ShaderNodeTexImage')
    nor.image = bpy.data.images.load(os.path.join(ATLAS, 'foliage_atlas_n.png'))
    nor.image.colorspace_settings.name = 'Non-Color'
    nm = nt.nodes.new('ShaderNodeNormalMap')
    nt.links.new(nor.outputs['Color'], nm.inputs['Color'])
    nt.links.new(nm.outputs['Normal'], bsdf.inputs['Normal'])
    bsdf.inputs['Roughness'].default_value = 0.8
    bsdf.inputs['Specular IOR Level'].default_value = 0.25
    return mat


def shell_normal(center, sz=1.0, lift=0.35):
    """덩어리(덤불) 법선 — 가운데에서 바깥 + 조금 위."""
    c = Vector(center)
    return lambda p: (Vector(((p.x - c.x), (p.y - c.y), (p.z - c.z) * sz)).normalized() + UP * lift).normalized()


def up_normal(k=0.7):
    """풀·꽃 — 카드 면 대신 거의 위(하늘빛을 받아 뒷면도 밝다), 밑동 둘레 바깥 조금."""
    return lambda p: (UP * k + Vector((p.x, p.y, 0)) * (1 - k) * 3).normalized()


def leafy_bush(C, center, rx, ry, rz, n, hmin, hmax, small_share, seed):
    rnd = random.Random(seed)
    nf = shell_normal(center, 1.0)
    cx, cy, cz = center
    for k in range(n):
        # 위쪽이 더 촘촘한 껍데기 점(밑은 땅에 묻히니 덜)
        z = rnd.uniform(-0.35, 1.0)
        a = rnd.uniform(0, 2 * math.pi)
        r = math.sqrt(max(0.0, 1 - z * z))
        d = Vector((math.cos(a) * r, math.sin(a) * r, z))
        depth = rnd.uniform(0.55, 0.9)
        p = (cx + d.x * rx * depth, cy + d.y * ry * depth, max(0.05, cz + d.z * rz * depth))
        yaw = math.atan2(d.x, d.y) + rnd.uniform(-0.5, 0.5)
        tilt = max(-0.2, min(1.1, math.asin(max(-1, min(1, d.z))) * 0.9)) + rnd.uniform(-0.2, 0.2)
        cell = 'leaf_small' if rnd.random() < small_share else 'leaf_broad'
        C.card(cell, p, rnd.uniform(hmin, hmax), yaw, tilt, rnd.uniform(-0.5, 0.5), 'center', nf)
    for k in range(6):          # 속 채움 — 가운데를 지나는 세운 카드
        yaw = k * math.pi / 6 + rnd.uniform(-0.1, 0.1)
        C.card('leaf_broad', (cx, cy, 0.0), rz * 2.0, yaw, 0.0, 0.0, 'bottom', nf)


def tuft(C, cells, n, r, hmin, hmax, tilt_max, seed, start=0.0):
    rnd = random.Random(seed)
    nf = up_normal()
    for k in range(n):
        a = start + 2 * math.pi * k / n + rnd.uniform(-0.3, 0.3)
        rr = rnd.uniform(0, r)
        cell = cells[k % len(cells)] if isinstance(cells, list) else cells
        C.card(cell, (math.cos(a) * rr, math.sin(a) * rr, 0.0), rnd.uniform(hmin, hmax), a + rnd.uniform(-0.6, 0.6),
               rnd.uniform(0.0, tilt_max), rnd.uniform(-0.12, 0.12), 'bottom', nf)


# ---------------------------------------------------------------- 7종

def bush_leafy_01(C):
    """둥근 덤불 ≈ 0.9m."""
    leafy_bush(C, (0, 0, 0.45), 0.55, 0.5, 0.42, 64, 0.42, 0.62, 0.3, 1041)


def bush_leafy_02(C):
    """낮고 넓은 덤불 ≈ 1.6×0.6m."""
    leafy_bush(C, (0, 0, 0.28), 0.8, 0.65, 0.26, 72, 0.32, 0.48, 0.7, 1042)


def grass_clump_01(C):
    """무릎 높이 풀포기."""
    tuft(C, 'grass_blades', 7, 0.06, 0.42, 0.58, 0.25, 1043)


def grass_clump_02(C):
    """이삭 달린 키 큰 풀 + 밑 잔풀."""
    tuft(C, 'grass_seed', 6, 0.08, 0.7, 0.9, 0.2, 1044)
    tuft(C, 'grass_blades', 4, 0.1, 0.32, 0.42, 0.3, 1045, 0.4)


def flower_clump_01(C):
    """흰·노랑 들꽃 무리."""
    tuft(C, 'grass_blades', 4, 0.16, 0.28, 0.36, 0.3, 1046)
    tuft(C, ['flower_white', 'flower_yellow'], 7, 0.22, 0.3, 0.42, 0.18, 1047, 0.3)


def flower_clump_02(C):
    """보라 들꽃 무리."""
    tuft(C, 'grass_blades', 3, 0.14, 0.28, 0.36, 0.3, 1048)
    tuft(C, 'flower_purple', 6, 0.2, 0.38, 0.5, 0.15, 1049, 0.5)


def fern_01(C):
    """고사리 — 잎자루가 가운데서 바깥으로 눕는다."""
    rnd = random.Random(1050)
    nf = up_normal(0.8)
    for k in range(9):
        a = 2 * math.pi * k / 9 + rnd.uniform(-0.15, 0.15)
        C.card('fern_frond', (0, 0, 0.0), rnd.uniform(0.6, 0.78), a, rnd.uniform(0.75, 1.05), rnd.uniform(-0.1, 0.1), 'bottom', nf)
    for k in range(3):
        a = 2 * math.pi * k / 3 + 0.5
        C.card('fern_frond', (0, 0, 0.0), rnd.uniform(0.45, 0.55), a, rnd.uniform(0.2, 0.35), 0.0, 'bottom', nf)


def reed_clump_01_real(C):
    """K-0190 갈대 무리 ≈ 1.4m — 이삭 달린 키 큰 줄기 + 밑 잎(유니티 reed_clump_01 사실판, 옛 판은 build_nature 상자 잎)."""
    tuft(C, 'grass_seed', 9, 0.16, 1.15, 1.45, 0.12, 1051)
    tuft(C, 'grass_blades', 7, 0.2, 0.55, 0.8, 0.22, 1052, 0.3)


KINDS = {f.__name__: f for f in (bush_leafy_01, bush_leafy_02, grass_clump_01, grass_clump_02, flower_clump_01, flower_clump_02, fern_01, reed_clump_01_real)}
TRIS_MAX = {'bush_leafy_01': 1500, 'bush_leafy_02': 1500}


def build(pid, out):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    C = Ctx(pid)
    KINDS[pid](C)
    ob = C.M.build()
    me = ob.data
    for p in me.polygons:
        p.use_smooth = True
    lo = [n for face in C.normals for n in face]
    if len(lo) == len(me.loops):
        me.normals_split_custom_set([tuple(n) for n in lo])
    bpy.context.view_layer.objects.active = ob
    tris = sum(len(p.vertices) - 2 for p in me.polygons)
    pts = [Vector(c) for c in ob.bound_box]
    size = [round(max(p[i] for p in pts) - min(p[i] for p in pts), 2) for i in range(3)]
    os.makedirs(os.path.dirname(os.path.abspath(out)), exist_ok=True)
    # .gltf + .bin + 공용 아틀라스 두 장(foliage_atlas.png·_n.png) — GLB 로 품으면 7종이 2048 아틀라스를 7벌 들고 고돗도 7벌 올린다
    bpy.ops.object.select_all(action='DESELECT')
    ob.select_set(True)
    bpy.ops.export_scene.gltf(filepath=out, export_format='GLTF_SEPARATE', use_selection=True, export_apply=True,
                              export_yup=True, export_image_format='AUTO')
    lim = TRIS_MAX.get(pid, 600)
    atlas_lic = json.load(open(os.path.join(ATLAS, 'foliage_atlas.license.json'), encoding='utf-8'))
    lic = {'id': pid, 'generator': 'tools/world-forge/build_foliage.py', 'ticket': 'K-0104', 'blender': bpy.app.version_string,
           'license': '자체 생성 — 형태는 전부 코드, 결은 자체 아틀라스(Z-Image-Turbo 출력 · foliage_atlas.py)', 'commercial_use': True,
           'inputs': ['saga-assets/world/foliage/_atlas/foliage_atlas.png'], 'atlas_inputs': [i['file'] for i in atlas_lic['inputs']],
           'size_m': size, 'tris': tris}
    json.dump(lic, open(os.path.splitext(out)[0] + '.license.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    kb = (os.path.getsize(out) + os.path.getsize(os.path.splitext(out)[0] + '.bin')) // 1024
    print('FOLIAGE', json.dumps({'id': pid, 'tris': tris, 'size_m': size, 'kb': kb, 'ok': tris <= lim}))


if __name__ == '__main__':
    if '--list' in A:
        print('FOLIAGE_KINDS', ' '.join(KINDS))
    elif '--all' in A:
        d = arg('--out-dir')
        for pid in KINDS:
            build(pid, os.path.join(d, pid + '.gltf'))
    else:
        build(arg('--id'), arg('--out'))
