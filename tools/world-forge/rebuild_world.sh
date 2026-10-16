#!/usr/bin/env bash
# K-0113 세계 GLB 다시 굽기 — 재질을 자체 PBR(_src/self, make_self_src.py)로 바꾼 뒤 정본 saga-assets/world/toon 에 있는 것 전부를 임시 폴더에 다시 만든다.
#   bash tools/world-forge/rebuild_world.sh [<출력 절대 폴더>=tools/world-forge/_out/k113]
# 정본은 안 건드린다 — 비교·덮어쓰기는 rebuild_compare.py. 로그 <폴더>/rebuild.log (끝 줄 REBUILD_DONE).
# Blender 하나씩(RAM). ComfyUI 와 겹치지 않게.
set -uo pipefail
cd "$(dirname "$0")/../.."
OUT="${1:-$(pwd -W 2>/dev/null || pwd)/tools/world-forge/_out/k113}"
mkdir -p "$OUT/toon"
B="${BLENDER:-/c/Program Files/Blender Foundation/Blender 5.2/blender.exe}"
WF=tools/world-forge
LOG="$OUT/rebuild.log"
echo "REBUILD_START $(date +%T)" >"$LOG"
for k in prop terrain vehicle nature village field equip interior monster weapon kit; do
  echo "== $k $(date +%T)" >>"$LOG"
  "$B" -b --factory-startup -P $WF/build_$k.py -- --all --out-dir "$OUT/toon" --style toon </dev/null 2>&1 | grep -aE "Traceback|Error|line [0-9]+," | head -5 >>"$LOG"
done
echo "== building $(date +%T)" >>"$LOG"
for f in saga-assets/world/toon/*.license.json; do
  grep -q '"generator": "tools/world-forge/build_building.py"' "$f" || continue
  id=$(basename "$f" .license.json)
  [ -f "$WF/recipes/$id.json" ] || { echo "레시피 없음 $id" >>"$LOG"; continue; }
  "$B" -b --factory-startup -P $WF/build_building.py -- --recipe $WF/recipes/$id.json --out "$OUT/toon/$id.glb" --style toon </dev/null 2>&1 | grep -aE "Traceback|Error" | head -3 >>"$LOG"
done
echo "REBUILD_DONE $(date +%T) $(ls "$OUT"/toon/*.glb 2>/dev/null | wc -l) glb" >>"$LOG"
