"""K-0158 그림체 통일 패스 "C-toon-1" — Blender 로 구운 2D 시트를 웹 2D 배경 그림체 C(부드러운 동화풍 애니 채색)와 같은 집안으로 맞춘다.

  py tools/char-forge/style_pass.py <in.webp> <out.webp> [--px 192] [--ref saga-web/saga-dungeon/assets/web2d/bg]
  (factory.py 가 style_sheet·compare_board 를 직접 부른다)

한 칸마다(알파 있는 몸만):
 1. 툰 계단 — 명도(V)를 4단(0.30·0.55·0.78·0.95)으로 부드럽게 끌어당김(TOON 0.6 — 무늬·눈은 남는다)
 2. 빛 색 — 그림자는 보랏빛 푸른 쪽, 밝은 면은 크림색 쪽(그림체 C "warm pastel palette, cream highlights")
 3. 팔레트 스냅 — 배경 견본(판 web2d/bg 의 그림체 C 층)에서 k-means 32색을 뽑아(data/style_palette_<판>.json, 한 번 만들어 둠)
    가장 가까운 색으로 PULL 0.22 만 끌어당김(asset-forge/palette.py snap_rgb_array 재사용 — 완전 스냅은 얼룩이 진다)
 0. 발 맞춤(먼저) — 서서 하는 동작(idle·walk·attack·attack2·cast·hit·talk·sit)은 칸마다, run·death 는 그 줄(방향)의 가장 낮은 칸 기준으로
    몸 맨 아래를 foot×px 에 맞춘다(모캡·몸 동작마다 뿌리 높이가 달라 2~14px 가라앉던 것 — 판정 foot 줄이 잡음)
 4. 외곽선 — 몸 실루엣 바깥 1px 띠(알파를 넓혀 흐린 것 − 원래 알파)를 짙은 밤색(0.22,0.14,0.13)으로 몸 밑에 깐다(배경 그림의 얇은 윤곽과 같은 결, 검정·계단 아님)
반투명 찌꺼기(알파 < 10)는 지운다. 프레임 칸 경계는 넘지 않는다(칸마다 따로 처리).
"""
import json
import os
import sys

import numpy as np
from PIL import Image, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
sys.path.insert(0, os.path.join(ROOT, 'tools', 'asset-forge'))
from palette import snap_rgb_array  # noqa: E402  (K-0158: 팔레트 스냅은 공용 도구 그대로)

LEVELS = np.array([0.30, 0.55, 0.78, 0.95])
TOON = 0.6
PULL = 0.22
SHADOW = np.array([0.40, 0.36, 0.58])
CREAM = np.array([1.0, 0.95, 0.84])
LINE = np.array([0.22, 0.14, 0.13])
STYLE = 'C-toon-1'


def build_palette(ref_dir, k=32, seed=20260824):
    rng = np.random.default_rng(seed)
    px = []
    for f in sorted(os.listdir(ref_dir)):
        if f.endswith(('.webp', '.png', '.jpg')):
            a = np.asarray(Image.open(os.path.join(ref_dir, f)).convert('RGBA')).reshape(-1, 4)
            a = a[a[:, 3] > 200][:, :3]
            if len(a):
                px.append(a[rng.choice(len(a), min(len(a), 6000), replace=False)])
    x = np.concatenate(px).astype(np.float32)
    c = x[rng.choice(len(x), k, replace=False)]
    for _ in range(20):
        d = ((x[:, None, :] - c[None, :, :]) ** 2).sum(-1)
        lab = d.argmin(1)
        for i in range(k):
            m = x[lab == i]
            if len(m):
                c[i] = m.mean(0)
    return np.clip(np.round(c), 0, 255).astype(np.uint8)


