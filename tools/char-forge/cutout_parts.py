"""K-0150 — VRoid 몸 → 2D 컷아웃 부위 그림(saga-web/shared/js/cutout2d.js 규격) 1단계: Blender 렌더.

    blender -b --factory-startup -P tools/char-forge/cutout_parts.py -- --body <VRoid .glb(절대)> --out <폴더(절대)> [--px 640]

하는 일: 팔을 아래로 내린 쉬는 자세 → 몸 오른쪽 옆에서 정사영(오른쪽을 봄 · 오른팔·다리가 카메라 쪽 = 엔진 R 바깥) →
면마다 가장 센 뼈 가중치로 부위 16(+cape 옷자락) 나눔 → 부위마다 따로 렌더(가려진 곳까지 온전) + 전체 한 장 + 부위 색 지도(가림 판정) +
뼈 축 자리(2D, 몸 높이 100 · 발 y 0 · 위가 −) → <out>/parts/<부위>.png · full.png · idmap.png · rig_src.json.
2단계(색칠·자르기·rig.json)는 tools/ai-art/pack_cutout.py.
"""
import json
import math
import os
import sys

import bpy
from mathutils import Matrix, Vector

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import build  # noqa: E402

PARTS = ['hip', 'chest', 'head', 'hair', 'armUL', 'armLL', 'handL', 'armUR', 'armLR', 'handR', 'legUL', 'legLL', 'footL', 'legUR', 'legLR', 'footR', 'cape']
PIVOT = {'hip': 'J_Bip_C_Hips', 'chest': 'J_Bip_C_Spine', 'head': 'J_Bip_C_Neck', 'hair': 'J_Bip_C_Head',
         'armUL': 'J_Bip_L_UpperArm', 'armLL': 'J_Bip_L_LowerArm', 'handL': 'J_Bip_L_Hand',
         'armUR': 'J_Bip_R_UpperArm', 'armLR': 'J_Bip_R_LowerArm', 'handR': 'J_Bip_R_Hand',
         'legUL': 'J_Bip_L_UpperLeg', 'legLL': 'J_Bip_L_LowerLeg', 'footL': 'J_Bip_L_Foot',
         'legUR': 'J_Bip_R_UpperLeg', 'legLR': 'J_Bip_R_LowerLeg', 'footR': 'J_Bip_R_Foot'}


def part_of(bone):
    """VRoid 뼈 이름 → 컷아웃 부위."""
    b = bone
    if b.startswith('J_Sec_Hair') or 'Hair' in b:
        return 'hair'
    if b.startswith('J_Sec_'):
        return 'cape' if any(k in b for k in ('Skirt', 'Coat', 'Cape', 'Tail', 'Cloth', 'Hem')) else 'chest'
    for s, S in (('L', 'L'), ('R', 'R')):
        if f'_{S}_' in b:
            if 'UpperLeg' in b:
                return 'legU' + s
            if 'LowerLeg' in b:
                return 'legL' + s
            if 'Foot' in b or 'Toe' in b:
                return 'foot' + s
            if 'Shoulder' in b or 'UpperArm' in b:
                return 'armU' + s
            if 'LowerArm' in b:
                return 'armL' + s
            if any(k in b for k in ('Hand', 'Thumb', 'Index', 'Middle', 'Ring', 'Little')):
                return 'hand' + s
            if 'Eye' in b or 'FaceEye' in b:
                return 'head'
    if 'Hips' in b:
        return 'hip'
    if 'Neck' in b or 'Head' in b or 'Face' in b or 'Eye' in b:
        return 'head'
    return 'chest'


def rot_world(arm, pb, axis, deg):
    """뼈 머리를 축으로 아마추어 공간에서 돌린다(자식은 따라옴)."""
    bpy.context.view_layer.update()
    M = pb.matrix.copy()
    h = M.to_translation()
    R = Matrix.Translation(h) @ Matrix.Rotation(math.radians(deg), 4, axis) @ Matrix.Translation(-h)
    pb.matrix = R @ M
    bpy.context.view_layer.update()


