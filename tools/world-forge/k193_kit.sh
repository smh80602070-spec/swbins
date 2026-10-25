#!/bin/bash
# K-0193 4종횡 발판 키트 굽기 → 정본(world/toon·web) + 자체 PBR 맵 + 웹 압축 + 미리보기 한 장
#   bash tools/world-forge/k193_kit.sh [id ...]   (없으면 다섯 전부)
cd /c/swbins
B="/c/Program Files/Blender Foundation/Blender 5.2/blender.exe"
O=/c/swbins/tools/world-forge/_out/k193
IDS=${*:-plat_wood_mid_01 plat_wood_end_01 plat_stone_mid_01 plat_stone_end_01 ladder_01}
mkdir -p $O/toon $O/webc
for i in $IDS; do
  "$B" -b --factory-startup -P tools/world-forge/build_prop.py -- --id $i --out $O/toon/$i.glb --style toon </dev/null 2>&1 | grep -E "WORLDFORGE|Traceback|Error"
  for s in toon web; do cp $O/toon/$i.glb $O/toon/$i.license.json saga-assets/world/$s/; done
done
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
        d = json.load(open(p, encoding='utf-8')); d['ticket'] = 'K-0193'; d['pbr_maps'] = txt
        json.dump(d, open(p, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
E
for i in $IDS; do "$B" -b --factory-startup -P tools/world-forge/preview.py -- $O/prev_$i.png /c/swbins/saga-assets/world/toon/$i.glb --size 600 </dev/null >/dev/null 2>&1; done
py - <<'E'
from PIL import Image
ids = 'plat_wood_mid_01 plat_wood_end_01 plat_stone_mid_01 plat_stone_end_01 ladder_01'.split()
O = 'tools/world-forge/_out/k193'
s = Image.new('RGB', (1200, 300 * len(ids)))
for r, i in enumerate(ids):
    for k in range(3):
        s.paste(Image.open(f'{O}/prev_{i}_{k}.png').convert('RGB').resize((400, 300)), (400 * k, 300 * r))
s.save(f'{O}/prev_all.jpg', quality=82)
E
echo K193_KIT_DONE
