"""VRoid(VRM) 몸 → 괴물·연령 변형 + 절차 생성 장비 → 방향·동작 스프라이트 시트 (K-0015, 2D 모드 에셋 굽기)

한 장면에서 만들고 바로 렌더한다 — VRM 재질은 Emission 기반이라 glTF 내보내기로는 색이 안 남는다.

미리보기(한 줄에 여러 벌, 정면):
  blender -b --factory-startup -P gear_sprites.py -- <몸.glb> <out.png> kind1 kind2 ...
스프라이트 시트(첫 kind 하나만, 환경변수):
  SPRITE_MODE=1 CLIP=walk NFR=8 NDIR=4 SPRITE_PX=128 ORTHO=2.5 CAM_Z=0.95 ANIM_GLB=<bake_for_rig 가 만든 *_anims.glb> VIEW_DEG=180 \
  blender -b --factory-startup -P gear_sprites.py -- <몸.glb> <out_폴더> orc_warlord
  -> <out_폴더>/d<방향>_f<프레임>.png (투명) + meta.json   (CLIP=walk,attack 처럼 쉼표면 <out>/<동작>/ , DIR_LIST=0,1,2 로 방향 골라 굽기)

kind: human goblin orc undead demon child teen elder · 장비 벌 orc_warlord goblin_scrapper undead_knight demon_lord elder_sage dark_ranger
      · 무작위 벌 rand:<orc|goblin|undead|demon>:<씨앗> · 다른 몸은 kind@경로
몸.glb 는 .vrm 을 .glb 로 복사한 것(VRM 0.x 는 정면이 +Y, 1.0 은 -Y — 자동 감지). 산출물은 git 밖(_out).
"""
import bpy, sys, os, math, bmesh
from mathutils import Vector, Matrix

a = sys.argv[sys.argv.index('--') + 1:]
src0, out, kinds = a[0], a[1], a[2:]
src = src0
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
exec(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'render', 'render_common.py'), encoding='utf-8').read())

P = {
    'human': dict(),
    'goblin': dict(skin=(0.55, 1.0, 0.3), cloth=(0.78, 0.55, 0.3), hair=(0.12, 0.1, 0.06), eye=(1.0, 0.9, 0.1), scale=(1.0, 1.0, 0.72), ears=True,
                   cloth_cfg=dict(sleeves=True, tops_cut=1.12, pants_cut=0.60, shoes=True, belt=True, mottle=14)),
    'orc': dict(skin=(0.6, 0.8, 0.4), cloth=(0.6, 0.42, 0.26), hair=(0.05, 0.04, 0.03), eye=(1.0, 0.35, 0.1), scale=(1.4, 1.25, 1.2), tusks=True,
                cloth_cfg=dict(sleeves=True, tops_cut=None, pants_cut=0.74, shoes=True, belt=True, spikes=True, mottle=8)),
    'demon_fancy': dict(skin_sat=1.3, skin_val=0.85, skin=(1.0, 0.3, 0.25), cloth=(1.0, 0.45, 0.45), hair=(0.08, 0.03, 0.04), eye=(1.0, 0.85, 0.1), scale=(1.03, 1.03, 1.1), horns=True,
                        cloth_cfg=dict(sleeves=False, tops_cut=None, pants_cut=None, shoes=False, keep_tex=True, sat=1.5, val=0.8, spikes=True)),
    'undead_fancy': dict(skin_sat=1.2, skin_val=0.8, skin=(0.75, 0.9, 0.85), cloth=(0.7, 0.85, 0.8), hair=(0.75, 0.75, 0.78), eye=(0.9, 0.15, 0.15), scale=(0.95, 0.95, 1.03),
                         cloth_cfg=dict(sleeves=False, tops_cut=None, pants_cut=None, shoes=False, keep_tex=True, sat=1.5, val=0.8, mottle=16)),
    'goblin_fancy': dict(skin_sat=1.2, skin_val=0.85, skin=(0.55, 1.0, 0.3), cloth=(0.85, 1.0, 0.6), hair=(0.12, 0.1, 0.06), eye=(1.0, 0.9, 0.1), scale=(1.0, 1.0, 0.75), ears=True,
                         cloth_cfg=dict(sleeves=False, tops_cut=None, pants_cut=None, shoes=False, keep_tex=True, sat=1.5, val=0.8, belt=True)),
    'child': dict(scale=(0.62, 0.62, 0.62), age=dict(head=1.35, arms=0.95)),
    'teen': dict(scale=(0.86, 0.86, 0.86), age=dict(head=1.1)),
    'elder': dict(hair=(0.92, 0.92, 0.95), scale=(0.97, 0.97, 0.94), age=dict(stoop=14, head=1.0, beard=True, skin_mul=(0.95, 0.88, 0.82))),
    'undead': dict(skin=(0.75, 0.9, 0.85), cloth=(0.5, 0.55, 0.5), hair=(0.7, 0.7, 0.72), eye=(0.9, 0.15, 0.15), scale=(0.92, 0.92, 1.04),
                   cloth_cfg=dict(sleeves=True, tops_cut=1.15, pants_cut=0.52, shoes=True, mottle=22)),
    'demon': dict(skin=(1.0, 0.2, 0.15), cloth=(0.35, 0.08, 0.1), hair=(0.06, 0.02, 0.02), eye=(1.0, 0.8, 0.0), scale=(1.05, 1.05, 1.12), horns=True,
                  cloth_cfg=dict(sleeves=True, tops_cut=None, pants_cut=None, shoes=False, belt=True, spikes=True, mottle=10)),
}

