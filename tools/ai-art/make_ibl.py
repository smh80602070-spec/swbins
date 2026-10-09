"""K-0090 ② — 자체 하늘 파노라마(make_sky.py, 그림체 C)로 3D 환경광(IBL)용 Radiance .hdr 을 만든다.

  py tools/ai-art/make_ibl.py [하늘이름=noon_present] [--ref 옛.hdr]   → saga-assets/sky/ibl_<이름>_1k.hdr + .license.json

웹 사가만리 world3d.js 는 IBL 을 반사·거칠기 보조로만 쓴다(세기 = hemi × 0.30) — 하늘 그림 자체는 안 보인다.
그래서 모양보다 **밝기 분포**가 중요하다: 위 반구 = 하늘 그림(sRGB → 선형), 아래 반구 = 지평선 색에서 풀밭빛으로
어두워지는 땅, 해 자리(sky_markers.json sun_uv)에 작은 고휘도 원반. --ref 를 주면 옛 HDR 의 위·아래 평균 밝기에 맞춘다
(손으로 맞춘 iblScale 0.30 을 그대로 쓰게).
RGBE 쓰기는 새 방식 RLE(three.js RGBELoader 가 읽는다), 읽기는 RLE·평면 둘 다 — 쓴 파일을 다시 읽어 왕복 오차를 본다.
"""
import json
import os
import sys

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
SKY = os.path.join(ROOT, 'saga-assets', 'sky')


def read_hdr(path):
    b = open(path, 'rb').read()
    i = 0
    while True:                                   # 머리말: 빈 줄까지
        j = b.index(b'\n', i)
        line = b[i:j]
        i = j + 1
        if line == b'':
            break
    j = b.index(b'\n', i)
    dims = b[i:j].split()
    i = j + 1
    h, w = int(dims[1]), int(dims[3])
    out = np.zeros((h, w, 4), np.uint8)
    for y in range(h):
        if w >= 8 and w < 32768 and b[i] == 2 and b[i + 1] == 2 and (b[i + 2] << 8 | b[i + 3]) == w:
            i += 4
            for c in range(4):
                x = 0
                while x < w:
                    n = b[i]
                    i += 1
                    if n > 128:
                        n -= 128
                        out[y, x:x + n, c] = b[i]
                        i += 1
                    else:
                        out[y, x:x + n, c] = np.frombuffer(b, np.uint8, n, i)
                        i += n
                    x += n
        else:
            out[y] = np.frombuffer(b, np.uint8, w * 4, i).reshape(w, 4)
            i += w * 4
    e = out[..., 3].astype(np.int32)
    f = np.where(e > 0, np.ldexp(1.0, e - 136), 0.0)
    return out[..., :3].astype(np.float64) * f[..., None]


def to_rgbe(rgb):
    m = rgb.max(2)
    mant, ex = np.frexp(m)
    scale = np.where(m > 1e-32, mant * 256.0 / np.maximum(m, 1e-32), 0.0)
    out = np.zeros(rgb.shape[:2] + (4,), np.uint8)
    out[..., :3] = np.clip(rgb * scale[..., None], 0, 255).astype(np.uint8)
    out[..., 3] = np.where(m > 1e-32, ex + 128, 0).astype(np.uint8)
    return out


def rle_channel(row):
    """한 줄 한 채널 — 같은 값 3개 이상은 반복(최대 127), 나머지는 날것(최대 128)."""
    res = bytearray()
    n, x = len(row), 0
    while x < n:
        r = 1
        while x + r < n and r < 127 and row[x + r] == row[x]:
            r += 1
        if r >= 3:
            res += bytes((128 + r, row[x]))
            x += r
            continue
        s = x
        while x < n and x - s < 128:
            if x + 2 < n and row[x] == row[x + 1] == row[x + 2]:
                break
            x += 1
        res += bytes((x - s,)) + bytes(row[s:x])
    return bytes(res)


def write_hdr(path, rgb):
    h, w = rgb.shape[:2]
    px = to_rgbe(rgb)
    with open(path, 'wb') as f:
        f.write(b'#?RADIANCE\n# K-0090 tools/ai-art/make_ibl.py\nFORMAT=32-bit_rle_rgbe\n\n')
        f.write(b'-Y %d +X %d\n' % (h, w))
        for y in range(h):
            f.write(bytes((2, 2, w >> 8, w & 255)))
            for c in range(4):
                f.write(rle_channel(px[y, :, c].tolist()))


def srgb_to_lin(a):
    return np.where(a <= 0.04045, a / 12.92, ((a + 0.055) / 1.055) ** 2.4)


