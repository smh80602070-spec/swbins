#!/usr/bin/env bash
# K-0029 단계 5 — 인물 299 무기별 8방향 2D 시트를 다시 굽기(vroid_batch.sh, anims_k29.ok)와 나란히 굽는다. 멱등·이어하기.
#   bash tools/char-forge/run_combat_sprites.sh            # GPU(Eevee) — SD 가 꺼져 있을 때
#   WF_CPU=1 bash tools/char-forge/run_combat_sprites.sh   # CPU(Cycles)
# 계획 = data/combat_sprite_plan.json(make_combat_sprite_plan.py). 동작이 다시 구워진 인물만 10명씩, 다 끝나면 SPRITES8_DONE.
# 멈춤: tools/char-forge/_out/sprites8/STOP 파일. SD(127.0.0.1:7860)가 떠 있으면 GPU 모드는 기다린다(PC 안 멈추게).
set -u
cd "$(dirname "$0")/../.."
PLAN=tools/char-forge/data/combat_sprite_plan.json
OUT=tools/char-forge/_out/sprites8
mkdir -p "$OUT"
while true; do
  [ -f "$OUT/STOP" ] && { echo "STOP"; break; }
  if [ -z "${WF_CPU:-}" ] && curl -s -m 2 http://127.0.0.1:7860/sdapi/v1/progress >/dev/null 2>&1; then
    sleep 120; continue                                      # SD 가 GPU 를 쓰는 중
  fi
  todo=$(py -3.12 - "$PLAN" "$OUT" <<'PY'
import json, os, sys
plan, out = sys.argv[1], sys.argv[2]
ids = [e['id'] for e in json.load(open(plan, encoding='utf-8'))['entries']]
ready = [i for i in ids if os.path.exists(f'tools/char-forge/_out/vroid/{i}/anims_k29.ok') and not os.path.exists(os.path.join(out, i, 'manifest.json'))]
left = [i for i in ids if not os.path.exists(os.path.join(out, i, 'manifest.json'))]
print(','.join(ready[:10]) + '|' + str(len(left)))
PY
)
  batch=${todo%|*}; left=${todo#*|}
  if [ "$left" = "0" ]; then echo "SPRITES8_DONE"; break; fi
  if [ -z "$batch" ]; then sleep 300; continue; fi           # 다시 굽기를 기다린다
  echo "== $(date +%T) 남은 $left · 이번 $batch"
  py -3.12 tools/char-forge/bake_sprite_batch.py "$PLAN" --only "$batch" </dev/null 2>&1 | grep -aE "^ok|실패|Traceback" || true
done