def _mix(base, **kw):
    q = dict(P[base]); q.update(kw); return q


belt_mat = bpy.data.materials.new('part_belt')
belt_mat.use_nodes = True
belt_mat.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (0.25, 0.15, 0.07, 1)
beard_mat = bpy.data.materials.new('part_beard')
beard_mat.use_nodes = True
beard_mat.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (0.88, 0.88, 0.9, 1)
bone_mat = bpy.data.materials.new('part_bone')
bone_mat.use_nodes = True
bone_mat.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (0.92, 0.88, 0.72, 1)


def tint_material(m, rgb, constant, fac=1.0, mottle=None, sat=None, val=None, ramp=None):
    nt = m.node_tree
    done = False
    for n in list(nt.nodes):
        if n.type != 'TEX_IMAGE':
            continue
        links = list(n.outputs['Color'].links)
        if not links:
            continue
        mix = nt.nodes.new('ShaderNodeMixRGB')
        mix.blend_type = 'MIX' if constant else 'MULTIPLY'
        mix.inputs['Fac'].default_value = 1.0
        mix.inputs['Color2'].default_value = (rgb[0], rgb[1], rgb[2], 1.0)
        nt.links.new(n.outputs['Color'], mix.inputs['Color1'])
        out = mix.outputs['Color']
        if sat or val:           # 밝은 몸·의상이 색이 바래 보이지 않게 채도를 올리고 명도를 눌러 대비를 만든다
            hs = nt.nodes.new('ShaderNodeHueSaturation')
            hs.inputs['Saturation'].default_value = sat or 1.0
            hs.inputs['Value'].default_value = val or 1.0
            nt.links.new(out, hs.inputs['Color'])
            out = hs.outputs['Color']
        if ramp:                 # 흰 의상(G 몸)처럼 곱해도 색이 안 붙는 옷: 밝기를 어두운색~밝은색 사다리로 다시 칠한다(무늬 명암은 유지)
            bw = nt.nodes.new('ShaderNodeRGBToBW')
            nt.links.new(out, bw.inputs['Color'])
            rp = nt.nodes.new('ShaderNodeValToRGB')
            rp.color_ramp.elements[0].position = 0.5
            rp.color_ramp.elements[0].color = (ramp[0][0], ramp[0][1], ramp[0][2], 1)
            rp.color_ramp.elements[1].position = 1.0
            rp.color_ramp.elements[1].color = (ramp[1][0], ramp[1][1], ramp[1][2], 1)
            nt.links.new(bw.outputs['Val'], rp.inputs['Fac'])
            out = rp.outputs['Color']
        if mottle:
            noi = nt.nodes.new('ShaderNodeTexNoise')
            noi.inputs['Scale'].default_value = mottle
            noi.inputs['Detail'].default_value = 6.0
            ramp = nt.nodes.new('ShaderNodeValToRGB')
            ramp.color_ramp.elements[0].position = 0.35
            ramp.color_ramp.elements[0].color = (0.45, 0.45, 0.45, 1)
            ramp.color_ramp.elements[1].position = 0.65
            ramp.color_ramp.elements[1].color = (1.0, 1.0, 1.0, 1)
            nt.links.new(noi.outputs['Fac'], ramp.inputs['Fac'])
            mm = nt.nodes.new('ShaderNodeMixRGB')
            mm.blend_type = 'MULTIPLY'
            mm.inputs['Fac'].default_value = 1.0
            nt.links.new(out, mm.inputs['Color1'])
            nt.links.new(ramp.outputs['Color'], mm.inputs['Color2'])
            out = mm.outputs['Color']
        for l in links:
            nt.links.new(out, l.to_socket)
        done = True
    return done


# ---- 옷 조각(장비) 라이브러리 — 뼈에 딱딱하게 붙는 절차 생성 조각 ----
import random
FS = 1.0


def pal_mat(name, rgb, metal=0.0, rough=0.5):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (rgb[0], rgb[1], rgb[2], 1)
    b.inputs['Metallic'].default_value = metal
    b.inputs['Roughness'].default_value = rough
    return m


PALS = {
    'orc': dict(metal=(0.35, 0.36, 0.38), trim=(0.55, 0.4, 0.15), leather=(0.3, 0.18, 0.1), fur=(0.45, 0.3, 0.18), cloth=(0.35, 0.12, 0.1), bone=(0.9, 0.86, 0.72)),
    'goblin': dict(metal=(0.3, 0.32, 0.28), trim=(0.5, 0.45, 0.2), leather=(0.35, 0.22, 0.12), fur=(0.3, 0.25, 0.15), cloth=(0.25, 0.3, 0.12), bone=(0.85, 0.82, 0.68)),
    'undead': dict(metal=(0.42, 0.46, 0.48), trim=(0.6, 0.62, 0.55), leather=(0.2, 0.22, 0.22), fur=(0.5, 0.52, 0.5), cloth=(0.18, 0.2, 0.26), bone=(0.92, 0.9, 0.82)),
    'demon': dict(metal=(0.12, 0.1, 0.12), trim=(0.85, 0.6, 0.15), leather=(0.22, 0.05, 0.06), fur=(0.15, 0.05, 0.05), cloth=(0.45, 0.04, 0.08), bone=(0.95, 0.9, 0.78)),
    'sage': dict(metal=(0.5, 0.45, 0.3), trim=(0.85, 0.7, 0.3), leather=(0.4, 0.3, 0.2), fur=(0.85, 0.85, 0.88), cloth=(0.2, 0.25, 0.5), bone=(0.9, 0.88, 0.8)),
}


