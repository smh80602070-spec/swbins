#!/bin/bash
# K-0068 재생성(그림체 P) 사슬 — 배치마다 24장씩 → SD 껐다 켬(RAM) → 다 뽑히면 판정기 score. 멱등(있는 그림은 gen.py 가 건너뜀)이라 끊기면 그냥 다시 돌린다.
#   bash tools/ai-art/regen_P.sh [배치 이름...]   기본 static2d_P moving2d_P · 로그 tools/ai-art/_out/regen_P.log(REGEN_LOG=<경로> 로 바꿈) · 끝 줄 REGEN_DONE
cd "$(dirname "$0")/../.."
export PYTHONIOENCODING=utf-8
LOG=${REGEN_LOG:-tools/ai-art/_out/regen_P.log}
BATCHES=("$@"); [ ${#BATCHES[@]} -eq 0 ] && BATCHES=(static2d_P moving2d_P)
echo "== 시작 $(date +%T) ${BATCHES[*]}" >> "$LOG"
for b in "${BATCHES[@]}"; do
  f=tools/ai-art/batches/$b.json
  total=$(py -c "import json;b=json.load(open('$f',encoding='utf-8'));print(len(b['items'])*int(b['defaults'].get('variants',1)))")
  for try in $(seq 1 14); do
    have=$(ls tools/ai-art/_out/$b 2>/dev/null | grep -c '\.png$')
    [ "$have" -ge "$total" ] && break
    echo "== $b 시도 $try ($have/$total) $(date +%T)" >> "$LOG"
    powershell -ExecutionPolicy Bypass -File tools/ai-art/start_sd.ps1 >> "$LOG" 2>&1
    py tools/ai-art/gen.py "$f" >> "$LOG" 2>&1 </dev/null
    powershell -ExecutionPolicy Bypass -File tools/ai-art/stop_sd.ps1 >> "$LOG" 2>&1
  done
  echo "== $b 끝 $(ls tools/ai-art/_out/$b 2>/dev/null | grep -c '\.png$')/$total $(date +%T)" >> "$LOG"
  bash tools/asset-audit/judge/judge.sh score tools/ai-art/_out/$b --per-group 1 >> "$LOG" 2>&1 </dev/null
done
powershell -ExecutionPolicy Bypass -File tools/ai-art/stop_sd.ps1 >> "$LOG" 2>&1
echo REGEN_DONE >> "$LOG"
