"""K-0123 5천하 병사 몸(보병) — 빌린 Knight_Male(Quaternius) 대신 코드로 지은 2등신 저폴리 병사 한 벌.

  "/c/Program Files/Blender Foundation/Blender 5.2/blender.exe" -b --factory-startup -P tools/char-forge/build_trooper.py -- <출력.glb>

웹 규약(saga-realm/js/asset3d.js TROOPER·TROOP_TINT·seatRider 그대로):
  뼈 `Root`>`Hips`>…·`Fist.R`(창 쥘 손)·`Head` · 세력색 재질 이름 `Red`(투구 깃·가슴 천·허리띠 술 — 이 재질만 칠한다)
  클립 Idle·Walk·Attack·Hit·Death·SitDown(기병은 SitDown 끝 자세로 말 등에 엉덩이 뼈를 맞춘다) · 앞 = -Y(glTF +Z) · 바닥 원점.
부품마다 한 뼈에 통째로 묶는다(저폴리 갑옷이라 굽힘 무게가 필요 없다 — 찢김 0). 재질은 단색 5: Armor·Armor_Dark·Skin·Detail·Red.
퓨전 원칙: 미늘 치마·투구 깃(과거) + 무릎·팔꿈치 덧댄 판(현대 보호대) + 투구 눈 띠의 옅은 빛(미래). 삼각형 ≤ 옛 2989.
"""
import math
import os
import sys

import bpy
from mathutils import Matrix, Quaternion, Vector

FPS = 24
X, Y, Z = Vector((1, 0, 0)), Vector((0, 1, 0)), Vector((0, 0, 1))
OUT = os.path.abspath(sys.argv[sys.argv.index('--') + 1])

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.fps = FPS


def mat(name, rgb, metal=0.0, rough=0.6, emit=None):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    p = m.node_tree.nodes['Principled BSDF']
    p.inputs['Base Color'].default_value = (*rgb, 1)
    p.inputs['Metallic'].default_value = metal
    p.inputs['Roughness'].default_value = rough
    if emit:
        p.inputs['Emission Color'].default_value = (*emit, 1)
        p.inputs['Emission Strength'].default_value = 1.5
    return m


def srgb(h):
    h = h.lstrip('#')
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c)


M = {'Armor': mat('Armor', srgb('#8f98a3'), 0.0, 0.45), 'Armor_Dark': mat('Armor_Dark', srgb('#3a3f48'), 0.0, 0.55),
     'Skin': mat('Skin', srgb('#d9a27e'), 0.0, 0.7), 'Detail': mat('Detail', srgb('#6b4a2e'), 0.0, 0.75),
     'Red': mat('Red', srgb('#b5352a'), 0.0, 0.8), 'Glow': mat('Detail_Glow', srgb('#7fd9ff'), 0.0, 0.4, emit=srgb('#7fd9ff'))}

