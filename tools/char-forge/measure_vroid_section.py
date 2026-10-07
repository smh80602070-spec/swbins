"""VRoid 몸 단면 재기 (K-0081) — 장비 조각(build_equip.py)의 기준 몸을 지금 몸(VRoid)으로 바꾸려고 뼈마다 둘레를 잰다. Blender 헤드리스.

  blender -b --factory-startup -P tools/char-forge/measure_vroid_section.py -- --out <절대>/sections.json [--only id,id] [--limit N]

입력 = `_out/vroid/<id>/<id>.glb`(옷 이식 몸, T-자세 = 쉼 자세). 좌표는 build_equip 과 같다: Z 위, 인물 앞 = −Y, 단위 m.
정점을 가장 무거운 뼈(정점 그룹)로 나눠 — 몸통(Hips·Spine·Chest·UpperChest) 은 가슴뼈(J_Bip_C_Chest) 머리 높이 기준 층(dz)마다
반폭(rx)·앞 깊이·등 깊이·가운데 y, 팔·다리 뼈는 뼈 축에서 가장 먼 거리(반지름 90분위)를 잰다. 옷 정점 포함(바깥 = 옷 겉면).
"""
import bpy, json, os, sys, glob, math
from mathutils import Vector

a = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
arg = lambda k, d=None: a[a.index(k) + 1] if k in a else d
HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, '_out', 'vroid')
OUT = os.path.abspath(arg('--out', os.path.join(HERE, '_out', 'sections.json')))
ONLY = [x for x in (arg('--only') or '').split(',') if x]
LIMIT = int(arg('--limit', '0'))
TORSO = {'J_Bip_C_Hips', 'J_Bip_C_Spine', 'J_Bip_C_Chest', 'J_Bip_C_UpperChest'}
# 뼈 → 끝으로 쓸 다음 뼈(glTF 가져오기는 뼈 끝을 지어내서 tail 이 실제 길이가 아니다)
LIMBS = {'upperarm': ('J_Bip_L_UpperArm', 'J_Bip_L_LowerArm'), 'lowerarm': ('J_Bip_L_LowerArm', 'J_Bip_L_Hand'),
         'upperleg': ('J_Bip_L_UpperLeg', 'J_Bip_L_LowerLeg'), 'lowerleg': ('J_Bip_L_LowerLeg', 'J_Bip_L_Foot')}
DZ = [round(-0.20 + 0.05 * i, 2) for i in range(12)]           # 가슴뼈 기준 −0.20 … +0.35


def q(vals, p):
    if not vals:
        return None
    v = sorted(vals)
    return v[min(len(v) - 1, int(p * (len(v) - 1) + 0.5))]


def measure(path):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=path)
    arm = next(o for o in bpy.data.objects if o.type == 'ARMATURE')
    bones = {b.name: arm.matrix_world @ b.head_local for b in arm.data.bones}
    tails = {b.name: arm.matrix_world @ b.tail_local for b in arm.data.bones}
    chest = bones['J_Bip_C_Chest']
    groups = {}
    for ob in [o for o in bpy.data.objects if o.type == 'MESH']:
        mat = ob.matrix_world
        names = {g.index: g.name for g in ob.vertex_groups}
        mname = ' '.join(s.material.name for s in ob.material_slots if s.material).upper()
        is_face = '_FACE' in mname or '_EYE' in mname
        if is_face:
            continue
        for v in ob.data.vertices:
            if not v.groups:
                continue
            g = max(v.groups, key=lambda x: x.weight)
            nm = names.get(g.group)
            if nm:
                groups.setdefault(nm, []).append(mat @ v.co)
    torso = [p for n in TORSO for p in groups.get(n, [])]
    rows = []
    for dz in DZ:
        z = chest.z + dz
        band = [p for p in torso if abs(p.z - z) < 0.025]
        if len(band) < 8:
            rows.append({'dz': dz, 'n': len(band)})
            continue
        xs = [abs(p.x - chest.x) for p in band]
        ys = [p.y for p in band]
        cy = (max(ys) + min(ys)) / 2
        rows.append({'dz': dz, 'n': len(band), 'rx': round(q(xs, 0.97), 4), 'front': round(cy - q(ys, 0.03), 4), 'back': round(q(ys, 0.97) - cy, 4), 'cy': round(cy - chest.y, 4)})
    limbs = {}
    for key, (bn, nxt) in LIMBS.items():
        h, t = bones[bn], bones[nxt]
        ax = (t - h)
        L = ax.length
        ax.normalize()
        rs = []
        for p in groups.get(bn, []):
            d = p - h
            along = d.dot(ax)
            if 0.1 * L < along < 0.9 * L:
                rs.append((d - ax * along).length)
        limbs[key] = {'len': round(L, 4), 'r90': round(q(rs, 0.9) or 0, 4), 'r50': round(q(rs, 0.5) or 0, 4)}
    foot = groups.get('J_Bip_L_Foot', []) + groups.get('J_Bip_L_ToeBase', [])
    head = groups.get('J_Bip_C_Head', [])
    hb = bones['J_Bip_C_Head']
    res = {
        'chest_z': round(chest.z, 4), 'head_z': round(hb.z, 4), 'k': round(hb.z / 1.5, 4),   # 엔진 균등 배율(equip_slots: 머리 뼈 높이 / 1.5)
        'neck_dz': round(bones['J_Bip_C_Neck'].z - chest.z, 4), 'upperchest_dz': round(bones['J_Bip_C_UpperChest'].z - chest.z, 4),
        'spine_dz': round(bones['J_Bip_C_Spine'].z - chest.z, 4), 'hips_dz': round(bones['J_Bip_C_Hips'].z - chest.z, 4),
        'shoulder_x': round(abs(bones['J_Bip_L_UpperArm'].x - chest.x), 4),
        'torso': rows, 'limbs': limbs,
        'foot': {'len': round(max(p.y for p in foot) - min(p.y for p in foot), 4) if foot else 0, 'w': round(max(p.x for p in foot) - min(p.x for p in foot), 4) if foot else 0,
                 'h': round(max(p.z for p in foot), 4) if foot else 0},
        'head': {'w': round(max(p.x for p in head) - min(p.x for p in head), 4) if head else 0, 'd': round(max(p.y for p in head) - min(p.y for p in head), 4) if head else 0,
                 'top_dz': round(max(p.z for p in head) - hb.z, 4) if head else 0},
    }
    return res


ids = sorted(d for d in os.listdir(SRC) if os.path.exists(os.path.join(SRC, d, d + '.glb')) and not d.startswith('npc_'))
if ONLY:
    ids = [i for i in ids if i in ONLY]
if LIMIT:
    ids = ids[:LIMIT]
out = {}
if os.path.exists(OUT):
    try:
        out = json.load(open(OUT, encoding='utf-8'))
    except Exception:
        out = {}
for i, gid in enumerate(ids):
    if gid in out and 'error' not in out[gid]:                               # 실패한 몸은 다음 실행에서 다시 잰다
        continue
    try:
        out[gid] = measure(os.path.join(SRC, gid, gid + '.glb'))
    except Exception as e:                                                   # 뼈 이름이 다른 몸 등 — 건너뛰고 적는다
        out[gid] = {'error': str(e)[:200]}
    if i % 10 == 0:
        json.dump(out, open(OUT, 'w', encoding='utf-8'), ensure_ascii=False)
        print('MEASURE', i + 1, '/', len(ids), flush=True)
json.dump(out, open(OUT, 'w', encoding='utf-8'), ensure_ascii=False)
print('MEASURE_DONE', len(out))
