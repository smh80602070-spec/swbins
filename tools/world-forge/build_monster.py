"""world-forge 몬스터·보스 몸 (K-0043 재작업) — 유기체는 Skin 모디파이어(뼈대 그래프 → 이어진 매끈한 몸), 기계는 모따기 상자. 재질만 Poly Haven CC0 사진(툰 256px), 형태는 전부 코드.

  blender -b --factory-startup -P tools/world-forge/build_monster.py -- --id mon_quad_01 --out <절대>/mon_quad_01.glb [--style toon]
  blender -b --factory-startup -P tools/world-forge/build_monster.py -- --all --out-dir <절대 폴더> [--style toon]
  blender -b --factory-startup -P tools/world-forge/build_monster.py -- --list

계통 5 × 변형 4 = 20 + 보스 12 = 32종. id 는 `mon_<계통>_<nn>`·`boss_<nn>`(원작 몬스터 이름·모양 모사 없음 — 일반 계통 이름만).
  quad(네발 짐승) · wing(날개) · serp(뱀형) · cons(기계·구조물) · spir(정령)
변형 4 는 번호마다 일부러 다른 몸(늑대형·멧돼지형·고양이형·황소형 …)이고, 같은 번호 안의 작은 차이(비율·피부·무늬)만 id 씨앗으로 정한다.
원점 = 발 밑 가운데, 얼굴이 Blender -y(glTF +z) 쪽, 단위 m. 한 변 약 1~1.6m(보스는 ×2.8~3.4). 동작은 뼈 없이 `tools/glb-compress/creature_fill.mjs`
(몸 루트 노드 변환 키프레임)로 7칸을 채운다 — 부품이 한 메시라 뼈 리깅 없이 쓴다. 모든 레시피는 1배 크기로 짓고 마지막에 배율을 곱한다.

K-0080 종별 몸: `-- --species tools/world-forge/data/monster_species.json --out-dir <절대>` → 종마다 `mon_sp_<종 id>.glb`.
표의 꼴(계통·변형, 보스면 배율·장식)에 종 색 3개(몸·둘째·빛)를 구워 넣는다(전역 PAL) — 몸 모양 난수 순서는 같은 꼴의 기본 몸과 같다.
네발 변형 4 = 곰, 5 = 거북(등딱지)은 종별 몸에만 쓴다(기본 32벌은 그대로).
"""
import json
import math
import os
import random
import sys

import bmesh
import bpy
from mathutils import Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import build_prop as BP  # noqa: E402
import wf_common as W  # noqa: E402
from build_prop import tube, obox, A, arg  # noqa: E402

BP.TRIS_MAX = 4500
BP.GENERATOR = 'tools/world-forge/build_monster.py'
PAL = None          # K-0080 종 색 (몸, 둘째, 빛) 헥스 — None 이면 계통 기본 색
BASE = 0.6          # 레시피는 크게(늑대 길이 ~3m) 짓고 마지막에 이 배율로 줄인다
SKIN_TRIS = 2300      # Skin 몸에 주는 삼각형 예산(Decimate 비율을 여기에 맞춘다) — 나머지는 뿔·눈·가시

# 계통별 피부 후보(재질, 타일, 색) — 변형마다 하나씩, 보스는 따로
SKINS = [
    ('forest_ground_04', 1.2, '#5a6b3a'), ('dry_ground_01', 1.2, '#8a6a44'), ('cliff_side', 1.5, '#6b5a50'), ('aerial_rocks_02', 1.5, '#4f5663'),
    ('brown_mud', 1.2, '#6a4a34'), ('coast_sand_rocks_02', 1.5, '#a89a80'), ('grey_plaster', 1.2, '#5d6b7a'), ('snow_02', 1.5, '#cfd8e0'),
]
EYES = ['#ffd24a', '#ff4a3a', '#6af0ff', '#b86aff']


# ---------------------------------------------------------------- 도우미

def _shade(h, k):
    h = h.lstrip('#')
    v = [min(255, int(int(h[i:i + 2], 16) * k)) for i in (0, 2, 4)]
    return '#%02x%02x%02x' % tuple(v)


def blob(M, c, r, slot, nu=10, nv=6, tile=1.0):
    """타원체 (중심 c, 반지름 r=(x,y,z)) — 위·아래 극은 삼각형 부채."""
    cx, cy, cz = c
    rx, ry, rz = r

    def pt(i, j):
        th = math.pi * j / nv
        ph = 2 * math.pi * (i % nu) / nu
        return (cx + rx * math.sin(th) * math.cos(ph), cy + ry * math.sin(th) * math.sin(ph), cz + rz * math.cos(th))
    for j in range(nv):
        for i in range(nu):
            u0, u1 = i / nu * 2 * math.pi * max(rx, ry) / tile, (i + 1) / nu * 2 * math.pi * max(rx, ry) / tile
            v0, v1 = j / nv * math.pi * rz / tile, (j + 1) / nv * math.pi * rz / tile
            if j == 0:
                M.face([pt(i, 0), pt(i + 1, 1), pt(i, 1)], [((u0 + u1) / 2, v0), (u1, v1), (u0, v1)], slot)
            elif j == nv - 1:
                M.face([pt(i, nv), pt(i, nv - 1), pt(i + 1, nv - 1)], [((u0 + u1) / 2, v1), (u0, v0), (u1, v0)], slot)
            else:
                M.face([pt(i, j), pt(i + 1, j), pt(i + 1, j + 1), pt(i, j + 1)], [(u0, v0), (u1, v0), (u1, v1), (u0, v1)], slot)


def cone(M, base, tip, r, slot, n=6):
    tube(M, base, tip, r, 0.0, slot, 1.0, n, caps=True)


def horn(M, base, d0, bend, length, r, slot, n=6, segs=4):
    """굽은 뿔 — base 에서 d0 방향으로 시작해 bend 쪽으로 휘며 끝이 뾰족해지는 마디 사슬."""
    base, d0, bend = Vector(base), Vector(d0).normalized(), Vector(bend)
    prev = base
    for i in range(1, segs + 1):
        t = i / segs
        p = base + d0 * (length * t) + bend * (length * t * t)
        r0, r1 = r * (1 - (i - 1) / segs), (r * (1 - t) if i < segs else 0.0)
        tube(M, prev, p, r0, r1, slot, 1.0, n, caps=(i == 1))
        prev = p


def eyes(M, eye, c, x, r):
    for s in (-1, 1):
        blob(M, (c[0] + s * x, c[1], c[2]), (r, r * 0.8, r), eye, 6, 4)


def bbox(M, c, size, slot, bev=0.025, tile=1.0):
    """모따기 상자 — 중심 c, 크기 size(x,y,z). 면마다 위치 투영 UV."""
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        v.co = Vector((v.co.x * size[0], v.co.y * size[1], v.co.z * size[2]))
    if bev > 0:
        bmesh.ops.bevel(bm, geom=bm.edges[:], offset=min(bev, min(size) * 0.45), segments=1, affect='EDGES')
    bm.normal_update()
    c = Vector(c)
    for f in bm.faces:
        pts = [c + v.co for v in f.verts]
        n = f.normal
        ax = max(range(3), key=lambda i: abs(n[i]))
        uvs = [((p.y, p.z) if ax == 0 else (p.x, p.z) if ax == 1 else (p.x, p.y)) for p in pts]
        M.face(pts, [(a / tile, b / tile) for a, b in uvs], slot)
    bm.free()


class Rig:
    """Skin 용 뼈대 그래프 — 점(이름·위치·굵기)과 부모 이음."""

    def __init__(self):
        self.V, self.E, self.R, self.nm = [], [], [], {}

    def add(self, name, p, r, parent=None):
        self.V.append(tuple(p))
        self.R.append(r if isinstance(r, tuple) else (r, r))
        i = len(self.V) - 1
        if parent is not None:
            self.E.append((self.nm[parent], i))
        self.nm[name] = i
        return Vector(p)

    def p(self, name):
        return Vector(self.V[self.nm[name]])

    def chain(self, prefix, parent, pts, radii):
        prev = parent
        for i, (p, r) in enumerate(zip(pts, radii)):
            self.add(f'{prefix}{i}', p, r, prev)
            prev = f'{prefix}{i}'


