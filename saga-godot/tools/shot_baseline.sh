#!/usr/bin/env bash
# GO 그래픽 기준 네 컷(마을·포구·폐허·고원)을 창 모드로 찍는다 — probe_shots.gd 를 이 네 컷만 돌리는 명령 한 벌.
#   GODOT=<콘솔 exe> bash tools/shot_baseline.sh <출력 절대 폴더>
# 루트 CLAUDE.md: 작업 중 스크린샷 금지 — **사용자가 "기준 촬영"을 요청한 세션에서만** 돌린다. 화면 밖(-4000,0)에 띄운다.
# 찍은 뒤: 첫 기준이면 사용자가 승인한 PNG 만 saga-godot/graphics/baseline/go/ 로 복사해 커밋,
#         그 뒤 촬영은 `node tools/shot_diff.mjs graphics/baseline/go <출력 폴더>` 로 숫자 비교.
set -u
cd "$(dirname "$0")/.." || exit 1
: "${GODOT:?GODOT 환경변수에 Godot 콘솔 exe 경로를 지정할 것}"
OUT="${1:?출력 폴더(절대 경로)를 첫 인자로}"
CUTS="v_village_plaza,c_sea,r_statue,f_pass_view"
mkdir -p "$OUT"

SAGA_SHOT_PROBE=1 SAGA_SHOT_DIR="$OUT" SAGA_SHOT_ONLY="$CUTS" \
  timeout 600 "$GODOT" --path "$(pwd)" --rendering-method mobile --position -4000,0 --resolution 1280x720 \
  res://games/saga_go/world/TestVillage.tscn </dev/null &
pid=$!
wait "$pid"
rc=$?
# 제때 안 끝나면 timeout 이 이 프로세스만 죽인다(다른 Godot·크롬·node 는 안 건드린다).
n=$(ls "$OUT"/*.png 2>/dev/null | wc -l)
echo "SHOT_BASELINE rc=$rc png=$n/4 → $OUT"
[ "$n" -eq 4 ]
