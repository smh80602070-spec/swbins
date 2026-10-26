#!/bin/bash
# K-0201 넓히기 적용 — 정본 116명 관절에 far copyall·fill smear(없으면) 얹고 지금 k188_cutout 규칙으로 다시 자름(rig·preview) → publish·place·bounds
#   bash tools/ai-art/k188/k201_recut_all.sh [id,id…]   → 끝 줄 K201_RECUT_DONE · 로그 tools/char-forge/_out/k199/recut.log
cd /c/swbins
L=tools/char-forge/_out/k199/recut.log
ids=${1:-$(py -c "import json;print(','.join(sorted(set(json.load(open('saga-assets/web2d/cutout/index.json'))['pools'].values()))))")}
for id in ${ids//,/ }; do
  D=tools/ai-art/_out/k188/p/$id
  py -c "import json,sys;j=json.load(open('$D/joints.json'));sys.exit(0 if j.get('far') and j.get('fill') else 1)" || py tools/ai-art/k188/setj.py $id '{"far":"copyall","fill":"smear"}' >/dev/null
  PYTHONIOENCODING=utf-8 py tools/ai-art/k188_cutout.py cut $D/side.png $D/joints.json $D/rig >> $L 2>&1 || echo "FAIL $id" >> $L
  PYTHONIOENCODING=utf-8 py tools/ai-art/k188_cutout.py preview $D/rig $D/prev --h 360 >/dev/null 2>&1
done
PYTHONIOENCODING=utf-8 py tools/ai-art/k188/publish.py $ids >> $L 2>&1
PYTHONIOENCODING=utf-8 py tools/asset-place/place.py --item web2d-cutout --write >> $L 2>&1
echo K201_RECUT_DONE >> $L
