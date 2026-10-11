"""K-0097 — 긴 윗옷 안 바지 뚫림 찾기·밀어 넣기(Blender 안에서 import). outfit_swap.py(tuck 칸)·tuck_scan.py 가 쓴다.

판정: 다리 뼈 축(UpperLeg 머리 → LowerLeg 머리, 정점 쪽 다리)의 같은 높이 점에서 바지 정점으로 광선을 쏴서,
윗옷(top·원피스) 면이 바지 정점보다 축에 가까이 있으면 그 정점은 윗옷 밖으로 나온 것(뚫림).
윗옷이 없는 쪽(앞트임·아랫단 아래)은 광선이 아무것도 안 맞아 뚫림이 아니다. 높이는 윗옷 아랫단 ~ 골반 사이만 본다.
고치기(fix): 바지를 윗옷 안으로 밀면 그보다 넓은 다리 피부가 윗옷을 뚫는다(10-11 hq_mulgyeol 시험) → 거꾸로
윗옷 정점을 같은 광선 위 '바지·피부 중 가장 바깥 면 + 여유'(기본 10mm) 로 밀어낸다(윗옷이 바지 위로 덮인다).
그래도 남는 바지 정점(밀린 정점과 안 밀린 정점 사이 윗옷 면이 바지를 비스듬히 가로지르는 곳)만 윗옷 면 - 여유 로 넣는다. 무게(뼈)는 안 바꾼다.
"""
import os

import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree

TOP_KEYS = ('Tops', 'Onepiece')
BOTTOM_KEYS = ('Bottoms',)
SKIN_KEYS = ('Body_00_SKIN',)


def kind(o):
    names = ' '.join(m.name for m in o.data.materials if m)
    if any(k in names for k in SKIN_KEYS):
        return 'skin'
    if any(k in names for k in BOTTOM_KEYS):
        return 'bottom'
    if any(k in names for k in TOP_KEYS):
        return 'top'
    return None


def _world_coords(o, deps=None):
    if deps is not None:
        ev = o.evaluated_get(deps)
        me = ev.to_mesh()
        co = [o.matrix_world @ v.co for v in me.vertices]
        ev.to_mesh_clear()
        return co
    return [o.matrix_world @ v.co for v in o.data.vertices]


def _bvh(objs, deps=None):
    verts, polys = [], []
    for o in objs:
        if deps is not None:
            ev = o.evaluated_get(deps)
            me = ev.to_mesh()
        else:
            me = o.data
        base = len(verts)
        verts += [o.matrix_world @ v.co for v in me.vertices]
        polys += [[base + i for i in p.vertices] for p in me.polygons]
        if deps is not None:
            ev.to_mesh_clear()
    return BVHTree.FromPolygons(verts, polys) if polys else None, verts


def _leg_axis(arm, deps=None):
    """쪽(L/R) → (위 점, 아래 점) 월드 좌표. 포즈가 있으면 포즈 뼈를 쓴다."""
    out = {}
    for s in ('L', 'R'):
        u, l = 'J_Bip_%s_UpperLeg' % s, 'J_Bip_%s_LowerLeg' % s
        if deps is not None and arm.pose:
            pu, pl = arm.pose.bones.get(u), arm.pose.bones.get(l)
            if pu and pl:
                out[s] = (arm.matrix_world @ pu.head, arm.matrix_world @ pl.head)
                continue
        bu, bl = arm.data.bones.get(u), arm.data.bones.get(l)
        if bu and bl:
            out[s] = (arm.matrix_world @ bu.head_local, arm.matrix_world @ bl.head_local)
    return out


def _axis_point(ax, v):
    side = 'L' if v.x >= 0 else 'R'
    if side not in ax:
        side = next(iter(ax))
    a, b = ax[side]
    if v.z >= a.z:
        return Vector((a.x, a.y, v.z))
    if v.z <= b.z:
        return Vector((b.x, b.y, v.z))
    t = (a.z - v.z) / max(a.z - b.z, 1e-6)
    p = a.lerp(b, t)
    return Vector((p.x, p.y, v.z))


