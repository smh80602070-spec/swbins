"""K-0148 — 모캡 후보가 웹 몸짓 판정(saga-web/shared/js/pose3d.js EXPECT)을 통과하는지 Blender 에서 잰다(웹 촬영 없이).

    blender -b --factory-startup -P tools/char-forge/mocap_pose_check.py -- \
        --target <VRoid 몸 .glb(절대)> --bvh <BVH 폴더(절대)> --cands "cast=81_10,81_11;strong=79_01;greet=111_37" [--out <결과 .json(절대)>]

후보마다 mocap_retarget.bake 와 똑같이 구운 뒤(자동 구간 — 표의 range 를 주려면 "cast=81_10@200:460")
  ① EXPECT 시점(클립 길이 × at)에서 재 판정 ② 모든 프레임 중 통과 항목이 가장 많은(같으면 여유가 큰) 프레임
  ③ 그 프레임이 at 에 오게 하는 BVH 구간 제안(range) 을 낸다 → `POSE <클립> <번호> at ok|bad … best f … range a:b` · 끝 줄 `POSE_DONE n/m`.
재는 식은 pose3d.measure·restOf 그대로: 몸 기준 좌표(three: y 위·z 앞·x 옆 = Blender z·−y·x), H = 쉬는 자세 머리 높이,
fs = 왼발끝이 왼발목보다 앞(+z)이면 1 · up = y/H · fwd = (z − 골반 z)·fs/H · side = (x − 골반 x)·fs/H.

K-0161 — 구운 클립 팩 점검(Blender 밖에서 부른다):
    py tools/char-forge/mocap_pose_check.py tools/char-forge/_out/clips/ [--table tools/char-forge/data/clips30.json] [--only a,b]
폴더의 *_anims.glb 마다 Blender 를 띄워 표의 클립 전부를 프레임마다 잰다 — ① 디딘 발 미끄러짐(발목·발끝 낮은 쪽이 바닥 2cm 안·
멈춘 동안 수평 이동 — 발목·발끝을 따로 잰다(뒤꿈치 들기로 닿는 점이 바뀌는 건 미끄럼 아님), 표 slip_max 기본 0.03m, locomotion·no_ground 는 재기만) ② 손목 꺾임(아래팔 ↔ 손 방향 ≤ 80°) ③ 땅 뚫림(모든 뼈 머리 ≥ 쉼 발끝 −5cm)
④ 튐(한 프레임에 뼈가 90° 넘게 돌면 — 뒤집힘) ⑤ 표 expect(항목마다 어느 프레임이든 맞으면). 줄 `CLIP <이름> PASS|FAIL …` · 끝 줄 `CLIPS_CHECK n/m`(다 PASS 면 종료 0).
"""
import json
import math
import os
import subprocess
import sys

try:
    import bpy
    from mathutils import Vector
except ImportError:          # py 로 부르면 Blender 를 띄우는 쪽(K-0161)
    bpy = None

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
if bpy is not None:
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


BONES2 = {'rfoot': 'J_Bip_R_Foot', 'rtoe': 'J_Bip_R_ToeBase', 'ltoe': 'J_Bip_L_ToeBase', 'lfoot': 'J_Bip_L_Foot'}
WRIST = (('J_Bip_L_LowerArm', 'J_Bip_L_Hand', 'J_Bip_L_Middle1'), ('J_Bip_R_LowerArm', 'J_Bip_R_Hand', 'J_Bip_R_Middle1'))
OPS = {'<': lambda a, b: a < b, '>': lambda a, b: a > b}


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


