"""Blender 스크립트 — 몬스터 몸 GLB 를 흰 배경 3/4 전신 768×768 으로 렌더한다(img2img 밑그림). make_monster_dex.py render 가 부른다.

  blender -b --factory-startup -P tools/ai-art/render_monster_init.py -- <glb 폴더> <출력 폴더> [id,id,...]
알파 투명으로 렌더해 흰 바탕에 얹는다(그림자 바닥 없음 — 생성 모델이 바닥을 그리지 않게). 몸이 화면의 약 72% 를 채우게 거리를 잡는다.
"""
import glob
import math
import os
import sys

import bpy
from mathutils import Vector

a = sys.argv[sys.argv.index('--') + 1:]
src, out = os.path.abspath(a[0]), os.path.abspath(a[1])
only = a[2].split(',') if len(a) > 2 else None
os.makedirs(out, exist_ok=True)
files = sorted(glob.glob(os.path.join(src, '*.glb')))
if only:
    files = [f for f in files if os.path.splitext(os.path.basename(f))[0] in only]
for f in files:
    pid = os.path.splitext(os.path.basename(f))[0]
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    bpy.ops.import_scene.gltf(filepath=f)
    meshes = [o for o in bpy.data.objects if o.type == 'MESH']
    pts = [o.matrix_world @ Vector(c) for o in meshes for c in o.bound_box]
    lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
    hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    ctr, rad = (lo + hi) / 2, max((hi - lo).length / 2, 0.3)
    sun = bpy.data.objects.new('s', bpy.data.lights.new('s', 'SUN'))
    sun.data.energy = 3.4
    sun.rotation_euler = (math.radians(55), math.radians(5), math.radians(-35))
    sc.collection.objects.link(sun)
    w = bpy.data.worlds.new('w')
    w.use_nodes = True
    w.node_tree.nodes['Background'].inputs['Color'].default_value = (0.8, 0.85, 0.9, 1)
    w.node_tree.nodes['Background'].inputs['Strength'].default_value = 1.1
    sc.world = w
    cd = bpy.data.cameras.new('c')
    cd.lens = 55
    cam = bpy.data.objects.new('c', cd)
    sc.collection.objects.link(cam)
    sc.camera = cam
    az, el = math.radians(-38), math.radians(20)
    d = rad * 2.35
    cam.location = ctr + Vector((math.sin(az) * math.cos(el), -math.cos(az) * math.cos(el), math.sin(el))) * d
    cam.rotation_euler = (ctr - cam.location).to_track_quat('-Z', 'Y').to_euler()
    try:
        sc.render.engine = 'BLENDER_EEVEE_NEXT'
    except TypeError:
        sc.render.engine = 'BLENDER_EEVEE'
    sc.render.film_transparent = True
    sc.render.resolution_x = sc.render.resolution_y = 768
    sc.render.image_settings.color_mode = 'RGBA'
    sc.view_settings.view_transform = 'Standard'
    sc.render.filepath = os.path.join(out, pid + '_rgba.png')
    bpy.ops.render.render(write_still=True)
    print('RENDERED', pid)
