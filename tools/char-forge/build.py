"""char-forge 빌더 — 레시피 하나 → 뼈·몸·머리·동작이 든 .glb (+ Unity 용 .fbx).

    blender -b --factory-startup -P tools/char-forge/build.py -- \
        --recipe tools/char-forge/recipes/_test_toon_01.json --out tools/char-forge/_out/_test_toon_01.glb \
        [--fbx tools/char-forge/_out/_test_toon_01.fbx] [--check]

입력은 sources.json 에 적힌 CC0 팩뿐(_src/, fetch_sources.py 로 받는다). 사람 클릭 없음.
동작은 Quaternius Universal Animation Library(Unreal 판 FBX — 표준 뼈 이름이 몸과 같다)를
"쉼 자세 기준 월드 회전" 으로 구워 옮긴다: 두 뼈대의 쉼 자세가 목 14°·발 9° 쯤 달라
곡선을 그대로 베끼면 틀어지기 때문이다(2026-09-24 측정).
"""
import bpy, json, math, os, sys
from mathutils import Matrix, Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import rigmaps  # noqa: E402
import keyframes  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, '_src')
UBC = os.path.join(SRC, 'Universal Base Characters[Standard]')
UAL_FBX = os.path.join(SRC, 'Animation Library[Standard]', 'Unreal Engine', 'AL_Standard.fbx')
MCOF = os.path.join(SRC, 'Modular Character Outfits - Fantasy[Standard]')
OUTFITS = {  # 무료판에 든 옷 넷 — 옷 색 번호별 BaseColor(1 = 기본)
    'Female_Ranger': ('Ranger', {1: 'T_Ranger_BaseColor.png', 3: 'T_Ranger_3_BaseColor.png'}),
    'Male_Ranger': ('Ranger', {1: 'T_Ranger_BaseColor.png', 3: 'T_Ranger_3_BaseColor.png'}),
    'Female_Peasant': ('Peasant', {1: 'T_Peasant_BaseColor.png', 2: 'T_Peasant_2_BaseColor.png'}),
    'Male_Peasant': ('Peasant', {1: 'T_Peasant_BaseColor.png', 2: 'T_Peasant_2_BaseColor.png'}),
}
# 옷을 입힐 땐 몸 팩에서 머리·목·윗가슴만 쓴다(옷 팩 Readme: 몸 전체를 쓰면 뚫고 나온다).
# 머리·목만 남기면 트인 옷깃(목 앞)으로 잘린 자리가 30~40% 드러났다(2026-09-24 측정) — 윗가슴까지 남기고 옷 속에 눌러 넣는다.
HEAD_GROUPS = {'Head', 'neck_01', 'spine_03', 'spine_02', 'clavicle_l', 'clavicle_r'}  # spine_02: 남자 순찰자 옷 V 깃이 깊다
UNDER_CLOTH = 0.006  # 옷 아래로 눌러 넣는 깊이(m) — 얕으면 먼 거리에서 깊이 버퍼가 겹쳐 깜박인다
MAX_TEX = 2048  # 옷 팩 4096² → 2048². 지금 VRoid 몸 텍스처는 가장 큰 게 1024 라 그보다 두 배 — 폰 화면에서 안 보이는 몫만 줄인다

BASES = {  # 무료판에 든 몸 둘
    'superhero_female': ('Godot - UE/Superhero_Female_FullBody.gltf', 'Superhero_Female',
                         {'light': 'T_Superhero_Female_Light_BaseColor.png', 'dark': 'T_Superhero_Female_Dark_BaseColor.png'}),
    'superhero_male': ('Godot - UE/Superhero_Male_FullBody.gltf', 'Superhero_Male',
                       {'light': 'T_Superhero_Male_Ligh.png', 'dark': 'T_Superhero_Male_Dark.png'}),
}
HAIRS = ('Hair_Long', 'Hair_Buns', 'Hair_SimpleParted', 'Hair_Buzzed', 'Hair_BuzzedFemale', 'Hair_Beard',
         'Eyebrows_Female', 'Eyebrows_Regular')
SKIP_ANIMS = {'A_TPose'}  # 자세 확인용 — 게임엔 안 넣는다


def arg(name, default=None):
    a = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    if name in a:
        i = a.index(name)
        return a[i + 1] if i + 1 < len(a) and not a[i + 1].startswith('--') else True
    return default


class ctx:
    """백그라운드 모드 연산자 문맥 — 실제 활성·선택을 바꿔 준다(temp_override 만으론 pose 연산자 poll 이 실패)."""

    def __init__(self, active, selected):
        self.active, self.selected = active, selected

    def __enter__(self):
        vl = bpy.context.view_layer
        for o in vl.objects:
            o.select_set(o in self.selected)
        vl.objects.active = self.active
        return self

    def __exit__(self, *a):
        return False


def import_new(path):
    before = set(bpy.data.objects)
    if path.lower().endswith('.fbx'):
        bpy.ops.import_scene.fbx(filepath=path)
    else:
        bpy.ops.import_scene.gltf(filepath=path)
    return [o for o in bpy.data.objects if o not in before]


