#!/usr/bin/env bash
# 사용: bash _render_dir.sh <툰 GLB 폴더(절대)> <출력 폴더(절대)> id id ...  — 툰 GLB 를 등각 256px 투명 PNG 로
B="/c/Program Files/Blender Foundation/Blender 5.2/blender.exe"
IN="$1"; OUT="$2"; shift 2
mkdir -p "$OUT"
for id in "$@"; do "$B" -b --factory-startup -P /c/swbins/tools/world-forge/render_sprite.py -- "$OUT/$id.png" "$IN/$id.glb" --size 256 </dev/null >/dev/null 2>&1; done
echo RENDER_DONE
