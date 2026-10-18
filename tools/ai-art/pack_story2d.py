"""K-0135 ③ — 4종횡 메이플식 2D 그림 포장: 고른 생성 그림(judge pick) → 웹 규격 타일·소품·앞 층 + .license.json.
  py tools/ai-art/pack_story2d.py <고른 폴더> [<정본 뿌리>=saga-assets/web2d]
고른 폴더에는 `<id>_vNN.png`(+`.license.json`)가 있다 — id 는 batches/_in/story_{tiles,props}_C.json 의 것:
  st_<지역>_{ground,wall,edge} · st_<묶음>_{plat,rope,ladder}(묶음 wood·stone·metal) · sp_<지역>_{lamp,sign,bush,rock,crate} · sf_<지역>_front
출력(정본, W-0296 규격):
  story-tile/story_<지역>-{ground,wall,ground_top,plat_l,plat_m,plat_r,rope,ladder}.png   48×48(plat 48×24) — 지역 10 × 8 = 80
  story-prop/story_<지역>-{lamp,sign,bush,rock,crate}.png                               96×96 알파, 발 밑 아래 가운데 — 50
  story-front/story_<지역>_front.webp                                                   1920 폭 알파, 아래 = 화면 아래 — 10
타일 이음: 땅·벽은 make_seamless(256) → 감싸 줄이기 48 · plat 가운데·땅 위 테는 가로 이음 · 밧줄·사다리는 세로 이음.
배경 걷기: 가장자리 색(중앙값)에서 이어진 비슷한 색을 지운다(sprite 규격 배경 = 연한 회녹색) · 앞 층은 위쪽 흰 하늘.
점검은 check_story2d.py. 출력 끝 줄 STORY2D_PACK n.
"""
import glob
import json
import os
import re
import sys

import numpy as np
from PIL import Image
from scipy import ndimage

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
sys.path.insert(0, HERE)
from make_seamless import seamless  # noqa: E402

GROUP = {'forest': 'wood', 'field_meadow': 'wood', 'mountain_shrine': 'wood', 'old_battlefield': 'wood',
         'cave_mouth': 'stone', 'deep_cave': 'stone', 'fire_gorge': 'stone', 'ruined_city': 'stone',
         'orbital_base': 'metal', 'sky_bridge': 'metal'}
T = 48


def picks(src):
    out = {}
    for p in sorted(glob.glob(os.path.join(src, '*_v[0-9][0-9].png'))):
        iid = re.sub(r'_v\d\d$', '', os.path.basename(p)[:-4])
        out.setdefault(iid, p)
    return out


def license_of(p, extra):
    lp = p[:-4] + '.license.json'
    lic = json.load(open(lp, encoding='utf-8')) if os.path.exists(lp) else {}
    lic.update(extra)
    lic['packed_by'] = 'tools/ai-art/pack_story2d.py (K-0135)'
    return lic


