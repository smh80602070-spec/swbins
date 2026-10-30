#!/bin/bash
# K-0188 ② 한 사람: person.sh <id> <변주 번호> [flip]
#   1 rgba(u2net matte) → 2 auto 관절 + 확인판 _out/k188/p/<id>/auto.jpg
#   (사람이 확인판 보고 joints.json 고침) → person.sh <id> <v> cut  : 몸통 마스크 → 로컬 SD 인페인트 → cut --fill sd → preview
set -e
cd /c/swbins
ID=$1; V=$(printf %02d $2); STEP=${3:-auto}
D=tools/ai-art/_out/k188/p/$ID; mkdir -p $D
SRC=tools/ai-art/_out/k188/side/${ID}_side_v$V.png
if [ "$STEP" = auto ] || [ "$STEP" = flip ]; then
  PYTHONIOENCODING=utf-8 py - "$SRC" "$D" "$STEP" <<'E'
import sys, shutil
sys.path.insert(0, 'tools/ai-art')
from k163_illust import cutout
from PIL import Image
src, d, step = sys.argv[1:4]
im = cutout(Image.open(src).convert('RGB'))
if step == 'flip':
    im = im.transpose(Image.FLIP_LEFT_RIGHT)
import json
json.dump({'flip': step == 'flip'}, open(d + '/flip.json', 'w'))
im.save(d + '/side.png'); shutil.copy(src[:-4] + '.license.json', d + '/side.license.json')
E
  PYTHONIOENCODING=utf-8 py tools/ai-art/k188_cutout.py auto $D/side.png $D/joints.json $D/auto.jpg
  exit 0
fi
if [ "$STEP" = cut ]; then
  PYTHONIOENCODING=utf-8 py tools/ai-art/k188_cutout.py cut $D/side.png $D/joints.json $D/rig0 --fill smear
  # 인페인트: 원본 옆모습(바탕 있는 것, flip 이면 뒤집은 것) + 가린 몸통 마스크
  PYTHONIOENCODING=utf-8 py - "$ID" "$V" "$D" <<'E'
import sys, json, os
from PIL import Image
i, v, d = sys.argv[1:4]
for bf in ('k188_side86', 'k188_side30', 'k188_side', 'k188_mob8v', 'k188_mob8u', 'k188_mob8'):   # ① 주인공(sg_zhugeliang)은 옛 배치에
    b = json.load(open(f'tools/ai-art/batches/{bf}.json', encoding='utf-8'))
    it = next((x for x in b['items'] if x['id'] == i + '_side'), None)
    if it: break
src = Image.open(f'tools/ai-art/_out/k188/side/{i}_side_v{v}.png').convert('RGB')
j = json.load(open(d + '/joints.json'))
if json.load(open(d + '/flip.json')).get('flip') if os.path.exists(d + '/flip.json') else False:
    src = src.transpose(Image.FLIP_LEFT_RIGHT)
src.save(d + '/side_bg.png')
p = it['prompt'].replace('arms slightly away from body', '(arms behind back:1.2), plain clothes torso')
out = {k: x for k, x in b.items() if k != 'items'}
out['out'] = f'k188/p/{i}/inp'; out['defaults'] = dict(out['defaults'], variants=1)
out['items'] = [{'id': i + '_noarm', 'seed': 2026102470, 'prompt': p, 'negative': it['negative'] + ', arm, hand, sleeve in front',
                 'init_image': d.replace('\\', '/') + '/side_bg.png', 'mask_image': d.replace('\\', '/') + '/rig0/_under_mask.png', 'denoise': 0.9, 'width': 768, 'height': 1152}]
json.dump(out, open(d + '/inp_batch.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
j['fill_img'] = f'tools/ai-art/_out/k188/p/{i}/inp/{i}_noarm.png'
json.dump(j, open(d + '/joints.json', 'w'))
E
  if [ -f $D/rig0/_under_mask.png ]; then
    PYTHONIOENCODING=utf-8 py tools/ai-art/gen.py $D/inp_batch.json | tail -1
    PYTHONIOENCODING=utf-8 py tools/ai-art/k188_cutout.py cut $D/side.png $D/joints.json $D/rig --fill sd
  else
    cp -r $D/rig0 $D/rig
  fi
  PYTHONIOENCODING=utf-8 py tools/ai-art/k188_cutout.py preview $D/rig $D/prev --h 360
fi
