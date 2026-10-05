"""머리 뼈를 돌려 머리카락이 따라오는지 보는 시험 렌더(K-0072 단계 2). blender -b --factory-startup -P <이 파일> -- <입력.glb> <출력.png> [도]"""
import bpy, sys, os, math
from mathutils import Vector, Euler
a = sys.argv[sys.argv.index('--') + 1:]
src, out = os.path.abspath(a[0]), os.path.abspath(a[1])
deg = float(a[2]) if len(a) > 2 else 40.0
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
arm = [o for o in bpy.data.objects if o.type == 'ARMATURE'][0]
bpy.context.view_layer.objects.active = arm
bpy.ops.object.mode_set(mode='POSE')
pb = arm.pose.bones['J_Bip_C_Head']
pb.rotation_mode = 'XYZ'
pb.rotation_euler = Euler((0, 0, math.radians(deg)), 'XYZ')
bpy.ops.object.mode_set(mode='OBJECT')
sc = bpy.context.scene
try:
    sc.render.engine = 'BLENDER_EEVEE_NEXT'
except Exception:
    sc.render.engine = 'BLENDER_EEVEE'
sc.render.resolution_x, sc.render.resolution_y = 420, 420
w = bpy.data.worlds.new('w'); sc.world = w; w.use_nodes = True
w.node_tree.nodes['Background'].inputs[0].default_value = (0.62, 0.66, 0.72, 1)
sun = bpy.data.objects.new('sun', bpy.data.lights.new('sun', 'SUN')); sc.collection.objects.link(sun)
sun.data.energy = 2.5; sun.rotation_euler = (math.radians(50), 0, math.radians(20))
hb = arm.data.bones['J_Bip_C_Head'].head_local
cd = bpy.data.cameras.new('c'); cam = bpy.data.objects.new('c', cd); sc.collection.objects.link(cam); sc.camera = cam
cd.type = 'ORTHO'; cd.ortho_scale = 0.5
cam.location = (hb.x, hb.y + 6, hb.z + 0.08)
cam.rotation_euler = (Vector((hb.x, hb.y, hb.z + 0.08)) - cam.location).to_track_quat('-Z', 'Y').to_euler()
sc.render.filepath = out
bpy.ops.render.render(write_still=True)
print('POSE_OK', deg)
