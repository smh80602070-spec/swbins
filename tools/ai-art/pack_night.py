"""K-0092 — 낮 2D 건물 그림의 밤 변종(i2i 결과)을 낮 그림 알파로 잘라 같은 크기 WebP 로 놓는다. 실루엣 어긋남 0.

  py tools/ai-art/pack_night.py <i2i png> <낮 webp> <출력 webp>
  → 출력 webp(낮과 같은 크기·같은 알파) + 같은 이름 .license.json(i2i license + 낮 그림 출처·자르기 단계)

i2i 밑그림 = 낮 그림을 1024 로 키워 단색 바탕에 얹은 것(같은 자리) — 그래서 결과를 낮 크기로 줄이면 픽셀이 겹친다.
알파는 낮 그림 것을 그대로 쓴다(바탕색이 끼지 않게 알파 가장자리 1px 는 낮 색 쪽으로 섞지 않고 그대로 둔다).
"""
import json
import os
import sys

from PIL import Image


def main():
    if len(sys.argv) < 4:
        sys.exit(__doc__)
    src, day, out = sys.argv[1:4]
    d = Image.open(day).convert('RGBA')
    n = Image.open(src).convert('RGB').resize(d.size, Image.LANCZOS)
    o = n.convert('RGBA')
    o.putalpha(d.getchannel('A'))
    o.save(out, 'WEBP', quality=92, method=6)
    lic_src = os.path.splitext(src)[0] + '.license.json'
    lic = json.load(open(lic_src, encoding='utf-8')) if os.path.exists(lic_src) else {}
    day_lic = os.path.splitext(day)[0] + '.license.json'
    lic.update(id=os.path.splitext(os.path.basename(out))[0], size=list(d.size),
               night_of=os.path.basename(day), day_license=os.path.basename(day_lic) if os.path.exists(day_lic) else None,
               packed_by='tools/ai-art/pack_night.py (i2i 결과를 낮 크기로 줄이고 낮 알파를 그대로 — 실루엣 같음)')
    json.dump(lic, open(os.path.splitext(out)[0] + '.license.json', 'w', encoding='utf-8', newline='\n'), ensure_ascii=False, indent=1)
    print('NIGHT_OK', out, d.size)


if __name__ == '__main__':
    main()
