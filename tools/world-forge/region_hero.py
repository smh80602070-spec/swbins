"""지역 대표 장면 한 장 — 공방 조각(지형·집·등롱·배)을 한 장면에 모으고 하늘·빛·안개·번짐을 얹어 "이 지역은 이런 느낌" 을 눈으로 본다. Blender 헤드리스.

  blender -b --factory-startup -P tools/world-forge/region_hero.py -- <지역> <출력.png> [샘플=48]

지역: galaxy_ferry(은하 나루: 별밤 물가·등롱·돛단배) · frost_peak(서리봉 고원: 오로라·눈 소나무·횃불 길·제단) · time_rift(시간 틈 관측소: 떠 있는 섬·시간 고리·하늘의 균열·구름바다) · crossroads(틈새 갈림길: 과거·현재·미래 세 갈래와 균열 문) · village(마을: 시대가 섞인 해질녘 낮 마을)
조각은 saga-assets/world/toon/*.glb(툰 GLB, K-0017)를 그대로 쓴다. 이 장면은 게임 장면이 아니라 방향을 정하는 시안 — 마음에 들면 각 트랙이 같은 구도·조명 값으로 엔진 안에서 다시 짠다.
"""
import bpy
import math
import os
import random
import sys
from mathutils import Vector

a = sys.argv[sys.argv.index('--') + 1:]
REGION, OUT = a[0], os.path.abspath(a[1])
SAMPLES = int(a[2]) if len(a) > 2 else 48
PBR = len(a) > 3 and a[3] == 'pbr'      # 사실 재질·사실 건물 모드(Poly Haven PBR 땅 + 공방 real GLB)
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
TOON = os.path.join(ROOT, 'saga-assets', 'world', 'toon')
rng = random.Random(20261003)

bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
sc.render.resolution_x, sc.render.resolution_y = 1600, 900
for eng in ('BLENDER_EEVEE_NEXT', 'BLENDER_EEVEE'):
    try:
        sc.render.engine = eng
        break
    except TypeError:
        pass
try:
    sc.eevee.taa_render_samples = SAMPLES
except Exception:
    pass
try:
    sc.eevee.use_raytracing = True
except Exception:
    pass
sc.view_settings.view_transform = 'AgX' if 'AgX' in [x.identifier for x in sc.view_settings.bl_rna.properties['view_transform'].enum_items] else 'Standard'


import json as _json
PH = os.path.join(ROOT, 'tools', 'world-forge', '_src', 'polyhaven')
REAL = os.path.join(ROOT, 'tools', 'world-forge', '_out')
_PHIDX = None


def pbr_mat(tid, tile=4.0, tint=None, rough_mul=1.0, name=None, sat=1.0):
    """Poly Haven 재질 세트를 월드 위치 기준 평면 투영으로 깐다(땅·길용). tile = 그림 한 장이 덮는 미터."""
    global _PHIDX
    if _PHIDX is None:
        _PHIDX = _json.load(open(os.path.join(PH, 'index.json'), encoding='utf-8'))
    idx = _PHIDX[tid]
    m = bpy.data.materials.new(name or tid)
    m.use_nodes = True
    nt = m.node_tree
    bs = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
    tc = nt.nodes.new('ShaderNodeTexCoord')
    mp = nt.nodes.new('ShaderNodeMapping')
    mp.inputs['Scale'].default_value = (1.0 / tile, 1.0 / tile, 1.0 / tile)
    nt.links.new(tc.outputs['Object'], mp.inputs['Vector'])

    def tex(kind, cs):
        fn = idx.get(kind)
        if not fn:
            return None
        n = nt.nodes.new('ShaderNodeTexImage')
        n.image = bpy.data.images.load(os.path.join(PH, fn), check_existing=True)
        n.image.colorspace_settings.name = cs
        nt.links.new(mp.outputs[0], n.inputs['Vector'])
        return n
    d = tex('diff', 'sRGB')
    if d is not None:
        col_out = d.outputs['Color']
        if sat != 1.0:
            hs = nt.nodes.new('ShaderNodeHueSaturation')
            hs.inputs['Saturation'].default_value = sat
            nt.links.new(col_out, hs.inputs['Color'])
            col_out = hs.outputs['Color']
        if tint:
            mx = nt.nodes.new('ShaderNodeMix')
            mx.data_type = 'RGBA'
            mx.blend_type = 'MULTIPLY'
            mx.inputs['Factor'].default_value = 1.0
            mx.inputs['B'].default_value = tint
            nt.links.new(col_out, mx.inputs['A'])
            nt.links.new(mx.outputs['Result'], bs.inputs['Base Color'])
        else:
            nt.links.new(col_out, bs.inputs['Base Color'])
    r = tex('rough', 'Non-Color')
    if r is not None:
        nt.links.new(r.outputs['Color'], bs.inputs['Roughness'])
    nn = tex('nor', 'Non-Color')
    if nn is not None:
        nm = nt.nodes.new('ShaderNodeNormalMap')
        nt.links.new(nn.outputs['Color'], nm.inputs['Color'])
        nt.links.new(nm.outputs['Normal'], bs.inputs['Normal'])
    return m


_TMPL = {}


def place(name, loc, rot=0.0, scale=1.0, real=None):
    """공방 조각 하나를 놓는다. 같은 조각은 처음 한 번만 읽고 나머지는 메시·재질을 공유하는 복사본 — 사실 모드 소품 GLB 는 8~30MB 라
    스무 번 읽으면 메모리·시간이 폭발한다. real=None 이면 사실 모드(PBR)일 때 real GLB(없으면 툰)를 쓴다."""
    use_real = PBR if real is None else real
    src_dir = REAL if (use_real and os.path.exists(os.path.join(REAL, name + '.glb'))) else TOON
    key = (name, src_dir)
    if key not in _TMPL:
        before = set(bpy.data.objects.keys())
        bpy.ops.import_scene.gltf(filepath=os.path.join(src_dir, name + '.glb'))
        objs = [o for o in bpy.data.objects if o.name not in before]
        for o in objs:
            for c in list(o.users_collection):
                c.objects.unlink(o)
        _TMPL[key] = objs
    tmpl = _TMPL[key]
    holder = bpy.data.objects.new(name + '_h', None)
    sc.collection.objects.link(holder)
    mp = {}
    for o in tmpl:
        mp[o] = o.copy()
        sc.collection.objects.link(mp[o])
    for o in tmpl:
        mp[o].parent = mp.get(o.parent, holder)
        mp[o].matrix_parent_inverse = o.matrix_parent_inverse.copy()
    holder.location, holder.rotation_euler, holder.scale = loc, (0, 0, rot), (scale,) * 3
    return holder, list(mp.values())


def glow(x, y, z, color, r, strength=18.0):
    m = mat_simple('glow%d_%d' % (int(color[0] * 9), int(color[2] * 9)), (0.05, 0.05, 0.05, 1), 0.5, color, strength)
    bpy.ops.mesh.primitive_uv_sphere_add(radius=r, segments=12, ring_count=8, location=(x, y, z))
    bpy.context.object.data.materials.append(m)


def lit(h, objs, color, strength, local, r):
    """불 켜는 소품: 툰은 통째로 발광, 사실 모드는 돌 질감이 보이게 약한 발광 + 불꽃 구슬(local = 소품 기준 불 자리)."""
    if not PBR:
        emissive(objs, color, strength)
        return
    emissive(objs, color, 0.12)
    rz, s = h.rotation_euler[2], h.scale[0]
    lx, ly, lz = local
    glow(h.location.x + (lx * math.cos(rz) - ly * math.sin(rz)) * s, h.location.y + (lx * math.sin(rz) + ly * math.cos(rz)) * s,
         h.location.z + lz * s, color, r * s)


