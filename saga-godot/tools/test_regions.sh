#!/usr/bin/env bash
# 지역 구경 장면 자동 테스트(G-0015) — ① 화면 없이 계수 진단 ② 창 모드(화면 밖)로 지역 다섯을 찍어 화면 상태를 숫자로 판정.
#   GODOT=<콘솔 exe> bash tools/test_regions.sh [출력 폴더(절대, 기본 tools/_out/regions)]
# ①은 조각·나무·꽃·길 수 = 배치표, 풍경·물·지형 있음, 점광원 ≤ 예산, 뒤집힌 삼각형 0. ②는 너무 어둡다/밝다·한 색·색 종류 부족이면 실패.
# 사용자가 촬영을 요청한 세션이 아니면 ②는 --no-shot 으로 뺀다(루트 CLAUDE.md: 작업 중 스크린샷 금지). 이 PC 에 GPU 창이 없으면 ②만 실패한다.
set -u
cd "$(dirname "$0")/.." || exit 1
: "${GODOT:?GODOT 환경변수에 Godot 콘솔 exe 경로를 지정할 것}"
OUT="tools/_out/regions"; SHOT=1
for a in "$@"; do case "$a" in --no-shot) SHOT=0 ;; *) OUT="$a" ;; esac; done
mkdir -p "$OUT"
fails=0

log="$OUT/probe.log"
SAGA_REGION_PROBE=1 timeout 240 "$GODOT" --headless --path . res://games/saga_go/world/RegionShowcase.tscn </dev/null >"$log" 2>&1
line=$(grep -a "REGION_PROBE_DONE" "$log" | tail -1)
echo "① 계수 진단: ${line:-결과 줄 없음}"
case "$line" in *"fails=0") ;; *) fails=$((fails + 1)); grep -a "나쁜것=\[[^]]" "$log" | head -5 ;; esac

if [ "$SHOT" -eq 1 ]; then
  for r in village galaxy_ferry frost_peak time_rift crossroads; do
    slog="$OUT/shot_$r.log"
    SAGA_REGION="$r" SAGA_REGION_SHOT="$(cd "$OUT" && pwd)" timeout 150 "$GODOT" --path . --rendering-method mobile \
      --position -4000,0 --resolution 1280x720 res://games/saga_go/world/RegionShowcase.tscn </dev/null >"$slog" 2>&1
    res=$(grep -a "REGION_SHOT_RESULT" "$slog" | tail -1)
    echo "② ${res:-$r 결과 줄 없음}   $(grep -a '^REGION_SHOT ' "$slog" | tail -1 | cut -d' ' -f3-)"
    case "$res" in *" OK") ;; *) fails=$((fails + 1)) ;; esac
  done
fi
echo "TEST_REGIONS fails=$fails"
[ "$fails" -eq 0 ]