def hue_rot(rgb, h):
    import colorsys
    r, g, b = rgb
    hh, ss, vv = colorsys.rgb_to_hsv(r, g, b)
    return colorsys.hsv_to_rgb((hh + h) % 1.0, ss, vv)


def add_gear(arm, objs, gear, pal_name, seed=1, hue=0.0):
    rnd = random.Random(seed)
    pal = dict(PALS[pal_name])
    for kk in ('trim', 'leather', 'fur', 'cloth'):
        pal[kk] = hue_rot(pal[kk], hue)
    mats = {
        'metal': pal_mat('g_metal', pal['metal'], 0.9, 0.35), 'trim': pal_mat('g_trim', pal['trim'], 0.9, 0.3),
        'leather': pal_mat('g_leather', pal['leather'], 0.0, 0.7), 'fur': pal_mat('g_fur', pal['fur'], 0.0, 0.95),
        'cloth': pal_mat('g_cloth', pal['cloth'], 0.0, 0.8), 'bone': pal_mat('g_bone', pal['bone'], 0.0, 0.6)}
    bpy.context.view_layer.update()

    def seg(bn):
        b = arm.pose.bones[bn].bone
        return arm.matrix_world @ b.head_local, arm.matrix_world @ b.tail_local

    def hw(bn):
        return arm.matrix_world @ arm.pose.bones[bn].bone.head_local

    def attach(o, bn, mat):
        pbx = arm.pose.bones[bn]
        pm = arm.matrix_world @ pbx.matrix @ Matrix.Translation((0, pbx.bone.length, 0))
        o.data.materials.append(mats[mat])
        for poly in o.data.polygons:
            poly.use_smooth = True
        o.parent = arm
        o.parent_type = 'BONE'
        o.parent_bone = bn
        o.matrix_parent_inverse = pm.inverted()
        objs.append(o)
        return o

    def place_between(o, p0, p1):
        d = p1 - p0
        o.location = (p0 + p1) / 2
        o.rotation_mode = 'QUATERNION'
        o.rotation_quaternion = d.to_track_quat('Z', 'Y')

    def cyl(p0, p1, r0, r1, bn, mat, verts=16):
        bpy.ops.mesh.primitive_cone_add(vertices=verts, radius1=r0, radius2=r1, depth=(p1 - p0).length)
        o = bpy.context.active_object
        place_between(o, p0, p1)
        return attach(o, bn, mat)

    def ball(loc, sc, bn, mat, seg_=16):
        bpy.ops.mesh.primitive_uv_sphere_add(segments=seg_, ring_count=10, radius=1.0, location=loc)
        o = bpy.context.active_object
        o.scale = sc
        return attach(o, bn, mat)

    def torus(loc, major, minor, sc, bn, mat, rot=(0, 0, 0)):
        bpy.ops.mesh.primitive_torus_add(major_radius=major, minor_radius=minor, location=loc)
        o = bpy.context.active_object
        o.rotation_euler = rot
        o.scale = sc
        return attach(o, bn, mat)

    def box(loc, sc, rot, bn, mat):
        bpy.ops.mesh.primitive_cube_add(size=1.0, location=loc)
        o = bpy.context.active_object
        o.rotation_euler = rot
        o.scale = sc
        bv = o.modifiers.new('bv', 'BEVEL')
        bv.width = min(sc) * 0.25
        bv.segments = 2
        return attach(o, bn, mat)

    hips0, _h1 = seg('J_Bip_C_Hips')
    ch0, ch1 = seg('J_Bip_C_Chest')
    uc0, uc1 = seg('J_Bip_C_UpperChest')
    nk0, nk1 = seg('J_Bip_C_Neck')
    hd0, hd1 = seg('J_Bip_C_Head')
    ctr = hd0 + Vector((0, 0, 0.12))
    Rh = 0.085

    for g in gear:
        kind = g.split(':')[0]
        st = g.split(':')[1] if ':' in g else ''
        if kind == 'pauldron':
            for S in ('L', 'R'):
                a0, a1 = seg(f'J_Bip_{S}_UpperArm')
                sx = 1 if a0.x > 0 else -1
                c = a0 + Vector((sx * 0.02, 0, 0.035))
                bn = f'J_Bip_{S}_UpperArm'
                if st == 'round':
                    ball(c, (0.095, 0.085, 0.06), bn, 'metal')
                    torus(c + Vector((0, 0, -0.01)), 0.085, 0.012, (1, 0.95, 0.75), bn, 'trim')
                elif st == 'spike':
                    ball(c, (0.095, 0.085, 0.055), bn, 'metal')
                    for k2 in range(4):
                        ang = math.radians(-40 + 27 * k2)
                        p0 = c + Vector((sx * 0.03 * math.cos(ang), -0.06 * math.sin(ang), 0.045))
                        cyl(p0, p0 + Vector((sx * 0.05, -0.03 * math.sin(ang), 0.11)), 0.022, 0.0, bn, 'trim', 10)
                else:
                    for k2 in range(3):
                        ball(c + Vector((sx * 0.035 * k2, 0, -0.03 * k2)), (0.1 - 0.008 * k2, 0.09, 0.03), bn, 'metal' if k2 != 1 else 'trim')
        elif kind == 'bracer':
            for S in ('L', 'R'):
                a0 = hw(f'J_Bip_{S}_LowerArm')
                a1 = hw(f'J_Bip_{S}_Hand')
                d = a1 - a0
                bn = f'J_Bip_{S}_LowerArm'
                cyl(a0 + d * 0.2, a0 + d * 0.92, 0.04, 0.034, bn, 'leather' if st == 'cloth' else 'metal')
                for t in (0.25, 0.9):
                    torus(a0 + d * t, 0.04, 0.008, (1, 1, 1), bn, 'trim', (0, math.radians(90), 0))
                if st == 'spike':
                    for t in (0.45, 0.65):
                        pp = a0 + d * t
                        cyl(pp + Vector((0, 0, 0.03)), pp + Vector((0, 0, 0.09)), 0.014, 0.0, bn, 'bone', 8)
        elif kind == 'greaves':
            for S in ('L', 'R'):
                a0 = hw(f'J_Bip_{S}_LowerLeg')
                a1 = hw(f'J_Bip_{S}_Foot')
                d = a1 - a0
                bn = f'J_Bip_{S}_LowerLeg'
                cyl(a0 + d * 0.12, a0 + d * 0.78, 0.058, 0.046, bn, 'metal' if st != 'cloth' else 'leather')
                ball(a0 + d * 0.02 + Vector((0, FS * 0.04, 0)), (0.06, 0.05, 0.05), bn, 'trim')
                if st == 'spike':
                    cyl(a0 + Vector((0, FS * 0.06, 0)), a0 + Vector((0, FS * 0.14, 0.02)), 0.022, 0.0, bn, 'bone', 8)
        elif kind == 'chest':
            c = hips0 + (nk0 - hips0) * 0.64
            bn = 'J_Bip_C_UpperChest'
            if st == 'plate':
                ball(c + Vector((0, FS * 0.055, 0.0)), (0.165, 0.075, 0.165), bn, 'metal')
                ball(c + Vector((0, -FS * 0.06, 0.0)), (0.16, 0.07, 0.16), bn, 'metal')
                cyl(c + Vector((0, FS * 0.12, 0.12)), c + Vector((0, FS * 0.14, -0.08)), 0.014, 0.014, bn, 'trim', 8)
                torus(c + Vector((0, FS * 0.04, 0.12)), 0.05, 0.01, (1, 1, 1), bn, 'trim', (math.radians(90), 0, 0))
            elif st == 'ribs':
                for k2 in range(5):
                    torus(c + Vector((0, 0, 0.1 - 0.05 * k2)), 0.145 - 0.004 * k2, 0.011, (1, 0.72, 1), bn, 'bone')
                cyl(c + Vector((0, FS * 0.105, 0.14)), c + Vector((0, FS * 0.11, -0.12)), 0.012, 0.012, bn, 'bone', 8)
            elif st == 'straps':
                ball(c + Vector((0, FS * 0.045, 0.0)), (0.15, 0.06, 0.15), bn, 'leather')
                for sx2 in (-1, 1):
                    cyl(c + Vector((sx2 * 0.1, FS * 0.09, 0.14)), c + Vector((-sx2 * 0.09, FS * 0.09, -0.12)), 0.012, 0.012, bn, 'trim', 8)
        elif kind == 'mantle':
            n = 26
            for k2 in range(n):
                ang = 2 * math.pi * k2 / n
                rad = 0.165 + rnd.random() * 0.03
                sz = 0.055 + rnd.random() * 0.03
                ball(Vector((rad * math.cos(ang), rad * math.sin(ang) * 0.8, nk0.z + 0.02 + rnd.random() * 0.02)), (sz, sz * 0.9, sz * 0.75), 'J_Bip_C_UpperChest', 'fur', 10)
        elif kind == 'flaps':
            n = 9
            for k2 in range(n):
                ang = 2 * math.pi * k2 / n
                if abs(math.sin(ang)) > 0.93:
                    continue
                ln = 0.16 + rnd.random() * 0.07
                loc = Vector((0.175 * math.cos(ang), 0.14 * math.sin(ang), hips0.z - 0.02 - ln / 2))
                box(loc, (0.075, 0.012, ln), (math.radians(8) * math.sin(ang), math.radians(-8) * math.cos(ang), ang + math.pi / 2), 'J_Bip_C_Hips', 'leather' if k2 % 2 else 'cloth')
            torus(Vector((0, 0, hips0.z + 0.02)), 0.17, 0.02, (1, 0.85, 1), 'J_Bip_C_Hips', 'trim')
            box(Vector((0, FS * 0.15, hips0.z + 0.02)), (0.05, 0.02, 0.05), (0, 0, 0), 'J_Bip_C_Hips', 'trim')
        elif kind == 'cape':
            ztop = nk0.z - 0.02
            zbot = hips0.z - 0.42
            bpy.ops.mesh.primitive_grid_add(x_subdivisions=12, y_subdivisions=16, size=1.0, location=(0, -FS * 0.125, (ztop + zbot) / 2))
            o = bpy.context.active_object
            o.rotation_euler = (math.radians(90), 0, 0)
            o.scale = (1.0, ztop - zbot, 1.0)
            for v in o.data.vertices:
                t = 0.5 - v.co.y            # 0 위(목) … 1 아래(밑단)
                v.co.x *= 0.34 + 0.55 * t
                v.co.z += (0.02 + 0.2 * t * t) + 0.035 * math.sin(v.co.x * 20) * t
                if t > 0.96:
                    v.co.y -= 0.03 + 0.05 * abs(math.sin(v.co.x * 17))
            sld = o.modifiers.new('sol', 'SOLIDIFY')
            sld.thickness = 0.008
            attach(o, 'J_Bip_C_UpperChest', 'cloth')
            torus(Vector((0, 0.0, nk0.z)), 0.11, 0.016, (1, 1, 1), 'J_Bip_C_UpperChest', 'trim')
        elif kind == 'helm':
            bn = 'J_Bip_C_Head'
            ball(ctr + Vector((0, 0, 0.03)), (Rh * 1.22, Rh * 1.2, Rh * 1.05), bn, 'metal')
            torus(ctr + Vector((0, 0, -0.012)), Rh * 1.2, 0.012, (1, 1, 1), bn, 'trim')
            cyl(ctr + Vector((0, FS * Rh * 1.15, 0.06)), ctr + Vector((0, FS * Rh * 1.2, -0.04)), 0.011, 0.011, bn, 'trim', 8)
            if st == 'horned':
                for sd in (-1, 1):
                    p = ctr + Vector((sd * Rh * 1.1, 0, 0.05))
                    for k2 in range(3):
                        q = p + Vector((sd * 0.05, 0, 0.035))
                        cyl(p, q, 0.03 - 0.008 * k2, 0.022 - 0.008 * k2, bn, 'bone', 10)
                        p = q
                    cyl(p, p + Vector((sd * 0.02, 0, 0.06)), 0.014, 0.0, bn, 'bone', 10)
            elif st == 'crest':
                for k2 in range(6):
                    cyl(ctr + Vector((0, 0.04 - 0.02 * k2, 0.1)), ctr + Vector((0, 0.05 - 0.02 * k2, 0.17 - 0.008 * k2)), 0.016, 0.0, bn, 'trim', 8)
        elif kind == 'hood':
            ball(ctr + Vector((0, -FS * 0.03, 0.0)), (Rh * 1.35, Rh * 1.45, Rh * 1.35), 'J_Bip_C_Head', 'cloth')
        elif kind == 'necklace':
            n = 12
            for k2 in range(n):
                ang = math.radians(-60 + 120 * k2 / (n - 1))
                x0 = 0.085 * math.sin(ang)
                y0 = FS * 0.085 * math.cos(ang)
                cyl(Vector((x0, y0, nk0.z - 0.01)), Vector((x0, y0, nk0.z - 0.06)), 0.013, 0.0, 'J_Bip_C_UpperChest', 'bone', 8)
        elif kind == 'robe':
            top = hips0.z + 0.12
            bot = hips0.z - 0.5
            bpy.ops.mesh.primitive_cone_add(vertices=24, radius1=0.25, radius2=0.14, depth=top - bot, location=(0, 0, (top + bot) / 2))
            o = bpy.context.active_object
            for v in o.data.vertices:
                if v.co.z < -(top - bot) * 0.45:
                    v.co.z -= 0.03 * abs(math.sin(math.atan2(v.co.y, v.co.x) * 6))
            attach(o, 'J_Bip_C_Hips', 'cloth')
            torus(Vector((0, 0, bot)), 0.25, 0.012, (1, 1, 1), 'J_Bip_C_Hips', 'trim')
        elif kind == 'tail':
            prev = Vector((0, -FS * 0.08, hips0.z - 0.04))
            for k2 in range(8):
                cur = prev + Vector((0, -FS * 0.065, -0.03 + 0.012 * k2))
                cyl(prev, cur, 0.04 - 0.0042 * k2, 0.04 - 0.0042 * (k2 + 1), 'J_Bip_C_Hips', 'leather', 10)
                prev = cur
            cyl(prev, prev + Vector((0, -FS * 0.07, 0.05)), 0.03, 0.0, 'J_Bip_C_Hips', 'bone', 8)
        elif kind == 'wings':
            for sx in (-1, 1):
                root = Vector((sx * 0.04, -FS * 0.1, nk0.z - 0.1))
                tips = [root + Vector((sx * 0.42, -FS * 0.18, 0.28)), root + Vector((sx * 0.55, -FS * 0.2, 0.08)),
                        root + Vector((sx * 0.5, -FS * 0.18, -0.13)), root + Vector((sx * 0.3, -FS * 0.12, -0.28))]
                for t in tips:
                    cyl(root, t, 0.014, 0.006, 'J_Bip_C_UpperChest', 'bone', 8)
                me = bpy.data.meshes.new('wing')
                verts = [root] + tips
                faces = [(0, 1, 2), (0, 2, 3), (0, 3, 4)] if sx > 0 else [(0, 2, 1), (0, 3, 2), (0, 4, 3)]
                me.from_pydata([tuple(v) for v in verts], [], faces)
                wo = bpy.data.objects.new('wingm', me)
                bpy.context.collection.objects.link(wo)
                sld = wo.modifiers.new('sol', 'SOLIDIFY')
                sld.thickness = 0.006
                attach(wo, 'J_Bip_C_UpperChest', 'cloth')
        elif kind == 'skullhelm':
            bn = 'J_Bip_C_Head'
            ball(ctr + Vector((0, 0, 0.035)), (Rh * 1.2, Rh * 1.2, Rh * 1.1), bn, 'bone')
            for sx in (-1, 1):
                ball(ctr + Vector((sx * Rh * 0.42, FS * Rh * 0.98, 0.012)), (Rh * 0.28, Rh * 0.12, Rh * 0.3), bn, 'leather')
            cyl(ctr + Vector((0, FS * Rh * 1.1, -0.04)), ctr + Vector((0, FS * Rh * 1.1, -0.1)), 0.05, 0.03, bn, 'bone', 8)
        elif kind == 'furpauldron':
            for S in ('L', 'R'):
                a0, a1 = seg(f'J_Bip_{S}_UpperArm')
                sx = 1 if a0.x > 0 else -1
                for k2 in range(7):
                    ball(a0 + Vector((sx * (0.01 + 0.012 * (k2 % 4)), (k2 % 3 - 1) * 0.04, 0.035 + 0.012 * (k2 % 2))), (0.05, 0.05, 0.04), f'J_Bip_{S}_UpperArm', 'fur', 10)


