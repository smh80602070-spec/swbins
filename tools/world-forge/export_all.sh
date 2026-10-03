#!/usr/bin/env bash
# 지역 다섯 한 번에 — 시안 PNG(사실 모드) + 게임용 배치 에셋(툰 모드 배치표·풍경 메시) + 하늘 연결. 결과는 saga-assets/regions/ (배포는 place.py --write)
#   bash tools/world-forge/export_all.sh [시안 샘플수=48]
set -euo pipefail
cd "$(dirname "$0")/../.."
B="${BLENDER:-/c/Program Files/Blender Foundation/Blender 5.2/blender.exe}"
S="${1:-48}"
ABS="$(pwd -W 2>/dev/null || pwd)"
for r in galaxy_ferry frost_peak time_rift crossroads village; do
  echo "== $r"
  "$B" -b --factory-startup -P tools/world-forge/region_hero.py -- $r "$ABS/tools/world-forge/_out/hero_${r}_pbr_raw.png" "$S" pbr </dev/null 2>&1 | grep -E "TIME render|Traceback|line [0-9]+," | head -3 || true
  PYTHONIOENCODING=utf8 py tools/world-forge/hero_post.py "tools/world-forge/_out/hero_${r}_pbr_raw.png" "tools/world-forge/_out/hero_${r}_pbr.png" 0.5 | tail -1
  if [ "$r" = "village" ]; then
    HERO_LAYOUT="$ABS/saga-assets/regions/village/layout.json" "$B" -b --factory-startup -P tools/world-forge/region_hero.py -- $r "$ABS/tools/world-forge/_out/hero_${r}_raw.png" 4 </dev/null 2>&1 | grep -E "Traceback" | head -2 || true
  else
    HERO_EXPORT="$ABS/saga-assets/regions/$r" "$B" -b --factory-startup -P tools/world-forge/region_hero.py -- $r "$ABS/tools/world-forge/_out/hero_${r}_raw.png" 4 </dev/null 2>&1 | grep -E "EXPORT|Traceback" | head -2 || true
  fi
done
py tools/world-forge/link_sky.py