def build(name, ref=None):
    src = os.path.join(SKY, f'sky_{name}.webp')            # 2048 원본을 줄여 쓴다(1k WebP 의 블록이 선형화·배율에서 드러남)
    im = np.asarray(Image.open(src).convert('RGB').resize((1024, 512), Image.LANCZOS)).astype(np.float64) / 255.0
    h, w = im.shape[:2]
    lin = srgb_to_lin(im)
    v = (np.arange(h) + 0.5) / h
    # 아래 반구: 지평선 바로 위 띠의 평균 색 → 풀밭빛(선형)으로, 아래로 갈수록 어둡게
    hz = lin[int(h * 0.44):int(h * 0.49)].mean((0, 1))
    grass = srgb_to_lin(np.array([0.36, 0.45, 0.27]))
    for y in range(h // 2, h):
        t = min(1.0, (v[y] - 0.5) / 0.12)
        col = hz * (1 - t) + grass * t
        lin[y] = col * (1.0 - 0.45 * (v[y] - 0.5) * 2)
    mk = json.load(open(os.path.join(SKY, 'sky_markers.json'), encoding='utf-8'))['skies'].get(name, {})
    up, down = 1.0, 1.0
    if ref:
        r = read_hdr(ref)
        rh = r.shape[0]
        def calm(a):    # 해 빼고 — 옛 HDR 은 진짜 해(최대 수만)가 평균을 끌어올린다
            return np.minimum(a, np.percentile(a, 99.5)).mean()
        up = calm(r[: rh // 2]) / max(calm(lin[: h // 2]), 1e-6)
        down = calm(r[rh // 2:]) / max(calm(lin[h // 2:]), 1e-6)
        lin[: h // 2] *= up
        lin[h // 2:] *= down
    sun = None
    if mk.get('sun_uv') and not str(name).startswith('night'):
        su, sv = mk['sun_uv']
        yy, xx = np.mgrid[0:h, 0:w]
        dx = np.minimum(abs(xx + 0.5 - su * w), w - abs(xx + 0.5 - su * w))
        d2 = (dx ** 2 + (yy + 0.5 - sv * h) ** 2) / (w / 1024.0) ** 2
        disc = np.exp(-d2 / (2 * 2.2 ** 2))[..., None] * np.array([1.0, 0.96, 0.88])
        gain = 60.0 * up
        if ref:   # 옛 HDR 위 반구 에너지(입체각 가중) 중 하늘이 못 채운 몫을 해 원반에 싣는다 — 환경광 총량이 그대로
            def energy(a):
                hh = a.shape[0]
                cosw = np.cos((0.5 - (np.arange(hh) + 0.5) / hh) * np.pi)[:, None]
                return float((a[: hh // 2].mean(2) * cosw[: hh // 2]).sum() / a.shape[1])
            gain = max(gain, (energy(r) - energy(lin)) / max(energy(disc), 1e-9))
        lin += disc * gain
        sun = [su, sv, round(float(gain), 1)]
    return lin, {'up': round(float(up), 4), 'down': round(float(down), 4), 'sun_uv': sun, 'src': os.path.relpath(src, ROOT).replace('\\', '/')}


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    name = args[0] if args else 'noon_present'
    ref = sys.argv[sys.argv.index('--ref') + 1] if '--ref' in sys.argv else None
    if ref in args:
        args.remove(ref)
    lin, info = build(name, ref)
    out = os.path.join(SKY, f'ibl_{name}_1k.hdr')
    write_hdr(out, lin)
    back = read_hdr(out)
    err = float(np.abs(back - lin).max() / max(lin.max(), 1e-6))
    lic_src = json.load(open(os.path.join(SKY, f'sky_{name}.license.json'), encoding='utf-8'))
    lic = {'id': f'ibl_{name}_1k', 'generator': 'tools/ai-art/make_ibl.py', 'model': lic_src.get('model'), 'model_license': lic_src.get('model_license'),
           'license': '자체 하늘 그림(' + info['src'] + ')에서 코드로 — 그 그림의 라이선스를 따른다', 'derived_from': info['src'],
           'ref_match': {'ref': ref and os.path.relpath(ref, ROOT).replace('\\', '/'), 'up': info['up'], 'down': info['down']}, 'sun_uv': info['sun_uv'],
           'note': 'IBL(반사·거칠기 보조)용 — 위 반구 하늘 그림 선형화, 아래 반구 지평선색→풀밭빛, 해 원반 고휘도. K-0090 ②'}
    json.dump(lic, open(os.path.splitext(out)[0] + '.license.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print('IBL', os.path.relpath(out, ROOT), lin.shape[1], 'x', lin.shape[0], '%dKB' % (os.path.getsize(out) // 1024),
          'max %.1f' % lin.max(), 'mean up %.3f down %.3f' % (lin[: lin.shape[0] // 2].mean(), lin[lin.shape[0] // 2:].mean()), 'roundtrip %.4f' % err)


if __name__ == '__main__':
    main()
