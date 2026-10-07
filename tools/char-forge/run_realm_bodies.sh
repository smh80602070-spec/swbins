#!/bin/bash
# 사가천하 장수 194 몸 만들기 — 공방 옷 → 키 보정 → 빌드 루프(있는 glb 는 건너뜀). 낮은 우선순위·순차. 멈추려면 tools/char-forge/_out/STOP_REALM 을 만든다.
# 사용: nohup bash tools/char-forge/run_realm_bodies.sh /tmp/realm_bodies.status > /dev/null 2>&1 &
cd /c/swbins
S="${1:-/tmp/realm_bodies.status}"; : > "$S"
B="/c/Program Files/Blender Foundation/Blender 5.2/blender.exe"
export BLENDER_USER_RESOURCES="$PWD/tools/char-forge/_blender"
OUT=tools/char-forge/_out/realm; mkdir -p "$OUT"
stop() { [ -f tools/char-forge/_out/STOP_REALM ] && { echo "STOP" >> "$S"; return 0; }; return 1; }
echo "garments $(date +%T)" >> "$S"
G=$(PYTHONIOENCODING=utf-8 py tools/char-forge/gen_realm_recipes.py --garments | tail -1)
nice -n 10 "$B" -b --factory-startup -P tools/char-forge/garments.py -- all $G > "$OUT/_garments.log" 2>&1
echo "garments rc=$? $(date +%T)" >> "$S"
stop && exit 0
echo "calib $(date +%T)" >> "$S"
nice -n 10 "$B" -b --factory-startup -P tools/char-forge/calib_height.py -- tools/char-forge/recipes/realm/*.json > "$OUT/_calib.log" 2>&1
echo "calib rc=$? $(date +%T)" >> "$S"
n=0; fail=0
for R in tools/char-forge/recipes/realm/hero_*.json; do
  id=$(basename "$R" .json)
  [ -f "$OUT/$id.glb" ] && continue
  stop && exit 0
  nice -n 10 "$B" -b --factory-startup -P tools/char-forge/build_real.py -- --recipe "$R" --out "$OUT/$id.glb" --fbx "$OUT/$id.fbx" > "$OUT/$id.log" 2>&1
  if [ -f "$OUT/$id.glb" ]; then n=$((n+1)); else fail=$((fail+1)); echo "FAIL $id" >> "$S"; fi
  [ $((n % 10)) -eq 0 ] && echo "built $n fail $fail $(date +%T)" >> "$S"
done
echo "done built=$n fail=$fail $(date +%T)" >> "$S"
