"""K-0174 — 깨지는 소품 조각: 원본 GLB 를 가운데 가까이 지나는 평면 둘로 갈라 조각 넷(<id>_shard_0~3.glb).

  blender -b --factory-startup -P tools/world-forge/shatter.py -- --src <원본.glb> --out-dir <폴더> --id jar_01 [--inner #b5653c] [--seed 1]

하는 일: 메시를 한 덩이로 합침(변환 적용) → 평면 A(세로, 무작위 방향)·평면 B(거의 가로 — 위·아래, 15~30° 기울임)로 사분면마다 bmesh.bisect_plane →
자른 테두리만 triangle_fill 로 막고(원래 열린 입구는 그대로) 재질 'shard_inner'(--inner 색, 깨진 속살) → 조각 원점 = 그 조각 무게중심
(노드 위치 = 무게중심이라 원본과 같은 자리·배율로 놓으면 합쳐 원본 꼴). 축·단위는 원본 그대로(glTF Y 위). 씨앗 고정 = 같은 조각.
작은 조각(부피 몫 < 4%)은 평면을 조금 옮겨 다시 자른다(최대 6번).
"""
import math
import os
import random
import sys

import bmesh
import bpy
from mathutils import Vector


def arg(k, d=None):
    a = sys.argv[sys.argv.index('--') + 1:]
    return a[a.index(k) + 1] if k in a else d


def hex_rgb(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i + 2], 16) / 255 for i in (0, 2, 4))


def load_joined(src):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=src)
    meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH']
    for o in bpy.context.scene.objects:
        o.select_set(o in meshes)
    bpy.context.view_layer.objects.active = meshes[0]
    bpy.ops.object.parent_clear(type='CLEAR_KEEP_TRANSFORM')
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    if len(meshes) > 1:
        bpy.ops.object.join()
    ob = bpy.context.view_layer.objects.active
    for o in list(bpy.context.scene.objects):
        if o is not ob:
            bpy.data.objects.remove(o, do_unlink=True)
    return ob


def cut(bm, co, no, keep_pos, inner_idx):
    """bm 을 평면으로 잘라 한쪽만 남기고 자른 테두리를 막는다."""
    geom = bm.verts[:] + bm.edges[:] + bm.faces[:]
    r = bmesh.ops.bisect_plane(bm, geom=geom, plane_co=co, plane_no=no, clear_inner=keep_pos, clear_outer=not keep_pos, dist=1e-5)
    edges = [e for e in r['geom_cut'] if isinstance(e, bmesh.types.BMEdge)]
    if edges:
        f = bmesh.ops.triangle_fill(bm, use_beauty=True, use_dissolve=False, edges=edges)
        for face in f['geom']:
            if isinstance(face, bmesh.types.BMFace):
                face.material_index = inner_idx
                face.smooth = False
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])


def volume_of(bm):
    return abs(bm.calc_volume(signed=False)) if bm.faces else 0.0


def main():
    src, out_dir, pid = os.path.abspath(arg('--src')), os.path.abspath(arg('--out-dir')), arg('--id')
    rnd = random.Random(int(arg('--seed', '1')))
    ob = load_joined(src)
    me = ob.data
    inner = bpy.data.materials.new('shard_inner')
    inner.use_nodes = True
    bsdf = inner.node_tree.nodes['Principled BSDF']
    bsdf.inputs['Base Color'].default_value = (*[c ** 2.2 for c in hex_rgb(arg('--inner', '#b5653c'))], 1)
    bsdf.inputs['Roughness'].default_value = 0.95
    me.materials.append(inner)
    inner_idx = len(me.materials) - 1
    lo = Vector([min(v.co[i] for v in me.vertices) for i in range(3)])
    hi = Vector([max(v.co[i] for v in me.vertices) for i in range(3)])
    ctr, size = (lo + hi) / 2, hi - lo
    base = bmesh.new()
    base.from_mesh(me)
    bmesh.ops.remove_doubles(base, verts=base.verts[:], dist=1e-4)    # glTF 는 UV 경계마다 꼭짓점을 나눠 둔다 — 안 합치면 자른 테두리가 안 닫혀 막기가 톱니가 된다
    v0 = volume_of(base) or 1e-9
    for attempt in range(6):
        a = rnd.uniform(0, math.pi)                          # 평면 A: 세로(z 축 포함), 무작위 방향
        nA = Vector((math.cos(a), math.sin(a), 0))
        b = rnd.uniform(0, 2 * math.pi)
        tilt = rnd.uniform(0.25, 0.55)
        nB = Vector((math.cos(b) * tilt, math.sin(b) * tilt, 1.0)).normalized()          # 평면 B: 거의 가로(위·아래), 비스듬히 기움
        jit = Vector((rnd.uniform(-0.12, 0.12) * size.x, rnd.uniform(-0.12, 0.12) * size.y, rnd.uniform(-0.1, 0.15) * size.z))
        co = ctr + jit
        pieces = []
        for sa in (True, False):
            for sb in (True, False):
                bm = base.copy()
                cut(bm, co, nA, sa, inner_idx)
                cut(bm, co, nB, sb, inner_idx)
                pieces.append(bm)
        vols = [volume_of(bm) / v0 for bm in pieces]
        if min(vols) >= 0.04 or attempt == 5:
            break
        for bm in pieces:
            bm.free()
    os.makedirs(out_dir, exist_ok=True)
    outs = []
    for k, bm in enumerate(pieces):
        bpy.ops.object.select_all(action='DESELECT')
        pm = bpy.data.meshes.new(f'{pid}_shard_{k}')
        bm.to_mesh(pm)
        bm.free()
        for m in me.materials:
            pm.materials.append(m)
        c = sum((v.co for v in pm.vertices), Vector()) / max(1, len(pm.vertices))
        for v in pm.vertices:
            v.co -= c
        po = bpy.data.objects.new(f'{pid}_shard_{k}', pm)
        po.location = c
        bpy.context.scene.collection.objects.link(po)
        ob.hide_set(True)
        po.select_set(True)
        bpy.context.view_layer.objects.active = po
        path = os.path.join(out_dir, f'{pid}_shard_{k}.glb')
        bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', use_selection=True, export_apply=False, export_animations=False)
        bpy.data.objects.remove(po, do_unlink=True)
        outs.append({'shard': k, 'tris': sum(len(p.vertices) - 2 for p in pm.polygons), 'vol_share': round(vols[k], 3), 'center': [round(x, 3) for x in c]})
    print('SHATTER', pid, outs)


if __name__ == '__main__':
    main()
