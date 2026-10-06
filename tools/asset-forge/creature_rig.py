"""K-0031 정적 몸(뼈 없음) → 자체 뼈대 + 자체 키프레임 동작. 네발(quad)·새(bird, 접은 날개)·벌레(worm, 솟은 등뼈).

  blender -b --factory-startup -P tools/asset-forge/creature_rig.py -- <몸.glb> <출력.glb> [quad|bird|worm]

정적 몸 14종은 단계 3 대체 동작(몸 전체 이동)이라 다리가 안 움직였다(10-06 눈 판정: 걷기 = 미끄러지는 동상).
여기서는 메시를 읽어 뼈대를 짓는다 — 낮은 정점(다리)을 앞뒤·좌우 네 무리로 나눠 다리 뼈 두 마디, 앞 끝 = 머리, 뒤 끝 = 꼬리, 가운데 = 몸.
무게는 가까운 무리 + 높이 경사(다리 위쪽은 몸과 섞임). 동작 7(Idle·Walk·Run·Attack·Hit·Death·Special)은 시간 함수(난수 없음).
앞 = Blender -Y(glTF +Z) 관례(정적 8종 눈 확인) — 머리가 +Y 인 몸만 CREATURE_FRONT=+Y. 산출은 git 밖(tools/_out/creature_rig), 원본 불변.
"""
import math
import os
import sys

import bpy
from mathutils import Matrix, Quaternion, Vector

FPS = 24


def _args():
    a = sys.argv[sys.argv.index('--') + 1:]
    return a[0], a[1], (a[2] if len(a) > 2 else 'quad')


def _load(src):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=os.path.abspath(src))
    meshes = [o for o in bpy.data.objects if o.type == 'MESH']
    for o in bpy.data.objects:
        if o.type == 'EMPTY':
            pass
    bpy.ops.object.select_all(action='DESELECT')
    for o in meshes:
        o.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]
    if len(meshes) > 1:
        bpy.ops.object.join()
    ob = bpy.context.view_layer.objects.active
    ob.parent = None
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    for o in list(bpy.data.objects):
        if o is not ob:
            bpy.data.objects.remove(o)
    return ob


def _front_sign(V, H):
    """머리 쪽 = 위쪽 덩어리(z > 0.55H)가 몸 가운데보다 더 내민 끝. -1 이면 -Y 가 앞."""
    ys = [v.y for v in V]
    y0, y1 = min(ys), max(ys)
    mid = (y0 + y1) / 2
    hi = [v for v in V if v.z > 0.55 * H]
    f = [v for v in hi if v.y < mid]
    b = [v for v in hi if v.y > mid]
    ext_f = mid - min((v.y for v in f), default=mid)
    ext_b = max((v.y for v in b), default=mid) - mid
    return -1 if ext_f >= ext_b else 1


