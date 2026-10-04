"""K-0037 적합 시험 — 몸 하나에 갑옷 한 벌(6 슬롯)·악세사리를 소켓 규약대로 입혀 앞·3/4 두 장을 찍는다. Blender 헤드리스.

  blender -b --factory-startup -P tools/world-forge/equip_fit_test.py -- <몸.glb(abs)> <조각 GLB 폴더(abs)> <출력.png(abs)> <쉼표 id 목록: eq_past_2 또는 eq_past_2,acc_cap,acc_cape_short>

`eq_<시대>_<등급>` 만 쓰면 슬롯 6 개를 전부 입힌다. 원점 = 뼈 머리(몸 쉼 자세) · 오른쪽은 왼쪽 조각의 X 배율 -1. 배율 = 몸 머리 뼈 높이 / 기준 1.50m.
뚫림은 눈으로(찍은 그림) 본다 — 수치 판정은 하지 않는다.
"""
import bpy
import json
import math
import os
import sys

from mathutils import Matrix, Vector

a = sys.argv[sys.argv.index('--') + 1:]
body, pdir, out = [os.path.abspath(x) for x in a[:3]]
ids = a[3].split(',')
SLOTS = ('head', 'chest', 'shoulder', 'arm', 'leg', 'boot')

bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
bpy.ops.import_scene.gltf(filepath=body)
arm = next(o for o in bpy.data.objects if o.type == 'ARMATURE')
body_objs = set(bpy.data.objects.keys())


def head_of(bone):
    b = arm.data.bones.get(bone)
    return arm.matrix_world @ b.head_local if b else None


scale = (head_of('J_Bip_C_Head').z or 1.5) / 1.50
pieces = []
for i in ids:
    pieces += [f'{i}_{s}' for s in SLOTS] if i.startswith('eq_') and i.count('_') == 2 else [i]
for pid in pieces:
    p = os.path.join(pdir, pid + '.glb')
    lic = json.load(open(os.path.join(pdir, pid + '.license.json'), encoding='utf-8'))
    sides = [(lic['bone'], 1)]
    if lic.get('mirror'):
        sides.append((lic['bone'].replace('_L_', '_R_'), -1))
    for bone, sx in sides:
        before = set(bpy.data.objects.keys())
        bpy.ops.import_scene.gltf(filepath=p)
        new = [bpy.data.objects[n] for n in set(bpy.data.objects.keys()) - before]
        pos = head_of(bone)
        if pos is None:
            print('FIT_MISSING_BONE', bone)
            continue
        for o in new:
            if o.parent is None:
                o.location = pos
                o.scale = (scale * sx, scale, scale)

for eng in ('BLENDER_EEVEE_NEXT', 'BLENDER_EEVEE'):
    try:
        sc.render.engine = eng
        break
    except TypeError:
        pass
W, H = 420, 560
sc.render.resolution_x, sc.render.resolution_y = W, H
wd = bpy.data.worlds.new('w')
sc.world = wd
wd.use_nodes = True
wd.node_tree.nodes['Background'].inputs[0].default_value = (0.6, 0.65, 0.72, 1)
sun = bpy.data.objects.new('sun', bpy.data.lights.new('sun', 'SUN'))
sc.collection.objects.link(sun)
sun.data.energy = 3.0
sun.rotation_euler = (math.radians(50), 0, math.radians(-30))
cd = bpy.data.cameras.new('c')
cam = bpy.data.objects.new('c', cd)
sc.collection.objects.link(cam)
sc.camera = cam
cd.type = 'ORTHO'
cd.ortho_scale = 2.0
tgt = bpy.data.objects.new('t', None)
sc.collection.objects.link(tgt)
tc = cam.constraints.new('TRACK_TO')
tc.target = tgt
tc.track_axis = 'TRACK_NEGATIVE_Z'
tc.up_axis = 'UP_Y'
tgt.location = (0, 0, 0.85 * scale)
shots = []
for k, az in enumerate((0, 40)):
    cam.location = (-6 * math.sin(math.radians(az)), -6 * math.cos(math.radians(az)), 0.95)
    p = out.replace('.png', f'_{k}.png')
    sc.render.filepath = p
    bpy.ops.render.render(write_still=True)
    shots.append(p)
print('FIT_DONE', ','.join(shots))
