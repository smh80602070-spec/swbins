"""K-0104 사실 들풀 아틀라스 — 흰 바탕 낱장 8장(ai-art 배치 k104_foliage, 자체 생성)을 알파로 따서 2048² 한 장(4×2 칸, 512×1024)에 앉힌다.

  py tools/world-forge/foliage_atlas.py [--picks tools/world-forge/data/k104_picks.json] [--out saga-assets/world/foliage/_atlas] [--sheet <png>]

picks = {"<칸 id>": "<고른 그림 경로>"}. 칸은 아래 SLOTS 순서(빌더 build_foliage.py 가 같은 이름으로 찾는다).
산출: foliage_atlas.png(RGBA, 투명 칸은 가까운 색으로 번져 채움 — 밉맵 테두리 흰 띠 막기)·foliage_atlas_n.png(밝기 → 높이 → 법선)·
foliage_atlas.json(칸마다 내용 UV 사각형·가로세로 비)·foliage_atlas.license.json.
배경 따기: 잎·풀·고사리 = 전역 색 키(잎 사이 막힌 흰 틈까지), 꽃 = matte2(가장자리에서 이어진 흰색만 — 흰 꽃잎은 남긴다).
"""
import json
import os
import sys

import numpy as np
from PIL import Image, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
sys.path.insert(0, os.path.join(ROOT, 'tools', 'ai-art'))
import matte_util as MU  # noqa: E402

SLOTS = ['leaf_broad', 'leaf_small', 'grass_blades', 'grass_seed', 'flower_white', 'flower_yellow', 'flower_purple', 'fern_frond']
GLOBAL_KEY = {'leaf_broad', 'leaf_small', 'grass_blades', 'grass_seed', 'fern_frond'}
W, H, CW, CH, PAD = 2048, 2048, 512, 1024, 6


def arg(k, d=None):
    a = sys.argv
    return a[a.index(k) + 1] if k in a else d


def global_key(im, lo=18, hi=60):
    """흰 바탕 거리로 알파 — 거리 lo 이하 투명, hi 이상 불투명, 사이는 부드럽게. 잎 사이 막힌 틈도 지운다."""
    a = np.asarray(im.convert('RGB')).astype(np.float32)
    h, w = a.shape[:2]
    bg = np.median(np.concatenate([a[:6].reshape(-1, 3), a[-6:].reshape(-1, 3), a[:, :6].reshape(-1, 3), a[:, -6:].reshape(-1, 3)]), axis=0)
    dist = np.abs(a - bg).max(axis=2)
    al = np.clip((dist - lo) / (hi - lo), 0, 1)
    # 반투명 가장자리의 흰 번짐 빼기: 색 = (색 - 바탕 * (1 - 알파)) / 알파
    k = np.maximum(al, 1e-3)[..., None]
    rgb = np.clip((a - bg * (1 - k)) / k, 0, 255)
    out = np.dstack([rgb, al * 255]).astype(np.uint8)
    return Image.fromarray(out, 'RGBA')


def cut(sid, path):
    im = Image.open(path)
    rgba = global_key(im) if sid in GLOBAL_KEY else MU.matte2(im)
    al = np.asarray(rgba.getchannel('A'))
    ys, xs = np.nonzero(al > 8)
    if not len(xs):
        raise SystemExit(f'{sid}: 알파가 비었다 — {path}')
    return rgba.crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))


def bleed(rgba, passes=10):
    """투명 픽셀 색을 이웃 불투명 색으로 채운다(알파는 그대로) — 밉맵·선형 거르기에서 흰/검은 테두리가 안 생기게."""
    a = np.asarray(rgba).astype(np.float32)
    rgb, al = a[..., :3], a[..., 3:] / 255.0
    have = (al > 0.5).astype(np.float32)
    acc = rgb * have
    for _ in range(passes):
        im_c = Image.fromarray(np.clip(acc, 0, 255).astype(np.uint8), 'RGB').filter(ImageFilter.BoxBlur(2))
        im_w = Image.fromarray((have[..., 0] * 255).astype(np.uint8), 'L').filter(ImageFilter.BoxBlur(2))
        c = np.asarray(im_c).astype(np.float32)
        wgt = np.asarray(im_w).astype(np.float32)[..., None] / 255.0
        fill = np.where(wgt > 1e-3, c / np.maximum(wgt, 1e-3), 0)
        newly = (have == 0) & (wgt > 1e-3)
        acc = np.where(newly, fill * 1.0, acc)
        have = np.maximum(have, newly.astype(np.float32))
    rgb = np.where(al > 0.5, rgb, acc)
    return Image.fromarray(np.dstack([np.clip(rgb, 0, 255), al * 255]).astype(np.uint8), 'RGBA')


