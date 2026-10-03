"""지역 대표 장면 한 장 — 공방 조각(지형·집·등롱·배)을 한 장면에 모으고 하늘·빛·안개·번짐을 얹어 "이 지역은 이런 느낌" 을 눈으로 본다. Blender 헤드리스.

  blender -b --factory-startup -P tools/world-forge/region_hero.py -- <지역> <출력.png> [샘플=48]

지역: galaxy_ferry(은하 나루: 별밤 물가·등롱·돛단배) · frost_peak(서리봉 고원: 오로라·눈 소나무·횃불 길·제단) · time_rift(시간 틈 관측소: 떠 있는 섬·시간 고리·하늘의 균열·구름바다)
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


def place(name, loc, rot=0.0, scale=1.0):
    before = set(bpy.data.objects.keys())
    bpy.ops.import_scene.gltf(filepath=os.path.join(TOON, name + '.glb'))
    new = [o for o in bpy.data.objects if o.name not in before]
    top = [o for o in new if o.parent is None]
    holder = bpy.data.objects.new(name + '_h', None)
    sc.collection.objects.link(holder)
    for o in top:
        o.parent = holder
    holder.location, holder.rotation_euler, holder.scale = loc, (0, 0, rot), (scale,) * 3
    return holder, new


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
        h, objs = place(rng.choice(['hanok_01', 'hanok_01', 'forest_cottage_01', 'jp_minka_01']), (x, y, z - 0.15), rot=rng.uniform(-0.5, 0.5), scale=rng.uniform(1.2, 1.7))
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
        emissive(objs, (1.0, 0.5, 0.18, 1), 1.3)
        point((x, y - 0.3, z + 1.6), (1.0, 0.62, 0.28), 80, 0.2)
    reeds(42, -30, 24, -8, 0.8)
    for _ in range(9):
        x, y = rng.uniform(-26, 22), rng.uniform(-12, -4)
        z = ground_z(x, y)
        if z is not None:
            rock(x, y, z, rng.uniform(0.35, 1.0))
    ye = pier(7.0, -2.5, 9.0, 0.35)
    h, objs = place('stone_lantern_01', (7.0, ye - 0.2, 0.4), rot=0.0, scale=1.0)
    emissive(objs, (1.0, 0.5, 0.18, 1), 1.3)
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
    o.data.materials.append(mat_simple('snow', (0.42, 0.52, 0.72, 1), 0.55))
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
            emissive(objs, (1.0, 0.4, 0.1, 1), 1.5)
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
    c = 0                                               # 눈 덮인 소나무 숲
    for _ in range(9000):
        x, y = rng.uniform(-48, 48), rng.uniform(8, 78)
        if abs(x - 0.8 * math.sin(y * 0.05)) < 7.5:
            continue
        z = ground_z(x, y)
        if z is None:
            continue
        snow_pine(x, y, z - 0.1, rng.uniform(1.0, 2.3))
        c += 1
        if c >= 150:
            break
    for _ in range(14):
        x, y = rng.uniform(-20, 20), rng.uniform(-8, 24)
        if abs(x - 0.8 * math.sin(y * 0.05)) < 4.5:
            continue
        z = ground_z(x, y)
        if z is not None:
            rock(x, y, z - 0.1, rng.uniform(0.5, 1.4))
    snowfall(260)
    sun = bpy.data.lights.new('moon', 'SUN')
    sun.energy, sun.color, sun.angle = 2.2, (0.6, 0.75, 1.0), 0.04
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
    rock_mat = mat_simple('isl_rock', (0.07, 0.06, 0.07, 1), 0.9)
    top_mat = mat_simple('isl_top', (0.08, 0.16, 0.12, 1), 0.85)
    plat_mat = mat_simple('plat', (0.18, 0.17, 0.2, 1), 0.7)
    # 중앙 섬: 관측소 탑과 돔
    floating_island(0, 0, 0, 16, 11, 3, top_mat, rock_mat)
    bpy.ops.mesh.primitive_cylinder_add(vertices=40, radius=9.5, depth=0.5, location=(0, 0, 0.2))
    bpy.context.object.data.materials.append(plat_mat)
    h, objs = place('stone_tower_01', (0, 0, 0.4), rot=0.3, scale=1.1)
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


{'galaxy_ferry': galaxy_ferry, 'frost_peak': frost_peak, 'time_rift': time_rift}[REGION]()
sc.render.filepath = OUT
sc.render.image_settings.file_format = 'PNG'
bpy.ops.render.render(write_still=True)
print('SAVED', OUT)