def emissive(obj_list, color, strength):
    for o in obj_list:
        if o.type != 'MESH':
            continue
        for s in o.material_slots:
            m = s.material
            if not m or not m.use_nodes:
                continue
            nt = m.node_tree
            bsdf = next((n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED'), None)
            if bsdf:
                bsdf.inputs['Emission Color'].default_value = color
                bsdf.inputs['Emission Strength'].default_value = strength


def point(loc, color, power, radius=0.3):
    d = bpy.data.lights.new('L', 'POINT')
    d.energy, d.color, d.shadow_soft_size = power, color, radius
    o = bpy.data.objects.new('L', d)
    o.location = loc
    sc.collection.objects.link(o)


def sky_world():
    w = bpy.data.worlds.new('sky')
    sc.world = w
    w.use_nodes = True
    nt = w.node_tree
    nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputWorld')
    bg = nt.nodes.new('ShaderNodeBackground')
    tc = nt.nodes.new('ShaderNodeTexCoord')
    sep = nt.nodes.new('ShaderNodeSeparateXYZ')
    nt.links.new(tc.outputs['Generated'], sep.inputs[0])
    ramp = nt.nodes.new('ShaderNodeValToRGB')       # 지평선 청록 → 천정 짙은 남색
    ramp.color_ramp.elements[0].position, ramp.color_ramp.elements[1].position = 0.45, 0.85
    ramp.color_ramp.elements[0].color = (0.10, 0.22, 0.38, 1)
    ramp.color_ramp.elements[1].color = (0.008, 0.015, 0.06, 1)
    nt.links.new(sep.outputs['Z'], ramp.inputs['Fac'])
    # 별: 점 잡음 문턱
    vor = nt.nodes.new('ShaderNodeTexVoronoi')
    vor.inputs['Scale'].default_value = 220
    vor.feature = 'F1'
    nt.links.new(tc.outputs['Generated'], vor.inputs['Vector'])
    star = nt.nodes.new('ShaderNodeMath')
    star.operation = 'LESS_THAN'
    nt.links.new(vor.outputs['Distance'], star.inputs[0])
    star.inputs[1].default_value = 0.035
    sm = nt.nodes.new('ShaderNodeMath')
    sm.operation = 'MULTIPLY'
    sm.inputs[1].default_value = 6.0
    nt.links.new(star.outputs[0], sm.inputs[0])
    # 은하수 띠: 비스듬한 대역 × 잡음
    mp = nt.nodes.new('ShaderNodeMapping')
    mp.inputs['Rotation'].default_value = (0.5, 0.3, 0.6)
    nt.links.new(tc.outputs['Generated'], mp.inputs['Vector'])
    sep2 = nt.nodes.new('ShaderNodeSeparateXYZ')
    nt.links.new(mp.outputs[0], sep2.inputs[0])
    band = nt.nodes.new('ShaderNodeMath')
    band.operation = 'ABSOLUTE'
    sub = nt.nodes.new('ShaderNodeMath')
    sub.operation = 'SUBTRACT'
    sub.inputs[1].default_value = 0.5
    nt.links.new(sep2.outputs['Z'], sub.inputs[0])
    nt.links.new(sub.outputs[0], band.inputs[0])
    br = nt.nodes.new('ShaderNodeMapRange')
    br.inputs['From Min'].default_value, br.inputs['From Max'].default_value = 0.0, 0.22
    br.inputs['To Min'].default_value, br.inputs['To Max'].default_value = 1.0, 0.0
    br.clamp = True
    nt.links.new(band.outputs[0], br.inputs['Value'])
    noi = nt.nodes.new('ShaderNodeTexNoise')
    noi.inputs['Scale'].default_value = 5.0
    noi.inputs['Detail'].default_value = 8.0
    nt.links.new(tc.outputs['Generated'], noi.inputs['Vector'])
    gm = nt.nodes.new('ShaderNodeMath')
    gm.operation = 'MULTIPLY'
    nt.links.new(br.outputs[0], gm.inputs[0])
    nt.links.new(noi.outputs['Fac'], gm.inputs[1])
    gc = nt.nodes.new('ShaderNodeMixRGB')
    gc.blend_type = 'MIX'
    gc.inputs['Color1'].default_value = (0.35, 0.28, 0.75, 1)
    gc.inputs['Color2'].default_value = (0.55, 0.85, 1.0, 1)
    nt.links.new(noi.outputs['Fac'], gc.inputs['Fac'])
    gcm = nt.nodes.new('ShaderNodeMixRGB')
    gcm.blend_type = 'MULTIPLY'
    gcm.inputs['Fac'].default_value = 1.0
    nt.links.new(gc.outputs[0], gcm.inputs['Color1'])
    nt.links.new(gm.outputs[0], gcm.inputs['Color2'])
    add1 = nt.nodes.new('ShaderNodeMixRGB')
    add1.blend_type = 'ADD'
    add1.inputs['Fac'].default_value = 1.0
    nt.links.new(ramp.outputs[0], add1.inputs['Color1'])
    nt.links.new(gcm.outputs[0], add1.inputs['Color2'])
    add2 = nt.nodes.new('ShaderNodeMixRGB')
    add2.blend_type = 'ADD'
    add2.inputs['Fac'].default_value = 1.0
    nt.links.new(add1.outputs[0], add2.inputs['Color1'])
    nt.links.new(sm.outputs[0], add2.inputs['Color2'])
    nt.links.new(add2.outputs[0], bg.inputs['Color'])
    bg.inputs['Strength'].default_value = 1.0
    nt.links.new(bg.outputs[0], out.inputs[0])


def water(size, z):
    bpy.ops.mesh.primitive_plane_add(size=size, location=(0, 0, z))
    o = bpy.context.object
    m = bpy.data.materials.new('water')
    m.use_nodes = True
    nt = m.node_tree
    b = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
    b.inputs['Base Color'].default_value = (0.01, 0.05, 0.10, 1)
    b.inputs['Roughness'].default_value = 0.04
    b.inputs['Metallic'].default_value = 0.0
    b.inputs['Specular IOR Level'].default_value = 1.0
    noi = nt.nodes.new('ShaderNodeTexNoise')
    noi.inputs['Scale'].default_value = 26.0
    noi.inputs['Detail'].default_value = 6.0
    noi.inputs['Distortion'].default_value = 1.2
    bump = nt.nodes.new('ShaderNodeBump')
    bump.inputs['Strength'].default_value = 0.35
    nt.links.new(noi.outputs['Fac'], bump.inputs['Height'])
    nt.links.new(bump.outputs[0], b.inputs['Normal'])
    o.data.materials.append(m)
    return o


def glow_comp():
    sc.use_nodes = True
    nt = sc.node_tree
    nt.nodes.clear()
    rl = nt.nodes.new('CompositorNodeRLayers')
    gl = nt.nodes.new('CompositorNodeGlare')
    gl.glare_type = 'FOG_GLOW'
    gl.quality = 'HIGH'
    gl.threshold = 0.6
    try:
        gl.size = 7
    except Exception:
        pass
    out = nt.nodes.new('CompositorNodeComposite')
    nt.links.new(rl.outputs['Image'], gl.inputs['Image'])
    nt.links.new(gl.outputs['Image'], out.inputs['Image'])


def camera(loc, look, lens=28):
    cd = bpy.data.cameras.new('cam')
    cd.lens = lens
    co = bpy.data.objects.new('cam', cd)
    sc.collection.objects.link(co)
    co.location = loc
    d = Vector(look) - Vector(loc)
    co.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
    sc.camera = co


def ground_z(x, y):
    dg = bpy.context.evaluated_depsgraph_get()
    hit, loc, nor, idx, obj, mat = sc.ray_cast(dg, Vector((x, y, 12.0)), Vector((0, 0, -1)), distance=30)
    return loc.z if hit and obj and not obj.name.startswith('water') else None


def spots(n, zmin, zmax, ymin, ymax, mind, tries=4000, xr=(-22, 22)):
    got = []
    for _ in range(tries):
        x, y = rng.uniform(*xr), rng.uniform(ymin, ymax)
        z = ground_z(x, y)
        if z is None or not (zmin <= z <= zmax):
            continue
        if all((x - gx) ** 2 + (y - gy) ** 2 > mind * mind for gx, gy, _ in got):
            got.append((x, y, z))
            if len(got) == n:
                break
    return got


def lake_terrain():
    import bmesh
    me = bpy.data.meshes.new('lake')
    o = bpy.data.objects.new('lake_ground', me)
    sc.collection.objects.link(o)
    bm = bmesh.new()
    n, size = 160, 150.0
    vs = []
    ph = [rng.uniform(0, 6.28) for _ in range(6)]
    for j in range(n + 1):
        row = []
        for i in range(n + 1):
            x, y = (i / n - 0.5) * size, (j / n - 0.3) * size
            # 가까운 둑(y<-3) 은 완만히 높고, 호수(-3..24) 는 낮고, 건너편(y>24) 은 오르는 언덕·먼 산
            near = 1.2 if y < -3 else 1.2 - 3.2 * min(1, (y + 3) / 4)
            far = max(0, y - 22) * 0.12
            ridge = max(0, y - 46) * 0.45
            wob = (math.sin(x * 0.11 + ph[0]) + math.sin(x * 0.27 + ph[1]) * 0.5 + math.sin(y * 0.2 + ph[2]) * 0.4)
            z = near + far * (1 + 0.5 * wob) + ridge * (1 + 0.7 * math.sin(x * 0.09 + ph[3]) + 0.3 * math.sin(x * 0.31 + ph[4]))
            if y < -3:
                z += 0.12 * math.sin(x * 0.4 + ph[5])
            row.append(bm.verts.new((x, y, z)))
        vs.append(row)
    for j in range(n):
        for i in range(n):
            bm.faces.new((vs[j][i], vs[j][i + 1], vs[j + 1][i + 1], vs[j + 1][i]))
    bm.to_mesh(me)
    bm.free()
    for p_ in me.polygons:
        p_.use_smooth = True
    if PBR:
        o.data.materials.append(pbr_blend('aerial_grass_rock', 'cliff_side', 3.0, 9.0, 0.30, 0.55, 5.0, 9.0, (0.45, 0.55, 0.75, 1), (0.55, 0.6, 0.8, 1), 'lake_ground'))
        return o
    m = bpy.data.materials.new('ground')
    m.use_nodes = True
    nt = m.node_tree
    bsdf = next(x for x in nt.nodes if x.type == 'BSDF_PRINCIPLED')
    noi = nt.nodes.new('ShaderNodeTexNoise')
    noi.inputs['Scale'].default_value = 3.0
    noi.inputs['Detail'].default_value = 6.0
    ramp = nt.nodes.new('ShaderNodeValToRGB')
    ramp.color_ramp.elements[0].color = (0.012, 0.03, 0.025, 1)
    ramp.color_ramp.elements[1].color = (0.05, 0.09, 0.05, 1)
    nt.links.new(noi.outputs['Fac'], ramp.inputs['Fac'])
    nt.links.new(ramp.outputs[0], bsdf.inputs['Base Color'])
    bsdf.inputs['Roughness'].default_value = 0.9
    o.data.materials.append(m)
    return o


def pine(x, y, z, s):
    m = bpy.data.materials.get('pine')
    if m is None:
        m = bpy.data.materials.new('pine')
        m.use_nodes = True
        bs = next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
        bs.inputs['Base Color'].default_value = (0.012, 0.035, 0.03, 1)
        bs.inputs['Roughness'].default_value = 0.95
    for k, (r, h, dz) in enumerate(((1.5, 2.6, 1.0), (1.15, 2.3, 2.3), (0.75, 2.0, 3.5))):
        bpy.ops.mesh.primitive_cone_add(vertices=7, radius1=r * s, radius2=0.0, depth=h * s, location=(x, y, z + dz * s))
        c = bpy.context.object
        c.data.materials.append(m)
    bpy.ops.mesh.primitive_cylinder_add(vertices=6, radius=0.18 * s, depth=1.4 * s, location=(x, y, z + 0.5 * s))
    bpy.context.object.data.materials.append(m)


def trees(n, zmin, zmax, ymin, ymax, avoid=()):
    c = 0
    for _ in range(6000):
        x, y = rng.uniform(-60, 60), rng.uniform(ymin, ymax)
        z = ground_z(x, y)
        if z is None or not (zmin <= z <= zmax) or any((x - ax) ** 2 + (y - ay) ** 2 < 64 for ax, ay in avoid):
            continue
        pine(x, y, z - 0.1, rng.uniform(0.9, 1.9))
        c += 1
        if c >= n:
            break


def cone_mesh(name, specs, mat, sides=3):
    """뿔(풀잎·갈대) 수천 개를 메시 하나에 직접 만든다. bpy.ops 로 하나씩 더하면 장면이 커질수록 느려진다(520무더기에 9분)."""
    import bmesh
    me = bpy.data.meshes.new(name)
    bm = bmesh.new()
    for (x, y, z0, r, h, tx, ty) in specs:
        base = [bm.verts.new((x + r * math.cos(k / sides * 6.2832), y + r * math.sin(k / sides * 6.2832), z0)) for k in range(sides)]
        tip = bm.verts.new((x + h * math.sin(ty), y - h * math.sin(tx), z0 + h))
        for k in range(sides):
            bm.faces.new((base[k], base[(k + 1) % sides], tip))
        bm.faces.new(base[::-1])
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(name, me)
    sc.collection.objects.link(o)
    me.materials.append(mat)
    return o


def _bsdf_for(nt, tid, tile, tint, mapnode, sat=1.0):
    idx = _PHIDX[tid]
    bs = nt.nodes.new('ShaderNodeBsdfPrincipled')
    mp = nt.nodes.new('ShaderNodeMapping')
    mp.inputs['Scale'].default_value = (1.0 / tile,) * 3
    nt.links.new(mapnode, mp.inputs['Vector'])

    def tex(kind, cs):
        fn = idx.get(kind)
        if not fn:
            return None
        n = nt.nodes.new('ShaderNodeTexImage')
        n.image = bpy.data.images.load(os.path.join(PH, fn), check_existing=True)
        n.image.colorspace_settings.name = cs
        nt.links.new(mp.outputs[0], n.inputs['Vector'])
        return n
    d = tex('diff', 'sRGB')
    if d is not None:
        col_out = d.outputs['Color']
        if sat != 1.0:
            hs = nt.nodes.new('ShaderNodeHueSaturation')
            hs.inputs['Saturation'].default_value = sat
            nt.links.new(col_out, hs.inputs['Color'])
            col_out = hs.outputs['Color']
        if tint:
            mx = nt.nodes.new('ShaderNodeMix')
            mx.data_type = 'RGBA'
            mx.blend_type = 'MULTIPLY'
            mx.inputs['Factor'].default_value = 1.0
            mx.inputs['B'].default_value = tint
            nt.links.new(col_out, mx.inputs['A'])
            nt.links.new(mx.outputs['Result'], bs.inputs['Base Color'])
        else:
            nt.links.new(col_out, bs.inputs['Base Color'])
    r = tex('rough', 'Non-Color')
    if r is not None:
        nt.links.new(r.outputs['Color'], bs.inputs['Roughness'])
    nn = tex('nor', 'Non-Color')
    if nn is not None:
        nm = nt.nodes.new('ShaderNodeNormalMap')
        nt.links.new(nn.outputs['Color'], nm.inputs['Color'])
        nt.links.new(nm.outputs['Normal'], bs.inputs['Normal'])
    return bs


def pbr_blend(low, high, z0, z1, slope0=0.35, slope1=0.6, tile_lo=5.0, tile_hi=8.0, tint_lo=None, tint_hi=None, name='blend', sat_lo=1.0, sat_hi=1.0):
    """낮은 곳·평평한 곳 = low 재질, 높은 곳·가파른 곳 = high 재질. 높이(z0~z1)와 경사(slope0~slope1)가 섞음비를 정한다."""
    global _PHIDX
    if _PHIDX is None:
        _PHIDX = _json.load(open(os.path.join(PH, 'index.json'), encoding='utf-8'))
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    tc = nt.nodes.new('ShaderNodeTexCoord')
    a = _bsdf_for(nt, low, tile_lo, tint_lo, tc.outputs['Object'], sat_lo)
    c = _bsdf_for(nt, high, tile_hi, tint_hi, tc.outputs['Object'], sat_hi)
    sep = nt.nodes.new('ShaderNodeSeparateXYZ')
    nt.links.new(tc.outputs['Object'], sep.inputs[0])
    hz = nt.nodes.new('ShaderNodeMapRange')
    hz.inputs['From Min'].default_value, hz.inputs['From Max'].default_value = z0, z1
    hz.clamp = True
    nt.links.new(sep.outputs['Z'], hz.inputs['Value'])
    geo = nt.nodes.new('ShaderNodeNewGeometry')
    sepn = nt.nodes.new('ShaderNodeSeparateXYZ')
    nt.links.new(geo.outputs['Normal'], sepn.inputs[0])
    inv = nt.nodes.new('ShaderNodeMath')
    inv.operation = 'SUBTRACT'
    inv.inputs[0].default_value = 1.0
    nt.links.new(sepn.outputs['Z'], inv.inputs[1])
    sl = nt.nodes.new('ShaderNodeMapRange')
    sl.inputs['From Min'].default_value, sl.inputs['From Max'].default_value = slope0, slope1
    sl.clamp = True
    nt.links.new(inv.outputs[0], sl.inputs['Value'])
    mxf = nt.nodes.new('ShaderNodeMath')
    mxf.operation = 'MAXIMUM'
    nt.links.new(hz.outputs[0], mxf.inputs[0])
    nt.links.new(sl.outputs[0], mxf.inputs[1])
    ms = nt.nodes.new('ShaderNodeMixShader')
    nt.links.new(mxf.outputs[0], ms.inputs[0])
    nt.links.new(a.outputs[0], ms.inputs[1])
    nt.links.new(c.outputs[0], ms.inputs[2])
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    nt.links.new(ms.outputs[0], out.inputs['Surface'])
    return m


def road_mesh(p0, p1, width, mat, lift=0.05, step=1.5):
    """지형을 따라 눕는 길 띠(직선 상자는 구불구불한 땅에서 둔덕처럼 뜬다)."""
    import bmesh
    dx, dy = p1[0] - p0[0], p1[1] - p0[1]
    ln = math.hypot(dx, dy)
    ux, uy = dx / ln, dy / ln
    nx, ny = -uy, ux
    me = bpy.data.meshes.new('road')
    bm = bmesh.new()
    prev = None
    n = max(2, int(ln / step))
    for i in range(n + 1):
        t = ln * i / n
        row = []
        for s in (-width / 2, width / 2):
            x, y = p0[0] + ux * t + nx * s, p0[1] + uy * t + ny * s
            z = ground_z(x, y)
            row.append(bm.verts.new((x, y, (z if z is not None else 0.0) + lift)))
        if prev:
            bm.faces.new((prev[0], prev[1], row[1], row[0]))
        prev = row
    bm.to_mesh(me)
    bm.free()
    for p_ in me.polygons:
        p_.use_smooth = True
    o = bpy.data.objects.new('road', me)
    sc.collection.objects.link(o)
    me.materials.append(mat)
    return o


def mat_simple(name, color, rough=0.8, emit=None, strength=0.0):
    m = bpy.data.materials.get(name)
    if m is None:
        m = bpy.data.materials.new(name)
        m.use_nodes = True
        bs = next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
        bs.inputs['Base Color'].default_value = color
        bs.inputs['Roughness'].default_value = rough
        if emit:
            bs.inputs['Emission Color'].default_value = emit
            bs.inputs['Emission Strength'].default_value = strength
    return m


def rock(x, y, z, s):
    import bmesh
    me = bpy.data.meshes.new('rock')
    o = bpy.data.objects.new('rock', me)
    sc.collection.objects.link(o)
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=2, radius=1.0)
    for v in bm.verts:
        v.co *= rng.uniform(0.75, 1.15)
    bm.to_mesh(me)
    bm.free()
    o.scale = (s * rng.uniform(1.0, 1.6), s * rng.uniform(0.8, 1.3), s * rng.uniform(0.5, 0.9))
    o.location = (x, y, z + s * 0.1)
    o.rotation_euler = (0, 0, rng.uniform(0, 6.28))
    for p_ in me.polygons:
        p_.use_smooth = True
    o.data.materials.append(mat_simple('rockm', (0.045, 0.05, 0.055, 1), 0.85))


def reeds(n, xmin, xmax, ymin, ymax):
    m = mat_simple('reed', (0.03, 0.07, 0.04, 1), 0.9)
    c = 0
    for _ in range(3000):
        x, y = rng.uniform(xmin, xmax), rng.uniform(ymin, ymax)
        z = ground_z(x, y)
        if z is None or not (-0.35 <= z <= 0.9):
            continue
        for k in range(rng.randint(6, 11)):
            h = rng.uniform(1.0, 2.2)
            ox, oy = rng.uniform(-0.35, 0.35), rng.uniform(-0.35, 0.35)
            bpy.ops.mesh.primitive_cone_add(vertices=4, radius1=0.065, radius2=0.0, depth=h, location=(x + ox, y + oy, z + h / 2 - 0.05))
            o = bpy.context.object
            o.rotation_euler = (rng.uniform(-0.25, 0.25), rng.uniform(-0.25, 0.25), 0)
            o.data.materials.append(m)
        c += 1
        if c >= n:
            break


def fireflies(n):
    m = mat_simple('firefly', (1, 0.9, 0.5, 1), 0.5, (0.85, 1.0, 0.35, 1), 14.0)
    for _ in range(n):
        x, y = rng.uniform(-24, 14), rng.uniform(-8, 6)
        z = rng.uniform(0.9, 3.8)
        bpy.ops.mesh.primitive_uv_sphere_add(radius=rng.uniform(0.018, 0.04), segments=8, ring_count=6, location=(x, y, z))
        bpy.context.object.data.materials.append(m)


def pier(x0, y0, length, z):
    wood = mat_simple('wood', (0.09, 0.05, 0.03, 1), 0.85)
    for i in range(int(length / 0.45)):
        bpy.ops.mesh.primitive_cube_add(size=1, location=(x0, y0 + 0.45 * i, z))
        o = bpy.context.object
        o.scale = (1.4, 0.2, 0.05)
        o.data.materials.append(wood)
    for i in range(0, int(length / 0.45), 4):
        for sx in (-0.65, 0.65):
            bpy.ops.mesh.primitive_cylinder_add(vertices=6, radius=0.07, depth=1.6, location=(x0 + sx, y0 + 0.45 * i, z - 0.55))
            bpy.context.object.data.materials.append(wood)
    return y0 + 0.45 * int(length / 0.45)


def galaxy_ferry():
    sky_world()
    lake_terrain()
    bpy.context.view_layer.update()
    wz = 0.0
    w = water(220, wz)
    w.name = 'water_plane'
    bpy.context.view_layer.update()
    houses = spots(8, 1.0, 5.5, 23, 38, 6.0, xr=(-14, 18))
    trees(170, 0.8, 9.0, 22, 60, avoid=[(x, y) for x, y, _ in houses])
    # 건너편 언덕 위 한옥 마을
    for x, y, z in houses:
        h, objs = place(rng.choice(['hanok_01', 'hanok_01', 'forest_cottage_01', 'jp_minka_01']), (x, y, z - 0.15), rot=rng.uniform(-0.5, 0.5), scale=rng.uniform(1.2, 1.7), real=PBR)
        emissive(objs, (1.0, 0.6, 0.28, 1), 0.6)
        point((x, y - 1.5, z + 2.4), (1.0, 0.6, 0.28), 260, 0.7)
    # 가까운 둑 가장자리의 돌등롱 줄 — 따뜻한 빛, 물 위로 번진다
    for i in range(15):
        x = -24 + i * 3.4
        y = -3.0 + math.sin(i * 0.8) * 0.6
        z = ground_z(x, y)
        if z is None:
            continue
        h, objs = place('stone_lantern_01', (x, y, z), rot=rng.uniform(0, 6.28), scale=1.0)
        lit(h, objs, (1.0, 0.5, 0.18, 1), 1.3, (0, 0, 1.65), 0.2)
        point((x, y - 0.3, z + 1.6), (1.0, 0.62, 0.28), 80, 0.2)
    reeds(42, -30, 24, -8, 0.8)
    for _ in range(9):
        x, y = rng.uniform(-26, 22), rng.uniform(-12, -4)
        z = ground_z(x, y)
        if z is not None:
            rock(x, y, z, rng.uniform(0.35, 1.0))
    ye = pier(7.0, -2.5, 9.0, 0.35)
    h, objs = place('stone_lantern_01', (7.0, ye - 0.2, 0.4), rot=0.0, scale=1.0)
    lit(h, objs, (1.0, 0.5, 0.18, 1), 1.3, (0, 0, 1.65), 0.2)
    point((7.0, ye - 0.2, 2.0), (1.0, 0.62, 0.3), 90, 0.2)
    fireflies(45)
    # 물 위의 배와 뗏목
    place('sail_boat_01', (9.2, 5.0, wz - 0.1), rot=1.2, scale=1.0)
    place('sail_boat_01', (4.5, 14.0, wz - 0.1), rot=0.6, scale=1.1)
    place('raft_01', (-8.0, 7.0, wz - 0.1), rot=-0.4, scale=1.1)
    place('sail_boat_01', (-14.0, 17.0, wz - 0.1), rot=2.3, scale=0.9)
    sun = bpy.data.lights.new('moon', 'SUN')
    sun.energy, sun.color, sun.angle = 1.4, (0.55, 0.7, 1.0), 0.05
    so = bpy.data.objects.new('moon', sun)
    so.rotation_euler = (math.radians(-77), 0, math.radians(8))
    sc.collection.objects.link(so)
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 14, 2.5))
    v = bpy.context.object
    v.scale = (90, 60, 5)
    vm = bpy.data.materials.new('fog')
    vm.use_nodes = True
    nt = vm.node_tree
    nt.nodes.clear()
    ov = nt.nodes.new('ShaderNodeOutputMaterial')
    vs = nt.nodes.new('ShaderNodeVolumePrincipled')
    vs.inputs['Density'].default_value = 0.010
    vs.inputs['Color'].default_value = (0.5, 0.65, 0.95, 1)
    nt.links.new(vs.outputs[0], ov.inputs['Volume'])
    v.data.materials.append(vm)
    bpy.ops.mesh.primitive_uv_sphere_add(radius=7, location=(-30, 150, 62))
    mo = bpy.context.object
    mm = bpy.data.materials.new('moon')
    mm.use_nodes = True
    mb = next(x for x in mm.node_tree.nodes if x.type == 'BSDF_PRINCIPLED')
    mb.inputs['Base Color'].default_value = (0.9, 0.95, 1.0, 1)
    mb.inputs['Emission Color'].default_value = (0.85, 0.92, 1.0, 1)
    mb.inputs['Emission Strength'].default_value = 14.0
    mo.data.materials.append(mm)
    bpy.ops.mesh.primitive_uv_sphere_add(radius=24, location=(-30, 160, 62))
    ho = bpy.context.object
    hm = bpy.data.materials.new('halo')
    hm.use_nodes = True
    try:
        hm.surface_render_method = 'BLENDED'
    except Exception:
        pass
    nt = hm.node_tree
    nt.nodes.clear()
    e_ = nt.nodes.new('ShaderNodeEmission')
    e_.inputs['Color'].default_value = (0.65, 0.8, 1.0, 1)
    e_.inputs['Strength'].default_value = 0.9
    t_ = nt.nodes.new('ShaderNodeBsdfTransparent')
    lw = nt.nodes.new('ShaderNodeLayerWeight')
    lw.inputs['Blend'].default_value = 0.5
    pw = nt.nodes.new('ShaderNodeMath')
    pw.operation = 'POWER'
    pw.inputs[1].default_value = 0.45
    nt.links.new(lw.outputs['Facing'], pw.inputs[0])
    mx = nt.nodes.new('ShaderNodeMixShader')
    nt.links.new(pw.outputs[0], mx.inputs[0])
    nt.links.new(e_.outputs[0], mx.inputs[1])
    nt.links.new(t_.outputs[0], mx.inputs[2])
    o_ = nt.nodes.new('ShaderNodeOutputMaterial')
    nt.links.new(mx.outputs[0], o_.inputs['Surface'])
    ho.data.materials.append(hm)
    ho.visible_shadow = False
    camera((-19.0, -13.0, 2.6), (5.0, 24, 6.0), lens=24)