# ---- 뼈대(미터, 앞 -Y, 왼쪽 +X) ----
BONES = [  # 이름, 머리, 꼬리, 부모
    ('Root', (0, 0, 0), (0, 0, 0.12), None),
    ('Hips', (0, 0, 0.62), (0, 0, 0.76), 'Root'),
    ('Torso', (0, 0, 0.76), (0, 0, 1.0), 'Hips'),
    ('Head', (0, 0, 1.0), (0, 0, 1.5), 'Torso'),
    ('UpperArm.L', (0.25, 0, 0.96), (0.29, 0, 0.74), 'Torso'), ('LowerArm.L', (0.29, 0, 0.74), (0.31, -0.02, 0.55), 'UpperArm.L'),
    ('Fist.L', (0.31, -0.02, 0.55), (0.31, -0.03, 0.46), 'LowerArm.L'),
    ('UpperArm.R', (-0.25, 0, 0.96), (-0.29, 0, 0.74), 'Torso'), ('LowerArm.R', (-0.29, 0, 0.74), (-0.31, -0.02, 0.55), 'UpperArm.R'),
    ('Fist.R', (-0.31, -0.02, 0.55), (-0.31, -0.03, 0.46), 'LowerArm.R'),
    ('UpperLeg.L', (0.11, 0, 0.6), (0.12, 0, 0.33), 'Hips'), ('LowerLeg.L', (0.12, 0, 0.33), (0.12, 0.01, 0.07), 'UpperLeg.L'),
    ('Foot.L', (0.12, 0.01, 0.07), (0.12, -0.12, 0.03), 'LowerLeg.L'),
    ('UpperLeg.R', (-0.11, 0, 0.6), (-0.12, 0, 0.33), 'Hips'), ('LowerLeg.R', (-0.12, 0, 0.33), (-0.12, 0.01, 0.07), 'UpperLeg.R'),
    ('Foot.R', (-0.12, 0.01, 0.07), (-0.12, -0.12, 0.03), 'LowerLeg.R'),
]
ad = bpy.data.armatures.new('TrooperArmature')
arm = bpy.data.objects.new('TrooperArmature', ad)
scene.collection.objects.link(arm)
bpy.context.view_layer.objects.active = arm
bpy.ops.object.mode_set(mode='EDIT')
for n, h, t, p in BONES:
    b = ad.edit_bones.new(n)
    b.head, b.tail = Vector(h), Vector(t)
    b.align_roll(Vector((0, -1, 0)) if abs((b.tail - b.head).normalized().z) > 0.7 else Vector((0, 0, 1)))
    if p:
        b.parent = ad.edit_bones[p]
bpy.ops.object.mode_set(mode='OBJECT')

# ---- 부품(한 부품 = 한 뼈) ----
PARTS = []


def part(op, bone, material, loc, scale=(1, 1, 1), rot=(0, 0, 0), **kw):
    op(location=loc, rotation=rot, **kw)
    o = bpy.context.active_object
    o.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    o.data.materials.append(M[material])
    PARTS.append((o, bone))
    return o


cyl = bpy.ops.mesh.primitive_cylinder_add
cone = bpy.ops.mesh.primitive_cone_add
cube = bpy.ops.mesh.primitive_cube_add
sph = bpy.ops.mesh.primitive_uv_sphere_add
for s, sx in (('L', 1), ('R', -1)):
    part(cyl, 'UpperLeg.' + s, 'Armor_Dark', (sx * 0.115, 0, 0.47), (0.075, 0.08, 0.15), vertices=8)
    part(cyl, 'LowerLeg.' + s, 'Armor', (sx * 0.12, 0.005, 0.2), (0.08, 0.085, 0.14), vertices=8)
    part(cube, 'LowerLeg.' + s, 'Armor_Dark', (sx * 0.12, -0.075, 0.34), (0.06, 0.03, 0.05))           # 무릎 덧판
    part(cube, 'Foot.' + s, 'Detail', (sx * 0.12, -0.04, 0.04), (0.07, 0.12, 0.045))
    part(sph, 'UpperArm.' + s, 'Armor', (sx * 0.26, 0, 0.93), (0.11, 0.11, 0.09), segments=8, ring_count=5)   # 어깨 갑
    part(cyl, 'UpperArm.' + s, 'Armor_Dark', (sx * 0.275, 0, 0.82), (0.05, 0.05, 0.1), vertices=8)
    part(cyl, 'LowerArm.' + s, 'Detail', (sx * 0.3, -0.01, 0.645), (0.055, 0.055, 0.09), vertices=8)       # 토시
    part(cube, 'LowerArm.' + s, 'Armor_Dark', (sx * 0.3, 0.035, 0.74), (0.04, 0.025, 0.04))               # 팔꿈치 덧판
    part(sph, 'Fist.' + s, 'Detail', (sx * 0.31, -0.025, 0.5), (0.06, 0.06, 0.06), segments=8, ring_count=5)
