#!/usr/bin/env bash
B="/c/Program Files/Blender Foundation/Blender 5.2/blender.exe"
O=C:/swbins/tools/world-forge/_out/nature_hq
mkdir -p /c/swbins/tools/world-forge/_out/nature_hq/sprite
for id in "$@"; do "$B" -b --factory-startup -P /c/swbins/tools/world-forge/render_sprite.py -- "$O/sprite/$id.png" "$O/toon/$id.glb" --size 256 </dev/null >/dev/null 2>&1; done
echo RENDER_DONE
