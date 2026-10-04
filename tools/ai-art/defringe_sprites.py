"""2D 스프라이트의 흰 테두리(AI 스티커 테) 점검·제거 — 사용자 "하얀 부분 있네"(K-0058)·"정적 51 바탕색과 같이 섞이는지"(10-05).

  py tools/ai-art/defringe_sprites.py <폴더> [--apply] [--min 0.25]     # 기본은 점검만(표). --apply 는 테의 흰 비율 ≥ min(기본 0.25) 이고 안쪽 흰 비율 < 0.25 인 것만 벗겨 같은 파일에 쓴다
판정: 가장자리 띠(투명에서 2px)의 흰 픽셀 비율이 높고 안쪽은 낮으면 '물체 둘레에 그려진 테'. 눈 덮인 소나무·돔·자작처럼 안쪽도 흰 물체는 건드리지 않는다.
"""
import os
import sys

from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from matte_util import defringe, white_ratio  # noqa: E402

a = [x for x in sys.argv[1:] if not x.startswith('--')]
apply = '--apply' in sys.argv
mn = float(sys.argv[sys.argv.index('--min') + 1]) if '--min' in sys.argv else 0.25
folder = a[0]
rows = []
for f in sorted(os.listdir(folder)):
    if not f.endswith('.webp'):
        continue
    p = os.path.join(folder, f)
    im = Image.open(p)
    if im.mode != 'RGBA':
        continue
    r, i = white_ratio(im)
    rows.append((f, r, i))
hit = [(f, r, i) for f, r, i in rows if r >= mn and i < 0.25]
for f, r, i in sorted(rows, key=lambda x: -x[1])[:12]:
    print(f'{f:30s} 테 {r*100:5.1f}%  안쪽 {i*100:5.1f}%' + ('  ← 흰 테' if (f, r, i) in hit else ''))
print('흰 테 판정', len(hit), '/', len(rows))
if apply:
    for f, r, i in hit:
        p = os.path.join(folder, f)
        out = defringe(Image.open(p))
        r2, i2 = white_ratio(out)
        out.save(p, 'WEBP', quality=88, method=6)
        print('벗김', f, f'테 {r*100:.0f}% → {r2*100:.0f}%')
