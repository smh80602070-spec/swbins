"""K-0148 — 모캡 후보가 웹 몸짓 판정(saga-web/shared/js/pose3d.js EXPECT)을 통과하는지 Blender 에서 잰다(웹 촬영 없이).

    blender -b --factory-startup -P tools/char-forge/mocap_pose_check.py -- \
        --target <VRoid 몸 .glb(절대)> --bvh <BVH 폴더(절대)> --cands "cast=81_10,81_11;strong=79_01;greet=111_37" [--out <결과 .json(절대)>]

후보마다 mocap_retarget.bake 와 똑같이 구운 뒤(자동 구간 — 표의 range 를 주려면 "cast=81_10@200:460")
  ① EXPECT 시점(클립 길이 × at)에서 재 판정 ② 모든 프레임 중 통과 항목이 가장 많은(같으면 여유가 큰) 프레임
  ③ 그 프레임이 at 에 오게 하는 BVH 구간 제안(range) 을 낸다 → `POSE <클립> <번호> at ok|bad … best f … range a:b` · 끝 줄 `POSE_DONE n/m`.
재는 식은 pose3d.measure·restOf 그대로: 몸 기준 좌표(three: y 위·z 앞·x 옆 = Blender z·−y·x), H = 쉬는 자세 머리 높이,
fs = 왼발끝이 왼발목보다 앞(+z)이면 1 · up = y/H · fwd = (z − 골반 z)·fs/H · side = (x − 골반 x)·fs/H.
"""
import json
import os
import sys

import bpy
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import build  # noqa: E402
import mocap_retarget as MR  # noqa: E402

BONES = {'hips': 'J_Bip_C_Hips', 'head': 'J_Bip_C_Head', 'rhand': 'J_Bip_R_Hand', 'lhand': 'J_Bip_L_Hand', 'lfoot': 'J_Bip_L_Foot', 'ltoe': 'J_Bip_L_ToeBase'}
# pose3d.js EXPECT 그대로(웹 이름 → at, [(항목, 판정)]) — 클립 game 이름은 웹 짝(cast→Pose_cast · strong→Pose_heavy · greet→Pose_wave)
EXPECT = {
    'cast': (0.62, [('두 손 앞(>0.15)', lambda r: r['rhand']['fwd'] > 0.15 and r['lhand']['fwd'] > 0.15),
                    ('가슴 높이 이상(>0.75)', lambda r: r['rhand']['up'] > 0.75 and r['lhand']['up'] > 0.75)]),
    'strong': (0.5, [('두 손 앞으로 내려침(>0.2)', lambda r: r['rhand']['fwd'] > 0.2 and r['lhand']['fwd'] > 0.2)]),
    'greet': (0.4, [('오른손 머리 위', lambda r: r['rhand']['up'] > r['head']['up']),
                    ('앞으로 안 뻗음(|앞|<0.15)', lambda r: abs(r['rhand']['fwd']) < 0.15),
                    ('몸 옆(오른쪽 <-0.1)', lambda r: r['rhand']['side'] < -0.1)]),
}


def three(arm, name):
    p = arm.pose.bones[name].head          # 아마추어 공간(몸 기준)
    return Vector((p.x, p.z, -p.y))         # Blender(z 위·−y 앞) → three(y 위·z 앞)


def rest_of(arm):
    arm.animation_data.action = None
    for pb in arm.pose.bones:
        pb.location, pb.rotation_quaternion, pb.scale = (0, 0, 0), (1, 0, 0, 0), (1, 1, 1)
        pb.rotation_mode = 'QUATERNION'
    bpy.context.view_layer.update()
    head, lf, lt = (three(arm, BONES[k]) for k in ('head', 'lfoot', 'ltoe'))
    return {'H': head.y, 'fs': 1 if lt.z >= lf.z else -1}


def measure(arm, rest):
    p = {k: three(arm, BONES[k]) for k in ('hips', 'head', 'rhand', 'lhand')}
    H, fs = rest['H'], rest['fs']
    return {k: {'up': round(v.y / H, 3), 'fwd': round((v.z - p['hips'].z) * fs / H, 3), 'side': round((v.x - p['hips'].x) * fs / H, 3)} for k, v in p.items()}


