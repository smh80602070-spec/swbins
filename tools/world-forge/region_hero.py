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
PBR = len(a) > 3 and a[3] == 'pbr'      # 사실 재질·사실 건물 모드(자체 PBR 땅 + 공방 real GLB)
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
from collections import OrderedDict
PH = os.path.join(ROOT, 'tools', 'world-forge', '_src', 'self')
REAL = os.path.join(ROOT, 'tools', 'world-forge', '_out')
_PHIDX = None


def pbr_mat(tid, tile=4.0, tint=None, rough_mul=1.0, name=None, sat=1.0):
    """자체 PBR 재질 세트를 월드 위치 기준 평면 투영으로 깐다(땅·길용). tile = 그림 한 장이 덮는 미터."""
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
PIECE_OBJS = set()      # place() 로 놓은 조각 오브젝트 이름 — 내보낼 때 자잘한 코드 메시에서 뺀다
LAYOUT = {'pieces': [], 'roads': [], 'trees': [], 'flowers': [], 'plaza': None}   # 엔진이 같은 장면을 다시 짜는 배치표(HERO_LAYOUT 환경변수가 있으면 파일로 씀)


def place(name, loc, rot=0.0, scale=1.0, real=None):
    """공방 조각 하나를 놓는다. 같은 조각은 처음 한 번만 읽고 나머지는 메시·재질을 공유하는 복사본 — 사실 모드 소품 GLB 는 8~30MB 라
    스무 번 읽으면 메모리·시간이 폭발한다. real=None 이면 사실 모드(PBR)일 때 real GLB(없으면 툰)를 쓴다."""
    use_real = PBR if real is None else real
    PIECES = os.path.join(ROOT, 'saga-assets', 'regions', 'pieces')
    if use_real and os.path.exists(os.path.join(REAL, name + '.glb')):
        src_dir = REAL
    elif os.path.exists(os.path.join(PIECES, name + '.glb')):
        src_dir = PIECES         # 지역 조각(툰 GLB 1024px) 먼저, 없으면 옛 월드 세트
    else:
        src_dir = TOON
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
    for o in mp.values():
        PIECE_OBJS.add(o.name)
    PIECE_OBJS.add(holder.name)
    holder.location, holder.rotation_euler, holder.scale = loc, (0, 0, rot), (scale,) * 3
    LAYOUT['pieces'].append({'piece': name, 'pos': [round(loc[0], 3), round(loc[1], 3), round(loc[2], 3)], 'rot': round(rot, 4), 'scale': round(scale, 3)})
    return holder, list(mp.values())


def glow(x, y, z, color, r, strength=18.0, stretch=1.0):
    m = mat_simple('glow%d_%d' % (int(color[0] * 9), int(color[2] * 9)), (0.05, 0.05, 0.05, 1), 0.5, color, strength)
    bpy.ops.mesh.primitive_uv_sphere_add(radius=r, segments=12, ring_count=8, location=(x, y, z))
    bpy.context.object.scale = (1, 1, stretch)
    bpy.context.object.data.materials.append(m)


def lit(h, objs, color, strength, local, r, fire=False):
    """불 켜는 소품: 툰은 통째로 발광, 사실 모드는 돌 질감이 보이게 약한 발광 + 불꽃 구슬(local = 소품 기준 불 자리)."""
    if not PBR:
        emissive(objs, color, strength)
        return
    emissive(objs, color, 0.12)
    rz, s = h.rotation_euler[2], h.scale[0]
    lx, ly, lz = local
    glow(h.location.x + (lx * math.cos(rz) - ly * math.sin(rz)) * s, h.location.y + (lx * math.sin(rz) + ly * math.cos(rz)) * s,
         h.location.z + lz * s, color, r * s, 4.5 if fire else 18.0, 1.9 if fire else 1.0)


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


GROUND_PREFIX = ('lake_ground', 'snow_ground', 'plain_ground', 'isl')      # 땅 오브젝트 이름(블렌더가 붙이는 .001 꼬리 무시)


def ground_only_z(x, y):
    """배치표 terrain.heights 용 — 광선이 집·나무·바위·소나무 같은 지물을 만나면 뚫고 내려가 **땅 오브젝트**의 윗면만 잰다(G-0015 ①).
    ground_z 는 처음 맞은 면(지물 꼭대기)이라 조각 z 와 평균 3.6~10m 어긋났다."""
    dg = bpy.context.evaluated_depsgraph_get()
    o = Vector((x, y, 12.0))
    for _ in range(40):
        hit, loc, nor, idx, obj, mat = sc.ray_cast(dg, o, Vector((0, 0, -1)), distance=60)
        if not hit:
            return None
        if obj and obj.name.startswith(GROUND_PREFIX):
            return loc.z
        o = Vector((x, y, loc.z - 0.002))
    return None


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
    LAYOUT['roads'].append({'from': [round(p0[0], 2), round(p0[1], 2)], 'to': [round(p1[0], 2), round(p1[1], 2)], 'width': width, 'mat': mat.name})
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


