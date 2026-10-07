#!/usr/bin/env bash
# VRoid 대량 들이기 배치 (K-0022 단계 2) — _in/vroid/*.vrm 중 결과가 없는 것만 차례로 공통부를 돈다. 두 번째 실행은 아무것도 안 한다(멱등).
#   bash tools/char-forge/vroid_batch.sh [--only id1,id2] [--dry]
# 인물마다 단계(이미 된 건 건너뜀):
#   1 glb   _out/vroid/<id>/<id>.glb            (.vrm 또는 옷 이식 .glb(K-0024)를 복사 — Godot·Unity·웹 3D 공통 원본)
#   2 anim  _out/vroid/<id>/<id>_anims.glb      (bake_for_rig 로 CC0·CF 동작 54 굽기) + verify.ok (verify.py 뼈 방향 ≤5°·땅 ≤1cm)
#   3 web   _out/vroid/<id>/web/<id>.glb        (vrm-slim 표정 모프 9개만 남김 + Meshopt·WebP 1024px — 웹 3D 는 한 벌만 쓴다, K-0022 3b)
#   4 2d    _out/sprites/<id>/…                 (bake_sprite_batch: 128px·8프레임·3방향·idle/walk/attack/hit/death)
# Godot 부(얼굴 데칼·anim_cc0/<id>_lib.res·셰이더 표)는 분리 — Godot 세션에서 vroid_intake.sh. 여기선 안 한다.
# 실패는 _out/vroid/<id>/log_<단계>.txt 에 남기고 다음 인물로 계속, 같은 단계 3회 실패면 "건너뜀"(fails_<단계>.txt).
# Blender 는 낮은 우선순위로, 모든 호출 </dev/null(헤드리스는 stdin 을 물려받으면 멈춘다). 서버·크롬은 안 쓴다.
# 중단: tools/char-forge/_out/vroid/STOP 파일을 만들면 다음 인물 전에 멈춘다.
set -u
# K-0078 — 웹 단계에서 남길 표정 모프(입 다섯·눈 감기·기쁨·화남·슬픔). 나머지 모프는 vrm-slim 이 뗀다.
KEEP_MORPH=Fcl_MTH_A,Fcl_MTH_I,Fcl_MTH_U,Fcl_MTH_E,Fcl_MTH_O,Fcl_EYE_Close,Fcl_ALL_Joy,Fcl_ALL_Angry,Fcl_ALL_Sorrow
cd "$(dirname "$0")/../.."
ONLY=""; DRY=0
while [ $# -gt 0 ]; do
  case "$1" in --only) ONLY="${2:-}"; shift 2;; --dry) DRY=1; shift;; *) echo "알 수 없는 인자: $1"; exit 2;; esac
done
B="${BLENDER:-/c/Program Files/Blender Foundation/Blender 5.2/blender.exe}"
IN=tools/char-forge/_in/vroid
OUTR=tools/char-forge/_out/vroid
# 기본 8 + 이동·시전 10(K-0059) + 무기별 전투 32(K-0029, 10-06: <무기>_idle·_1·_2·_3·_heavy, guard·block_hit·shield_bash·knockdown·hit_back·stun·victory): 클립 이름은 고돗 코드가 찾는 그대로(없으면 건너뜀). jump=도약 시작·fall=공중 루프·land=착지·climb/glide/swim=루프·mantle=턱 넘기(CF)·skill/burst=시전·plunge=낙하 공격 자세(CF)
CLIPS="idle=Idle_Loop,walk=Walk_Loop,sprint=Sprint_Loop,attack=Sword_Attack,hit=Hit_Chest,dodge=Roll,death=Death01,pickup=PickUp_Table,jump=Jump_Start,fall=Jump_Loop,land=Jump_Land,climb=CF_Climb_Loop,glide=CF_Glide_Loop,swim=Swim_Fwd_Loop,mantle=CF_Mantle,skill=Spell_Simple_Shoot,burst=CF_Burst,plunge=CF_Plunge_Loop,kneel=CF_Kneel_Loop,heal=CF_Heal,taunt=CF_Taunt,blocked=CF_Shield_Block,sword_2=CF_Sword_Slash_B,sword_3=CF_Sword_Slash_C,sword_heavy=CF_Sword_Heavy,guard=CF_Guard_Idle_Loop,spear_idle=CF_Spear_Idle_Loop,spear_1=CF_Spear_Thrust,spear_2=CF_Spear_Sweep,spear_heavy=CF_Spear_Heavy,axe_idle=CF_Axe_Idle_Loop,axe_1=CF_Axe_Chop,axe_2=CF_Axe_Sweep,axe_heavy=CF_Axe_Spin,dagger_idle=CF_Dagger_Idle_Loop,dagger_1=CF_Dagger_Slash_A,dagger_2=CF_Dagger_Slash_B,dagger_heavy=CF_Dagger_Backstab,bow_idle=CF_Bow_Idle_Loop,bow_1=CF_Bow_Shoot,bow_heavy=CF_Bow_Charged,staff_idle=Spell_Simple_Idle_Loop,staff_heavy=CF_Staff_Slam,gun_idle=Pistol_Idle_Loop,gun_1=Pistol_Shoot,fist_1=Punch_Jab,fist_2=Punch_Cross,fist_heavy=CF_Fist_Uppercut,shield_bash=CF_Shield_Bash,block_hit=CF_Shield_Block_Hit,knockdown=CF_Knockdown,hit_back=CF_Hit_Back,stun=CF_Stun_Loop,victory=CF_Victory"
ABS="$(pwd -W 2>/dev/null || pwd)"
mkdir -p "$OUTR"
[ -x "$B" ] || { echo "Blender 없음: $B (BLENDER=경로)"; exit 1; }

