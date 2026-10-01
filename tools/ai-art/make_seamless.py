"""K-0015 — 생성된 바닥 그림을 좌우·상하 이음매 없는 타일로 바꾼다 (오프셋 + 가장자리 크로스페이드).

py tools/ai-art/make_seamless.py <입력폴더> [출력폴더] [--px 256]
 방법: 그림을 가로·세로로 절반씩 밀어(가장자리 이음매가 한가운데로 옴) 원본과 부드러운 마스크로 섞는다.
 산출: <출력>/<이름>.png (px×px) + <이름>_mosaic.png (3×3 이어 붙인 확인용) + mosaics.png (전체 한 장)
"""
import os
import sys

import numpy as np
from PIL import Image, ImageDraw


def seamless(im, size):
    im = im.convert('RGB')
    w, h = im.size
    s = min(w, h)
    im = im.crop(((w - s) // 2, (h - s) // 2, (w - s) // 2 + s, (h - s) // 2 + s)).resize((size * 2, size * 2), Image.LANCZOS)
    a = np.asarray(im).astype(np.float32)
    n = a.shape[0]
    sh = np.roll(a, (n // 2, n // 2), axis=(0, 1))          # 이음매가 한가운데 십자로
    # 마스크: 가장자리에서 0(밀린 그림) → 안쪽 1(원본) — 십자 이음매 부근은 원본이 아니라 밀린 그림 쪽이 이음매가 없다
    y, x = np.mgrid[0:n, 0:n].astype(np.float32)
    dx = np.abs(x - n / 2) / (n / 2)     # 0 가운데 … 1 가장자리
    dy = np.abs(y - n / 2) / (n / 2)
    d = np.maximum(dx, dy)
    m = np.clip((0.8 - d) / 0.5, 0, 1)    # 가운데 1, 가장자리 0 (부드럽게)
    m = m[..., None]
    out = a * m + sh * (1 - m)
    out = Image.fromarray(np.clip(out, 0, 255).astype(np.uint8))
    return out.resize((size, size), Image.LANCZOS)


def main():
    src = sys.argv[1]
    dst = sys.argv[2] if len(sys.argv) > 2 and not sys.argv[2].startswith('--') else os.path.join(src, '_seamless')
    px = int(sys.argv[sys.argv.index('--px') + 1]) if '--px' in sys.argv else 256
    os.makedirs(dst, exist_ok=True)
    files = sorted(f for f in os.listdir(src) if f.endswith('.png') and not f.endswith('_mosaic.png'))
    mos = []
    for f in files:
        t = seamless(Image.open(os.path.join(src, f)), px)
        name = os.path.splitext(f)[0]
        t.save(os.path.join(dst, name + '.png'))
        m = Image.new('RGB', (px * 3, px * 3))
        for i in range(3):
            for j in range(3):
                m.paste(t, (i * px, j * px))
        m.save(os.path.join(dst, name + '_mosaic.png'))
        mos.append((name, m.resize((px * 3 // 2, px * 3 // 2))))
        print('ok', name)
    cols = 4
    rows = (len(mos) + cols - 1) // cols
    w = mos[0][1].width
    sheet = Image.new('RGB', (cols * w, rows * (w + 14)), (30, 30, 34))
    dr = ImageDraw.Draw(sheet)
    for i, (name, m) in enumerate(mos):
        x, y = (i % cols) * w, (i // cols) * (w + 14)
        sheet.paste(m, (x, y + 14))
        dr.text((x + 3, y + 1), name, fill=(235, 235, 235))
    sheet.save(os.path.join(dst, 'mosaics.png'))
    print('mosaics.png', sheet.size)


if __name__ == '__main__':
    main()