part(cube, 'Hips', 'Armor_Dark', (0, 0, 0.67), (0.18, 0.13, 0.09))
part(cone, 'Hips', 'Armor', (0, 0, 0.6), (0.27, 0.22, 0.13), vertices=10, radius1=1.0, radius2=0.8, depth=1.0)   # 미늘 치마
part(cube, 'Hips', 'Detail', (0, 0, 0.74), (0.215, 0.165, 0.03))                                          # 허리띠
part(cube, 'Hips', 'Red', (0.0, -0.17, 0.63), (0.07, 0.01, 0.1))                                         # 앞 술(세력색)
part(cyl, 'Torso', 'Armor', (0, 0, 0.88), (0.2, 0.16, 0.13), vertices=10)                               # 흉갑
part(cube, 'Torso', 'Red', (0, -0.155, 0.88), (0.12, 0.012, 0.11))                                       # 가슴 천(세력색)
part(cyl, 'Torso', 'Armor_Dark', (0, 0, 1.01), (0.07, 0.07, 0.03), vertices=8)                          # 목
part(sph, 'Head', 'Armor', (0, 0, 1.24), (0.27, 0.26, 0.25), segments=12, ring_count=8)                 # 큰 투구(2등신)
part(cyl, 'Head', 'Armor_Dark', (0, 0, 1.06), (0.285, 0.275, 0.035), vertices=12)                       # 투구 아래 테
part(cube, 'Head', 'Armor_Dark', (0, -0.24, 1.22), (0.17, 0.03, 0.035))                                 # 눈 띠
part(cube, 'Head', 'Glow', (0, -0.262, 1.22), (0.13, 0.008, 0.012))                                     # 눈 띠 빛(미래)
part(cube, 'Head', 'Armor', (0, -0.235, 1.12), (0.03, 0.03, 0.08))                                      # 코 가리개
part(cone, 'Head', 'Red', (0, 0.06, 1.56), (0.06, 0.06, 0.13), rot=(math.radians(-25), 0, 0), vertices=6)   # 투구 깃(세력색)
part(cyl, 'Head', 'Armor_Dark', (0, 0, 1.49), (0.025, 0.025, 0.03), vertices=6)

# 하나로 합치고 무게(부품 = 뼈 하나)
for o, bone in PARTS:
    vg = o.vertex_groups.new(name=bone)
    vg.add(list(range(len(o.data.vertices))), 1.0, 'REPLACE')
bpy.ops.object.select_all(action='DESELECT')
for o, _ in PARTS:
    o.select_set(True)
bpy.context.view_layer.objects.active = PARTS[0][0]
bpy.ops.object.join()
body = bpy.context.active_object
body.name = 'TrooperBody'
for p in body.data.polygons:
    p.use_smooth = False
body.parent = arm
mod = body.modifiers.new('Armature', 'ARMATURE')
mod.object = arm
tris = sum(len(p.vertices) - 2 for p in body.data.polygons)


# ---- 동작(시간 함수, 각 = 아마추어 공간 축·도) — 앞으로 = X 축 음의 회전 ----
def walk(t):
    s = math.sin(2 * math.pi * t)
    c = math.cos(2 * math.pi * t)
    return {'UpperLeg.L': [(X, -28 * s)], 'UpperLeg.R': [(X, 28 * s)],
            'LowerLeg.L': [(X, 30 * max(0.0, c))], 'LowerLeg.R': [(X, 30 * max(0.0, -c))],
            'UpperArm.L': [(X, 22 * s)], 'UpperArm.R': [(X, -22 * s)], 'Torso': [(Z, 4 * s)],
            '_loc': Vector((0, 0, 0.025 * abs(c)))}


def idle(t):
    s = math.sin(2 * math.pi * t)
    return {'Torso': [(X, 2.5 * s)], 'Head': [(X, -1.5 * s)], 'UpperArm.L': [(Y, -4 + 2 * s)], 'UpperArm.R': [(Y, 4 - 2 * s)],
            '_loc': Vector((0, 0, 0.006 * s))}


def attack(t):                     # 창 찌르기 — 오른팔 들어 앞으로, 몸통 비틀며 내딛기
    k = math.sin(math.pi * min(1.0, t / 0.6)) if t < 0.6 else 0.0
    w = math.sin(math.pi * min(1.0, t / 0.3)) * (1 - min(1.0, t / 0.3)) if t < 0.3 else 0.0
    return {'UpperArm.R': [(X, -100 * k + 20 * w)], 'LowerArm.R': [(X, -15 * k)], 'Torso': [(Z, -18 * k + 10 * w), (X, -8 * k)],
            'UpperLeg.L': [(X, -25 * k)], 'LowerLeg.L': [(X, 15 * k)], 'UpperLeg.R': [(X, 15 * k)], '_loc': Vector((0, -0.08 * k, -0.03 * k))}


