"""K-0171 ① — 2D 바탕 땅 타일(256px, 이음매 없음)의 가로 줄무늬를 없앤다(GPU·SD 안 씀).

  py tools/ai-art/ground_tile.py [go_dirt,realm_dirt,realm_grass,forest_grass,go_sand,go_stone,realm_stone,go_water] [--out <폴더>]
      → <out>/<이름>.webp + .license.json (기본 out = saga-assets/web2d/tile — 그 판 지금 바탕 자리 그대로)

K-0162·K-0165 눈 판정: 원본 SDXL 타일 자체에 가로 결이 박혀 있다(go_dirt·realm_dirt 나뭇결 같은 줄, realm_grass 가로 띠,
forest_grass 반 칸마다 어두운 띠) — 이음·반복 탓이 아니라서 그림을 바꾼다.
  synth   = 코드로 다시 그림(water_tile.py 와 같은 정수 진동수 사인 합 + 감싼 점 찍기) — 색은 원본 평균에서 뽑아 그 판 색 그대로.
  meadow  = synth 풀 + 데이지(3마을 꽃 풀밭).
  flatten = 원본에서 줄(행 평균 명암의 저주파)만 걷어 냄(파생물이라 출처 = 원본 license) — 10-22 시험: forest_grass 는 띠는 줄지만
            꽃·풀포기 줄이 남아 meadow 로 바꿈. 띠만 있는 다른 타일에 쓸 수 있게 남김.
K-0179: go_sand·go_stone·realm_stone·go_water 는 줄이 아니라 거울 반복 만화경(가운데 대칭 문양) — 같은 길로 다시 그림.
  sand    = 고운 얼룩 + 잔 모래알 + 드문 조개·잔돌(방향 없음).
  stone   = 판석 — 감싼(256 주기) 보로노이 칸, 칸마다 명암·결, 줄눈 어둡게·왼위 빛 모서리.
  water   = water_tile.make(색표는 water_tile SPEC).
"""
import json
import os
import shutil
import sys

import numpy as np
from PIL import Image, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
sys.path.insert(0, HERE)
from edge_tiles import periodic_noise2  # noqa: E402
from water_tile import seam  # noqa: E402

N = 256
# 이름: (방식, 씨앗, 설명)
SPEC = {
    'go_dirt': ('dirt', 17101, '1만리 흙 — 다진 갈색 흙·잔돌'),
    'realm_dirt': ('dirt', 17102, '5천하 흙 — 붉은 갈색 흙·잔돌'),
    'realm_grass': ('grass', 17103, '5천하 풀 — 짧은 풀잎 얼룩'),
    'forest_grass': ('meadow', 17104, '3마을 풀 — 꽃 풀밭(풀잎 + 데이지)'),
    'go_sand': ('sand', 17905, '1만리 모래 — 고운 모래 얼룩·잔 조개'),
    'go_stone': ('stone', 17906, '1만리 돌바닥 — 크고 작은 판석'),
    'realm_stone': ('stone', 17907, '5천하 돌바닥 — 조금 더 큰 판석'),
    'go_water': ('water', 17901, '1만리 물 — 청록 물(water_tile)'),
    'go_grass': ('grass', 17908, '1만리 풀 — 짧은 풀잎 얼룩(비늘 반복 무늬를 바꿈)'),
}
TICKET = {'sand': 'K-0179', 'stone': 'K-0179', 'water': 'K-0179'}
GRASS_BLOT = {'go_grass': 0.12}   # 큰 얼룩 세기 — 1만리는 칸이 작게 보여 칸마다 짙은 얼룩이 격자로 읽힘(K-0179)
STONE = {'go_stone': 7, 'realm_stone': 6}       # 한 변 칸 수(감싼 보로노이 씨앗 격자)


def wrap_blur(im, r):
    big = Image.new(im.mode, (N * 3, N * 3))
    for i in range(3):
        for j in range(3):
            big.paste(im, (i * N, j * N))
    return big.filter(ImageFilter.GaussianBlur(r)).crop((N, N, 2 * N, 2 * N))


