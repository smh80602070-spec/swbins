"""이미 만든 i2i 그림(web_heroes_105_i2i)의 .license.json 에 밑그림 칸을 채운다(재생성 없음)."""
import glob
import json
import os
from i2i_meta import base_meta

D = os.path.join(os.path.dirname(os.path.abspath(__file__)), '_out', 'web_heroes_105_i2i')
b = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'batches', 'web_heroes_105_i2i.json'), encoding='utf-8'))
den = b.get('defaults', {}).get('denoise', 0.55)
n = 0
for it in b['items']:
    p = os.path.join(D, it['id'] + '.license.json')
    if not os.path.exists(p):
        continue
    lic = json.load(open(p, encoding='utf-8'))
    lic.update(base_meta(it['init_image'], it.get('denoise', den)))
    json.dump(lic, open(p, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    n += 1
print('backfilled', n)
