"""VRM 조합 변형기(K-0072 단계 2) — target 몸에 donor 머리카락(메시 + 흔들림 뼈)을 얹는다. 얼굴은 만들지 않는다(샘플 재료만).
Blender 헤드리스, VRM 애드온 없이 glTF 단계에서 한다(VRM 은 glTF 컨테이너). 출력은 .glb(VRM 확장·스프링본 데이터는 안 남는다 — 뼈는 남아 포즈로만 흔들림 없이 따라간다).

  blender -b --factory-startup -P tools/char-forge/vrm_mix.py -- <target.vrm> <donor.vrm> <out.glb> [head=1.05,arm=0.97,leg=1.0]
    target = 몸·얼굴·옷, donor = 머리카락(앞·뒤). 경로는 절대 경로로 준다(Blender 는 상대 경로를 드라이브 루트로 푼다).
    세 번째 뒤 인자(선택): 뼈 비율 — head·arm·leg 배율(1.0 = 그대로). 머리카락은 머리 크기를 따라간다.
머리카락 뼈 = 이름이 `HairJoint` 로 시작하는 뼈. 뒷머리 = Body 메시 안 `HairBack` 재질 면(donor 것을 떼어 오고 target 것은 지운다).
"""
import bpy, bmesh, sys, os, shutil, tempfile
from mathutils import Vector, Matrix

a = sys.argv[sys.argv.index('--') + 1:]
tgt_path, don_path, out_path = os.path.abspath(a[0]), os.path.abspath(a[1]), os.path.abspath(a[2])
ratios = {'head': 1.0, 'arm': 1.0, 'leg': 1.0}
if len(a) > 3:
    for kv in a[3].split(','):
        k, v = kv.split('=')
        ratios[k] = float(v)


def load(path, tag):
    before = set(bpy.data.objects)
    t = os.path.join(tempfile.gettempdir(), f'vm_{tag}.glb')
    shutil.copyfile(path, t)
    bpy.ops.import_scene.gltf(filepath=t)
    new = [o for o in bpy.data.objects if o not in before]
    arm = [o for o in new if o.type == 'ARMATURE'][0]
    meshes = {o.name.rstrip('.0123456789') if o.name.startswith(('Body', 'Face', 'Hair')) else o.name: o for o in new if o.type == 'MESH'}
    # 임포트가 이름에 .001 을 붙이므로 종류(Body·Face·Hair001 → Hair)로 정규화
    kinds = {}
    for o in new:
        if o.type != 'MESH':
            continue
        n = o.name
        kind = 'Body' if n.startswith('Body') else 'Face' if n.startswith('Face') else 'Hair' if n.startswith('Hair') else 'Other'
        kinds[kind] = o
    return arm, kinds, new


def head_pos(arm):
    b = arm.data.bones['J_Bip_C_Head']
    return arm.matrix_world @ b.head_local, (b.tail_local - b.head_local).length


def split_material_faces(obj, mat_key):
    """obj 에서 재질 이름에 mat_key 가 든 면만 복제한 새 오브젝트를 돌려준다(원본은 그대로)."""
    idx = [i for i, s in enumerate(obj.material_slots) if s.material and mat_key in s.material.name]
    if not idx:
        return None
    dup = obj.copy(); dup.data = obj.data.copy()
    bpy.context.scene.collection.objects.link(dup)
    bm = bmesh.new(); bm.from_mesh(dup.data)
    bmesh.ops.delete(bm, geom=[f for f in bm.faces if f.material_index not in idx], context='FACES')
    bm.to_mesh(dup.data); bm.free()
    dup.name = obj.name + '_' + mat_key
    return dup


def delete_material_faces(obj, mat_key):
    idx = [i for i, s in enumerate(obj.material_slots) if s.material and mat_key in s.material.name]
    bm = bmesh.new(); bm.from_mesh(obj.data)
    bmesh.ops.delete(bm, geom=[f for f in bm.faces if f.material_index in idx], context='FACES')
    bm.to_mesh(obj.data); bm.free()


def apply_proportions(arm, meshes, r):
    """뼈 비율 — 포즈로 늘이고(head=머리 전체·arm=위팔+아래팔 길이·leg=위다리+아래다리 길이) 그 결과를 메시와 뼈의 기본 자세로 굽는다.
    Face 처럼 모프(shape key)가 있는 메시는 모디파이어를 못 굽는다 → 평가된 정점과 기본 모프의 차이를 모든 모프에 더한다. 끝나면 발이 땅(z=0)에 오게 아마추어를 올리거나 내린다."""
    if all(abs(v - 1.0) < 1e-6 for v in r.values()):
        return
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.mode_set(mode='POSE')
    P = arm.pose.bones
    head_desc = set()
    hb = arm.data.bones.get('J_Bip_C_Head')
    if hb:
        head_desc = {c.name for c in hb.children_recursive}
    for bn in arm.data.bones:
        if bn.name != 'J_Bip_C_Head' and bn.name not in head_desc:
            bn.inherit_scale = 'NONE'        # 늘인 뼈의 배율이 자식 뼈로 번지지 않게(자식은 위치만 따라 움직인다)
    for side in 'LR':
        for part in ('UpperArm', 'LowerArm'):
            pb = P.get(f'J_Bip_{side}_{part}')
            if pb:
                pb.scale = (1, r['arm'], 1)
        for part in ('UpperLeg', 'LowerLeg'):
            pb = P.get(f'J_Bip_{side}_{part}')
            if pb:
                pb.scale = (1, r['leg'], 1)
    ph = P.get('J_Bip_C_Head')
    if ph:
        ph.scale = (r['head'], r['head'], r['head'])
    bpy.context.view_layer.update()
    dg = bpy.context.evaluated_depsgraph_get()
    newco = {}
    for o in meshes:
        evm = o.evaluated_get(dg).to_mesh()
        newco[o.name] = [v.co.copy() for v in evm.vertices]
        o.evaluated_get(dg).to_mesh_clear()
    bpy.ops.pose.armature_apply(selected=False)
    bpy.ops.object.mode_set(mode='OBJECT')
    for o in meshes:
        me = o.data; nc = newco[o.name]
        if me.shape_keys:
            basis = me.shape_keys.key_blocks[0]
            delta = [nc[i] - basis.data[i].co for i in range(len(nc))]
            for kb in me.shape_keys.key_blocks:
                for i in range(len(nc)):
                    kb.data[i].co += delta[i]
        for i in range(len(nc)):
            me.vertices[i].co = nc[i]
    zmin = min((o.matrix_world @ v.co).z for o in meshes for v in o.data.vertices)
    arm.location.z -= zmin


