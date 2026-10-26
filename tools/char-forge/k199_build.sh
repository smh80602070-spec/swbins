#!/bin/bash
# K-0199 컷아웃 공용 동작 팩 굽기 — 세 3D 팩 → clips_to_cutout.py → 합치기(겹친 이름은 k. 앞붙임) → 정본 _clips/side.json + license → 웹 shared(place)
#   bash tools/char-forge/k199_build.sh
cd /c/swbins
B="/c/Program Files/Blender Foundation/Blender 5.2/blender.exe"
O=C:/swbins/tools/char-forge/_out/k199; mkdir -p tools/char-forge/_out/k199
CV="$B -b --factory-startup -P tools/char-forge/clips_to_cutout.py --"
"$B" -b --factory-startup -P tools/char-forge/clips_to_cutout.py -- --pack C:/swbins/saga-assets/characters/anim-src/mocap/vroid_mocap_anims.glb --out $O/side_mocap.json --base-out $O/base_side.json </dev/null 2>&1 | grep -a CUTOUT_CLIPS | cut -c1-40
"$B" -b --factory-startup -P tools/char-forge/clips_to_cutout.py -- --pack C:/swbins/saga-assets/characters/anim-src/mocap/vroid_clips30_anims.glb --out $O/side_c30.json --neutral "" --base-in $O/base_side.json </dev/null 2>&1 | grep -a CUTOUT_CLIPS | cut -c1-40
"$B" -b --factory-startup -P tools/char-forge/clips_to_cutout.py -- --pack C:/swbins/tools/char-forge/_out/vroid/ac_balgwang/ac_balgwang_anims.glb --out $O/side_hero.json --neutral "" --base-in $O/base_side.json </dev/null 2>&1 | grep -a CUTOUT_CLIPS | cut -c1-40
PYTHONIOENCODING=utf-8 py - <<'E'
import json, os
O = 'tools/char-forge/_out/k199/'
packs = (('side_mocap.json', 'vroid_mocap_anims.glb'), ('side_c30.json', 'vroid_clips30_anims.glb'),
         ('side_hero.json', 'ac_balgwang_anims.glb (K-0029·K-0066 자체 키프레임·UAL CC0 바탕)'))
out, src = {}, {}
for f, tag in packs:
    for k, v in json.load(open(O + f, encoding='utf-8')).items():
        nk = k if k not in out else 'k.' + k
        out[nk] = v; src[nk] = tag
import math
# K-0200 숨쉬기 — 모캡 서기 평균을 쉼으로 빼서 idle 이 납작(키 2~3) → 손 숨쉬기 층(2.4초·25키): 가슴 들림·머리 반대·팔 늦게·골반 오르내림
def breath(robe):
    K = {b: [] for b in ('hip', 'chest', 'head', 'armUR', 'armUL', 'armLR', 'armLL', 'handR', 'handL')}
    A = {'chest': (-1.6, 0), 'head': (1.1, 0.35), 'armUR': (2.2, 0.6), 'armUL': (2.2, 0.7), 'armLR': (1.6, 0.9), 'armLL': (1.6, 1.0), 'handR': (1.2, 1.2), 'handL': (1.2, 1.3)}
    for i in range(25):
        u = i / 24; w = 2 * math.pi * u
        K['hip'].append([round(u, 3), 0.0, 0.0, round(-0.35 * (1 - math.cos(w)) / 2, 3)])
        for b, (amp, lag) in A.items():
            K[b].append([round(u, 3), round(amp * math.sin(w - lag), 2)])
    return {'len': 2.4, 'loop': True, 'src': 'k200_breath', 'keys': K}
for nk in ('idle', 'idle~robe'):
    if nk in out:
        out[nk] = breath(nk.endswith('~robe')); src[nk] = 'K-0200 손 숨쉬기(k199_build.sh)'
# K-0200 과장 — 모캡 걷기·달리기는 사람 실제 크기라 손그림에선 밋밋: 팔 흔들기·보폭·몸 오르내림 키우기(옷자락 판은 다리 그대로)
EXAG = {'armUL': 1.4, 'armUR': 1.4, 'armLL': 1.3, 'armLR': 1.3, 'legUL': 1.15, 'legUR': 1.15, 'legLL': 1.1, 'legLR': 1.1, 'chest': 1.3, 'head': 1.2}
for nk in ('walk', 'run', 'k.walk', 'walk~robe', 'run~robe', 'k.walk~robe'):
    c = out.get(nk)
    if not c:
        continue
    for b, ks in c['keys'].items():
        f = EXAG.get(b, 1.0) if not (nk.endswith('~robe') and b.startswith('leg')) else 1.0
        m = sum(k[1] for k in ks) / len(ks)          # 평균 둘레 흔들림만 키움(고정 기울기는 그대로)
        for k in ks:
            k[1] = round(m + (k[1] - m) * f, 2)
            if b == 'hip' and nk.startswith('run'):
                k[1] = round(k[1] - 15, 2)            # 달리기 앞으로 숙임(모캡 변환은 뒤로 젖혀 보였다, − = 앞)
            if b == 'hip' and len(k) > 3:
                k[3] = round(k[3] * 1.6, 3)
    src[nk] = src.get(nk, '') + ' · K-0200 과장'