def jag(x, y):
    return 0.045 * math.sin(41 * x + 1.3) + 0.035 * math.sin(27 * y + 0.7) + 0.02 * math.sin(83 * x + 55 * y)


def cut_clothes(objs, cc):
    for o in objs:
        if o.type != 'MESH':
            continue
        me = o.data
        names = [(sl.material.name.split('.')[0] if sl.material else '') for sl in o.material_slots]
        if not any(('Tops' in n or 'Bottoms' in n or 'Shoes' in n or 'Onepice' in n) for n in names):
            continue
        bm = bmesh.new()
        bm.from_mesh(me)
        mw = o.matrix_world
        kill = []
        for f in bm.faces:
            nm = names[f.material_index] if f.material_index < len(names) else ''
            c = mw @ f.calc_center_median()
            if 'Tops' in nm or 'Onepice' in nm:
                if cc.get('sleeves') and abs(c.x) > 0.21:
                    kill.append(f)
                elif cc.get('tops_cut') and c.z < cc['tops_cut'] + jag(c.x, c.y):
                    kill.append(f)
            elif 'Bottoms' in nm:
                if cc.get('pants_cut') and c.z < cc['pants_cut'] + jag(c.x, c.y):
                    kill.append(f)
            elif 'Shoes' in nm and cc.get('shoes'):
                kill.append(f)
        bmesh.ops.delete(bm, geom=kill, context='FACES')
        bm.to_mesh(me)
        bm.free()


