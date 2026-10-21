"""K-0159 한 장 그림(still) ↔ 시트 몸 "같은 사람" 색 띠 비교 — 몸 고르기(후보 순위)와 sheet_judge `still` 줄이 함께 쓴다.

  py tools/char-forge/still_match.py <풀> [--game saga-dungeon] [--top 8] [--board out.png]
     → saga-web/shared/assets/characters2d8/<몸>/idle.webp 정면 첫 칸 500명과 still front.webp 를 비교해 순위 + 대조판

띠 셋(몸 상자 높이 기준): 머리 0~16% · 윗몸 16~52% ·아랫몸 52~100%.
띠마다 대표 색 4(Lab k-means)를 뽑아 양방향 최근접 ΔE(밝기 절반)를 겹침 e^(-ΔE/12) 로 비교,
가중 머리 0.35 · 윗몸 0.35 · 아랫몸 0.30. 그림자·외곽선(명도 < 0.12)은 뺀다. (처음 HSV 히스토그램판은 베이지 30° 칸 경계에서
맞는 몸도 0.25 로 떨어져 옛 hero_m 과 못 갈랐다 — 10-21 calib)
"""
import os
import sys

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
BANDS = ((0.0, 0.16, 0.35), (0.16, 0.52, 0.35), (0.52, 1.0, 0.30))
STILL_MIN = 0.28          # sheet_judge still 줄 문턱(가중) — 10-21 calib(k 4·σ 12): 맞춘 몸 0.30~0.52, K-0158 옛 hero_m 0.27/띠 0.17, 덜 맞은 mage 0.20
#   한계: 색만 본다 — 나이(K-0158 옛 villager_a 젊은 흰옷 0.43)는 못 잡아 대조판 눈 판정이 함께 필요
STILL_BAND_MIN = 0.20     # 띠 하나라도 이 밑이면 FAIL(머리색만 다른 몸)


def _hsv(rgb):
    r, g, b = rgb[:, 0], rgb[:, 1], rgb[:, 2]
    mx, mn = rgb.max(1), rgb.min(1)
    d = mx - mn
    h = np.zeros_like(mx)
    m = d > 1e-6
    rr = m & (mx == r)
    gg = m & (mx == g) & ~rr
    bb = m & ~rr & ~gg
    h[rr] = ((g - b)[rr] / d[rr]) % 6
    h[gg] = (b - r)[gg] / d[gg] + 2
    h[bb] = (r - g)[bb] / d[bb] + 4
    return h / 6, np.where(mx > 1e-6, d / np.maximum(mx, 1e-6), 0), mx


def _hist(rgb):
    h, s, v = _hsv(rgb)
    keep = v >= 0.12
    h, s, v = h[keep], s[keep], v[keep]
    if len(h) < 10:
        return None
    col = s >= 0.18
    idx = np.where(col, (np.minimum(h * 12, 11.999)).astype(int) * 2 + (v >= 0.55), 24 + np.minimum(v * 4, 3.999).astype(int))
    w = np.where(col, 1.0, 0.6)          # 무채(흰·회·검)는 조명·그림체 차이가 커서 조금 덜 센다
    hh = np.bincount(idx, weights=w, minlength=28)
    return hh / hh.sum()


def _lab(rgb):
    """sRGB 0~1 → CIE Lab (D65)."""
    c = np.where(rgb > 0.04045, ((rgb + 0.055) / 1.055) ** 2.4, rgb / 12.92)
    xyz = c @ np.array([[0.4124, 0.2126, 0.0193], [0.3576, 0.7152, 0.1192], [0.1805, 0.0722, 0.9505]], np.float32)
    xyz = xyz / np.array([0.9505, 1.0, 1.089], np.float32)
    f = np.where(xyz > 0.008856, np.cbrt(xyz), 7.787 * xyz + 16 / 116)
    return np.stack([116 * f[:, 1] - 16, 500 * (f[:, 0] - f[:, 1]), 200 * (f[:, 1] - f[:, 2])], 1)


def _clusters(rgb, k=4):
    """띠 하나의 대표 색 k 개(Lab 중심, 무게) — 결정적 k-means(명도 분위수에서 시작)."""
    _, _, v = _hsv(rgb)
    rgb = rgb[v >= 0.12]                      # 그림자·외곽선 빼기
    if len(rgb) < 10:
        return None
    lab = _lab(rgb)
    if len(lab) > 4000:
        lab = lab[np.linspace(0, len(lab) - 1, 4000).astype(int)]
    order = np.argsort(lab[:, 0])
    c = lab[order[np.linspace(0, len(lab) - 1, k + 2)[1:-1].astype(int)]].copy()
    for _ in range(12):
        lb = ((lab[:, None, :] - c[None]) ** 2).sum(-1).argmin(1)
        for i in range(k):
            m = lab[lb == i]
            if len(m):
                c[i] = m.mean(0)
    w = np.bincount(lb, minlength=k).astype(np.float64)
    keep = w > 0
    return c[keep], w[keep] / w.sum()