def aurora_sky():
    w = bpy.data.worlds.new('aurora')
    sc.world = w
    w.use_nodes = True
    nt = w.node_tree
    nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputWorld')
    bg = nt.nodes.new('ShaderNodeBackground')
    tc = nt.nodes.new('ShaderNodeTexCoord')
    sep = nt.nodes.new('ShaderNodeSeparateXYZ')
    nt.links.new(tc.outputs['Generated'], sep.inputs[0])
    ramp = nt.nodes.new('ShaderNodeValToRGB')       # 지평선 장밋빛 -> 남색
    ramp.color_ramp.elements[0].position, ramp.color_ramp.elements[1].position = 0.45, 0.9
    ramp.color_ramp.elements[0].color = (0.17, 0.09, 0.2, 1)
    ramp.color_ramp.elements[1].color = (0.006, 0.012, 0.05, 1)
    nt.links.new(sep.outputs['Z'], ramp.inputs['Fac'])
    vor = nt.nodes.new('ShaderNodeTexVoronoi')
    vor.inputs['Scale'].default_value = 240
    nt.links.new(tc.outputs['Generated'], vor.inputs['Vector'])
    star = nt.nodes.new('ShaderNodeMath')
    star.operation = 'LESS_THAN'
    nt.links.new(vor.outputs['Distance'], star.inputs[0])
    star.inputs[1].default_value = 0.03
    sm = nt.nodes.new('ShaderNodeMath')
    sm.operation = 'MULTIPLY'
    sm.inputs[1].default_value = 5.0
    nt.links.new(star.outputs[0], sm.inputs[0])
    # 오로라 장막: 세로로 긴 잡음 줄기 x 높이 대역
    mp = nt.nodes.new('ShaderNodeMapping')
    mp.inputs['Scale'].default_value = (4.5, 1.6, 0.45)
    nt.links.new(tc.outputs['Generated'], mp.inputs['Vector'])
    noi = nt.nodes.new('ShaderNodeTexNoise')
    noi.inputs['Detail'].default_value = 5.0
    noi.inputs['Distortion'].default_value = 0.4
    nt.links.new(mp.outputs[0], noi.inputs['Vector'])
    st = nt.nodes.new('ShaderNodeMapRange')
    st.inputs['From Min'].default_value, st.inputs['From Max'].default_value = 0.46, 0.72
    st.clamp = True
    nt.links.new(noi.outputs['Fac'], st.inputs['Value'])
    band = nt.nodes.new('ShaderNodeMapRange')
    band.inputs['From Min'].default_value, band.inputs['From Max'].default_value = 0.52, 0.62
    band.clamp = True
    nt.links.new(sep.outputs['Z'], band.inputs['Value'])
    band2 = nt.nodes.new('ShaderNodeMapRange')
    band2.inputs['From Min'].default_value, band2.inputs['From Max'].default_value = 0.92, 0.70
    band2.clamp = True
    nt.links.new(sep.outputs['Z'], band2.inputs['Value'])
    m1 = nt.nodes.new('ShaderNodeMath')
    m1.operation = 'MULTIPLY'
    nt.links.new(band.outputs[0], m1.inputs[0])
    nt.links.new(band2.outputs[0], m1.inputs[1])
    m2 = nt.nodes.new('ShaderNodeMath')
    m2.operation = 'MULTIPLY'
    nt.links.new(m1.outputs[0], m2.inputs[0])
    nt.links.new(st.outputs[0], m2.inputs[1])
    col = nt.nodes.new('ShaderNodeValToRGB')        # 아래 초록 -> 위 자주
    col.color_ramp.elements[0].position, col.color_ramp.elements[1].position = 0.55, 0.85
    col.color_ramp.elements[0].color = (0.08, 0.9, 0.38, 1)
    col.color_ramp.elements[1].color = (0.45, 0.2, 0.85, 1)
    nt.links.new(sep.outputs['Z'], col.inputs['Fac'])
    cm = nt.nodes.new('ShaderNodeMixRGB')
    cm.blend_type = 'MULTIPLY'
    cm.inputs['Fac'].default_value = 1.0
    nt.links.new(col.outputs[0], cm.inputs['Color1'])
    nt.links.new(m2.outputs[0], cm.inputs['Color2'])
    a1 = nt.nodes.new('ShaderNodeMixRGB')
    a1.blend_type = 'ADD'
    a1.inputs['Fac'].default_value = 1.0
    nt.links.new(ramp.outputs[0], a1.inputs['Color1'])
    nt.links.new(cm.outputs[0], a1.inputs['Color2'])
    a2 = nt.nodes.new('ShaderNodeMixRGB')
    a2.blend_type = 'ADD'
    a2.inputs['Fac'].default_value = 1.0
    nt.links.new(a1.outputs[0], a2.inputs['Color1'])
    nt.links.new(sm.outputs[0], a2.inputs['Color2'])
    nt.links.new(a2.outputs[0], bg.inputs['Color'])
    bg.inputs['Strength'].default_value = 1.0
    nt.links.new(bg.outputs[0], out.inputs[0])


