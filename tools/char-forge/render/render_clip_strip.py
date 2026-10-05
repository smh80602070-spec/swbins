"""동작 한 개를 몸에 입혀 열쇠 프레임 여러 장을 한 줄로 찍는다(K-0029 동작 점검 시트). Blender 헤드리스.

  blender -b --factory-startup -P tools/char-forge/render/render_clip_strip.py -- <몸.glb> <동작.glb(bake_for_rig 산출)> <출력.png> <동작 이름 일부>[,이름…] [프레임수=6] [보기=34|side|both]

동작.glb 안 액션을 이름(부분 일치)으로 찾아 몸 뼈대(J_Bip 이름 같음)에 걸고, 시작~끝을 균등 분할해 찍는다. 이름을 여러 개 주면 줄이 여러 개.
"""
import bpy, sys, os, math
from mathutils import Vector

a = sys.argv[sys.argv.index('--') + 1:]
body, anims, out = [os.path.abspath(x) for x in a[:3]]
names = a[3].split(',')
NF = int(a[4]) if len(a) > 4 else 6
VIEWS = {'34': ['34'], 'side': ['side'], 'both': ['34', 'side']}[a[5] if len(a) > 5 else '34']
W, H = 360, 500

bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
bpy.ops.import_scene.gltf(filepath=body)
arm = next(o for o in bpy.data.objects if o.type == 'ARMATURE')
meshes = [o for o in bpy.data.objects if o.type == 'MESH']
before = set(bpy.data.objects.keys())
bpy.ops.import_scene.gltf(filepath=anims)
for o in [o for o in bpy.data.objects if o.name not in before]:
    bpy.data.objects.remove(o, do_unlink=True)
acts = {x.name: x for x in bpy.data.actions}
print('ACTIONS', sorted(acts))

if os.environ.get('WF_CPU'):                     # WF_CPU=1 → Cycles CPU(SD 등 GPU 작업과 겹칠 때)
    sc.render.engine = 'CYCLES'
    sc.cycles.device = 'CPU'
    sc.cycles.samples = 12
else:
    for eng in ('BLENDER_EEVEE_NEXT', 'BLENDER_EEVEE'):
        try:
            sc.render.engine = eng
            break
        except TypeError:
            pass
sc.render.resolution_x, sc.render.resolution_y = W, H
sc.render.film_transparent = False
wd = bpy.data.worlds.new('w'); sc.world = wd; wd.use_nodes = True
wd.node_tree.nodes['Background'].inputs[0].default_value = (0.6, 0.65, 0.72, 1)
wd.node_tree.nodes['Background'].inputs[1].default_value = 0.9
sun = bpy.data.objects.new('sun', bpy.data.lights.new('sun', 'SUN')); sc.collection.objects.link(sun)
sun.data.energy = 3.0; sun.rotation_euler = (math.radians(50), 0, math.radians(-30))
cd = bpy.data.cameras.new('c'); cam = bpy.data.objects.new('c', cd); sc.collection.objects.link(cam); sc.camera = cam
cd.type = 'ORTHO'; cd.ortho_scale = 2.3
tgt = bpy.data.objects.new('t', None); sc.collection.objects.link(tgt)
tc = cam.constraints.new('TRACK_TO'); tc.target = tgt; tc.track_axis = 'TRACK_NEGATIVE_Z'; tc.up_axis = 'UP_Y'

if arm.animation_data is None:
    arm.animation_data_create()


sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import weapon_attach  # noqa: E402  WEAPON=<무기.glb>(종류로 손·두 손 기본값) · WEAPON_HAND · TWO_HAND
weapon_attach.from_env(arm)


def place(view):
    # 몸은 -Y 를 본다. 34 = 앞 왼쪽 45°, side = 몸의 왼쪽(+X)에서
    az = {'34': math.radians(40), 'side': math.radians(90)}[view]
    d = 6.0
    cam.location = (-d * math.sin(az), -d * math.cos(az), 1.0)
    tgt.location = (0, 0, 0.95)


rows = []
for nm in names:
    act = next((x for k, x in acts.items() if nm.lower() in k.lower()), None)
    if act is None:
        print('NOACT', nm)
        continue
    arm.animation_data.action = act
    if hasattr(arm.animation_data, 'action_slot') and act.slots:
        arm.animation_data.action_slot = act.slots[0]
    f0, f1 = act.frame_range
    frames = [int(f0 + (f1 - f0) * i / max(1, NF - 1)) for i in range(NF)]
    for view in VIEWS:
        place(view)
        row = []
        for i, f in enumerate(frames):
            sc.frame_set(f)
            p = '%s__%s_%s_%d.png' % (os.path.splitext(out)[0], nm, view, i)
            sc.render.filepath = p
            bpy.ops.render.render(write_still=True)
            row.append(p)
        rows.append((nm + ' ' + view, row))
# 프레임 파일은 <출력>_<이름>_<보기>_<번호>.png — 한 줄로 잇기는 시스템 파이썬(PIL)이 한다: py tools/char-forge/render/strip_join.py <출력.png>
print('STRIP', len(rows))
