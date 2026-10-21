"""K-0164 — 4종횡 옆보기 사냥터: 세로 폰 화면용 겹 배경 4층(하늘·먼·가까운·앞, 제 해상도 2016×1152) + 발판 타일 128px(윗면·옆면·끝 두 쪽).

  py tools/ai-art/side_layers.py batch                 # 키트 입력 batches/_in/k163_side_layers.json → batches/k163_side_layers.json(+ hires 1.5 = 2016×1152)
  (원격) py tools/ai-art/remote/push_batch.py tools/ai-art/batches/k163_side_layers.json --state tools/ai-art/_out/k164.st
  py tools/ai-art/side_layers.py contact               # 후보 맞대기 _out/side2d/_contact_<n>.jpg (Claude 눈으로 고름)
  py tools/ai-art/side_layers.py pick field_meadow=1,forest=2,…   # → data/k164_side_picks.json
  py tools/ai-art/side_layers.py prep                  # 깊이(Depth Anything V2 Small) · 문턱 마스크 3 → batches/k164_side_inpaint.json(뒤판 인페인트)
  (원격) push_batch.py tools/ai-art/batches/k164_side_inpaint.json
  py tools/ai-art/side_layers.py split [장소,…]        # 층 4 → saga-assets/web2d/bg2d/story_<장소>/{sky,far,near,front}.webp + layers.json + license
  py tools/ai-art/side_layers.py tiles                 # 발판 타일 → saga-assets/web2d/side-tile/side_<장소>/{top,side,end_l,end_r}.webp + tiles.json
  py tools/ai-art/side_layers.py match [장소,…]        # K-0165 발판 명도·채도를 배경 near 층에 맞춤(tiles 가 TILE_MATCH 곳은 자동)
  py tools/ai-art/side_layers.py calm [장소,…]         # K-0171 먼 층에서 near 능선 패임으로 보이는 띠의 어두운 조각(떠 보이는 바위)만 지움(CALM 곳)
  py tools/ai-art/side_layers.py sheet                 # 시험판 _out/side2d/prev/<장소>.png(390×844 세로 두 자리 + 1280×720) · tiles_<n>.png · 이음 수치
  py tools/ai-art/side_layers.py check                 # 규격·파일·해상도·이음 → SIDE2D_OK

층 = K-0150 길(한 장면을 깊이로 가르고, 층 k 그림 = 문턱 k+1 보다 가까운 것을 지운 인페인트 뒤판 · 알파 = 문턱 k 보다 가까운 곳 · 맨 앞만 원본 픽셀).
  다른 점: 원본이 2016×1152(1344×768 + hires) — 세로 844 화면을 키우지 않는다. 인페인트는 1344×768 로 돌리고 마스크 안만 키워 붙인다(마스크 밖 = 원본 고해상).
  층마다 알파 있는 줄만 잘라 top/h 로 적는다(용량). 가로 이음 = 엔진 규칙(홀수 칸 좌우 뒤집기)이라 경계 픽셀이 같다 — sheet 가 엔진 식으로 이어 재 본다.
깊이 모델은 도구 전용(~/.depth/dav2s.onnx, Apache-2.0) — 게임엔 안 들어감.
"""
import json
import os
import subprocess
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
sys.path.insert(0, HERE)

GROUNDS = ['field_meadow', 'forest', 'cave_mouth', 'deep_cave', 'mountain_shrine', 'sky_bridge', 'fire_gorge', 'old_battlefield', 'ruined_city', 'orbital_base']
OUT = os.path.join(HERE, '_out', 'side2d')
INP = os.path.join(HERE, '_out', 'side2d_inp')
PICKS = os.path.join(HERE, 'data', 'k164_side_picks.json')
CANON = os.path.join(ROOT, 'saga-assets', 'web2d', 'bg2d')
TCANON = os.path.join(ROOT, 'saga-assets', 'web2d', 'side-tile')
FRINGE = {'forest', 'cave_mouth', 'deep_cave'}
TSRC = os.path.join(HERE, '_out', 'k135_pick')          # K-0135 그림체 C 땅·테 원본(768²)
BATCH_IN = os.path.join(HERE, 'batches', '_in', 'k163_side_layers.json')
BATCH = os.path.join(HERE, 'batches', 'k163_side_layers.json')
BATCH_INP = os.path.join(HERE, 'batches', 'k164_side_inpaint.json')
FW, FH = 2016, 1152          # 원본(= 층) 크기
GW, GH = 1344, 768           # 생성·인페인트 크기
# 이름, 깊이 문턱(가까움 분위수), 엔진 depth(빠르기)
LAYERS = [('sky', None, 0.04), ('far', 0.40, 0.2), ('near', 0.65, 0.5), ('front', 0.85, 0.9)]
T = 128
# K-0165 장소별 층 가르기 손잡이 — min = 떠다니는 조각 문턱(넓이 비율), ground = 아래 띠(높이 비율)에 닿는 덩어리만 앞 층에 남김
SPLIT_OPT = {'deep_cave': {'min': 0.02, 'ground': 0.25}, 'forest': {'min': 0.02, 'ground': 0.25}}   # 옛 싸움터는 K-0165 △ — 거름 넣어도 먼 산 끝이 앞 능선 위로 떠 보임, 옛 것 유지
TILE_MATCH = {'mountain_shrine': (0.6, 0.6, 0.6), 'orbital_base': (0.9, 1.0, 0.45)}   # (명도·채도 몫, 평균 색 몫, 색 퍼짐 배율)   # K-0165 발판 색 맞춤(배경보다 옅던 두 곳) — tiles 뒤에 match_tiles
TOOL = 'K-0164 tools/ai-art/side_layers.py'


