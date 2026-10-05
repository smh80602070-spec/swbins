"""VRM 조합 후보 일괄(K-0072 단계 4) — 밑몸 5 × 머리카락 donor 4 × 뼈 비율 4 = 계획표를 만들고 vrm_mix.py 로 한 명씩 굽는다.

  py tools/char-forge/vrm_mix_batch.py plan            # data/vrm_mix_plan.json 만 쓴다
  py tools/char-forge/vrm_mix_batch.py build           # 계획표대로 _out/vrm_mix/<id>.glb (있으면 건너뜀 = 멱등)
  py tools/char-forge/vrm_mix_batch.py render          # _out/vrm_mix/render/<id>_{front,three,head}.png (한 번의 Blender 로)
밑몸·머리카락 샘플은 _src/cc0_vroid 의 VRM(상업·개작·재배포 허용, data/vroid_licenses.json). 얼굴은 안 만든다.
id = vmix_<몸>_<머리>_<비율번호> (영문 소문자·숫자·_). Blender 는 낮은 우선순위, 모든 호출 </dev/null.
"""
import json
import os
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, '_src', 'cc0_vroid')
OUT = os.path.join(HERE, '_out', 'vrm_mix')
PLAN = os.path.join(HERE, 'data', 'vrm_mix_plan.json')
BLENDER = os.environ.get('BLENDER', r'C:\Program Files\Blender Foundation\Blender 5.2\blender.exe')

VRM = {
    'd': 'avatarsample_d_0/AvatarSample_D.vrm', 'e': 'avatarsample_e/AvatarSample_E.vrm',
    'f': 'avatarsample_f/AvatarSample_F.vrm', 'g': 'avatarsample_g/AvatarSample_G.vrm',
    'bm': 'base_male/Base_Male.vrm',
}
BODIES = ['d', 'e', 'f', 'g', 'bm']        # K-0072 단계 0 — 머리 dHash 가 서로 먼 밑몸
HAIRS = ['d', 'e', 'f', 'g']                # Base 는 머리가 얇은 한 판이라 donor 불가(단계 2)
RATIOS = [                                  # 뼈 비율 네 벌(순수 교환·큰 머리 짧은 다리·긴 팔다리·키 큰 체형)
    {'head': 1.00, 'arm': 1.00, 'leg': 1.00},
    {'head': 1.08, 'arm': 0.95, 'leg': 0.92},
    {'head': 0.95, 'arm': 1.08, 'leg': 1.10},
    {'head': 1.04, 'arm': 1.05, 'leg': 1.14},
]


def make_plan():
    rows = []
    for b in BODIES:
        for h in HAIRS:
            if h == b:
                continue                    # 자기 머리 = 원본이라 새 인물이 아니다
            for i, r in enumerate(RATIOS):
                rows.append({'id': f'vmix_{b}_{h}_{i + 1}', 'body': b, 'hair': h, 'ratio': r, 'group': f'{b}_{h}'})
    os.makedirs(os.path.dirname(PLAN), exist_ok=True)
    with open(PLAN, 'w', encoding='utf-8') as f:
        json.dump({'note': 'K-0072 단계 4 계획표 — 밑몸×머리카락 donor×뼈 비율. 얼굴은 만들지 않는다(샘플 재료).', 'rows': rows}, f, ensure_ascii=False, indent=1)
    return rows


def load_plan():
    return json.load(open(PLAN, encoding='utf-8'))['rows'] if os.path.exists(PLAN) else make_plan()


def blender(args):
    p = subprocess.Popen([BLENDER, '-b', '--factory-startup'] + args, stdin=subprocess.DEVNULL, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
    subprocess.run(['powershell', '-NoProfile', '-Command', "Start-Sleep 3; Get-Process blender -ErrorAction SilentlyContinue | ForEach-Object { $_.PriorityClass='BelowNormal' }"],
                   stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    out = p.communicate()[0].decode('utf-8', 'replace')
    return p.returncode, out


def build(rows):
    os.makedirs(OUT, exist_ok=True)
    ok = fail = skip = 0
    for r in rows:
        dst = os.path.join(OUT, r['id'] + '.glb')
        if os.path.exists(dst):
            skip += 1
            continue
        ratio = ','.join(f'{k}={v}' for k, v in r['ratio'].items())
        code, out = blender(['-P', os.path.join(HERE, 'vrm_mix.py'), '--', os.path.join(SRC, VRM[r['body']]), os.path.join(SRC, VRM[r['hair']]), dst, ratio])
        if 'MIX_OK' in out and os.path.exists(dst):
            ok += 1
        else:
            fail += 1
            open(os.path.join(OUT, r['id'] + '.fail.txt'), 'w', encoding='utf-8').write(out[-3000:])
        print(r['id'], 'OK' if os.path.exists(dst) else 'FAIL', flush=True)
    print(f'BUILD ok={ok} fail={fail} skip={skip}')
    return fail == 0


def render(rows):
    rd = os.path.join(OUT, 'render')
    os.makedirs(rd, exist_ok=True)
    todo = [os.path.join(OUT, r['id'] + '.glb') for r in rows
            if os.path.exists(os.path.join(OUT, r['id'] + '.glb')) and not os.path.exists(os.path.join(rd, r['id'] + '_head.png'))]
    for i in range(0, len(todo), 16):                         # 한 번에 16벌씩(메모리)
        code, out = blender(['-P', os.path.join(HERE, 'render', 'render_bodies.py'), '--', rd] + todo[i:i + 16])
        print('RENDER', i, out.count('\nOK '), flush=True)
    print('RENDER_DONE', len(todo))


if __name__ == '__main__':
    cmd = sys.argv[1] if len(sys.argv) > 1 else 'plan'
    rows = make_plan() if cmd == 'plan' else load_plan()
    if cmd == 'plan':
        print('PLAN', len(rows))
    elif cmd == 'build':
        sys.exit(0 if build(rows) else 1)
    elif cmd == 'render':
        render(rows)