# ---- 지역 다섯 장면은 region_scenes.py(R-4 10-13 분리) — 같은 전역을 쓰도록 exec 로 읽는다
exec(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'region_scenes.py'), encoding='utf-8').read())


EXPORT_CFG = {
    # 지형 높이 격자(Blender 좌표, 미터) · 땅 재질 섞기 규칙 · 눈·물·하늘 같은 지역 값
    'galaxy_ferry': {
        'terrain': {'obj': 'lake_ground', 'x': (-75.0, 75.0), 'y': (-45.0, 105.0), 'step': 2.0,
                    'materials': {'low': 'tex/ground_grass.jpg', 'high': 'tex/rock_cliff.jpg', 'z0': 3.0, 'z1': 9.0, 'slope0': 0.30, 'slope1': 0.55,
                                  'tile_low': 5.0, 'tile_high': 9.0, 'tint_low': [0.45, 0.55, 0.75], 'tint_high': [0.55, 0.6, 0.8]}},
        'water': {'z': 0.0, 'size': 220, 'color': [0.01, 0.05, 0.10], 'roughness': 0.04},
        'sky': {'kind': 'night_stars_milkyway', 'moon': {'pos': [-30, 160, 62], 'radius': 7, 'halo_radius': 24}},
        'fog': {'density': 0.010, 'color': [0.5, 0.65, 0.95], 'box': [90, 60, 5, 0, 14, 2.5]},
        'fx': {'fireflies': {'count': 45, 'area': [-24, 14, -8, 6, 0.9, 3.8], 'color': [0.85, 1.0, 0.35]}},
        'camera': {'pos': [-19.0, -13.0, 2.6], 'look': [5.0, 24, 6.0], 'lens': 24}},
    'frost_peak': {
        'terrain': {'obj': 'snow_ground', 'x': (-110.0, 110.0), 'y': (-48.0, 172.0), 'step': 2.5,
                    'materials': {'low': 'tex/snow.jpg', 'high': 'tex/rock_cliff.jpg', 'z0': 999.0, 'z1': 1000.0, 'slope0': 0.42, 'slope1': 0.70,
                                  'tile_low': 4.0, 'tile_high': 10.0, 'tint_low': [1.0, 1.0, 1.0], 'tint_high': [0.55, 0.6, 0.75], 'sat_high': 0.25}},
        'sky': {'kind': 'aurora_dusk'},
        'fog': {'density': 0.0035, 'color': [0.6, 0.75, 1.0], 'box': [110, 100, 10, 0, 35, 5]},
        'fx': {'snowfall': {'count': 260, 'area': [-14, 14, -10, 40, 0.3, 9.0]}},
        'camera': {'pos': [2.2, -11.0, 1.9], 'look': [0.5, 40, 21.0], 'lens': 22}},
    'time_rift': {
        'sky': {'kind': 'sunset_rift', 'rift_rings': [{'pos': [-10, 220, 70], 'major': 52, 'minor': 1.6}, {'pos': [-10, 222, 70], 'major': 38, 'minor': 0.9}]},
        'fog': {'density': 0.035, 'color': [1.0, 0.78, 0.62], 'box': [400, 400, 20, 0, 40, -22], 'note': '구름바다(낮게 깔린 두꺼운 안개)'},
        'islands_material': {'rock': 'tex/rock_cliff.jpg', 'top': 'tex/ground_grass.jpg', 'tile_rock': 6.0, 'tile_top': 4.0, 'rock_tint': [0.62, 0.62, 0.7], 'rock_sat': 0.3},
        'camera': {'pos': [-26.0, -62.0, 5.0], 'look': [0.0, 6.0, 19.0], 'lens': 24}},
    'crossroads': {
        'terrain': {'obj': 'plain_ground', 'x': (-130.0, 130.0), 'y': (-39.0, 221.0), 'step': 3.0,
                    'materials': {'low': 'tex/ground_grass.jpg', 'high': None, 'tint_low': [0.8, 0.85, 1.0], 'tile_low': 5.0}},
        'sky': {'kind': 'dusk_magenta'},
        'fog': {'density': 0.003, 'color': [0.7, 0.75, 1.0], 'box': [200, 160, 8, 0, 40, 4]},
        'gate': {'center': [0.0, 40.0, 7.0], 'radius': 5.7, 'rot': [1.5708, 0, 0], 'colors': [[0.1, 0.9, 1.0], [1.0, 0.3, 0.9]]},
        'fx': {'fireflies': {'count': 30, 'area': [-24, 14, -8, 6, 0.9, 3.8], 'color': [0.85, 1.0, 0.35]}},
        'camera': {'pos': [0.0, -6.0, 2.4], 'look': [0.0, 40, 6.0], 'lens': 24}},
}
SCENERY_SKIP_MAT = ('firefly', 'flake', 'moon', 'halo', 'gate', 'fog', 'haze', 'clouds', 'fog2', 'water')
SCENERY_SKIP_OBJ = ('lake_ground', 'snow_ground', 'plain_ground', 'water_plane')


