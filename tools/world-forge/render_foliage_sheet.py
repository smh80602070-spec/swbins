"""K-0104 눈 판정 시트 — 자체 PBR 풀밭(K-0093 grass) 위에 들풀을 놓고 사람 눈높이(1.6m)에서 찍는다.

  blender -b --factory-startup -P tools/world-forge/render_foliage_sheet.py -- <out.png> <들풀 폴더> [--old <옛 GLB 폴더>] [--mode row|field] [--size 1280x720]

row   = 새 7종 한 줄(+ --old 의 bush_01·grass_tuft_01·flower_patch_01 을 오른쪽에 — 옛것과 나란히)
field = 6×6m 에 흩어 놓은 들판(G-0227 쓰임새 미리보기, 씨앗 고정)
WF_CPU=1 → Cycles CPU(다른 GPU 일과 겹칠 때).
"""
import math
import os
import random
import sys

import bpy
from mathutils import Vector

a = sys.argv[sys.argv.index('--') + 1:]
out, src = a[0], a[1]
opt = lambda k, d: a[a.index(k) + 1] if k in a else d
old, mode = opt('--old', None), opt('--mode', 'row')
rw, rh = (int(x) for x in opt('--size', '1280x720').split('x'))
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
NEW = ['bush_leafy_01', 'bush_leafy_02', 'grass_clump_01', 'grass_clump_02', 'flower_clump_01', 'flower_clump_02', 'fern_01']
OLD = ['bush_01', 'grass_tuft_01', 'flower_patch_01']

bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene


def load(path):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=path)
    objs = [o for o in bpy.data.objects if o not in before]
    roots = [o for o in objs if o.parent is None]
    return roots


def place(path, x, y, yaw=0.0, s=1.0):
    for r in load(path):
        r.location = (x, y, 0)
        r.rotation_euler = (r.rotation_euler[0], r.rotation_euler[1], yaw)
        r.scale = (s, s, s)


# 땅 — 자체 PBR 풀(2m 한 장)
bpy.ops.mesh.primitive_plane_add(size=40)
g = bpy.context.active_object
m = bpy.data.materials.new('ground')
m.use_nodes = True
nt = m.node_tree
b = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
t = nt.nodes.new('ShaderNodeTexImage')
t.image = bpy.data.images.load(os.path.join(ROOT, 'saga-assets', 'textures_real', 'grass', 'grass_color.png'))
tc = nt.nodes.new('ShaderNodeTexCoord')
mp = nt.nodes.new('ShaderNodeMapping')
mp.inputs['Scale'].default_value = (0.5, 0.5, 1)
nt.links.new(tc.outputs['Object'], mp.inputs['Vector'])
nt.links.new(mp.outputs['Vector'], t.inputs['Vector'])
nt.links.new(t.outputs['Color'], b.inputs['Base Color'])
b.inputs['Roughness'].default_value = 0.95
g.data.materials.append(m)

if mode == 'row':
    xs = 0.0
    for k in NEW:
        p = os.path.join(src, k + '.gltf')
        if os.path.exists(p):
            place(p, xs, 0.0)
        xs += 1.25
    if old:
        xs += 0.4
        for k in OLD:
            p = os.path.join(old, k + '.glb')
            if os.path.exists(p):
                place(p, xs, 0.0)
            xs += 1.25
    span = xs - 1.25
    ctr = Vector((span / 2, 0, 0.35))
    cam_loc = Vector((span / 2, -max(4.2, span * 0.78), 1.6))      # 렌즈 28mm 로 줄 전체가 들어온다
else:
    rnd = random.Random(20260824)
    kinds = [(k, w) for k, w in zip(NEW, (3, 2, 9, 5, 4, 4, 3))]
    bag = [k for k, w in kinds for _ in range(w)]
    for i in range(60):
        k = rnd.choice(bag)
        place(os.path.join(src, k + '.gltf'), rnd.uniform(-3, 3), rnd.uniform(-1, 5), rnd.uniform(0, 6.283), rnd.uniform(0.85, 1.2))
    ctr = Vector((0, 2.5, 0.2))
    cam_loc = Vector((0, -3.2, 1.6))

sun = bpy.data.objects.new('sun', bpy.data.lights.new('sun', 'SUN'))
sun.data.energy = 3.2
sun.data.angle = math.radians(2)
sun.rotation_euler = (math.radians(50), 0, math.radians(-35))
sc.collection.objects.link(sun)
w = bpy.data.worlds.new('w')
w.use_nodes = True
w.node_tree.nodes['Background'].inputs['Color'].default_value = (0.55, 0.7, 0.95, 1)
w.node_tree.nodes['Background'].inputs['Strength'].default_value = 0.9
sc.world = w
cd = bpy.data.cameras.new('c')
cd.lens = 28
cam = bpy.data.objects.new('c', cd)
sc.collection.objects.link(cam)
sc.camera = cam
cam.location = cam_loc
cam.rotation_euler = (ctr - cam.location).to_track_quat('-Z', 'Y').to_euler()
if os.environ.get('WF_CPU'):
    sc.render.engine = 'CYCLES'
    sc.cycles.device = 'CPU'
    sc.cycles.samples = 48
else:
    try:
        sc.render.engine = 'BLENDER_EEVEE_NEXT'
    except TypeError:
        sc.render.engine = 'BLENDER_EEVEE'
sc.render.resolution_x, sc.render.resolution_y = rw, rh
sc.view_settings.view_transform = 'AgX' if 'AgX' in [i.identifier for i in sc.view_settings.bl_rna.properties['view_transform'].enum_items] else 'Standard'
sc.render.filepath = out
bpy.ops.render.render(write_still=True)
print('FOLIAGE_SHEET', out)
