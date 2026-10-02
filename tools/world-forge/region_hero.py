"""지역 대표 장면 한 장 — 공방 조각(지형·집·등롱·배)을 한 장면에 모으고 하늘·빛·안개·번짐을 얹어 "이 지역은 이런 느낌" 을 눈으로 본다. Blender 헤드리스.

  blender -b --factory-startup -P tools/world-forge/region_hero.py -- <지역> <출력.png> [샘플=48]

지역: galaxy_ferry(은하 나루: 별밤 물가·등롱·돛단배)
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


def spots(n, zmin, zmax, ymin, ymax, mind, tries=4000):
    got = []
    for _ in range(tries):
        x, y = rng.uniform(-22, 22), rng.uniform(ymin, ymax)
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


def galaxy_ferry():
    sky_world()
    lake_terrain()
    bpy.context.view_layer.update()
    wz = 0.0
    w = water(220, wz)
    w.name = 'water_plane'
    bpy.context.view_layer.update()
    houses = spots(6, 1.0, 5.0, 24, 42, 8)
    trees(170, 0.8, 9.0, 22, 60, avoid=[(x, y) for x, y, _ in houses])
    # 건너편 언덕 위 한옥 마을
    for x, y, z in houses:
        h, objs = place('hanok_01', (x, y, z - 0.15), rot=rng.uniform(-0.5, 0.5), scale=rng.uniform(0.9, 1.4))
        emissive(objs, (1.0, 0.6, 0.28, 1), 0.35)
        point((x, y - 1.5, z + 2.4), (1.0, 0.6, 0.28), 160, 0.7)
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
    # 물 위의 배와 뗏목
    place('sail_boat_01', (4.5, 11.0, wz - 0.1), rot=0.6, scale=1.1)
    place('raft_01', (-8.0, 7.0, wz - 0.1), rot=-0.4, scale=1.1)
    place('sail_boat_01', (-14.0, 17.0, wz - 0.1), rot=2.3, scale=0.9)
    sun = bpy.data.lights.new('moon', 'SUN')
    sun.energy, sun.color, sun.angle = 1.4, (0.55, 0.7, 1.0), 0.05
    so = bpy.data.objects.new('moon', sun)
    so.rotation_euler = (math.radians(58), 0, math.radians(200))
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
    mb.inputs['Emission Strength'].default_value = 6.0
    mo.data.materials.append(mm)
    camera((-19.0, -13.0, 2.6), (5.0, 24, 6.0), lens=24)


{'galaxy_ferry': galaxy_ferry}[REGION]()
sc.render.filepath = OUT
sc.render.image_settings.file_format = 'PNG'
bpy.ops.render.render(write_still=True)
print('SAVED', OUT)
