#!/bin/bash
# K-0187 사슬 — k137_leads.json 의 K-0187 줄(밑몸 G 어린이 → 어른 키) 전부를 한 명씩: build → k187_person.sh(설치·굽기·2D 넷).
#   bash tools/char-forge/k187_chain.sh            (이미 _out/k187_old/<id>.log 에 K187_DONE 있으면 건너뜀 — 멱등)
#   멈춤: tools/char-forge/_out/k187_old/STOP 파일
set -u
cd /c/swbins
export PYTHONIOENCODING=utf-8
CF=tools/char-forge
D=$CF/_out/k187_old
mkdir -p $D
IDS=$(py -c "import json;print(' '.join(r['id'] for r in json.load(open('$CF/data/k137_leads.json',encoding='utf-8'))['leads'] if 'K-0187' in r.get('note','')))")
n=0
for id in $IDS; do
  [ -e $D/STOP ] && { echo "K187_CHAIN 멈춤(STOP) $n"; exit 0; }
  grep -q "K187_DONE" $D/$id.done 2>/dev/null && continue
  py $CF/k137_leads.py build $id >> $D/$id.log 2>&1
  bash $CF/k187_person.sh $id > $D/$id.done 2>&1
  n=$((n + 1))
  echo "$(date +%T) $id $(tail -1 $D/$id.done)" >> $D/chain.log
done
echo "K187_CHAIN_DONE $n" | tee -a $D/chain.log
