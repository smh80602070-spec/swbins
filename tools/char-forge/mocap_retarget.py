"""K-0139 2단계 — CMU 모캡 BVH → VRoid 뼈대 동작(클립 12). build.retarget 과 같은 핵심(쉼 방향 맞춤·다리 길이 비·땅 붙이기)에
구간 고르기(반복 클립은 가장 닮은 두 프레임 사이 한 주기)·제자리(골반 수평 이동 빼기)·이음 섞기·역재생·발 미끄러짐 재기를 더했다.

    blender -b --factory-startup -P tools/char-forge/mocap_retarget.py -- \
        --target <VRoid 몸 .glb(절대)> --bvh <BVH 폴더(절대)> --table <mocap_clips.json(절대)> --out <출력 .glb(절대)> [--only walk,run]

내보내는 .glb = 대상 몸의 뼈대 + 동작(메시 없음). 끝 줄 MOCAP_DONE. 클립마다 MOCAP_CLIP 이름 {구간·프레임·땅 오차·미끄러짐·떠밀림}.
30fps 로 굽는다(BVH 120fps 를 가져올 때 줄임). BVH 1번 프레임은 Hahne 가 넣은 T 자세라 건너뛴다.
"""
import json
import math
import os
import sys

import bpy
from mathutils import Matrix, Vector

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import build  # noqa: E402
import rigmaps  # noqa: E402

CMU2STD = {'Hips': 'pelvis', 'LowerBack': 'spine_01', 'Spine': 'spine_02', 'Spine1': 'spine_03', 'Neck': 'neck_01', 'Head': 'Head'}
for _s, _S in (('l', 'Left'), ('r', 'Right')):
    CMU2STD.update({f'{_S}Shoulder': f'clavicle_{_s}', f'{_S}Arm': f'upperarm_{_s}', f'{_S}ForeArm': f'lowerarm_{_s}',
                    f'{_S}Hand': f'hand_{_s}', f'{_S}UpLeg': f'thigh_{_s}', f'{_S}Leg': f'calf_{_s}',
                    f'{_S}Foot': f'foot_{_s}', f'{_S}ToeBase': f'ball_{_s}'})
# 반복 클립 주기(초) 찾는 범위 · 반복 아닌 클립의 최대 길이(초)
PERIOD = {'walk': (0.85, 1.5), 'run': (0.5, 0.95), 'idle': (2.0, 4.0), 'idle_b': (2.0, 4.0), 'w07': (0.85, 1.5), 'w08': (0.85, 1.5), 'r16': (0.5, 0.95)}
MAXLEN = {'turn': 3.0, 'sit_stand': 6.0, 'pickup': 3.5, 'greet': 2.5, 'cast': 2.2, 'strong': 1.3, 'hit': 1.0, 'death': 10.0}
FPS = 30
BLEND_S = 0.2


def import_bvh(path):
    before = set(bpy.data.objects)
    bpy.ops.import_anim.bvh(filepath=path, global_scale=1.0, frame_start=1, use_fps_scale=True, update_scene_fps=False,
                            update_scene_duration=False, rotate_mode='NATIVE', axis_forward='-Z', axis_up='Y')
    src = next(o for o in bpy.data.objects if o not in before and o.type == 'ARMATURE')
    for b in list(src.data.bones):
        if b.name in CMU2STD:
            b.name = CMU2STD[b.name]
    return src


def rest_align2(src, s_rest, t_rest, pairs):
    """build.rest_align 과 같되 기준 자식이 같은 자리(길이 0)면 REF_CHILD 사슬을 따라 내려가 처음으로 떨어진 관절로 잰다.
    CMU 는 Hips→LowerBack·Spine1→Neck 오프셋이 0 이라 그대로 재면 골반·윗가슴 맞춤이 엉터리가 되고 몸 전체가 기운다(10-18)."""
    align = {}
    for s in rigmaps.STD_BONES:
        if s not in pairs:
            continue
        c, sd, td = rigmaps.REF_CHILD.get(s), None, None
        while c:
            if c in pairs and c in s_rest:
                a = s_rest[c].translation - s_rest[s].translation
                b = t_rest[pairs[c]].translation - t_rest[pairs[s]].translation
                if a.length > 1e-4 and b.length > 1e-4:
                    sd, td = a.normalized(), b.normalized()
                    break
            c = rigmaps.REF_CHILD.get(c)
        if sd is not None:
            align[s] = td.rotation_difference(sd).to_matrix()
        else:
            p = src.data.bones[s].parent
            while p is not None and p.name not in align:
                p = p.parent
            align[s] = align[p.name] if p is not None else Matrix.Identity(3)
    return align