def snow_terrain():
    import bmesh
    me = bpy.data.meshes.new('snowfield')
    o = bpy.data.objects.new('snow_ground', me)
    sc.collection.objects.link(o)
    bm = bmesh.new()
    n, size = 180, 220.0
    ph = [rng.uniform(0, 6.28) for _ in range(6)]
    vs = []
    for j in range(n + 1):
        row = []
        for i in range(n + 1):
            x, y = (i / n - 0.5) * size, (j / n - 0.22) * size
            roll = 0.55 * math.sin(x * 0.08 + ph[0]) + 0.35 * math.sin(y * 0.11 + ph[1]) + 0.18 * math.sin(x * 0.31 + y * 0.17 + ph[2])
            rise = max(0, y - 78) ** 1.2 * 0.17 * (1 + 0.55 * math.sin(x * 0.045 + ph[3]) + 0.35 * math.sin(x * 0.12 + ph[4]))
            side = max(0, abs(x) - 38) * 0.22 * (1 + 0.4 * math.sin(y * 0.07 + ph[5]))
            trail = -0.25 * math.exp(-((x - 0.8 * math.sin(y * 0.05)) / 3.0) ** 2) if y > 0 else 0
            row.append(bm.verts.new((x, y, roll + rise + side + trail)))
        vs.append(row)
    for j in range(n):
        for i in range(n):
            bm.faces.new((vs[j][i], vs[j][i + 1], vs[j + 1][i + 1], vs[j + 1][i]))
    bm.to_mesh(me)
    bm.free()
    for p_ in me.polygons:
        p_.use_smooth = True
    o.data.materials.append(pbr_blend('snow_02', 'cliff_side', 999.0, 1000.0, 0.42, 0.7, 4.0, 10.0, (1.0, 1.0, 1.0, 1), (0.55, 0.6, 0.75, 1), 'snowfield', 1.0, 0.25) if PBR else mat_simple('snow', (0.42, 0.52, 0.72, 1), 0.55))
    return o


