#!/bin/bash
# 빠른 확인: 번짐 채움으로 자르고 미리보기 둘 이상 세로로 → _out/k188/quick.jpg
cd /c/swbins; export PYTHONIOENCODING=utf-8
for i in "$@"; do D=tools/ai-art/_out/k188/p/$i; py tools/ai-art/k188_cutout.py cut $D/side.png $D/joints.json $D/rig0 --fill smear >/dev/null && py tools/ai-art/k188_cutout.py preview $D/rig0 $D/q --h 300 >/dev/null || echo "FAIL $i"; done
py -c "
from PIL import Image
import sys
ims=[Image.open(f'tools/ai-art/_out/k188/p/{i}/q.png').convert('RGB') for i in sys.argv[1:]]
w=1500;hs=[im.height*w//im.width for im in ims];s=Image.new('RGB',(w,sum(hs)),'white');y=0
for im,h in zip(ims,hs): s.paste(im.resize((w,h)),(0,y));y+=h
s.save('tools/ai-art/_out/k188/quick.jpg',quality=80)" "$@"