def load_palette(plan_or_ref):
    ref = plan_or_ref.get('style_ref') if isinstance(plan_or_ref, dict) else plan_or_ref
    game = os.path.basename(os.path.dirname(os.path.dirname(os.path.dirname(os.path.normpath(ref)))))
    jp = os.path.join(HERE, 'data', f'style_palette_{game}.json')
    if os.path.exists(jp):
        return np.array(json.load(open(jp, encoding='utf-8'))['rgb'], dtype=np.uint8)
    pal = build_palette(os.path.join(ROOT, ref))
    json.dump({'note': f'K-0158 style_pass — {ref} 그림체 C 배경 층에서 k-means 32색(씨앗 20260824)', 'ref': ref,
               'rgb': pal.tolist(), 'hex': ['#%02x%02x%02x' % tuple(c) for c in pal]},
              open(jp, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    return pal


def _rgb2hsv(x):
    mx, mn = x.max(-1), x.min(-1)
    d = mx - mn
    r, g, b_ = x[..., 0], x[..., 1], x[..., 2]
    h = np.zeros_like(mx)
    m = d > 1e-6
    rr = m & (mx == r)
    gg = m & (mx == g) & ~rr
    bb = m & ~rr & ~gg
    h[rr] = ((g - b_)[rr] / d[rr]) % 6
    h[gg] = (b_ - r)[gg] / d[gg] + 2
    h[bb] = (r - g)[bb] / d[bb] + 4
    return h / 6, np.where(mx > 1e-6, d / np.maximum(mx, 1e-6), 0), mx


def _hsv2rgb(h, s, v):
    i = np.floor(h * 6).astype(int) % 6
    f = h * 6 - np.floor(h * 6)
    p_, q, t = v * (1 - s), v * (1 - s * f), v * (1 - s * (1 - f))
    sel = [(v, t, p_), (q, v, p_), (p_, v, t), (p_, q, v), (t, p_, v), (v, p_, q)]
    out = np.zeros(h.shape + (3,), np.float32)
    for k, (a0, a1, a2) in enumerate(sel):
        mk = i == k
        out[mk, 0], out[mk, 1], out[mk, 2] = a0[mk], a1[mk], a2[mk]
    return out


HUE_KEEP_S = 0.10      # K-0159: 원래 채도가 이만큼 넘는 곳(머리·살·옷)은 색상을 원래대로, 채도는 원래의 90% 아래로 안 내림


def keep_hue(src, out):
    """K-0159 색 충실 — 그림자 보랏빛·크림·팔레트 끌어당김이 갈색 머리·살을 회녹색으로 바래게 하던 것(hero_m 대조판).
    명도(툰 계단)는 그대로 두고 색상·채도만 원래 쪽으로 되돌린다."""
    h0, s0, _ = _rgb2hsv(src)
    h1, s1, v1 = _rgb2hsv(out)
    keep = s0 > HUE_KEEP_S
    h2 = np.where(keep, h0, h1)
    s2 = np.where(keep, np.maximum(s1, s0 * 0.9), s1)
    return np.clip(_hsv2rgb(h2, np.clip(s2, 0, 1), v1), 0, 1)


def style_cell(cell, pal):
    """cell: RGBA uint8 (h,w,4) → RGBA uint8."""
    a = cell[..., 3].astype(np.float32) / 255
    rgb = cell[..., :3].astype(np.float32) / 255
    body = a > 0.04
    if not body.any():
        return np.zeros_like(cell)
    v = rgb.max(-1)
    lv = LEVELS[np.abs(v[..., None] - LEVELS).argmin(-1)]
    v2 = v + (lv - v) * TOON
    scale = np.where(v > 1e-4, v2 / np.maximum(v, 1e-4), 0)[..., None]
    out = np.clip(rgb * scale + (v2 - v)[..., None] * (v < 1e-4)[..., None], 0, 1)
    sh = np.clip((0.5 - v2) / 0.3, 0, 1)[..., None] * 0.18           # 그림자 → 보랏빛
    hi = np.clip((v2 - 0.75) / 0.2, 0, 1)[..., None] * 0.22          # 밝은 면 → 크림
    out = out * (1 - sh) + SHADOW * v2[..., None] * sh
    out = out * (1 - hi) + CREAM * hi
    o8 = np.clip(out * 255, 0, 255).astype(np.uint8)
    sn = snap_rgb_array(o8.reshape(-1, 3), pal).reshape(o8.shape).astype(np.float32) / 255
    out = out * (1 - PULL) + sn * PULL
    out = keep_hue(rgb, out)
    na = np.where(a < 10 / 255, 0, a)
    a8 = Image.fromarray(np.clip(na * 255, 0, 255).astype(np.uint8))
    dil = np.asarray(a8.filter(ImageFilter.MaxFilter(3)).filter(ImageFilter.GaussianBlur(0.5))).astype(np.float32) / 255
    ring = np.clip(dil - na, 0, 1) * 0.92                         # 바깥 1px 띠 — 알파로 부드럽게(계단 없는 얇은 선)
    fa = na + ring * (1 - na)
    rgb_o = (out * na[..., None] + LINE * (ring * (1 - na))[..., None]) / np.maximum(fa, 1e-4)[..., None]
    fa = np.where(fa < 10 / 255, 0, fa)
    res = np.zeros_like(cell)
    res[..., :3] = np.clip(rgb_o * 255, 0, 255).astype(np.uint8)
    res[..., 3] = np.clip(fa * 255, 0, 255).astype(np.uint8)
    res[res[..., 3] == 0, :3] = 0
    return res


GROUND_EACH = ('idle', 'walk', 'attack', 'attack2', 'cast', 'hit', 'talk', 'sit')
GROUND_ROW = ('run', 'death')


def _low(cell):
    ys = np.where((cell[..., 3] > 128).any(1))[0]
    return int(ys.max()) + 1 if len(ys) else None


def _shift(cell, dy):
    if not dy:
        return cell
    o = np.zeros_like(cell)
    if dy > 0:
        o[dy:] = cell[:-dy]
    else:
        o[:dy] = cell[-dy:]
    return o


def ground_sheet(im, px, role, foot):
    """발 맞춤 — 외곽선이 아래로 1px 붙으니 몸(외곽선 전) 아래 경계를 round(foot×px)−1 에 둔다."""
    if role not in GROUND_EACH + GROUND_ROW or foot is None:
        return im
    t = int(round(foot * px)) - 1
    im = im.copy()
    for y in range(0, im.shape[0], px):
        lows = [_low(im[y:y + px, x:x + px]) for x in range(0, im.shape[1], px)]
        rowlow = max([v for v in lows if v is not None], default=None)
        for i, x in enumerate(range(0, im.shape[1], px)):
            base = lows[i] if role in GROUND_EACH else (lows[0] if role == 'death' and lows[0] is not None else rowlow)   # K-0159: 쓰러짐은 서 있는 첫 칸 기준(누운 망토가 땅 밑으로 내려가 줄 전체를 끌어올려 머리가 잘리던 것)
            if base is not None:
                im[y:y + px, x:x + px] = _shift(im[y:y + px, x:x + px], t - base)
        if role == 'death':       # K-0159: 땅 밑(망토 조각이 바닥을 뚫음)은 안 보인다 — 발 줄 아래를 지운다
            im[y + t + 1:y + px] = 0
    return im


def style_sheet(src, dst, pal, px=192, role=None, foot=None):
    im = ground_sheet(np.asarray(Image.open(src).convert('RGBA')), px, role, foot)
    out = np.zeros_like(im)
    for y in range(0, im.shape[0], px):
        for x in range(0, im.shape[1], px):
            out[y:y + px, x:x + px] = style_cell(im[y:y + px, x:x + px], pal)
    Image.fromarray(out).save(dst, 'WEBP', quality=88, method=6)


def compare_board(raw_dir, sty_dir, plan, out_png, scale=1.5):
    """대조판: 위 = 배경 그림(그림체 C) 위에 원본, 아래 = 같은 배경 위에 통일 패스. 열 = idle 5방향 + walk·attack 옆 칸, 1.5배.
    판의 한 장 그림(web2d/moving/<풀>/side.webp)이 있으면 오른쪽 끝에 참고로 둔다."""
    px = plan['px']
    S = int(px * scale)
    ref = os.path.join(ROOT, plan['style_ref'])
    bgs = sorted(f for f in os.listdir(ref) if f.endswith('_mid.webp'))
    bg = Image.open(os.path.join(ref, bgs[0])).convert('RGBA') if bgs else Image.new('RGBA', (S, S), (200, 200, 200, 255))
    cols = [('idle', 0, i) for i in range(len(plan['dirs']))] + [(r, f, 2) for r, f in (('walk', 2), ('attack', 4))]
    cols = [c for c in cols if os.path.exists(os.path.join(sty_dir, c[0] + '.webp'))]
    still = os.path.join(os.path.dirname(ref), 'moving', os.path.basename(sty_dir), 'side.webp')
    if plan.get('still_game'):          # K-0159: 풀의 still 이 있는 판(5천하 rts_* 등)
        still = os.path.join(ROOT, 'saga-web', plan['still_game'], 'assets', 'web2d', 'moving', os.path.basename(sty_dir), 'side.webp')
    W, H = S * (len(cols) + (1 if os.path.exists(still) else 0)), S
    board = Image.new('RGBA', (W, H * 2 + 8), (255, 255, 255, 255))
    for row, src in enumerate((raw_dir, sty_dir)):
        band = bg.resize((max(W, bg.width * H // bg.height), H)).crop((0, 0, W, H))
        board.alpha_composite(band, (0, row * (H + 8)))
        for i, (r, f, d) in enumerate(cols):
            sh = Image.open(os.path.join(src, r + '.webp')).convert('RGBA')
            board.alpha_composite(sh.crop((f * px, d * px, f * px + px, d * px + px)).resize((S, S), Image.LANCZOS), (i * S, row * (H + 8)))
        if os.path.exists(still):
            st = Image.open(still).convert('RGBA').resize((S, S), Image.LANCZOS)
            board.alpha_composite(st, (len(cols) * S, row * (H + 8)))
    board.convert('RGB').save(out_png)


if __name__ == '__main__':
    a = sys.argv[1:]
    ref = a[a.index('--ref') + 1] if '--ref' in a else 'saga-web/saga-dungeon/assets/web2d/bg'
    style_sheet(a[0], a[1], load_palette(ref), int(a[a.index('--px') + 1]) if '--px' in a else 192)
