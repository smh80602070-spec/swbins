#!/bin/bash
# K-0187 어린이 밑몸(G, 머리뼈 1.00m) → 어른 키 한 사람: 설치 → 옛 산출 옮김 → vroid_batch(glb·anim·web·2d) → 2D 다시 굽기 넷(8방향·마을·점프·16방향).
#   bash tools/char-forge/k187_person.sh <id>      (먼저 k137_leads.py build <id> — _out/k137/lead/<id>.glb 가 있어야 함)
# 옛 산출은 _out/k187_old/<id>/ 로(되돌리기용). Blender 하나씩 — 사슬로 여러 명 돌릴 때도 차례로.
set -u
cd /c/swbins
export PYTHONIOENCODING=utf-8
ID=$1
CF=tools/char-forge
OLD=$CF/_out/k187_old/$ID
L=$CF/_out/k187_old/$ID.log
mkdir -p $OLD
test -f $CF/_out/k137/lead/$ID.glb || { echo "K187_FAIL $ID lead 없음" | tee -a $L; exit 1; }
py $CF/k137_leads.py install $ID >> $L 2>&1
for f in $ID.glb anims_k29.ok; do [ -e $CF/_out/vroid/$ID/$f ] && mv $CF/_out/vroid/$ID/$f $OLD/; done
[ -d $CF/_out/vroid/$ID/web ] && mv $CF/_out/vroid/$ID/web $OLD/web
for d in sprites sprites8 sprites8_town sprites8_jump sprites16; do [ -d $CF/_out/$d/$ID ] && mv $CF/_out/$d/$ID $OLD/$d; done
bash $CF/vroid_batch.sh --only $ID < /dev/null >> $L 2>&1
for p in combat_sprite_plan town_sprite_plan story_jump_plan sprite_plan_16; do
  echo "== $p $(date +%T)" >> $L
  py -3.12 $CF/bake_sprite_batch.py $CF/data/$p.json --only $ID < /dev/null >> $L 2>&1
  echo "rc $?" >> $L
done
grep -a "VROID_BATCH" $L | tail -1
echo "K187_DONE $ID"