def check_pack():
    """K-0161 — 구운 팩(.glb)의 표 클립을 잰다(Blender 안)."""
    glb, table, out = build.arg('--glb'), build.arg('--table'), build.arg('--json')
    only = set(build.arg('--only').split(',')) if build.arg('--only') else None
    t = json.load(open(table, encoding='utf-8'))
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.render.fps, sc.render.fps_base = 30, 1.0
    objs = build.import_new(glb)
    arm = next(o for o in objs if o.type == 'ARMATURE')
    arm.animation_data_create()
    for tr in list(arm.animation_data.nla_tracks):
        arm.animation_data.nla_tracks.remove(tr)
    rest = rest_of(arm)
    mw = arm.matrix_world
    names = [b.name for b in arm.data.bones if b.name.startswith('J_Bip')]     # 루트·J_Sec(머리카락·옷 흔들 뼈)는 빼고
    ground0 = min((mw @ arm.pose.bones[b].head).z for b in BONES2.values())
    H = rest['H']
    res, ok_n = [], 0
    for c in t['clips']:
        g = c['game']
        if only and g not in only:
            continue
        act = bpy.data.actions.get(g)
        bad, info = [], {}
        if act is None:
            res.append({'game': g, 'ok': False, 'bad': ['팩에 없음']})
            print('CLIP', g, 'FAIL 팩에 없음', flush=True)
            continue
        arm.animation_data.action = act
        if act.slots:
            arm.animation_data.action_slot = act.slots[0]
        f0, f1 = int(act.frame_range[0]), int(act.frame_range[1])
        prevq, jump, jump_b, wrist, low = None, 0.0, '', 0.0, 9.0
        contact = {k: [] for k in BONES2.values()}
        hips_xy = []
        hips_up = []                                                       # K-0197 — 골반 높이(쉬는 머리 높이 비) 최저·최고를 보고에 싣는다(웅크림 판정)
        hit = {i: None for i in range(len(c.get('expect', [])))}
        for f in range(f0, f1 + 1):
            sc.frame_set(f)
            P = {n: mw @ arm.pose.bones[n].head for n in names}
            low = min(low, min(v.z for v in P.values()) - ground0)
            for lo, hd, fg in WRIST:
                if fg in P:
                    a, b = (P[hd] - P[lo]), (P[fg] - P[hd])
                    if a.length > 1e-4 and b.length > 1e-4:
                        wrist = max(wrist, math.degrees(a.angle(b)))
            q = {n: (mw @ arm.pose.bones[n].matrix).to_quaternion() for n in names if n.startswith('J_Bip')}
            if prevq:
                for n in q:
                    dg = math.degrees(2 * math.acos(min(1.0, abs(q[n].dot(prevq[n])))))   # q·−q 같은 회전
                    if dg > jump:
                        jump, jump_b = dg, f'{n}@{f}'
            prevq = q
            for b in contact:
                contact[b].append(P[b].copy())
            hips_xy.append(P[BONES['hips']].copy())
            r = measure(arm, rest)
            hips_up.append(r['hips']['up'])
            for k in ('lfoot', 'rfoot'):
                v = three(arm, BONES2[k])
                hp = three(arm, BONES['hips'])
                fs = rest['fs']
                r[k] = {'up': round(v.y / H, 3), 'fwd': round((v.z - hp.z) * fs / H, 3), 'side': round((v.x - hp.x) * fs / H, 3)}
            r['dRH'] = round((P[BONES['rhand']] - P[BONES['head']]).length / H, 3)
            for i, (part, axis, op, val) in enumerate(c.get('expect', [])):
                x = r[part] if part == 'dRH' else r[part][axis]
                if OPS[op](x, val) and hit[i] is None:
                    hit[i] = f
        # 디딘 발 미끄러짐 — 점(발목·발끝)마다 그 점 최저 높이 2cm 안·수직 속도 작을 때 연속 구간의 수평 이동 최대
        slip, slip_at = 0.0, ''
        for s_, cs in contact.items():
            zmin = min(p.z for p in cs)
            run = None
            for j, p in enumerate(cs):
                vz = abs(p.z - cs[j - 1].z) if j else 0.0
                if p.z - zmin < 0.02 and vz < 0.006:
                    run = p.xy.copy() if run is None else run
                    if (p.xy - run).length > slip:
                        slip, slip_at = (p.xy - run).length, f'{s_}@{f0 + j}'
                else:
                    run = None
        lim = c.get('slip_max', 0.03)
        if not (c.get('locomotion') or c.get('no_ground')) and slip > lim:
            bad.append(f'미끄러짐 {slip:.3f}>{lim}')
        if wrist > 80:
            bad.append(f'손목 {wrist:.0f}°')
        if low < -0.05:
            bad.append(f'땅 뚫림 {low:.3f}')
        if jump > 90:
            bad.append(f'튐 {jump:.0f}°/프레임 {jump_b}')
        for i, e in enumerate(c.get('expect', [])):
            if hit[i] is None:
                bad.append('expect ' + ''.join(map(str, e)))
        info = {'frames': f1 - f0 + 1, 'slip_m': round(slip, 3), 'slip_at': slip_at, 'wrist_deg': round(wrist, 1), 'low_m': round(low, 3), 'jump_deg': round(jump, 1), 'jump_at': jump_b,
                'expect_frames': [hit[i] for i in hit], 'drift_m': round((hips_xy[-1].xy - hips_xy[0].xy).length, 3), 'hips_up': [min(hips_up), max(hips_up)]}
        ok = not bad
        ok_n += ok
        res.append(dict(info, game=g, ok=ok, bad=bad))
        print('CLIP', g, 'PASS' if ok else 'FAIL ' + ' / '.join(bad), json.dumps(info, ensure_ascii=False), flush=True)
    if out:
        json.dump({'glb': os.path.basename(glb), 'rest': rest, 'results': res}, open(out, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print(f'CLIPS_CHECK {ok_n}/{len(res)}')


def cli():
    """py 로 부름 — 폴더(또는 .glb)의 팩마다 Blender 로 check_pack."""
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    a = [x for x in sys.argv[1:] if not x.startswith('--')]
    def opt(k, d=None):
        return sys.argv[sys.argv.index(k) + 1] if k in sys.argv else d
    tgt = os.path.abspath(a[0] if a else os.path.join(HERE, '_out', 'clips'))
    table = os.path.abspath(opt('--table', os.path.join(HERE, 'data', 'clips30.json')))
    packs = [tgt] if tgt.endswith('.glb') else sorted(os.path.join(tgt, f) for f in os.listdir(tgt) if f.endswith('_anims.glb'))
    blender = os.environ.get('BLENDER', r'C:\Program Files\Blender Foundation\Blender 5.2\blender.exe')
    total = passed = 0
    for g in packs:
        cmd = [blender, '-b', '--factory-startup', '-P', os.path.abspath(__file__), '--', '--glb', g, '--table', table,
               '--json', os.path.splitext(g)[0] + '.check.json']
        if opt('--only'):
            cmd += ['--only', opt('--only')]
        pr = subprocess.run(cmd, stdin=subprocess.DEVNULL, capture_output=True, env=dict(os.environ, PYTHONIOENCODING='utf-8'), creationflags=0x00004000 if os.name == 'nt' else 0)
        for ln in pr.stdout.decode('utf-8', 'replace').splitlines():
            if ln.startswith(('CLIP ', 'CLIPS_CHECK')):
                print(os.path.basename(g), ln)
                if ln.startswith('CLIPS_CHECK'):
                    k, n = ln.split()[1].split('/')
                    passed, total = passed + int(k), total + int(n)
    print(f'CLIPS_CHECK {passed}/{total}')
    sys.exit(0 if total and passed == total else 1)


if __name__ == '__main__':
    if bpy is None:
        cli()
    elif '--glb' in sys.argv:
        check_pack()
    else:
        main()
