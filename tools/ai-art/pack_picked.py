"""K-0091·K-0094 — 눈으로 고른 후보 한 장을 웹 2D 최종 산출로 포장한다(pack_web2d 의 bg·tiles 를 계획표 없이 한 장씩).

  py tools/ai-art/pack_picked.py bg   <후보 png> <출력 폴더> <이름>
      → <이름>_{far,mid,near}.webp + 각 .license.json + <이름>.layers.json (split_bg_layers 와 같은 층·좌우 왕복 이음)
  py tools/ai-art/pack_picked.py tile <후보 png> <출력 webp> [--px 256]
      → 이음매 없는 타일(make_seamless.seamless → 감싸 줄이기) + .license.json · 이음 검사 실패면 멈춤

license = 후보 그림의 gen.py license + picked·derived 칸. 놓기는 그 다음 place.py(또는 티켓이 정한 자리로 복사).
"""
import json
import os
import sys

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import split_bg_layers as SL  # noqa: E402
from make_seamless import seamless  # noqa: E402
from pack_web2d import lic_of, save_lic, wrap_resize, seam_ok  # noqa: E402


def bg(src, outdir, name):
    os.makedirs(outdir, exist_ok=True)
    img = Image.open(src).convert('RGB').resize((SL.W, SL.H), Image.LANCZOS)
    meta = {}
    for layer, sp in SL.SPEC.items():
        dst = os.path.join(outdir, '%s_%s.webp' % (name, layer))
        SL.layer(img, sp).save(dst, 'WEBP', quality=78 if layer == 'far' else 82, method=6)
        save_lic(dst, lic_of(src, {'id': '%s_%s' % (name, layer), 'picked': os.path.basename(src), 'layer': layer,
                                   'derived': 'tools/ai-art/split_bg_layers.py (좌우 왕복 이음) via pack_picked.py'}))
        meta[layer] = {'y': sp['y'], 'h': sp['h'], 'speed': sp['speed'], 'w': SL.W * 2}
    with open(os.path.join(outdir, name + '.layers.json'), 'w', encoding='utf-8', newline='\n') as f:
        json.dump(meta, f, indent=1)
    print('PACK_BG', name, outdir)


def tile(src, dst, px):
    im = seamless(Image.open(src).convert('RGB'), max(px, 512))
    t = wrap_resize(im, px)
    if not seam_ok(t):
        sys.exit('이음 검사 실패: ' + src)
    os.makedirs(os.path.dirname(os.path.abspath(dst)), exist_ok=True)
    t.save(dst, 'WEBP', quality=90, method=6)
    save_lic(dst, lic_of(src, {'id': os.path.splitext(os.path.basename(dst))[0], 'picked': os.path.basename(src), 'size': [px, px],
                               'derived': 'tools/ai-art/make_seamless.py seamless(4판 띠 섞기) → 감싸 줄이기 via pack_picked.py'}))
    print('PACK_TILE', dst, px)


def main():
    a = sys.argv[1:]
    if len(a) < 3:
        sys.exit(__doc__)
    if a[0] == 'bg' and len(a) >= 4:
        bg(a[1], a[2], a[3])
    elif a[0] == 'tile':
        tile(a[1], a[2], int(a[a.index('--px') + 1]) if '--px' in a else 256)
    else:
        sys.exit(__doc__)


if __name__ == '__main__':
    main()