def skin_into(C, rig, pick, ground=True, tile=1.1):
    """Rig → Skin + Subsurf 2 + Decimate(예산) → C.M 에 매끈한 면으로 옮긴다. pick(중심, 법선) → 재질 칸. 반환: 더한 면 수."""
    M = C.M
    me = bpy.data.meshes.new('skin_tmp')
    me.from_pydata(rig.V, rig.E, [])
    ob = bpy.data.objects.new('skin_tmp', me)
    bpy.context.scene.collection.objects.link(ob)
    bpy.context.view_layer.objects.active = ob
    ob.select_set(True)
    sk = ob.modifiers.new('skin', 'SKIN')
    sk.use_smooth_shade = True
    sk.branch_smoothing = 0.8
    layer = me.skin_vertices[0]
    for i, r in enumerate(rig.R):
        layer.data[i].radius = r
    layer.data[0].use_root = True
    ss = ob.modifiers.new('sub', 'SUBSURF')
    ss.levels = ss.render_levels = 2
    bpy.ops.object.modifier_apply(modifier='skin')
    bpy.ops.object.modifier_apply(modifier='sub')
    tris = sum(len(p.vertices) - 2 for p in me.polygons)
    if tris > SKIN_TRIS:
        dm = ob.modifiers.new('dec', 'DECIMATE')
        dm.ratio = SKIN_TRIS / tris
        bpy.ops.object.modifier_apply(modifier='dec')
    zmin = min(v.co.z for v in me.vertices) if ground else 0.0
    vs = [M.bm.verts.new(v.co - Vector((0, 0, zmin))) for v in me.vertices]
    n = 0
    for poly in me.polygons:
        try:
            f = M.bm.faces.new([vs[i] for i in poly.vertices])
        except ValueError:
            continue
        c = Vector(poly.center) - Vector((0, 0, zmin))
        nr = Vector(poly.normal)
        f.material_index = pick(c, nr)
        ax = max(range(3), key=lambda i: abs(nr[i]))
        for l in f.loops:
            co = l.vert.co
            uv = (co.y, co.z) if ax == 0 else (co.x, co.z) if ax == 1 else (co.x, co.y)
            l[M.uv].uv = (uv[0] / tile, uv[1] / tile)
        n += 1
    bpy.data.objects.remove(ob)
    bpy.data.meshes.remove(me)
    C.skin_faces = n
    return zmin


def make_pick(rnd, body, dark, belly, glow=None, deco=None, top=1.0, foot=0.16, pattern=None, bellyz=-0.28):
    """면 법선·위치로 재질 칸 배정 — 배(아래)·발(바닥)·무늬(줄·점·안장)·보스 발광 띠."""
    pattern = pattern or rnd.choice(['plain', 'stripes', 'spots', 'saddle'])
    ph, fr = rnd.uniform(0, 6.28), rnd.uniform(7.5, 11.0)
    cell = rnd.uniform(0.16, 0.24)
    seed = rnd.randint(1, 99999)

    def pick(c, n):
        if deco == 'runes' and glow is not None and n.z > 0.25 and math.sin(c.y * 10 + ph) > 0.84:
            return glow
        if c.z < foot:
            return dark
        if n.z < bellyz:
            return belly
        if pattern == 'stripes' and n.z > -0.1 and math.sin(c.y * fr + ph) > 0.55:
            return dark
        if pattern == 'spots' and n.z > 0.0:
            h = hash((int(c.x / cell) * 73856093) ^ (int(c.y / cell) * 19349663) ^ (int(c.z / cell) * 83492791) ^ seed) % 100
            if h < 26:
                return dark
        if pattern == 'saddle' and c.z > top * 0.80 and n.z > 0.25:
            return dark
        return body
    return pick


def mats(C, rnd, skin=None, boss=False, deco=None):
    sk = skin or rnd.choice(SKINS)
    body = C.s(sk[0], sk[1], sk[2], gain=1.5)
    dark = C.s(sk[0], sk[1], _shade(sk[2], 0.6), gain=1.15)
    belly = C.s(sk[0], sk[1], PAL[1] if PAL else _shade(sk[2], 1.35), gain=1.5)
    ec = rnd.choice(EYES)
    eye = C.s('white_stucco', 1.0, PAL[2] if PAL else ec, gain=1.9)
    horn_m = C.s('coast_sand_rocks_02', 1.0, '#d8cdb0' if not boss else '#2e2a33')
    gc = rnd.choice(['#ff4a2a', '#ff9a2a', '#b86aff', '#4adfff']) if deco == 'runes' else None
    glow = C.s('white_stucco', 1.0, PAL[2] if PAL else gc, gain=2.1) if deco == 'runes' else None
    return body, dark, belly, eye, horn_m, glow


# ---------------------------------------------------------------- 네발 — 변형 0 늑대 · 1 멧돼지 · 2 고양이 · 3 황소
QUAD = [
    dict(bl=0.50, bw=0.23, bh=0.23, lh=0.40, nl=0.26, hr=0.16, sn=0.26, leg='digi', tail=0.85, tup=0.30, ear='tri', horn=None, pat='stripes'),
    dict(bl=0.46, bw=0.34, bh=0.32, lh=0.25, nl=0.02, hr=0.25, sn=0.15, leg='str', tail=0.30, tup=-0.1, ear='small', horn='tusk', pat='saddle'),
    dict(bl=0.55, bw=0.21, bh=0.21, lh=0.30, nl=0.20, hr=0.15, sn=0.09, leg='digi', tail=1.05, tup=0.40, ear='tuft', horn=None, pat='spots'),
    dict(bl=0.50, bw=0.33, bh=0.33, lh=0.34, nl=0.10, hr=0.21, sn=0.15, leg='str', tail=0.50, tup=-0.15, ear='small', horn='bull', pat='plain'),
    # K-0080 종별 몸에만: 4 곰(굵은 몸·짧은 꼬리·둥근 귀) · 5 거북(낮은 몸·짧은 다리 + 등딱지)
    dict(bl=0.46, bw=0.38, bh=0.37, lh=0.28, nl=0.03, hr=0.23, sn=0.12, leg='str', tail=0.14, tup=0.05, ear='small', horn=None, pat='plain'),
    dict(bl=0.40, bw=0.34, bh=0.20, lh=0.15, nl=0.16, hr=0.15, sn=0.06, leg='str', tail=0.22, tup=0.0, ear='none', horn=None, pat='plain', shell=True),
]


