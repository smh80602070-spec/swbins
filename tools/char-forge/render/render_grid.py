"""여럿 한눈에 — 모델마다 앞·뒤 두 방향, 한 줄에 네 모델(09-27 비교 몸 61벌 점검: 여덟씩 한 장). glb/fbx.
blender -b --factory-startup -P render_grid.py -- out.png m1 m2 ...      # CF_CLIP=run 이면 그 동작
"""
import bpy, sys, os, math
from mathutils import Vector
a = sys.argv[sys.argv.index('--') + 1:]
out, models = a[0], a[1:]
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
exec(open(os.path.join(os.path.dirname(__file__), 'render_common.py'), encoding='utf-8').read())
COLS, STEP, GAP, ROW = 4, 0.75, 0.35, 2.1
ANGLES = (0, 180)
for j, p in enumerate(models):
    row, col = divmod(j, COLS)
    for i, ang in enumerate(ANGLES):
        objs = load_any(p)
        sc.frame_set(12)
        roots = [o for o in objs if o.parent is None]
        lo, hi = bbox(objs)
        k = 1.7 / (hi.z - lo.z)
        for r in roots:
            r.scale = r.scale * k
        bpy.context.view_layer.update()
        lo, hi = bbox(objs)
        for r in roots:
            r.location.x -= (lo.x + hi.x) / 2
            r.location.y -= (lo.y + hi.y) / 2
            r.location.z -= lo.z
        bpy.context.view_layer.update()
        piv = bpy.data.objects.new('piv', None); sc.collection.objects.link(piv)
        for r in roots:
            r.parent = piv
        piv.rotation_euler = (0, 0, math.radians(ang))
        piv.location = (col * (2 * STEP + GAP) + i * STEP, 0, -row * ROW)
setup_light()
cam_d = bpy.data.cameras.new('cam'); cam = bpy.data.objects.new('cam', cam_d); sc.collection.objects.link(cam); sc.camera = cam
cam_d.type = 'ORTHO'
rows = (len(models) + COLS - 1) // COLS
W = COLS * (2 * STEP + GAP)
H = rows * ROW
cam.location = (W / 2 - STEP / 2 - GAP / 2, -8, 0.9 - (rows - 1) * ROW / 2)
cam.rotation_euler = (math.radians(90), 0, 0)
sc.render.resolution_x = 2000
sc.render.resolution_y = int(2000 * H / W)
cam_d.ortho_scale = max(W, H) * 1.02
set_engine()
fix_materials() if 'fix_materials' in dir() else None
sc.render.filepath = out
bpy.ops.render.render(write_still=True)
print('RENDERED', out)