bpy.ops.wm.read_factory_settings(use_empty=True)
tarm, tk, tnew = load(tgt_path, 'tgt')
darm, dk, dnew = load(don_path, 'don')

Ht, _ = head_pos(tarm)
Hd, _ = head_pos(darm)


def face_height(o):
    zs = [(o.matrix_world @ v.co).z for v in o.data.vertices]
    return max(zs) - min(zs)


s = face_height(tk['Face']) / face_height(dk['Face'])     # 머리카락 크기 = 얼굴 메시 높이 비율(head 배율은 뒤에서 뼈로 따로 준다)
M = Matrix.Translation(Ht) @ Matrix.Scale(s, 4) @ Matrix.Translation(-Hd)       # donor 월드 → target 월드(머리 기준)

# 1) donor 머리카락 오브젝트: 뒷머리(Body 의 HairBack 면) 떼어 오기
back = split_material_faces(dk['Body'], 'HairBack') if 'Body' in dk else None
hair_objs = ([dk['Hair']] if 'Hair' in dk else []) + ([back] if back else [])      # Base_* 는 머리가 Body 의 HairBack 면 하나뿐

# 2) target 에 머리카락 뼈 만들기(donor 의 HairJoint 뼈를 같은 계층으로, 위치만 변환)
hair_bones = [b for b in darm.data.bones if b.name.startswith('HairJoint')]
bpy.context.view_layer.objects.active = tarm
bpy.ops.object.mode_set(mode='EDIT')
eb = tarm.data.edit_bones
made = {}
order = sorted(hair_bones, key=lambda b: len(b.parent_recursive))
for b in order:
    nb = eb.new(b.name)
    nb.head = tarm.matrix_world.inverted() @ (M @ (darm.matrix_world @ b.head_local))
    nb.tail = tarm.matrix_world.inverted() @ (M @ (darm.matrix_world @ b.tail_local))
    nb.roll = 0
    pn = b.parent.name if b.parent else 'J_Bip_C_Head'
    nb.parent = eb.get(pn) or eb.get('J_Bip_C_Head')
    nb.use_connect = False
    made[b.name] = nb
bpy.ops.object.mode_set(mode='OBJECT')

# 3) 머리카락 메시를 target 으로: 정점 변환 → 부모·아마추어 모디파이어 교체
for o in hair_objs:
    o.data.transform(M @ o.matrix_world)
    o.matrix_world = Matrix.Identity(4)
    for m in list(o.modifiers):
        o.modifiers.remove(m)
    o.parent = tarm
    o.matrix_parent_inverse = Matrix.Identity(4)
    mod = o.modifiers.new('Armature', 'ARMATURE'); mod.object = tarm
    # target 에 없는 뼈를 가리키는 정점 그룹은 지운다(donor 의 비-머리 뼈는 같은 휴머노이드 이름이라 대부분 있다)
    have = {b.name for b in tarm.data.bones}
    for g in list(o.vertex_groups):
        if g.name not in have:
            o.vertex_groups.remove(g)

# 4) 정리: target 의 옛 머리카락 제거, donor 의 나머지 제거
tnew_names = [o.name for o in tnew]
dnew_names = [o.name for o in dnew]
if tk.get('Hair'):
    bpy.data.objects.remove(tk['Hair'], do_unlink=True)
if 'Body' in tk:
    delete_material_faces(tk['Body'], 'HairBack')
keep = {o.name for o in hair_objs}
for n in tnew_names:
    if n.startswith('Icosphere') and n in bpy.data.objects:
        bpy.data.objects.remove(bpy.data.objects[n], do_unlink=True)
for n in dnew_names:
    if n in bpy.data.objects and n not in keep:
        bpy.data.objects.remove(bpy.data.objects[n], do_unlink=True)

# 5) 뼈 비율
apply_proportions(tarm, [o for o in bpy.data.objects if o.type == 'MESH' and o.parent == tarm], ratios)

for o in bpy.data.objects:
    o.select_set(False)
bpy.ops.export_scene.gltf(filepath=out_path, export_format='GLB', export_apply=False, export_morph=True, export_skins=True,
                          use_selection=False, export_animations=False)
print('MIX_OK', os.path.basename(tgt_path), '+hair', os.path.basename(don_path), 'scale', round(s, 3), 'hairbones', len(made), 'objs', [o.name for o in bpy.data.objects if o.type == 'MESH'])
