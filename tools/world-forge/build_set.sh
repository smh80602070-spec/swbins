#!/usr/bin/env bash
# world-forge 판별 세트 한 벌 — 툰 GLB 42 + 웹 압축본 + 웹 2D 스프라이트 (K-0017 단계 3). data/set_plan.json 과 같은 42개.
#   bash tools/world-forge/build_set.sh <출력 절대 폴더>      (BLENDER=<blender.exe> 로 바꿀 수 있다)
# 산출: <폴더>/toon/<id>.glb(Godot·Unity·웹 3D 원본, 무압축)  <폴더>/web/<id>.glb(Meshopt+WebP)  <폴더>/sprite/<id>.webp(웹 2D 등각 256px)
#       각 옆에 <id>.license.json. 끝에 check_plan.py 가 42/42 와 예산(삼각형 ≤5000·툰 ≤0.5MB)을 센다. 게임 폴더는 안 건드린다(배치는 K-0019).
# 주의: Blender 에 넘기는 경로는 절대 경로여야 한다(상대 경로는 드라이브 루트로 샌다).
set -euo pipefail
cd "$(dirname "$0")/../.."
OUT="${1:?출력 절대 폴더}"
mkdir -p "$OUT/toon" "$OUT/web" "$OUT/sprite"
OUT="$(cd "$OUT" && pwd -W 2>/dev/null || pwd)"
B="${BLENDER:-/c/Program Files/Blender Foundation/Blender 5.2/blender.exe}"
[ -x "$B" ] || { echo "Blender 없음: $B (BLENDER=경로)"; exit 1; }
WF=tools/world-forge

echo "== 1) 툰 GLB: 지물 15 · 지형 10 · 탈것 5 · 자연 소품 19(K-0052) · 마을 소품 18(K-0053)"
for k in prop terrain vehicle nature village; do
  "$B" -b --factory-startup -P $WF/build_$k.py -- --all --out-dir "$OUT/toon" --style toon </dev/null 2>&1 | grep -E "WORLDFORGE|Traceback|Error" | grep -v '"ok": true' || true
done
echo "== 2) 툰 GLB: 건물 12(레시피 전부 중 계획표에 있는 것)"
for id in $(py -3.12 -c "
import json
d=json.load(open('$WF/data/set_plan.json',encoding='utf-8'))
print(' '.join(sorted({i['id'] for g in d['games'].values() for i in g['building']})))"); do
  "$B" -b --factory-startup -P $WF/build_building.py -- --recipe $WF/recipes/$id.json --out "$OUT/toon/$id.glb" --style toon </dev/null 2>&1 | grep -E "Traceback|Error" || true
done

echo "== 3) 웹 압축본(Meshopt + WebP)"
rm -f "$OUT"/web/*.glb "$OUT"/web/.glb-compress-manifest.json
cp "$OUT"/toon/*.glb "$OUT"/toon/*.license.json "$OUT/web/"
node tools/glb-compress/compress.mjs "$OUT/web" | tail -3

echo "== 4) 웹 2D 스프라이트(등각 256px WebP)"
for f in "$OUT"/toon/*.glb; do
  id=$(basename "$f" .glb)
  "$B" -b --factory-startup -P $WF/render_sprite.py -- "$OUT/sprite/$id.png" "$f" --size 256 </dev/null >/dev/null 2>&1
  cp "$OUT/toon/$id.license.json" "$OUT/sprite/$id.license.json"
done
py -3.12 - "$OUT/sprite" <<'PY'
import glob, os, sys
from PIL import Image
for p in glob.glob(os.path.join(sys.argv[1], '*.png')):
    Image.open(p).convert('RGBA').save(p[:-4] + '.webp', 'WEBP', quality=85, method=6)
    os.remove(p)
PY

echo "== 5) 점검"
PYTHONIOENCODING=utf-8 py -3.12 $WF/check_plan.py --out "$OUT/toon" --web "$OUT/web" --sprites "$OUT/sprite" --budget --strict

echo "== 6) 판정 시트(그림 한 장 + 표)"
py -3.12 $WF/set_sheet.py "$OUT"