def save(im, path, lic, src):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    if path.endswith('.webp'):
        im.save(path, 'WEBP', quality=90, method=6)
    else:
        im.save(path)
    lic = dict(lic, id=os.path.splitext(os.path.basename(path))[0], size=list(im.size), source=os.path.basename(src))
    json.dump(lic, open(os.path.splitext(path)[0] + '.license.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)


def cut_bg(im, tol=34, keep_ratio=0.04, holes=0.0):
    """가장자리 색에서 이어진 비슷한 색을 지운다 → RGBA. 떠 있는 작은 덩어리(가장 큰 것의 keep_ratio 미만)도 지운다.
    holes > 0 이면 가장자리와 안 이어진 배경색 칸도(넓이 ≥ 그림의 holes 비율) 지운다 — 사다리 가로대 사이처럼 갇힌 배경(K-0135)."""
    a = np.asarray(im.convert('RGB')).astype(np.int16)
    border = np.concatenate([a[0], a[-1], a[:, 0], a[:, -1]])
    bg = np.median(border, axis=0)
    near = np.abs(a - bg).max(axis=2) <= tol
    lab, _ = ndimage.label(near)
    edge_labels = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    bgmask = np.isin(lab, list(edge_labels))
    if holes > 0:
        sizes0 = ndimage.sum(np.ones_like(lab), lab, range(1, lab.max() + 1))
        big = [i + 1 for i, z in enumerate(sizes0) if z >= holes * lab.size]
        bgmask |= np.isin(lab, big)
    fg = ~bgmask
    lab2, n = ndimage.label(fg, structure=np.ones((3, 3)))
    if n > 1:
        sizes = ndimage.sum(np.ones_like(lab2), lab2, range(1, n + 1))
        keep = [i + 1 for i, z in enumerate(sizes) if z >= keep_ratio * sizes.max()]
        fg = np.isin(lab2, keep)
    alpha = ndimage.gaussian_filter(fg.astype(np.float32), 0.7)
    rgba = np.dstack([a.astype(np.uint8), (np.clip(alpha, 0, 1) * 255).astype(np.uint8)])
    return Image.fromarray(rgba, 'RGBA')


def crop_alpha(im, thr=24):
    bb = im.getchannel('A').point(lambda v: 255 if v > thr else 0).getbbox()
    return im.crop(bb) if bb else im


def wrap_resize(im, w, h, pad=16):
    """감싸 덧대고 줄인 뒤 잘라 — 이음매가 줄이기에서 깨지지 않게."""
    a = np.asarray(im)
    big = np.pad(a, ((pad, pad), (pad, pad)) + ((0, 0),) * (a.ndim - 2), mode='wrap')
    sx, sy = w / im.width, h / im.height
    r = Image.fromarray(big).resize((round(big.shape[1] * sx), round(big.shape[0] * sy)), Image.LANCZOS)
    px, py = round(pad * sx), round(pad * sy)
    return r.crop((px, py, px + w, py + h))


def wrap_x(im, band=0.25):
    """가로로 이어지게 — 왼·오른 끝 띠를 반 바퀴 민 판과 섞는다(알파 포함)."""
    a = np.asarray(im).astype(np.float32)
    w = a.shape[1]
    r = np.roll(a, w // 2, axis=1)
    t = np.arange(w, dtype=np.float32)
    f = np.clip(1 - np.minimum(t, w - 1 - t) / (band * w), 0, 1)
    f = (f * f * (3 - 2 * f))[None, :, None]
    return Image.fromarray(np.clip(a * (1 - f) + r * f, 0, 255).astype(np.uint8), im.mode)


def wrap_y(im, band=0.25):
    return wrap_x(im.transpose(Image.TRANSPOSE), band).transpose(Image.TRANSPOSE)


def tile_texture(p):
    return wrap_resize(seamless(Image.open(p), 256), T, T).convert('RGB')


def edge_strip(p, h=14):
    s = crop_alpha(cut_bg(Image.open(p)))
    s = s.resize((T * 4, max(4, round(s.height * T * 4 / s.width))), Image.LANCZOS)
    s = wrap_x(s)
    return s.resize((T, max(4, min(h, round(s.height * T / s.width) or h))), Image.LANCZOS)


def plat_parts(p):
    s = crop_alpha(cut_bg(Image.open(p))).resize((T * 3, T // 2), Image.LANCZOS)
    l, m, r = (s.crop((i * T, 0, (i + 1) * T, T // 2)) for i in range(3))
    return l, wrap_x(m, 0.3), r


def vertical_piece(p, holes=0.0):
    s = crop_alpha(cut_bg(Image.open(p), holes=holes))   # 사다리만 갇힌 칸 지움 — 밝은 밧줄·발판은 속살까지 지워진다
    s = s.resize((max(8, round(s.width * (T * 3) / s.height)), T * 3), Image.LANCZOS)
    mid = s.crop((0, T, s.width, T * 2))
    if holes:   # 사다리 — 가로대 간격이 T 로 안 나뉘면 위·아래 줄이 달라 이음이 깨진다 → 위아래 줄이 같은 창(높이 0.7~1.3T)을 찾아 T 로
        a = np.asarray(s).astype(np.float32)
        best = None
        for h in range(round(T * 0.7), round(T * 1.3) + 1):
            for y in range(T // 2, s.height - h - T // 2):
                d = np.abs(a[y] - a[y + h]).mean()
                if best is None or d < best[0]:
                    best = (d, y, h)
        if best:
            mid = s.crop((0, best[1], s.width, best[1] + best[2])).resize((s.width, T), Image.LANCZOS)
    cv = Image.new('RGBA', (T, T), (0, 0, 0, 0))
    k = min(1.0, (T - 4) / mid.width)
    mid = mid.resize((max(1, round(mid.width * k)), T), Image.LANCZOS)
    cv.alpha_composite(mid, ((T - mid.width) // 2, 0))
    return wrap_y(cv, 0.3)


def prop(p, S=96):
    c = crop_alpha(cut_bg(Image.open(p)))
    k = (S - 6) / max(c.size)
    c = c.resize((max(1, round(c.width * k)), max(1, round(c.height * k))), Image.LANCZOS)
    cv = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    cv.alpha_composite(c, ((S - c.width) // 2, S - 2 - c.height))
    return cv


def front_strip(im, W=1920, H=200, overlap=0.08):
    """K-0135 ②-b 다시 — sprite 규격 가로 띠(회녹 바탕): 바탕 지우기 → 높이 H 로 → 조금씩 겹쳐 W 까지 되풀이
    (좌우 섞기는 이음 자리에 흐린 잔상을 남겨 안 씀). 아래 띠는 불투명 — 열마다 가장 아래 잎 밑(아래 24줄 안)을 아래 30줄 중앙색 하나로
    채운다(열마다 제 색을 끌어내리면 세로 줄무늬가 생김). 맨 아래 6줄은 언제나 불투명."""
    c = crop_alpha(cut_bg(im, holes=0.002))
    c = c.resize((max(8, round(c.width * H / c.height)), H), Image.LANCZOS)
    ca = np.asarray(c).copy()                        # 왼끝 겹침 폭만큼 투명으로 흐림 — 원본 가장자리에서 잘린 잎이 세로선으로 안 보이게
    fw = max(2, round(c.width * overlap))
    ca[:, :fw, 3] = (ca[:, :fw, 3] * np.linspace(0, 1, fw)[None, :]).astype(np.uint8)
    c = Image.fromarray(ca, 'RGBA')
    step = max(1, round(c.width * (1 - overlap)))
    out = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    x = -round(c.width * overlap / 2)
    while x < W:
        out.alpha_composite(c, (x, 0)) if x >= 0 else out.alpha_composite(c.crop((-x, 0, c.width, H)), (0, 0))
        x += step
    a = np.asarray(out).copy()
    al = a[..., 3] > 128
    low = a[H - 30:][al[H - 30:]][:, :3]
    base = (np.median(low, axis=0) if len(low) else np.array([90, 110, 80])).astype(np.uint8)
    ys = np.where(al.any(axis=0), H - 1 - np.argmax(al[::-1], axis=0), H - 6)
    for x in range(W):
        y = min(max(int(ys[x]) + 1, H - 24), H - 6)   # 아래 24줄 안에서만 — 떨어진 관목 머리 밑까지 칠하면 덩어리가 된다
        a[y:, x, :3] = base
        a[y:, x, 3] = 255
    return Image.fromarray(a, 'RGBA')


def front(p, W=1920):
    im = Image.open(p).convert('RGB')
    if im.width >= 2.5 * im.height:                   # 가로 띠(story_fronts_C 1536×512) — 옛 bg 규격(1216×640, 위 흰 하늘)과 비율로 가름
        return front_strip(im, W)
    a = np.asarray(im).astype(np.int16)
    sky = (a.min(axis=2) >= 225)                       # 흰 하늘
    lab, _ = ndimage.label(sky)
    top = set(np.unique(lab[0])) - {0}
    fg = ~np.isin(lab, list(top))
    alpha = ndimage.gaussian_filter(fg.astype(np.float32), 1.0)
    rgba = Image.fromarray(np.dstack([a.astype(np.uint8), (np.clip(alpha, 0, 1) * 255).astype(np.uint8)]), 'RGBA')
    ys = np.where(fg.any(axis=1))[0]
    y0 = int(ys.min()) if len(ys) else 0
    band = rgba.crop((0, max(0, y0 - 6), rgba.width, rgba.height))             # 위 여백 6px(풀끝이 잘리지 않게)
    band = band.resize((W, max(40, round(band.height * W / band.width))), Image.LANCZOS)
    return wrap_x(band, 0.12)


def main():
    a = [x for x in sys.argv[1:] if not x.startswith('--')]
    src = os.path.abspath(a[0])
    root = os.path.abspath(a[1]) if len(a) > 1 else os.path.join(ROOT, 'saga-assets', 'web2d')
    P = picks(src)
    done, miss = 0, []
    tdir, pdir, fdir = (os.path.join(root, d) for d in ('story-tile', 'story-prop', 'story-front'))
    grp_parts = {}
    for g in ('wood', 'stone', 'metal'):
        parts = {}
        if f'st_{g}_plat' in P:
            parts['plat_l'], parts['plat_m'], parts['plat_r'] = plat_parts(P[f'st_{g}_plat'])
        for k in ('rope', 'ladder'):
            if f'st_{g}_{k}' in P:
                parts[k] = vertical_piece(P[f'st_{g}_{k}'], 0.002 if k == 'ladder' else 0.0)
        grp_parts[g] = parts
    for reg, g in GROUP.items():
        key = 'story_' + reg
        for k in ('ground', 'wall'):
            iid = f'st_{reg}_{k}'
            if iid in P:
                save(tile_texture(P[iid]), os.path.join(tdir, f'{key}-{k}.png'), license_of(P[iid], {'kind': 'tile'}), P[iid]); done += 1
            else:
                miss.append(iid)
        gi, ei = f'st_{reg}_ground', f'st_{reg}_edge'
        if gi in P and ei in P:
            top = tile_texture(P[gi]).convert('RGBA')
            top.alpha_composite(edge_strip(P[ei]), (0, 0))
            save(top, os.path.join(tdir, f'{key}-ground_top.png'), license_of(P[ei], {'kind': 'tile', 'base': os.path.basename(P[gi])}), P[ei]); done += 1
        else:
            miss.append(ei)
        for k, im in grp_parts[g].items():
            save(im, os.path.join(tdir, f'{key}-{k}.png'), license_of(P[f"st_{g}_{k.split('_')[0]}"], {'kind': 'tile', 'group': g}), P[f"st_{g}_{k.split('_')[0]}"]); done += 1
        for k in ('lamp', 'sign', 'bush', 'rock', 'crate'):
            iid = f'sp_{reg}_{k}'
            if iid in P:
                save(prop(P[iid]), os.path.join(pdir, f'{key}-{k}.png'), license_of(P[iid], {'kind': 'prop'}), P[iid]); done += 1
            else:
                miss.append(iid)
        iid = f'sf_{reg}_front'
        if iid in P:
            save(front(P[iid]), os.path.join(fdir, f'{key}_front.webp'), license_of(P[iid], {'kind': 'front'}), P[iid]); done += 1
        else:
            miss.append(iid)
    if miss:
        print('빠짐', len(miss), ', '.join(miss[:20]))
    print('STORY2D_PACK', done)


if __name__ == '__main__':
    main()
