#!/bin/bash
# 배치 여럿을 순서대로 — 각 배치는 run_all.sh(8장마다 sd-webui 재시작). 사용: bash tools/ai-art/run_chain.sh <상태파일> <배치.json>...
cd /c/swbins
S="$1"; shift; rm -f "$S"
for B in "$@"; do
  echo "== $B $(date +%T)" >> "$S"
  bash tools/ai-art/run_all.sh "$B" "$S.$(basename $B).st" > /dev/null 2>&1
  cat "$S.$(basename $B).st" | grep -E "chunk|STOP|안 뜸" | tail -2 >> "$S"
  [ -f tools/ai-art/_out/STOP ] && { echo "STOP 파일 — 체인 멈춤" >> "$S"; break; }
done
echo done >> "$S"
