"""K-0096 — TRELLIS GLB 를 게임 규칙에 맞춘다(Blender 헤드리스): 얼굴 = glTF +Z(Blender -Y, build_monster 와 같음) · 원점 = 발 밑 가운데 · 실제 키(m).

  blender -b --factory-startup -P tools/ai-art/remote3d/finish.py -- <절대: 받은 GLB 폴더> <절대: 출력 폴더> <절대: k96_targets.json> [id,id]

대상 표 칸: `yaw`(도, Blender Z 축 — 시트에서 얼굴이 보이는 방향: 0°=그대로, 90° 칸에서 얼굴이면 -90) · `height`(m, 서 있는 키).
TRELLIS 결과는 1m 상자 가운데가 원점이라 그대로 두면 몸 절반이 땅에 묻힌다. 재질·질감은 건드리지 않는다.
떨어진 작은 조각(그림의 장식 원·점이 공·티끌이 된 것)은 지운다: 같은 자리 점을 합친 뒤 가장 큰 덩어리의 5% 미만인 덩어리.
발에 붙은 바닥 접시는 못 지운다 — 그림을 다시 뽑는다(배치 부정 태그 floor·ellipse·circles…).
"""
import bpy, bmesh, sys, os, json, math
from mathutils import Vector, Matrix

a = sys.argv[sys.argv.index('--') + 1:]
src, dst, tj = [os.path.abspath(x) for x in a[:3]]
only = set(a[3].split(',')) if len(a) > 3 else None
T = {t['id']: t for t in json.load(open(tj, encoding='utf-8'))['items']}
os.makedirs(dst, exist_ok=True)


def drop_specks(o, keep=0.05):
    bm = bmesh.new()
    bm.from_mesh(o.data)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-4)
    bm.verts.ensure_lookup_table()
    seen, comps = set(), []
    for v in bm.verts:
        if v.index in seen:
            continue
        st, comp = [v], []
        seen.add(v.index)
        while st:
            x = st.pop()
            comp.append(x)
            for e in x.link_edges:
                y = e.other_vert(x)
                if y.index not in seen:
                    seen.add(y.index)
                    st.append(y)
        comps.append(comp)
    big = max(len(c) for c in comps)
    gone = [v for c in comps if len(c) < big * keep for v in c]
    bmesh.ops.delete(bm, geom=gone, context='VERTS')
    bm.to_mesh(o.data)
    bm.free()
    return len(comps), sum(1 for c in comps if len(c) < big * keep)


n = 0
for f in sorted(os.listdir(src)):
    iid = f[:-4]
    if not f.endswith('.glb') or (only and iid not in only) or iid not in T:
        continue
    t = T[iid]
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=os.path.join(src, f))
    specks = [drop_specks(o) for o in bpy.data.objects if o.type == 'MESH']
    roots = [o for o in bpy.data.objects if o.parent is None]
    rot = Matrix.Rotation(math.radians(t.get('yaw', 0)), 4, 'Z')
    for o in roots:
        o.matrix_world = rot @ o.matrix_world
    bpy.context.view_layer.update()
    pts = [o.matrix_world @ Vector(c) for o in bpy.data.objects if o.type == 'MESH' for c in o.bound_box]
    lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
    hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    s = t.get('height', 1.0) / max(hi.z - lo.z, 1e-6)
    move = Matrix.Translation(Vector((-(lo.x + hi.x) / 2, -(lo.y + hi.y) / 2, -lo.z)))
    for o in roots:
        o.matrix_world = Matrix.Scale(s, 4) @ move @ o.matrix_world
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.export_scene.gltf(filepath=os.path.join(dst, f), export_format='GLB', use_selection=False, export_yup=True)
    n += 1
    print('FINISH', iid, 'yaw', t.get('yaw', 0), 'h', t.get('height', 1.0), 'scale %.3f' % s, 'specks', specks, flush=True)
print('FINISH_RESULT', n)
