#!/usr/bin/env bash
# 환경변수 SIZE·AZ·EL 로 크기·방위·고도(기본 256·45·30)
# 사용: bash _render_dir.sh <툰 GLB 폴더(절대)> <출력 폴더(절대)> id id ...  — 툰 GLB 를 등각 256px 투명 PNG 로
B="/c/Program Files/Blender Foundation/Blender 5.2/blender.exe"
IN="$1"; OUT="$2"; shift 2
mkdir -p "$OUT"
for id in "$@"; do "$B" -b --factory-startup -P /c/swbins/tools/world-forge/render_sprite.py -- "$OUT/$id.png" "$IN/$id.glb" --size ${SIZE:-256} --az ${AZ:-45} --el ${EL:-30} </dev/null >/dev/null 2>&1; done
echo RENDER_DONE
