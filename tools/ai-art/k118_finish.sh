#!/bin/bash
# K-0118 마무리 한 명령 — 사슬(run_chain.sh)이 끝난 뒤: 판정 → 고르기 → 이름 정리 → 포장 → 정본 배치 → 웹 표·복사.
#   bash tools/ai-art/k118_finish.sh            # 전부
#   bash tools/ai-art/k118_finish.sh --place    # 판정·포장은 건너뛰고 배치부터(포장 결과가 이미 있을 때)
# 멱등 — 다시 돌려도 같은 결과. 사슬 중(STOP 없이 run_all.pid 살아 있음)엔 돌리지 않는다(ComfyUI 와 판정기 CLIP 이 GPU 를 다툰다).
set -e
cd /c/swbins
A=tools/ai-art; O=$A/_out
export PYTHONIOENCODING=utf-8
if [ "$1" != "--place" ]; then
  for d in k118_pic k118_sk_dg k118_sk_st; do
    n=$(ls $O/$d/*.png 2>/dev/null | wc -l)
    echo "== $d: $n 장"
    [ "$n" = 0 ] && { echo "$d 비어 있음 — 사슬부터"; exit 1; }
    # 묶음(id)마다 1장 — 아이콘 규격으로 판정(기술 결함 + CLIP 충실도)
    bash tools/asset-audit/judge/judge.sh score $O/$d --out $O/$d/_judge --per-group 1 --spec icon | tail -1
    bash tools/asset-audit/judge/judge.sh pick $O/$d/_judge/report.json --dest $O/k118_pick | tail -1
  done
  # 고른 것은 <키>_vNN.png 이름 그대로 온다 → icon_pack 이 읽는 <키>.png 로(원본은 그대로 두고 이름만 바꾼 사본)
  py - <<'EOF'
import glob, os, re, shutil
src = 'tools/ai-art/_out/k118_pick'; dst = 'tools/ai-art/_out/k118_pick_named'
os.makedirs(dst, exist_ok=True)
n = 0
for p in sorted(glob.glob(os.path.join(src, '*_v[0-9][0-9].png'))):
    key = re.sub(r'_v\d\d$', '', os.path.basename(p)[:-4])
    shutil.copyfile(p, os.path.join(dst, key + '.png'))
    lic = p[:-4] + '.license.json'
    if os.path.exists(lic):
        shutil.copyfile(lic, os.path.join(dst, key + '.license.json'))
        shutil.copyfile(lic, os.path.join(src, key + '.license.json'))   # place_icons 가 _out/k118_pick/<키>.license.json 을 읽는다
    n += 1
print('이름 정리', n)
EOF
  py $A/icon_pack.py $O/k118_pick_named $O/k118_pack --spec $A/data/k118_ui_icons.json --seg
fi
py $A/make_ui_icons.py
py $A/place_icons.py
py tools/asset-place/place.py --write --item icons-web
py tools/asset-place/place.py --write --item icons-godot --dry-engine >/dev/null 2>&1 || true
py tools/asset-place/place.py --write --item icons-unity --dry-engine >/dev/null 2>&1 || true
node tools/gen-itemicon-ids.mjs
node tools/sync-shared.mjs
py tools/asset-place/place.py --check | tail -1
py tools/asset-audit/credits.py --check | tail -1
echo K118_FINISH_DONE