def _quad_layout(V):
    H = max(v.z for v in V)
    s = 1 if os.environ.get('CREATURE_FRONT') == '+Y' else -1   # glTF 관례(+Z 앞 = Blender -Y). 10-06 자동 판정(_front_sign)은 멧돼지·코끼리·판다를 뒤집어 틀렸다 — 예외 종만 CREATURE_FRONT=+Y
    if s > 0:                                    # 앞을 -Y 로 맞춘다 — 계산만 뒤집고 메시는 그대로(뼈를 거울로)
        V = [Vector((v.x, -v.y, v.z)) for v in V]
    ys = [v.y for v in V]
    Y0, Y1 = min(ys), max(ys)
    L = Y1 - Y0
    low = [v for v in V if v.z < 0.22 * H]
    yl = sorted(v.y for v in low)
    split = yl[len(yl) // 2]
    for _ in range(8):                           # 앞뒤 두 무리(1차원 k-평균)
        a = [y for y in yl if y < split]
        b = [y for y in yl if y >= split]
        if not a or not b:
            break
        split = (sum(a) / len(a) + sum(b) / len(b)) / 2
    legs = {}
    for fb, cond in (('F', lambda v: v.y < split), ('B', lambda v: v.y >= split)):
        for side, sx in (('L', 1), ('R', -1)):
            g = [v for v in low if cond(v) and v.x * sx > 0]
            if not g:
                g = [v for v in low if cond(v)]
            cx = sum(v.x for v in g) / len(g)
            cy = sum(v.y for v in g) / len(g)
            r = max(0.05 * L, (sum((v.x - cx) ** 2 + (v.y - cy) ** 2 for v in g) / len(g)) ** 0.5 * 1.6)
            legs[fb + side] = Vector((cx, cy, 0)), r
    yF = (legs['FL'][0].y + legs['FR'][0].y) / 2
    yB = (legs['BL'][0].y + legs['BR'][0].y) / 2
    mid = [v for v in V if yF < v.y < yB]
    belly = min((v.z for v in mid if abs(v.x) < 0.5 * max(abs(w.x) for w in V)), default=0.35 * H)
    top = max((v.z for v in mid), default=H)
    spine_z = (belly + top) / 2
    front = [v for v in V if v.y < Y0 + 0.12 * L]
    back = [v for v in V if v.y > Y1 - 0.08 * L]
    head_z = sum(v.z for v in front) / len(front)
    tail_z = sum(v.z for v in back) / len(back)
    return dict(H=H, L=L, Y0=Y0, Y1=Y1, legs=legs, yF=yF, yB=yB, belly=belly, spine_z=spine_z,
                head_z=head_z, tail_z=tail_z, flip=s > 0)


def _build_arm(lay):
    H, L = lay['H'], lay['L']
    fl = -1 if lay['flip'] else 1                 # 거울: 뼈 y 를 원래 메시 쪽으로
    P = lambda x, y, z: Vector((x, y * fl, z))
    arm_d = bpy.data.armatures.new('CreatureArmature')
    arm = bpy.data.objects.new('CreatureArmature', arm_d)
    bpy.context.scene.collection.objects.link(arm)
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.mode_set(mode='EDIT')
    E = arm_d.edit_bones

    def bone(n, h, t, parent=None):
        b = E.new(n)
        b.head, b.tail = h, t
        b.align_roll(Vector((0, 0, 1)) if abs((t - h).normalized().z) < 0.9 else Vector((0, -fl, 0)))
        if parent:
            b.parent = E[parent]
        return b
    yc = (lay['yF'] + lay['yB']) / 2
    bone('Root', P(0, yc, 0), P(0, yc, 0.1 * H))
    bone('Hips', P(0, lay['yB'], lay['spine_z']), P(0, yc, lay['spine_z']), 'Root')
    bone('Chest', P(0, yc, lay['spine_z']), P(0, lay['yF'], lay['spine_z']), 'Hips')
    bone('Head', P(0, lay['yF'], (lay['spine_z'] + lay['head_z']) / 2), P(0, lay['Y0'], lay['head_z']), 'Chest')
    bone('Tail', P(0, lay['yB'], lay['spine_z']), P(0, lay['Y1'], lay['tail_z']), 'Hips')
    leg_top = lay['belly'] + 0.08 * H
    knee = leg_top * 0.48
    for k, (c, r) in lay['legs'].items():
        par = 'Chest' if k[0] == 'F' else 'Hips'
        bone('Leg' + k + '1', P(c.x, c.y, leg_top), P(c.x, c.y, knee), par)
        bone('Leg' + k + '2', P(c.x, c.y, knee), P(c.x, c.y, 0.0), 'Leg' + k + '1')
    bpy.ops.object.mode_set(mode='OBJECT')
    lay['leg_top'], lay['knee'] = leg_top, knee
    return arm


def _weights(ob, arm, lay):
    H, L = lay['H'], lay['L']
    fl = -1 if lay['flip'] else 1
    names = [b.name for b in arm.data.bones]
    groups = {n: ob.vertex_groups.new(name=n) for n in names if n != 'Root'}
    ramp = lambda x: max(0.0, min(1.0, x))
    for v in ob.data.vertices:
        p = Vector((v.co.x, v.co.y * fl, v.co.z))
        w = {}
        best, bd = None, 9e9
        for k, (c, r) in lay['legs'].items():
            d = ((p.x - c.x) ** 2 + (p.y - c.y) ** 2) ** 0.5 / r
            if d < bd:
                best, bd = k, d
        wl = ramp((lay['leg_top'] - p.z) / (0.12 * H) + 0.5) * ramp(1.8 - bd)
        if wl > 0:
            u = ramp((p.z - (lay['knee'] - 0.05 * H)) / (0.1 * H))
            w['Leg' + best + '1'] = wl * u
            w['Leg' + best + '2'] = wl * (1 - u)
        rest = 1 - wl
        wh = ramp((lay['yF'] - 0.04 * L - p.y) / (0.06 * L)) * ramp((p.z - lay['belly'] * 0.6) / (0.1 * H))
        wt = ramp((p.y - (lay['yB'] + 0.06 * L)) / (0.05 * L)) * ramp((p.z - lay['belly'] * 0.6) / (0.1 * H))
        w['Head'] = rest * wh
        w['Tail'] = rest * wt * (1 - wh)
        r2 = rest * (1 - wh) * (1 - wt)
        f = ramp((lay['yB'] - p.y) / max(1e-6, lay['yB'] - lay['yF']))   # 뒤 0 → 앞 1
        w['Chest'] = r2 * f
        w['Hips'] = r2 * (1 - f)
        tot = sum(w.values()) or 1.0
        for n, x in w.items():
            if x > 1e-4:
                groups[n].add([v.index], x / tot, 'REPLACE')
    ob.parent = arm
    m = ob.modifiers.new('Armature', 'ARMATURE')
    m.object = arm


# ---------------------------------------------------------------- 동작(시간 함수) — 회전은 armature 축 기준(축, 도)
X, Y, Z = Vector((1, 0, 0)), Vector((0, 1, 0)), Vector((0, 0, 1))


def _gait(t, amp, phases, knee, bob, pitch=0.0):
    """다리 흔들기 한 장면. phases = {다리: 위상}. 앞으로 내딛기 = X 축 음(-Y 가 앞)."""
    r = {}
    for k, ph in phases.items():
        a = math.sin(2 * math.pi * (t + ph))
        r['Leg' + k + '1'] = [(X, -amp * a)]
        lift = max(0.0, math.cos(2 * math.pi * (t + ph)))                     # 앞으로 나가는 반 주기에 접는다
        r['Leg' + k + '2'] = [(X, (knee if k[0] == 'F' else -knee) * lift)]
    r['_loc'] = Vector((0, 0, bob * abs(math.sin(2 * math.pi * t * 2))))
    if pitch:
        r['Hips'] = [(X, pitch * math.sin(2 * math.pi * t))]
    return r


def actions(lay):
    H, L = lay['H'], lay['L']
    D = {}
    D['Idle'] = (True, 48, lambda t: {'_loc': Vector((0, 0, 0.008 * H * math.sin(2 * math.pi * t))),
                                    'Head': [(Z, 8 * math.sin(2 * math.pi * t)), (X, 3 * math.sin(4 * math.pi * t))],
                                    'Tail': [(Z, 10 * math.sin(2 * math.pi * t))]})
    walk = {'FL': 0.0, 'BR': 0.0, 'FR': 0.5, 'BL': 0.5}
    D['Walk'] = (True, 24, lambda t: {**_gait(t, 26, walk, 40, 0.02 * H),
                                    'Head': [(X, 4 * math.sin(4 * math.pi * t))], 'Tail': [(Z, 12 * math.sin(2 * math.pi * t))]})
    run = {'FL': 0.0, 'FR': 0.08, 'BL': 0.5, 'BR': 0.58}
    D['Run'] = (True, 14, lambda t: {**_gait(t, 34, run, 55, 0.05 * H, pitch=5),
                                   'Head': [(X, -6 * math.sin(2 * math.pi * t))], 'Tail': [(X, 15 * math.sin(2 * math.pi * t))]})

    def attack(t):                                 # 웅크렸다(0~.35) 덮친다(.35~.55) 돌아온다
        if t < 0.35:
            k = t / 0.35
            return {'_loc': Vector((0, 0.05 * L * k, -0.04 * H * k)), 'Head': [(X, 12 * k)],
                    'LegFL1': [(X, 15 * k)], 'LegFR1': [(X, 15 * k)], 'LegBL1': [(X, -10 * k)], 'LegBR1': [(X, -10 * k)]}
        if t < 0.55:
            k = (t - 0.35) / 0.2
            return {'_loc': Vector((0, (0.05 - 0.17 * k) * L, (-0.04 + 0.09 * k) * H)), 'Head': [(X, 12 - 32 * k)],
                    'LegFL1': [(X, 15 - 55 * k)], 'LegFR1': [(X, 15 - 50 * k)], 'LegBL1': [(X, -10 + 40 * k)], 'LegBR1': [(X, -10 + 40 * k)],
                    'Hips': [(X, -8 * k)]}
        k = 1 - (t - 0.55) / 0.45
        return {'_loc': Vector((0, -0.12 * L * k, 0.05 * H * k)), 'Head': [(X, -20 * k)],
                'LegFL1': [(X, -40 * k)], 'LegFR1': [(X, -35 * k)], 'LegBL1': [(X, 30 * k)], 'LegBR1': [(X, 30 * k)], 'Hips': [(X, -8 * k)]}
    D['Attack'] = (False, 24, attack)
    D['Hit'] = (False, 14, lambda t: (lambda k: {'_loc': Vector((0, 0.05 * L * k, 0)), 'Hips': [(Y, 8 * k), (X, 6 * k)],
                                                 'Head': [(X, 18 * k), (Z, 10 * k)]})(math.sin(math.pi * min(1.0, t * 1.4))))

    def death(t):                                  # 비틀(0~.3) 옆으로 쓰러져(.3~.7) 다리 늘어짐
        k = max(0.0, min(1.0, (t - 0.15) / 0.55))
        e = k * k * (3 - 2 * k)
        W = 0.5 * H
        return {'_rot': [(Y, 88 * e)], '_loc': Vector((0, 0, W * 0.55 * e)), 'Head': [(X, 25 * e)],
                'LegFL1': [(X, -20 * e)], 'LegBL1': [(X, 20 * e)], 'LegFR1': [(X, -10 * e)], 'LegBR1': [(X, 12 * e)],
                'Tail': [(Z, 20 * e)]}
    D['Death'] = (False, 36, death)

    def special(t):                                # 앞발 들고 포효
        k = math.sin(math.pi * t)
        return {'Hips': [(X, -22 * k)], 'Head': [(X, -20 * k)], 'LegFL1': [(X, -30 * k)], 'LegFR1': [(X, -25 * k)],
                'LegFL2': [(X, 40 * k)], 'LegFR2': [(X, 40 * k)], 'LegBL1': [(X, 18 * k)], 'LegBR1': [(X, 18 * k)],
                'Tail': [(X, -15 * k)]}
    D['Special'] = (False, 30, special)
    return D


# ---------------------------------------------------------------- 새·벌레 — 모양이 제각각이라 무게는 "가까운 뼈"(거리⁻⁴, 셋까지)
def _near_weights(ob, arm, skip=('Root',)):
    segs = []
    for b in arm.data.bones:
        if b.name not in skip:
            segs.append((b.name, b.head_local.copy(), b.tail_local.copy()))
    groups = {n: ob.vertex_groups.new(name=n) for n, h, t in segs}
    for v in ob.data.vertices:
        p = v.co
        ds = []
        for n, h, t in segs:
            ab = t - h
            u = max(0.0, min(1.0, (p - h).dot(ab) / max(1e-9, ab.length_squared)))
            ds.append((((h + ab * u) - p).length, n))
        ds.sort()
        ws = [(1.0 / (d + 1e-6) ** 4, n) for d, n in ds[:3]]
        tot = sum(w for w, n in ws)
        for w, n in ws:
            if w / tot > 0.02:
                groups[n].add([v.index], w / tot, 'REPLACE')
    ob.parent = arm
    m = ob.modifiers.new('Armature', 'ARMATURE')
    m.object = arm


def _new_arm():
    arm_d = bpy.data.armatures.new('CreatureArmature')
    arm = bpy.data.objects.new('CreatureArmature', arm_d)
    bpy.context.scene.collection.objects.link(arm)
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.mode_set(mode='EDIT')
    E = arm_d.edit_bones

    def bone(n, h, t, parent=None):
        b = E.new(n)
        b.head, b.tail = Vector(h), Vector(t)
        b.align_roll(Vector((0, 0, 1)) if abs((b.tail - b.head).normalized().z) < 0.9 else Vector((0, -1, 0)))
        if parent:
            b.parent = E[parent]
        return b
    return arm, bone


def _pct(xs, q):
    xs = sorted(xs)
    return xs[min(len(xs) - 1, max(0, int(q * (len(xs) - 1))))]


def bird_rig(ob):
    V = [v.co.copy() for v in ob.data.vertices]
    z0, H = min(v.z for v in V), max(v.z for v in V)
    Hh = H - z0
    Y0, Y1 = min(v.y for v in V), max(v.y for v in V)
    L = Y1 - Y0
    xm = max(abs(v.x) for v in V)
    leg_top = z0 + 0.06 * Hh                     # 몸 밑 = 아래에서 위로 가며 폭이 처음 넓어지는 높이
    for k in range(1, 18):
        zb = z0 + Hh * k / 20
        sl = [abs(v.x) for v in V if abs(v.z - zb) < Hh * 0.025]
        if sl and max(sl) > 0.6 * xm:
            leg_top = zb
            break
    body = [v for v in V if v.z > leg_top and Y0 + 0.2 * L < v.y < Y1 - 0.2 * L] or V
    zc = sum(v.z for v in body) / len(body)
    yf, yb = _pct([v.y for v in body], 0.15), _pct([v.y for v in body], 0.85)
    xb = _pct([abs(v.x) for v in body], 0.9)
    top = [v for v in V if v.z > H - 0.15 * Hh]
    hc = Vector((0, sum(v.y for v in top) / len(top), sum(v.z for v in top) / len(top)))
    hz = [v for v in V if v.z > hc.z - 0.1 * Hh]
    tip = min(hz, key=lambda v: v.y)
    back = max(V, key=lambda v: v.y if v.z < H - 0.3 * Hh else -9e9)
    low = [v for v in V if v.z < leg_top and v.y < Y0 + 0.75 * L]
    arm, bone = _new_arm()
    yc = sum(v.y for v in low) / len(low) if low else (yf + yb) / 2
    bone('Root', (0, yc, z0), (0, yc, z0 + 0.1 * Hh))
    bone('Body', (0, yb, zc), (0, yf, zc), 'Root')
    nb = Vector((0, yf, zc + 0.3 * (hc.z - zc)))
    bone('Neck', nb, hc, 'Body')
    bone('Head', hc, (0, tip.y, tip.z), 'Neck')
    bone('Tail', (0, yb, zc), (0, back.y, back.z), 'Body')
    for s, sx in (('L', 1), ('R', -1)):
        bone('Wing' + s, (sx * 0.75 * xb, yf + 0.15 * (yb - yf), zc + 0.25 * (hc.z - zc)), (sx * 0.85 * xb, yb + 0.2 * (back.y - yb), zc), 'Body')
        g = [v for v in low if v.x * sx > 0] or low
        if g:
            cx, cy = sum(v.x for v in g) / len(g), sum(v.y for v in g) / len(g)
            km = z0 + 0.5 * (leg_top - z0)
            bone('Leg' + s + '1', (cx, cy, leg_top + 0.05 * Hh), (cx, cy, km), 'Body')
            bone('Leg' + s + '2', (cx, cy, km), (cx, cy, z0), 'Leg' + s + '1')
    bpy.ops.object.mode_set(mode='OBJECT')
    _near_weights(ob, arm)
    lay = dict(H=Hh, L=L, flip=False)

    def acts():
        D = {}
        legs = lambda t, a: {'LegL1': [(X, -a * math.sin(2 * math.pi * t))], 'LegR1': [(X, a * math.sin(2 * math.pi * t))]}
        wing = lambda s, spread, flap: [(Z, -spread if s == 'L' else spread), (Y, -flap if s == 'L' else flap)]
        D['Idle'] = (True, 48, lambda t: {'Head': [(Z, 18 * math.sin(2 * math.pi * t))], 'Tail': [(X, 6 * math.sin(4 * math.pi * t))],
                                        '_loc': Vector((0, 0, 0.01 * Hh * math.sin(2 * math.pi * t)))})
        D['Walk'] = (True, 20, lambda t: {**legs(t, 28), '_loc': Vector((0, 0, 0.03 * Hh * abs(math.sin(2 * math.pi * t)))),
                                        'Neck': [(X, -10 * math.sin(4 * math.pi * t))], 'Body': [(Y, 5 * math.sin(2 * math.pi * t))]})
        D['Run'] = (True, 8, lambda t: {'WingL': wing('L', 70, 45 * math.sin(2 * math.pi * t)), 'WingR': wing('R', 70, 45 * math.sin(2 * math.pi * t)),
                                      'LegL1': [(X, 45)], 'LegR1': [(X, 45)], 'Body': [(X, -10)],
                                      '_loc': Vector((0, 0, 0.25 * Hh + 0.04 * Hh * math.sin(2 * math.pi * t)))})

        def attack(t):                           # 쪼기
            k = math.sin(math.pi * min(1.0, t / 0.5)) if t < 0.5 else 0.0
            return {'Neck': [(X, 35 * k)], 'Head': [(X, 20 * k)], 'Body': [(X, 12 * k)],
                    'WingL': wing('L', 40 * k, 20 * k), 'WingR': wing('R', 40 * k, 20 * k), '_loc': Vector((0, -0.08 * L * k, 0))}
        D['Attack'] = (False, 18, attack)
        D['Hit'] = (False, 14, lambda t: (lambda k: {'Neck': [(X, -25 * k)], 'Body': [(X, -10 * k)], 'WingL': wing('L', 55 * k, 35 * k),
                                                     'WingR': wing('R', 55 * k, 35 * k), '_loc': Vector((0, 0.06 * L * k, 0.03 * Hh * k))})(math.sin(math.pi * min(1.0, t * 1.3))))

        def death(t):
            k = max(0.0, min(1.0, (t - 0.1) / 0.6))
            e = k * k * (3 - 2 * k)
            return {'_rot': [(Y, 85 * e)], '_loc': Vector((0, 0, 0.25 * Hh * e)), 'Neck': [(X, 30 * e)], 'WingL': wing('L', 30 * e, -10 * e),
                    'WingR': wing('R', 50 * e, 20 * e), 'LegL1': [(X, -30 * e)], 'LegR1': [(X, -15 * e)]}
        D['Death'] = (False, 30, death)
        D['Special'] = (False, 32, lambda t: (lambda k, f: {'WingL': wing('L', 80 * k, 50 * f * k), 'WingR': wing('R', 80 * k, 50 * f * k),
                                                            'Neck': [(X, -15 * k)], '_loc': Vector((0, 0, 0.08 * Hh * k))})(
            math.sin(math.pi * t), math.sin(2 * math.pi * t * 4)))
        return D
    lay['acts'] = acts
    return arm, lay


def worm_rig(ob, n=5):
    """땅에서 솟은 벌레 — 높이를 n 띠로 나눠 띠마다 가운데 점을 이은 등뼈."""
    V = [v.co.copy() for v in ob.data.vertices]
    z0, H = min(v.z for v in V), max(v.z for v in V)
    Hh = H - z0
    pts = []
    for k in range(n + 1):
        zb = z0 + Hh * k / n
        sl = [v for v in V if abs(v.z - zb) < Hh / n * 0.6] or V
        pts.append(Vector((sum(v.x for v in sl) / len(sl), sum(v.y for v in sl) / len(sl), zb)))
    arm, bone = _new_arm()
    bone('Root', (pts[0].x, pts[0].y, z0), (pts[0].x, pts[0].y, z0 + 0.05 * Hh))
    prev = 'Root'
    for k in range(n):
        bone('Seg%d' % (k + 1), pts[k], pts[k + 1], prev)
        prev = 'Seg%d' % (k + 1)
    bpy.ops.object.mode_set(mode='OBJECT')
    _near_weights(ob, arm)
    lay = dict(H=Hh, L=Hh, flip=False)
    segs = ['Seg%d' % (k + 1) for k in range(n)]

    def wave(t, ax, amp, ph=0.25):
        return {s: [(ax, amp * math.sin(2 * math.pi * (t - i * ph)))] for i, s in enumerate(segs)}

    def acts():
        D = {}
        D['Idle'] = (True, 48, lambda t: {s: [(X, 5 * math.sin(2 * math.pi * (t - i * 0.2))), (Z, 4 * math.cos(2 * math.pi * (t - i * 0.2)))] for i, s in enumerate(segs)})
        D['Walk'] = (True, 24, lambda t: wave(t, Z, 12))
        D['Run'] = (True, 12, lambda t: wave(t, Z, 18))

        def attack(t):                           # 뒤로 젖혔다 앞으로 들이받기
            k = math.sin(math.pi * min(1.0, t / 0.6)) if t < 0.6 else 0.0
            back = 1 - min(1.0, t / 0.3)
            return {s: [(X, (18 * k - 10 * back * (1 - k)) * (i + 1) / n)] for i, s in enumerate(segs)}
        D['Attack'] = (False, 18, attack)
        D['Hit'] = (False, 12, lambda t: (lambda k: {s: [(X, -14 * k * (i + 1) / n), (Z, 8 * k)] for i, s in enumerate(segs)})(math.sin(math.pi * min(1.0, t * 1.3))))
        D['Death'] = (False, 30, lambda t: (lambda e: {s: [(X, 28 * e * (1 if i else 0.6)), (Z, 10 * e)] for i, s in enumerate(segs)})(
            (lambda k: k * k * (3 - 2 * k))(max(0.0, min(1.0, t / 0.7)))))
        D['Special'] = (False, 36, lambda t: {s: [(Z, 30 * math.sin(2 * math.pi * (2 * t - i * 0.15)) * math.sin(math.pi * t))] for i, s in enumerate(segs)})
        return D
    lay['acts'] = acts
    return arm, lay


def bake(arm, lay):
    fl = -1 if lay['flip'] else 1
    bpy.context.scene.render.fps = FPS
    arm.animation_data_create()
    made = []
    for name, (loop, n, fn) in (lay['acts']() if 'acts' in lay else actions(lay)).items():
        act = bpy.data.actions.new(name)
        act.use_fake_user = True
        arm.animation_data.action = act
        frames = range(0, n + 1)
        for f in frames:
            t = (f % n) / n if loop else f / n
            pose = fn(t)
            for pb in arm.pose.bones:
                pb.rotation_mode = 'QUATERNION'
                pb.rotation_quaternion = Quaternion()
                pb.location = Vector()
            for bn, rots in pose.items():
                if bn.startswith('_'):
                    continue
                pb = arm.pose.bones.get(bn)
                if pb is None:
                    continue
                R = Quaternion()
                for ax, deg in rots:
                    R = Quaternion(ax, math.radians(deg * (fl if ax is not Y else 1))) @ R   # y 거울: X·Z 축 회전은 부호가 바뀌고 Y 축은 그대로
                B = pb.bone.matrix_local.to_3x3()
                pb.rotation_quaternion = (B.inverted() @ R.to_matrix() @ B).to_quaternion()
            root = arm.pose.bones['Root']
            Rr = Quaternion()
            for ax, deg in pose.get('_rot', []):
                Rr = Quaternion(ax, math.radians(deg * (fl if ax is not Y else 1))) @ Rr
            B = root.bone.matrix_local.to_3x3()
            root.rotation_quaternion = (B.inverted() @ Rr.to_matrix() @ B).to_quaternion()
            loc = pose.get('_loc', Vector())
            root.location = B.inverted() @ Vector((loc.x, loc.y * fl, loc.z))
            for pb in arm.pose.bones:
                pb.keyframe_insert('rotation_quaternion', frame=f, group=pb.name)
            root.keyframe_insert('location', frame=f, group='Root')
        made.append(act)
    for act in made:                               # 내보내기가 동작마다 따로 고르도록 NLA 트랙에 하나씩
        tr = arm.animation_data.nla_tracks.new()
        tr.name = act.name
        tr.strips.new(act.name, 0, act)
    arm.animation_data.action = None
    return made


def main():
    src, out, kind = _args()
    ob = _load(src)
    if kind == 'bird':
        arm, lay = bird_rig(ob)
    elif kind == 'worm':
        arm, lay = worm_rig(ob)
    else:
        lay = _quad_layout([v.co.copy() for v in ob.data.vertices])
        arm = _build_arm(lay)
        _weights(ob, arm, lay)
    made = bake(arm, lay)
    os.makedirs(os.path.dirname(os.path.abspath(out)), exist_ok=True)
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.export_scene.gltf(filepath=os.path.abspath(out), export_format='GLB', export_animations=True,
                              export_animation_mode='NLA_TRACKS', export_skins=True, export_apply=False)
    print('CREATURE_RIG', os.path.basename(src), kind, 'bones', [b.name for b in arm.data.bones], 'acts', [a.name for a in made], 'kb', os.path.getsize(out) // 1024)


main()