def _box_uv(obj, tile):
    import bmesh
    me = obj.data
    bm = bmesh.new()
    bm.from_mesh(me)
    uvl = bm.loops.layers.uv.verify()
    mw = obj.matrix_world
    for f in bm.faces:
        n = f.normal
        ax, ay, az = abs(n.x), abs(n.y), abs(n.z)
        for lp in f.loops:
            w = mw @ lp.vert.co
            if az >= ax and az >= ay:
                u, v = w.x, w.y
            elif ax >= ay:
                u, v = w.y, w.z
            else:
                u, v = w.x, w.z
            lp[uvl].uv = (u / tile, v / tile)
    bm.to_mesh(me)
    bm.free()


def _tex_mat_blender(name, jpg_abs, tint=None):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    bs = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
    t = nt.nodes.new('ShaderNodeTexImage')
    t.image = bpy.data.images.load(jpg_abs, check_existing=True)
    t.image.pack()
    if tint:
        mx = nt.nodes.new('ShaderNodeMix')
        mx.data_type = 'RGBA'
        mx.blend_type = 'MULTIPLY'
        mx.inputs['Factor'].default_value = 1.0
        mx.inputs['B'].default_value = (tint[0], tint[1], tint[2], 1)
        nt.links.new(t.outputs['Color'], mx.inputs['A'])
        nt.links.new(mx.outputs['Result'], bs.inputs['Base Color'])
    else:
        nt.links.new(t.outputs['Color'], bs.inputs['Base Color'])
    bs.inputs['Roughness'].default_value = 1.0
    return m


