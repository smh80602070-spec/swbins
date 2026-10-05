"""머리 정면 렌더 — CPU(Cycles) 라 SD 등 GPU 작업과 동시에 돌려도 된다(K-0072 단계 3 얼굴 레이어 확인용).

  blender -b --factory-startup -P tools/char-forge/render/render_heads_cpu.py -- <출력폴더> <파일.glb>…   → <출력폴더>/<id>_hc.png 360px
"""
import bpy, sys, os, math, shutil, tempfile
from mathutils import Vector
a = sys.argv[sys.argv.index('--') + 1:]
out, files = a[0], a[1:]
for f in files:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.render.engine = 'CYCLES'; sc.cycles.device = 'CPU'; sc.cycles.samples = 24; sc.cycles.use_denoising = True
    sc.render.resolution_x = sc.render.resolution_y = 360
    w = bpy.data.worlds.new('w'); sc.world = w; w.use_nodes = True
    w.node_tree.nodes['Background'].inputs[0].default_value = (0.55, 0.6, 0.66, 1); w.node_tree.nodes['Background'].inputs[1].default_value = 0.8
    sun = bpy.data.objects.new('sun', bpy.data.lights.new('sun', 'SUN')); sc.collection.objects.link(sun); sun.data.energy = 2.2; sun.rotation_euler = (math.radians(60), 0, math.radians(25))
    cd = bpy.data.cameras.new('c'); cam = bpy.data.objects.new('c', cd); sc.collection.objects.link(cam); sc.camera = cam; cd.type = 'ORTHO'
    t = os.path.join(tempfile.gettempdir(), 'hc.glb'); shutil.copyfile(f, t); bpy.ops.import_scene.gltf(filepath=t)
    for o in list(bpy.data.objects):
        if o.type == 'MESH' and o.name.startswith(('Icosphere', 'Cube')): bpy.data.objects.remove(o, do_unlink=True)
    arm = next(o for o in bpy.data.objects if o.type == 'ARMATURE')
    hb = arm.data.bones['J_Bip_C_Head']; hp = arm.matrix_world @ hb.head_local; hl = (hb.tail_local - hb.head_local).length
    c = hp + Vector((0, 0, hl * 0.9))
    cd.ortho_scale = hl * 4.2
    cam.location = c + Vector((0, 3, 0)); cam.rotation_euler = (c - cam.location).to_track_quat('-Z', 'Y').to_euler()
    sc.render.filepath = os.path.join(out, os.path.splitext(os.path.basename(f))[0] + '_hc.png')
    bpy.ops.render.render(write_still=True); print('OK', sc.render.filepath)