def quad(C, rnd, v, boss=False, deco=None, skin=None):
    M = C.M
    body, dark, belly, eye, horn_m, glow = mats(C, rnd, skin, boss, deco)
    P = dict(QUAD[v])
    for key in ('bl', 'bw', 'bh', 'lh', 'nl', 'hr', 'sn', 'tail'):
        P[key] *= rnd.uniform(0.9, 1.12)
    bl, bw, bh, lh, nl, hr, sn = P['bl'], P['bw'], P['bh'], P['lh'], P['nl'], P['hr'], P['sn']
    zc = lh + bh * 0.8
    g = Rig()
    hump = 0.12 if P['horn'] == 'bull' else 0.0
    g.add('pel', (0, bl, zc), (bw * 0.9, bh * 0.9))
    g.add('mid', (0, 0, zc + 0.03), (bw, bh), 'pel')
    g.add('che', (0, -bl, zc + 0.07 + hump), (bw * 1.1, bh * 1.1 + hump * 0.5), 'mid')
    g.add('nk1', (0, -bl - 0.12 - nl * 0.4, zc + 0.14 + nl * 0.3), (bw * 0.62, bw * 0.62), 'che')
    g.add('nk2', (0, -bl - 0.20 - nl * 0.9, zc + 0.20 + nl * 0.6), (bw * 0.55, bw * 0.55), 'nk1')
    hp = Vector((0, -bl - 0.30 - nl - hr * 0.6, zc + 0.16 + nl * 0.6))
    g.add('hed', hp, (hr, hr * 0.92), 'nk2')
    sp = hp + Vector((0, -(hr + sn * 0.7), -hr * 0.30))
    g.add('sno', sp, (hr * 0.55, hr * 0.45), 'hed')
    g.add('jaw', hp + Vector((0, -(hr + sn * 0.35), -hr * 0.78)), (hr * 0.36, hr * 0.26), 'hed')
    # 꼬리
    tl = P['tail']
    g.chain('t', 'pel', [(0, bl + tl * 0.33, zc + 0.04 + P['tup'] * 0.2), (0, bl + tl * 0.66, zc + 0.04 + P['tup'] * 0.55), (0, bl + tl, zc + 0.04 + P['tup'])],
            [(0.11, 0.10), (0.08, 0.075), (0.045, 0.045) if v in (1, 3) else (0.035, 0.035)])
    # 다리 넷
    for sx in (-1, 1):
        x = sx * bw * 0.8
        for tag, yy, root in (('f', -bl + 0.04, 'che'), ('b', bl - 0.03, 'pel')):
            g.add(f'{tag}h{sx}', (x, yy, zc - bh * 0.35), (0.12, 0.12), root)
            if P['leg'] == 'digi' and tag == 'b':
                g.add(f'{tag}k{sx}', (x * 1.1, yy - 0.12, lh * 0.72), (0.075, 0.075), f'{tag}h{sx}')
                g.add(f'{tag}c{sx}', (x * 1.08, yy + 0.08, lh * 0.34), (0.055, 0.055), f'{tag}k{sx}')
                g.add(f'{tag}f{sx}', (x * 1.05, yy + 0.04, 0.05), (0.055, 0.075), f'{tag}c{sx}')
            else:
                g.add(f'{tag}k{sx}', (x * 1.06, yy + (-0.03 if tag == 'f' else 0.02), lh * 0.55), (0.085, 0.08), f'{tag}h{sx}')
                g.add(f'{tag}f{sx}', (x * 1.05, yy, 0.05), (0.075, 0.095), f'{tag}k{sx}')
            g.add(f'{tag}p{sx}', (x * 1.05, yy - 0.10, 0.04), (0.05, 0.05), f'{tag}f{sx}')
    top = zc + bh * 1.1
    pick = make_pick(rnd, body, dark, belly, glow, deco, top=top, foot=0.15, pattern=P['pat'] if rnd.random() < 0.7 else 'plain')
    skin_into(C, g, pick)
    # 얼굴 — 눈·콧구멍·송곳니
    ey = hp + Vector((0, -hr * 0.58, hr * 0.25))
    eyes(M, eye, ey, hr * 0.62, 0.02 + 0.01 * hr / 0.2)
    for s in (-1, 1):
        blob(M, (s * hr * 0.2, sp.y - hr * 0.5, sp.z + hr * 0.12), (0.018, 0.014, 0.014), dark, 5, 3)
        cone(M, (s * hr * 0.3, sp.y - hr * 0.2, sp.z - hr * 0.3), (s * hr * 0.3, sp.y - hr * 0.3, sp.z - hr * 0.78), 0.022, horn_m, 4)
    # 귀·뿔
    for s in (-1, 1):
        eb = hp + Vector((s * hr * 0.6, hr * 0.25, hr * 0.7))
        if P['ear'] == 'tri':
            cone(M, eb, eb + Vector((s * hr * 0.5, 0.05, hr * 1.5)), hr * 0.38, body, 4)
        elif P['ear'] == 'tuft':
            cone(M, eb, eb + Vector((s * hr * 0.35, 0.02, hr * 1.1)), hr * 0.34, body, 4)
            cone(M, eb + Vector((0, 0, hr * 0.9)), eb + Vector((s * hr * 0.4, 0.0, hr * 1.7)), hr * 0.1, dark, 4)
        elif P['ear'] != 'none':
            blob(M, tuple(eb + Vector((s * hr * 0.2, 0, hr * 0.1))), (hr * 0.28, hr * 0.12, hr * 0.38), body, 6, 4)
        if P['horn'] == 'tusk':
            horn(M, tuple(hp + Vector((s * hr * 0.55, -hr * 1.05 - sn * 0.5, -hr * 0.5))), (s * 0.35, -0.6, 0.55), (s * 0.05, -0.1, 0.5), 0.3 + 0.1 * boss, 0.045, horn_m, 5, 4)
        elif P['horn'] == 'bull':
            horn(M, tuple(hp + Vector((s * hr * 0.75, hr * 0.15, hr * 0.55))), (s * 0.9, -0.1, 0.35), (-s * 0.25, -0.5, 0.55), 0.46 + 0.14 * boss, 0.062, horn_m, 6, 5)
    if v == 0 and (rnd.random() < 0.6 or boss):                             # 목덜미 갈기 가시
        for i in range(4):
            y = -bl - 0.1 - i * 0.12
            cone(M, (0, y, zc + 0.22 + i * 0.03 + bh * 0.3), (0, y + 0.06, zc + 0.5 + i * 0.03 + bh * 0.3), 0.045, dark, 4)
    if v == 2 or v == 1:
        pass
    if P.get('shell'):                                                       # 거북 등딱지 — 몸 위 낮은 돔 + 테두리 + 마디
        blob(M, (0, 0.02, zc + bh * 0.35), (bw * 1.75, bl * 1.55, bh * 1.55), dark, 14, 8)
        blob(M, (0, 0.02, zc + bh * 0.1), (bw * 1.9, bl * 1.68, bh * 0.45), belly, 14, 4)
        for i, (sx, sy) in enumerate(((0, -0.35), (0, 0.0), (0, 0.35), (-0.5, -0.18), (0.5, -0.18), (-0.5, 0.2), (0.5, 0.2))):
            blob(M, (sx * bw * 1.6, sy * bl * 1.6, zc + bh * 1.62 - abs(sx) * bh * 0.55), (bw * 0.42, bl * 0.34, bh * 0.22), body, 6, 3)
    if (rnd.random() < 0.55 or boss) and not P.get('shell'):                 # 등 가시
        n = rnd.randint(3, 5)
        for i in range(n):
            y = -bl * 0.6 + i * bl * 1.3 / max(1, n - 1)
            cone(M, (0, y, zc + bh * 0.85), (0, y + 0.05, zc + bh * 0.85 + rnd.uniform(0.12, 0.22)), 0.045, horn_m, 4)
    if P['tup'] < 0:                                                         # 꼬리 끝 술
        t3 = g.p('t2')
        blob(M, (0, t3.y + 0.04, t3.z - 0.01), (0.07, 0.1, 0.07), dark, 6, 4)
    spine = [g.p(n) + Vector((0, 0, g.R[g.nm[n]][1])) for n in ('che', 'mid', 'pel')]
    return {'head': (hp.x, hp.y, hp.z, hr), 'spine': spine, 'h': top}


# ---------------------------------------------------------------- 날개 — 0 새 · 1 박쥐 · 2 올빼미 · 3 비룡
def _membrane(M, pts, slot):
    """얇은 막(앞뒤 두 면, 삼각 부채)."""
    uv = [(p[0], p[2]) for p in pts]
    for i in range(1, len(pts) - 1):
        a, b, c = pts[0], pts[i], pts[i + 1]
        M.face([a, b, c], [uv[0], uv[i], uv[i + 1]], slot)
        M.face([a, c, b], [uv[0], uv[i + 1], uv[i]], slot)