def normal_from(rgba, strength=2.0):
    a = np.asarray(rgba).astype(np.float32) / 255.0
    lum = (a[..., 0] * 0.3 + a[..., 1] * 0.59 + a[..., 2] * 0.11) * a[..., 3]
    hgt = np.asarray(Image.fromarray((lum * 255).astype(np.uint8), 'L').filter(ImageFilter.GaussianBlur(1.2))).astype(np.float32) / 255.0
    dx = np.zeros_like(hgt)
    dy = np.zeros_like(hgt)
    dx[:, 1:-1] = (hgt[:, 2:] - hgt[:, :-2]) * 0.5
    dy[1:-1, :] = (hgt[2:, :] - hgt[:-2, :]) * 0.5
    n = np.dstack([-dx * strength, dy * strength, np.ones_like(hgt)])      # OpenGL(+Y 위) — glTF 와 같다
    n /= np.linalg.norm(n, axis=2, keepdims=True)
    return Image.fromarray(((n * 0.5 + 0.5) * 255).astype(np.uint8), 'RGB')


def main():
    sys.stdout.reconfigure(encoding='utf-8')
    picks = json.load(open(os.path.join(ROOT, arg('--picks', 'tools/world-forge/data/k104_picks.json')), encoding='utf-8'))
    out = os.path.join(ROOT, arg('--out', 'saga-assets/world/foliage/_atlas'))
    os.makedirs(out, exist_ok=True)
    atlas = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    cells = {}
    inputs = []
    for i, sid in enumerate(SLOTS):
        if sid not in picks:
            raise SystemExit(f'고른 그림 없음: {sid}')
        src = os.path.join(ROOT, picks[sid])
        part = cut(sid, src)
        cx, cy = (i % 4) * CW, (i // 4) * CH
        k = min((CW - 2 * PAD) / part.width, (CH - 2 * PAD) / part.height)
        pw, ph = max(1, round(part.width * k)), max(1, round(part.height * k))
        part = part.resize((pw, ph), Image.LANCZOS)
        x0, y0 = cx + (CW - pw) // 2, cy + CH - PAD - ph          # 아래 가운데에 앉힌다(줄기 밑동 = 칸 아래)
        atlas.alpha_composite(part, (x0, y0))
        # UV(Blender·glTF 내보내기 기준: u 오른쪽, v 위 — 그림 위쪽이 v=1)
        cells[sid] = {'uv': [x0 / W, 1 - (y0 + ph) / H, (x0 + pw) / W, 1 - y0 / H], 'aspect': round(pw / ph, 4)}
        lic_p = os.path.splitext(src)[0] + '.license.json'
        inputs.append({'slot': sid, 'file': picks[sid].replace('\\', '/'),
                       'license': json.load(open(lic_p, encoding='utf-8')) if os.path.exists(lic_p) else None})
        print(f'  {sid}: {part.width}x{part.height} → 칸 {i}')
    atlas = bleed(atlas)
    atlas.save(os.path.join(out, 'foliage_atlas.png'), optimize=True)
    normal_from(atlas).save(os.path.join(out, 'foliage_atlas_n.png'), optimize=True)
    json.dump({'size': [W, H], 'cells': cells}, open(os.path.join(out, 'foliage_atlas.json'), 'w', encoding='utf-8'), indent=1)
    json.dump({'id': 'foliage_atlas', 'generator': 'tools/world-forge/foliage_atlas.py', 'ticket': 'K-0104',
               'license': '자체 생성(Z-Image-Turbo Apache-2.0 출력, 상업 허용) — 남의 사진·스캔 0', 'commercial_use': True,
               'inputs': inputs}, open(os.path.join(out, 'foliage_atlas.license.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    sheet = arg('--sheet')
    if sheet:
        bg = Image.new('RGBA', (W, H), (96, 120, 80, 255))
        bg.alpha_composite(Image.open(os.path.join(out, 'foliage_atlas.png')))
        bg.convert('RGB').resize((1024, 1024)).save(sheet)
    print('ATLAS_OK', out)


if __name__ == '__main__':
    main()