def export_region(rid, outdir):
    cfg = EXPORT_CFG[rid]
    os.makedirs(outdir, exist_ok=True)
    lay = OrderedDict()
    lay['region'] = rid
    lay['schema'] = 1
    lay['note'] = 'tools/world-forge/region_hero.py 가 만든 배치표 — 손으로 고치지 않는다. 좌표는 Blender 기준(x 오른쪽·y 안쪽·z 위, 미터). glb 안은 glTF(y 위)라 엔진 기본 임포트가 그대로 맞고, 이 표의 좌표는 (x, z, -y) 로 바꿔 쓴다.'
    lay['pieces'] = LAYOUT['pieces']
    lights = []
    for o in sc.objects:
        if o.type == 'LIGHT':
            d = o.data
            row = {'type': d.type, 'color': [round(c, 3) for c in d.color], 'energy': round(d.energy, 2),
                   'pos': [round(v, 2) for v in o.location], 'radius': round(getattr(d, 'shadow_soft_size', 0.0), 2)}
            if d.type == 'SUN':
                row['rot'] = [round(v, 4) for v in o.rotation_euler]
            lights.append(row)
    lay['lights'] = lights
    for k in ('sky', 'water', 'fog', 'fx', 'gate', 'islands_material', 'camera'):
        if k in cfg:
            lay[k] = cfg[k]
    t = cfg.get('terrain')
    if t:
        step = t['step']
        nx, ny = int((t['x'][1] - t['x'][0]) / step) + 1, int((t['y'][1] - t['y'][0]) / step) + 1
        hs = []
        for j in range(ny):
            for i in range(nx):
                z = ground_only_z(t['x'][0] + i * step, t['y'][0] + j * step)
                hs.append(None if z is None else round(z, 2))
        lay['terrain'] = {'x0': t['x'][0], 'y0': t['y'][0], 'step': step, 'nx': nx, 'ny': ny, 'heights': hs, 'materials': t['materials']}
    lay['roads'] = LAYOUT['roads']
    # 자잘한 코드 메시(소나무·바위·갈대·부두·섬·고리·길)를 한 GLB 로 굽는다 — 조각(GLB)·지형·물·효과(반딧불·눈발)는 뺀다
    keep = []
    for o in sc.objects:
        if o.type != 'MESH' or o.name in PIECE_OBJS or o.name in SCENERY_SKIP_OBJ or o.parent is not None:
            continue
        mats = [s.material.name for s in o.material_slots if s.material]
        if any(any(m.startswith(sk) for sk in SCENERY_SKIP_MAT) for m in mats):
            continue
        keep.append(o)
    # 섬·길은 상자 투영 UV + 그림 재질(사실 재질은 노드 좌표라 GLB 에 못 싣는다)
    im = cfg.get('islands_material')
    base = os.path.abspath(outdir)
    for o in keep:
        nm = o.name
        if nm.startswith('isl') and im:
            _box_uv(o, im['tile_rock'])
            o.data.materials.clear()
            o.data.materials.append(_tex_mat_blender('isl_rock', os.path.join(base, im['rock']), im.get('rock_tint')))
        elif nm.startswith('road'):
            _box_uv(o, 3.0)
    bpy.ops.object.select_all(action='DESELECT')
    for o in keep:
        o.select_set(True)
    if keep:
        bpy.context.view_layer.objects.active = keep[0]
        bpy.ops.export_scene.gltf(filepath=os.path.join(base, rid + '_scenery.glb'), export_format='GLB', use_selection=True,
                                  export_image_format='JPEG', export_apply=True)
        lay['scenery'] = rid + '_scenery.glb'
    _json.dump(lay, open(os.path.join(base, 'layout.json'), 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
    print('EXPORT', rid, 'pieces', len(lay['pieces']), 'lights', len(lights), 'scenery_objs', len(keep))


def render_pano(path, w=4096, h=2048, samples=16):
    """하늘 파노라마(정距 원통 4096x2048): 월드 셰이더 + 달·달무리·먼 균열 고리만 남기고 나머지를 지운 뒤 Cycles 파노라마 카메라로 한 장.
    카메라는 원점, 정면(+y)이 그림 한가운데. 엔진은 이 그림을 하늘상자(스카이박스/파노라마 하늘)로 쓴다."""
    for o in list(bpy.data.objects):
        mats = [s.material.name for s in o.material_slots if s.material] if o.type == 'MESH' else []
        keep = o.type == 'MESH' and (any(m in ('moon', 'halo') for m in mats) or (any(m.startswith('ring') for m in mats) and o.location.y > 100))
        if not keep and o.type in ('MESH', 'LIGHT', 'EMPTY', 'CAMERA'):
            bpy.data.objects.remove(o, do_unlink=True)
    cd = bpy.data.cameras.new('pano')
    cd.type = 'PANO'
    try:
        cd.panorama_type = 'EQUIRECTANGULAR'
    except Exception:
        cd.cycles.panorama_type = 'EQUIRECTANGULAR'
    co = bpy.data.objects.new('pano', cd)
    sc.collection.objects.link(co)
    co.location = (0, 0, 0)
    co.rotation_euler = (math.pi / 2, 0, 0)
    sc.camera = co
    sc.render.engine = 'CYCLES'
    sc.cycles.samples = samples
    import os, sys; sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
    import saga_cycles; saga_cycles.use(sc)
    try:
        sc.cycles.use_denoising = False
    except Exception:
        pass
    sc.render.resolution_x, sc.render.resolution_y = w, h
    sc.render.resolution_percentage = 100
    sc.view_settings.view_transform = 'Standard'
    sc.render.filepath = path
    sc.render.image_settings.file_format = 'PNG'
    bpy.ops.render.render(write_still=True)
    print('PANO', path)


import time as _t
_T0 = _t.time()
{'galaxy_ferry': galaxy_ferry, 'frost_peak': frost_peak, 'time_rift': time_rift, 'crossroads': crossroads, 'village': village}[REGION]()
print('TIME build %.1fs' % (_t.time() - _T0))
if os.environ.get('HERO_SKY'):
    render_pano(os.environ['HERO_SKY'])
    raise SystemExit(0)
join_by_material(['blade', 'reed', 'pine', 'pine_g', 'snowcap', 'firefly', 'flake', 'rockm', 'wood'])
if os.environ.get('HERO_EXPORT'):
    export_region(REGION, os.environ['HERO_EXPORT'])
sc.render.filepath = OUT
sc.render.image_settings.file_format = 'PNG'
print('TIME join %.1fs' % (_t.time() - _T0))
bpy.ops.render.render(write_still=True)
print('TIME render done %.1fs' % (_t.time() - _T0))
print('SAVED', OUT)
