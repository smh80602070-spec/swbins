"""K-0043 재작업 시험 코드(10-05) — 사용자 "허접" 판정 뒤 몸 만드는 방식을 바꾸는 첫 시험. 아직 build_monster.py 를 대체하지 않았다.

  blender -b --factory-startup -P tools/world-forge/monster_skin_proto.py -- <출력 png>

Skin 모디파이어: 뼈대 그래프(점·선·점마다 굵기)만 주면 이어진 매끈한 유기체 몸이 나온다 → Subsurf 2 → 부드러운 면. 네발 한 마리(4288 삼각형)로 시험 —
몸통·목·머리·꼬리·다리 넷이 한 덩어리로 이어지고 지금 build_monster.py 의 타원체 이음보다 훨씬 생물답다. 다음: 머리 윤곽(주둥이·턱)·귀·뿔(굽은 뿔)·눈·발톱·무늬(면 법선·위치로 재질 칸 배정)·계통별 뼈대(날개 막·뱀·정령)·UV(위치 투영)·삼각형 ≤3k(subsurf 1 + 밀도 조절).
"""
import bpy, bmesh, math, random, sys
from mathutils import Vector

out = sys.argv[sys.argv.index('--') + 1]
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene


def skin_object(name, verts, edges, radii, subs=2):
    """verts: [(x,y,z)], edges: [(i,j)], radii: [(rx,ry)] → Skin + Subsurf 적용한 오브젝트."""
    me = bpy.data.meshes.new(name)
    me.from_pydata(verts, edges, [])
    ob = bpy.data.objects.new(name, me)
    sc.collection.objects.link(ob)
    bpy.context.view_layer.objects.active = ob
    ob.select_set(True)
    sk = ob.modifiers.new('skin', 'SKIN')
    sk.use_smooth_shade = True
    sk.branch_smoothing = 0.8
    bpy.ops.object.modifier_apply(modifier='skin') if False else None
    me.skin_vertices.new() if False else None
    # skin_vertices 레이어는 모디파이어를 더하면 생긴다
    layer = me.skin_vertices[0]
    for i, r in enumerate(radii):
        layer.data[i].radius = r
    layer.data[0].use_root = True
    ss = ob.modifiers.new('sub', 'SUBSURF')
    ss.levels = subs
    ss.render_levels = subs
    bpy.ops.object.modifier_apply(modifier='skin')
    bpy.ops.object.modifier_apply(modifier='sub')
    bpy.ops.object.shade_smooth()
    return ob


# 네발 짐승 — 얼굴 -Y
zc = 0.62
V = []; E = []; R = []


def add(p, r, link=None):
    V.append(p); R.append(r)
    i = len(V) - 1
    if link is not None:
        E.append((link, i))
    return i


pel = add((0, 0.45, zc), (0.26, 0.24))
mid = add((0, 0.0, zc + 0.03), (0.30, 0.27), pel)
che = add((0, -0.45, zc + 0.06), (0.30, 0.28), mid)
nk1 = add((0, -0.72, zc + 0.20), (0.17, 0.16), che)
nk2 = add((0, -0.92, zc + 0.30), (0.17, 0.16), nk1)
hed = add((0, -1.12, zc + 0.28), (0.20, 0.17), nk2)
sno = add((0, -1.38, zc + 0.16), (0.11, 0.09), hed)
t1 = add((0, 0.78, zc + 0.02), (0.13, 0.12), pel)
t2 = add((0, 1.08, zc + 0.12), (0.09, 0.08), t1)
t3 = add((0, 1.34, zc + 0.30), (0.05, 0.05), t2)
for sx in (-1, 1):
    for yy, root in ((-0.40, che), (0.42, pel)):
        s0 = add((sx * 0.20, yy, zc - 0.06), (0.14, 0.13), root)
        k = add((sx * 0.23, yy + (0.04 if yy < 0 else -0.06), zc * 0.52), (0.10, 0.10), s0)
        f = add((sx * 0.24, yy, 0.07), (0.11, 0.14), k)
ob = skin_object('quad', V, E, R, 2)
# 재질·배경·카메라
mat = bpy.data.materials.new('m'); mat.use_nodes = True
mat.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (0.35, 0.3, 0.25, 1)
ob.data.materials.append(mat)
print('TRIS', sum(len(p.vertices) - 2 for p in ob.data.polygons))
bpy.ops.mesh.primitive_plane_add(size=20, location=(0, 0, -0.01))
sun = bpy.data.objects.new('s', bpy.data.lights.new('s', 'SUN')); sun.data.energy = 3.2
sun.rotation_euler = (math.radians(50), 0, math.radians(-30)); sc.collection.objects.link(sun)
w = bpy.data.worlds.new('w'); w.use_nodes = True; w.node_tree.nodes['Background'].inputs['Color'].default_value = (0.7, 0.78, 0.9, 1); sc.world = w
cd = bpy.data.cameras.new('c'); cd.lens = 45; cam = bpy.data.objects.new('c', cd); sc.collection.objects.link(cam); sc.camera = cam
cam.location = Vector((2.6, -3.2, 1.7)); cam.rotation_euler = (Vector((0, 0, 0.7)) - cam.location).to_track_quat('-Z', 'Y').to_euler()
try: sc.render.engine = 'BLENDER_EEVEE_NEXT'
except TypeError: sc.render.engine = 'BLENDER_EEVEE'
sc.render.resolution_x, sc.render.resolution_y = 640, 480
sc.render.filepath = out
bpy.ops.render.render(write_still=True)