# K-0200 hair 늦게 따라오기 — 머리 세계각(hip+chest+head)을 용수철로 쫓는 각 − 머리 각 = hair 상대각. 몸 오르내림 속도도 조금. 반복 클립은 두 바퀴 돌려 둘째 것
def _at(ks, u, j=1):
    if not ks: return 0.0
    if u <= ks[0][0]: return ks[0][j] if len(ks[0]) > j else 0.0
    for a, b in zip(ks, ks[1:]):
        if u <= b[0]:
            w = (u - a[0]) / max(1e-6, b[0] - a[0]); va = a[j] if len(a) > j else 0.0; vb = b[j] if len(b) > j else 0.0
            return va + (vb - va) * w
    return ks[-1][j] if len(ks[-1]) > j else 0.0
def bake_hair(c, K_=90.0, C_=11.0, VY=1.8, LIM=35.0):
    n = max(8, int(round(c['len'] * 30))); dt = c['len'] / n; ks = c['keys']
    head = lambda u: _at(ks.get('hip'), u) + _at(ks.get('chest'), u) + _at(ks.get('head'), u)
    dy = lambda u: _at(ks.get('hip'), u, 3)
    x, v = head(0.0), 0.0; out = []
    rounds = 2 if c.get('loop') else 1
    for r in range(rounds):
        for i in range(n + 1):
            u = i / n
            vy = (dy(min(1, u + 1 / n)) - dy(max(0, u - 1 / n))) / (2 * dt)
            tgt = head(u) + vy * VY
            v += ((tgt - x) * K_ - v * C_) * dt; x += v * dt
            if r == rounds - 1:
                out.append([round(u, 3), round(max(-LIM, min(LIM, x - head(u))), 1)])
    kept = [out[0]]
    for i in range(1, len(out) - 1):
        a, m, b = kept[-1], out[i], out[i + 1]; w = (m[0] - a[0]) / max(1e-6, b[0] - a[0])
        if abs(m[1] - (a[1] + (b[1] - a[1]) * w)) > 0.25: kept.append(m)
    kept.append(out[-1]); c['keys']['hair'] = kept
# K-0200 도포 판 골반 — 도포 인물은 hip 그림이 발끝까지라 골반이 기울면 도포 통째로 기울어 젖혀 보인다 → 골반 0.3배, 덜 돈 만큼 가슴에 보태 상체 세계각은 그대로
ROBE_HIP = 0.3
for nk, c in out.items():
    if not nk.endswith('~robe') or 'hip' not in c['keys']:
        continue
    hk = [list(k) for k in c['keys']['hip']]
    if 'chest' in c['keys']:
        for k in c['keys']['chest']:
            k[1] = round(k[1] + _at(hk, k[0]) * (1 - ROBE_HIP), 2)
    for k in c['keys']['hip']:
        k[1] = round(k[1] * ROBE_HIP, 2)
for nk, c in out.items():
    bake_hair(c)
D = 'saga-assets/web2d/cutout/_clips'; os.makedirs(D, exist_ok=True)
json.dump(out, open(D + '/side.json', 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
json.dump({'id': 'cutout_clips_side', 'ticket': 'K-0199',
           'generator': 'tools/char-forge/clips_to_cutout.py (Blender — 3D 동작 → 컷아웃 뼈 16 옆 2D 각도, 기준 = 모캡 서기 평균, 골반 앞뒤 이동 뺌, 무릎·팔꿈치 사람 범위, ~robe = 다리 0.35배) · k199_build.sh',
           'license': 'CMU Graphics Lab Motion Capture Database — 복사·수정·재배포 허가 불요(상업 포함) · 자체 키프레임(tools/char-forge/keyframes.py) · 바탕 자세 UAL(Quaternius, CC0)',
           'clips': len(out), 'sources': src}, open(D + '/side.license.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print('K199_PACK', len(out), os.path.getsize(D + '/side.json') // 1024, 'KB')
E
PYTHONIOENCODING=utf-8 py tools/asset-place/place.py --item web2d-cutout --write 2>&1 | tail -1
