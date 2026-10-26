"""K-0199 — 3D 동작(VRoid 뼈 J_Bip 팩 GLB)을 2D 컷아웃 뼈 16 의 클립 키로 옮긴다(옆모습 — 오른쪽을 본다).

  blender -b --factory-startup -P tools/char-forge/clips_to_cutout.py -- --pack <팩 .glb(절대)> --out <클립 .json(절대)> [--only walk,run] [--rename walk=walk_m] [--step 1] [--tol 0.25] [--view side|front] [--neutral idle] [--robe 0.35]

규약(엔진 saga-web/shared/js/cutout2d.js 와 같음): 화면 x 앞(오른쪽) · y 아래 · 각 양수 = 시계 방향(늘어진 팔이 뒤로 감) · 키 [t(0~1), 각(도), dx, dy] 는
그림 쉼 자세에 더하는 차 — 여기서는 「반듯한 쉼」(팔·다리 곧게 아래 · 몸통·머리 곧게 위 · 발 앞) 기준 차로 낸다(손그림 쉼 자세가 거의 그 꼴).
투영: 옆 = 화면 x ← 캐릭터 앞(Blender −Y) · y ← −Z, R 뼈 = 캐릭터 오른쪽(화면 쪽) · 앞(front) = 화면 x ← 캐릭터 왼쪽(+X… 거울 없이 보는 사람 기준 캐릭터 오른쪽이 화면 왼쪽).
각 = 그 뼈 방향(머리→꼬리, 발은 발목→발끝)의 화면 각 − 반듯한 쉼 방향 각, 자식은 부모 각을 뺀 상대 각. 골반 dx·dy = 첫 프레임 대비 이동(몸 100 단위).
끝 줄 CUTOUT_CLIPS n. 클립마다 CUTOUT_CLIP 이름 {keys 수·len}.
"""
import json
import math
import sys

import bpy
from mathutils import Vector

A = sys.argv[sys.argv.index('--') + 1:]
arg = lambda k, d=None: A[A.index(k) + 1] if k in A else d
PACK, OUT = arg('--pack'), arg('--out')
ONLY = set(arg('--only', '').split(',')) - {''}
REN = dict(kv.split('=') for kv in arg('--rename', '').split(',') if '=' in kv)
STEP = int(arg('--step', '1'))   # K-0200 — 매 프레임(옛 2)
TOL = float(arg('--tol', '0.25'))   # K-0200 — 직선 보간에서 이만큼(°) 안이면 키 뺌(옛 1.0 — 숨쉬기·끝 여운이 사라졌다)
VIEW = arg('--view', 'side')
NEUTRAL = arg('--neutral', 'idle')        # 이 클립 평균을 0(반듯한 쉼)으로 — 빈 값이면 안 뺌
ROBE = float(arg('--robe', '0.35'))
BASE_IN, BASE_OUT = arg('--base-in'), arg('--base-out')   # 기준(서기 평균) 파일 주고받기
ROOTX = '--rootx' in A                     # 골반 앞뒤 이동 살리기(기본 끔)
LIM = {'legL': (-5.0, 85.0), 'armL': (-100.0, 5.0)}   # 무릎·팔꿈치 상대 각 범위(옆, 오른쪽 봄, 서기 기준 뺀 값) — 정강이는 뒤로만 85°, 아래팔은 앞으로만 100°

# 컷아웃 뼈 → (머리 J_Bip, 꼬리 J_Bip 또는 None=자식 머리, 반듯한 쉼 방향(화면))
DOWN, UP, FWD = (0, 1), (0, -1), (1, 0)
MAP = {
    'hip': ('J_Bip_C_Hips', 'J_Bip_C_Spine', UP),
    'chest': ('J_Bip_C_Spine', 'J_Bip_C_Neck', UP),
    'head': ('J_Bip_C_Neck', 'J_Bip_C_Head', UP),
}
for s, S in (('R', 'R'), ('L', 'L')):
    MAP.update({
        f'armU{s}': (f'J_Bip_{S}_UpperArm', f'J_Bip_{S}_LowerArm', DOWN), f'armL{s}': (f'J_Bip_{S}_LowerArm', f'J_Bip_{S}_Hand', DOWN),
        f'hand{s}': (f'J_Bip_{S}_Hand', f'J_Bip_{S}_Middle1', DOWN),
        f'legU{s}': (f'J_Bip_{S}_UpperLeg', f'J_Bip_{S}_LowerLeg', DOWN), f'legL{s}': (f'J_Bip_{S}_LowerLeg', f'J_Bip_{S}_Foot', DOWN),
        f'foot{s}': (f'J_Bip_{S}_Foot', f'J_Bip_{S}_ToeBase', FWD)})
PARENT = {'hip': None, 'chest': 'hip', 'head': 'chest', 'armUL': 'chest', 'armLL': 'armUL', 'handL': 'armLL', 'armUR': 'chest', 'armLR': 'armUR', 'handR': 'armLR',
          'legUL': 'hip', 'legLL': 'legUL', 'footL': 'legLL', 'legUR': 'hip', 'legLR': 'legUR', 'footR': 'legLR'}


def scr(v):
    """세계 점 → 화면(x, y) — 옆: x = 앞(−Y), y = −Z · 앞: x = −X(캐릭터 오른쪽이 화면 왼쪽), y = −Z."""
    return (-v.y, -v.z) if VIEW == 'side' else (-v.x, -v.z)


def ang(d):
    return math.degrees(math.atan2(d[1], d[0]))


def wrap(a):
    return (a + 180) % 360 - 180