def features(src, frames):
    """프레임마다 골반 기준 관절 위치(몸 크기로 나눔) — 자세 닮음 재기."""
    keys = ['hand_l', 'hand_r', 'foot_l', 'foot_r', 'Head', 'lowerarm_l', 'lowerarm_r', 'calf_l', 'calf_r']
    sc = bpy.context.scene
    out, hips = [], []
    for f in frames:
        sc.frame_set(f)
        mw = src.matrix_world
        h = (mw @ src.pose.bones['pelvis'].matrix).translation
        hips.append(h.copy())
        out.append([((mw @ src.pose.bones[k].matrix).translation - h) for k in keys])
    size = max(1e-6, (out[0][4]).length)
    return [[v / size for v in fr] for fr in out], hips


def dist(a, b):
    return sum((x - y).length for x, y in zip(a, b))


def pick_window(name, c, src, f0, f1):
    frames = list(range(f0, f1 + 1))
    feat, hips = features(src, frames)
    if name in PERIOD:
        pmin, pmax = (int(round(x * FPS)) for x in PERIOD[name])
        best = None
        for i in range(0, len(frames) - pmin - 1):
            for p in range(pmin, min(pmax, len(frames) - 1 - i) + 1):
                d = dist(feat[i], feat[i + p]) + 0.5 * dist([u - v for u, v in zip(feat[i + 1], feat[i])], [u - v for u, v in zip(feat[i + p + 1] if i + p + 1 < len(feat) else feat[i + p], feat[i + p])])
                if best is None or d < best[0]:
                    best = (d, i, p)
        _, i, p = best
        return frames[i], frames[i + p], round(best[0], 3)
    # 반복 아님: 움직임이 있는 곳만, 가장 센 곳 둘레로 최대 길이
    en = [0.0] + [dist(feat[k], feat[k - 1]) for k in range(1, len(feat))]
    thr = max(en) * 0.12
    act = [k for k, e in enumerate(en) if e > thr]
    a, b = (act[0], act[-1]) if act else (0, len(frames) - 1)
    a, b = max(0, a - 6), min(len(frames) - 1, b + 6)
    L = int(MAXLEN.get(name, 3.0) * FPS)
    if c.get('reverse') and b - a > L:   # 역재생(쓰러짐): 서 있는 끝을 포함해야 하니 움직임의 끝 쪽 L 만
        a = b - L
    elif b - a > L:
        win = max(range(a, b - L + 1), key=lambda s: sum(en[s:s + L]))
        a, b = win, win + L
    return frames[a], frames[b], None