blender_low() {  # Blender 를 낮은 우선순위로 돌리고 기다린다
  "$B" "$@" </dev/null &
  local p=$!
  sleep 4
  powershell -NoProfile -Command "Get-Process blender -ErrorAction SilentlyContinue | ForEach-Object { \$_.PriorityClass='BelowNormal' }" >/dev/null 2>&1
  wait "$p"
}

# stage <id> <단계> <산출 파일 하나> <명령 함수>
stage() {
  local id="$1" st="$2" out="$3" fn="$4" O="$OUTR/$1"
  [ -e "$out" ] && return 0
  local f="$O/fails_$st.txt" n=0
  [ -f "$f" ] && n=$(cat "$f")
  if [ "$n" -ge 3 ]; then echo "  [$st] 건너뜀(3회 실패)"; return 1; fi
  if [ "$DRY" = 1 ]; then echo "  [$st] (dry) 할 일"; return 0; fi
  echo "  [$st] 시작"
  if "$fn" "$id" > "$O/log_$st.txt" 2>&1 && [ -e "$out" ]; then
    rm -f "$f"; echo "  [$st] 끝"; return 0
  fi
  echo $((n + 1)) > "$f"; echo "  [$st] 실패 $((n + 1))/3 — $O/log_$st.txt"; return 1
}

do_glb()  { if [ -e "$IN/$1.vrm" ]; then cp "$IN/$1.vrm" "$OUTR/$1/$1.glb"; else cp "$IN/$1.glb" "$OUTR/$1/$1.glb"; fi; }
do_anim() {
  local O="$OUTR/$1"
  rm -f "$O/verify.ok" "$O/anims_k66.ok" "$O/anims_k29.ok"            # 다시 굽는 몸이 옛 통과 표시로 넘어가지 않게
  blender_low -b --factory-startup -P tools/char-forge/bake_for_rig.py -- --target "$ABS/$O/$1.glb" --map vroid --clips "$CLIPS" --out "$ABS/$O/$1_anims.glb" --check || return 1
  "$B" -b --factory-startup -P tools/char-forge/verify.py -- --glb "$ABS/$O/$1_anims.glb" --map vroid --clips "$CLIPS" </dev/null > "$O/verify.log" 2>&1
  grep -a VERIFY_RESULT "$O/verify.log" | grep -q '"fails": \[\]' && touch "$O/verify.ok" "$O/anims_k66.ok" "$O/anims_k29.ok"
  [ -e "$O/verify.ok" ] || { grep -a VERIFY "$O/verify.log" | tail -3; return 1; }
  rm -f "$O/$1_anims.glb.log"
}
do_web() {
  local O="$OUTR/$1"
  mkdir -p "$O/web" && cp "$O/$1.glb" "$O/web/$1.glb" || return 1
  ( cd tools/glb-compress && node vrm-slim.mjs "$ABS/$O/web/$1.glb" --keep-morph "$KEEP_MORPH" && node compress.mjs "$ABS/$O/web" ) || return 1
}
do_2d() {
  local O="$OUTR/$1"
  cat > "$O/sprite_plan.json" <<EOF
{"px":128,"frames":8,"ortho":2.5,"cam_z":0.95,"clips":["idle","walk","attack","hit","death"],"dirs":[0,1,2],
 "bodies":{"$1":"$O/$1.glb"},"entries":[{"id":"$1","body":"$1","kind":"human"}]}
EOF
  py -3.12 tools/char-forge/bake_sprite_batch.py "$O/sprite_plan.json" </dev/null
}

total=0; ok=0
for vrm in "$IN"/*.vrm "$IN"/*.glb; do
  [ -e "$vrm" ] || continue
  id=$(basename "$vrm"); id="${id%.*}"
  [ -f "$OUTR/STOP" ] && { echo "STOP 파일 — 멈춤"; break; }
  if [ -n "$ONLY" ] && ! echo ",$ONLY," | grep -q ",$id,"; then continue; fi
  [[ "$id" =~ ^[a-z0-9_]+$ ]] || { echo "$id: id 는 영문 소문자·숫자·_ — 건너뜀"; continue; }
  total=$((total + 1))
  echo "== $id"
  mkdir -p "$OUTR/$id"
  good=1
  stage "$id" glb  "$OUTR/$id/$id.glb"            do_glb  || good=0
  [ $good = 1 ] && { stage "$id" anim "$OUTR/$id/anims_k29.ok" do_anim || good=0; }   # 표시가 K-0029 것이 아니면 전투 동작까지 다시 굽는다
  [ $good = 1 ] && { stage "$id" web  "$OUTR/$id/web/$id.glb" do_web || good=0; }
  [ $good = 1 ] && { stage "$id" 2d   "tools/char-forge/_out/sprites/$id/manifest.json" do_2d || good=0; }
  [ $good = 1 ] && ok=$((ok + 1))
done
echo "VROID_BATCH 인물 $total · 전부 끝 $ok"
