"""K-0015 — 생성된 바닥 그림을 좌우·상하 이음매 없는 타일로 바꾼다 (오프셋 + 가장자리 크로스페이드).

py tools/ai-art/make_seamless.py <입력폴더> [출력폴더] [--px 256]
 방법: 그림을 가로·세로로 절반씩 밀어(가장자리 이음매가 한가운데로 옴) 원본과 부드러운 마스크로 섞는다.
 산출: <출력>/<이름>.png (px×px) + <이름>_mosaic.png (3×3 이어 붙인 확인용) + mosaics.png (전체 한 장)
"""
import os
import sys

import numpy as np
from PIL import Image, ImageDraw


def seamless(im, size, band=0.28, flatten=0.0):
    """K-0088 판 — 원본 A·가로로 민 H·세로로 민 V·양쪽 민 B 넷을 테두리 띠 가중치로 섞는다.
    u = 왼·오른 테두리 가까움(1→띠 밖 0), v = 위·아래. 결과 = (1-u)(1-v)A + u(1-v)H + (1-u)vV + uvB.
    테두리에는 그 방향으로 이어진 판만 오고(위아래 테두리 = V·B, 좌우 = H·B), 민 판의 이음매(가운데 줄)는
    그 판의 가중치가 0 인 곳에만 있다 → 십자 이음매가 원리적으로 안 생긴다(옛 판은 max(dx,dy) 네모 마스크라
    밀린 그림의 십자가 테두리 가까이에서 드러났다 — 무늬 15장). 띠 안은 겹쳐 보이는 정도의 섞임만.
    줄일 때도 감싸기로 덧대고 줄여서(LANCZOS 가 가장자리를 안 이어 붙인다) 테두리 차이를 안쪽만큼으로 둔다."""
    im = im.convert('RGB')
    w, h = im.size
    s = min(w, h)
    im = im.crop(((w - s) // 2, (h - s) // 2, (w - s) // 2 + s, (h - s) // 2 + s)).resize((size * 2, size * 2), Image.LANCZOS)
    a = np.asarray(im).astype(np.float32)
    n = a.shape[0]
    H = np.roll(a, n // 2, axis=1)
    V = np.roll(a, n // 2, axis=0)
    B = np.roll(a, (n // 2, n // 2), axis=(0, 1))
    t = np.arange(n, dtype=np.float32)
    edge = np.minimum(t, n - 1 - t) / (band * n)               # 0 테두리 … 1 띠 끝
    f = np.clip(1 - edge, 0, 1)
    f = f * f * (3 - 2 * f)                                    # smoothstep
    u = f[None, :, None]
    v = f[:, None, None]
    out = (1 - u) * (1 - v) * a + u * (1 - v) * H + (1 - u) * v * V + u * v * B
    if flatten:   # 큰 조명 얼룩(주름 그늘·빛 번짐)을 걷는다 — 반복하면 얼룩이 격자로 보인다(무늬 K-0088)
        from scipy import ndimage
        low = np.stack([ndimage.gaussian_filter(out[..., c], n / 10, mode='wrap') for c in range(3)], -1)
        out = out - flatten * (low - low.mean((0, 1)))
    pad = 8
    big = np.pad(out, ((pad, pad), (pad, pad), (0, 0)), mode='wrap')
    img = Image.fromarray(np.clip(big, 0, 255).astype(np.uint8))
    img = img.resize((size + pad, size + pad), Image.LANCZOS)  # 2배 → 1배라 덧댄 8px 는 4px
    q = pad // 2
    return img.crop((q, q, q + size, q + size))


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