def wing(C, rnd, v, boss=False, deco=None, skin=None):
    M = C.M
    body, dark, belly, eye, horn_m, glow = mats(C, rnd, skin, boss, deco)
    fat = v == 2
    memb = v in (1, 3)
    bl = rnd.uniform(0.28, 0.36) * (1.2 if v == 3 else 1.0)
    zc = rnd.uniform(0.36, 0.44) if v != 3 else rnd.uniform(0.42, 0.5)
    br = (0.27 if fat else 0.2 if v != 3 else 0.23) * rnd.uniform(0.92, 1.1)
    g = Rig()
    if v == 2:                                                               # 10-07 올빼미는 선 자세(골반 아래·가슴 위)
        g.add('pel', (0, bl * 0.3, zc - 0.02), (br * 0.95, br * 0.9))
        g.add('che', (0, -bl * 0.05, zc + br * 0.95), (br * 1.05, br), 'pel')
    else:
        g.add('pel', (0, bl, zc), (br * 0.85, br * 0.8))
        g.add('che', (0, -bl * 0.4, zc + 0.04), (br * 1.1, br * 1.05), 'pel')
    nl = (0.1 if fat else 0.2) * rnd.uniform(0.9, 1.15) + (0.1 if v == 3 else 0)
    g.add('nk', (0, -bl * 0.12, zc + br * 1.6) if v == 2 else (0, -bl * 0.75 - 0.04, zc + 0.12 + nl * 0.7), (br * 0.55, br * 0.55), 'che')
    hr = (0.17 if fat else 0.12) * rnd.uniform(0.92, 1.1)
    hp = Vector((0, -bl * 0.2, zc + br * 1.95)) if v == 2 else Vector((0, -bl * 0.85 - 0.08, zc + 0.14 + nl * 1.1))
    g.add('hed', hp, (hr, hr * 0.95), 'nk')
    if v in (0, 2):                                                          # 부리
        bk = 0.10 if v == 0 else 0.07
        g.add('bk', hp + Vector((0, -(hr + bk * 0.7), -hr * 0.25)), (hr * 0.32, hr * 0.28), 'hed')
    else:
        g.add('sn', hp + Vector((0, -(hr + 0.07), -hr * 0.3)), (hr * 0.5, hr * 0.4), 'hed')
    tl = rnd.uniform(0.3, 0.5) * (1.9 if v == 3 else 1.0)
    g.chain('t', 'pel', [(0, bl + tl * 0.5, zc - 0.03), (0, bl + tl, zc - 0.07 - (0.05 if v == 3 else 0))], [(br * 0.5, br * 0.45), (0.035, 0.035) if v == 3 else (br * 0.3, 0.02)])
    for s in (-1, 1):                                                        # 다리 둘 + 발톱
        g.add(f'lh{s}', (s * br * 0.7, bl * 0.15, zc - br * 0.6), (0.07, 0.07), 'pel')
        g.add(f'lk{s}', (s * br * 0.75, bl * 0.05, zc * 0.4), (0.045, 0.045), f'lh{s}')
        g.add(f'lf{s}', (s * br * 0.85, bl * 0.0, 0.05), (0.06, 0.07), f'lk{s}')
    # 날개 뼈대(굵은 팔) — 막이든 깃이든 같은 팔
    span = rnd.uniform(0.85, 1.05) * (1.35 if v == 3 else 1.0)
    for s in (-1, 1):
        g.add(f'sh{s}', (s * br * 1.0, -bl * 0.05, zc + br * 1.3) if v == 2 else (s * br * 0.8, -bl * 0.2, zc + br * 0.6), (0.075, 0.075), 'che')
        if v == 1:                                                           # 10-07 박쥐: 옆으로 넓게 편 팔(새·비룡처럼 쳐들지 않는다)
            el, wr = (s * span * 0.5, -bl * 0.2, zc + br + 0.16), (s * span * 0.98, -bl * 0.1, zc + br + 0.22)
        elif v == 2:                                                         # 10-07 올빼미: 몸 옆에 접은 날개(둥근 몸 실루엣)
            el, wr = (s * br * 1.12, bl * 0.05, zc + br * 0.75), (s * br * 1.0, bl * 0.55, zc - br * 0.15)
        else:
            el, wr = (s * span * 0.4, -bl * 0.15, zc + br + 0.28), (s * span * 0.72, 0.0, zc + br + 0.5)
        g.add(f'el{s}', el, (0.055, 0.055), f'sh{s}')
        g.add(f'wr{s}', wr, (0.045, 0.045), f'el{s}')
    top = zc + br + 0.45
    pick = make_pick(rnd, body, dark, belly, glow, deco, top=top, foot=0.10, pattern=rnd.choice(['plain', 'spots', 'saddle']))
    skin_into(C, g, pick, ground=False)
    mem = C.s(*(('forest_ground_04', 1.0, _shade('#7a6a8a', 1.0)) if memb else ('forest_ground_04', 1.0, '#9a8f7a')))
    ntip = 4 if v == 1 else 3 if memb else 5
    for s in (-1, 1):
        sh, el, wr = g.p(f'sh{s}'), g.p(f'el{s}'), g.p(f'wr{s}')
        back = Vector((s * br * 0.55, bl * 0.8, zc + br * 0.1))
        tips = []
        for i in range(ntip):                                                # 앞가장자리 → 뒷가장자리 순으로 살대 끝
            u = i / (ntip - 1)
            if v == 1:                                                       # 박쥐 손가락: 바깥 끝 → 몸 쪽 뒤로 처지며 펼친다
                tips.append(wr + Vector((s * span * (0.22 - 0.62 * u), -0.04 + u * bl * 1.25, -0.06 - 0.36 * u)))
            elif v == 2:                                                     # 올빼미 접은 날개 끝 깃: 꼬리 쪽에서 아래로
                tips.append(wr + Vector((s * 0.02, 0.08 - u * 0.20, -0.02 - u * 0.14)))
            else:
                tips.append(wr + Vector((s * span * (0.32 - 0.13 * u), -0.10 + u * bl * 1.0, 0.02 - 0.32 * u)))
        if v == 2:
            back = Vector((s * br * 1.12, -bl * 0.15, zc + br * 0.35))
        for tp in tips:                                                      # 막 살대(새는 깃대)
            tube(M, tuple(wr), tuple(tp), 0.022, 0.008, horn_m if boss else dark, 1.0, 4, caps=False)
        edge = []
        for i, t in enumerate(tips):                                         # 박쥐는 손가락 사이 뒷가장자리가 안으로 패인다
            edge.append(tuple(t))
            if v == 1 and i < len(tips) - 1:
                mid = (t + tips[i + 1]) / 2
                edge.append(tuple(mid + (wr - mid) * 0.3))
        _membrane(M, [tuple(sh), tuple(el), tuple(wr)] + edge + [tuple(back)], mem if memb else dark)
    for s in (-1, 1):                                                        # 발톱
        f = g.p(f'lf{s}')
        for t in (-1, 0, 1):
            cone(M, tuple(f + Vector((0, -0.04, -0.01))), tuple(f + Vector((t * 0.04, -0.15, -0.02))), 0.018, horn_m, 4)
    if v in (0, 2):
        b0 = g.p('bk')
        cone(M, tuple(b0 + Vector((0, -0.01, 0.02))), tuple(b0 + Vector((0, -(0.12 if v == 0 else 0.08), -0.03))), hr * 0.35, horn_m, 5)
    eyes(M, eye, hp + Vector((0, -hr * 0.6, hr * 0.2)), hr * 0.65, 0.026 + (0.014 if fat else 0))
    if v == 2:                                                               # 올빼미 눈테 + 귀깃
        for s in (-1, 1):
            blob(M, (s * hr * 0.65, hp.y - hr * 0.52, hp.z + hr * 0.18), (hr * 0.34, 0.02, hr * 0.34), belly, 7, 4)
            cone(M, tuple(hp + Vector((s * hr * 0.6, 0.0, hr * 0.8))), tuple(hp + Vector((s * hr * 0.85, 0.02, hr * 1.7))), hr * 0.3, dark, 4)
    elif v == 3:
        for s in (-1, 1):
            horn(M, tuple(hp + Vector((s * hr * 0.5, hr * 0.3, hr * 0.7))), (s * 0.4, 0.8, 0.5), (s * 0.1, 0.5, -0.3), 0.32, 0.05, horn_m, 5, 4)
    elif rnd.random() < 0.6 or boss:
        cone(M, tuple(hp + Vector((0, 0.02, hr * 0.8))), tuple(hp + Vector((0, 0.12, hr * 1.9))), hr * 0.3, horn_m, 5)
    if v == 1:                                                               # 10-07 박쥐 큰 귀
        for s in (-1, 1):
            cone(M, tuple(hp + Vector((s * hr * 0.55, hr * 0.1, hr * 0.6))), tuple(hp + Vector((s * hr * 1.1, hr * 0.25, hr * 2.0))), hr * 0.42, body, 4)
    if v in (0, 1) or v == 3:                                                # 꼬리 깃/가시
        tp = g.p('t1')
        if v == 3:
            cone(M, tuple(tp + Vector((0, 0.0, 0.0))), tuple(tp + Vector((0, 0.18, 0.05))), 0.07, horn_m, 5)
        else:
            for t in (-1, 0, 1):
                blob(M, (t * 0.07, tp.y + 0.1, tp.z - 0.02), (0.035, 0.14, 0.015), dark, 6, 3)
    spine = [g.p(n) + Vector((0, 0, g.R[g.nm[n]][1])) for n in ('che', 'pel')]
    return {'head': (hp.x, hp.y, hp.z, hr), 'spine': spine, 'h': top}