def snow_pine(x, y, z, s):
    g = mat_simple('pine_g', (0.01, 0.045, 0.035, 1), 0.95)
    w = mat_simple('snowcap', (0.78, 0.85, 0.97, 1), 0.6)
    for r, h, dz in ((1.5, 2.6, 1.0), (1.15, 2.3, 2.3), (0.75, 2.0, 3.5)):
        bpy.ops.mesh.primitive_cone_add(vertices=7, radius1=r * s, radius2=0.0, depth=h * s, location=(x, y, z + dz * s))
        bpy.context.object.data.materials.append(g)
        bpy.ops.mesh.primitive_cone_add(vertices=7, radius1=r * s * 1.04, radius2=0.0, depth=h * s * 0.62, location=(x, y, z + (dz + h * 0.22) * s))
        bpy.context.object.data.materials.append(w)
    bpy.ops.mesh.primitive_cylinder_add(vertices=6, radius=0.18 * s, depth=1.4 * s, location=(x, y, z + 0.5 * s))
    bpy.context.object.data.materials.append(g)


def snowfall(n):
    m = mat_simple('flake', (1, 1, 1, 1), 0.5, (0.9, 0.95, 1.0, 1), 6.0)
    for _ in range(n):
        x, y, z = rng.uniform(-14, 14), rng.uniform(-10, 40), rng.uniform(0.3, 9)
        bpy.ops.mesh.primitive_uv_sphere_add(radius=rng.uniform(0.012, 0.03) * (1 + y / 40), segments=6, ring_count=4, location=(x, y, z))
        bpy.context.object.data.materials.append(m)


def frost_peak():
    aurora_sky()
    snow_terrain()
    bpy.context.view_layer.update()
    for i in range(9):                                  # 횃불 길
        y = -3 + i * 5.2
        cx = 0.8 * math.sin(y * 0.05)
        for sx in (-3.4, 3.4):
            x = cx + sx
            z = ground_z(x, y)
            if z is None:
                continue
            h, objs = place('torch_stand_01', (x, y, z), rot=rng.uniform(0, 6.28), scale=1.3)
            lit(h, objs, (1.0, 0.4, 0.1, 1), 1.5, (0, 0, 2.4), 0.14)
            point((x, y, z + 2.2), (1.0, 0.5, 0.2), 140, 0.3)
    z = ground_z(1.2, 43)                               # 길 끝 제단·비석·깃발
    h, objs = place('altar_01', (1.2, 43, z - 0.05), rot=0.0, scale=1.8)
    emissive(objs, (0.55, 0.8, 1.0, 1), 1.2)
    point((1.2, 41, z + 3.0), (0.55, 0.8, 1.0), 400, 0.6)
    for sx in (-7, 8):
        z = ground_z(sx, 40)
        if z is not None:
            place('stele_01', (sx, 40, z - 0.05), rot=rng.uniform(-0.3, 0.3), scale=1.6)
    for sx in (-5.5, 6.0):
        z = ground_z(sx, 36)
        if z is not None:
            place('banner_pole_01', (sx, 36, z - 0.05), rot=0.0, scale=1.5)
    pine_g, pine_w = [], []
    c = 0                                               # 눈 덮인 소나무 숲
    for _ in range(9000):
        x, y = rng.uniform(-48, 48), rng.uniform(8, 78)
        if abs(x - 0.8 * math.sin(y * 0.05)) < 7.5:
            continue
        z = ground_z(x, y)
        if z is None:
            continue
        s_ = rng.uniform(1.0, 2.3)
        zz = z - 0.1
        for r_, h_, dz_ in ((1.5, 2.6, 1.0), (1.15, 2.3, 2.3), (0.75, 2.0, 3.5)):
            pine_g.append((x, y, zz + dz_ * s_ - h_ * s_ / 2, r_ * s_, h_ * s_, 0.0, 0.0))
            pine_w.append((x, y, zz + (dz_ + h_ * 0.22) * s_ - h_ * s_ * 0.31, r_ * s_ * 1.04, h_ * s_ * 0.62, 0.0, 0.0))
        pine_g.append((x, y, zz + 0.5 * s_ - 0.7 * s_, 0.18 * s_, 1.4 * s_, 0.0, 0.0))
        c += 1
        if c >= 150:
            break
    cone_mesh('pines_g', pine_g, mat_simple('pine_g', (0.01, 0.045, 0.035, 1), 0.95), sides=7)
    cone_mesh('pines_w', pine_w, mat_simple('snowcap', (0.78, 0.85, 0.97, 1), 0.6), sides=7)
    for _ in range(14):
        x, y = rng.uniform(-20, 20), rng.uniform(-8, 24)
        if abs(x - 0.8 * math.sin(y * 0.05)) < 4.5:
            continue
        z = ground_z(x, y)
        if z is not None:
            rock(x, y, z - 0.1, rng.uniform(0.5, 1.4))
    snowfall(260)
    sun = bpy.data.lights.new('moon', 'SUN')
    sun.energy, sun.color, sun.angle = 3.2, (0.6, 0.75, 1.0), 0.04
    so = bpy.data.objects.new('moon', sun)
    so.rotation_euler = (math.radians(-60), 0, math.radians(35))
    sc.collection.objects.link(so)
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 35, 5.0))
    v = bpy.context.object
    v.scale = (110, 100, 10)
    vm = bpy.data.materials.new('fog')
    vm.use_nodes = True
    nt = vm.node_tree
    nt.nodes.clear()
    ov = nt.nodes.new('ShaderNodeOutputMaterial')
    vs = nt.nodes.new('ShaderNodeVolumePrincipled')
    vs.inputs['Density'].default_value = 0.0035
    vs.inputs['Color'].default_value = (0.6, 0.75, 1.0, 1)
    nt.links.new(vs.outputs[0], ov.inputs['Volume'])
    v.data.materials.append(vm)
    camera((2.2, -11.0, 1.9), (0.5, 40, 21.0), lens=22)


def rift_sky():
    w = bpy.data.worlds.new('riftsky')
    sc.world = w
    w.use_nodes = True
    nt = w.node_tree
    nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputWorld')
    bg = nt.nodes.new('ShaderNodeBackground')
    tc = nt.nodes.new('ShaderNodeTexCoord')
    sep = nt.nodes.new('ShaderNodeSeparateXYZ')
    nt.links.new(tc.outputs['Generated'], sep.inputs[0])
    ramp = nt.nodes.new('ShaderNodeValToRGB')       # 지평선 황금 -> 청록 -> 짙은 보라
    ramp.color_ramp.elements[0].position, ramp.color_ramp.elements[1].position = 0.40, 0.88
    ramp.color_ramp.elements[0].color = (0.95, 0.42, 0.18, 1)
    ramp.color_ramp.elements[1].color = (0.02, 0.015, 0.12, 1)
    mid = ramp.color_ramp.elements.new(0.62)
    mid.color = (0.06, 0.22, 0.4, 1)
    nt.links.new(sep.outputs['Z'], ramp.inputs['Fac'])
    vor = nt.nodes.new('ShaderNodeTexVoronoi')
    vor.inputs['Scale'].default_value = 200
    nt.links.new(tc.outputs['Generated'], vor.inputs['Vector'])
    star = nt.nodes.new('ShaderNodeMath')
    star.operation = 'LESS_THAN'
    nt.links.new(vor.outputs['Distance'], star.inputs[0])
    star.inputs[1].default_value = 0.025
    sm = nt.nodes.new('ShaderNodeMath')
    sm.operation = 'MULTIPLY'
    sm.inputs[1].default_value = 3.0
    nt.links.new(star.outputs[0], sm.inputs[0])
    add = nt.nodes.new('ShaderNodeMixRGB')
    add.blend_type = 'ADD'
    add.inputs['Fac'].default_value = 1.0
    nt.links.new(ramp.outputs[0], add.inputs['Color1'])
    nt.links.new(sm.outputs[0], add.inputs['Color2'])
    nt.links.new(add.outputs[0], bg.inputs['Color'])
    bg.inputs['Strength'].default_value = 0.75
    nt.links.new(bg.outputs[0], out.inputs[0])


def floating_island(cx, cy, cz, R, depth, seed, top_mat, rock_mat):
    import bmesh
    r2 = random.Random(seed)
    me = bpy.data.meshes.new('isl')
    o = bpy.data.objects.new('isl', me)
    sc.collection.objects.link(o)
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=4, radius=1.0)
    ph = [r2.uniform(0, 6.28) for _ in range(4)]
    for v in bm.verts:
        x, y, z = v.co
        jag = 1 + 0.28 * math.sin(x * 4.1 + ph[0]) * math.sin(y * 3.7 + ph[1]) + 0.2 * math.sin(z * 5.3 + ph[2] + x * 2)
        if z > 0.0:
            v.co = (x * R, y * R, 0.0 + 0.06 * R * math.sin(x * 5 + ph[3]) * (1 - z))
        else:
            k = (1 + z)
            v.co = (x * R * jag * (0.55 + 0.45 * k), y * R * jag * (0.55 + 0.45 * k), z * depth * jag)
    bm.to_mesh(me)
    bm.free()
    for p_ in me.polygons:
        p_.use_smooth = False
    me.materials.append(rock_mat)
    me.materials.append(top_mat)
    for p_ in me.polygons:
        if p_.normal.z > 0.8:
            p_.material_index = 1
    o.location = (cx, cy, cz)
    return o


def ring(loc, major, minor, rot, color, strength):
    bpy.ops.mesh.primitive_torus_add(location=loc, major_radius=major, minor_radius=minor, major_segments=72, minor_segments=10)
    t = bpy.context.object
    t.rotation_euler = rot
    t.data.materials.append(mat_simple('ring%d' % int(strength * 10), (0.05, 0.05, 0.05, 1), 0.4, color, strength))
    return t