def _outermost(tree, p, d, upto):
    """p 에서 d 방향으로 upto 거리 안의 마지막 맞음 거리(없으면 None)."""
    last, t = None, 0.0
    for _ in range(16):
        h = tree.ray_cast(p + d * (t + 1e-4), d, upto - t)
        if h[0] is None:
            break
        t = t + 1e-4 + h[3]
        last = t
    return last


MARGIN = float(os.environ.get('TUCK_MARGIN', '0.01'))   # 3mm → 10mm: 걷기 뚫림이 조금 줄고 옷이 부풀어 보이지 않음(10-11 렌더)


def cover(arm, objs, margin=MARGIN, reach=0.08):
    """윗옷 정점을 바지·피부의 가장 바깥 면 + margin 으로 밀어낸다(쉼 자세). 옮긴 정점 수."""
    tops = [o for o in objs if o.type == 'MESH' and kind(o) == 'top']
    obst = [o for o in objs if o.type == 'MESH' and kind(o) in ('bottom', 'skin')]
    if not tops or not obst:
        return 0
    tree, _ = _bvh(obst)
    hips = arm.data.bones.get('J_Bip_C_Hips')
    hip = (arm.matrix_world @ hips.head_local).z if hips else 9
    ax = _leg_axis(arm)
    if tree is None or not ax:
        return 0
    moved = 0
    for o in tops:
        inv = o.matrix_world.inverted()
        for v in o.data.vertices:
            w = o.matrix_world @ v.co
            if w.z >= hip:
                continue
            p = _axis_point(ax, w)
            d = w - p
            L = d.length
            if L < 1e-4:
                continue
            d.normalize()
            far = _outermost(tree, p, d, L + reach)
            if far is not None and far > L - margin:
                v.co = inv @ (p + d * (far + margin))
                moved += 1
        o.data.update()
    return moved


def scan(arm, objs, deps=None, eps=0.001, margin=MARGIN, fix=False, _push=False):
    """objs = 한 인물의 메시들. 돌려줌 dict(top_min, hip, poke, checked, moved). fix=True 면 cover() 로 윗옷을 밀어낸 뒤 다시 센다(쉼 자세만)."""
    if fix and deps is None:
        n = cover(arm, objs, margin)
        r = scan(arm, objs, eps=eps, margin=margin, _push=True)
        r['moved'] = n
        r['pushed'] = r.pop('_pushed', 0)
        r.update(poke=scan(arm, objs, eps=eps, margin=margin)['poke'])
        return r
    tops = [o for o in objs if o.type == 'MESH' and kind(o) == 'top']
    bots = [o for o in objs if o.type == 'MESH' and kind(o) == 'bottom']
    res = dict(top_min=None, hip=None, poke=0, checked=0, moved=0)
    if not tops or not bots:
        return res
    tree, tv = _bvh(tops, deps)
    if tree is None:
        return res
    hips = arm.data.bones.get('J_Bip_C_Hips')
    hip = (arm.matrix_world @ (arm.pose.bones['J_Bip_C_Hips'].head if deps is not None else hips.head_local)).z if hips else max(v.z for v in tv)
    top_min = min(v.z for v in tv)
    res.update(top_min=round(top_min, 3), hip=round(hip, 3))
    ax = _leg_axis(arm, deps)
    if not ax:
        return res
    for o in bots:
        co = _world_coords(o, deps)
        inv = o.matrix_world.inverted()
        for vi, v in enumerate(co):
            if not (top_min + 0.02 < v.z < hip):
                continue
            p = _axis_point(ax, v)
            d = v - p
            L = d.length
            if L < 1e-4:
                continue
            res['checked'] += 1
            hit = tree.ray_cast(p, d.normalized(), L)
            if hit[0] is not None and hit[3] < L - eps:
                res['poke'] += 1
                if _push:
                    o.data.vertices[vi].co = inv @ (p + d.normalized() * max(hit[3] - margin, 0.0))
                    res['_pushed'] = res.get('_pushed', 0) + 1
        if _push:
            o.data.update()
    return res
