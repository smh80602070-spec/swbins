#!/bin/bash
# K-0198 A자세 정면 컷아웃: k198_apose_cut.sh <id>:<변주>... — _out/k198/apose/<id>_apose_v<NN>.png → 대칭 관절(auto --view front) → cut(smear) → preview. 결과 _out/k198/<id>_apose/
cd /c/swbins
for A in "$@"; do
  ID=${A%%:*}; V=$(printf %02d ${A##*:})
  D=tools/ai-art/_out/k198/${ID}_apose; rm -rf $D; mkdir -p $D
  SRC=tools/ai-art/_out/k198/apose/${ID}_apose_v$V.png
  PYTHONIOENCODING=utf-8 py - "$SRC" "$D" <<'P' || continue
import sys
sys.path.insert(0, 'tools/ai-art')
from k163_illust import cutout
from PIL import Image
src, d = sys.argv[1:3]
cutout(Image.open(src).convert('RGB')).save(d + '/front.png')
P
  cp ${SRC%.png}.license.json $D/front.license.json 2>/dev/null
  PYTHONIOENCODING=utf-8 py tools/ai-art/k188_cutout.py auto $D/front.png $D/joints.json $D/auto.jpg --view front >/dev/null
  PYTHONIOENCODING=utf-8 py tools/ai-art/k198_apose.py joints $ID $V   # 벌어진 팔 관절을 그림 위에 놓는다(자동 관절은 팔이 곧게 내려온다고 가정)
  PYTHONIOENCODING=utf-8 py tools/ai-art/k188_cutout.py cut $D/front.png $D/joints.json $D/rig --fill smear | tail -1
  PYTHONIOENCODING=utf-8 py tools/ai-art/k188_cutout.py preview $D/rig $D/prev --h 360 >/dev/null
done