def rel(p):
    return os.path.relpath(p, ROOT).replace(os.sep, '/')


def picks():
    return json.load(open(PICKS, encoding='utf-8'))


def pick_path(g):
    return os.path.join(OUT, f'sl_{g}_v{picks()[g]:02d}.png')


def lic_of(p):
    lp = p[:-4] + '.license.json'
    return json.load(open(lp, encoding='utf-8')) if os.path.exists(lp) else {}


# ── 1 배치 ──
def batch():
    r = subprocess.run([sys.executable, os.path.join(HERE, 'prompt_kit.py'), 'build', BATCH_IN, '--out', BATCH], capture_output=True, text=True, encoding='utf-8', errors='replace')
    print(r.stdout[-400:], r.stderr[-400:])
    b = json.load(open(BATCH, encoding='utf-8'))
    b['defaults'].update(hr=1.5, hr_denoise=0.42, hr_steps=16)
    b['note'] = 'K-0164 4종횡 사냥터 장면(그림체 C) — 1344x768 + hires 1.5 = 2016x1152, side_layers.py 가 깊이로 4층을 가른다'
    json.dump(b, open(BATCH, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print('BATCH', rel(BATCH), len(b['items']))


def contact():
    ims = []
    for g in GROUNDS:
        row = []
        for v in (1, 2, 3, 4):
            p = os.path.join(OUT, f'sl_{g}_v{v:02d}.png')
            if os.path.exists(p):
                row.append((v, Image.open(p).convert('RGB').resize((672, 384), Image.LANCZOS)))
        ims.append((g, row))
    per = 5
    for n in range(0, len(ims), per):
        part = ims[n:n + per]
        cw = 672 * max(len(r) for _g, r in part) + 8
        can = Image.new('RGB', (cw, 400 * len(part)), (30, 30, 30))
        dr = ImageDraw.Draw(can)
        for i, (g, row) in enumerate(part):
            for j, (v, im) in enumerate(row):
                can.paste(im, (j * 676, i * 400 + 14))
                dr.text((j * 676 + 4, i * 400), f'{g} v{v}', fill=(255, 255, 0))
        p = os.path.join(OUT, f'_contact_{n // per + 1}.jpg')
        can.save(p, quality=85)
        print('CONTACT', p)


def pick(arg):
    d = {}
    for kv in arg.split(','):
        k, v = kv.split('=')
        d[k.strip()] = int(v)
    old = picks() if os.path.exists(PICKS) else {}
    old.update(d)
    json.dump(old, open(PICKS, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print('PICKS', old)


# ── 2 깊이·인페인트 배치 ──
def cuts(d):
    return np.maximum(np.quantile(d, [t for _n, t, _s in LAYERS if t is not None]), 0.02)   # 하늘이 40% 넘으면 분위수가 0 → 마스크가 전부가 됨


def prep(ids=None):
    from pack_bg2d import depth
    os.makedirs(INP, exist_ok=True)
    items = []
    model = None
    for g in ids or list(picks()):
        src = pick_path(g)
        lic = lic_of(src)
        model = model or lic.get('model', 'animagine-xl-4.0-opt')
        im = Image.open(src).convert('RGB')
        d = depth(im)
        np.save(os.path.join(INP, g + '__depth.npy'), d.astype(np.float16))
        im.resize((GW, GH), Image.LANCZOS).save(os.path.join(INP, g + '__src.png'))
        for k, t in enumerate(cuts(d), 1):
            m = Image.fromarray(((d >= t) * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(17)).filter(ImageFilter.GaussianBlur(5))
            mp = os.path.join(INP, f'{g}__mask{k}.png')
            m.save(mp)                                       # 고해상 — split 이 붙일 때 쓴다
            m.resize((GW, GH), Image.LANCZOS).save(mp[:-4] + '_s.png')
            items.append({'id': f'{g}__m{k}', 'prompt': lic['prompt'], 'negative': lic.get('negative_prompt', '') + ', object, pillar, post, statue',
                          'seed': int(lic.get('seed', 1)) + k, 'init_image': rel(os.path.join(INP, g + '__src.png')),
                          'mask_image': rel(mp[:-4] + '_s.png'), 'denoise': 1.0})
        print('PREP', g, [round(float(v), 3) for v in cuts(d)])
    b = {'model': model, 'out': 'side2d_inp', 'note': 'K-0164 겹 배경 뒤판 — 깊이 문턱보다 가까운 것을 지우고 다시 그림(원본 프롬프트, 마스크 안만)',
         'defaults': {'prompt_prefix': '', 'width': GW, 'height': GH, 'steps': 28, 'cfg': 6.0, 'sampler': 'Euler a', 'negative': '', 'variants': 1}, 'items': items}
    json.dump(b, open(BATCH_INP, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print('BATCH', rel(BATCH_INP), len(items))


# ── 3 층 가르기 ──
def inp_result(g, k):
    for n in (f'{g}__m{k}_v01.png', f'{g}__m{k}.png'):
        p = os.path.join(HERE, '_out', 'side2d_inp', n)
        if os.path.exists(p):
            return p
    raise FileNotFoundError(f'{g}__m{k} 인페인트 결과 없음')


def split(ids=None):
    for g in ids or list(picks()):
        src = pick_path(g)
        P = np.asarray(Image.open(src).convert('RGB')).astype(np.float32)
        d = np.load(os.path.join(INP, g + '__depth.npy')).astype(np.float32)
        q = cuts(d)
        out = os.path.join(CANON, 'story_' + g)
        os.makedirs(out, exist_ok=True)
        lic0 = lic_of(src)
        meta = {'layers': []}
        for i, (name, t, spd) in enumerate(LAYERS):
            if i < len(q):
                ip = inp_result(g, i + 1)
                up = np.asarray(Image.open(ip).convert('RGB').resize((FW, FH), Image.LANCZOS)).astype(np.float32)
                m = np.asarray(Image.open(os.path.join(INP, f'{g}__mask{i + 1}.png')).convert('L')).astype(np.float32)[..., None] / 255
                pic = P * (1 - m) + up * m                   # 마스크 밖 = 원본 고해상
            else:
                pic = P.copy()
            pic = Image.fromarray(np.clip(pic, 0, 255).astype(np.uint8))
            top, hh = 0.0, 1.0
            if t is not None:
                from scipy import ndimage
                fg = d >= q[i - 1]
                lab, n = ndimage.label(fg)                      # 떠다니는 작은 조각(0.4% 미만)은 뺀다 — 카메라가 움직이면 혼자 미끄러지는 얼룩이 된다(10-21 눈)
                opt = SPLIT_OPT.get(g, {})
                if n > 1:
                    sz = ndimage.sum(np.ones_like(lab), lab, range(1, n + 1))
                    fg = np.isin(lab, [k + 1 for k, z in enumerate(sz) if z >= opt.get('min', 0.004) * fg.size])
                if opt.get('ground'):                           # K-0165: 바닥(아래 띠)에 닿는 덩어리만 — 천장·하늘에 걸린 조각은 뒤판(느린 층)에 둔다
                    lab, n = ndimage.label(fg)
                    keep = set(np.unique(lab[-round(FH * opt['ground']):])) - {0}
                    fg = np.isin(lab, list(keep))
                if opt.get('open'):                             # K-0165: 층 윤곽 위로 삐죽 솟은 좁은 것(작은 바위·가지)을 깎음 — 층이 미끄러지면 혼자 떠 보인다
                    r = opt['open'] // 2
                    yy, xx = np.mgrid[-r:r + 1, -r:r + 1]
                    fg = ndimage.binary_opening(fg, structure=(xx * xx + yy * yy) <= r * r)
                a = Image.fromarray((fg * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(5)).filter(ImageFilter.GaussianBlur(2))
                pic = pic.convert('RGBA')
                pic.putalpha(a)
                rows = np.where(np.asarray(a).max(axis=1) > 8)[0]
                y0 = max(0, int(rows.min()) - 2) if len(rows) else 0
                pic = pic.crop((0, y0, FW, FH))
                top, hh = round(y0 / FH, 4), round((FH - y0) / FH, 4)
            pic.save(os.path.join(out, name + '.webp'), 'WEBP', quality=82, method=6)
            lic = dict(lic0)
            lic.update({'id': f'story_{g}_{name}', 'size': list(pic.size), 'source_image': rel(src),
                        'packed_by': TOOL + ' — 깊이 추정 Depth Anything V2 Small(Apache-2.0, 도구 전용)으로 층 가름'
                                     + (f' · 가까움 분위수 {LAYERS[i + 1][1]} 이상을 지운 인페인트(원본 모델·프롬프트, denoise 1.0, {GW}x{GH} → 마스크 안만 키워 붙임)' if i < len(q) else ' · 원본 픽셀')
                                     + ('' if t is None else f' · 알파 = 분위수 {t} 이상'),
                        'mode': 'inpaint' if i < len(q) else 'original'})
            json.dump(lic, open(os.path.join(out, name + '.license.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
            L = {'img': name + '.webp', 'depth': spd, 'top': top, 'h': hh}
            meta['layers'].append(L)
        json.dump(meta, open(os.path.join(out, 'layers.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
        print('SPLIT', g, [round(float(v), 3) for v in q])


# ── 4 발판 타일 ──
def _fringe(ep, width, height_max):
    """테 그림(sprite 규격 가로 띠) → 바탕(위 하늘·아래 흰 땅) 둘 다 지운 풀·이끼 덩어리 → 가로 이음 띠."""
    from scipy import ndimage
    from pack_story2d import crop_alpha, cut_bg, wrap_x
    im = Image.open(ep).convert('RGB')
    rgba = np.asarray(cut_bg(im)).copy()
    a = rgba[..., :3].astype(np.int16)
    low = np.median(a[-6:].reshape(-1, 3), axis=0)              # 아래 흰 땅 색
    near = np.abs(a - low).max(axis=2) <= 40
    lab, _ = ndimage.label(near)
    bl = set(np.unique(lab[-1])) - {0}
    rgba[np.isin(lab, list(bl)), 3] = 0
    s = crop_alpha(Image.fromarray(rgba, 'RGBA'))
    h = max(8, min(height_max, round(s.height * width / s.width)))
    s = s.resize((width, h), Image.LANCZOS)
    return wrap_x(s, 0.08)


def _cut_end(cells, rng):
    """칸마다 바깥쪽(왼쪽) 물결 + 위 모서리 둥글림 + 가장자리 그늘."""
    Y, X = np.mgrid[0:T, 0:T].astype(np.float32)
    out = np.zeros_like(cells)
    for c in range(cells.shape[1] // T):
        wav = 9 + 3.5 * np.sin(np.arange(T) / 10.0 + rng.uniform(0, 6)) + 1.5 * np.sin(np.arange(T) / 4.1 + rng.uniform(0, 6))
        r = 30.0
        cx, cy = float(wav[0]) + r, r
        a = np.clip(X - wav[:, None] + 0.5, 0, 1)
        corner = (X < cx) & (Y < cy)
        a = np.where(corner, np.clip(r - np.sqrt((X - cx) ** 2 + (Y - cy) ** 2) + 0.5, 0, 1) * a, a)
        cell = cells[:, c * T:(c + 1) * T].copy()
        cell[..., :3] *= (0.7 + 0.3 * np.clip((X - wav[:, None]) / 16.0, 0, 1))[..., None]
        cell[..., 3] *= a
        out[:, c * T:(c + 1) * T] = cell
    return out


def heal(im, axes=(0, 1)):
    """감싼 이음 줄만 살짝 흐림 — make_seamless 의 섞임 띠가 이음 줄 바로 옆을 거칠게 남겨 줄이 비친다(10-21 측정, 산 사당 세로 18 vs 이웃 10)."""
    from scipy import ndimage
    a = np.asarray(im).astype(np.float32)
    for ax in axes:
        n = a.shape[ax]
        r = np.roll(a, n // 2, axis=ax)
        b = ndimage.gaussian_filter1d(r, 2.2, axis=ax, mode='wrap')
        i = np.arange(n, dtype=np.float32) - (n // 2 - 0.5)
        w = np.exp(-(i / 5.0) ** 2)
        w = w[:, None, None] if ax == 0 else w[None, :, None]
        a = np.roll(r * (1 - w) + b * w, -(n // 2), axis=ax)
    return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8), im.mode)


def _lab(rgb):
    c = rgb / 255.0
    c = np.where(c > 0.04045, ((c + 0.055) / 1.055) ** 2.4, c / 12.92)
    xyz = c @ np.array([[0.4124, 0.3576, 0.1805], [0.2126, 0.7152, 0.0722], [0.0193, 0.1192, 0.9505]]).T / np.array([0.95047, 1.0, 1.08883])
    f = np.where(xyz > 0.008856, np.cbrt(xyz), 7.787 * xyz + 16 / 116)
    return np.stack([116 * f[..., 1] - 16, 500 * (f[..., 0] - f[..., 1]), 200 * (f[..., 1] - f[..., 2])], -1)


def _rgb(lab):
    fy = (lab[..., 0] + 16) / 116
    f = np.stack([fy + lab[..., 1] / 500, fy, fy - lab[..., 2] / 200], -1)
    xyz = np.where(f > 0.2069, f ** 3, (f - 16 / 116) / 7.787) * np.array([0.95047, 1.0, 1.08883])
    c = xyz @ np.array([[3.2406, -1.5372, -0.4986], [-0.9689, 1.8758, 0.0415], [0.0557, -0.2040, 1.0570]]).T
    c = np.where(c > 0.0031308, 1.055 * np.clip(c, 0, None) ** (1 / 2.4) - 0.055, 12.92 * c)
    return np.clip(c * 255, 0, 255)


def _lab_stats(ims):
    """알파 가중 평균 L · 채도(C) — ims = RGBA 배열들."""
    L, C, A, B, W = 0.0, 0.0, 0.0, 0.0, 0.0
    for a in ims:
        w = a[..., 3] / 255.0
        lab = _lab(a[..., :3].astype(np.float64))
        L += float((lab[..., 0] * w).sum())
        C += float((np.hypot(lab[..., 1], lab[..., 2]) * w).sum())
        A += float((lab[..., 1] * w).sum())
        B += float((lab[..., 2] * w).sum())
        W += float(w.sum())
    return L / W, C / W, A / W, B / W


def match_tiles(g, k=None):
    """K-0165: 발판 타일 명도·채도(+ 평균 색 kh 몫)를 그 장소 배경 near 층 평균(알파 가중 Lab)에 끌어온다 — 결은 그대로.
    TILE_MATCH[g] = (명도·채도 몫, 평균 색 몫). 네 장(top·side·end_l·end_r)에 같은 변환."""
    k, kh, var = TILE_MATCH.get(g, (0.7, 0.0, 1.0)) if k is None else (k, 0.0, 1.0)
    td = os.path.join(TCANON, 'side_' + g)
    near = np.asarray(Image.open(os.path.join(CANON, 'story_' + g, 'near.webp')).convert('RGBA')).astype(np.float64)
    names = ('top', 'side', 'end_l', 'end_r')
    arr = {n: np.asarray(Image.open(os.path.join(td, n + '.webp')).convert('RGBA')).astype(np.float64) for n in names}
    nL, nC, nA, nB = _lab_stats([near])
    tL, tC, tA, tB = _lab_stats([arr['side'], arr['top']])
    dL = (nL - tL) * k
    sC = (1 + (nC / max(tC, 1e-3) - 1) * k)
    for n in names:
        a = arr[n]
        lab = _lab(a[..., :3])
        lab[..., 0] = np.clip(lab[..., 0] + dL, 0, 100)
        lab[..., 1] = tA * sC + (lab[..., 1] - tA) * sC * var   # var < 1 = 무지개처럼 퍼진 색을 평균 쪽으로 모음
        lab[..., 2] = tB * sC + (lab[..., 2] - tB) * sC * var
        lab[..., 1] += (nA - tA * sC) * kh           # kh = 색 기울기 몫(0 = 색상 그대로) — 궤도 기지는 남빛 배경에 무지개 파스텔이 튀어 끌어옴
        lab[..., 2] += (nB - tB * sC) * kh
        a[..., :3] = _rgb(lab)
        Image.fromarray(np.clip(a, 0, 255).astype(np.uint8), 'RGBA').save(os.path.join(td, n + '.webp'), 'WEBP', quality=90, method=6)
        lp = os.path.join(td, n + '.license.json')
        lic = json.load(open(lp, encoding='utf-8'))
        lic['color_match'] = f'K-0165 배경 near 층 평균에 명도·채도 {k:.0%}·평균 색 {kh:.0%} 끌어옴·색 퍼짐 ×{var}(L {tL:.1f}→{tL + dL:.1f}, 채도 ×{sC:.2f}, 결은 그대로)'
        json.dump(lic, open(lp, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print('MATCH', g, f'near L{nL:.1f} C{nC:.1f} · tile L{tL:.1f} C{tC:.1f} → dL {dL:+.1f} C×{sC:.2f} · 색 {kh:.0%} 퍼짐 ×{var} (near a{nA:.1f} b{nB:.1f})')


def tiles(ids=None):
    """칸 128 · 그림은 4칸 묶음(가로 이음 512) — 웹은 세계 칸 x mod 4(옆면은 y mod 4 도)로 그 칸을 고른다 → 반복 무늬가 4칸에 한 번.
    top 512×128 · side 512×512 · end_l/end_r 512×128(칸 k = top 칸 k 의 바깥쪽을 둥글게 자른 것 — 이웃 top 칸과 그대로 이어짐)."""
    import glob
    from make_seamless import seamless
    from pack_story2d import wrap_x

    def src(g, k):
        return sorted(glob.glob(os.path.join(TSRC, f'st_{g}_{k}_v[0-9][0-9].png')))[0]

    N = 4
    W = T * N
    for g in ids or GROUNDS:
        gp, ep = src(g, 'ground'), src(g, 'edge')
        side = heal(seamless(Image.open(gp), W, flatten=0.5).convert('RGB'))
        fr = _fringe(ep, W, round(T * 0.36)) if g in FRINGE else None   # 테 그림이 풀·이끼·수정 덩어리인 곳만 — 나머지는 물건(밧줄·관)이 늘어져 이상함(10-21 눈)
        fh = fr.height if fr else 22
        top = np.asarray(side.crop((0, 0, W, T)).convert('RGBA')).astype(np.float32)
        yy = np.arange(T, dtype=np.float32)[:, None]
        top[..., :3] *= (1 - 0.25 * np.exp(-((yy - fh * 0.85) / (fh * 0.45)) ** 2))[..., None]
        if not fr:
            top[..., :3] = top[..., :3] + (255 - top[..., :3]) * (0.22 * (yy < fh * 0.7))[..., None]
        xs = np.arange(W, dtype=np.float32)
        lip = 6 + 2.5 * np.sin(xs * 2 * np.pi / W * 7) + 1.5 * np.sin(xs * 2 * np.pi / W * 19 + 1.3)   # 주기가 W 를 나눔 → 이음
        top[..., 3] *= np.clip(yy - lip[None, :] + 0.5, 0, 1)
        hl = np.exp(-((yy - lip[None, :] - 2) / 1.6) ** 2)[..., None]                             # 윤곽 밝은 선
        top[..., :3] = top[..., :3] * (1 - 0.35 * hl) + 255 * 0.35 * hl
        top = Image.fromarray(np.clip(top, 0, 255).astype(np.uint8), 'RGBA')
        if fr:
            top.alpha_composite(fr, (0, 0))
        top = heal(wrap_x(top, 0.03), axes=(1,))
        rng = np.random.default_rng(sum(map(ord, g)))
        end_l = Image.fromarray(np.clip(_cut_end(np.asarray(top).astype(np.float32), rng), 0, 255).astype(np.uint8), 'RGBA')
        fl = np.asarray(top.transpose(Image.FLIP_LEFT_RIGHT)).astype(np.float32)   # 오른쪽 끝 = 뒤집어 같은 일 → 다시 뒤집음
        end_r = Image.fromarray(np.clip(_cut_end(fl, rng), 0, 255).astype(np.uint8), 'RGBA').transpose(Image.FLIP_LEFT_RIGHT)
        out = os.path.join(TCANON, 'side_' + g)
        os.makedirs(out, exist_ok=True)
        for f in os.listdir(out):
            os.remove(os.path.join(out, f))
        lg, le = lic_of(gp), lic_of(ep)
        for name, im, base in (('side', side, lg), ('top', top, le), ('end_l', end_l, le), ('end_r', end_r, le)):
            im.save(os.path.join(out, name + '.webp'), 'WEBP', quality=90, method=6)
            lic = dict(base)
            lic.update({'id': f'side_{g}_{name}', 'size': list(im.size), 'source_image': rel(gp if name == 'side' else ep),
                        'base_image': rel(gp), 'packed_by': TOOL + ' — K-0135 그림체 C 땅·테 원본을 128 칸 4개 묶음으로(make_seamless · 코드 합성, GPU 안 씀)'})
            json.dump(lic, open(os.path.join(out, name + '.license.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
        json.dump({'cell': T, 'cols': N, 'top': 'top.webp', 'side': 'side.webp', 'end_l': 'end_l.webp', 'end_r': 'end_r.webp',
                   'rule': '칸 그림 = 그림 안 (세계 칸 x mod 4) 번째 칸(옆면은 y mod 4 줄도). top·end_l·end_r 는 1줄 4칸, side 는 4×4 — 이웃끼리 그대로 이어짐',
                   'note': 'top = 발판·땅 맨 윗줄(위 투명 물결 + 풀 테) · side = 그 밑 채움 · end_l = 발판 왼끝 칸, end_r = 오른끝 칸(그 자리 x mod 4 칸)'},
                  open(os.path.join(out, 'tiles.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
        print('TILES', g, fh)
        if g in TILE_MATCH:
            match_tiles(g)


# ── 5 시험판·검사 ──
def compose(g, W, H, camX=0.0):
    """parallax2d.draw 와 같은 자리 계산(dw = 그림 폭 × 층 높이/그림 높이 · 홀수 칸 좌우 뒤집기)."""
    d = os.path.join(CANON, 'story_' + g)
    meta = json.load(open(os.path.join(d, 'layers.json'), encoding='utf-8'))
    can = Image.new('RGBA', (W, H), (0, 0, 0, 255))
    for L in meta['layers']:
        im = Image.open(os.path.join(d, L['img'])).convert('RGBA')
        dh = round(L['h'] * H)
        dw = round(im.width * dh / im.height)
        im = im.resize((dw, dh), Image.LANCZOS)
        y = round(L['top'] * H)
        sx = camX * L['depth']
        n, off = int(sx // dw), int(sx % dw)
        k = 0
        while k * dw - off < W:
            t = im if (n + k) % 2 == 0 else im.transpose(Image.FLIP_LEFT_RIGHT)
            can.alpha_composite(t, (k * dw - off, y)) if k * dw - off >= 0 else can.alpha_composite(t.crop((off - k * dw, 0, dw, dh)), (0, y))
            k += 1
    return can


def seam_excess(im, axis_x=True, mirror=False):
    """이음 줄 차 − 안쪽 줄 차(K-0162 식). mirror = 엔진 규칙(다음 칸 좌우 뒤집기)."""
    a = np.asarray(im.convert('RGBA')).astype(np.float32)
    if not axis_x:
        a = a.transpose(1, 0, 2)
    rgb = a[..., :3] * (a[..., 3:4] / 255)
    nxt = rgb[:, ::-1] if mirror else rgb
    seam = np.abs(rgb[:, -1] - nxt[:, 0]).mean()
    d = np.abs(np.diff(rgb, axis=1)).mean(axis=(0, 2))
    inner = np.r_[d[:8], d[-8:]].mean()                    # 이음 양옆 8줄(그림 안 이웃 줄)과 견줌 — 전체 평균은 자리마다 결이 달라 공정하지 않다
    return float(seam - inner)


def tile_scene(g, bg):
    d = os.path.join(TCANON, 'side_' + g)
    t = {k: Image.open(os.path.join(d, k + '.webp')).convert('RGBA') for k in ('top', 'side', 'end_l', 'end_r')}
    cell = lambda k, x, y=0: t[k].crop(((x % 4) * T, (y % 4) * T, (x % 4 + 1) * T, (y % 4 + 1) * T))
    W, H = T * 10, T * 5
    can = bg.resize((W, H), Image.LANCZOS).convert('RGBA')
    for x in range(1, 7):                                       # 뜬 발판: 끝 · 윗면 · 끝 (세계 칸 x mod 4)
        k = 'end_l' if x == 1 else 'end_r' if x == 6 else 'top'
        can.alpha_composite(cell(k, x), (x * T, T // 2 + 32))
    for x in range(10):                                         # 땅: 윗면 한 줄 + 옆면 두 줄
        can.alpha_composite(cell('top', x), (x * T, H - 3 * T))
        can.alpha_composite(cell('side', x, 1), (x * T, H - 2 * T))
        can.alpha_composite(cell('side', x, 2), (x * T, H - T))
    return can


CALM = {'old_battlefield': {'dark': 22, 'grow': 6}}   # K-0171 — 장소: 어두운 정도(주변 흐림보다 밝기 몇 낮으면 조각)·마스크 넓힘(px)


def calm(g):
    """먼 층(far)에서 가까운 층(near) 능선이 오르내리는 띠(화면 높이 = near 윗선 최소~최대) 안의 어두운 조각을 주변 땅빛으로 메운다.
    near 패임 사이로 먼 봉우리 끝만 보이면 밝은 땅 위에 뜬 바위처럼 읽힌다(K-0164·K-0165 옛 싸움터 △). 원본은 _out/side2d/calm_src 에 한 번 남긴다."""
    opt = CALM[g]
    d = os.path.join(CANON, 'story_' + g)
    meta = json.load(open(os.path.join(d, 'layers.json'), encoding='utf-8'))
    Ls = {L['img']: L for L in meta['layers']}
    src = os.path.join(HERE, '_out', 'side2d', 'calm_src', g + '_far.webp')
    if not os.path.exists(src):
        os.makedirs(os.path.dirname(src), exist_ok=True)
        Image.open(os.path.join(d, 'far.webp')).save(src, 'WEBP', lossless=True)
    far = np.asarray(Image.open(src).convert('RGBA')).astype(np.float32)
    near = np.asarray(Image.open(os.path.join(d, 'near.webp')).convert('RGBA'))
    Ln, Lf = Ls['near.webp'], Ls['far.webp']
    tops = [np.argmax(near[:, x, 3] > 200) for x in range(0, near.shape[1], 8) if (near[:, x, 3] > 200).any()]
    lo = Ln['top'] + min(tops) / near.shape[0] * Ln['h']                    # 화면 높이 비
    hi = Ln['top'] + max(tops) / near.shape[0] * Ln['h']
    H = far.shape[0]
    y0 = int(max(0, (lo - Lf['top']) / Lf['h'] * H))
    y1 = int(min(H, (hi - Lf['top']) / Lf['h'] * H + 40))
    lum = far[..., :3] @ np.array([0.3, 0.59, 0.11], np.float32)
    blur = np.asarray(Image.fromarray(lum.clip(0, 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(28)), np.float32)
    mask = (blur - lum > opt['dark']) & (far[..., 3] > 200)
    band = np.zeros_like(mask); band[y0:y1] = True
    mask &= band
    m = Image.fromarray((mask * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(2 * (opt['grow'] // 2) + 1)).filter(ImageFilter.GaussianBlur(opt['grow']))
    m = np.asarray(m, np.float32)[..., None] / 255
    w = (1 - np.clip(m * 3, 0, 1)) * (far[..., 3:4] / 255)                    # 정규화 흐림 — 조각 밖 땅빛만으로 메움
    num = np.stack([np.asarray(Image.fromarray((far[..., c] * w[..., 0]).clip(0, 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(18)), np.float32) for c in range(3)], -1)
    den = np.asarray(Image.fromarray((w[..., 0] * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(18)), np.float32)[..., None] / 255
    fill = num / np.maximum(den, 1e-3)
    m = m * np.clip((den - 0.05) / 0.15, 0, 1) * (far[..., 3:4] / 255)          # 주변 땅빛이 모자란 곳(투명 가장자리)은 원본 그대로 — 0 으로 나눠 검게 됨
    out = far.copy()
    out[..., :3] = far[..., :3] * (1 - m) + fill * m
    Image.fromarray(out.clip(0, 255).astype(np.uint8), 'RGBA').save(os.path.join(d, 'far.webp'), 'WEBP', quality=90, method=6)
    print('CALM', g, 'band %d..%d' % (y0, y1), 'mask %.2f%%' % (float((m > 0.5).mean()) * 100))


def sheet():
    os.makedirs(os.path.join(OUT, 'prev'), exist_ok=True)
    rows = []
    for g in GROUNDS:
        if not os.path.exists(os.path.join(CANON, 'story_' + g, 'layers.json')) or not os.path.exists(os.path.join(CANON, 'story_' + g, 'sky.webp')):
            continue
        a, b = compose(g, 390, 844, 0), compose(g, 390, 844, 700)
        c = compose(g, 1280, 720, 0)
        can = Image.new('RGB', (390 * 2 + 1280 + 16, 844), (30, 30, 30))
        can.paste(a.convert('RGB'), (0, 0))
        can.paste(b.convert('RGB'), (398, 0))
        can.paste(c.convert('RGB'), (796, 62))
        p = os.path.join(OUT, 'prev', g + '.png')
        can.save(p)
        print('PREV', p)
    tl = [g for g in GROUNDS if os.path.exists(os.path.join(TCANON, 'side_' + g, 'top.webp'))]
    for n in range(0, len(tl), 5):
        part = tl[n:n + 5]
        can = Image.new('RGB', (T * 10, T * 5 * len(part)), (30, 30, 30))
        for i, g in enumerate(part):
            skyp = os.path.join(CANON, 'story_' + g, 'sky.webp')
            bg = Image.open(skyp).convert('RGB') if os.path.exists(skyp) else Image.new('RGB', (8, 8), (150, 170, 190))
            can.paste(tile_scene(g, bg).convert('RGB'), (0, i * T * 5))
            ImageDraw.Draw(can).text((4, i * T * 5 + 2), g, fill=(255, 255, 0))
        p = os.path.join(OUT, 'prev', f'tiles_{n // 5 + 1}.png')
        can.save(p)
        print('PREV', p)


def check():
    bad, worst = [], 0.0
    keys = {'img', 'depth', 'top', 'bottom', 'h', 'fog', 'front', 'alpha'}
    for g in GROUNDS:
        d = os.path.join(CANON, 'story_' + g)
        try:
            m = json.load(open(os.path.join(d, 'layers.json'), encoding='utf-8'))
        except Exception as e:  # noqa: BLE001
            bad.append(f'{g} layers.json {e}')
            continue
        if set(m) - {'fog', 'layers', 'light'}:
            bad.append(f'{g} 모르는 키')
        if len(m.get('layers', [])) != 4:
            bad.append(f'{g} 층 수 {len(m.get("layers", []))}')
        for L in m.get('layers', []):
            if set(L) - keys:
                bad.append(f'{g} 층 모르는 키 {set(L) - keys}')
            p = os.path.join(d, L['img'])
            if not os.path.exists(p) or not os.path.exists(os.path.splitext(p)[0] + '.license.json'):
                bad.append(f'{g} 없음 {L["img"]}')
                continue
            im = Image.open(p)
            full = im.height / L['h']
            if full < 1024:
                bad.append(f'{g} {L["img"]} 화면 높이 환산 {full:.0f} < 1024')
            e = max(seam_excess(im, mirror=True), seam_excess(im, mirror=False) if L['img'] == 'sky.webp' and False else -99)
            worst = max(worst, e)
            if e > 4:
                bad.append(f'{g} {L["img"]} 이음 {e:.2f}')
        td = os.path.join(TCANON, 'side_' + g)
        for k in ('top', 'side', 'end_l', 'end_r'):
            p = os.path.join(td, k + '.webp')
            if not os.path.exists(p) or not os.path.exists(os.path.join(td, k + '.license.json')):
                bad.append(f'{g} 타일 없음 {k}')
                continue
            im = Image.open(p)
            if im.size != ((T * 4, T * 4) if k == 'side' else (T * 4, T)):
                bad.append(f'{g} 타일 {k} 크기 {im.size}')
        if os.path.exists(os.path.join(td, 'side.webp')):
            sd, tp, el, er = (Image.open(os.path.join(td, k + '.webp')) for k in ('side', 'top', 'end_l', 'end_r'))
            es = [seam_excess(sd), seam_excess(sd, axis_x=False), seam_excess(tp)]
            def pair(A, B):   # 끝 칸 k 와 윗면 칸 k+1(또는 윗면 칸 k-1 과 끝 칸 k) 맞대기 — 엔진이 x mod 4 로 고르니 칸끼리 잇닿는 자리
                A, B = np.asarray(A.convert('RGBA')).astype(np.float32), np.asarray(B.convert('RGBA')).astype(np.float32)
                cat = np.concatenate([A[:, :T], B[:, T:2 * T]], axis=1)
                rgb = cat[..., :3] * (cat[..., 3:4] / 255)
                d = np.abs(np.diff(rgb, axis=1)).mean(axis=(0, 2))
                return float(d[T - 1] - np.r_[d[T - 9:T - 1], d[T:T + 8]].mean())
            es += [pair(el, tp), pair(tp, er)]                    # 끝 → 윗면 · 윗면 → 끝
            worst = max(worst, max(es))
            if max(es) > 4:
                bad.append(f'{g} 타일 이음 {[round(x, 2) for x in es]}')
    print(f'이음 초과 최대 {worst:.2f} (≤4)')
    print('SIDE2D_FAIL' if bad else 'SIDE2D_OK', len(GROUNDS))
    for b in bad[:30]:
        print(' -', b)
    return 1 if bad else 0


if __name__ == '__main__':
    cmd = sys.argv[1] if len(sys.argv) > 1 else ''
    arg = sys.argv[2] if len(sys.argv) > 2 else None
    ids = arg.split(',') if arg else None
    if cmd == 'batch':
        batch()
    elif cmd == 'contact':
        contact()
    elif cmd == 'pick':
        pick(arg)
    elif cmd == 'prep':
        prep(ids)
    elif cmd == 'split':
        split(ids)
    elif cmd == 'tiles':
        tiles(ids)
    elif cmd == 'match':
        for g in ids or list(TILE_MATCH):
            match_tiles(g)
    elif cmd == 'calm':
        for g in ids or list(CALM):
            calm(g)
    elif cmd == 'sheet':
        sheet()
    elif cmd == 'check':
        sys.exit(check())
    else:
        print(__doc__)
