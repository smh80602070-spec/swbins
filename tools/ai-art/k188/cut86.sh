#!/bin/bash
# K-0188 ③ ② 86 몰아서 자르기: 관절 정본 → 가린 몸통 로컬 SD 인페인트 → cut → preview (멱등 — rig/rig.json 있으면 건너뜀)
cd /c/swbins; L=tools/ai-art/_out/k188/cut86.log
while read id v f; do
  [ -f tools/ai-art/_out/k188/p/$id/rig/rig.json ] && continue
  cp tools/ai-art/k188/$id.joints.json tools/ai-art/_out/k188/p/$id/joints.json
  echo "== $id $(date +%T)" >> $L
  bash tools/ai-art/k188/person.sh $id $v cut >> $L 2>&1 || echo "FAIL $id" >> $L
done < tools/ai-art/k188/picks86.txt
echo CUT86_DONE >> $L
