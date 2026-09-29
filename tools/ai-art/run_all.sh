#!/bin/bash
# 배치 하나를 끝까지 — 8장마다 sd-webui 를 껐다 켠다(메모리 누적 방지, 12장에서 RAM 12.6GB 를 쥐었다). 묶음 사이 20초 쉼.
# 안전 멈춤: tools/ai-art/_out/STOP 파일을 만들면 다음 묶음 전에 멈춘다. 사용: bash tools/ai-art/run_all.sh <배치.json> <상태파일>
cd /c/swbins
B="$1"; S="$2"; rm -f "$S" tools/ai-art/_out/STOP; echo $$ > tools/ai-art/_out/run_all.pid
export AI_ART_MAX=8
for i in $(seq 1 16); do
  [ -f tools/ai-art/_out/STOP ] && { echo "STOP 파일 — 멈춤" >> "$S"; break; }
  powershell -NoProfile -ExecutionPolicy Bypass -File tools/ai-art/start_sd.ps1 >> "$S" 2>&1
  if ! curl -s -m 5 http://127.0.0.1:7860/sdapi/v1/options > /dev/null; then echo "sd-webui 안 뜸 — 멈춤" >> "$S"; break; fi
  PYTHONIOENCODING=utf-8 py tools/ai-art/gen.py "$B" > tools/ai-art/_out/run_$i.log 2>&1
  echo "chunk $i: $(grep -c '^ok ' tools/ai-art/_out/run_$i.log) ok, $(grep -c '^실패' tools/ai-art/_out/run_$i.log) fail" >> "$S"
  powershell -NoProfile -ExecutionPolicy Bypass -File tools/ai-art/stop_sd.ps1 >> "$S" 2>&1
  if ! grep -q "^ok " tools/ai-art/_out/run_$i.log; then break; fi
  sleep 20
done
echo done >> "$S"
