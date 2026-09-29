"""world-forge 미리보기 — glb 를 세 방향(앞 3/4·뒤 3/4·옆)에서 한 줄로.
  blender -b --factory-startup -P tools/world-forge/preview.py -- out.png model.glb [--size 900]
"""
import math
import os
import sys

import bpy
from mathutils import Vector

a = sys.argv[sys.argv.index('--') + 1:]
out, model = a[0], a[1]
size = int(a[a.index('--size') + 1]) if '--size' in a else 800
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
bpy.ops.import_scene.gltf(filepath=model)
objs = [o for o in bpy.data.objects if o.type == 'MESH']
pts = [o.matrix_world @ Vector(c) for o in objs for c in o.bound_box]
lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
ctr = (lo + hi) / 2
rad = max((hi - lo).length / 2, 1.0)

# 땅
bpy.ops.mesh.primitive_plane_add(size=rad * 8, location=(ctr.x, ctr.y, lo.z - 0.01))
ground = bpy.context.active_object
gm = bpy.data.materials.new('g'); gm.use_nodes = True
gm.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (0.16, 0.19, 0.12, 1)
gm.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value = 1.0
ground.data.materials.append(gm)

sun = bpy.data.objects.new('sun', bpy.data.lights.new('sun', 'SUN'))
sun.data.energy = 3.2
sun.rotation_euler = (math.radians(50), math.radians(10), math.radians(-35))
sc.collection.objects.link(sun)
w = bpy.data.worlds.new('w'); w.use_nodes = True
w.node_tree.nodes['Background'].inputs['Color'].default_value = (0.55, 0.68, 0.85, 1)
w.node_tree.nodes['Background'].inputs['Strength'].default_value = 0.9
sc.world = w

cam_d = bpy.data.cameras.new('c'); cam_d.lens = 38
cam = bpy.data.objects.new('c', cam_d); sc.collection.objects.link(cam); sc.camera = cam
try:
    sc.render.engine = 'BLENDER_EEVEE_NEXT'
except TypeError:
    sc.render.engine = 'BLENDER_EEVEE'
sc.render.resolution_x, sc.render.resolution_y = size, int(size * 0.75)
sc.view_settings.view_transform = 'Standard'
shots = []
views = [(-35, 18), (145, 18), (90, 10)]
for i, (az, el) in enumerate(views):
    az_r, el_r = math.radians(az), math.radians(el)
    d = rad * 2.9
    cam.location = ctr + Vector((math.sin(az_r) * math.cos(el_r), -math.cos(az_r) * math.cos(el_r), math.sin(el_r))) * d
    dirv = ctr - cam.location
    cam.rotation_euler = dirv.to_track_quat('-Z', 'Y').to_euler()
    p = out.replace('.png', f'_{i}.png')
    sc.render.filepath = p
    bpy.ops.render.render(write_still=True)
    shots.append(p)
print('PREVIEW', shots)
