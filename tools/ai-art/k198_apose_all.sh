#!/bin/bash
# K-0198 A자세 30명 일괄: 정면 관절 → 팔 마스크(prep, 45°) → 인물당 6변주 → _out/k198/apose/
cd /c/swbins
IDS=$(PYTHONIOENCODING=utf-8 py -c "
import json;d=json.load(open('tools/ai-art/batches/k198_back.json',encoding='utf-8'));print(' '.join(i['id'][:-5] for i in d['items']))")
for I in $IDS; do [ -f tools/ai-art/_out/k198/${I}_front/joints.json ] || bash tools/ai-art/k198_front.sh $I >/dev/null 2>&1; done
rm -rf tools/ai-art/_out/k198/apose
PYTHONIOENCODING=utf-8 py tools/ai-art/k198_apose.py prep $IDS --deg 45
cd tools/ai-art
n=0; for G in $(echo $IDS | tr ' ' '\n' | awk '{a[NR]=$0} END{for(i=1;i<=NR;i+=4){s=a[i]"_apose";for(j=1;j<4&&i+j<=NR;j++)s=s","a[i+j]"_apose";print s}}'); do n=$((n+1)); PYTHONIOENCODING=utf-8 py gen.py batches/k198_apose.json --only "$G" --variants 6 > _out/k198/apose_run$n.log 2>&1; done
echo APOSE_ALL_DONE
