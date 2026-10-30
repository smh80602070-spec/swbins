#!/bin/bash
# K-0208 소품 3 다시 굽기(같은 id·크기, 도형 수준 → 디테일): 벤치(build_village.py)·비석·깃대(build_prop.py) → 정본 world/toon·web → 자체 PBR 맵 → 웹 압축 → 미리보기.
#   bash tools/world-forge/k208_props.sh          (Blender 5.2 + `py tools/world-forge/make_self_src.py --toon-only` 로 _src/self 가 있어야 한다)
cd /c/swbins
B="/c/Program Files/Blender Foundation/Blender 5.2/blender.exe"
O=/c/swbins/tools/world-forge/_out/k208
mkdir -p $O/toon $O/webc
"$B" -b --factory-startup -P /c/swbins/tools/world-forge/build_village.py -- --id bench_01 --out $O/toon/bench_01.glb --style toon </dev/null 2>&1 | grep -E "WORLDFORGE|Traceback|Error"
for i in stele_01 banner_pole_01; do
  "$B" -b --factory-startup -P /c/swbins/tools/world-forge/build_prop.py -- --id $i --out $O/toon/$i.glb --style toon </dev/null 2>&1 | grep -E "WORLDFORGE|Traceback|Error"
done
IDS="bench_01 stele_01 banner_pole_01"
for i in $IDS; do
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
        d = json.load(open(p, encoding='utf-8')); d['ticket'] = 'K-0208'; d['pbr_maps'] = txt
        json.dump(d, open(p, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
E
echo K208_PROPS_DONE
