"""K-0096 — TRELLIS GLB 를 게임 규칙에 맞춘다(Blender 헤드리스): 얼굴 = glTF +Z(Blender -Y, build_monster 와 같음) · 원점 = 발 밑 가운데 · 실제 키(m).

  blender -b --factory-startup -P tools/ai-art/remote3d/finish.py -- <절대: 받은 GLB 폴더> <절대: 출력 폴더> <절대: k96_targets.json> [id,id]

대상 표 칸: `yaw`(도, Blender Z 축 — 시트에서 얼굴이 보이는 방향: 0°=그대로, 90° 칸에서 얼굴이면 -90) · `height`(m, 서 있는 키).
TRELLIS 결과는 1m 상자 가운데가 원점이라 그대로 두면 몸 절반이 땅에 묻힌다. 재질·질감은 건드리지 않는다.
떨어진 작은 조각(그림의 장식 원·점이 공·티끌이 된 것)은 지운다: 같은 자리 점을 합친 뒤 가장 큰 덩어리의 5% 미만인 덩어리.
발에 붙은 바닥 접시·상자: 대상 표 `plate: true`(또는 판이 얇아 덜 보이면 낮은 비율 수, 예 0.05) 면(`plate_cut: 0.02` 는 그 높이 비율로 바로) 위에서 아래로 쏜 광선의 첫 맞음 높이가 밑 35% 안에서 한 높이로 몰린 넓은 면(판 윗면)을 찾아
그 높이 + 키 1% 아래 점을 지운다(발바닥 조금 같이 잘림 — 밑에서만 보임). 못 찾으면 안 자르고 알림 — 그림을 다시 뽑는다(부정 태그 floor·ellipse·circles…).
"""
import bpy, bmesh, sys, os, json, math
from mathutils import Vector, Matrix
from mathutils.bvhtree import BVHTree

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


def drop_plate(objs, grid=96, need=0.15, fixed=None):
    """발밑 판 윗면 높이를 찾아 그 아래 점을 지운다. 돌린 뒤(세계 Z 위)·키 맞추기 전에 부른다."""
    vs, fs = [], []
    for o in objs:
        base = len(vs)
        vs += [o.matrix_world @ v.co for v in o.data.vertices]
        fs += [[base + i for i in p.vertices] for p in o.data.polygons]
    lo = Vector((min(v.x for v in vs), min(v.y for v in vs), min(v.z for v in vs)))
    hi = Vector((max(v.x for v in vs), max(v.y for v in vs), max(v.z for v in vs)))
    H = hi.z - lo.z
    tree = BVHTree.FromPolygons(vs, fs)
    hits = []
    for i in range(grid):
        for j in range(grid):
            x = lo.x + (hi.x - lo.x) * (i + 0.5) / grid
            y = lo.y + (hi.y - lo.y) * (j + 0.5) / grid
            h = tree.ray_cast(Vector((x, y, hi.z + 1)), Vector((0, 0, -1)))
            if h[0] is not None:
                hits.append((h[0].z - lo.z) / H)
    low = sorted(z for z in hits if z < 0.35)
    if fixed is not None:  # 판이 고르지 않아(코 끝 등이 섞임) 못 찾을 때 — 표에 적은 높이 비율로 바로 자른다
        low, need = [fixed - 0.01] * 4, 0
    if not hits or len(low) < need * len(hits):
        return 'no-plate low %d/%d' % (len(low), len(hits))
    q1, med, q3 = low[len(low) // 4], low[len(low) // 2], low[3 * len(low) // 4]
    if q3 - q1 > 0.03:
        return 'no-plate spread %.3f' % (q3 - q1)
    cut = lo.z + (q3 + 0.01) * H
    gone = 0
    for o in objs:
        inv = o.matrix_world.inverted()
        bm = bmesh.new()
        bm.from_mesh(o.data)
        dead = [v for v in bm.verts if (o.matrix_world @ v.co).z < cut]
        gone += len(dead)
        bmesh.ops.delete(bm, geom=dead, context='VERTS')
        bm.to_mesh(o.data)
        bm.free()
    return 'plate top %.3f (low %d/%d) cut %d verts' % (q3, len(low), len(hits), gone)


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
    plate = drop_plate([o for o in bpy.data.objects if o.type == 'MESH'], need=t['plate'] if t.get('plate') is not True else 0.15, fixed=t.get('plate_cut')) if t.get('plate') else '-'
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
    print('FINISH', iid, 'yaw', t.get('yaw', 0), 'h', t.get('height', 1.0), 'scale %.3f' % s, 'specks', specks, 'plate', plate, flush=True)
print('FINISH_RESULT', n)