OPT = dict(helm=['helm:horned', 'helm:crest', 'hood', 'skullhelm', None], chest=['chest:plate', 'chest:ribs', 'chest:straps', 'robe', None],
           pauldron=['pauldron:round', 'pauldron:spike', 'pauldron:layered', 'furpauldron', None], bracer=['bracer', 'bracer:spike', 'bracer:cloth', None],
           legs=['greaves', 'greaves:spike', 'greaves:cloth', 'flaps', None], extra=['cape', 'mantle', 'necklace', 'tail', 'wings'])


def random_gear(seed, light=False):
    r = random.Random(seed)
    if light:          # *_fancy: 원래 의상(E·F·G 판타지 옷)을 가리지 않고 투구·견갑·장식 하나만
        return [x for x in (r.choice(OPT['helm']), r.choice(OPT['pauldron']), r.choice(['cape', 'necklace', 'tail', 'wings', 'mantle'])) if x]
    g = [r.choice(OPT[k]) for k in ('helm', 'chest', 'pauldron', 'bracer', 'legs')]
    g += r.sample(OPT['extra'], r.choice([1, 2]))
    return [x for x in g if x]


def build(kind, x):
    global src
    rnd_seed = None
    if '@' in kind:
        kind, src = kind.split('@', 1)
    if kind.startswith('rand:'):
        _, base_kind, rs = kind.split(':')
        rnd_seed = int(rs)
        root_kind = base_kind.split('_fancy')[0]
        P[kind] = _mix(base_kind, gear=random_gear(rnd_seed, light='_fancy' in base_kind), pal=root_kind if root_kind in PALS else ('sage' if root_kind in ('elder', 'child', 'teen', 'human') else 'orc'), hue=(rnd_seed * 0.137) % 1.0)
    before = {o.name for o in bpy.data.objects}
    bpy.ops.import_scene.gltf(filepath=src)
    objs = [o for o in bpy.data.objects if o.name not in before]
    arm = next(o for o in objs if o.type == 'ARMATURE')
    import json as _j, struct as _s
    _d = open(src, 'rb').read()
    _jj = _j.loads(_d[20:20 + _s.unpack('<I', _d[12:16])[0]])
    vrm0 = 'VRMC_vrm' not in _jj.get('extensions', {})
    global FS
    FS = 1.0 if vrm0 else -1.0     # 정면이 +Y(VRM0) 인지 −Y(VRM1) 인지
    p = P[kind]
    if any(k in p for k in ('skin', 'cloth', 'hair', 'eye')):
        seen = set()
        for o in objs:
            if o.type != 'MESH':
                continue
            for slot in o.material_slots:
                m = slot.material
                if m is None or m.name in seen or not m.node_tree:
                    continue
                seen.add(m.name)
                nm = m.name.split('.')[0]   # 두 번째 가져오기부터 이름에 .001 이 붙는다
                if nm.endswith('_SKIN') and 'skin' in p:
                    tint_material(m, p['skin'], False, 0.8, sat=p.get('skin_sat'), val=p.get('skin_val'))
                elif nm.endswith('_CLOTH') and 'cloth' in p:
                    tint_material(m, p['cloth'], not p.get('cloth_cfg', {}).get('keep_tex'), 1.0, mottle=p.get('cloth_cfg', {}).get('mottle'), sat=p.get('cloth_cfg', {}).get('sat'), val=p.get('cloth_cfg', {}).get('val'), ramp=p.get('cloth_cfg', {}).get('ramp'))
                elif 'HAIR' in nm and 'hair' in p:
                    tint_material(m, p['hair'], True)
                elif 'EyeIris' in nm and 'eye' in p:
                    tint_material(m, p['eye'], True)
    cc = p.get('cloth_cfg')
    if cc:
        cut_clothes(objs, cc)
    bpy.context.view_layer.update()
    pb = arm.pose.bones['J_Bip_C_Head']
    hw = arm.matrix_world @ pb.bone.head_local
    parent_mat = arm.matrix_world @ pb.matrix @ Matrix.Translation((0, pb.bone.length, 0))
    ctr = hw + Vector((0, 0, 0.12))    # 머리 중심 근사 (VRoid 머리뼈는 목 위에서 시작)
    R = 0.085

    def attach(o, bone_name, mat):
        pbx = arm.pose.bones[bone_name]
        pm = arm.matrix_world @ pbx.matrix @ Matrix.Translation((0, pbx.bone.length, 0))
        o.data.materials.append(mat)
        o.parent = arm
        o.parent_type = 'BONE'
        o.parent_bone = bone_name
        o.matrix_parent_inverse = pm.inverted()
        objs.append(o)

    def cone(name, loc, rot, r, depth, bone_name='J_Bip_C_Head', mat=None):
        bpy.ops.mesh.primitive_cone_add(vertices=12, radius1=r, radius2=0.0, depth=depth, location=loc)
        o = bpy.context.active_object
        o.rotation_euler = rot
        o.name = name
        attach(o, bone_name, mat or bone_mat)

    if cc and cc.get('belt'):
        bpy.ops.mesh.primitive_torus_add(major_radius=0.15, minor_radius=0.028, location=(0, 0.0, 1.0))
        o = bpy.context.active_object
        o.name = 'belt'
        o.scale = (1.0, 0.75, 1.0)
        attach(o, 'J_Bip_C_Spine', belt_mat)
    if cc and cc.get('spikes'):
        for sd in (-1, 1):
            for k2 in range(3):
                cone('spike', Vector((sd * (0.2 + 0.03 * k2), 0.0, 1.47 + 0.05 * (1 - abs(k2 - 1)))), (0, math.radians(sd * (35 + 20 * k2)), 0), 0.03, 0.14, 'J_Bip_C_UpperChest' if 'J_Bip_C_UpperChest' in arm.pose.bones else 'J_Bip_C_Spine', bone_mat)

    if p.get('horns'):
        for s in (-1, 1):
            cone('horn', ctr + Vector((s * R * 0.6, 0, R * 1.0)), (0, math.radians(s * 25), 0), R * 0.3, R * 1.6)
    if p.get('ears'):
        for s in (-1, 1):
            cone('ear', ctr + Vector((s * R * 1.5, 0, 0)), (0, math.radians(s * -90 + s * -15), 0), R * 0.35, R * 1.8)
    if p.get('tusks'):
        for s in (-1, 1):
            cone('tusk', ctr + Vector((s * R * 0.4, FS * R * 0.85, -R * 0.6)), (0, 0, 0), R * 0.14, R * 0.7)
    ag = p.get('age')
    if ag:
        pbh = arm.pose.bones['J_Bip_C_Head']
        if ag.get('head', 1.0) != 1.0:
            pbh.scale = (ag['head'],) * 3
        if ag.get('stoop'):
            for bn in ('J_Bip_C_Spine', 'J_Bip_C_Chest', 'J_Bip_C_Neck'):
                arm.pose.bones[bn].rotation_mode = 'XYZ'
                arm.pose.bones[bn].rotation_euler.x = -math.radians(ag['stoop'] / 2.0)
        if ag.get('beard'):
            for i2 in range(7):
                ang = math.radians(-70 + i2 * 23)
                cone('beard', ctr + Vector((R * 0.8 * math.sin(ang), FS * R * 0.8 * math.cos(ang), -R * 1.15)), (math.radians(180), 0, 0), R * 0.16, R * 0.9, 'J_Bip_C_Head', beard_mat)
    if p.get('gear'):
        add_gear(arm, objs, p['gear'], p['pal'], seed=int(x * 10) + 3, hue=p.get('hue', 0.0))
    if 'scale' in p:
        arm.scale = p['scale']
    roots = [o for o in objs if o.parent is None]
    piv = bpy.data.objects.new('piv', None)
    sc.collection.objects.link(piv)
    for r in roots:
        r.parent = piv
    piv.rotation_euler = (0, 0, math.radians(float(os.environ.get('VIEW_DEG', '180')) - (0 if vrm0 else 180)))     # 정면이 카메라로
    piv.location = (x, 0, 0)
    globals()['LAST'] = (arm, piv)


