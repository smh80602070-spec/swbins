"""world-forge 동작 시트 컷 — 뼈 있는 몸 GLB 의 Idle·Run 클립을 4컷씩 옆모습(오른쪽을 본다)으로 굽는다 (K-0114).
  blender -b --factory-startup -P tools/world-forge/render_sheet.py -- <출력 폴더> model.glb --cw 44 --ch 36 [--ss 4] [--el 6]
결과 `<출력>/idle_0..3.png`·`run_0..3.png`(각 cw*ss × ch*ss, 투명). 여덟 자세를 다 담는 한 배율·발이 아래, 컷은 머리가 **왼쪽** — 시트 합치기·좌우 뒤집기는
`beast2d_rebake.py --sheets`. 옛 3마을 시트(`bake-portraits --sprites=animals`)와 같은 칸 규칙: 0 서기·왼 / 1 서기·오른 / 2 달리기·왼 / 3 달리기·오른.
"""
import math
import os
import sys

import bpy
from mathutils import Vector

a = sys.argv[sys.argv.index('--') + 1:]
out, model = a[0], a[1]
opt = lambda k, d: type(d)(a[a.index(k) + 1]) if k in a else d
CW, CH, SS, EL = opt('--cw', 44), opt('--ch', 36), opt('--ss', 4), opt('--el', 6.0)
os.makedirs(out, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
bpy.ops.import_scene.gltf(filepath=model)
arms = [o for o in bpy.data.objects if o.type == 'ARMATURE']
for o in {pb.custom_shape for ar in arms for pb in ar.pose.bones if pb.custom_shape}:   # 뼈 표시용 Icosphere(render_sprite --tight 와 같은 함정)
    bpy.data.objects.remove(o, do_unlink=True)
objs = [o for o in bpy.data.objects if o.type == 'MESH']
arm = arms[0] if arms else None


def act_named(n):
    for ac in bpy.data.actions:
        if ac.name == n or ac.name.split('_')[0] == n or ac.name.startswith(n + '_'):
            return ac
    return None


def set_pose(name, f):
    if not arm:
        return
    ac = act_named(name)
    if not ac:
        return
    ad = arm.animation_data or arm.animation_data_create()
    for tr in list(ad.nla_tracks):
        tr.mute = True
    ad.action = ac
    if hasattr(ad, 'action_slot') and getattr(ac, 'slots', None):
        ad.action_slot = ac.slots[0]
    s, e = ac.frame_range
    sc.frame_set(int(round(s + (e - s) * f / 4)))


def bbox():
    dg = bpy.context.evaluated_depsgraph_get()
    pts = []
    for o in objs:
        oe = o.evaluated_get(dg)
        me = oe.to_mesh()
        pts += [oe.matrix_world @ v.co for v in me.vertices]
        oe.to_mesh_clear()
    return pts


poses = [(n, f) for n in ('Idle', 'Run') for f in range(4)]
pts = []
for n, f in poses:
    set_pose(n, f)
    pts += bbox()
lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
# 카메라 +X 에서 -X 를 본다 → 화면 가로 = Y(몸 길이, creatures3d 는 머리가 왼쪽), 세로 = Z
h, d = (hi.z - lo.z), (hi.y - lo.y)
half_h = max(h, d * CH / CW) / 2 * 1.06
half_w = half_h * CW / CH
cy = (lo.y + hi.y) / 2
cz = lo.z + half_h * 0.98
sun = bpy.data.objects.new('sun', bpy.data.lights.new('sun', 'SUN'))
sun.data.energy = 2.6
sun.rotation_euler = (math.radians(55), 0, math.radians(60))
sc.collection.objects.link(sun)
w = bpy.data.worlds.new('w'); w.use_nodes = True
w.node_tree.nodes['Background'].inputs['Color'].default_value = (0.9, 0.92, 1.0, 1)
w.node_tree.nodes['Background'].inputs['Strength'].default_value = 1.1
sc.world = w
cam_d = bpy.data.cameras.new('c'); cam_d.type = 'ORTHO'; cam_d.ortho_scale = half_w * 2
cam = bpy.data.objects.new('c', cam_d); sc.collection.objects.link(cam); sc.camera = cam
elr = math.radians(EL)
dist = (hi - lo).length * 4 + 10
cam.location = Vector(((hi.x + lo.x) / 2 + dist * math.cos(elr), cy, cz + dist * math.sin(elr)))
cam.rotation_euler = (Vector(((hi.x + lo.x) / 2, cy, cz)) - cam.location).to_track_quat('-Z', 'Y').to_euler()
try:
    sc.render.engine = 'BLENDER_EEVEE_NEXT'
except TypeError:
    sc.render.engine = 'BLENDER_EEVEE'
sc.render.film_transparent = True
sc.render.resolution_x, sc.render.resolution_y = CW * SS, CH * SS
sc.view_settings.view_transform = 'Standard'
sc.render.image_settings.color_mode = 'RGBA'
for n, f in poses:
    set_pose(n, f)
    sc.render.filepath = os.path.join(out, f'{n.lower()}_{f}.png')
    bpy.ops.render.render(write_still=True)
print('SHEET', out)