def features(rgba):
    """rgba uint8 (h,w,4) — 한 사람 그림 → [띠 대표 색 셋] (몸 상자 기준)."""
    a = rgba[..., 3] > 128
    ys, xs = np.where(a)
    if len(ys) < 50:
        return None
    y0, y1 = ys.min(), ys.max() + 1
    H = y1 - y0
    out = []
    for t0, t1, _ in BANDS:
        sl = slice(y0 + int(H * t0), y0 + max(int(H * t1), int(H * t0) + 1))
        m = a[sl]
        out.append(_clusters(rgba[sl][..., :3][m].astype(np.float32) / 255))
    return out


SIGMA = 12.0      # ΔE 이만큼 떨어지면 겹침 e^-1


def _band_sim(A, B):
    """대표 색끼리 양방향 가중 최근접 ΔE(밝기는 반만 셈 — 조명·그림체 차이) → 0~1."""
    def one(P, Q):
        (pc, pw), (qc, qw) = P, Q
        d = pc[:, None, :] - qc[None]
        d[..., 0] *= 0.5
        return float((np.sqrt((d ** 2).sum(-1)).min(1) * pw).sum())
    return float(np.exp(-0.5 * (one(A, B) + one(B, A)) / SIGMA))


def similarity(fa, fb):
    """띠별 색 겹침(0~1) 가중 평균 + 띠별 값 — 어느 쪽이든 띠가 비면 그 띠는 0."""
    per = [(_band_sim(a, b) if a is not None and b is not None else 0.0) for a, b in zip(fa, fb)]
    return sum(p * w for p, (_, _, w) in zip(per, BANDS)), per


def still_path(game, pool, view='front'):
    return os.path.join(ROOT, 'saga-web', game, 'assets', 'web2d', 'moving', pool, view + '.webp')


def still_features(game, pool):
    p = still_path(game, pool)
    return features(np.asarray(Image.open(p).convert('RGBA'))) if os.path.exists(p) else None


def body_cell(body, px=128):
    p = os.path.join(ROOT, 'saga-web', 'shared', 'assets', 'characters2d8', body, 'idle.webp')
    im = np.asarray(Image.open(p).convert('RGBA'))
    return im[:px, :px]


def rank(game, pool, top=8):
    sf = still_features(game, pool)
    root = os.path.join(ROOT, 'saga-web', 'shared', 'assets', 'characters2d8')
    res = []
    for b in sorted(os.listdir(root)):
        try:
            f = features(body_cell(b))
        except Exception:
            continue
        if f is None:
            continue
        s, per = similarity(sf, f)
        res.append((s, b, per))
    res.sort(reverse=True)
    return res[:top]


def board(game, pool, ranked, out):
    from PIL import ImageDraw
    S = 220
    st = Image.open(still_path(game, pool)).convert('RGBA').resize((S, S), Image.LANCZOS)
    W = S * (1 + len(ranked))
    bd = Image.new('RGBA', (W, S + 18), (110, 110, 110, 255))
    bd.alpha_composite(st, (0, 18))
    dr = ImageDraw.Draw(bd)
    dr.text((4, 2), pool, fill=(255, 255, 0))
    for i, (s, b, per) in enumerate(ranked):
        c = Image.fromarray(body_cell(b)).resize((S, S), Image.LANCZOS)
        bd.alpha_composite(c, ((i + 1) * S, 18))
        dr.text(((i + 1) * S + 4, 2), f'{b} {s:.2f}', fill=(255, 255, 255))
    bd.convert('RGB').save(out)


if __name__ == '__main__':
    a = sys.argv[1:]
    game = a[a.index('--game') + 1] if '--game' in a else 'saga-dungeon'
    top = int(a[a.index('--top') + 1]) if '--top' in a else 8
    r = rank(game, a[0], top)
    for s, b, per in r:
        print(f'{s:.3f} {b} ' + ' '.join(f'{x:.2f}' for x in per))
    if '--board' in a:
        board(game, a[0], r, a[a.index('--board') + 1])
