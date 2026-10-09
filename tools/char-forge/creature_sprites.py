"""K-0090 ③ — 짐승·괴물 몸(뼈대+자기 동작, K-0043·K-0075 꼴)을 2D 시트 프레임으로 굽는다. 사람 시트(gear_sprites.py)와 같은 규격.

  blender -b --factory-startup -P tools/char-forge/creature_sprites.py -- <몸.glb> <출력 폴더>
  환경: NFR=8 SPRITE_PX=128 (기본)

산출: <출력>/<동작>/d<방향>_f<프레임>.png (방향 0 정면 · 1 오른쪽 옆 · 2 뒤 — 웹 mode2d 줄 순서, 반대 옆은 웹이 뒤집음) + meta.json
동작 짝: idle=Idle · walk=Walk · attack=Attack · hit=Hit · death=Death (몸 glb 의 애니메이션 이름).
카메라: 몸마다 한 배율(서 있기·걷기의 최대 폭·키 × 1.2, 공격·맞음·죽음까지 × 1.05 — 단 서 있기 배율의 CAP 배까지만), 발(z=0)은 위에서 88% 자리 — 사람 시트(ORTHO 2.5·CAM_Z 0.95)와 같은 발 기준선.
몸 앞 = glTF +z(K-0075·K-0084 규약) → 블렌더 −Y, 카메라는 −Y 에서 +Y 를 본다.
"""
import json
import math
import os
import sys

import bpy
from mathutils import Vector

argv = sys.argv[sys.argv.index('--') + 1:]
src, out = argv[0], argv[1]
NFR = int(os.environ.get('NFR', '8'))
PX = int(os.environ.get('SPRITE_PX', '128'))
CLIPS = [('idle', 'Idle'), ('walk', 'Walk'), ('attack', 'Attack'), ('hit', 'Hit'), ('death', 'Death')]
FEET = 0.88          # 발이 위에서 몇 할 자리(사람 시트 0.5 + 0.95/2.5 = 0.88)

bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
bpy.ops.import_scene.gltf(filepath=src)
objs = list(sc.objects)
arm = next((o for o in objs if o.type == 'ARMATURE'), None)
meshes = [o for o in objs if o.type == 'MESH']
piv = bpy.data.objects.new('piv', None)
sc.collection.objects.link(piv)
for o in objs:
    if o.parent is None:
        o.parent = piv

acts = {}
for key, name in CLIPS:
    a = bpy.data.actions.get(name) or next((x for x in bpy.data.actions if x.name.split('|')[-1].split('.')[0] == name or x.name.startswith(name)), None)
    if a:
        acts[key] = a


def targets(act):
    """동작을 받을 물체 — 뼈대가 있으면 뼈대, 없으면(K-0031 통째 움직임) 슬롯 이름의 물체(보통 MotionRoot)."""
    if arm is not None:
        return [arm]
    names = {getattr(s, 'name_display', None) or getattr(s, 'identifier', '')[2:] for s in getattr(act, 'slots', [])} or {'MotionRoot'}
    return [o for o in objs if o.name.split('.')[0] in names] or [o for o in objs if o.type == 'EMPTY']


def use(act):
    for t in targets(act):
        t.animation_data_create()
        t.animation_data.action = act
        if hasattr(t.animation_data, 'action_slot') and getattr(act, 'slots', None):
            t.animation_data.action_slot = act.slots[0]


def frames(act):
    f0, f1 = act.frame_range
    return [int(round(f0 + (f1 - f0) * f / NFR)) for f in range(NFR)]


def bbox():
    lo = Vector((1e9, 1e9, 1e9)); hi = Vector((-1e9, -1e9, -1e9))
    dg = bpy.context.evaluated_depsgraph_get()
    for o in meshes:
        ev = o.evaluated_get(dg)
        me = ev.to_mesh()
        mw = ev.matrix_world
        for v in me.vertices:
            p = mw @ v.co
            lo = Vector((min(lo.x, p.x), min(lo.y, p.y), min(lo.z, p.z))); hi = Vector((max(hi.x, p.x), max(hi.y, p.y), max(hi.z, p.z)))
        ev.to_mesh_clear()
    return lo, hi


# 죽음·맞음은 옆으로 굴러 넘어지며 몸이 칸 밖으로 미끄러진다(발 자리가 굴림 축, K-0031 통째 움직임) —
# 몸 가운데(폭 기준)를 첫 프레임 자리에 붙들어 제자리로 굽는다(사람 시트처럼 이동은 웹이 한다)
DRIFT = ('death', 'hit')
CAP = float(os.environ.get('CAP', '1.35'))


