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
D = 'saga-assets/web2d/cutout/_clips'; os.makedirs(D, exist_ok=True)
json.dump(out, open(D + '/side.json', 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
json.dump({'id': 'cutout_clips_side', 'ticket': 'K-0199',
           'generator': 'tools/char-forge/clips_to_cutout.py (Blender — 3D 동작 → 컷아웃 뼈 16 옆 2D 각도, 기준 = 모캡 서기 평균, 골반 앞뒤 이동 뺌, 무릎·팔꿈치 사람 범위, ~robe = 다리 0.35배) · k199_build.sh',
           'license': 'CMU Graphics Lab Motion Capture Database — 복사·수정·재배포 허가 불요(상업 포함) · 자체 키프레임(tools/char-forge/keyframes.py) · 바탕 자세 UAL(Quaternius, CC0)',
           'clips': len(out), 'sources': src}, open(D + '/side.license.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print('K199_PACK', len(out), os.path.getsize(D + '/side.json') // 1024, 'KB')
E
PYTHONIOENCODING=utf-8 py tools/asset-place/place.py --item web2d-cutout --write 2>&1 | tail -1
