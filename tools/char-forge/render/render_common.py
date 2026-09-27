def new_objs(before):
    return [o for o in bpy.data.objects if o.name not in before]


def bbox(objs):
    pts = []
    dg = bpy.context.evaluated_depsgraph_get()
    for o in objs:
        if o.type != 'MESH':
            continue
        e = o.evaluated_get(dg)
        m = e.to_mesh()
        pts += [o.matrix_world @ v.co for v in m.vertices]
        e.to_mesh_clear()
    lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
    hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    return lo, hi


def fix_images(folder):
    for im in bpy.data.images:
        if im.source == 'FILE' and im.filepath and not os.path.exists(bpy.path.abspath(im.filepath)):
            base = os.path.basename(im.filepath.replace('\\', '/'))
            hit = glob.glob(os.path.join(folder, '**', base), recursive=True)
            if hit:
                im.filepath = hit[0]
                im.reload()


def pose(arm, act):
    if arm.animation_data is None:
        arm.animation_data_create()
    for t in list(arm.animation_data.nla_tracks):
        arm.animation_data.nla_tracks.remove(t)
    if act is not None:
        arm.animation_data.action = act
        if hasattr(arm.animation_data, 'action_slot') and act.slots:
            arm.animation_data.action_slot = act.slots[0]


def load_any(p):
    before = set(bpy.data.objects.keys())
    acts0 = set(bpy.data.actions.keys())
    if p.endswith('.glb'):
        bpy.ops.import_scene.gltf(filepath=p)
    else:
        bpy.ops.import_scene.fbx(filepath=p)
    objs = new_objs(before)
    for o in [o for o in objs if o.type == 'MESH' and o.parent is None]:
        objs.remove(o); bpy.data.objects.remove(o, do_unlink=True)
    arm = next(o for o in objs if o.type == 'ARMATURE')
    act = None
    if arm.animation_data:
        for t in arm.animation_data.nla_tracks:
            for s in t.strips:
                if s.action and os.environ.get('CF_CLIP', 'idle') in t.name.lower() and act is None:   # CF_CLIP=run 등으로 다른 동작 한 프레임
                    act = s.action
    if act is None and not p.endswith('.glb'):
        d, name = os.path.dirname(p), os.path.splitext(os.path.basename(p))[0]
        idle = sorted(glob.glob(os.path.join(d, name + '@Idle*.fbx'))) or sorted(glob.glob(os.path.join(d, name + '@*Idle*.fbx')))
        if idle:
            b2 = set(bpy.data.objects.keys()); a2 = set(bpy.data.actions.keys())
            bpy.ops.import_scene.fbx(filepath=idle[0])
            for o in new_objs(b2):
                bpy.data.objects.remove(o, do_unlink=True)
            na = [x for x in bpy.data.actions if x.name not in a2]
            act = na[0] if na else None
        fix_images(d)
    pose(arm, act)
    return objs


def setup_light():
    world = bpy.data.worlds.new('w'); sc.world = world
    world.use_nodes = True
    world.node_tree.nodes['Background'].inputs[0].default_value = (0.55, 0.6, 0.68, 1)
    world.node_tree.nodes['Background'].inputs[1].default_value = 0.6
    for rot, en, col in (((50, 0, -35), 3.5, (1, 0.96, 0.9)), ((60, 0, 160), 2.0, (0.8, 0.85, 1.0))):
        ld = bpy.data.lights.new('sun', 'SUN'); ld.energy = en; ld.color = col
        lo_ = bpy.data.objects.new('sun', ld); sc.collection.objects.link(lo_)
        lo_.rotation_euler = [math.radians(r) for r in rot]


def set_engine():
    for eng in ('BLENDER_EEVEE_NEXT', 'BLENDER_EEVEE'):
        try:
            sc.render.engine = eng
            break
        except TypeError:
            pass
    sc.view_settings.view_transform = 'AgX'


def fix_materials():
    """게임처럼: 피부·옷은 불투명, 머리카락·눈썹·속눈썹만 알파 잘라내기(Blender glTF 가져오기는 전부 BLEND 로 둬서 이·눈이 얼굴 위에 그려진다)."""
    for m in bpy.data.materials:
        if not m.use_nodes:
            continue
        cut = any(k in m.name.lower() for k in ('hair', 'brow', 'lash', 'eye'))
        # 공방 옷 칸(cloth_*)은 게임과 같은 거칠기 0.8 — saga-unity BuildCharCompareRealScene 이 FBX 값을 버리고 칸 이름으로 매끈함 0.2 를 준다.
        # toigo .mhmat 광택(거칠기 0.082)이 렌더에만 비닐처럼 번들거렸다(09-27 사진작가 정장·천 신발)
        if m.name.startswith('cloth_'):
            for n in m.node_tree.nodes:
                if n.type == 'BSDF_PRINCIPLED' and not n.inputs['Roughness'].is_linked:
                    n.inputs['Roughness'].default_value = 0.8
        for n in m.node_tree.nodes:
            if n.type == 'BSDF_PRINCIPLED' and n.inputs['Alpha'].is_linked and not cut:
                for l in list(n.inputs['Alpha'].links):
                    m.node_tree.links.remove(l)
                n.inputs['Alpha'].default_value = 1.0
        try:
            m.surface_render_method = 'DITHERED'
        except Exception:
            pass
