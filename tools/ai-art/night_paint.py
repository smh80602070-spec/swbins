"""K-0092 — 낮 2D 건물 그림을 코드로 밤 변종으로 칠한다(GPU 안 씀). 실루엣·알파는 낮 그대로.

  py tools/ai-art/night_paint.py <낮 webp> <출력 webp> [--lights tools/ai-art/data/night_lights.json]
  → 출력 webp(낮과 같은 크기·같은 알파) + .license.json(낮 출처 + night_of·칠한 방법)

① 전체를 달빛 색(푸른 쪽)으로 어둡게 · ② 불 켜진 자리(창·문, data/night_lights.json 의 사각형·타원 — 눈으로 짚음)를
낮 밝기에 비례한 따뜻한 색으로 — 창살·문틀처럼 어두운 픽셀은 어둡게 남는다 · ③ 그 둘레 몇 px 만 그림 안쪽으로 은은히 번짐.
큰 빛 번짐은 웹이 그린다(K-0092). i2i 밤 변종은 창에 불이 안 들어와 버림(10-12, 8/8 낮 그림).
"""
import json
import os
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
MOON = np.array([0.40, 0.46, 0.66])     # 달빛 곱
WARM = np.array([1.00, 0.78, 0.42])     # 불빛 색
SPILL = 7                               # 번짐 반경(px)


def mask_of(size, shapes):
    m = Image.new('L', size, 0)
    d = ImageDraw.Draw(m)
    for s in shapes:
        if 'rect' in s:
            d.rectangle(s['rect'], fill=255)
        elif 'ellipse' in s:
            d.ellipse(s['ellipse'], fill=255)
    return m


def main():
    a = sys.argv[1:]
    if len(a) < 2:
        sys.exit(__doc__)
    day, out = a[0], a[1]
    lp = a[a.index('--lights') + 1] if '--lights' in a else os.path.join(HERE, 'data', 'night_lights.json')
    name = os.path.splitext(os.path.basename(day))[0]
    shapes = json.load(open(lp, encoding='utf-8'))[name]
    im = Image.open(day).convert('RGBA')
    rgb = np.asarray(im.convert('RGB')).astype(np.float32) / 255
    alpha = im.getchannel('A')
    luma = rgb @ np.array([0.299, 0.587, 0.114])
    gray = luma[..., None]
    night = (rgb * 0.75 + gray * 0.25) * MOON                          # 조금 빼고 푸르게
    m = mask_of(im.size, shapes).filter(ImageFilter.GaussianBlur(0.8))
    lit = np.asarray(m).astype(np.float32)[..., None] / 255
    lamp = WARM * np.clip(0.35 + luma * 0.9, 0, 1.1)[..., None]       # 낮에 어두운 창살은 어둡게
    spill = np.asarray(m.filter(ImageFilter.GaussianBlur(SPILL))).astype(np.float32)[..., None] / 255
    o = night * (1 - lit) + lamp * lit
    o = o + (1 - lit) * spill * WARM * 0.35 * (0.4 + gray)             # 둘레 벽만 은은히
    o = Image.fromarray((np.clip(o, 0, 1) * 255).astype(np.uint8), 'RGB').convert('RGBA')
    o.putalpha(alpha)
    o.save(out, 'WEBP', quality=92, method=6)
    day_lic = os.path.splitext(day)[0] + '.license.json'
    lic = json.load(open(day_lic, encoding='utf-8')) if os.path.exists(day_lic) else {}
    lic.update(id=os.path.splitext(os.path.basename(out))[0], size=list(im.size), night_of=os.path.basename(day),
               derived='tools/ai-art/night_paint.py (낮 그림을 코드로 어둡게 + 눈으로 짚은 창·문에 불빛 — 새 그림 없음, 알파 그대로)',
               lights=shapes)
    json.dump(lic, open(os.path.splitext(out)[0] + '.license.json', 'w', encoding='utf-8', newline='\n'), ensure_ascii=False, indent=1)
    print('NIGHT_OK', out, im.size, '불빛 %d 자리' % len(shapes))


if __name__ == '__main__':
    main()
