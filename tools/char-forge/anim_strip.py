"""동작 띠 렌더 — 몸 GLB 에 동작 GLB 의 클립을 입혀 옆·3/4 에서 n 프레임 찍어 한 줄 PNG 로 (K-0139 비교 시트용).
  blender -b --factory-startup -P tools/char-forge/anim_strip.py -- <몸.glb> <동작.glb> <클립> <출력.png> [--n 8] [--az 90] [--size 220]
Cycles CPU(SD 사슬과 안 겹치게). 뼈 이름이 같으면 동작을 그대로 쓴다.
"""
import math
import os
import sys

import bpy
from mathutils import Vector

a = sys.argv[sys.argv.index('--') + 1:]
body, anims, clip, out = a[:4]
opt = lambda k, d: type(d)(a[a.index(k) + 1]) if k in a else d
n, az, size = opt('--n', 8), opt('--az', 90.0), opt('--size', 220)
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
bpy.ops.import_scene.gltf(filepath=body)
arm = next(o for o in bpy.data.objects if o.type == 'ARMATURE')
meshes = [o for o in bpy.data.objects if o.type == 'MESH']
before = set(bpy.data.objects)
acts_before = set(bpy.data.actions)
bpy.ops.import_scene.gltf(filepath=anims)
for o in [o for o in bpy.data.objects if o not in before]:
    bpy.data.objects.remove(o, do_unlink=True)
act = next((x for x in bpy.data.actions if x not in acts_before and (x.name == clip or x.name.split('|')[-1] == clip or x.name.startswith(clip + '_') or x.name.endswith('|' + clip))), None)
if act is None:
    print('클립 없음', clip, [x.name for x in bpy.data.actions if x not in acts_before][:20]); sys.exit(1)
arm.animation_data_create()
arm.animation_data.action = act
if act.slots and arm.animation_data.action_slot is None:
    arm.animation_data.action_slot = act.slots[0]
f0, f1 = (int(round(x)) for x in act.frame_range)
sc.render.engine = 'CYCLES'
sc.cycles.device = 'CPU'
sc.cycles.samples = 8
sc.render.film_transparent = True
sc.render.resolution_x = sc.render.resolution_y = size
sun = bpy.data.objects.new('sun', bpy.data.lights.new('sun', 'SUN')); sun.data.energy = 3.0
sun.rotation_euler = (math.radians(50), 0, math.radians(30)); sc.collection.objects.link(sun)
w = bpy.data.worlds.new('w'); w.use_nodes = True; w.node_tree.nodes['Background'].inputs['Strength'].default_value = 0.8; sc.world = w
cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); sc.collection.objects.link(cam); sc.camera = cam
cam.data.type = 'ORTHO'; cam.data.ortho_scale = 2.2
r = math.radians(az)
cam.location = Vector((math.sin(r) * 6, -math.cos(r) * 6, 0.95))
cam.rotation_euler = (math.radians(90), 0, r)
tmp = os.path.splitext(out)[0] + '_f'
os.makedirs(tmp, exist_ok=True)
paths = []
for i in range(n):
    f = f0 + round((f1 - f0) * i / max(1, n))
    sc.frame_set(f)
    p = os.path.join(tmp, f'{i:02d}.png'); sc.render.filepath = p
    bpy.ops.render.render(write_still=True); paths.append(p)
try:
    from PIL import Image
    ims = [Image.open(p) for p in paths]
    strip = Image.new('RGBA', (size * n, size), (0, 0, 0, 0))
    for i, im in enumerate(ims):
        strip.paste(im, (i * size, 0))
    strip.save(out)
except ImportError:   # Blender 파이썬엔 PIL 이 없다 — 프레임 폴더(<출력>_f)를 바깥 파이썬이 붙인다
    pass
print('STRIP', clip, f0, f1, out)
