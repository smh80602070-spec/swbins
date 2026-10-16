"""world-forge 웹 스프라이트 — glb 를 등각(아이소) 투명 배경 PNG 로. 웹 다섯 판이 그림으로 쓴다(그림 자산은 코드·CC0 만 — SAGA-DESIGN §7).
  blender -b --factory-startup -P tools/world-forge/render_sprite.py -- out.png model.glb [--size 512] [--az 45] [--el 30]
바탕 투명·그림자 없음·부드러운 앞빛 — 웹 장면의 빛 위에 얹어 쓴다.
"""
import math
import os
import sys

import bpy
from mathutils import Vector

a = sys.argv[sys.argv.index('--') + 1:]
out, model = a[0], a[1]
opt = lambda k, d: type(d)(a[a.index(k) + 1]) if k in a else d
size, az, el = opt('--size', 512), opt('--az', 45.0), opt('--el', 30.0)
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
bpy.ops.import_scene.gltf(filepath=model)
if '--tight' in a:  # glTF 가져오기가 뼈 표시 모양으로 만드는 Icosphere(2m)가 작은 몸의 틀을 키운다(K-0114) — 뼈 모양 물체는 지운다
    shapes = {pb.custom_shape for o in bpy.data.objects if o.type == 'ARMATURE' for pb in o.pose.bones if pb.custom_shape}
    for o in shapes:
        bpy.data.objects.remove(o, do_unlink=True)
objs = [o for o in bpy.data.objects if o.type == 'MESH']
if '--tight' in a:  # 뼈로 움직인 뒤 실제 정점으로 잰다(K-0114 — 뼈대 배율이 큰 몸은 bound_box 가 수십 배 커서 그림이 점이 된다)
    dg = bpy.context.evaluated_depsgraph_get()
    pts = []
    for o in objs:
        oe = o.evaluated_get(dg)
        me = oe.to_mesh()
        pts += [oe.matrix_world @ v.co for v in me.vertices]
        oe.to_mesh_clear()
else:
    pts = [o.matrix_world @ Vector(c) for o in objs for c in o.bound_box]
lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
ctr = (lo + hi) / 2
rad = (hi - lo).length / 2
sun = bpy.data.objects.new('sun', bpy.data.lights.new('sun', 'SUN'))
sun.data.energy = 2.6
sun.rotation_euler = (math.radians(55), 0, math.radians(-30))
sc.collection.objects.link(sun)
w = bpy.data.worlds.new('w'); w.use_nodes = True
w.node_tree.nodes['Background'].inputs['Color'].default_value = (0.9, 0.92, 1.0, 1)
w.node_tree.nodes['Background'].inputs['Strength'].default_value = 1.1
sc.world = w
cam_d = bpy.data.cameras.new('c'); cam_d.type = 'ORTHO'; cam_d.ortho_scale = rad * 2.15
cam = bpy.data.objects.new('c', cam_d); sc.collection.objects.link(cam); sc.camera = cam
azr, elr = math.radians(az), math.radians(el)
cam.location = ctr + Vector((math.sin(azr) * math.cos(elr), -math.cos(azr) * math.cos(elr), math.sin(elr))) * rad * 4
cam.rotation_euler = (ctr - cam.location).to_track_quat('-Z', 'Y').to_euler()
if os.environ.get('WF_CPU'):                     # WF_CPU=1 → Cycles CPU(SD 등 GPU 작업과 겹칠 때 확인용, 빛 느낌은 약간 다르다)
    sc.render.engine = 'CYCLES'
    sc.cycles.device = 'CPU'
    sc.cycles.samples = 32
else:
    try:
        sc.render.engine = 'BLENDER_EEVEE_NEXT'
    except TypeError:
        sc.render.engine = 'BLENDER_EEVEE'
sc.render.film_transparent = True
sc.render.resolution_x = sc.render.resolution_y = size
sc.view_settings.view_transform = 'Standard'
sc.render.image_settings.color_mode = 'RGBA'
sc.render.filepath = out
bpy.ops.render.render(write_still=True)
print('SPRITE', out)