def time_rift():
    rift_sky()
    _ph = _json.load(open(os.path.join(PH, 'index.json'), encoding='utf-8')) if PBR else None
    rock_mat = pbr_mat('cliff_side', 6.0, tint=(0.62, 0.62, 0.7, 1), name='isl_rock', sat=0.3) if PBR else mat_simple('isl_rock', (0.07, 0.06, 0.07, 1), 0.9)
    top_mat = pbr_mat('aerial_grass_rock', 4.0, tint=(0.7, 0.85, 0.65, 1), name='isl_top', sat=0.8) if PBR else mat_simple('isl_top', (0.08, 0.16, 0.12, 1), 0.85)
    plat_mat = mat_simple('plat', (0.18, 0.17, 0.2, 1), 0.7)
    # 중앙 섬: 관측소 탑과 돔
    floating_island(0, 0, 0, 16, 11, 3, top_mat, rock_mat)
    bpy.ops.mesh.primitive_cylinder_add(vertices=40, radius=9.5, depth=0.5, location=(0, 0, 0.2))
    bpy.context.object.data.materials.append(plat_mat)
    h, objs = place('stone_tower_01', (0, 0, 0.4), rot=0.3, scale=1.1, real=PBR)
    emissive(objs, (0.4, 0.9, 1.0, 1), 0.25)
    h, objs = place('future_dome_01', (-9.5, 3.5, 0.4), rot=0.8, scale=0.9)
    emissive(objs, (0.4, 0.9, 1.0, 1), 0.35)
    # 시간 기둥: 빛나는 비석이 원을 이룬다
    for i in range(8):
        a = i / 8 * 6.2832 + 0.2
        x, y = 12.2 * math.cos(a), 12.2 * math.sin(a)
        h, objs = place('stele_01', (x, y, 0.0), rot=a, scale=1.7)
        emissive(objs, (0.3, 0.85, 1.0, 1), 2.0)
        point((x, y, 2.2), (0.3, 0.8, 1.0), 160, 0.4)
    # 탑을 도는 시간 고리(자이로)
    ring((0, 0, 14), 11.5, 0.16, (1.2, 0.2, 0.0), (1.0, 0.75, 0.3, 1), 2.2)
    ring((0, 0, 14), 13.5, 0.12, (0.35, 1.1, 0.4), (0.4, 0.9, 1.0, 1), 2.2)
    ring((0, 0, 14), 9.5, 0.1, (-0.6, 0.5, 1.0), (1.0, 0.75, 0.3, 1), 1.8)
    # 떠다니는 섬과 돌조각
    for k, (x, y, z, R) in enumerate(((-38, 30, 4, 7), (34, 40, 10, 9), (20, -30, -3, 5), (-22, -34, 6, 6), (55, 10, 14, 8))):
        isl = floating_island(x, y, z, R, R * 0.8, 10 + k, top_mat, rock_mat)
        point((x, y, z + 3), (1.0, 0.7, 0.4), 120, 0.5)
        if k % 2 == 0:
            place('stone_lantern_01', (x, y, z + 0.1), rot=0.4, scale=1.3)
            point((x, y, z + 2.0), (1.0, 0.65, 0.3), 90, 0.2)
    for _ in range(36):
        a = rng.uniform(0, 6.28)
        d = rng.uniform(18, 60)
        rock(d * math.cos(a), d * math.sin(a), rng.uniform(-6, 24), rng.uniform(0.5, 1.8))
    # 하늘의 균열: 먼 고리 두 겹과 빛
    ring((-10, 220, 70), 52, 1.6, (1.45, 0.0, 0.25), (0.45, 0.95, 1.0, 1), 3.5)
    ring((-10, 222, 70), 38, 0.9, (1.45, 0.0, 0.25), (1.0, 0.8, 0.45, 1), 2.5)
    point((-10, 200, 70), (0.45, 0.9, 1.0), 4000, 20)
    # 구름바다: 낮게 깔린 두꺼운 안개 + 황금빛 구름 층
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 40, -22))
    v = bpy.context.object
    v.scale = (400, 400, 20)
    vm = bpy.data.materials.new('clouds')
    vm.use_nodes = True
    nt = vm.node_tree
    nt.nodes.clear()
    ov = nt.nodes.new('ShaderNodeOutputMaterial')
    vs = nt.nodes.new('ShaderNodeVolumePrincipled')
    vs.inputs['Density'].default_value = 0.035
    vs.inputs['Color'].default_value = (1.0, 0.78, 0.62, 1)
    vs.inputs['Emission Strength'].default_value = 0.05
    vs.inputs['Emission Color'].default_value = (1.0, 0.6, 0.4, 1)
    nt.links.new(vs.outputs[0], ov.inputs['Volume'])
    v.data.materials.append(vm)
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 20, 10))
    v2 = bpy.context.object
    v2.scale = (200, 160, 40)
    fm = bpy.data.materials.new('fog2')
    fm.use_nodes = True
    nt = fm.node_tree
    nt.nodes.clear()
    ov = nt.nodes.new('ShaderNodeOutputMaterial')
    vs = nt.nodes.new('ShaderNodeVolumePrincipled')
    vs.inputs["Density"].default_value = 0.0002
    vs.inputs['Color'].default_value = (0.8, 0.85, 1.0, 1)
    nt.links.new(vs.outputs[0], ov.inputs['Volume'])
    v2.data.materials.append(fm)
    sun = bpy.data.lights.new('sun', 'SUN')
    sun.energy, sun.color, sun.angle = 2.6, (1.0, 0.68, 0.38), 0.03
    so = bpy.data.objects.new('sun', sun)
    so.rotation_euler = (math.radians(80), 0, math.radians(-55))
    sc.collection.objects.link(so)
    camera((-26.0, -62.0, 5.0), (0.0, 6.0, 19.0), lens=24)


def plain_terrain(green=False):
    import bmesh
    me = bpy.data.meshes.new('plain')
    o = bpy.data.objects.new('plain_ground', me)
    sc.collection.objects.link(o)
    bm = bmesh.new()
    n, size = 170, 260.0
    ph = [rng.uniform(0, 6.28) for _ in range(5)]
    vs = []
    for j in range(n + 1):
        row = []
        for i in range(n + 1):
            x, y = (i / n - 0.5) * size, (j / n - 0.15) * size
            d = math.hypot(x, y - 40)
            flat = min(1.0, max(0.0, (d - 26) / 34))
            roll = (0.9 * math.sin(x * 0.06 + ph[0]) + 0.6 * math.sin(y * 0.07 + ph[1]) + 0.3 * math.sin(x * 0.2 + y * 0.13 + ph[2])) * flat
            hills = max(0, d - 60) * 0.18 * (1 + 0.5 * math.sin(x * 0.04 + ph[3]) + 0.3 * math.sin(y * 0.06 + ph[4]))
            row.append(bm.verts.new((x, y, roll + hills)))
        vs.append(row)
    for j in range(n):
        for i in range(n):
            bm.faces.new((vs[j][i], vs[j][i + 1], vs[j + 1][i + 1], vs[j + 1][i]))
    bm.to_mesh(me)
    bm.free()
    for p_ in me.polygons:
        p_.use_smooth = True
    if green:
        o.data.materials.append(pbr_mat('aerial_grass_rock', 5.0, tint=(1.1, 1.25, 0.9, 1)) if PBR else mat_simple('meadow', (0.16, 0.3, 0.1, 1), 0.9))
    else:
        o.data.materials.append(pbr_mat('aerial_grass_rock', 5.0, tint=(0.8, 0.85, 1.0, 1)) if PBR else mat_simple('meadow', (0.035, 0.07, 0.05, 1), 0.9))
    return o


