#!/usr/bin/env bash
# 모든 자동 점검(probe)을 한 명령으로 돌려 fails 합계를 낸다.
#   GO 씬 probe   : games/saga_go/world/test_village.gd 가 읽는 SAGA_<이름>_PROBE 환경변수마다 TestVillage 씬을 한 번씩(SHOT=스크린샷은 뺀다)
#   SceneTree probe: tools/probe_*.gd 중 `extends SceneTree` 인 것을 --script 로(네 판 세이브 probe_save_<판> 포함)
# 사용: GODOT=<콘솔 exe 경로> bash tools/probe_all.sh [--only=이름,이름,…]
#   이름 = GO 는 환경변수 이름 소문자(adventure, field_boss …), SceneTree 는 probe_ 뒤(save_dungeon, wardrobe …)
# 끝에 "PROBE_ALL fails=합계 probes=개수" — 합계 0 이면 종료 0. 표는 tools/_out/probe_all.json 에도 쓴다.
# 결과 줄 읽기: "<이름>_PROBE_DONE fails=N"(GO) · "PROBE <이름> OK"/"PROBE <이름> FAIL N"(SceneTree). 결과 줄이 없거나 180초를 넘기면 fails=1.
set -u
cd "$(dirname "$0")/.." || exit 1

: "${GODOT:?GODOT 환경변수에 Godot 콘솔 exe 경로를 지정할 것}"
PROJECT="$(pwd)"
LOGDIR="${TMPDIR:-/tmp}/probe_all"
OUTDIR="tools/_out"
TIMEOUT_SEC=180
GO_SCENE="res://games/saga_go/world/TestVillage.tscn"
mkdir -p "$LOGDIR" "$OUTDIR"

only=""
for a in "$@"; do
  case "$a" in
    --only=*) only="${a#--only=}" ;;
    *) echo "알 수 없는 인자: $a" >&2; exit 2 ;;
  esac
done

# (종류 이름) 목록 — GO 이름은 test_village.gd 에서 읽는다(하드코딩 안 함)
entries=()
while IFS= read -r env; do
  [ "$env" = "SHOT" ] && continue
  entries+=("go $(echo "$env" | tr 'A-Z' 'a-z')")
done < <(grep -o 'SAGA_[A-Z0-9_]*_PROBE' games/saga_go/world/test_village.gd | sed 's/^SAGA_//; s/_PROBE$//' | sort -u)
for f in tools/probe_*.gd; do
  grep -q '^extends SceneTree' "$f" || continue
  n="$(basename "$f" .gd)"
  entries+=("tree ${n#probe_}")
done
# G-0118 — TestVillage 밖 씬이 다는 점검(SceneTree 로 안 감싼 것): "scene <이름>" — 씬·환경변수는 아래 case
entries+=("scene layout_walk")

fails_total=0
count=0
json=""
printf '%-22s %-6s %s\n' "이름" "fails" "초"
for e in "${entries[@]}"; do
  kind="${e%% *}"; name="${e#* }"
  if [ -n "$only" ] && [[ ",$only," != *",$name,"* ]]; then continue; fi
  log="$LOGDIR/$name.log"
  t0=$(date +%s)
  if [ "$kind" = "scene" ]; then
    case "$name" in
      layout_walk) env "SAGA_LAYOUT_PROBE=1" timeout "$TIMEOUT_SEC" "$GODOT" --headless --path "$PROJECT" "res://games/saga_go/layout/LayoutWalk.tscn" </dev/null >"$log" 2>&1 ;;
    esac
  elif [ "$kind" = "go" ]; then
    up="$(echo "$name" | tr 'a-z' 'A-Z')"
    env "SAGA_${up}_PROBE=1" timeout "$TIMEOUT_SEC" "$GODOT" --headless --path "$PROJECT" "$GO_SCENE" </dev/null >"$log" 2>&1
  else
    timeout "$TIMEOUT_SEC" "$GODOT" --headless --path "$PROJECT" --script "res://tools/probe_$name.gd" </dev/null >"$log" 2>&1
  fi
  rc=$?
  secs=$(( $(date +%s) - t0 ))
  if [ "$rc" -eq 124 ]; then
    fails=1; note="TIMEOUT"
  else
    note=""
    line=$(grep -aoE '_PROBE_DONE fails=[0-9]+|^PROBE [A-Za-z0-9_]+ (OK|FAIL [0-9]+)' "$log" | tail -1)
    case "$line" in
      *fails=*) fails="${line##*fails=}" ;;
      *" OK") fails=0 ;;
      *FAIL*) fails="${line##* }" ;;
      *) fails=1; note="결과 줄 없음" ;;
    esac
  fi
  fails_total=$((fails_total + fails))
  count=$((count + 1))
  printf '%-22s %-6s %s %s\n' "$name" "fails=$fails" "${secs}s" "$note"
  json="${json}${json:+,}{\"name\":\"$name\",\"kind\":\"$kind\",\"fails\":$fails,\"secs\":$secs,\"note\":\"$note\"}"
done

echo "PROBE_ALL fails=$fails_total probes=$count"
printf '{"fails":%d,"probes":%d,"results":[%s]}\n' "$fails_total" "$count" "$json" >"$OUTDIR/probe_all.json"
[ "$fails_total" -eq 0 ] && [ "$count" -gt 0 ]