# ---------------------------------------------------------------- 뱀 — 0 독사 · 1 코브라 · 2 뿔 지렁이(지느러미) · 3 방울뱀
def serp(C, rnd, v, boss=False, deco=None, skin=None):
    M = C.M
    body, dark, belly, eye, horn_m, glow = mats(C, rnd, skin, boss, deco)
    g = Rig()
    n = 15
    amp = rnd.uniform(0.2, 0.32)
    fr = rnd.uniform(1.8, 2.5)
    ph = rnd.uniform(0, 6.28)
    rmax = (0.17, 0.15, 0.2, 0.16)[v] * rnd.uniform(0.92, 1.1)
    lift = (0.35, 0.65, 0.3, 0.4)[v]
    names = []
    seg = 0.145
    for i in range(n):                                                       # i=0 머리 쪽
        t = i / (n - 1)
        taper = min(1.0, 0.25 + 0.75 * (1 - t) ** 0.7)
        r = rmax * (0.62 + 0.38 * math.sin(min(1.0, t * 2.6 + 0.1) * math.pi * 0.5)) * taper if t < 0.55 else rmax * max(0.1, taper)
        r = max(0.03, r)
        x = amp * math.sin(t * math.pi * fr + ph) * min(1.0, t * 3.0)
        y = -0.45 + i * seg
        rise = lift * max(0.0, 1.0 - t * 4.2) ** 1.4 * 1.0
        z = r * 0.9 + rise
        g.add(f'b{i}', (x, y, z), (r, r * 0.92), f'b{i - 1}' if i else None)
        names.append(f'b{i}')
    h0 = g.p('b0')
    hr = rmax * (1.3 if v in (0, 3) else 1.12 if v == 1 else 1.4)
    hp = h0 + Vector((0, -hr * 0.9, 0.0))
    g.add('hed', hp, (hr * 1.1, hr * 0.8), 'b0')
    g.add('sno', hp + Vector((0, -hr * 1.2, -hr * 0.2)), (hr * 0.6, hr * 0.42), 'hed')
    if v == 1:                                                               # 두건(코브라) — 머리 뒤 납작한 판
        for s in (-1, 1):
            g.add(f'hd{s}', h0 + Vector((s * hr * 1.2, hr * 0.3, -hr * 0.2)), (hr * 0.5, hr * 0.12), 'b0')
    top = h0.z + hr
    pick = make_pick(rnd, body, dark, belly, glow, deco, top=top, foot=0.0, pattern=rnd.choice(['stripes', 'spots', 'plain']), bellyz=-0.2)
    skin_into(C, g, pick, ground=True)
    sp = hp + Vector((0, -hr * 1.2, -hr * 0.2))
    eyes(M, eye, hp + Vector((0, -hr * 0.5, hr * 0.3)), hr * 0.78, 0.03)
    for s in (-1, 1):
        cone(M, tuple(sp + Vector((s * hr * 0.3, -hr * 0.2, -hr * 0.1))), tuple(sp + Vector((s * hr * 0.32, -hr * 0.45, -hr * 1.0))), 0.02, horn_m, 4)
    tg = C.s('white_stucco', 1.0, '#c43a3a', gain=1.4)
    tube(M, tuple(sp + Vector((0, -hr * 0.35, -hr * 0.1))), tuple(sp + Vector((0, -hr * 0.35 - 0.16, -hr * 0.2))), 0.012, 0.006, tg, 1.0, 4, caps=False)
    if v == 1:
        blob(M, (0, h0.y + hr * 0.5, h0.z + 0.0), (hr * 1.8, 0.02, hr * 1.5), body, 10, 4)
        blob(M, (0, h0.y + hr * 0.45, h0.z - hr * 0.1), (hr * 1.1, 0.025, hr * 0.9), dark, 8, 4)
    if v == 2:
        for s in (-1, 1):
            horn(M, tuple(hp + Vector((s * hr * 0.6, hr * 0.3, hr * 0.6))), (s * 0.5, 0.7, 0.55), (s * 0.15, 0.3, -0.35), 0.36 + 0.12 * boss, 0.05, horn_m, 6, 4)
        for i in range(1, n - 2, 2):
            p = g.p(f'b{i}')
            rr = g.R[g.nm[f'b{i}']][1]
            cone(M, tuple(p + Vector((0, -0.03, rr * 0.8))), tuple(p + Vector((0, 0.05, rr + 0.22 * (1 - i / n) + 0.05))), 0.05 * (1 - i / n) + 0.02, horn_m, 4)
    if v == 3:
        tp = g.p(f'b{n - 1}')
        for k in range(3):
            blob(M, (tp.x, tp.y + 0.1 + k * 0.1, tp.z + 0.04), (0.06 - k * 0.012, 0.07, 0.06 - k * 0.012), dark, 7, 4)
    if v == 0 and (rnd.random() < 0.5 or boss):
        for i in range(2, n - 3, 2):
            p = g.p(f'b{i}')
            cone(M, tuple(p + Vector((0, 0, g.R[g.nm[f'b{i}']][1] * 0.8))), tuple(p + Vector((0, 0.03, g.R[g.nm[f'b{i}']][1] + 0.1))), 0.035, horn_m, 4)
    spine = [g.p(f'b{i}') + Vector((0, 0, g.R[g.nm[f'b{i}']][1])) for i in (2, 4, 6, 8)]
    return {'head': (hp.x, hp.y, hp.z, hr), 'spine': spine, 'h': top}


