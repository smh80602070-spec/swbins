#!/bin/bash
# 확인판 + 자동 관절 한 줄씩: show.sh a b c
cd /c/swbins; bash tools/ai-art/k188/pair.sh "$@"
for i in "$@"; do py -c "import json;j=json.load(open('tools/ai-art/_out/k188/p/$i/joints.json'));print('$i',j.get('skirt'),j['foot'],j['neck'],j['N'])"; done
