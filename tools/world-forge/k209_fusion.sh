#!/bin/bash
# K-0209 1만리 땅 퓨전 소품 18 자체판 굽기: 툰 GLB → 정본 world/toon·web → 자체 PBR 맵 → 웹 압축 → 미리보기 시트.
#   bash tools/world-forge/k209_fusion.sh [bake]   (인자 없으면 만들어서 미리보기만 — 정본에 안 넣음, bake 면 정본까지)
#   Blender 5.2 + `py tools/world-forge/make_self_src.py --toon-only` 로 _src/self 가 있어야 한다.
cd /c/swbins
B="/c/Program Files/Blender Foundation/Blender 5.2/blender.exe"
O=/c/swbins/tools/world-forge/_out/k209
IDS="traffic_light_01 stop_sign_01 ac_unit_01 antenna_mast_01 propane_tank_01 solar_array_01 solar_panel_low_01 capsule_house_01 radar_dish_01 rover_01 tank_01 turret_01 tree_floating_01 tree_glow_01 tree_lava_01 tree_spiral_01 cactus_01 palm_01"
IDS=${IDS_ONLY:-$IDS}
mkdir -p $O/toon $O/webc
for i in $IDS; do
  "$B" -b --factory-startup -P /c/swbins/tools/world-forge/build_village.py -- --id $i --out $O/toon/$i.glb --style toon </dev/null 2>&1 | grep -E "WORLDFORGE|Traceback|Error"
done
SIZE=300 bash tools/world-forge/_render_dir.sh "$O/toon" "$O/png" $IDS | tail -1
if [ "$1" = bake ]; then
  for i in $IDS; do for s in toon web; do cp $O/toon/$i.glb $O/toon/$i.license.json saga-assets/world/$s/; done; done
  (cd tools/glb-compress && node add_pbr_maps.mjs --ids $(echo $IDS | tr ' ' ',') --sets web,toon --size 128 --flat 0.05 | tail -1)
  rm -f $O/webc/*.glb $O/webc/.glb-compress-manifest.json
  for i in $IDS; do cp saga-assets/world/web/$i.glb $O/webc/; done
  node tools/glb-compress/compress.mjs $O/webc | tail -1
  for i in $IDS; do cp $O/webc/$i.glb saga-assets/world/web/; done
  PYTHONIOENCODING=utf-8 py - $IDS <<'E'
import json, sys
txt = json.load(open('saga-assets/world/web/wood_fence_01.license.json', encoding='utf-8'))['pbr_maps']
for s in ('web', 'toon'):
    for i in sys.argv[1:]:
        p = f'saga-assets/world/{s}/{i}.license.json'
        d = json.load(open(p, encoding='utf-8')); d['ticket'] = 'K-0209'; d['pbr_maps'] = txt
        json.dump(d, open(p, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
E
fi
echo K209_DONE