def judge(game, r):
    return [n for n, f in EXPECT[game][1] if not f(r)]


def main():
    target, bvh_dir, cands = build.arg('--target'), build.arg('--bvh'), build.arg('--cands')
    out = build.arg('--out')
    shots = build.arg('--shots')                                         # 있으면 판정 시점 몸을 3/4 로 찍는다(<폴더>/<클립>_<번호>.png)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.render.fps, sc.render.fps_base = MR.FPS, 1.0
    objs = build.import_new(target)
    tgt = next(o for o in objs if o.type == 'ARMATURE')
    if not shots:
        build.delete([o for o in objs if o is not tgt])
    else:
        os.makedirs(shots, exist_ok=True)
        cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam'))
        sc.collection.objects.link(cam)
        cam.data.type, cam.data.ortho_scale = 'ORTHO', 2.4
        cam.location, cam.rotation_euler = (2.2, -3.0, 1.0), (1.5708, 0, 0.63)   # 앞(−Y)·오른쪽 3/4 — 오른손이 보이게
        sc.camera = cam
        sc.render.engine = 'BLENDER_WORKBENCH'
        sc.render.resolution_x = sc.render.resolution_y = 384
        sc.display.shading.light, sc.display.shading.color_type = 'STUDIO', 'TEXTURE'
    tgt.animation_data_create()
    rest = rest_of(tgt)
    res, ok_n, n = [], 0, 0
    for part in cands.split(';'):
        game, nums = part.split('=')
        for num in nums.split(','):
            c = {'game': game, 'cmu': num, 'loop': False}
            if '@' in num:
                num, rg = num.split('@')
                c.update(cmu=num, range=[int(x) for x in rg.split(':')])
            src = MR.import_bvh(os.path.join(bvh_dir, num + '.bvh'))
            report = {}
            act, _slot = MR.bake(tgt, src, game, c, report)
            a = src.animation_data.action
            build.delete([src])
            if a:
                bpy.data.actions.remove(a)
            tgt.animation_data.action = act
            f0, f1 = int(act.frame_range[0]), int(act.frame_range[1])
            at = EXPECT[game][0]
            rows = []
            for f in range(f0, f1 + 1):
                sc.frame_set(f)
                r = measure(tgt, rest)
                rows.append((f, judge(game, r), r))
            fa = round(f0 + at * (f1 - f0))
            if shots:
                sc.frame_set(fa)
                sc.render.filepath = os.path.join(shots, f"{game}_{num}{'_' + '-'.join(map(str, c['range'])) if c.get('range') else ''}.png")
                bpy.ops.render.render(write_still=True)
            bad_at = next(b for f, b, _r in rows if f == fa)
            best = min(rows, key=lambda x: (len(x[1]), -x[2]['rhand']['up']))
            w = report.get(game, {}).get('range') or report.get(game, {}).get('window')
            rg = None
            if w and len(w) == 2:                                        # 구간 — best 가 at 에 오게 앞뒤를 민다
                k = 1                                                     # window·range 는 30fps 로 줄여 가져온 BVH 프레임 — 구운 클립과 1:1
                shift = (best[0] - fa) * k
                rg = [int(w[0]) + shift, int(w[1]) + shift]
            n += 1
            ok_n += not bad_at
            line = {'game': game, 'cmu': num, 'at_ok': not bad_at, 'at_bad': bad_at, 'at_r': next(r for f, _b, r in rows if f == fa),
                    'best_f': best[0], 'best_bad': best[1], 'frames': [f0, f1], 'window': w, 'range_suggest': rg}
            res.append(line)
            print('POSE', game, num, 'at', 'ok' if not bad_at else 'bad ' + '/'.join(bad_at), '· best', best[0], 'ok' if not best[1] else 'bad ' + '/'.join(best[1]),
                  '· range', rg, flush=True)
            tgt.animation_data.action = None
            bpy.data.actions.remove(act)
    if out:
        json.dump({'rest': rest, 'results': res}, open(out, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print(f'POSE_DONE {ok_n}/{n}')


if __name__ == '__main__':
    main()