# ---------------------------------------------------------------- 기계 — 0 두발 골렘 · 1 거미 · 2 궤도 포대 · 3 떠 있는 구
def cons(C, rnd, v, boss=False, deco=None, skin=None):
    M = C.M
    mc, cc, tc = rnd.choice(['#6a727d', '#7b6a58', '#4f5f6a', '#6b5470']), rnd.choice(EYES), rnd.choice(['#b08a4a', '#8f9aa5', '#a35a3a'])
    metal = C.s('corrugated_iron', 1.2, PAL[0] if PAL else mc)
    dark = C.s('bitumen', 1.0, '#26282e')
    core = C.s('white_stucco', 1.0, PAL[2] if PAL else cc, gain=2.1)
    trim = C.s('corrugated_iron', 1.0, PAL[1] if PAL else tc)
    bw, bd, bh = rnd.uniform(0.5, 0.64), rnd.uniform(0.4, 0.5), rnd.uniform(0.5, 0.66)
    if v == 1:
        bw, bd, bh = rnd.uniform(0.5, 0.6), rnd.uniform(0.6, 0.75), rnd.uniform(0.28, 0.36)
    if v == 2:
        bw, bd, bh = rnd.uniform(0.55, 0.65), rnd.uniform(0.7, 0.85), rnd.uniform(0.3, 0.38)
    if v == 3:
        bw, bd, bh = 0.56, 0.56, 0.56
    zl = (0.36, 0.34, 0.2, 0.55)[v] * rnd.uniform(0.95, 1.1)
    hz = zl + bh
    bbox(M, (0, 0, zl + bh / 2), (bw, bd, bh), metal, 0.05, 0.8)                           # 몸통
    bbox(M, (0, 0, zl + bh * 0.1 + 0.02), (bw + 0.07, bd * 0.45, bh * 0.2), trim, 0.03, 0.6)  # 허리띠
    bbox(M, (0, -bd / 2 - 0.012, zl + bh * 0.55), (bw * 0.42, 0.03, bw * 0.42), core, 0.015, 0.5)    # 가슴 심장
    for i in (-1, 1):                                                        # 통풍 줄
        for j in range(3):
            bbox(M, (i * bw * 0.28, -bd / 2 - 0.006, zl + bh * 0.18 + j * 0.045 + 0.1), (bw * 0.22, 0.012, 0.018), dark, 0.0, 0.3)
    if v in (0, 3):
        hh = 0.26
        bbox(M, (0, -0.02, hz + hh / 2 + 0.03), (bw * 0.62, bd * 0.62, hh), dark, 0.04, 0.6)      # 머리
        bbox(M, (0, -bd * 0.31 - 0.03, hz + hh * 0.55 + 0.03), (bw * 0.5, 0.025, 0.05), core, 0.01, 0.3)       # 눈 띠
        tube(M, (rnd.uniform(-0.08, 0.08), 0, hz + hh + 0.03), (0.0, 0.0, hz + hh + 0.03 + rnd.uniform(0.18, 0.4)), 0.022, 0.01, trim, 1.0, 5)
    else:
        bbox(M, (0, -bd / 2 - 0.12, zl + bh * 0.7), (bw * 0.55, 0.25, bh * 0.5), dark, 0.035, 0.6)    # 앞 머리통(몸에 붙은)
        bbox(M, (0, -bd / 2 - 0.255, zl + bh * 0.72), (bw * 0.42, 0.025, 0.07), core, 0.01, 0.3)
    if v == 0:                                                               # 두발 — 어깨 덮개·팔·다리
        for s in (-1, 1):
            bbox(M, (s * (bw / 2 + 0.08), 0, hz - 0.1), (0.2, 0.26, 0.2), trim, 0.05, 0.5)
            tube(M, (s * (bw / 2 + 0.1), 0, hz - 0.12), (s * (bw / 2 + 0.14), -0.2, hz - 0.42), 0.07, 0.09, metal, 1.0, 8)
            blob(M, (s * (bw / 2 + 0.14), -0.2, hz - 0.45), (0.1, 0.1, 0.1), trim, 8, 5)
            for t in (-1, 1):
                cone(M, (s * (bw / 2 + 0.14) + t * 0.03, -0.2, hz - 0.48), (s * (bw / 2 + 0.14) + t * 0.06, -0.38, hz - 0.58), 0.035, dark, 4)
            tube(M, (s * bw * 0.28, 0, zl + 0.04), (s * bw * 0.3, 0, 0.1), 0.1, 0.075, dark, 1.0, 8)
            bbox(M, (s * bw * 0.3, -0.06, 0.05), (0.2, 0.34, 0.1), metal, 0.03, 0.5)
    elif v == 1:                                                             # 거미 — 다리 넷 쌍
        for s in (-1, 1):
            for k in range(4):
                y = -bd * 0.4 + k * bd * 0.27
                kx, kz = s * (bw / 2 + 0.28 + 0.03 * (k % 2)), zl + bh + 0.22 - (k % 2) * 0.05
                tube(M, (s * bw / 2, y, zl + bh * 0.6), (kx, y - 0.05, kz), 0.045, 0.04, dark, 1.0, 6)
                blob(M, (kx, y - 0.05, kz), (0.05, 0.05, 0.05), trim, 6, 4)
                tube(M, (kx, y - 0.05, kz), (s * (bw / 2 + 0.5), y - 0.12, 0.02), 0.04, 0.015, metal, 1.0, 6)
        for s in (-1, 1):
            tube(M, (s * 0.12, -bd / 2 - 0.1, zl + bh * 0.5), (s * 0.14, -bd / 2 - 0.3, zl + bh * 0.2), 0.04, 0.0, trim, 1.0, 5)       # 집게
    elif v == 2:                                                             # 궤도 포대
        for s in (-1, 1):
            bbox(M, (s * (bw / 2 + 0.06), 0, zl / 2), (0.22, bd + 0.15, zl), dark, 0.06, 0.5)
            for k in range(4):
                blob(M, (s * (bw / 2 + 0.06 + 0.115), -bd * 0.38 + k * bd * 0.25, zl * 0.5), (0.02, 0.07, 0.07), trim, 6, 4)
        tube(M, (0, -bd * 0.1, zl + bh), (0, -bd * 0.65, zl + bh + 0.06), 0.06, 0.045, dark, 1.0, 8)                        # 포신
        tube(M, (0, -bd * 0.65, zl + bh + 0.06), (0, -bd * 0.85, zl + bh + 0.07), 0.07, 0.07, trim, 1.0, 8)
        bbox(M, (0, bd * 0.15, zl + bh + 0.1), (bw * 0.55, bd * 0.35, 0.2), metal, 0.04, 0.5)
    else:                                                                    # 떠 있는 구 — 링과 팔
        blob(M, (0, 0, zl + bh / 2), (bw * 0.72, bw * 0.72, bw * 0.72), metal, 12, 8)
        blob(M, (0, -bw * 0.5, zl + bh / 2), (bw * 0.3, 0.04, bw * 0.3), core, 8, 5)
        for k in range(14):
            a = 2 * math.pi * k / 14
            cone(M, (math.cos(a) * bw * 0.72, math.sin(a) * bw * 0.72, zl + bh / 2), (math.cos(a) * bw * 0.92, math.sin(a) * bw * 0.92, zl + bh / 2), 0.045, trim, 4)
        for s in (-1, 1):
            tube(M, (s * bw * 0.7, 0, zl + bh / 2), (s * (bw * 0.9), -0.25, zl + bh * 0.2), 0.05, 0.04, dark, 1.0, 6)
            for t in (-1, 1):
                cone(M, (s * bw * 0.9, -0.25, zl + bh * 0.2), (s * bw * 0.9 + t * 0.06, -0.42, zl + bh * 0.1), 0.03, trim, 4)
        tube(M, (0, 0, zl - bw * 0.1), (0, 0, zl - 0.25), 0.1, 0.0, core, 1.0, 6)
    if rnd.random() < 0.6 or boss:
        tube(M, (0, bd / 2, zl + bh * 0.6), (0, bd / 2 + 0.15, zl + bh * 1.0), 0.06, 0.04, dark, 1.0, 6)                  # 등 배기관
    if boss and deco == 'runes':
        bbox(M, (0, 0, zl + bh * 0.5), (bw + 0.02, 0.03, 0.03), core, 0.0, 0.3)
    return {'head': (0, -0.02, hz + 0.16, 0.2), 'spine': [Vector((0, k * bd * 0.25, hz + 0.02)) for k in (-1, 0, 1)], 'h': hz + 0.4}


