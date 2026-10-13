"""팔다리 덮개 표(K-0101) — 몸 샘플 피부와 옷 조각이 팔다리 뼈 구간(이 뼈 머리 → 다음 뼈 머리, 8칸)을 덮는지. Blender 헤드리스.

  blender -b --factory-startup -P tools/char-forge/limb_cover_scan.py -- tools/char-forge/_out/parts tools/char-forge/data/limb_cover.json

VRoid 샘플 몸은 원래 옷 밑 피부를 지워 둔 것이 많다(남자 g·n·p·r·v·x 윗팔 0, w·x 허벅지 0) — 그 자리를 안 덮는 옷을 입히면
팔다리가 비어 보인다(nz_jeokpyo). 피부 = 몸 SKIN 재질 정점의 가장 큰 무게 뼈, 옷 = 위치(축에서 RAD 안 — 치마는 치마뼈에 붙어도
허벅지를 덮는다), 좌우 따로(비대칭 옷). 한 칸에 정점 3개 이상이면 덮음 '1'. outfit_swap_plan.py 가 이 표로 구멍 조합을 거른다.
"""
import bpy, sys, os, glob, json
from mathutils import Vector

a = sys.argv[sys.argv.index('--') + 1:]
root = os.path.abspath(a[0])
SEG = {'J_Bip_%s_%s' % (s, a): 'J_Bip_%s_%s' % (s, b) for s in 'LR'
       for a, b in (('UpperArm', 'LowerArm'), ('LowerArm', 'Hand'), ('UpperLeg', 'LowerLeg'), ('LowerLeg', 'Foot'))}
BONES = list(SEG)
NB = 8
RAD = {'J_Bip_L_UpperArm': 0.10, 'J_Bip_L_LowerArm': 0.09, 'J_Bip_L_UpperLeg': 0.22, 'J_Bip_L_LowerLeg': 0.16}
def scan(path, skin_only):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=path)
    arm = next((o for o in bpy.data.objects if o.type == 'ARMATURE'), None)
    if not arm:
        return {}
    bones = {}
    bd = arm.data.bones
    for b, c in SEG.items():
        if b in bd and c in bd:
            bones[b] = (arm.matrix_world @ bd[b].head_local, arm.matrix_world @ bd[c].head_local)
    res = {b: [0] * NB for b in bones}
    for o in bpy.data.objects:
        if o.type != 'MESH':
            continue
        if skin_only:
            sel = {i for i, m in enumerate(o.data.materials) if m and 'Body' in m.name and 'SKIN' in m.name}
            if not sel:
                continue
        else:
            sel = None
        names = {g.index: g.name for g in o.vertex_groups}
        mw = o.matrix_world
        vs = set()
        for p in o.data.polygons:
            if sel is None or p.material_index in sel:
                vs.update(p.vertices)
        for vi in vs:
            v = o.data.vertices[vi]
            co = mw @ v.co
            if skin_only:                       # 피부 = 무게(확정)
                if not v.groups:
                    continue
                g = max(v.groups, key=lambda g: g.weight)
                cand = [names.get(g.group, '')]
            else:                               # 옷 = 위치(치마는 치마뼈에 붙어도 허벅지를 덮는다)
                cand = list(bones)
            for n in cand:
                if n not in bones:
                    continue
                h, t = bones[n]
                d = t - h
                L2 = d.length_squared or 1e-9
                u = (co - h).dot(d) / L2
                if u < -0.05 or u > 1.05:
                    continue
                if not skin_only:
                    if (co.x > 0) != (h.x > 0):            # 그 쪽 팔다리만(비대칭 옷 — 한쪽만 긴 바지)
                        continue
                    r = (co - (h + d * max(0.0, min(1.0, u)))).length
                    if r > RAD[n[:6] + 'L' + n[7:]]:
                        continue
                k = min(NB - 1, max(0, int(u * NB)))
                res[n][k] += 1
    return {b: ''.join('1' if c >= 3 else '0' for c in res[b]) for b in res}
out = {}
for d in sorted(glob.glob(os.path.join(root, '*'))):
    L = os.path.basename(d)
    if not os.path.exists(os.path.join(d, 'base.glb')):
        continue
    out[L] = {'base': scan(os.path.join(d, 'base.glb'), True)}
    for f in sorted(glob.glob(os.path.join(d, '*__*.glb'))):
        out[L][os.path.basename(f)] = scan(f, False)
json.dump({'note': '생성: limb_cover_scan.py (K-0101) — 손으로 고치지 않는다', 'bins': out},
          open(os.path.abspath(a[1]), 'w', encoding='utf-8'), indent=0, sort_keys=True)
print('COVER_DONE', len(out))