def hold(key, f, c0=None):
    """프레임 f 로 옮기고, 붙드는 동작이면 piv 를 옆으로 밀어 몸 가운데를 c0 에 둔다. c0 없으면 지금 가운데를 돌려준다."""
    piv.location.x = 0
    sc.frame_set(f)
    if key not in DRIFT:
        return None
    lo, hi = bbox()
    c = (lo.x + hi.x) / 2
    if c0 is not None:
        piv.location.x = c0 - c
    return c


# 한 배율: 서 있기·걷기 프레임의 최대 반폭(돌려도 들어가게 x·y 중 큰 쪽)과 키 × 여유 MARGIN
MARGIN = float(os.environ.get('MARGIN', '1.2'))
half, top = 0.0, 0.0
for key, act in [(k, a) for k, a in acts.items() if k in ('idle', 'walk')] or list(acts.items()):
    use(act)
    for f in frames(act)[::2]:
        sc.frame_set(f)
        lo, hi = bbox()
        half = max(half, abs(lo.x), abs(hi.x), abs(lo.y), abs(hi.y))
        top = max(top, hi.z)
size = max(2 * half * MARGIN, top * MARGIN / (FEET - 0.04))
# 공격 돌진·맞음·죽음(제자리로 붙든 뒤)도 들어가게 넓히되, 서 있기 배율의 CAP 배까지만(몸이 너무 작아지지 않게)
xh, xt = 0.0, 0.0
for key in ('attack', 'hit', 'death'):
    if key not in acts:
        continue
    use(acts[key])
    for d in (0, 1):                                   # 뒤(2)는 정면의 좌우 거울 — 폭이 같다
        piv.rotation_euler.z = math.radians(90 * d)
        fs = frames(acts[key])
        c0 = hold(key, fs[0])
        for f in fs:
            hold(key, f, c0)
            lo, hi = bbox()
            xh = max(xh, abs(lo.x), abs(hi.x))
            xt = max(xt, hi.z)
piv.rotation_euler.z = 0
piv.location.x = 0
size = max(size, min(size * CAP, max(2 * xh * 1.05, xt * 1.05 / (FEET - 0.04))) if xh else size)
cam_z = size * (FEET - 0.5)

cam_d = bpy.data.cameras.new('cam')
cam_d.type = 'ORTHO'
cam_d.ortho_scale = size
cam = bpy.data.objects.new('cam', cam_d)
sc.collection.objects.link(cam)
cam.location = (0, -20, cam_z)
cam.rotation_euler = (math.radians(90), 0, 0)
sc.camera = cam
for nm, rot, en in (('key', (50, 0, -35), 3.0), ('fill', (60, 0, 140), 1.2), ('rim', (20, 0, 180), 0.8)):
    ld = bpy.data.lights.new(nm, 'SUN')
    ld.energy = en
    lo = bpy.data.objects.new(nm, ld)
    lo.rotation_euler = tuple(math.radians(x) for x in rot)
    sc.collection.objects.link(lo)
w = bpy.data.worlds.new('w')
w.use_nodes = True
w.node_tree.nodes['Background'].inputs[0].default_value = (0.55, 0.55, 0.58, 1)
w.node_tree.nodes['Background'].inputs[1].default_value = 0.8
sc.world = w
for eng in ('BLENDER_EEVEE_NEXT', 'BLENDER_EEVEE'):
    try:
        sc.render.engine = eng
        break
    except TypeError:
        continue
sc.view_settings.view_transform = 'Standard'
sc.render.film_transparent = True
sc.render.resolution_x = sc.render.resolution_y = PX
sc.render.image_settings.file_format = 'PNG'
sc.render.image_settings.color_mode = 'RGBA'

os.makedirs(out, exist_ok=True)
done = []
for key, act in acts.items():
    use(act)
    od = os.path.join(out, key)
    os.makedirs(od, exist_ok=True)
    for d in (0, 1, 2):
        piv.rotation_euler.z = math.radians(90 * d)      # 0 정면(−Y 를 봄) · 1 오른쪽(+X) · 2 뒤
        c0 = hold(key, frames(act)[0])
        for i, f in enumerate(frames(act)):
            hold(key, f, c0)
            sc.render.filepath = os.path.join(od, f'd{d}_f{i:02d}.png')
            bpy.ops.render.render(write_still=True)
    done.append(key)
json.dump({'clips': done, 'missing': [k for k, _ in CLIPS if k not in acts], 'frames': NFR, 'px': PX, 'ortho_m': round(size, 4),
           'cam_z': round(cam_z, 4), 'anchor_feet_y_px': round(PX * FEET, 2)}, open(os.path.join(out, 'meta.json'), 'w'), indent=1)
print('CREATURE_SPRITES', src, done, 'size', round(size, 3))
