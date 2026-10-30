#!/bin/bash
# K-0198 ③ 뒷모습 컷아웃: k198_back.sh <id>[:<변주>]... — 뒷모습 일러스트(_out/k198/back/<id>_back_v<NN>.png, 기본 01) → 대칭 관절(auto --view back) → cut(smear) → preview. 관절은 _out/k198/<id>_back/auto.jpg 를 보고 손질.
cd /c/swbins
for A in "$@"; do
  ID=${A%%:*}; V=01; [ "$A" != "$ID" ] && V=$(printf %02d ${A##*:})
  D=tools/ai-art/_out/k198/${ID}_back; mkdir -p $D
  SRC=tools/ai-art/_out/k198/back/${ID}_back_v$V.png
  PYTHONIOENCODING=utf-8 py - "$SRC" "$D" <<'P' || continue
import sys
sys.path.insert(0, 'tools/ai-art')
from k163_illust import cutout
from PIL import Image
src, d = sys.argv[1:3]
cutout(Image.open(src).convert('RGB')).save(d + '/back.png')
P
  cp ${SRC%.png}.license.json $D/back.license.json 2>/dev/null
  PYTHONIOENCODING=utf-8 py tools/ai-art/k188_cutout.py auto $D/back.png $D/joints.json $D/auto.jpg --view back >/dev/null
  PYTHONIOENCODING=utf-8 py tools/ai-art/k188_cutout.py cut $D/back.png $D/joints.json $D/rig --fill smear | tail -1
  PYTHONIOENCODING=utf-8 py tools/ai-art/k188_cutout.py preview $D/rig $D/prev --h 360 >/dev/null
done
