#!/usr/bin/env bash
# 여러 배치를 순서대로 gen.py 로 끝까지 돌리고(한 번에 24장 한도라 배치마다 되풀이) 마지막에 SD 를 끈다. 이미 있는 그림은 건너뜀(멱등).
#   bash tools/ai-art/run_queue.sh <배치 이름...>    예: bash tools/ai-art/run_queue.sh rts_tiles rts_bld rts_units map store_art cutscene
# 진행 로그 tools/ai-art/_out/queue.log · 끝나면 마지막 줄에 QUEUE_DONE. RAM 6GB 미만이면 gen.py 가 스스로 멈추니 같은 배치를 다시 시도한다(최대 6번).
cd "$(dirname "$0")/../.."
LOG=tools/ai-art/_out/queue.log
: > "$LOG"
powershell -ExecutionPolicy Bypass -File tools/ai-art/start_sd.ps1 >> "$LOG" 2>&1
for b in "$@"; do
  f=tools/ai-art/batches/$b.json
  [ -f "$f" ] || { echo "없음 $f" >> "$LOG"; continue; }
  out=$(py -c "import json,sys;print(json.load(open('$f',encoding='utf-8'))['out'])")
  total=$(py -c "import json;print(len(json.load(open('$f',encoding='utf-8'))['items']))")
  for try in 1 2 3 4 5 6; do
    have=$(ls tools/ai-art/_out/$out 2>/dev/null | grep -c '\.png$')
    [ "$have" -ge "$total" ] && break
    echo "== $b 시도 $try ($have/$total)" >> "$LOG"
    py tools/ai-art/gen.py "$f" >> "$LOG" 2>&1 </dev/null
  done
  echo "== $b 끝 $(ls tools/ai-art/_out/$out 2>/dev/null | grep -c '\.png$')/$total" >> "$LOG"
done
powershell -ExecutionPolicy Bypass -File tools/ai-art/stop_sd.ps1 >> "$LOG" 2>&1
echo QUEUE_DONE >> "$LOG"
