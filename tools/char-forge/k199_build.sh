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
D = 'saga-assets/web2d/cutout/_clips'; os.makedirs(D, exist_ok=True)
json.dump(out, open(D + '/side.json', 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
json.dump({'id': 'cutout_clips_side', 'ticket': 'K-0199',
           'generator': 'tools/char-forge/clips_to_cutout.py (Blender — 3D 동작 → 컷아웃 뼈 16 옆 2D 각도, 기준 = 모캡 서기 평균, 골반 앞뒤 이동 뺌, 무릎·팔꿈치 사람 범위, ~robe = 다리 0.35배) · k199_build.sh',
           'license': 'CMU Graphics Lab Motion Capture Database — 복사·수정·재배포 허가 불요(상업 포함) · 자체 키프레임(tools/char-forge/keyframes.py) · 바탕 자세 UAL(Quaternius, CC0)',
           'clips': len(out), 'sources': src}, open(D + '/side.license.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print('K199_PACK', len(out), os.path.getsize(D + '/side.json') // 1024, 'KB')
E
PYTHONIOENCODING=utf-8 py tools/asset-place/place.py --item web2d-cutout --write 2>&1 | tail -1