# ---------------------------------------------------------------- 정령 — 0 불꽃 · 1 유령 · 2 결정 무리 · 3 해파리
def spir(C, rnd, v, boss=False, deco=None, skin=None):
    M = C.M
    sk = skin or rnd.choice([('snow_02', 1.0, '#9fd8ff'), ('white_stucco', 1.0, '#c9a6ff'), ('white_stucco', 1.0, '#9ff2c0'), ('white_stucco', 1.0, '#ffb46a')])
    body = C.s(sk[0], sk[1], sk[2], gain=1.35)
    inner = C.s('white_stucco', 1.0, PAL[1] if PAL else _shade(sk[2], 1.0), gain=2.0)
    dark = C.s('bitumen', 1.0, '#2a2f45')
    ec = rnd.choice(EYES)
    eye = C.s('white_stucco', 1.0, PAL[2] if PAL else ec, gain=2.0)
    zc = rnd.uniform(0.62, 0.8)
    r = rnd.uniform(0.24, 0.32)
    g = Rig()
    pick = lambda c, n: inner if n.z > 0.5 and c.z > zc + r * 0.9 else body
    info_head = (0, -r * 0.5, zc + r * 0.5, r * 0.7)
    if v == 0:                                                               # 불꽃 — 물방울 몸에 위로 휘는 혀
        g.add('c', (0, 0, zc), (r, r * 0.95))
        g.add('lo', (0, 0.02, zc - r * 0.9), (r * 0.55, r * 0.5), 'c')
        g.add('lo2', (0, 0.05, zc - r * 1.5), (r * 0.18, r * 0.18), 'lo')
        for i, a in enumerate((-0.7, 0.0, 0.7, 1.4)[:rnd.randint(3, 4)]):
            tipx = math.sin(a) * r * 0.9
            g.add(f'f{i}a', (math.sin(a) * r * 0.5, 0.0, zc + r * 0.8), (r * 0.42, r * 0.38), 'c')
            g.add(f'f{i}b', (tipx * 1.2, 0.02, zc + r * (1.6 + 0.3 * (i % 2))), (r * 0.2, r * 0.18), f'f{i}a')
            g.add(f'f{i}c', (tipx * 1.5, 0.02, zc + r * (2.3 + 0.35 * (i % 2))), (r * 0.05, r * 0.05), f'f{i}b')
        skin_into(C, g, pick, ground=False)
        for s in (-1, 1):
            blob(M, (s * r * 0.38, -r * 0.88, zc + r * 0.1), (r * 0.17, r * 0.1, r * 0.22), eye, 6, 4)
        blob(M, (0, -r * 0.92, zc - r * 0.2), (r * 0.22, r * 0.07, r * 0.1), dark, 6, 3)
    elif v == 1:                                                             # 유령 — 머리·두건 몸통(원뿔)·찢어진 밑자락·팔
        hz0 = zc + r * 1.0
        blob(M, (0, -0.02, hz0), (r * 0.66, r * 0.62, r * 0.66), body, 12, 7)
        tube(M, (0, 0, zc - r * 1.3), (0, 0, zc + r * 0.35), r * 1.05, r * 0.6, body, 1.0, 12)
        for k in range(7):                                                   # 밑자락
            a = 2 * math.pi * k / 7
            cone(M, (math.cos(a) * r * 0.75, math.sin(a) * r * 0.75, zc - r * 1.25), (math.cos(a) * r * 0.85, math.sin(a) * r * 0.85, zc - r * (1.9 + 0.35 * (k % 2))), r * 0.3, body, 5)
        for s in (-1, 1):
            tube(M, (s * r * 0.75, -r * 0.1, zc + r * 0.1), (s * r * 1.15, -r * 0.65, zc - r * 0.15), r * 0.2, r * 0.16, body, 1.0, 6)
            blob(M, (s * r * 1.2, -r * 0.7, zc - r * 0.15), (r * 0.2, r * 0.2, r * 0.2), inner, 7, 4)
            blob(M, (s * r * 0.26, -r * 0.58, hz0 + r * 0.05), (r * 0.17, r * 0.08, r * 0.22), eye, 6, 4)
        blob(M, (0, -r * 0.6, hz0 - r * 0.3), (r * 0.13, r * 0.05, r * 0.17), dark, 6, 3)
        info_head = (0, -r * 0.3, hz0, r * 0.62)
    elif v == 2:                                                             # 결정 — 핵 + 맴도는 결정 무리
        cc = rnd.choice(['#9fd8ff', '#ff9ac8', '#a6ffb8'])
        core = C.s('white_stucco', 1.0, PAL[2] if PAL else cc, gain=2.2)
        blob(M, (0, 0, zc), (r * 0.7, r * 0.7, r * 0.8), inner, 8, 6)
        for k in range(rnd.randint(7, 9)):
            a = 2 * math.pi * k / 8 + rnd.uniform(-0.2, 0.2)
            el = rnd.uniform(-0.2, 0.9)
            d = Vector((math.cos(a) * math.cos(el), math.sin(a) * math.cos(el), math.sin(el)))
            ln = rnd.uniform(0.28, 0.55)
            b0 = Vector((0, 0, zc)) + d * r * 0.6
            tube(M, tuple(b0), tuple(b0 + d * ln), 0.09, 0.0, body if k % 2 else core, 1.0, 6)
        for s in (-1, 1):
            blob(M, (s * r * 0.3, -r * 0.62, zc + r * 0.1), (r * 0.15, r * 0.08, r * 0.2), eye, 6, 4)
        info_head = (0, -r * 0.4, zc + r * 0.6, r * 0.6)
    else:                                                                    # 해파리 — 갓 + 늘어진 촉수
        g.add('dm', (0, 0, zc - r * 0.2), (r * 0.3, r * 0.3))
        for i, a in enumerate((0, 1.3, 2.6, 3.9, 5.2)[:rnd.randint(4, 5)]):
            x, y = math.cos(a) * r * 0.6, math.sin(a) * r * 0.55
            g.chain(f'tn{i}', 'dm', [(x, y, zc - r * 0.9), (x * 1.3, y * 1.3 + 0.05, zc - r * 1.7), (x * 0.9, y + 0.12, zc - r * 2.4)], [(r * 0.16, r * 0.16), (r * 0.1, r * 0.1), (r * 0.04, r * 0.04)])
        skin_into(C, g, pick, ground=False)
        blob(M, (0, 0, zc + r * 0.35), (r * 1.15, r * 1.1, r * 0.8), body, 14, 7)
        blob(M, (0, 0, zc + r * 0.45), (r * 0.7, r * 0.66, r * 0.55), inner, 10, 5)
        for s in (-1, 1):
            blob(M, (s * r * 0.42, -r * 0.95, zc + r * 0.2), (r * 0.16, r * 0.09, r * 0.2), eye, 6, 4)
        info_head = (0, -r * 0.3, zc + r * 0.9, r * 0.8)
    if v in (0, 1, 3):                                                       # 맴도는 조각
        for i in range(rnd.randint(2, 4)):
            a = rnd.uniform(0, 6.28)
            rr = r * (1.7 if v != 1 else 2.0)
            z0 = zc + rnd.uniform(-0.2, 0.2)
            cone(M, (math.cos(a) * rr, math.sin(a) * rr, z0), (math.cos(a) * rr, math.sin(a) * rr, z0 + rnd.uniform(0.14, 0.24)), 0.035, inner, 4)
    if v in (0, 1) and (rnd.random() < 0.6 or boss):
        for s in (-1, 1):
            horn(M, (s * r * 0.4, info_head[1], info_head[2] + r * 0.4), (s * 0.4, 0, 1), (-s * 0.1, 0, 0.3), r * 1.0, r * 0.15, inner, 5, 3)
    return {'head': info_head, 'spine': [Vector((0, 0, zc + r * 1.2))], 'h': zc + r * 2.2}


FAMILIES = {'quad': quad, 'wing': wing, 'serp': serp, 'cons': cons, 'spir': spir}
VARIANTS = 4
# 보스 12 — (계통, 변형 번호 0~3, 배율, 장식)
BOSSES = [('quad', 3, 3.0, 'plates'), ('quad', 0, 3.2, 'crown'), ('quad', 1, 2.8, 'runes'), ('wing', 3, 3.2, 'crown'), ('wing', 1, 3.0, 'plates'),
          ('serp', 2, 3.4, 'crown'), ('serp', 1, 3.0, 'runes'), ('cons', 0, 3.0, 'plates'), ('cons', 2, 3.2, 'runes'), ('spir', 1, 3.0, 'crown'), ('spir', 2, 3.3, 'runes'), ('quad', 2, 3.4, 'plates')]
