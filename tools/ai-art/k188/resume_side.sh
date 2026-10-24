#!/bin/bash
# K-0188 ② 옆모습 사슬 다시 — 포장(u2net)이 끝난 뒤(겹치면 SD 가 480s 초과로 멈춤), 있는 그림은 gen.py 가 건너뜀
cd /c/swbins
until ! tasklist //NH | grep -q "k163_illust" && grep -q "^pack" tools/ai-art/_out/k185/pack.log 2>/dev/null; do sleep 60; done
bash tools/ai-art/_out/k188/run_side30.sh
bash tools/ai-art/k188/redo4.sh