def road(p0, p1, width, mat, z=0.06):
    dx, dy = p1[0] - p0[0], p1[1] - p0[1]
    ln = math.hypot(dx, dy)
    bpy.ops.mesh.primitive_cube_add(size=1, location=((p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2, z))
    o = bpy.context.object
    o.scale = (ln, width, 0.05)
    o.rotation_euler = (0, 0, math.atan2(dy, dx))
    o.data.materials.append(mat)
    return o


def line_along(p0, p1, spacing, side, fn):
    dx, dy = p1[0] - p0[0], p1[1] - p0[1]
    ln = math.hypot(dx, dy)
    ux, uy = dx / ln, dy / ln
    nx, ny = -uy, ux
    k = 0
    t = spacing
    while t < ln:
        for s in (-side, side):
            x, y = p0[0] + ux * t + nx * s, p0[1] + uy * t + ny * s
            z = ground_z(x, y)
            if z is not None:
                fn(x, y, z, k)
        t += spacing
        k += 1


def crossroads():
    rift_sky()
    wn = sc.world.node_tree.nodes
    ce = wn['Color Ramp'].color_ramp.elements
    ce[0].color = (0.30, 0.12, 0.28, 1)
    ce[1].color = (0.01, 0.012, 0.09, 1)
    ce[2].color = (0.04, 0.10, 0.26, 1)
    wn['Background'].inputs['Strength'].default_value = 0.9
    plain_terrain()
    bpy.context.view_layer.update()
    dirt = pbr_mat('brown_mud', 3.0, tint=(1.0, 0.95, 0.95, 1)) if PBR else mat_simple('dirt', (0.09, 0.06, 0.04, 1), 0.95)
    asph = pbr_mat('bitumen', 3.0, tint=(0.95, 0.97, 1.0, 1)) if PBR else mat_simple('asphalt', (0.03, 0.03, 0.035, 1), 0.55)
    neon = mat_simple('neonroad', (0.01, 0.02, 0.03, 1), 0.3, (0.1, 0.9, 1.0, 1), 1.2)
    edge = mat_simple('neonedge', (0.01, 0.01, 0.01, 1), 0.3, (1.0, 0.2, 0.8, 1), 7.0)
    J = (0.0, 40.0)
    # 오는 길(과거 흙길) -> 갈림길, 세 갈래: 왼쪽 과거(흙+등롱+한옥), 가운데 현재(아스팔트+가로등+건물), 오른쪽 미래(네온+기둥+돔)
    road_mesh((0, -14), J, 6.0, dirt)
    road_mesh(J, (-52, 78), 6.0, dirt)
    road_mesh(J, (0, 105), 6.5, asph)
    road_mesh(J, (52, 78), 6.0, neon)
    for sx in (-1, 1):                                  # 미래 길 가장자리 선
        dxn = 52 / math.hypot(52, 38)
        dyn = 38 / math.hypot(52, 38)
        road((J[0] + sx * 3.0 * dyn, J[1] - sx * 3.0 * dxn + 0.0), (52 + sx * 3.0 * dyn, 78 - sx * 3.0 * dxn), 0.18, edge, z=0.1) if sx == 1 else None
    # 길 중앙 노면선(현재 길)
    road((0, 44), (0, 105), 0.18, mat_simple('stripe', (0.9, 0.8, 0.3, 1), 0.5), z=0.1)

    def lantern(x, y, z, k):
        h, objs = place('stone_lantern_01', (x, y, z), rot=rng.uniform(0, 6.28), scale=1.0)
        lit(h, objs, (1.0, 0.5, 0.18, 1), 1.4, (0, 0, 1.65), 0.2)
        point((x, y, z + 1.5), (1.0, 0.6, 0.28), 70, 0.2)

    def lamp(x, y, z, k):
        h, objs = place('street_lamp_01', (x, y, z), rot=0.0, scale=1.3)
        lit(h, objs, (0.85, 0.92, 1.0, 1), 1.2, (0.95, 0, 4.2), 0.2)
        point((x, y, z + 4.6), (0.85, 0.92, 1.0), 150, 0.3)

    def pylon(x, y, z, k):
        h, objs = place('signal_pylon_01', (x, y, z), rot=rng.uniform(0, 6.28), scale=1.0)
        c = (1.0, 0.25, 0.85, 1) if k % 2 else (0.2, 0.95, 1.0, 1)
        lit(h, objs, c, 2.6, (0, 0, 3.45), 0.24)
        point((x, y, z + 4.0), c[:3], 200, 0.3)

    line_along((0, -14), J, 7.0, 4.0, lantern)
    line_along(J, (-52, 78), 7.5, 4.2, lantern)
    line_along(J, (0, 105), 11.0, 4.6, lamp)
    line_along(J, (52, 78), 9.0, 4.2, pylon)
    # 시대별 건물
    for (x, y, nm, sc_) in ((-26, 66, 'hanok_01', 1.4), (-40, 52, 'hanok_01', 1.2), (-12, 82, 'jp_minka_01', 1.2)):
        z = ground_z(x, y)
        if z is not None:
            h, objs = place(nm, (x, y, z), rot=rng.uniform(-0.6, 0.6), scale=sc_, real=PBR)
            emissive(objs, (1.0, 0.6, 0.28, 1), 0.12)
            point((x, y - 1.5, z + 2.5), (1.0, 0.6, 0.28), 70, 0.7)
    for (x, y, nm, sc_) in ((9, 70, 'modern_block_01', 1.1), (-9, 92, 'modern_block_01', 1.3)):
        z = ground_z(x, y)
        if z is not None:
            h, objs = place(nm, (x, y, z), rot=0.0, scale=sc_, real=PBR)
            emissive(objs, (0.85, 0.92, 1.0, 1), 0.12)
    for (x, y) in ((30, 66), (46, 84)):
        z = ground_z(x, y)
        if z is not None:
            h, objs = place('future_dome_01', (x, y, z), rot=rng.uniform(0, 6), scale=1.3)
            emissive(objs, (0.3, 0.9, 1.0, 1), 0.3)
            point((x, y, z + 4), (0.3, 0.9, 1.0), 120, 1.0)
    # 갈림길 한복판: 균열 문(고리 + 안쪽 소용돌이 빛) + 갈래 표지석
    ring((J[0], J[1], 7.0), 6.0, 0.28, (math.pi / 2, 0, 0), (0.4, 0.9, 1.0, 1), 3.0)
    ring((J[0], J[1], 7.0), 4.4, 0.12, (math.pi / 2, 0, 0), (1.0, 0.35, 0.85, 1), 2.6)
    bpy.ops.mesh.primitive_circle_add(vertices=64, radius=5.7, fill_type='NGON', location=(J[0], J[1], 7.0), rotation=(math.pi / 2, 0, 0))
    gate = bpy.context.object
    gm = bpy.data.materials.new('gate')
    gm.use_nodes = True
    try:
        gm.surface_render_method = 'BLENDED'
    except Exception:
        pass
    nt = gm.node_tree
    nt.nodes.clear()
    tcg = nt.nodes.new('ShaderNodeTexCoord')
    nz = nt.nodes.new('ShaderNodeTexNoise')
    nz.inputs['Scale'].default_value = 3.0
    nz.inputs['Detail'].default_value = 4.0
    nz.inputs['Distortion'].default_value = 1.6
    nt.links.new(tcg.outputs['Object'], nz.inputs['Vector'])
    cr = nt.nodes.new('ShaderNodeValToRGB')
    cr.color_ramp.elements[0].color = (0.1, 0.9, 1.0, 1)
    cr.color_ramp.elements[1].color = (1.0, 0.3, 0.9, 1)
    nt.links.new(nz.outputs['Fac'], cr.inputs['Fac'])
    em = nt.nodes.new('ShaderNodeEmission')
    em.inputs['Strength'].default_value = 1.0
    nt.links.new(cr.outputs[0], em.inputs['Color'])
    tr = nt.nodes.new('ShaderNodeBsdfTransparent')
    lw = nt.nodes.new('ShaderNodeLayerWeight')
    mx = nt.nodes.new('ShaderNodeMixShader')
    mx.inputs[0].default_value = 0.6
    nt.links.new(tr.outputs[0], mx.inputs[1])
    nt.links.new(em.outputs[0], mx.inputs[2])
    ou = nt.nodes.new('ShaderNodeOutputMaterial')
    nt.links.new(mx.outputs[0], ou.inputs['Surface'])
    gate.data.materials.append(gm)
    point((J[0], J[1] - 3, 7.0), (0.5, 0.8, 1.0), 450, 2.0)
    for ang, col in ((2.6, (1.0, 0.6, 0.25, 1)), (1.57, (0.85, 0.92, 1.0, 1)), (0.55, (0.3, 0.95, 1.0, 1))):
        x, y = J[0] + 9.0 * math.cos(ang), J[1] - 7 + 3.5 * math.sin(ang)
        z = ground_z(x, y)
        if z is not None:
            h, objs = place('stele_01', (x, y, z), rot=ang, scale=1.4)
            emissive(objs, col, 3.0)
            point((x, y, z + 2.2), col[:3], 90, 0.3)
    for _ in range(12):
        x, y = rng.uniform(-18, 18), rng.uniform(6, 34)
        if abs(x) < 4.5:
            continue
        z = ground_z(x, y)
        if z is not None:
            rock(x, y, z, rng.uniform(0.4, 1.0))
    if PBR:
        blade = mat_simple('blade', (0.05, 0.14, 0.05, 1), 0.7)
        specs = []
        for _ in range(520):
            x, y = rng.uniform(-22, 22), rng.uniform(-10, 34)
            if abs(x) < 3.4 and y < 40:
                continue
            z = ground_z(x, y)
            if z is None:
                continue
            for k in range(rng.randint(5, 9)):
                specs.append((x + rng.uniform(-0.2, 0.2), y + rng.uniform(-0.2, 0.2), z, 0.035, rng.uniform(0.25, 0.7),
                              rng.uniform(-0.35, 0.35), rng.uniform(-0.35, 0.35)))
        cone_mesh('tufts', specs, blade)
    fireflies(30)
    sun = bpy.data.lights.new('moon', 'SUN')
    sun.energy, sun.color, sun.angle = 0.9, (0.6, 0.7, 1.0), 0.05
    so = bpy.data.objects.new('moon', sun)
    so.rotation_euler = (math.radians(-70), 0, math.radians(20))
    sc.collection.objects.link(so)
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 40, 4))
    v = bpy.context.object
    v.scale = (200, 160, 8)
    vm = bpy.data.materials.new('fog')
    vm.use_nodes = True
    nt = vm.node_tree
    nt.nodes.clear()
    ov = nt.nodes.new('ShaderNodeOutputMaterial')
    vs = nt.nodes.new('ShaderNodeVolumePrincipled')
    vs.inputs['Density'].default_value = 0.003
    vs.inputs['Color'].default_value = (0.7, 0.75, 1.0, 1)
    nt.links.new(vs.outputs[0], ov.inputs['Volume'])
    v.data.materials.append(vm)
    camera((0.0, -6.0, 2.4), (0.0, 40, 6.0), lens=24)


def join_by_material(names):
    """같은 재질의 낱개 메시(풀잎·나뭇잎 뿔·반딧불 등)를 하나로 합친다 — 오브젝트 수천 개가 렌더 준비를 수 분씩 잡아먹는다."""
    for nm in names:
        objs = [o for o in bpy.data.objects if o.type == 'MESH' and o.parent is None and len(o.material_slots) == 1
                and o.material_slots[0].material and o.material_slots[0].material.name == nm]
        if len(objs) < 2:
            continue
        bpy.ops.object.select_all(action='DESELECT')
        for o in objs:
            o.select_set(True)
        bpy.context.view_layer.objects.active = objs[0]
        bpy.ops.object.join()


def day_sky():
    w = bpy.data.worlds.new('daysky')
    sc.world = w
    w.use_nodes = True
    nt = w.node_tree
    nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputWorld')
    bg = nt.nodes.new('ShaderNodeBackground')
    tc = nt.nodes.new('ShaderNodeTexCoord')
    sep = nt.nodes.new('ShaderNodeSeparateXYZ')
    nt.links.new(tc.outputs['Generated'], sep.inputs[0])
    def stage(a, b_, lo, hi, ca, cb):
        mr = nt.nodes.new('ShaderNodeMapRange')
        mr.inputs['From Min'].default_value, mr.inputs['From Max'].default_value = lo, hi
        mr.clamp = True
        nt.links.new(sep.outputs['Z'], mr.inputs['Value'])
        mx = nt.nodes.new('ShaderNodeMixRGB')
        nt.links.new(mr.outputs[0], mx.inputs['Fac'])
        if a is None:
            mx.inputs['Color1'].default_value = ca
        else:
            nt.links.new(a, mx.inputs['Color1'])
        mx.inputs['Color2'].default_value = cb
        return mx.outputs[0]
    # 지평선 복숭아빛 -> 맑은 하늘 -> 짙은 하늘(램프 노드가 이 월드에서 한 색으로 눌어 단계별 혼합으로 대체)
    s1 = stage(None, None, 0.0, 0.22, (1.0, 0.72, 0.5, 1), (0.32, 0.6, 0.92, 1))
    sky_out = stage(s1, None, 0.22, 0.85, None, (0.05, 0.2, 0.62, 1))

    class _R:
        outputs = [sky_out]
    ramp = _R()
    # 구름: 늘어진 잡음 문턱 -> 흰 덩이, 아랫면은 노을빛
    mp = nt.nodes.new('ShaderNodeMapping')
    mp.inputs['Scale'].default_value = (2.4, 2.4, 6.0)
    nt.links.new(tc.outputs['Generated'], mp.inputs['Vector'])
    noi = nt.nodes.new('ShaderNodeTexNoise')
    noi.inputs['Detail'].default_value = 6.0
    noi.inputs['Roughness'].default_value = 0.55
    nt.links.new(mp.outputs[0], noi.inputs['Vector'])
    cl = nt.nodes.new('ShaderNodeMapRange')
    cl.inputs['From Min'].default_value, cl.inputs['From Max'].default_value = 0.5, 0.68
    cl.clamp = True
    nt.links.new(noi.outputs['Fac'], cl.inputs['Value'])
    hz = nt.nodes.new('ShaderNodeMapRange')          # 지평선 근처·너무 높은 곳은 구름 약하게
    hz.inputs['From Min'].default_value, hz.inputs['From Max'].default_value = 0.03, 0.2
    hz.clamp = True
    nt.links.new(sep.outputs['Z'], hz.inputs['Value'])
    cm = nt.nodes.new('ShaderNodeMath')
    cm.operation = 'MULTIPLY'
    nt.links.new(cl.outputs[0], cm.inputs[0])
    nt.links.new(hz.outputs[0], cm.inputs[1])
    cmix = nt.nodes.new('ShaderNodeMixRGB')
    cmix.inputs['Color1'].default_value = (1.0, 0.82, 0.7, 1)
    cmix.inputs['Color2'].default_value = (1.0, 1.0, 1.0, 1)
    nt.links.new(sep.outputs['Z'], cmix.inputs['Fac'])
    fin = nt.nodes.new('ShaderNodeMixRGB')
    nt.links.new(cm.outputs[0], fin.inputs['Fac'])
    nt.links.new(sky_out, fin.inputs['Color1'])
    nt.links.new(cmix.outputs[0], fin.inputs['Color2'])
    nt.links.new(fin.outputs[0], bg.inputs['Color'])
    bg.inputs['Strength'].default_value = 1.15
    nt.links.new(bg.outputs[0], out.inputs[0])


