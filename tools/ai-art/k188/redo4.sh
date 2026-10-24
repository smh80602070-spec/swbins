#!/bin/bash
# 프롬프트 실수(팔 떼기 1.3 — 번짐·T자) 로 그린 덩어리 3 넷 다시 — 사슬 끝난 뒤
cd /c/swbins
until grep -q SIDE30_DONE tools/ai-art/_out/k188/gen_side30.log; do sleep 60; done
mkdir -p tools/ai-art/_out/k188/side_bad
for i in wd_genghis jp_hanzo sg_ganning jp_tomoegozen wd_shaka; do mv tools/ai-art/_out/k188/side/${i}_side_v* tools/ai-art/_out/k188/side_bad/ 2>/dev/null; done
PYTHONIOENCODING=utf-8 py tools/ai-art/gen.py tools/ai-art/batches/k188_side30.json --only wd_genghis_side,jp_hanzo_side,sg_ganning_side,jp_tomoegozen_side,wd_shaka_side >> tools/ai-art/_out/k188/gen_side30.log 2>&1
echo REDO4_DONE >> tools/ai-art/_out/k188/gen_side30.log