def main():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=PACK)
    arm = next(o for o in bpy.data.objects if o.type == 'ARMATURE')
    pb = arm.pose.bones
    H = (arm.matrix_world @ pb['J_Bip_C_Head'].head).z or 1.4      # 쉼 머리 높이 ≈ 몸 100 의 0.86 — 아래서 다시 잼
    arm.animation_data_create()
    out = {}
    for act in bpy.data.actions:
        name = act.name.split('|')[-1]
        if ONLY and name not in ONLY:
            continue
        arm.animation_data.action = act
        f0, f1 = (int(round(x)) for x in act.frame_range)
        frames = list(range(f0, f1 + 1, STEP))
        if frames[-1] != f1:
            frames.append(f1)
        keys = {b: [] for b in MAP}
        hip0 = None
        for f in frames:
            bpy.context.scene.frame_set(f)
            bpy.context.view_layer.update()
            W = {n: arm.matrix_world @ pb[n].head for n in {x for m in MAP.values() for x in m[:2]} if n in pb}
            top = arm.matrix_world @ pb['J_Bip_C_Head'].tail
            body = max(top.z, 1e-3)                                     # 그 프레임 머리 끝 높이 ≈ 몸 100
            absr = {}
            for b in MAP:
                h, t, rest = MAP[b]
                if h not in W or t not in W:
                    continue
                d = (scr(W[t])[0] - scr(W[h])[0], scr(W[t])[1] - scr(W[h])[1])
                absr[b] = wrap(ang(d) - ang(rest))
            t01 = (f - f0) / max(1, f1 - f0)
            hp = scr(W['J_Bip_C_Hips'])
            if hip0 is None:
                hip0 = hp
            for b, a in absr.items():
                rel = wrap(a - absr[PARENT[b]]) if PARENT[b] and PARENT[b] in absr else a
                k = [round(t01, 3), round(rel, 1)]
                if b == 'hip':
                    k += [0.0 if not ROOTX else round((hp[0] - hip0[0]) / body * 100, 2), round((hp[1] - hip0[1]) / body * 100, 2)]   # 앞뒤 이동은 기본 뺌(제자리 — 게임이 옮긴다)
                keys[b].append(k)
        # 거의 안 바뀌는 키 줄이기(직선 보간으로 1° 안이면 가운데 키 뺌)
        for b, ks in keys.items():
            if len(ks) > 2:
                kept = [ks[0]]
                for i in range(1, len(ks) - 1):
                    a, m, c = kept[-1], ks[i], ks[i + 1]
                    u = (m[0] - a[0]) / max(1e-6, c[0] - a[0])
                    if any(abs(m[j] - (a[j] + (c[j] - a[j]) * u)) > (TOL if j == 1 else TOL * 0.3) for j in range(1, len(m))):
                        kept.append(m)
                kept.append(ks[-1])
                keys[b] = kept
        loop = act.get('saga_loop') if act.get('saga_loop') is not None else name in ('walk', 'run', 'idle', 'idle_b')
        nm = REN.get(name, name)
        out[nm] = {'len': round((f1 - f0) / 30.0, 3), 'loop': bool(loop), 'src': name, 'keys': {b: v for b, v in keys.items() if v}}
        print('CUTOUT_CLIP', nm, json.dumps({'keys': sum(len(v) for v in out[nm]['keys'].values()), 'len': out[nm]['len']}))
    # 반듯한 쉼 = 모캡 서기(idle) 평균 — 모캡 배우는 서 있어도 골반·몸통이 몇 도 기울고 다리를 조금 벌려 손그림 쉼과 어긋난다(10-25 눈: 서기에서 몸이 뒤로 기움)
    base = {}
    ref = out.get(REN.get(NEUTRAL, NEUTRAL)) if NEUTRAL else None
    if ref:
        for b, ks in ref['keys'].items():
            base[b] = sum(k[1] for k in ks) / len(ks)
    elif BASE_IN:                                   # 서기 없는 팩(모션 32·전투) — 모캡 팩에서 잰 기준을 받는다
        base = json.load(open(BASE_IN, encoding='utf-8'))
    if BASE_OUT and base:
        json.dump(base, open(BASE_OUT, 'w', encoding='utf-8'))
    if base:
        for c in out.values():
            for b, ks in c['keys'].items():
                for k in ks:
                    k[1] = round(wrap(k[1] - base.get(b, 0.0)), 1)
                    if b[:4] in LIM:                       # 무릎·팔꿈치는 사람 범위로(서기 기준 뺀 뒤) — 크게 굽으면 컷아웃 이음이 벌어진다(10-25 사용자 「끊긴 부분이 많네」)
                        k[1] = max(LIM[b[:4]][0], min(LIM[b[:4]][1], k[1]))
    # 옷자락(도포·치마) 인물용 — 다리 각을 0.35 배로(엔진 rig.skirt 와 같은 값, 다리가 옷자락 밖으로 휘둘리지 않게) · 이름 <클립>~robe
    for nm in list(out):
        c = json.loads(json.dumps(out[nm]))
        for b in ('legUL', 'legUR', 'legLL', 'legLR', 'footL', 'footR'):
            if b in c['keys']:
                c['keys'][b] = [[k[0], round(k[1] * ROBE, 1)] + k[2:] for k in c['keys'][b]]
        out[nm + '~robe'] = c
    json.dump(out, open(OUT, 'w', encoding='utf-8'), ensure_ascii=False)
    print('CUTOUT_CLIPS', len(out), 'neutral', NEUTRAL, {b: round(v, 1) for b, v in base.items()})


main()