def stamp(acc, cx, cy, rx, ry, val):
    """감싼(주기) 타원 얼룩을 acc 에 더한다 — 가장자리 부드럽게."""
    x0, x1 = int(cx - rx - 2), int(cx + rx + 3)
    y0, y1 = int(cy - ry - 2), int(cy + ry + 3)
    yy, xx = np.mgrid[y0:y1, x0:x1]
    d = ((xx - cx) / rx) ** 2 + ((yy - cy) / ry) ** 2
    w = np.clip(1.2 - d, 0, 1)
    acc[yy % N, xx % N] += w * val


def palette(name):
    """원본의 평균·어두운·밝은 색(그 판 색을 그대로 잇는다). 원본은 처음 한 번 _src 로 남겨 둔다."""
    src = src_path(name)
    a = np.asarray(Image.open(src).convert('RGB').resize((N, N)), np.float32).reshape(-1, 3)
    sat = a.max(1) - a.min(1)
    if (sat > 40).mean() > 0.5:                                                      # 꽃(흰 점) 빼고 바탕 색만
        a = a[sat > 40]
    lum = a @ np.array([0.3, 0.59, 0.11], np.float32)
    o = np.argsort(lum)
    return a.mean(0), a[o[: len(o) // 5]].mean(0), a[o[-len(o) // 5:]].mean(0)


def src_path(name):
    tile = os.path.join(ROOT, 'saga-assets', 'web2d', 'tile')
    keep = os.path.join(HERE, '_out', 'k171_src', name + '.webp')
    if not os.path.exists(keep):
        os.makedirs(os.path.dirname(keep), exist_ok=True)
        shutil.copyfile(os.path.join(tile, name + '.webp'), keep)
        lj = os.path.join(tile, name + '.license.json')
        if os.path.exists(lj):
            shutil.copyfile(lj, keep[:-5] + '.license.json')
    return keep


def dirt(name, seed):
    mean, dark, light = palette(name)
    rng = np.random.default_rng(seed)
    blot = periodic_noise2(seed, terms=((1, 1.0), (2, 0.8), (3, 0.5)))              # 큰 얼룩(젖은·마른 흙)
    mott = periodic_noise2(seed + 1, terms=((6, 1.0), (9, 0.8), (14, 0.6)))          # 잔 얼룩(가로·세로 같은 몫 — 줄 안 생김)
    t = np.clip(0.5 + 0.28 * blot + 0.42 * mott, 0, 1)[..., None]
    rgb = mean * 0.9 + (dark - mean) * 0.55 * (1 - t) + (light - mean) * 0.45 * t
    grain = rng.normal(0, 1, (N, N)).astype(np.float32)
    grain = np.asarray(wrap_blur(Image.fromarray(((grain * 30 + 128).clip(0, 255)).astype(np.uint8)), 0.6), np.float32) - 128
    rgb = rgb * (1 + grain[..., None] / 900)
    sh = np.zeros((N, N), np.float32)
    hi = np.zeros((N, N), np.float32)
    for _ in range(80):                                                              # 잔돌: 밝은 몸 + 아래쪽 그림자
        cx, cy = rng.uniform(0, N, 2)
        r = rng.uniform(2.2, 6.5)
        e = rng.uniform(0.6, 1.0)
        stamp(sh, cx + 0.8, cy + r * 0.45, r * 1.05, r * e * 0.95, 1.0)
        stamp(hi, cx, cy, r, r * e, 1.0)
    sh = np.clip(sh, 0, 1); hi = np.clip(hi, 0, 1)
    rgb = rgb * (1 - 0.32 * sh[..., None])
    peb = (light * 0.7 + np.array([150, 140, 128], np.float32) * 0.3)
    rgb = rgb * (1 - 0.8 * hi[..., None]) + peb * 0.8 * hi[..., None]
    cr = np.abs(periodic_noise2(seed + 2, terms=((4, 1.0), (7, 0.6))))               # 가는 금(물결 아닌 그물 — 방향 없음)
    cr = np.clip((0.04 - cr) / 0.04, 0, 1) * np.clip(periodic_noise2(seed + 3, terms=((3, 1.0),)) * 2, 0, 1)
    rgb = rgb * (1 - 0.22 * cr[..., None])
    return wrap_blur(Image.fromarray(np.clip(rgb, 0, 255).astype(np.uint8), 'RGB'), 0.7)


def grass(name, seed):
    mean, dark, light = palette(name)
    rng = np.random.default_rng(seed)
    blot = periodic_noise2(seed, terms=((1, 1.0), (2, 0.8), (3, 0.5), (5, 0.3)))
    t = np.clip(0.5 + GRASS_BLOT.get(name, 0.35) * blot, 0, 1)[..., None]
    rgb = mean * 0.95 + (dark - mean) * 0.5 * (1 - t) + (light - mean) * 0.35 * t
    acc = np.zeros((N, N), np.float32)
    for _ in range(3400):                                                            # 풀잎: 짧은 기울어진 획(아래 어둡고 끝 밝게)
        cx, cy = rng.uniform(0, N, 2)
        ln = rng.uniform(5, 11)
        ang = rng.normal(0, 0.35)
        val = rng.uniform(-1, 1)
        for s in np.linspace(0, 1, 8):
            stamp(acc, cx + np.sin(ang) * ln * s, cy - np.cos(ang) * ln * s, 1.1, 1.1, (s - 0.3) * 1.6 + val * 0.6)
    acc = np.tanh(acc / 2.5)
    rgb = rgb + (light - dark)[None, None, :] * acc[..., None] * 0.75
    rgb = np.asarray(wrap_blur(Image.fromarray(np.clip(rgb, 0, 255).astype(np.uint8), 'RGB'), 0.35), np.float32)
    return Image.fromarray(np.clip(rgb, 0, 255).astype(np.uint8), 'RGB')


def meadow(name, seed):
    """풀(grass) 위에 데이지를 흩뿌린다 — 자리는 균일 난수(줄 안 생김), 꽃잎 여섯 + 노란 속 + 아래 그림자."""
    rgb = np.asarray(grass(name, seed), np.float32)
    rng = np.random.default_rng(seed + 9)
    sh, pet, ctr = (np.zeros((N, N), np.float32) for _ in range(3))
    for _ in range(30):
        cx, cy = rng.uniform(0, N, 2)
        r = rng.uniform(3.8, 6.0)
        rot = rng.uniform(0, np.pi)
        stamp(sh, cx + 1.2, cy + 2.0, r * 1.5, r * 1.2, 0.8)
        for k in range(6):
            a_ = rot + k * np.pi / 3
            stamp(pet, cx + np.cos(a_) * r * 0.8, cy + np.sin(a_) * r * 0.8 * 0.85, r * 0.55, r * 0.55, 1.0)
        stamp(ctr, cx, cy, r * 0.42, r * 0.42, 1.0)
    sh, pet, ctr = (np.clip(x, 0, 1)[..., None] for x in (sh, pet, ctr))
    rgb = rgb * (1 - 0.35 * sh)
    rgb = rgb * (1 - pet) + np.array([246, 246, 236], np.float32) * pet
    rgb = rgb * (1 - ctr) + np.array([240, 200, 70], np.float32) * ctr
    return wrap_blur(Image.fromarray(np.clip(rgb, 0, 255).astype(np.uint8), 'RGB'), 0.45)


def sand(name, seed):
    mean, dark, light = palette(name)
    rng = np.random.default_rng(seed)
    blot = periodic_noise2(seed, terms=((1, 1.0), (2, 0.8), (3, 0.5)))
    mott = periodic_noise2(seed + 1, terms=((5, 1.0), (8, 0.7), (12, 0.5)))
    t = np.clip(0.5 + 0.25 * blot + 0.25 * mott, 0, 1)[..., None]
    rgb = mean * 0.97 + (dark - mean) * 0.35 * (1 - t) + (light - mean) * 0.4 * t
    grain = rng.normal(0, 1, (N, N)).astype(np.float32)                             # 모래알 — 한 픽셀 결
    rgb = rgb * (1 + grain[..., None] / 28)
    sh = np.zeros((N, N), np.float32)
    hi = np.zeros((N, N), np.float32)
    for _ in range(26):                                                              # 드문 조개·잔돌
        cx, cy = rng.uniform(0, N, 2)
        r = rng.uniform(1.6, 3.6)
        e = rng.uniform(0.55, 0.95)
        stamp(sh, cx + 0.7, cy + r * 0.5, r * 1.05, r * e, 1.0)
        stamp(hi, cx, cy, r, r * e, 1.0)
    sh = np.clip(sh, 0, 1); hi = np.clip(hi, 0, 1)
    rgb = rgb * (1 - 0.22 * sh[..., None])
    rgb = rgb * (1 - 0.75 * hi[..., None]) + np.array([238, 228, 212], np.float32) * 0.75 * hi[..., None]
    return wrap_blur(Image.fromarray(np.clip(rgb, 0, 255).astype(np.uint8), 'RGB'), 0.55)


def stone(name, seed):
    """판석 — 지터 격자 씨앗의 감싼 보로노이(민코프스키 p=3 이라 조금 네모난 칸), F2-F1 로 줄눈·모서리 빛."""
    mean, dark, light = palette(name)
    rng = np.random.default_rng(seed)
    g = STONE.get(name, 7)
    cs = N / g
    pts = np.array([((i + rng.uniform(0.15, 0.85)) * cs, (j + rng.uniform(0.15, 0.85)) * cs) for i in range(g) for j in range(g)], np.float32)
    yy, xx = np.indices((N, N)).astype(np.float32)
    f1 = np.full((N, N), 1e9, np.float32); f2 = f1.copy(); idx = np.zeros((N, N), np.int32)
    for k, (px, py) in enumerate(pts):
        dx = np.abs(xx - px); dx = np.minimum(dx, N - dx)
        dy = np.abs(yy - py); dy = np.minimum(dy, N - dy)
        d = (dx ** 3 + dy ** 3) ** (1 / 3)
        m1 = d < f1
        f2 = np.where(m1, f1, np.minimum(f2, d))
        idx = np.where(m1, k, idx)
        f1 = np.where(m1, d, f1)
    edge = f2 - f1                                                                   # 칸 경계까지 거리(대략 2배)
    tone = rng.normal(0, 1, len(pts)).astype(np.float32)[idx]                        # 칸마다 밝기
    warm = rng.normal(0, 1, len(pts)).astype(np.float32)[idx]                        # 칸마다 색기(조금)
    rgb = mean[None, None, :] + (light - dark)[None, None, :] * 0.12 * tone[..., None]
    rgb = rgb + np.array([1.0, 0.4, -0.8], np.float32) * 2.5 * warm[..., None]
    mott = periodic_noise2(seed + 1, terms=((7, 1.0), (11, 0.7), (17, 0.5)))        # 돌 결
    grain = rng.normal(0, 1, (N, N)).astype(np.float32)
    rgb = rgb * (1 + 0.07 * mott[..., None] + grain[..., None] / 45)
    gx = (np.roll(edge, -1, 1) - np.roll(edge, 1, 1)) / 2                            # 감싼 기울기 → 왼위 빛
    gy = (np.roll(edge, -1, 0) - np.roll(edge, 1, 0)) / 2
    bev = np.clip(1 - edge / 7.0, 0, 1)
    lit = (-gx - gy) * 0.5 * bev
    rgb = rgb * (1 + 0.22 * lit[..., None])
    grout = np.clip((2.6 - edge) / 1.6, 0, 1)                                        # 줄눈
    gcol = dark * 0.62
    rgb = rgb * (1 - grout[..., None]) + gcol * grout[..., None]
    return wrap_blur(Image.fromarray(np.clip(rgb, 0, 255).astype(np.uint8), 'RGB'), 0.6)


def water(name, seed):
    from water_tile import make
    return make(name)


def flatten(name, seed):
    """행·열 평균 명암의 저주파(줄)만 나눠 없앤다 — 정수 주기로 감싸 흐려 이음 유지."""
    a = np.asarray(Image.open(src_path(name)).convert('RGB').resize((N, N), Image.LANCZOS), np.float32)
    out = a.copy()
    for axis in (1, 0):                                                              # 1 = 행 평균(가로 띠) · 0 = 열 평균
        prof = out.mean(axis=axis)                                                   # (N, 3)
        k = np.exp(-0.5 * (np.arange(-16, 17) / 5.0) ** 2); k /= k.sum()
        sm = np.stack([np.convolve(np.tile(prof[:, c], 3), k, 'same')[N:2 * N] for c in range(3)], 1)
        g = sm.mean(0)
        f = g / np.maximum(sm, 1)
        out = out * (f[:, None, :] if axis == 1 else f[None, :, :])
    return Image.fromarray(np.clip(out, 0, 255).astype(np.uint8), 'RGB')


def stripe_score(im):
    """가로 줄 세기 — 행 평균 밝기의 표준편차 / 열 평균 밝기의 표준편차(1 근처 = 방향 없음)."""
    l = np.asarray(im.convert('L'), np.float32)
    return float(l.mean(1).std() / max(l.mean(0).std(), 1e-3))


def main(argv):
    out = os.path.join(ROOT, 'saga-assets', 'web2d', 'tile')
    if '--out' in argv:
        i = argv.index('--out')
        out = argv[i + 1]
        argv = argv[:i] + argv[i + 2:]
    names = argv[0].split(',') if argv else list(SPEC)
    os.makedirs(out, exist_ok=True)
    for n in names:
        kind, seed, desc = SPEC[n]
        before = stripe_score(Image.open(src_path(n)).convert('RGB'))
        im = {'dirt': dirt, 'grass': grass, 'meadow': meadow, 'flatten': flatten, 'sand': sand, 'stone': stone, 'water': water}[kind](n, seed)
        p = os.path.join(out, n + '.webp')
        im.save(p, 'WEBP', quality=90, method=6)
        im = Image.open(p).convert('RGB')
        e, after = seam(im), stripe_score(im)
        if kind == 'flatten':
            old = json.load(open(src_path(n)[:-5] + '.license.json', encoding='utf-8'))
            lic = dict(old, derived='원본(%s) 에서 행·열 평균 명암 저주파만 걷어 냄(ground_tile.py flatten) — 풀잎·꽃 그림은 원본' % old.get('model', ''),
                       note=desc + ' · K-0171', date='2026-10-22', ticket='K-0171')
        else:
            lic = {'id': n, 'generator': 'tools/ai-art/ground_tile.py', 'model': '', 'license': 'CC0-1.0 (코드로 그린 그림 — 외부 입력 없음)',
                   'derived': '주기 사인 합 얼룩 + 감싼 점 찍기(%s) — 256 주기 이음매 없음, 색은 옛 SD 타일 평균에서' % {
                       'dirt': '잔돌·금', 'grass': '풀잎 획', 'meadow': '풀잎 획·데이지', 'sand': '모래알·조개', 'stone': '감싼 보로노이 판석·줄눈',
                       'water': '깊이 얼룩·잔물결·마루 선(water_tile)'}[kind],
                   'note': desc + (' · K-0162 SD 타일(만화경 거울 무늬)을 바꿈' if kind in TICKET else ' · K-0162 SD 타일(가로 줄무늬)을 바꿈'),
                   'px': N, 'date': '2026-10-22', 'ticket': TICKET.get(kind, 'K-0171')}
        if out == os.path.join(ROOT, 'saga-assets', 'web2d', 'tile') or '--lic' in argv:
            json.dump(lic, open(os.path.join(out, n + '.license.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
        print('GROUND', n, kind, 'stripe %.2f -> %.2f' % (before, after), 'seam_excess=%.2f' % e, os.path.getsize(p) // 1024, 'KB')


if __name__ == '__main__':
    main(sys.argv[1:])
