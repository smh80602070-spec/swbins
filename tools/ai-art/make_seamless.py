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


def rectify_ground(im, y1, size=640):
    """K-0091 — 원근 땅 사진(위로 갈수록 작아지는 돌)을 내려다본 평면으로 편다(호모그래피).
    땅 평면·지평선이 그림 위 h/2 위라 보고(아래 끝 크기 : 맨 위 크기 ≈ 3 : 1), 행 y1 부터 아래 끝까지를
    땅 위 정사각으로 본다 — 사다리꼴 위 변 반폭 = (y1 + h/2)/3·(w/h). y1 이 클수록 세로를 더 늘린다(돌이 둥글어질 때까지 눈으로)."""
    im = im.convert('RGB')
    w, h = im.size
    x0 = w / 2 - (y1 + h / 2) / 3 * (w / h)
    quad = [(x0, y1), (w - x0, y1), (w, h), (0, h)]
    out = [(0, 0), (size, 0), (size, size), (0, size)]
    A, b = [], []
    for (u, v), (x, y) in zip(out, quad):   # 출력 → 입력
        A.append([u, v, 1, 0, 0, 0, -x * u, -x * v]); b.append(x)
        A.append([0, 0, 0, u, v, 1, -y * u, -y * v]); b.append(y)
    c = np.linalg.solve(np.array(A, float), np.array(b, float))
    return im.transform((size, size), Image.PERSPECTIVE, tuple(c), Image.BICUBIC)


def cutseam(im, band=0.125):
    """K-0091 — 최소 오차 경계 자르기(이미지 퀼팅)로 주기 타일. 낱알 무늬(조약돌)는 seamless 의 띠 섞기가
    반투명 겹친 돌(고스팅)을 만든다 → 띠에서 '오른쪽 끝의 연속'과 '원래 왼쪽'을 행마다 차이가 가장 작은 길로
    잘라 붙인다(섞지 않음). 정사각 S 에서 N = S/(1+band), 띠 B = S - N. 결과 N×N(크기 줄이기는 wrap_resize)."""
    a = np.asarray(im.convert('RGB'), dtype=np.float32)
    s = min(a.shape[:2])
    n = int(round(s / (1 + band)))
    bw = s - n
    a = a[:s, :s]

    def cut_mask(err):
        E = err.copy()
        for y in range(1, E.shape[0]):
            p = E[y - 1]
            E[y] += np.minimum(np.minimum(np.r_[np.inf, p[:-1]], p), np.r_[p[1:], np.inf])
        cut = np.zeros(E.shape[0], int)
        cut[-1] = int(np.argmin(E[-1]))
        for y in range(E.shape[0] - 2, -1, -1):
            c = cut[y + 1]
            lo = max(0, c - 1)
            cut[y] = lo + int(np.argmin(E[y, lo:c + 2]))
        return np.arange(E.shape[1])[None, :] < cut[:, None]

    def wrap_x(I):
        A, O = I[:, n:n + bw], I[:, :bw]
        m = cut_mask(((A - O) ** 2).sum(2))
        T = I[:, :n].copy()
        T[:, :bw][m] = A[m]
        return T

    t = wrap_x(a)
    t = wrap_x(t.transpose(1, 0, 2)).transpose(1, 0, 2)
    return Image.fromarray(np.clip(t, 0, 255).astype(np.uint8))


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
