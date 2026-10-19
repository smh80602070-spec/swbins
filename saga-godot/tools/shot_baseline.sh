#!/usr/bin/env bash
# 다섯 판 그래픽 기준 컷을 창 모드로 찍는다 — GO 네 컷(마을·포구·폐허·고원, probe_shots.gd) + 네 판 한 컷씩(shot_scene.gd, G-0249).
#   GODOT=<콘솔 exe> bash tools/shot_baseline.sh <출력 절대 폴더>      → <폴더>/<판>/<컷>_1280x720.png 8장
# 루트 CLAUDE.md: 작업 중 스크린샷 금지 — **사용자가 "기준 촬영"을 요청한 세션·티켓 검증 칸에서만** 돌린다. 화면 밖(-4000,0)에 띄운다.
# 찍은 뒤: 판마다 graphics/baseline/<판>/ 에 기준 PNG 가 있으면 `node tools/shot_diff.mjs graphics/baseline/<판> <폴더>/<판>` 로 숫자 비교,
#         없으면 "건너뜀" — 첫 기준은 사용자가 승인한 PNG 만 그 폴더로 복사해 따로 커밋(graphics/baseline/README.md).
set -u
cd "$(dirname "$0")/.." || exit 1
: "${GODOT:?GODOT 환경변수에 Godot 콘솔 exe 경로를 지정할 것}"
OUT="${1:?출력 폴더(절대 경로)를 첫 인자로}"
CUTS="v_village_plaza,c_sea,r_statue,f_pass_view"
# 네 판 컷 = shot_scene.gd CUTS 이름(판 폴더:컷)
SCENE_CUTS=("dungeon:dg_loot" "forest:fs_villager" "story:st_field_front" "realm:rk_tactics")
mkdir -p "$OUT/go"

# 제때 안 끝나면 timeout 이 그 프로세스만 죽인다(다른 Godot·크롬·node 는 안 건드린다).
SAGA_SHOT_PROBE=1 SAGA_SHOT_DIR="$OUT/go" SAGA_SHOT_ONLY="$CUTS" \
  timeout 600 "$GODOT" --path "$(pwd)" --rendering-method mobile --position -4000,0 --resolution 1280x720 \
  res://games/saga_go/world/TestVillage.tscn </dev/null
rc=$?
for sc in "${SCENE_CUTS[@]}"; do
  game="${sc%%:*}"; cut="${sc#*:}"
  mkdir -p "$OUT/$game"
  SHOT_DIR="$OUT/$game" SHOT_ONLY="$cut" \
    timeout 300 "$GODOT" --path "$(pwd)" --rendering-method mobile --position -4000,0 --resolution 1280x720 \
    --script res://tools/shot_scene.gd </dev/null | grep -a "^SHOT"
  r=${PIPESTATUS[0]}
  [ "$r" -ne 0 ] && rc=$r
done

n=$(ls "$OUT"/*/*.png 2>/dev/null | wc -l)
echo "SHOT_BASELINE rc=$rc png=$n/8 → $OUT"
for game in go dungeon forest story realm; do
  if ls graphics/baseline/$game/*.png >/dev/null 2>&1; then
    node tools/shot_diff.mjs "graphics/baseline/$game" "$OUT/$game" | tail -1 | sed "s/^/$game /"
  else
    echo "$game SHOT_DIFF 건너뜀 — 기준 없음(graphics/baseline/$game/, 사용자 승인 뒤)"
  fi
done
[ "$n" -eq 8 ]
