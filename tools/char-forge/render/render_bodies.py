"""VRM/GLB 몸 정면·반측면 렌더 — K-0072 단계 0(밑몸 고르기). Blender 헤드리스, VRM 은 glTF 컨테이너라 그대로 읽는다.

  blender -b --factory-startup -P tools/char-forge/render/render_bodies.py -- <출력폴더> <파일1> <파일2> …
출력: <출력폴더>/<id>_front.png · <id>_three.png · <id>_head.png (id = 파일 이름, 확장자 뺀 것)
"""
import bpy, sys, os, math, shutil, tempfile
from mathutils import Vector

a = sys.argv[sys.argv.index('--') + 1:]
out, files = os.path.abspath(a[0]), [os.path.abspath(x) for x in a[1:]]
os.makedirs(out, exist_ok=True)
FRONT_SIGN = 1          # +1 = 카메라가 +Y 쪽(VRM 1.0 임포트 뒤 앞면)


def setup():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    try:
        sc.render.engine = 'BLENDER_EEVEE_NEXT'
    except Exception:
        sc.render.engine = 'BLENDER_EEVEE'
    sc.render.resolution_x, sc.render.resolution_y = 420, 640
    sc.render.film_transparent = False
    w = bpy.data.worlds.new('w'); sc.world = w; w.use_nodes = True
    w.node_tree.nodes['Background'].inputs[0].default_value = (0.62, 0.66, 0.72, 1)
    w.node_tree.nodes['Background'].inputs[1].default_value = 0.9
    sun = bpy.data.objects.new('sun', bpy.data.lights.new('sun', 'SUN')); sc.collection.objects.link(sun)
    sun.data.energy = 2.5; sun.rotation_euler = (math.radians(50), 0, math.radians(20))
    cd = bpy.data.cameras.new('c'); cam = bpy.data.objects.new('c', cd); sc.collection.objects.link(cam); sc.camera = cam
    cd.type = 'ORTHO'
    return sc, cam, cd


for f in files:
    sc, cam, cd = setup()
    iid = os.path.splitext(os.path.basename(f))[0].lower()
    tmp = os.path.join(tempfile.gettempdir(), iid + '_r.glb')
    shutil.copyfile(f, tmp)                       # .vrm → .glb 이름으로(임포터가 확장자로 고른다)
    try:
        bpy.ops.import_scene.gltf(filepath=tmp)
    except Exception as e:
        print('IMPORT_FAIL', iid, e)
        continue
    meshes = [o for o in bpy.data.objects if o.type == 'MESH']
    zs, ys, xs = [], [], []
    dg = bpy.context.evaluated_depsgraph_get()
    for o in meshes:
        me = o.evaluated_get(dg).to_mesh()
        for v in me.vertices:
            p = o.matrix_world @ v.co
            xs.append(p.x); ys.append(p.y); zs.append(p.z)
    zs.sort(); xs.sort(); ys.sort()
    q = lambda L, f: L[min(len(L) - 1, max(0, int(len(L) * f)))]
    lo = Vector((q(xs, .002), q(ys, .002), q(zs, .002))); hi = Vector((q(xs, .998), q(ys, .998), q(zs, .998)))
    ctr = (lo + hi) / 2; h = hi.z - lo.z
    shots = (('front', 0, h * 1.1, ctr.z), ('three', 35, h * 1.1, ctr.z), ('head', 0, h * 0.22, hi.z - h * 0.11))
    for name, ang, scale, cz in shots:
        cd.ortho_scale = scale
        r = 6
        # glTF 임포트 뒤 몸은 -Y 를 본다 → 카메라는 -Y 쪽(앞)에서 +Y 로 본다. 실제로 뒤통수가 나오면 FRONT_SIGN 을 뒤집는다.
        cam.location = (ctr.x + r * math.sin(math.radians(ang)), ctr.y + FRONT_SIGN * r * math.cos(math.radians(ang)), cz)
        d = Vector((ctr.x, ctr.y, cz)) - cam.location
        cam.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
        sc.render.filepath = os.path.join(out, f'{iid}_{name}.png')
        bpy.ops.render.render(write_still=True)
    print('OK', iid, round(h, 3), len(meshes))
