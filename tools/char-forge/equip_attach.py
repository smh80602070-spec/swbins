"""장비 조각(K-0037 build_equip 산출 eq_*·acc_*)을 VRoid 뼈에 붙인다 — 2D 층 시트 굽기(gear_sprites.py LAYERS)가 쓴다.

규약은 tools/world-forge/equip_fit_test.py·data/equip_slots.json 과 같다: 조각 원점 = 붙일 뼈 머리(쉼 자세), 인물 앞 = Blender -Y,
균등 배율 = 몸 머리 뼈 높이 / 1.50m, `mirror` 조각은 오른쪽 뼈에 X 배율 -1 로 한 짝 더. 시착 시험과 달리 뼈를 부모로 둬 동작을 따라간다.
`eq_<시대>_<등급>` 만 주면 슬롯 6 개(head·chest·shoulder·arm·leg·boot)를 전부 붙인다.
  EQUIP=<조각 폴더>|eq_past_2,acc_cape_short   (gear_sprites.py SPRITE_MODE 에서 from_env)
"""
import json
import os

import bpy
from mathutils import Matrix

SLOTS = ('head', 'chest', 'shoulder', 'arm', 'leg', 'boot')


def pieces_of(ids):
    out = []
    for i in ids:
        out += [f'{i}_{s}' for s in SLOTS] if i.startswith('eq_') and i.count('_') == 2 else [i]
    return out


def attach(arm, pdir, ids):
    sc = bpy.context.scene
    old = arm.data.pose_position
    arm.data.pose_position = 'REST'
    bpy.context.view_layer.update()
    mw = arm.matrix_world
    hb = arm.data.bones.get('J_Bip_C_Head')
    scale = ((mw @ hb.head_local).z if hb else 1.5) / 1.50
    objs = []
    for pid in pieces_of(ids):
        lic = json.load(open(os.path.join(pdir, pid + '.license.json'), encoding='utf-8'))
        sides = [(lic['bone'], 1)] + ([(lic['bone'].replace('_L_', '_R_'), -1)] if lic.get('mirror') else [])
        for bone, sx in sides:
            b = arm.data.bones.get(bone)
            if b is None:
                print('EQUIP_MISSING_BONE', pid, bone)
                continue
            before = set(bpy.data.objects)
            bpy.ops.import_scene.gltf(filepath=os.path.join(pdir, pid + '.glb'))
            new = [o for o in bpy.data.objects if o not in before]
            root = bpy.data.objects.new('eq_root_' + pid, None)
            sc.collection.objects.link(root)
            for o in new:
                if o.parent is None:
                    o.parent = root
            root.parent = arm
            root.parent_type = 'BONE'
            root.parent_bone = bone
            bpy.context.view_layer.update()
            root.matrix_world = Matrix.Translation(mw @ b.head_local) @ Matrix.Diagonal((scale * sx, scale, scale, 1.0))
            bpy.context.view_layer.update()
            objs += [root] + new
    arm.data.pose_position = old
    bpy.context.view_layer.update()
    print('EQUIP', len(pieces_of(ids)), 'pieces', round(scale, 3))
    return objs


def from_env(arm):
    v = os.environ.get('EQUIP')
    if not v:
        return None
    pdir, ids = v.rsplit('|', 1)
    return attach(arm, os.path.abspath(pdir), [x for x in ids.split(',') if x])
