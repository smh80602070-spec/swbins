#!/usr/bin/env bash
# 다섯 대표 씬 헤드리스 회귀: 각 3회 실행, 로그 md5 동일 + error/warn 0 확인 (PLAN.md 104-1·104-3)
# 사용: GODOT=<Godot_v4.7-stable_win64_console.exe 경로> bash tools/godot_regress.sh
set -u
cd "$(dirname "$0")/.." || exit 1

: "${GODOT:?GODOT 환경변수에 Godot 콘솔 exe 경로를 지정할 것}"
PROJECT="$(pwd)"
LOGDIR="${TMPDIR:-/tmp}/godot_regress"
mkdir -p "$LOGDIR"

names=(GO DUNGEON FOREST STORY REALM)
scenes=(
  "games/saga_go/world/TestVillage.tscn"
  "games/saga_dungeon/world/TestRoom.tscn"
  "games/saga_forest/world/TestVillageForest.tscn"
  "games/saga_story/world/SinyaField.tscn"
  "games/saga_realm/world/TestCity.tscn"
)

fail=0
for idx in "${!names[@]}"; do
  name="${names[$idx]}"
  scene="${scenes[$idx]}"
  sums=""
  issues=0
  for i in 1 2 3; do
    log="$LOGDIR/${name}_${i}.log"
    "$GODOT" --headless --path "$PROJECT" "res://$scene" --quit-after 5 --verbose >"$log" 2>&1
    # 09-28 — ImporterMesh.generate_lods(glb_utils.with_lods)가 --verbose 로 찍는 "LOD n: … error x (step error y)" 진행 줄은 오류가 아니다(오차 수치).
    n=$(grep -iE "error|warn|missing|invalid|cannot" "$log" | grep -vcE "^[[:space:]]*LOD (stop|[0-9]+):")
    issues=$((issues + n))
    s=$(md5sum "$log" | cut -c1-8)
    sums="${sums}${sums:+ }$s"
  done
  distinct=$(echo "$sums" | tr ' ' '\n' | sed '/^$/d' | sort -u | wc -l)
  if [ "$distinct" -gt 1 ] || [ "$issues" -gt 0 ]; then
    echo "FAIL $name scene=$scene md5=[$sums] issues=$issues"
    fail=1
  else
    echo "ok   $name scene=$scene md5=${sums%% *} issues=0"
  fi
done

## 재질 감사 — 원본 재질을 덮으며 텍스처·알파를 잃는 사고(흰 바위·네모판 잎·
## 엉뚱한 텍스처)는 에러 없이 "다르게 그려질" 뿐이라 위 md5·오류 grep이 못 잡는다.
## saga_core/world/material_audit.gd, 호스트 tools/material_audit_host.tscn.
echo "== 재질 감사 (material_audit)"
for idx in "${!names[@]}"; do
  name="${names[$idx]}"
  scene="${scenes[$idx]}"
  log="$LOGDIR/${name}_audit.log"
  "$GODOT" --headless --path "$PROJECT" res://tools/material_audit_host.tscn -- "res://$scene" >"$log" 2>&1
  done_line=$(grep -o "MATERIAL_AUDIT_DONE issues=-\?[0-9]*" "$log" | tail -1)
  if [ "$done_line" = "MATERIAL_AUDIT_DONE issues=0" ]; then
    echo "ok   $name audit issues=0"
  else
    echo "FAIL $name audit ${done_line:-(결과 줄 없음)} — $log"
    grep "^MATERIAL_AUDIT " "$log" | head -5 | cut -c1-200
    fail=1
  fi
done

echo "== .import/project.godot 잡음 (104-3)"
diff_out=$(git diff --stat -- project.godot '*.import')
if [ -n "$diff_out" ]; then
  echo "$diff_out"
  read -rp "위 변경을 되돌릴까(git checkout)? [y/N] " ans
  if [ "$ans" = "y" ]; then
    git checkout -- project.godot '*.import'
    echo "되돌림 완료"
  else
    echo "그대로 둠 — 커밋 전 확인할 것"
  fi
else
  echo "없음"
fi

[ $fail -eq 0 ] && echo "REGRESS OK" || { echo "REGRESS FAIL"; exit 1; }
