"""옷 변형 확인 렌더 — 맨몸(base.glb) + 옷 조각(상의·하의·신발)에 무늬 질감을 갈아 끼워 전신 정면을 뽑는다. Blender 헤드리스.

  blender -b --factory-startup -P tools/char-forge/render_wardrobe.py -- <조각폴더> <wardrobe폴더> <출력폴더> <무늬id,무늬id,…>
질감은 wardrobe/<vrm>/<조각>/<무늬>.webp — 조각 GLB 의 바탕색 질감만 바꾸고 메시는 그대로.
"""
import bpy, sys, os, glob, math
from mathutils import Vector
a = sys.argv[sys.argv.index('--') + 1:]
pdir, wdir, out, pats = a[0], a[1], a[2], a[3].split(',')
vrm = os.path.basename(os.path.normpath(pdir))
os.makedirs(out, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
try:
    sc.render.engine = 'BLENDER_EEVEE_NEXT'
except Exception:
    sc.render.engine = 'BLENDER_EEVEE'
sc.render.resolution_x, sc.render.resolution_y = 420, 640
w = bpy.data.worlds.new('w'); sc.world = w; w.use_nodes = True
w.node_tree.nodes['Background'].inputs[0].default_value = (0.62, 0.66, 0.72, 1)
w.node_tree.nodes['Background'].inputs[1].default_value = 0.9
sun = bpy.data.objects.new('sun', bpy.data.lights.new('sun', 'SUN')); sc.collection.objects.link(sun)
sun.data.energy = 2.5; sun.rotation_euler = (math.radians(50), 0, math.radians(20))
cd = bpy.data.cameras.new('c'); cam = bpy.data.objects.new('c', cd); sc.collection.objects.link(cam); sc.camera = cam
cd.type = 'ORTHO'

files = [os.path.join(pdir, 'base.glb')] + sorted(glob.glob(os.path.join(pdir, '*__*.glb')))
pieces = {}                                   # 조각 이름 → 질감 노드
for f in files:
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=f)
    name = os.path.splitext(os.path.basename(f))[0]
    if name == 'base':
        continue
    for o in [o for o in bpy.data.objects if o not in before and o.type == 'MESH']:
        for s in o.material_slots:
            if s.material and s.material.use_nodes:
                for n in s.material.node_tree.nodes:
                    if n.type == 'TEX_IMAGE' and n.image:
                        pieces[name] = n
                        break
bpy.context.view_layer.update()
pts = [o.matrix_world @ Vector(c) for o in bpy.data.objects if o.type == 'MESH' for c in o.bound_box]
lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts))); hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
ctr = (lo + hi) / 2
cd.ortho_scale = (hi.z - lo.z) * 1.08
cam.location = (ctr.x, ctr.y - 8, ctr.z); cam.rotation_euler = (math.radians(90), 0, 0)
for pid in ['orig'] + pats:
    for name, node in pieces.items():
        if pid == 'orig':
            continue
        p = os.path.join(wdir, vrm, name, pid + '.webp')
        if os.path.exists(p):
            node.image = bpy.data.images.load(p, check_existing=True)
    sc.render.filepath = os.path.join(out, f'{vrm}_{pid}.png')
    bpy.ops.render.render(write_still=True)
    print('WARD', pid)