def main():
    body, out = build.arg('--body'), build.arg('--out')
    px = int(build.arg('--px') or 640)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    objs = build.import_new(body)
    arm = next(o for o in objs if o.type == 'ARMATURE')
    meshes = [o for o in objs if o.type == 'MESH' and any(md.type == 'ARMATURE' for md in o.modifiers)]   # 뼈 표시용 Icosphere(K-0114) 등 안 묶인 메시는 뺀다
    for o in objs:
        if o.type == 'MESH' and o not in meshes:
            bpy.data.objects.remove(o, do_unlink=True)
    # 쉬는 자세: T → 팔 내림(조금 벌려 몸통과 안 겹치게), 아래팔 살짝 굽힘
    pbs = arm.pose.bones
    for pb in pbs:
        pb.rotation_mode = 'QUATERNION'
    Y = Vector((0, 1, 0))
    if 'J_Bip_L_UpperArm' in pbs:
        rot_world(arm, pbs['J_Bip_L_UpperArm'], Y, 72)
        rot_world(arm, pbs['J_Bip_R_UpperArm'], Y, -72)
        X = Vector((1, 0, 0))
        rot_world(arm, pbs['J_Bip_L_LowerArm'], X, -12)
        rot_world(arm, pbs['J_Bip_R_LowerArm'], X, -12)
    # 메시를 자세 그대로 굳힌 뒤 부위별 객체로 나눈다
    bpy.context.view_layer.update()
    deps = bpy.context.evaluated_depsgraph_get()
    parts_obj = {p: [] for p in PARTS}
    zmin, zmax = 1e9, -1e9
    for m in meshes:
        ev = m.evaluated_get(deps)
        me = bpy.data.meshes.new_from_object(ev, preserve_all_data_layers=True, depsgraph=deps)
        me.transform(m.matrix_world)
        vg = {g.index: g.name for g in m.vertex_groups}
        memb = []                                                    # 꼭짓점마다 가중치 0.2 이상인 부위들 — 관절은 두 부위에 다 들어가 겹친다(돌려도 틈 없게)
        for v in m.data.vertices:
            w = {}
            for g in v.groups:
                if g.group in vg:
                    q = part_of(vg[g.group])
                    w[q] = w.get(q, 0) + g.weight
            memb.append({q for q, x in w.items() if x >= 0.2} or ({max(w, key=w.get)} if w else {'chest'}))
        by = {}
        for poly in me.polygons:
            for q in set().union(*(memb[vi] for vi in poly.vertices)):
                by.setdefault(q, []).append(poly.index)
        for p, faces in by.items():
            keep = set(faces)
            pm = me.copy()
            import bmesh
            bm = bmesh.new()
            bm.from_mesh(pm)
            bm.faces.ensure_lookup_table()
            bmesh.ops.delete(bm, geom=[f for f in bm.faces if f.index not in keep], context='FACES')
            bm.to_mesh(pm)
            bm.free()
            o = bpy.data.objects.new(f'{p}__{m.name}', pm)
            sc.collection.objects.link(o)
            parts_obj[p].append(o)
            for v in pm.vertices:
                zmin, zmax = min(zmin, v.co.z), max(zmax, v.co.z)
        bpy.data.objects.remove(m, do_unlink=True)
    # 뼈 축 자리(세계) — 자세 뒤
    bpy.context.view_layer.update()
    W = arm.matrix_world
    piv = {p: W @ pbs[b].head for p, b in PIVOT.items() if b in pbs}
    skirt = [W @ pb.head for pb in pbs if part_of(pb.name) == 'cape']
    piv['cape'] = min(skirt, key=lambda v: -v.z) if skirt else piv['hip']
    H = zmax - zmin
    cx = piv['hip']
    # 카메라: −X 쪽에서 +X 를 봄 → 화면 오른쪽 = 세계 −Y(몸 앞)
    cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam'))
    sc.collection.objects.link(cam)
    cam.data.type, cam.data.ortho_scale = 'ORTHO', H * 1.15
    cam.location = (cx.x - 10, cx.y, zmin + H / 2)
    cam.rotation_euler = (math.radians(90), 0, math.radians(-90))
    sc.camera = cam
    sc.render.engine = 'BLENDER_WORKBENCH'
    sc.render.resolution_x = sc.render.resolution_y = px
    sc.render.film_transparent = True
    sc.display.shading.light, sc.display.shading.color_type = 'FLAT', 'TEXTURE'
    sc.display.render_aa = '8'
    os.makedirs(os.path.join(out, 'parts'), exist_ok=True)

    def to2d(v):            # 세계 → 컷아웃 단위(몸 높이 100, 발 y 0, 위 −, 앞 = 화면 오른쪽 +)
        return [round((-(v.y - cx.y)) / H * 100, 2), round(-(v.z - zmin) / H * 100, 2)]

    def shot(path, show):
        for p, os_ in parts_obj.items():
            for o in os_:
                o.hide_render = p not in show
        sc.render.filepath = path
        bpy.ops.render.render(write_still=True)

    shot(os.path.join(out, 'full.png'), set(PARTS))
    for p in PARTS:
        if parts_obj[p]:
            shot(os.path.join(out, 'parts', p + '.png'), {p})
    # 부위 색 지도(가림 판정) — 물체 색 · 계단 없음
    sc.display.shading.color_type, sc.display.render_aa = 'OBJECT', 'OFF'
    sc.view_settings.view_transform, sc.view_settings.look = 'Standard', 'None'   # 기본 AgX 가 물체 색을 바꿔 부위 색 판정이 0 이 됐다(10-20)
    ids = {}
    for i, p in enumerate(PARTS):
        c = (((i * 37) % 251 + 4) / 255, ((i * 83) % 251 + 4) / 255, ((i * 151) % 251 + 4) / 255, 1)
        ids[p] = [round(x * 255) for x in c[:3]]
        for o in parts_obj[p]:
            o.color = c
    shot(os.path.join(out, 'idmap.png'), set(PARTS))
    # 화면 픽셀 ↔ 단위: 가운데 = 카메라, 한 픽셀 = ortho/px m
    meta = {'body': body, 'H_m': H, 'px': px, 'm_per_px': H * 1.15 / px,
            'cam_center_2d': to2d(Vector((0, cx.y, zmin + H / 2))), 'pivots': {p: to2d(v) for p, v in piv.items()},
            'ids': ids, 'parts': [p for p in PARTS if parts_obj[p]]}
    json.dump(meta, open(os.path.join(out, 'rig_src.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print('CUTOUT_RENDER', len(meta['parts']), 'H', round(H, 3))


if __name__ == '__main__':
    main()