P['orc_warlord'] = _mix('orc', gear=['chest:straps', 'pauldron:spike', 'mantle', 'bracer:spike', 'flaps', 'greaves:spike', 'helm:horned'], pal='orc')
P['goblin_scrapper'] = _mix('goblin', gear=['hood', 'chest:straps', 'pauldron:round', 'bracer:cloth', 'flaps', 'necklace'], pal='goblin')
P['undead_knight'] = _mix('undead', gear=['helm:crest', 'chest:ribs', 'pauldron:layered', 'cape', 'bracer', 'greaves'], pal='undead')
P['demon_lord'] = _mix('demon', gear=['chest:plate', 'pauldron:spike', 'cape', 'bracer:spike', 'necklace', 'greaves'], pal='demon')
P['elder_sage'] = _mix('elder', gear=['hood', 'cape', 'necklace', 'bracer:cloth'], pal='sage')
P['dark_ranger'] = _mix('human', gear=['hood', 'cape', 'bracer:cloth', 'chest:straps', 'greaves:cloth'], pal='goblin')
_RAMPS = {'demon': ((0.12, 0.01, 0.04), (1.0, 0.42, 0.28)), 'undead': ((0.06, 0.10, 0.14), (0.78, 0.92, 0.88)), 'goblin': ((0.08, 0.14, 0.04), (0.82, 0.95, 0.40))}
for _k, _r in _RAMPS.items():
    P[_k + '_fancy_gm'] = dict(P[_k + '_fancy'], cloth_cfg=dict(P[_k + '_fancy']['cloth_cfg'], ramp=_r))
