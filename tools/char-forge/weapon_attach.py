"""무기 GLB 를 VRoid 손뼈에 붙인다(K-0029) — 점검 띠 렌더(render/render_clip_strip.py)와 2D 시트 굽기(gear_sprites.py)가 같이 쓴다.

무기 = world-forge build_weapon 산출(원점 = grip 손바닥 가운데, 날·자루 축 +z, 날 면 +y).
한 손: 주먹을 쥐면 날은 엄지 쪽으로 나온다 — z = 엄지 방향에서 손가락 방향 성분을 뺀 것, x = 손가락 × z.
두 손(창·도끼·지팡이): 축 +z 를 매 프레임 반대 손뼈로 겨눈다(DAMPED_TRACK) — keyframes.py `_two` 가 뒷손(오른손)→앞손(왼손)을 자루 방향으로 둔다.
엔진도 같은 규칙으로 붙이면 3D·2D 가 같은 모양이 된다.
"""
import os

import bpy
from mathutils import Matrix

TWO_HAND = ('spear', 'axe', 'staff')
OFF_HAND = ('bow', 'shield')


def attach(arm, path, side='R', two_hand=False):
    hb, mb, tb = (arm.data.bones.get(f'J_Bip_{side}_{n}') for n in ('Hand', 'Middle1', 'Thumb1'))
    if not (hb and mb and tb):
        print('NOHAND', side)
        return None
    sc = bpy.context.scene
    old = arm.data.pose_position
    arm.data.pose_position = 'REST'
    bpy.context.view_layer.update()
    mw = arm.matrix_world
    h, m, t = mw @ hb.head_local, mw @ mb.head_local, mw @ tb.head_local
    f = (m - h).normalized()
    z = ((t - h) - f * (t - h).dot(f)).normalized()
    x = f.cross(z).normalized()
    y = z.cross(x)
    M = Matrix((x, y, z)).transposed().to_4x4()
    M.translation = h + (m - h) * 0.75 + (t - h).dot(z) * z * 0.3
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=os.path.abspath(path))
    new = [o for o in bpy.data.objects if o not in before]
    root = bpy.data.objects.new('wp_root', None)
    sc.collection.objects.link(root)
    for o in new:
        if o.parent is None:
            o.parent = root
    root.parent = arm
    root.parent_type = 'BONE'
    root.parent_bone = hb.name
    bpy.context.view_layer.update()
    root.matrix_world = M
    bpy.context.view_layer.update()
    if two_hand:
        other = arm.data.bones.get('J_Bip_%s_Hand' % ('L' if side == 'R' else 'R'))
        c = root.constraints.new('DAMPED_TRACK')
        c.target, c.subtarget, c.track_axis = arm, other.name, 'TRACK_Z'
    arm.data.pose_position = old
    bpy.context.view_layer.update()
    print('WEAPON', os.path.basename(path), side, 'two' if two_hand else 'one')
    return [root] + new


def from_env(arm):
    """WEAPON=<glb> [WEAPON_HAND=R|L] [TWO_HAND=1] 이면 붙인다. 무기 종류를 파일 이름(wpn_<종류>_…)에서 읽어 손·두 손을 기본값으로."""
    p = os.environ.get('WEAPON')
    if not p:
        return None
    kind = os.path.basename(p).split('_')[1] if os.path.basename(p).startswith('wpn_') else ''
    side = os.environ.get('WEAPON_HAND') or ('L' if kind in OFF_HAND else 'R')
    two = os.environ.get('TWO_HAND', '1' if kind in TWO_HAND else '') not in ('', '0')
    return attach(arm, p, side, two)
