#!/bin/bash
# K-0198 ② 정면 컷아웃: k198_front.sh <id>... — 정면 일러스트 → 대칭 관절(auto --view front) → cut(smear) → preview. 관절은 _out/k198/<id>_front/auto.jpg 로 눈 확인
cd /c/swbins
for ID in "$@"; do
  D=tools/ai-art/_out/k198/${ID}_front; mkdir -p $D
  PYTHONIOENCODING=utf-8 py - "$ID" "$D" <<'P' || continue
import sys
sys.path.insert(0, 'tools/ai-art')
from k163_illust import cutout
from PIL import Image
i, d = sys.argv[1:3]
cutout(Image.open(f'saga-assets/illust/shared/{i}/stand.webp').convert('RGB')).save(d + '/front.png')
P
  cp saga-assets/illust/shared/$ID/stand.license.json $D/front.license.json 2>/dev/null
  PYTHONIOENCODING=utf-8 py tools/ai-art/k188_cutout.py auto $D/front.png $D/joints.json $D/auto.jpg --view front >/dev/null
  PYTHONIOENCODING=utf-8 py tools/ai-art/k188_cutout.py cut $D/front.png $D/joints.json $D/rig --fill smear | tail -1
  PYTHONIOENCODING=utf-8 py tools/ai-art/k188_cutout.py preview $D/rig $D/prev --h 360 >/dev/null
done