def delete(objs):
    for o in objs:
        bpy.data.objects.remove(o, do_unlink=True)


def hex_rgba(h):
    h = h.lstrip('#')
    srgb = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    lin = [c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in srgb]
    return (*lin, 1.0)


# ---------- A 몸 ----------

def load_body(recipe):
    rel, body_name, skins = BASES[recipe['base']]
    objs = import_new(os.path.join(UBC, 'Base Characters', rel))
    arm = next(o for o in objs if o.type == 'ARMATURE')
    delete([o for o in objs if o.type == 'MESH' and o.parent is not arm])  # 팩에 섞인 빈 Icosphere
    arm.name = recipe['id']
    body = next(o for o in arm.children if o.name.lower().startswith(body_name.lower()))  # 남자 몸은 'SuperHero_Male'
    tex = skins.get(recipe.get('skin', 'dark'))
    if tex:  # 피부 결: 팩의 밝은·어두운 두 장 중 하나
        bsdf = next(n for n in body.active_material.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
        link = bsdf.inputs['Base Color'].links
        if link and link[0].from_node.type == 'TEX_IMAGE':
            link[0].from_node.image = bpy.data.images.load(os.path.join(UBC, 'Base Characters', 'Textures', tex),
                                                           check_existing=True)
    return arm, body


def attach_head_mesh(arm, name, offset=None):
    """'Origin at 0' 머리·눈썹 메시를 Head 뼈에 가중치 1 로 묶는다. offset: 옷 뼈대로 옮긴 머리만큼 같이 옮긴다."""
    objs = import_new(os.path.join(UBC, 'Hairstyles', 'Origin at 0', 'glTF (Godot)', name + '.gltf'))
    meshes = [o for o in objs if o.type == 'MESH']
    delete([o for o in objs if o.type != 'MESH'])
    for m in meshes:
        m.matrix_world = Matrix.Translation(offset or Vector()) @ m.matrix_world
        m.parent = arm
        m.matrix_parent_inverse = arm.matrix_world.inverted()
        vg = m.vertex_groups.new(name='Head')
        vg.add(range(len(m.data.vertices)), 1.0, 'REPLACE')
        mod = m.modifiers.new('Armature', 'ARMATURE')
        mod.object = arm
    return meshes


# ---------- D 옷 ----------

def dominant_group(obj, v):
    if not v.groups:
        return None
    g = max(v.groups, key=lambda g: g.weight)
    return obj.vertex_groups[g.group].name


def keep_only_groups(obj, keep):
    """정점마다 가장 큰 가중치 뼈가 keep 밖이면 지운다(몸 팩에서 머리·목만 남기기)."""
    import bmesh
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    deform = bm.verts.layers.deform.active
    kill = []
    for v in bm.verts:
        w = v[deform] if deform else {}
        if not w:
            kill.append(v)
            continue
        gi = max(w.items(), key=lambda kv: kv[1])[0]
        if obj.vertex_groups[gi].name not in keep:
            kill.append(v)
    bmesh.ops.delete(bm, geom=kill, context='VERTS')
    bm.to_mesh(obj.data)
    bm.free()


def dress(recipe):
    """옷 뼈대(Regular 비율)를 인물 뼈대로 삼고, 몸 팩의 머리(얼굴·눈·눈썹)만 떼어 그 Head 뼈에 옮겨 붙인다."""
    name = recipe['outfit']
    kind, colors = OUTFITS[name]
    objs = import_new(os.path.join(MCOF, 'Exports', 'glTF (Godot-Unreal)', 'Outfits', name + '.gltf'))
    arm = next(o for o in objs if o.type == 'ARMATURE')
    delete([o for o in objs if o.type == 'MESH' and o.parent is not arm])
    for m in [c for c in arm.children if c.type == 'MESH']:
        if any(m.name.endswith('_' + part) or ('_' + part + '_') in m.name for part in recipe.get('outfit_drop', [])):
            delete([m])
    tex = colors.get(int(recipe.get('outfit_color', 1)))
    if tex:
        img = bpy.data.images.load(os.path.join(MCOF, 'Textures', kind, tex), check_existing=True)
        for mat in {s.material for m in arm.children if m.type == 'MESH' for s in m.material_slots if s.material}:
            # 바탕색 입력을 거슬러 올라가 옷 바탕색 그림을 찾는다(중간에 섞기 노드가 끼어 있기도 하다)
            for n in mat.node_tree.nodes:
                if n.type == 'TEX_IMAGE' and n.image and n.image.name.startswith(f'T_{kind}') and 'BaseColor' in n.image.name:
                    n.image = img
    barm, body = load_body({**recipe, 'skin': 'dark'})  # 옷 팩 팔 피부가 Dark 한 벌뿐이라 머리도 Dark 로 맞춘다
    offset = (arm.matrix_world @ arm.data.bones['Head'].head_local) - (barm.matrix_world @ barm.data.bones['Head'].head_local)
    keep_only_groups(body, HEAD_GROUPS)
    for m in [c for c in barm.children if c.type == 'MESH']:
        mw = m.matrix_world.copy()
        m.parent = arm
        m.matrix_world = Matrix.Translation(offset) @ mw
        for mod in m.modifiers:
            if mod.type == 'ARMATURE':
                mod.object = arm
    delete([barm])
    tuck_under_cloth(arm, body)
    arm.name = recipe['id']
    return arm, body, offset


def cloth_tree(arm, skip):
    from mathutils.bvhtree import BVHTree
    others = [m for m in arm.children if m.type == 'MESH' and m not in skip and not m.name.startswith(('Eye', 'Hair'))]
    verts, polys = [], []
    for m in others:
        base = len(verts)
        verts += [m.matrix_world @ v.co for v in m.data.vertices]
        polys += [[base + i for i in p.vertices] for p in m.data.polygons]
    return BVHTree.FromPolygons(verts, polys), verts


def tuck_under_cloth(arm, body):
    """몸 팩 윗가슴·목 살이 옷 밖으로 비어져 나오면(Superhero 몸이 옷의 Regular 몸보다 크다) 옷 면 바로 아래로 눌러 넣고,
    옷에 완전히 덮인 살은 지운다. 덮인 쪽과 맞닿은 한 줄은 남겨 옷깃 아래로 살이 겹치게 한다(틈이 안 보이게)."""
    import bmesh
    tree, _ = cloth_tree(arm, {body})
    mw, mwi = body.matrix_world, body.matrix_world.inverted()
    bm = bmesh.new()
    bm.from_mesh(body.data)
    deform = bm.verts.layers.deform.active
    head_gi = body.vertex_groups['Head'].index
    moved = 0
    for v in bm.verts:
        w = v[deform]
        if w and max(w.items(), key=lambda kv: kv[1])[0] == head_gi:
            continue  # 얼굴은 건드리지 않는다
        pw = mw @ v.co
        q, n, _, dist = tree.find_nearest(pw)
        if q is None or dist > 0.05:
            continue
        outside = (pw - q).dot(n) > 0
        if outside or dist < UNDER_CLOTH:
            v.co = mwi @ (q - n.normalized() * UNDER_CLOTH)
            moved += 1
    bm.normal_update()
    covered = set()
    for v in bm.verts:
        pw = mw @ v.co
        nw = (mw.to_3x3() @ v.normal).normalized()
        hit = tree.ray_cast(pw + nw * 0.001, nw, 0.12)
        if hit[0] is not None:
            covered.add(v)
    # 목(neck_01)은 덮였어도 남긴다 — 옷깃과 목 사이가 벌어진 옷은 위에서 내려다볼 때 목을 지운 자리가 구멍으로 보인다
    neck = {body.vertex_groups[n].index for n in ('Head', 'neck_01')}

    def dom(v):
        w = v[deform]
        return max(w.items(), key=lambda kv: kv[1])[0] if w else None
    kill = [v for v in covered if dom(v) not in neck and all(e.other_vert(v) in covered for e in v.link_edges)]
    bmesh.ops.delete(bm, geom=kill, context='VERTS')
    bm.to_mesh(body.data)
    bm.free()
    return moved, len(kill)


def seam_gap(arm, head):
    """머리를 떼어 낸 가장자리(Head 뼈보다 아래 = 목·가슴 쪽) 정점이 옷에 덮였나.
    covered = 그 정점에서 바깥 법선 쪽으로 쏜 광선이 옷에 막히는 비율(1.0 이면 잘린 자리가 밖에서 안 보인다)."""
    tree, verts = cloth_tree(arm, {head})
    count = {e.key: 0 for e in head.data.edges}
    for poly in head.data.polygons:
        for k in poly.edge_keys:
            count[k] += 1
    hz = (arm.matrix_world @ arm.data.bones['Head'].head_local).z
    mw = head.matrix_world
    edge = [head.data.vertices[i] for i in {i for k, c in count.items() if c == 1 for i in k}]
    edge = [v for v in edge if (mw @ v.co).z < hz]  # 눈구멍·입 안처럼 원래 열린 자리는 뺀다
    # glTF 들이기는 UV 이음매에서 정점을 둘로 나눈다 — 같은 자리에 짝이 있는 가장자리는 실제로 닫혀 있다
    from mathutils import kdtree
    kd = kdtree.KDTree(len(head.data.vertices))
    for v in head.data.vertices:
        kd.insert(v.co, v.index)
    kd.balance()
    edge = [v for v in edge if len(kd.find_range(v.co, 1e-5)) < 2]
    if not edge:
        return {'edge_verts': 0}
    covered = 0
    bare = []
    for v in edge:
        pw = mw @ v.co
        nw = (mw.to_3x3() @ v.normal).normalized()
        hit = tree.ray_cast(pw + nw * 0.001, nw, 1.0)[0] is not None  # 1m: 몸통 속 가장자리는 결국 옷에 막힌다 = 밖에서 안 보인다
        covered += hit
        if not hit:
            bare.append(pw)
    # 안 덮인 곳이 어디쯤인가(좌우 |x|·높이 z·앞뒤 y) — 목 앞이면 보이고, 옷 조각 사이 틈이면 대개 안 보인다
    where = sorted({(round(abs(p.x), 2), round(p.z, 2), round(p.y, 2)) for p in bare})[:8]
    return {'edge_verts': len(edge), 'covered': round(covered / len(edge), 3), 'bare_xzy': where,
            'cut_z_min': round(min((mw @ v.co).z for v in edge), 3), 'outfit_top_z': round(max(v.z for v in verts), 3)}


def albedo_only():
    """툰(saga-godot cel_toon)은 바탕색 텍스처 하나만 읽는다 — 노멀·거칠기·ORM 을 떼어 파일만 무겁게 하지 않는다(화면은 같다)."""
    for mat in bpy.data.materials:
        if not mat.use_nodes:
            continue
        nt = mat.node_tree
        bsdf = next((n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED'), None)
        keep = set()
        if bsdf and bsdf.inputs['Base Color'].links:
            stack = [bsdf.inputs['Base Color'].links[0].from_node]
            while stack:
                n = stack.pop()
                keep.add(n)
                for i in n.inputs:
                    stack += [l.from_node for l in i.links]
        for n in list(nt.nodes):
            if n.type in ('TEX_IMAGE', 'NORMAL_MAP', 'SEPARATE_COLOR', 'SEPARATE_RGB') and n not in keep:
                nt.nodes.remove(n)


def cap_textures(limit=MAX_TEX):
    for im in bpy.data.images:
        w, h = im.size[:]
        if max(w, h) > limit:
            k = limit / max(w, h)
            im.scale(int(w * k), int(h * k))


# ---------- 비율 ----------

def bake_pose_as_rest(arm):
    dg = bpy.context.evaluated_depsgraph_get()
    for m in [c for c in arm.children if c.type == 'MESH']:
        ev = m.evaluated_get(dg)
        new = bpy.data.meshes.new_from_object(ev, preserve_all_data_layers=True, depsgraph=dg)
        old = m.data
        m.data = new
        bpy.data.meshes.remove(old)
    with ctx(arm, [arm]):
        bpy.ops.object.mode_set(mode='POSE')
        bpy.ops.pose.armature_apply(selected=False)
        bpy.ops.object.mode_set(mode='OBJECT')


def shape(arm, body, recipe):
    hs = float(recipe.get('head_scale', 1.0))
    if abs(hs - 1.0) > 1e-6:
        arm.pose.bones['Head'].scale = (hs, hs, hs)
        bpy.context.view_layer.update()
        bake_pose_as_rest(arm)
    h = recipe.get('height')
    if h:
        top = max((body.matrix_world @ Vector(c)).z for c in body.bound_box)
        k = float(h) / top
        arm.scale = (k, k, k)
        bpy.context.view_layer.update()
        objs = [arm] + list(arm.children)
        with ctx(arm, objs):
            bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)


# ---------- F 재질 ----------

def slot_of(mat_name, mesh_name):
    n = mat_name.lower()
    if 'eye' in n and 'brow' not in mesh_name.lower():
        return 'eye'
    if 'hair' in n:
        return 'hair'
    if any(k in n for k in ('superhero', 'regular', 'skin')):
        return 'skin'
    return 'cloth_a'


def materials(arm, body, recipe):
    """재질 이름을 표준 칸(skin·hair·eye·cloth_a)으로 — 같은 칸에 원본이 둘이면 skin_2 처럼 번호를 붙인다.
    엔진(cel_shader_apply·CharacterVisual)은 이름 앞머리로 받는다."""
    colors = recipe.get('colors', {})
    made = {}
    used = {}
    for m in [c for c in arm.children if c.type == 'MESH']:
        for i, mat in enumerate(m.data.materials):
            if not mat:
                continue
            if mat.name in made:
                m.data.materials[i] = made[mat.name]
                continue
            slot = slot_of(mat.name, m.name)
            used[slot] = used.get(slot, 0) + 1
            new = mat.copy()
            new.name = slot if used[slot] == 1 else f'{slot}_{used[slot]}'
            made[mat.name] = new
            m.data.materials[i] = new
            col = colors.get(slot)
            if col and slot == 'hair':  # 텍스처 × 색 (glTF 익스포터가 baseColorFactor 로 옮긴다)
                nt = new.node_tree
                bsdf = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
                link = bsdf.inputs['Base Color'].links[0] if bsdf.inputs['Base Color'].links else None
                if link:
                    mix = nt.nodes.new('ShaderNodeMix')
                    mix.data_type = 'RGBA'
                    mix.blend_type = 'MULTIPLY'
                    mix.inputs['Factor'].default_value = 1.0
                    nt.links.new(link.from_socket, mix.inputs['A'])
                    mix.inputs['B'].default_value = hex_rgba(col)
                    nt.links.new(mix.outputs['Result'], bsdf.inputs['Base Color'])
                else:
                    bsdf.inputs['Base Color'].default_value = hex_rgba(col)


# ---------- G 동작 ----------

def topo(bones):
    out = []

    def walk(b):
        out.append(b)
        for c in b.children:
            walk(c)
    for b in bones:
        if b.parent is None:
            walk(b)
    return out


def new_channelbag(act, owner):
    slot = act.slots.new(id_type='OBJECT', name=owner.name)
    try:
        from bpy_extras import anim_utils
        return slot, anim_utils.action_ensure_channelbag_for_slot(act, slot)
    except (ImportError, AttributeError):
        layer = act.layers.new('Layer')
        strip = layer.strips.new(type='KEYFRAME')
        return slot, strip.channelbag(slot, ensure=True)


def face_like(src, tgt, pairs):
    """두 뼈대의 앞(발목 → 발끝)이 반대면 원본을 Z 축 180° 돌린다(saga_forest_avatar_01 은 뒤돌아 있다)."""
    def fwd(arm, foot, ball):
        v = (arm.matrix_world @ arm.data.bones[ball].head_local) - (arm.matrix_world @ arm.data.bones[foot].head_local)
        v.z = 0
        return v.normalized()
    if fwd(src, 'foot_l', 'ball_l').dot(fwd(tgt, pairs['foot_l'], pairs['ball_l'])) < 0:
        src.rotation_euler.z += math.pi
        bpy.context.view_layer.update()
        return True
    return False


def rest_align(src, s_rest, t_rest, pairs):
    """뼈마다 타깃 쉼 방향 → 원본 쉼 방향 최소 회전(비틀림 없음). 방향 = 기준 자식 머리 - 내 머리(rigmaps.REF_CHILD)."""
    align = {}
    for s in rigmaps.STD_BONES:
        if s not in pairs:
            continue
        c = rigmaps.REF_CHILD.get(s)
        if c and c in pairs:
            sd = (s_rest[c].translation - s_rest[s].translation).normalized()
            td = (t_rest[pairs[c]].translation - t_rest[pairs[s]].translation).normalized()
            align[s] = td.rotation_difference(sd).to_matrix()
        else:  # 끝 뼈: 부모 맞춤을 물려받는다
            p = src.data.bones[s].parent
            align[s] = align.get(p.name, Matrix.Identity(3)) if p else Matrix.Identity(3)
    return align


def retarget(tgt, want, check, name_map=None):
    """UAL 동작을 tgt 뼈대에 굽는다.
    want: 'all' | [UAL 이름…] | {내보낼 이름: UAL 이름}. name_map: 표준 → tgt 뼈 이름(rigmaps.MAPS)."""
    name_map = name_map or rigmaps.IDENTITY
    objs = import_new(UAL_FBX)
    src = next(o for o in objs if o.type == 'ARMATURE')
    delete([o for o in objs if o is not src])
    scene = bpy.context.scene
    scene.render.fps, scene.render.fps_base = 30, 1.0
    # 무료판에 없는 동작(CF_*)은 동작 팩 뼈대 위에 코드로 짓는다 — 그다음은 UAL 동작과 같은 길(keyframes.py)
    keyframes.add(src, [v for v in (want.values() if isinstance(want, dict) else want if isinstance(want, (list, tuple)) else [])])
    src_acts = [a for a in bpy.data.actions if a.name.startswith('Rig|')]
    pairs = {s: t for s, t in name_map.items() if t and s in src.data.bones and t in tgt.data.bones}
    t2s = {t: s for s, t in pairs.items()}
    flipped = face_like(src, tgt, pairs)
    # 동작 팩 FBX 는 뼈대 오브젝트 회전까지 키로 가져 frame_set 마다 되돌아간다 — 돌린 뒤의 행렬을 여기서 붙들어 끝까지 쓴다
    smw, tmw = src.matrix_world.copy(), tgt.matrix_world.copy()
    s_rest = {b.name: smw @ b.matrix_local for b in src.data.bones}
    t_rest_arm = {b.name: b.matrix_local.copy() for b in tgt.data.bones}
    t_rest = {n: tmw @ m for n, m in t_rest_arm.items()}
    order = topo(tgt.data.bones)
    # 쉼 방향 맞춤: 이게 없으면 두 쉼 자세 차이(목 14°·발 9°)만큼 모든 동작이 기운다(verify.py 로 측정, 칼 휘두르기 15.6°)
    align = rest_align(src, s_rest, t_rest, pairs)

    # 골반 이동 배율 = 다리 길이 비(골반 높이 비는 몸 비율이 다르면 발이 뜨거나 묻힌다)
    def leg(R, nm):
        return sum((R[nm[a]].translation - R[nm[b]].translation).length
                   for a, b in (('thigh_l', 'calf_l'), ('calf_l', 'foot_l')))
    k = leg(t_rest, pairs) / leg(s_rest, rigmaps.IDENTITY)
    moving = {pairs[s] for s in ('root', 'pelvis') if s in pairs}
    s_feet, t_feet = ('foot_l', 'foot_r'), (pairs['foot_l'], pairs['foot_r'])
    below_pelvis = set()

    def sub(b):
        below_pelvis.add(b.name)
        for c in b.children:
            sub(c)
    sub(tgt.data.bones[pairs['pelvis']])
    if isinstance(want, dict):
        jobs = list(want.items())
    else:
        jobs = [(n, n) for n in (a.name.split('|')[-1] for a in src_acts)
                if n not in SKIP_ANIMS and (want == 'all' or n in want)]
    by_name = {a.name.split('|')[-1]: a for a in src_acts}
    report = {'_meta': {'flipped': flipped, 'leg_ratio': round(k, 4), 'bones': len(pairs)}}
    made = []
    src.animation_data_create()
    for out_name, ual_name in jobs:
        sa = by_name.get(ual_name)
        if sa is None:
            sys.exit(f'동작 팩에 {ual_name} 이 없다')
        src.animation_data.action = sa
        if sa.slots and src.animation_data.action_slot is None:
            src.animation_data.action_slot = sa.slots[0]
        f0, f1 = (int(round(x)) for x in sa.frame_range)
        frames = list(range(f0, f1 + 1))
        keys = {n: {'loc': [], 'rot': []} for n in t2s}
        ground_err = None
        hips_xy = []
        for f in frames:
            scene.frame_set(f)
            W = {}
            for b in order:
                n = b.name
                p = b.parent
                s = t2s.get(n)
                if s:
                    sw = smw @ src.pose.bones[s].matrix
                    rot = (sw.to_3x3().normalized() @ s_rest[s].to_3x3().normalized().inverted()
                           @ align[s] @ t_rest[n].to_3x3().normalized())
                    if n in moving or p is None:
                        t = t_rest[n].translation + (sw.translation - s_rest[s].translation) * k
                    else:
                        t = (W[p.name] @ (t_rest[p.name].inverted() @ t_rest[n])).translation
                    W[n] = Matrix.Translation(t) @ rot.to_4x4()
                else:
                    W[n] = (W[p.name] @ (t_rest[p.name].inverted() @ t_rest[n])) if p else t_rest[n]
            # 땅 붙이기: 원본의 낮은 발이 땅(쉼 높이 ±1cm)에 있으면 구운 쪽 낮은 발도 거기에 — 골반 아래를 통째로 올리고 내린다.
            # 1~3cm 사이는 서서히 풀어 뜀뛰기 이륙·착지에서 튀지 않게 한다.
            s_low = min((smw @ src.pose.bones[fb].matrix).translation.z - s_rest[fb].translation.z for fb in s_feet)
            t_low = min(W[fb].translation.z - t_rest[fb].translation.z for fb in t_feet)
            w = max(0.0, min(1.0, 1.0 - (abs(s_low) - 0.01) / 0.02))
            dz = (s_low - t_low) * w
            if dz:
                for n in below_pelvis:
                    W[n] = Matrix.Translation((0, 0, dz)) @ W[n]
            if check and abs(s_low) < 0.01:
                e = abs(min(W[fb].translation.z - t_rest[fb].translation.z for fb in t_feet) - s_low)
                ground_err = max(ground_err or 0.0, e)
            hips_xy.append(W[pairs['pelvis']].translation.xy.copy())
            A = {n: tmw.inverted() @ m for n, m in W.items()}
            for n in t2s:
                p = tgt.data.bones[n].parent
                if p is None:
                    basis = t_rest_arm[n].inverted() @ A[n]
                else:
                    basis = (t_rest_arm[n].inverted() @ t_rest_arm[p.name]) @ A[p.name].inverted() @ A[n]
                loc, q, _ = basis.decompose()
                prev = keys[n]['rot'][-1] if keys[n]['rot'] else None
                if prev is not None and prev.dot(q) < 0:
                    q.negate()
                keys[n]['loc'].append(loc)
                keys[n]['rot'].append(q)
        act = bpy.data.actions.new(out_name)
        act.use_fake_user = True
        slot, cb = new_channelbag(act, tgt)
        for n in t2s:
            for path, vals, count in ((f'pose.bones["{n}"].location', keys[n]['loc'], 3),
                                      (f'pose.bones["{n}"].rotation_quaternion', keys[n]['rot'], 4)):
                if path.endswith('location') and n not in moving and all((v.length < 1e-5) for v in vals):
                    continue
                for i in range(count):
                    fc = cb.fcurves.new(path, index=i, group_name=n)
                    fc.keyframe_points.add(len(frames))
                    co = []
                    for fr, v in zip(frames, vals):
                        co += [fr, v[i]]
                    fc.keyframe_points.foreach_set('co', co)
                    for kp in fc.keyframe_points:
                        kp.interpolation = 'LINEAR'
                    fc.update()
        made.append((act, slot))
        # ground_err: 원본이 발을 땅에 댄 프레임에서 구운 쪽 낮은 발 높이 차(최대) · drift: 골반이 처음→끝 수평으로 간 거리(제자리인지)
        report[out_name] = {'src': ual_name, 'frames': len(frames),
                            'ground_err_m': round(ground_err, 4) if ground_err is not None else None,
                            'drift_m': round((hips_xy[-1] - hips_xy[0]).length, 3)}
    for pb in tgt.pose.bones:
        pb.rotation_mode = 'QUATERNION'
    tgt.animation_data_create()
    for act, slot in made:  # NLA 에도 올려 둔다(익스포터가 동작마다 한 벌씩 낸다)
        tr = tgt.animation_data.nla_tracks.new()
        tr.name = act.name
        st = tr.strips.new(act.name, int(act.frame_range[0]), act)
        try:
            st.action_slot = slot
        except AttributeError:
            pass
        tr.mute = True
    delete([src])
    for a in src_acts:
        bpy.data.actions.remove(a)
    return report


# ---------- H 내보내기 ----------

def deterministic_fbx():
    """Blender FBX 익스포터는 만든 시각과 파이썬 hash(프로세스마다 무작위)로 id 를 만든다 — 같은 레시피가 다른 파일이 된다.
    시각은 고정하고, id 는 키 글자의 sha1 로 바꾼다(glb 는 원래 같은 바이트가 나온다)."""
    import datetime, hashlib
    from io_scene_fbx import export_fbx_bin as efb, fbx_utils as fu
    if getattr(fu, '_charforge_patched', False):
        return
    orig_header = efb.fbx_header_elements
    efb.fbx_header_elements = lambda root, scene_data, time=None: orig_header(
        root, scene_data, datetime.datetime(2026, 1, 1))

    def key_to_uuid(uuids, key):
        uuid = int.from_bytes(hashlib.sha1(repr(key).encode('utf-8')).digest()[:8], 'little') % int(1e9)
        while uuid in uuids:
            uuid += 1
        return uuid
    fu._key_to_uuid = key_to_uuid
    fu._charforge_patched = True


def decimate(arm, ratio):
    """레시피 decimate(0~1) — 조각마다 삼각형을 그 비율로 줄인다(09-29 마을 사람 — 여럿 서 있는 몸은 가까이서 안 본다).
    눈·눈썹은 작아 그대로 둔다. 뼈 가중치(정점 그룹)는 Collapse 가 보간해 남긴다."""
    for m in [c for c in arm.children if c.type == 'MESH' and not c.name.startswith(('Eye', 'Eyebrows', 'ZZ_'))]:
        decimate_obj(m, ratio)


def decimate_obj(m, ratio):
    # 연산자(modifier_apply)는 배경 실행 문맥에서 몸마다 조용히 건너뛰었다 — bake_pose_as_rest 처럼 평가 결과로 메시를 바꾼다.
    # 다른 모디파이어(아마추어)는 잠깐 꺼서 쉼 자세 메시만 줄인다.
    if True:
        states = [(md, md.show_viewport) for md in m.modifiers]
        for md, _ in states:
            md.show_viewport = False
        dec = m.modifiers.new('Decimate', 'DECIMATE')
        dec.ratio = ratio
        dec.use_collapse_triangulate = True
        dg = bpy.context.evaluated_depsgraph_get()
        dg.update()
        new = bpy.data.meshes.new_from_object(m.evaluated_get(dg), preserve_all_data_layers=True, depsgraph=dg)
        m.modifiers.remove(dec)
        for md, s in states:
            md.show_viewport = s
        m.data = new


def shadow_proxy(arm, ratio):
    """레시피 shadow_proxy(0~1) — 몸 조각(눈·눈썹 빼고)을 복사해 한 물체로 합치고 그 비율로 줄인 그림자 대역 ZZ_ShadowProxy.
    엔진이 이 물체만 그림자를 드리우게 하고(saga-godot vroid_body.setup_shadow_proxy) 보이는 조각은 그림자를 끈다 —
    09-29 PERF: 플레이어 몸 몫 11만 삼각형 중 그림자 패스(캐스케이드마다 다시 그림)가 6.8만. 이름 ZZ_ 는 엔진 노드 차례에서 뒤로(첫 메시 = 보이는 몸)."""
    src = [c for c in arm.children if c.type == 'MESH' and not c.name.startswith(('Eye', 'Eyebrows'))]
    dups = []
    for m in src:
        d = m.copy()
        d.data = m.data.copy()
        m.users_collection[0].objects.link(d)
        dups.append(d)
    bpy.ops.object.select_all(action='DESELECT')
    for d in dups:
        d.select_set(True)
    bpy.context.view_layer.objects.active = dups[0]
    bpy.ops.object.join()
    proxy = dups[0]
    proxy.name = 'ZZ_ShadowProxy'
    decimate_obj(proxy, ratio)


def join_meshes(arm):
    """조각 메시(옷 부위·머리·눈·눈썹)를 한 물체로 — 같은 재질 칸은 한 면 묶음이 돼 엔진 draw call 이 준다(09-29 saga-godot
    마을 draw call 평균 208 → 228·최댓값 244 → 302, 몸 하나가 조각 12 × 외곽선 2). 뼈 가중치·아마추어 모디파이어는 그대로 합쳐진다."""
    meshes = [c for c in arm.children if c.type == 'MESH']
    if len(meshes) < 2:
        return
    bpy.ops.object.select_all(action='DESELECT')
    for m in meshes:
        m.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]
    bpy.ops.object.join()
    meshes[0].name = arm.name + '_Body'


def export(arm, out_glb, out_fbx):
    os.makedirs(os.path.dirname(os.path.abspath(out_glb)), exist_ok=True)
    tgt_objs = [arm] + list(arm.children)
    for o in list(bpy.data.objects):
        if o not in tgt_objs:
            bpy.data.objects.remove(o, do_unlink=True)
    arm.animation_data.action = None
    bpy.ops.export_scene.gltf(filepath=out_glb, export_format='GLB', export_animation_mode='ACTIONS',
                              export_force_sampling=True, export_def_bones=False, export_cameras=False,
                              export_lights=False, export_extras=False, export_yup=True)
    if out_fbx:
        deterministic_fbx()
        bpy.ops.export_scene.fbx(filepath=out_fbx, object_types={'ARMATURE', 'MESH'}, add_leaf_bones=False,
                                 bake_anim=True, bake_anim_use_all_actions=True, bake_anim_use_nla_strips=False,
                                 bake_anim_force_startend_keying=True, axis_forward='-Z', axis_up='Y',
                                 apply_scale_options='FBX_SCALE_ALL', path_mode='COPY', embed_textures=True)


def main():
    recipe_path = arg('--recipe')
    out = arg('--out')
    if not recipe_path or not out:
        sys.exit('--recipe · --out 가 필요하다')
    recipe = json.load(open(recipe_path, encoding='utf-8'))
    bpy.ops.wm.read_factory_settings(use_empty=True)
    offset = None
    if recipe.get('outfit'):
        arm, body, offset = dress(recipe)
    else:
        arm, body = load_body(recipe)
    for m in [c for c in arm.children if c.type == 'MESH' and c.name.startswith('Eyebrows')]:
        if recipe.get('brows'):
            delete([m])
    for part in ('hair', 'beard', 'brows'):  # beard(09-29): 머리 모양과 따로 수염(Hair_Beard)
        if recipe.get(part):
            if recipe[part] not in HAIRS:
                sys.exit(f'{part}: 모르는 머리 {recipe[part]}')
            attach_head_mesh(arm, recipe[part], offset)
    seam = seam_gap(arm, body) if recipe.get('outfit') else None
    if recipe.get('face') == 'toon':
        albedo_only()
    cap_textures(int(recipe.get('max_tex', MAX_TEX)))  # 멀리서만 보는 마을 사람은 1024(09-29)
    shape(arm, body, recipe)
    materials(arm, body, recipe)
    if recipe.get('decimate'):
        decimate(arm, float(recipe['decimate']))
    if recipe.get('shadow_proxy'):
        shadow_proxy(arm, float(recipe['shadow_proxy']))
    if recipe.get('join', True):
        join_meshes(arm)
    rep = retarget(arm, recipe.get('anims', 'all'), bool(arg('--check')))
    export(arm, out, arg('--fbx'))
    lic = {
        'id': recipe['id'], 'generator': 'tools/char-forge/build.py', 'blender': bpy.app.version_string,
        'license': 'CC0-1.0 (입력 전부 CC0)',
        'inputs': ['ubc_standard: ' + BASES[recipe['base']][0], 'ual1_standard: Unreal Engine/AL_Standard.fbx']
        + [f'ubc_standard: Hairstyles/Origin at 0/glTF (Godot)/{recipe[p]}.gltf' for p in ('hair', 'beard', 'brows') if recipe.get(p)]
        + ([f"mcof_standard: Outfits/{recipe['outfit']}.gltf"] if recipe.get('outfit') else []),
    }
    json.dump(lic, open(os.path.splitext(out)[0] + '.license.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    tris = sum(sum(len(p.vertices) - 2 for p in m.data.polygons) for m in arm.children if m.type == 'MESH')
    meta = rep.pop('_meta')
    worst = max((v['ground_err_m'] or 0 for v in rep.values()), default=0)
    print('CHARFORGE', json.dumps({'id': recipe['id'], 'bones': len(arm.data.bones), 'tris': tris,
                                   'anims': len(rep), 'ground_err_max_m': worst, 'leg_ratio': meta['leg_ratio'],
                                   'seam': seam,
                                   'mats': sorted({s.material.name for m in arm.children if m.type == 'MESH'
                                                   for s in m.material_slots if s.material})}, ensure_ascii=False))
    if arg('--check'):
        g = [n for n, v in rep.items() if v['ground_err_m'] is not None]
        print('CHECK grounded', len(g), '/', len(rep))
        for n, v in sorted(rep.items(), key=lambda kv: -(kv[1]['ground_err_m'] or 0))[:6]:
            print('CHECK', n, v)
        if worst > 0.01:
            print('CHECK FAIL ground_err > 1cm')
            sys.exit(2)


if __name__ == '__main__':
    main()