def trees_round(specs, trunk_mat, leaf_mats):
    """둥근 활엽수(줄기 뿔 + 잎덩이 어긋난 구 셋)를 메시 둘(줄기·잎 색별)로 한꺼번에 만든다."""
    import bmesh
    trunks = []
    groups = [[] for _ in leaf_mats]
    for (x, y, z, s, ci) in specs:
        trunks.append((x, y, z, 0.28 * s, 2.4 * s, 0.0, 0.0))
        groups[ci].append((x, y, z + 2.0 * s, s))
    cone_mesh('trunks', trunks, trunk_mat, sides=6)
    for gi, gl in enumerate(groups):
        if not gl:
            continue
        me = bpy.data.meshes.new('leaves%d' % gi)
        bm = bmesh.new()
        for (x, y, z, s) in gl:
            for (ox, oy, oz, rr) in ((0, 0, 1.2, 1.7), (0.9, 0.3, 0.7, 1.3), (-0.8, -0.4, 0.8, 1.4)):
                mat = bmesh.ops.create_icosphere(bm, subdivisions=2, radius=rr * s)
                for v in mat['verts']:
                    v.co.x += x + ox * s
                    v.co.y += y + oy * s
                    v.co.z += z + oz * s
                    v.co += Vector((rng.uniform(-0.12, 0.12), rng.uniform(-0.12, 0.12), rng.uniform(-0.1, 0.1))) * s
        bm.to_mesh(me)
        bm.free()
        for p_ in me.polygons:
            p_.use_smooth = True
        o = bpy.data.objects.new('leaves%d' % gi, me)
        sc.collection.objects.link(o)
        me.materials.append(leaf_mats[gi])


def flowers(n, colors, xr, yr, avoid=None):
    for ci, col in enumerate(colors):
        specs = []
        for _ in range(n):
            x, y = rng.uniform(*xr), rng.uniform(*yr)
            if avoid and avoid(x, y):
                continue
            z = ground_z(x, y)
            if z is None:
                continue
            for k in range(rng.randint(3, 6)):
                specs.append((x + rng.uniform(-0.15, 0.15), y + rng.uniform(-0.15, 0.15), z, 0.025, rng.uniform(0.14, 0.28), rng.uniform(-0.2, 0.2), rng.uniform(-0.2, 0.2)))
        cone_mesh('flowers%d' % ci, specs, mat_simple('flower%d' % ci, col, 0.6), sides=5)


def village():
    day_sky()
    plain_terrain(green=True)
    bpy.context.view_layer.update()
    J = (0.0, 40.0)
    dirt = pbr_mat('brown_mud', 3.0, tint=(1.1, 1.0, 0.9, 1)) if PBR else mat_simple('dirt', (0.35, 0.25, 0.15, 1), 0.95)
    stone = pbr_mat('cobblestone_floor_01', 3.0, tint=(1.0, 1.0, 1.0, 1)) if PBR else mat_simple('cobble', (0.4, 0.38, 0.35, 1), 0.9)
    road_mesh((0, -14), (0, 33), 5.5, dirt)
    road_mesh((-6, 40), (-50, 52), 4.0, dirt)
    road_mesh((6, 40), (50, 56), 4.0, dirt)
    # 광장(둥근 돌바닥) — 우물과 깃발
    bpy.ops.mesh.primitive_cylinder_add(vertices=48, radius=9.0, depth=0.12, location=(J[0], J[1], (ground_z(J[0], J[1]) or 0.0) + 0.03))
    bpy.context.object.data.materials.append(stone)
    zc = ground_z(J[0], J[1]) or 0.0
    h, objs = place('well_01', (J[0], J[1], zc), rot=0.0, scale=1.5)
    for ang in (0.9, 2.3, 3.9, 5.4):
        x, y = J[0] + 6.5 * math.cos(ang), J[1] + 6.5 * math.sin(ang)
        z = ground_z(x, y)
        if z is not None:
            place('banner_pole_01', (x, y, z), rot=ang, scale=1.4)
    # 시대가 섞인 집들: 왼쪽 과거(한옥·초가), 오른쪽 현재·미래(여관·현대 블록·돔), 뒤쪽 헛간
    spots_ = (
        ('hanok_01', -16, 34, 0.0, 1.3), ('hanok_01', -26, 46, 0.4, 1.2), ('jp_minka_01', -12, 52, 0.2, 1.2),
        ('forest_cottage_01', -34, 60, 0.6, 1.2), ('inn_01', 16, 36, 3.0, 1.2), ('modern_block_01', 22, 52, 3.3, 1.3),
        ('future_dome_01', 36, 62, 3.6, 1.4), ('barn_01', -6, 70, 0.0, 1.3), ('chinese_hall_01', 8, 74, 3.2, 1.0))
    for (nm, x, y, r, s) in spots_:
        z = ground_z(x, y)
        if z is None:
            continue
        h, objs = place(nm, (x, y, z - 0.05), rot=r, scale=s)
        point((x, y - 2.0, z + 2.5), (1.0, 0.8, 0.5), 60, 1.0)
    for (nm, x, y, r, s) in (('haystack_01', -22, 66, 0.5, 1.2), ('haystack_01', -3, 80, 1.0, 1.1), ('ox_cart_01', -10, 18, 0.7, 1.1),
                             ('mailbox_01', 5, 6, 0.0, 1.2), ('street_lamp_01', 12, 44, 0.0, 1.2), ('wood_fence_01', -9, 22, 1.57, 1.0)):
        z = ground_z(x, y)
        if z is not None:
            place(nm, (x, y, z), rot=r, scale=s)
    # 나무: 길가·집 뒤 숲(잎 색 셋: 초록·연두·단풍)
    leaf = [mat_simple('leaf0', (0.08, 0.2, 0.06, 1), 0.8), mat_simple('leaf1', (0.16, 0.3, 0.08, 1), 0.8), mat_simple('leaf2', (0.45, 0.2, 0.05, 1), 0.8)]
    trunk = mat_simple('trunkm', (0.12, 0.07, 0.04, 1), 0.9)
    specs = []
    for _ in range(4000):
        x, y = rng.uniform(-60, 60), rng.uniform(-6, 96)
        if y < 20 and abs(x) < 34:
            continue
        if abs(x) < 7 and y < 38:
            continue
        if math.hypot(x - J[0], y - J[1]) < 13:
            continue
        if any(math.hypot(x - s[1], y - s[2]) < 9 for s in spots_):
            continue
        z = ground_z(x, y)
        if z is None:
            continue
        specs.append((x, y, z - 0.1, rng.uniform(0.7, 1.35), rng.choice((0, 0, 1, 1, 2))))
        if len(specs) >= 130:
            break
    trees_round(specs, trunk, leaf)
    flowers(70, ((1.0, 0.85, 0.2, 1), (0.95, 0.4, 0.55, 1), (0.95, 0.95, 1.0, 1), (0.6, 0.5, 1.0, 1)), (-24, 24), (-8, 34), avoid=lambda x, y: abs(x) < 3.4 and y < 36)
    if PBR:
        blade = mat_simple('blade', (0.2, 0.42, 0.15, 1), 0.7)
        specs2 = []
        for _ in range(500):
            x, y = rng.uniform(-24, 24), rng.uniform(-8, 40)
            if abs(x) < 3.4 and y < 38:
                continue
            z = ground_z(x, y)
            if z is None:
                continue
            for k in range(rng.randint(5, 9)):
                specs2.append((x + rng.uniform(-0.2, 0.2), y + rng.uniform(-0.2, 0.2), z, 0.035, rng.uniform(0.25, 0.6), rng.uniform(-0.3, 0.3), rng.uniform(-0.3, 0.3)))
        cone_mesh('tufts', specs2, blade)
    # 햇빛: 낮게 깔린 따뜻한 오후 해, 먼지 낀 공기(빛줄기)
    sun = bpy.data.lights.new('sun', 'SUN')
    sun.energy, sun.color, sun.angle = 4.2, (1.0, 0.82, 0.58), 0.02
    so = bpy.data.objects.new('sun', sun)
    so.rotation_euler = (math.radians(62), 0, math.radians(-38))
    sc.collection.objects.link(so)
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 40, 12))
    v = bpy.context.object
    v.scale = (160, 140, 24)
    vm = bpy.data.materials.new('haze')
    vm.use_nodes = True
    nt = vm.node_tree
    nt.nodes.clear()
    ov = nt.nodes.new('ShaderNodeOutputMaterial')
    vs = nt.nodes.new('ShaderNodeVolumePrincipled')
    vs.inputs['Density'].default_value = 0.0008
    vs.inputs['Color'].default_value = (1.0, 0.9, 0.8, 1)
    nt.links.new(vs.outputs[0], ov.inputs['Volume'])
    v.data.materials.append(vm)
    camera((2.5, -9.0, 2.0), (-1.0, 42, 9.5), lens=24)


import time as _t
_T0 = _t.time()
{'galaxy_ferry': galaxy_ferry, 'frost_peak': frost_peak, 'time_rift': time_rift, 'crossroads': crossroads, 'village': village}[REGION]()
print('TIME build %.1fs' % (_t.time() - _T0))
join_by_material(['blade', 'reed', 'pine', 'pine_g', 'snowcap', 'firefly', 'flake', 'rockm', 'wood'])
sc.render.filepath = OUT
sc.render.image_settings.file_format = 'PNG'
print('TIME join %.1fs' % (_t.time() - _T0))
bpy.ops.render.render(write_still=True)
print('TIME render done %.1fs' % (_t.time() - _T0))
print('SAVED', OUT)