# 10-07: 몸 재질을 무작위로 고르니 같은 계통 안에서 겹쳤다(네발 01·03 눈 흰색, 날개 02·03·뱀 01·03 이끼 초록) → 변형마다 정한다(spir·cons 는 제 색).
MON_SKINS = {
    'quad': [SKINS[6], SKINS[4], SKINS[7], SKINS[1]],   # 늑대 청회 · 멧돼지 갈색 · 고양이 흰색 · 황소 황갈 (렌더에서 보이는 색 기준 — 바위·모래 사진은 이끼 초록으로 찍힌다)
    'wing': [SKINS[1], SKINS[6], SKINS[7], SKINS[0]],   # 새 황갈 · 박쥐 청회 · 흰올빼미 · 비룡 초록
    'serp': [SKINS[0], SKINS[4], SKINS[2], SKINS[1]],   # 독사 초록 · 코브라 갈색 · 뿔 지렁이 적갈 · 방울뱀 황갈
}
BOSS_SKINS = [('cliff_side', 1.5, '#6a5a64'), ('aerial_rocks_02', 1.5, '#4f5a6e'), ('brown_mud', 1.2, '#6e4a44'), ('grey_plaster', 1.2, '#4f6480')]


def decorate(C, rnd, fam, kind, info):
    """보스 장식 — 갑옷판·가시(plates)·머리 왕관(crown). 발광 띠(runes)는 몸 무늬 칸에서 이미 처리."""
    M = C.M
    horn_m = C.s('coast_sand_rocks_02', 1.0, '#2e2a33')
    plate = C.s('corrugated_iron', 1.2, '#4a4650')
    if kind == 'crown':
        hx, hy, hz, hr = info['head']
        n = 7
        for i in range(n):
            a = 2 * math.pi * i / n
            r = hr * 0.85
            cone(M, (hx + math.cos(a) * r, hy + math.sin(a) * r, hz + hr * 0.1), (hx + math.cos(a) * r * 1.2, hy + math.sin(a) * r * 1.2, hz + hr * rnd.uniform(1.0, 1.8)), hr * 0.2, horn_m, 5)
    elif kind == 'plates':
        for p in info['spine']:
            bbox(M, (p.x, p.y, p.z - 0.05), (0.34, 0.15, 0.07), plate, 0.02, 0.6)
            cone(M, (p.x, p.y, p.z - 0.03), (p.x, p.y + 0.03, p.z + 0.22), 0.05, horn_m, 4)


def build_one(pid):
    kind, rest = pid.split('_', 1)
    rnd = random.Random(sum(ord(c) * (i + 3) for i, c in enumerate(pid)))
    C = BP.Ctx(pid)
    if kind == 'mon':
        fam, nn = rest.split('_')
        sk = None
        if fam in MON_SKINS:
            rnd.choice(SKINS)                                                   # mats 의 무작위 고르기 한 번을 그대로 소비 — 나머지 형태 난수 순서 유지
            sk = MON_SKINS[fam][int(nn) - 1]
        info = FAMILIES[fam](C, rnd, int(nn) - 1, False, None, sk)
        return C, BASE
    fam, v, k, deco = BOSSES[int(rest) - 1]
    info = FAMILIES[fam](C, rnd, v, True, deco, BOSS_SKINS[(int(rest) - 1) % len(BOSS_SKINS)])
    decorate(C, rnd, fam, deco, info)
    return C, k * BASE


IDS = [f'mon_{f}_{i:02d}' for f in FAMILIES for i in range(1, VARIANTS + 1)] + [f'boss_{i:02d}' for i in range(1, len(BOSSES) + 1)]


# K-0080 — 원소 → 몸 질감(색은 종 색이 정한다). 갈색 사진(진흙·절벽)은 종 색을 덮어 회색 계열로(10-07 눈: 만년설 곰왕이 주황, 여우불이 갈색 · 바위 사진은 이끼 초록으로 찍혀 풀처럼 보임). 표에 tex 가 있으면 그것
ELEM_TEX = {'fire': ('grey_plaster', 1.2), 'water': ('grey_plaster', 1.2), 'thunder': ('aerial_rocks_02', 1.5), 'wind': ('coast_sand_rocks_02', 1.5),
            'ice': ('snow_02', 1.5), 'rock': ('grey_plaster', 1.3), 'grass': ('forest_ground_04', 1.2)}
SPECIES = {}


def build_species(pid):
    """mon_sp_<종> — 표의 꼴에 종 색을 구워 넣는다. 씨앗은 그 꼴의 기본 id(같은 모양 난수)."""
    global PAL
    sp = SPECIES[pid[len('mon_sp_'):]]
    fam, v = sp['form']
    base = f'mon_{fam}_{v + 1:02d}' if v < 4 else f'mon_{fam}_x{v}'
    rnd = random.Random(sum(ord(c) * (i + 3) for i, c in enumerate(base)))
    C = BP.Ctx(pid)
    PAL = tuple(sp['colors'])
    tex = tuple(sp['tex']) if sp.get('tex') else ELEM_TEX.get(sp.get('element', ''), ('dry_ground_01', 1.2))
    try:
        boss = bool(sp.get('boss'))
        if fam in MON_SKINS and not boss:
            rnd.choice(SKINS)                                                   # 기본 몸과 같은 난수 순서
        info = FAMILIES[fam](C, rnd, v, boss, sp.get('deco'), (tex[0], tex[1], sp['colors'][0]))
        if boss:
            decorate(C, rnd, fam, sp.get('deco'), info)
    finally:
        PAL = None
    return C, float(sp.get('scale', 1.0)) * BASE


def build(pid, out, style):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    W._mat_cache.clear()
    W.set_style(style)
    C, k = build_species(pid) if pid.startswith('mon_sp_') else build_one(pid)
    for v in C.M.bm.verts:
        v.co *= k
    ob = C.M.build()
    ns = getattr(C, 'skin_faces', 0)
    for p in ob.data.polygons:
        p.use_smooth = p.index < ns          # Skin 몸(먼저 더한 면)만 매끈, 뿔·가시·기계는 각지게
    tris = sum(len(p.vertices) - 2 for p in ob.data.polygons)
    pts = [Vector(c) for c in ob.bound_box]
    lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
    hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    size = [round(hi[i] - lo[i], 2) for i in range(3)]
    bpy.context.view_layer.objects.active = ob
    os.makedirs(os.path.dirname(os.path.abspath(out)), exist_ok=True)
    W.export_glb([ob], out, int(os.environ.get('WF_TOON_PX', '256')) if style == 'toon' else 1024, 'JPEG' if style == 'toon' else 'AUTO')
    lic = {'id': pid, 'generator': BP.GENERATOR, 'blender': bpy.app.version_string, 'style': style,
           'license': 'CC0-1.0 (재질 사진 전부 Poly Haven CC0, 형태는 전부 코드)', 'inputs': sorted(f'polyhaven: {m}' for m in C.mats),
           'size_m': size, 'tris': tris,
           'family': (SPECIES[pid[7:]]['form'][0] if pid.startswith('mon_sp_') else pid.split('_')[1] if pid.startswith('mon') else BOSSES[int(pid.split('_')[1]) - 1][0])}
    json.dump(lic, open(os.path.splitext(out)[0] + '.license.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    kb = os.path.getsize(out) // 1024
    print('WORLDFORGE', json.dumps({'id': pid, 'tris': tris, 'size_m': size, 'kb': kb, 'ok': tris <= BP.TRIS_MAX and (style != 'toon' or kb <= 512)}))


if __name__ == '__main__':
    style = arg('--style', 'real')
    if '--species' in A:                                                     # K-0080 종별 몸 전부(또는 --only a,b)
        SPECIES.update(json.load(open(arg('--species'), encoding='utf-8'))['species'])
        only = [x for x in (arg('--only') or '').split(',') if x]
        d = arg('--out-dir')
        for kid in SPECIES:
            if not only or kid in only:
                build('mon_sp_' + kid, os.path.join(d, 'mon_sp_' + kid + '.glb'), style)
    elif '--list' in A:
        print('IDS', ' '.join(IDS))
    elif '--all' in A:
        d = arg('--out-dir')
        for pid in IDS:
            build(pid, os.path.join(d, pid + '.glb'), style)
    else:
        build(arg('--id'), arg('--out'), style)