def hit(t):
    k = math.sin(math.pi * min(1.0, t * 1.3))
    return {'Torso': [(X, 18 * k)], 'Head': [(X, 12 * k)], 'UpperArm.L': [(X, 20 * k)], 'UpperArm.R': [(X, 20 * k)], '_loc': Vector((0, 0.04 * k, 0))}


def death(t):                      # 뒤로 쓰러짐(옛 Defeat 자리)
    e = (lambda k: k * k * (3 - 2 * k))(max(0.0, min(1.0, t / 0.7)))
    return {'_rot': [(X, 88 * e)], '_loc': Vector((0, 0.15 * e, 0.12 * e)), 'UpperArm.L': [(Y, -40 * e)], 'UpperArm.R': [(Y, 40 * e)],
            'UpperLeg.L': [(X, -20 * e)], 'Head': [(X, -10 * e)]}


def sitdown(t):                    # 말 등에 걸터앉기 — 끝 자세가 쓰인다(허벅지 앞으로, 정강이 아래로, 다리 벌림)
    e = (lambda k: k * k * (3 - 2 * k))(min(1.0, t))
    return {'UpperLeg.L': [(X, -80 * e), (Y, -22 * e)], 'UpperLeg.R': [(X, -80 * e), (Y, 22 * e)],
            'LowerLeg.L': [(X, 75 * e)], 'LowerLeg.R': [(X, 75 * e)], 'UpperArm.L': [(X, -25 * e)], 'UpperArm.R': [(X, -25 * e)],
            '_loc': Vector((0, 0, -0.25 * e))}


ACTS = {'Idle': (True, 48, idle), 'Walk': (True, 24, walk), 'Attack': (False, 18, attack), 'Hit': (False, 12, hit),
        'Death': (False, 30, death), 'SitDown': (False, 20, sitdown)}

arm.animation_data_create()
made = []
for name, (loop, n, fn) in ACTS.items():
    act = bpy.data.actions.new(name)
    act.use_fake_user = True
    arm.animation_data.action = act
    for f in range(0, n + 1):
        t = (f % n) / n if loop else f / n
        pose = fn(t)
        for pb in arm.pose.bones:
            pb.rotation_mode = 'QUATERNION'
            pb.rotation_quaternion = Quaternion()
            pb.location = Vector()
        for bn, rots in pose.items():
            if bn.startswith('_'):
                continue
            pb = arm.pose.bones[bn]
            R = Quaternion()
            for ax, deg in rots:
                R = Quaternion(ax, math.radians(deg)) @ R
            B = pb.bone.matrix_local.to_3x3()
            pb.rotation_quaternion = (B.inverted() @ R.to_matrix() @ B).to_quaternion()
        root = arm.pose.bones['Root']
        Rr = Quaternion()
        for ax, deg in pose.get('_rot', []):
            Rr = Quaternion(ax, math.radians(deg)) @ Rr
        B = root.bone.matrix_local.to_3x3()
        root.rotation_quaternion = (B.inverted() @ Rr.to_matrix() @ B).to_quaternion()
        root.location = B.inverted() @ pose.get('_loc', Vector())
        for pb in arm.pose.bones:
            pb.keyframe_insert('rotation_quaternion', frame=f, group=pb.name)
        root.keyframe_insert('location', frame=f, group='Root')
    made.append(act)
for act in made:
    tr = arm.animation_data.nla_tracks.new()
    tr.name = act.name
    tr.strips.new(act.name, 0, act)
arm.animation_data.action = None

os.makedirs(os.path.dirname(OUT), exist_ok=True)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', export_animations=True, export_animation_mode='NLA_TRACKS',
                          export_skins=True, export_apply=False)
print('TROOPER', os.path.basename(OUT), 'tris', tris, 'bones', [b.name for b in ad.bones], 'acts', [a.name for a in made], 'kb', os.path.getsize(OUT) // 1024)