STEP = 1.5
for i, k in enumerate(kinds):
    build(k, i * STEP)
setup_light()
cam_d = bpy.data.cameras.new('cam')
cam = bpy.data.objects.new('cam', cam_d)
sc.collection.objects.link(cam)
sc.camera = cam
cam_d.type = 'ORTHO'
W = len(kinds) * STEP
cam.location = ((len(kinds) - 1) * STEP / 2, -8, 1.0)
cam.rotation_euler = (math.radians(90), 0, 0)
sc.render.resolution_x = 360 * len(kinds)
sc.render.resolution_y = 560
cam_d.ortho_scale = 2.2 * (sc.render.resolution_x / sc.render.resolution_y) / (len(kinds) * STEP / 2.2) if False else STEP * len(kinds)
cam.location.z = 0.95
set_engine()
fix_materials()
if os.environ.get('SPRITE_MODE'):
    clips = os.environ.get('CLIP', 'walk').split(',')          # 여러 동작은 쉼표 — 그러면 <out>/<동작>/ 폴더로 나뉜다
    nfr = int(os.environ.get('NFR', '8'))
    ndir = int(os.environ.get('NDIR', '4'))
    dir_list = [int(x) for x in os.environ.get('DIR_LIST', '').split(',') if x != ''] or list(range(ndir))
    px = int(os.environ.get('SPRITE_PX', '192'))
    arm, piv = LAST
    objs_before = {o.name for o in bpy.data.objects}
    bpy.ops.import_scene.gltf(filepath=os.environ['ANIM_GLB'])
    acts = {}
    for cname in clips:
        acts[cname] = bpy.data.actions[cname]
        acts[cname].use_fake_user = True
    for o in [o for o in bpy.data.objects if o.name not in objs_before]:
        bpy.data.objects.remove(o)
    arm.animation_data_create()
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    import weapon_attach                                       # WEAPON=<무기.glb> 이면 손에 쥐고 찍는다(K-0029 무기별 2D 시트)
    wobjs = weapon_attach.from_env(arm) or []
    two_clips = [x for x in os.environ.get('TWO_HAND_CLIPS', '').split(',') if x]   # 두 손 겨누기는 이 동작에서만(걷기·피격에선 앞손이 흔들려 무기가 휘청인다)
    sc.render.film_transparent = True
    sc.render.resolution_x = sc.render.resolution_y = px
    import json as _json
    base_deg = piv.rotation_euler.z
    meshes = [o for o in bpy.data.objects if o.type == 'MESH']
    for cname in clips:
        act = acts[cname]
        for o in wobjs[:1]:
            for c in o.constraints:
                c.influence = 1.0 if (not two_clips or cname in two_clips) else 0.0
        arm.animation_data.action = act
        if hasattr(arm.animation_data, 'action_slot') and act.slots:
            arm.animation_data.action_slot = act.slots[0]
        f0, f1 = act.frame_range
        # 카메라: ORTHO 가 있으면 고정 배율(모든 동작·캐릭터 같은 px/m, 발 위치 같음), 없으면 동작 전체 몸 상자
        lo = Vector((1e9, 1e9, 1e9)); hi = Vector((-1e9, -1e9, -1e9))
        for f in range(0, nfr, max(1, nfr // 6)):
            sc.frame_set(int(round(f0 + (f1 - f0) * f / nfr)))
            l2, h2 = bbox(meshes)
            lo = Vector((min(lo.x, l2.x), min(lo.y, l2.y), min(lo.z, l2.z))); hi = Vector((max(hi.x, h2.x), max(hi.y, h2.y), max(hi.z, h2.z)))
        size_m = max(hi.z - lo.z, hi.x - lo.x, hi.y - lo.y) * 1.12
        cam_z = (lo.z + hi.z) / 2
        if os.environ.get('ORTHO'):
            size_m = float(os.environ['ORTHO'])
            cam_z = float(os.environ.get('CAM_Z', '0.95'))
        cam_d.ortho_scale = size_m
        cam.location = (piv.location.x, -8, cam_z)
        odir = os.path.join(out, cname) if len(clips) > 1 else out
        os.makedirs(odir, exist_ok=True)
        _json.dump({'clip': cname, 'dirs': dir_list, 'frames': nfr, 'px': px, 'ortho_m': size_m, 'px_per_m': px / size_m,
                    'anchor_feet_y_px': px * (0.5 + cam_z / size_m)},
                   open(os.path.join(odir, 'meta.json'), 'w'), indent=1)
        for d in dir_list:
            piv.rotation_euler.z = base_deg - 2 * math.pi * d / ndir   # 10-06: − 로 돌려 옆(d=ndir/4)이 오른쪽을 본다 — 웹 mode2d 는 옆 = 오른쪽, 왼쪽은 뒤집음
            for f in range(nfr):
                sc.frame_set(int(round(f0 + (f1 - f0) * f / nfr)))
                sc.render.filepath = os.path.join(odir, f'd{d}_f{f:02d}.png')
                bpy.ops.render.render(write_still=True)
        print('SPRITES', odir, dir_list, nfr)
else:
    sc.render.filepath = out
    bpy.ops.render.render(write_still=True)
    print('RENDERED', out)
