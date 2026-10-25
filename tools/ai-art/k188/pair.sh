#!/bin/bash
# 확인판 둘을 나란히: pair.sh id1 id2 → _out/k188/pair.jpg
cd /c/swbins
py -c "
from PIL import Image
import sys
ims=[Image.open(f'tools/ai-art/_out/k188/p/{i}/auto.jpg').convert('RGB') for i in sys.argv[1:]]
s=Image.new('RGB',(sum(i.width for i in ims)+10*(len(ims)-1),max(i.height for i in ims)),'white');x=0
for i in ims: s.paste(i,(x,0));x+=i.width+10
s.save('tools/ai-art/_out/k188/pair.jpg',quality=82)" "$@"