def bake(tgt, src, name, c, report):
    sc = bpy.context.scene
    pairs = {s: t for s, t in rigmaps.VROID.items() if t and s in src.data.bones and t in tgt.data.bones}
    t2s = {t: s for s, t in pairs.items()}
    # 방향 맞춤(쉼): 1번 프레임 T 자세(Hahne — BVH +Z, 여기선 +Y 를 본다)의 앞을 대상 몸의 앞에 정확히 맞춘다.
    # build.face_like 는 BVH 영점 자세로 재서 뒤집힘을 놓친다 → 뼈마다 반대 방향 맞춤이 생겨 비틀린다(10-18 걷기 시트).
    def side_fwd(pl, pr):
        f = Vector((0, 0, 1)).cross(pl - pr); f.z = 0
        return f.normalized()
    sc.frame_set(1)
    tmw = tgt.matrix_world.copy()
    tf = side_fwd((tmw @ tgt.data.bones[pairs['thigh_l']].matrix_local).translation, (tmw @ tgt.data.bones[pairs['thigh_r']].matrix_local).translation)
    sf = side_fwd((src.matrix_world @ src.pose.bones['thigh_l'].matrix).translation, (src.matrix_world @ src.pose.bones['thigh_r'].matrix).translation)
    yaw0 = math.atan2(tf.y, tf.x) - math.atan2(sf.y, sf.x)
    src.rotation_euler.z += yaw0
    bpy.context.view_layer.update()
    flipped = round(math.degrees(yaw0), 1)
    smw = src.matrix_world.copy()
    sc.frame_set(1)
    # 원본 쉼 자세 = 1번 프레임(Hahne 가 넣은 T 자세) — BVH 영점 자세는 머리 숙임·팔 처짐이 있어 쉼으로 쓰면 모든 동작이 숙여진다(10-18 T 자세 굽기로 확인)
    s_rest = {b.name: (smw @ src.pose.bones[b.name].matrix).copy() for b in src.data.bones}
    # 높이 기준 = 1번 프레임(Hahne T 자세, 땅에 선 자세) — BVH 쉼 자세는 골반이 높이 0 이라 높이 기준이 못 된다
    s_ref = {b: (smw @ src.pose.bones[b].matrix).translation.copy() for b in ('pelvis', 'foot_l', 'foot_r')}
    t_rest_arm = {b.name: b.matrix_local.copy() for b in tgt.data.bones}
    t_rest = {n: tmw @ m for n, m in t_rest_arm.items()}
    order = build.topo(tgt.data.bones)
    align = rest_align2(src, s_rest, t_rest, pairs)

    def leg(R, nm):
        return sum((R[nm[a]].translation - R[nm[b]].translation).length for a, b in (('thigh_l', 'calf_l'), ('calf_l', 'foot_l')))
    k = leg(t_rest, pairs) / leg(s_rest, rigmaps.IDENTITY)
    moving = {pairs['pelvis']}
    below = set()

    def sub(b):
        below.add(b.name)
        for ch in b.children:
            sub(ch)
    sub(tgt.data.bones[pairs['pelvis']])
    act_src = src.animation_data.action
    a0, a1 = (int(round(x)) for x in act_src.frame_range)
    if c.get('range'):
        w0, w1, score = int(c['range'][0]), int(c['range'][1]), None
    else:
        w0, w1, score = pick_window(name, c, src, max(a0, 2), a1)
    # 진행 방향 맞춤: 배우가 비스듬히 걸은 방향을 쉼 자세의 앞으로 돌린다(동작만 돌림 — 쉼 자세는 그대로)
    def facing(get):
        side = get('thigh_l') - get('thigh_r')
        f = Vector((0, 0, 1)).cross(side)
        f.z = 0
        return f.normalized() if f.length > 1e-6 else Vector((0, -1, 0))
    rest_f = facing(lambda b: s_rest[b].translation)
    acc = Vector((0, 0, 0))
    for f in range(w0, w1 + 1, max(1, (w1 - w0) // 8 or 1)):
        sc.frame_set(f)
        acc += facing(lambda b: (smw @ src.pose.bones[b].matrix).translation)
    mot_f = acc.normalized() if acc.length > 1e-6 else rest_f
    if c.get('loop'):   # 반복(걷기·달리기): 골반이 실제로 나아간 방향이 앞 — 허벅지 평균은 몸통 비틀림이 섞인다(10-18 시트 30° 틀어짐)
        sc.frame_set(w0); p0 = (smw @ src.pose.bones['pelvis'].matrix).translation.copy()
        sc.frame_set(w1); p1 = (smw @ src.pose.bones['pelvis'].matrix).translation.copy()
        d = p1 - p0; d.z = 0
        if d.length > 0.3 * leg(s_rest, rigmaps.IDENTITY):
            mot_f = -d.normalized()          # facing() 는 뒤쪽을 돌려준다 — 같은 꼴로 맞춘다
    yaw = math.atan2(rest_f.y, rest_f.x) - math.atan2(mot_f.y, mot_f.x)
    Rz = Matrix.Rotation(yaw, 4, 'Z')
    frames = list(range(w0, w1 + (0 if c.get('loop') else 1)))
    if c.get('reverse'):
        frames = frames[::-1]
    if c.get('speed'):   # 빠르게(쓰러짐 = 일어나기 전체를 거꾸로 2배)
        sp = float(c['speed'])
        frames = [frames[min(len(frames) - 1, int(round(i * sp)))] for i in range(int(len(frames) / sp))]
    loop = bool(c.get('loop'))
    inplace = loop or bool(c.get('inplace'))   # inplace = 반복 아니어도 골반 수평 이동을 처음→끝 직선으로 뺀다(피격 휘청임)
    # 제자리: 골반 수평 이동을 뺀다(반복 = 처음→끝 직선, 그 밖 = 첫 프레임 자리로)
    sc.frame_set(frames[0])
    h0 = (Rz @ smw @ src.pose.bones['pelvis'].matrix).translation.copy()
    sc.frame_set(frames[-1] if not loop else w1)
    h1 = (Rz @ smw @ src.pose.bones['pelvis'].matrix).translation.copy()
    poses = []
    feet = ('foot_l', 'foot_r')
    # 바닥 = 이 구간에서 발(발목·발끝)이 가장 낮은 높이. 서 있는 골반 높이 = T 자세의 골반-발 높이 차.
    # Hahne T 자세 프레임의 높이는 클립마다 실제 바닥과 달라(피격 +0.28m·쓰러짐 +0.78m 떠 있었음, 10-18) 기준으로 못 쓴다.
    gz = []
    for f in frames:
        sc.frame_set(f)
        gz.append(min((smw @ src.pose.bones[b].matrix).translation.z for b in ('foot_l', 'foot_r', 'ball_l', 'ball_r')))
    ground = min(gz)
    sc.frame_set(1)
    toe_ref = min((smw @ src.pose.bones[b].matrix).translation.z for b in ('foot_l', 'foot_r', 'ball_l', 'ball_r'))
    stand = s_ref['pelvis'].z - toe_ref
    foot_ref = {fb: s_ref[fb].z - toe_ref for fb in feet}
    for idx, f in enumerate(frames):
        sc.frame_set(f)
        u = (idx / max(1, len(frames)) if loop else idx / max(1, len(frames) - 1)) if inplace else 0.0
        drift = Vector(((h0.x + (h1.x - h0.x) * u), (h0.y + (h1.y - h0.y) * u), 0.0)) if inplace else Vector((h0.x, h0.y, 0.0))
        W = {}
        for b in order:
            n, p = b.name, b.parent
            s = t2s.get(n)
            if s:
                sw = Rz @ smw @ src.pose.bones[s].matrix
                rot = sw.to_3x3().normalized() @ s_rest[s].to_3x3().normalized().inverted() @ align[s] @ t_rest[n].to_3x3().normalized()
                if n in moving or p is None:
                    rel = Vector((sw.translation.x - drift.x, sw.translation.y - drift.y, sw.translation.z - (ground + stand)))
                    t = t_rest[n].translation + rel * k
                else:
                    t = (W[p.name] @ (t_rest[p.name].inverted() @ t_rest[n])).translation
                W[n] = Matrix.Translation(t) @ rot.to_4x4()
            else:
                W[n] = (W[p.name] @ (t_rest[p.name].inverted() @ t_rest[n])) if p else t_rest[n]
        s_low = min((smw @ src.pose.bones[fb].matrix).translation.z - (ground + foot_ref[fb]) for fb in feet) * k
        t_low = min(W[pairs[fb]].translation.z - t_rest[pairs[fb]].translation.z for fb in feet)
        wgt = max(0.0, min(1.0, 1.0 - (abs(s_low) - 0.01) / 0.02))
        dz = (s_low - t_low) * wgt
        if dz:
            for n in below:
                W[n] = Matrix.Translation((0, 0, dz)) @ W[n]
        poses.append(W)
    # 반복 이음: 끝 BLEND_S 를 첫 프레임 쪽으로 섞는다
    if loop:
        nb = min(len(poses) // 3, int(BLEND_S * FPS))
        for j in range(nb):
            a = (j + 1) / (nb + 1)
            i = len(poses) - nb + j
            for n in poses[i]:
                A, Bm = poses[i][n], poses[0][n]
                q = A.to_quaternion().slerp(Bm.to_quaternion(), a)
                t = A.translation.lerp(Bm.translation, a)
                poses[i][n] = Matrix.Translation(t) @ q.to_matrix().to_4x4()
    # 발 미끄러짐: 디딘 발(쉼 높이 + 2cm 안)이 디딘 동안 수평으로 움직인 거리 — 반복 걷기·달리기는 제자리라 몸 속도만큼 뒤로 가는 게 정상이라 그걸 빼고 잰다
    slip = 0.0
    if loop:
        vel = (h1 - h0) * k / max(1, len(frames))
        vel.z = 0
        for fb, toe in (('foot_l', 'ball_l'), ('foot_r', 'ball_r')):
            tb, tt = pairs[fb], pairs.get(toe)
            def contact(W):   # 땅에 닿는 점 = 발목·발끝 중 낮은 쪽
                a, b = W[tb].translation, (W[tt].translation if tt else W[tb].translation)
                return a if a.z <= b.z else b
            cs = [contact(W) for W in poses]
            zmin = min(c.z for c in cs)
            run = None
            for j, cpt in enumerate(cs):
                vz = abs(cs[j].z - cs[j - 1].z) if j else 0.0
                if cpt.z - zmin < 0.01 and vz < 0.004:
                    p = cpt.xy.copy()
                    if run is None:
                        run = [p, 0]
                    slip = max(slip, (p - (run[0] - vel.xy * run[1])).length)
                    run[1] += 1
                else:
                    run = None
    act = bpy.data.actions.new(name)
    act.use_fake_user = True
    slot, cb = build.new_channelbag(act, tgt)
    keys = {n: {'loc': [], 'rot': []} for n in t2s}
    for W in poses:
        A = {n: tmw.inverted() @ m for n, m in W.items()}
        for n in t2s:
            p = tgt.data.bones[n].parent
            basis = t_rest_arm[n].inverted() @ A[n] if p is None else (t_rest_arm[n].inverted() @ t_rest_arm[p.name]) @ A[p.name].inverted() @ A[n]
            loc, q, _ = basis.decompose()
            prev = keys[n]['rot'][-1] if keys[n]['rot'] else None
            if prev is not None and prev.dot(q) < 0:
                q.negate()
            keys[n]['loc'].append(loc)
            keys[n]['rot'].append(q)
    for n in t2s:
        for path, vals, cnt in ((f'pose.bones["{n}"].location', keys[n]['loc'], 3), (f'pose.bones["{n}"].rotation_quaternion', keys[n]['rot'], 4)):
            if path.endswith('location') and n not in moving and all(v.length < 1e-5 for v in vals):
                continue
            for i in range(cnt):
                fc = cb.fcurves.new(path, index=i, group_name=n)
                fc.keyframe_points.add(len(vals))
                co = []
                for fr, v in enumerate(vals):
                    co += [fr + 1, v[i]]
                fc.keyframe_points.foreach_set('co', co)
                for kp in fc.keyframe_points:
                    kp.interpolation = 'LINEAR'
                fc.update()
    hx = [W[pairs['pelvis']].translation.xy for W in poses]
    report[name] = {'cmu': c['cmu'], 'window': [w0, w1], 'frames': len(poses), 'sec': round(len(poses) / FPS, 2),
                    'loop_score': score, 'flipped': flipped, 'leg_ratio': round(k, 3),
                    'slip_m': round(slip, 3) if loop else None, 'drift_m': round((hx[-1] - hx[0]).length, 3)}
    return act, slot


def main():
    target, bvh_dir, table, out = build.arg('--target'), build.arg('--bvh'), build.arg('--table'), build.arg('--out')
    only = set(build.arg('--only').split(',')) if build.arg('--only') else None
    t = json.load(open(table, encoding='utf-8'))
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.render.fps, sc.render.fps_base = FPS, 1.0
    objs = build.import_new(target)
    tgt = next(o for o in objs if o.type == 'ARMATURE')
    build.delete([o for o in objs if o is not tgt])
    report, made = {}, []
    for c in t['clips']:
        if only and c['game'] not in only:
            continue
        src = import_bvh(os.path.join(bvh_dir, c['cmu'] + '.bvh'))
        made.append(bake(tgt, src, c['game'], c, report))
        act = src.animation_data.action
        build.delete([src])
        if act:
            bpy.data.actions.remove(act)
        print('MOCAP_CLIP', c['game'], json.dumps(report[c['game']], ensure_ascii=False), flush=True)
    for pb in tgt.pose.bones:
        pb.rotation_mode = 'QUATERNION'
    tgt.animation_data_create()
    for act, slot in made:
        tr = tgt.animation_data.nla_tracks.new()
        tr.name = act.name
        st = tr.strips.new(act.name, 1, act)
        try:
            st.action_slot = slot
        except AttributeError:
            pass
        tr.mute = True
    tgt.animation_data.action = None
    os.makedirs(os.path.dirname(os.path.abspath(out)), exist_ok=True)
    bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', export_animation_mode='ACTIONS', export_force_sampling=True,
                              export_def_bones=False, export_cameras=False, export_lights=False, export_extras=False, export_yup=True, export_skins=True)
    lic = {'target': os.path.basename(target), 'generator': 'tools/char-forge/mocap_retarget.py (K-0139)', 'blender': bpy.app.version_string,
           'license': 'CMU Graphics Lab Motion Capture Database — "may be copied, modified, or redistributed without permission" (mocap.cs.cmu.edu FAQ) · BVH 변환 Bruce Hahne 2010(추가 제한 없음)',
           'source': t['source'], 'clips': {k: v['cmu'] for k, v in report.items()}, 'report': report}
    json.dump(lic, open(os.path.splitext(out)[0] + '.license.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print('MOCAP_DONE', len(report))


if __name__ == '__main__':
    main()
