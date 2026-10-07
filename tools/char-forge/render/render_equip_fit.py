"""장비 조각 입혀 보기 (K-0081) — 몸 GLB 에 갑옷 조각을 엔진과 같은 규칙으로 붙여 앞·옆을 찍는다. Blender 헤드리스.

  blender -b --factory-startup -P tools/char-forge/render/render_equip_fit.py -- <몸.glb> <조각 폴더> <출력 접두> <시대_등급(예 past_2)> [--no-hide]

규칙 = tools/world-forge/data/equip_slots.json: 조각 원점을 그 뼈 머리(T-자세)에, 균등 배율 k = J_Bip_C_Head 높이 / ref, mirror 조각은
오른쪽 뼈에 X −1 배, 가슴판 가로는 fit.chest(어깨 폭 비율). hide_match 가 있으면 그 재질 이름이 든 몸 메시를 숨긴다(--no-hide 면 안 숨김).
출력: <접두>_front.png · <접두>_side.png (512×768, 정사영).
"""
import bpy, sys, os, json, math
from mathutils import Vector, Matrix

a = sys.argv[sys.argv.index('--') + 1:]
body, pieces, out, eg = os.path.abspath(a[0]), os.path.abspath(a[1]), os.path.abspath(a[2]), a[3]
NO_HIDE = '--no-hide' in a
ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '..'))
SPEC = json.load(open(os.path.join(ROOT, 'tools', 'world-forge', 'data', 'equip_slots.json'), encoding='utf-8'))
REF = SPEC.get('ref_head_bone_height_m', 1.5)

bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
before = set(bpy.data.objects.keys())
bpy.ops.import_scene.gltf(filepath=body)
bobjs = [o for o in bpy.data.objects if o.name not in before]
arm = next(o for o in bobjs if o.type == 'ARMATURE')
if arm.animation_data:
    arm.animation_data.action = None
    for t in list(arm.animation_data.nla_tracks):
        arm.animation_data.nla_tracks.remove(t)
for pb in arm.pose.bones:
    pb.matrix_basis = Matrix.Identity(4)
bones = {b.name: arm.matrix_world @ b.head_local for b in arm.data.bones}
k = bones['J_Bip_C_Head'].z / REF
fc = SPEC.get('fit', {}).get('chest')
cx = 1.0
if fc:                                                                       # 가슴판 가로 = 어깨 폭 비율(규약 fit.chest)
    sh = abs(bones['J_Bip_L_UpperArm'].x - bones['J_Bip_C_Chest'].x) / k
    cx = min(max(sh / fc['ref_shoulder_x_m'], fc['clamp'][0]), fc['clamp'][1])

hidden = []
if not NO_HIDE:
    for slot, sp in SPEC['armor_slots'].items():
        for cat in sp.get('hides', []):
            for pat in SPEC.get('hide_match', {}).get(cat, []):
                for o in bobjs:
                    if o.type == 'MESH' and any(pat.upper() in (s.material.name.upper() if s.material else '') for s in o.material_slots):
                        o.hide_render = True
                        hidden.append(o.name)

for slot, sp in SPEC['armor_slots'].items():
    f = os.path.join(pieces, f'eq_{eg}_{slot}.glb')
    if not os.path.exists(f):
        continue
    sides = [(sp['bone'], 1.0)]
    if sp.get('mirror'):
        sides.append((sp['bone'].replace('_L_', '_R_'), -1.0))
    for bone, sx in sides:
        b0 = set(bpy.data.objects.keys())
        bpy.ops.import_scene.gltf(filepath=f)
        new = [o for o in bpy.data.objects if o.name not in b0]
        root = bpy.data.objects.new(f'{slot}{"R" if sx < 0 else ""}', None)
        sc.collection.objects.link(root)
        for o in new:
            if o.parent is None:
                o.parent = root
        root.location = bones[bone]
        root.scale = (k * sx * (cx if slot == 'chest' else 1.0), k, k)

# 카메라·빛
meshes = [o for o in bpy.data.objects if o.type == 'MESH' and not o.hide_render]
pts = [o.matrix_world @ Vector(c) for o in meshes for c in o.bound_box]
lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
cz = (lo.z + hi.z) / 2
world = bpy.data.worlds.new('w'); sc.world = world; world.use_nodes = True
world.node_tree.nodes['Background'].inputs[0].default_value = (0.55, 0.6, 0.68, 1)
for rot, en in (((50, 0, -35), 3.5), ((60, 0, 160), 2.0)):
    ld = bpy.data.lights.new('sun', 'SUN'); ld.energy = en
    lo_ = bpy.data.objects.new('sun', ld); sc.collection.objects.link(lo_); lo_.rotation_euler = [math.radians(r) for r in rot]
for eng in ('BLENDER_EEVEE_NEXT', 'BLENDER_EEVEE'):
    try:
        sc.render.engine = eng
        break
    except TypeError:
        pass
sc.render.resolution_x, sc.render.resolution_y = 512, 768
sc.render.film_transparent = False
cd = bpy.data.cameras.new('c'); cd.type = 'ORTHO'; cd.ortho_scale = (hi.z - lo.z) * 1.08
cam = bpy.data.objects.new('c', cd); sc.collection.objects.link(cam); sc.camera = cam
for view, loc, rot in (('front', (0, -6, cz), (90, 0, 0)), ('side', (6, 0, cz), (90, 0, 90))):
    cam.location = loc
    cam.rotation_euler = [math.radians(r) for r in rot]
    sc.render.filepath = f'{out}_{view}.png'
    bpy.ops.render.render(write_still=True)
print('EQUIP_FIT', json.dumps({'k': round(k, 3), 'chest_x': round(cx, 3), 'hidden': hidden}))
