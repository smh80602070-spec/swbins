"""K-0091 단계 2 — 3마을 2D 땅 이음 타일(알파 가장자리)을 두 바탕 타일에서 코드로 합성한다(GPU 안 씀).

  py tools/ai-art/edge_tiles.py <A 타일> <이름 꼬리> [--out <폴더>] [--foam]
      A = 넘어 들어오는 땅(풀 등, 256 이음매 없는 webp/png) · 꼬리 = grass_dirt 처럼
      → <out>/forest_edge_<꼬리>.webp   변: 위쪽 가장자리에서 A 가 들어온다(좌우 이음 — 물결 경계가 가로 주기)
        <out>/forest_corner_<꼬리>.webp 바깥 모서리: 왼쪽 위 모서리에서 A 가 둥글게 들어온다
      --foam: 경계 바로 바깥에 밝은 거품 띠(땅↔물)
  py tools/ai-art/edge_tiles.py --pairs [tools/ai-art/data/terrain_pairs.json] [--game saga-go] [--deploy]
      K-0162 16칸 모서리 꼴(이중 격자) 아틀라스 — 아래 wang_main
웹은 B 칸 위에 이 그림을 얹고 방향에 맞게 90° 돌려 쓴다(한 방향 기준, K-0091). 경계는 가로 주기 잡음이라
변 타일끼리 옆으로 이어 붙여도 끊기지 않는다. 결과는 알파 RGBA 256px.
"""
import os
import sys

import numpy as np
from PIL import Image

PX = 256
DEPTH = 0.36      # 변: A 가 들어오는 깊이(타일 높이 비율, 물결 가운데)
WAVE = 0.07       # 물결 세기
SOFT = 6.0        # 경계 부드러움(px)


def periodic_noise(n, seed, octaves=((3, 1.0), (7, 0.5), (13, 0.25))):
    """길이 n 의 주기 잡음(0 기준, 대략 -1..1) — 사인 몇 개를 씨앗 위상으로 섞는다."""
    rng = np.random.default_rng(seed)
    x = np.arange(n) / n * 2 * np.pi
    v = np.zeros(n)
    for k, amp in octaves:
        v += amp * np.sin(k * x + rng.uniform(0, 2 * np.pi))
    return v / sum(a for _, a in octaves)


def load(p):
    im = Image.open(p).convert('RGBA')
    if im.size != (PX, PX):
        im = im.resize((PX, PX), Image.LANCZOS)
    return np.asarray(im).astype(np.float32)


def edge_alpha(seed):
    yy = np.arange(PX)[:, None].astype(np.float32)
    line = (DEPTH + WAVE * periodic_noise(PX, seed)) * PX           # 열마다 경계 높이
    return np.clip((line[None, :] - yy) / SOFT + 0.5, 0, 1), line


def corner_alpha(seed):
    yy, xx = np.indices((PX, PX)).astype(np.float32)
    ang = np.arctan2(yy, xx)                                        # 0..pi/2
    t = (ang / (np.pi / 2) * PX).astype(int).clip(0, PX - 1)
    r0 = (DEPTH * 1.25 + WAVE * periodic_noise(PX, seed + 1)[t]) * PX
    r = np.hypot(xx, yy)
    return np.clip((r0 - r) / SOFT + 0.5, 0, 1), r0, r


def foam(alpha_dist, width=5.0):
    """경계 바깥 쪽 밝은 띠 — alpha_dist = 경계까지 거리(px, 바깥 +)."""
    return np.clip(1 - np.abs(alpha_dist - width * 0.6) / width, 0, 1) * 0.55


def compose(a_img, alpha, foam_band=None):
    rgb = a_img[..., :3].copy()
    out_a = alpha.copy()
    if foam_band is not None:
        rgb = rgb * (1 - foam_band[..., None]) + 245 * foam_band[..., None]
        out_a = np.maximum(out_a, foam_band)
    return Image.fromarray(np.dstack([rgb.clip(0, 255), (out_a * 255).clip(0, 255)]).astype(np.uint8), 'RGBA')


def main():
    a = sys.argv[1:]
    if len(a) < 2:
        sys.exit(__doc__)
    src, tail = a[0], a[1]
    out = a[a.index('--out') + 1] if '--out' in a else os.path.join(os.path.dirname(os.path.abspath(__file__)), '_out', 'k91_edges')
    os.makedirs(out, exist_ok=True)
    img = load(src)
    seed = sum(map(ord, tail))
    ea, line = edge_alpha(seed)
    ca, r0, r = corner_alpha(seed)
    fe = fc = None
    if '--foam' in a:
        yy = np.arange(PX)[:, None].astype(np.float32)
        fe = foam(yy - line[None, :])
        fc = foam(r - r0)
    for name, al, fb in (('edge', ea, fe), ('corner', ca, fc)):
        p = os.path.join(out, 'forest_%s_%s.webp' % (name, tail))
        compose(img, al, fb).save(p, 'WEBP', quality=90, method=6)
        print('EDGE_TILE', p)
    # 좌우 이음 검사(변): 왼쪽 끝 열과 오른쪽 끝 열 알파 차
    print('SEAM_X %.3f' % float(np.abs(ea[:, 0] - ea[:, -1]).mean()))


# ---------------------------------------------------------------------------
# K-0162 — 16칸 모서리 꼴(이중 격자) 이음 타일. GPU 안 씀, 바탕 타일 두 장(그 판 그림 그대로)에서 합성.
#  칸 번호 i = NW*1 + NE*2 + SW*4 + SE*8 (비트 = 그 모서리 땅이 a). 0 = 전부 b, 15 = 전부 a.
#  아틀라스 4×4(열 = i%4, 행 = i//4). 웹은 칸 격자에서 반 칸 밀린 격자에 그리고, 그 칸 네 모서리 = 이웃 네 칸의 땅.
#  경계장 f = 네 모서리 쌍선형 + 주기 잡음(타일 주기 PX) → 변 값은 그 변 두 모서리로만 정해져 이웃끼리 이어진다.
# ---------------------------------------------------------------------------
GUT = 8          # 아틀라스 칸 여백(px) — 칸 i 자리 = (i%4*(PX+2*GUT)+GUT, i//4*(PX+2*GUT)+GUT, PX, PX)
ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
EDGE_STYLE = {   # 경계 폭(f 단위)·잡음 세기·그림자·거품
    'grass': dict(soft=0.040, amp=0.45, fine=0.24, shadow=0.30, rim=0.10, foam=0.0, wet=0.0),
    'path':  dict(soft=0.050, amp=0.40, fine=0.06, shadow=0.22, rim=0.0, foam=0.0, wet=0.0),
    'shore': dict(soft=0.035, amp=0.42, fine=0.05, shadow=0.12, rim=0.0, foam=0.80, wet=0.30),
}


def periodic_noise2(seed, terms=((2, 1.0), (3, 0.8), (5, 0.5), (8, 0.3)), n=None):
    """n×n 주기 2D 잡음(-1..1 쯤) — 정수 진동수 사인 합이라 x·y 모두 n 주기."""
    n = n or PX
    rng = np.random.default_rng(seed)
    yy, xx = np.indices((n, n)).astype(np.float32) / n * 2 * np.pi
    v = np.zeros((n, n), np.float32)
    tot = 0.0
    for k, amp in terms:
        for _ in range(3):
            fx, fy = rng.integers(-k, k + 1, 2)
            if fx == 0 and fy == 0:
                fx = k
            v += amp * np.sin(fx * xx + fy * yy + rng.uniform(0, 2 * np.pi))
            tot += amp * amp
    return v / (tot ** 0.5 * 1.6)


def wang_field(i, noise):
    nw, ne, sw, se = (i >> 0) & 1, (i >> 1) & 1, (i >> 2) & 1, (i >> 3) & 1
    t = (np.arange(PX, dtype=np.float32) + 0.5) / PX
    u, v = t[None, :], t[:, None]
    bil = (nw * (1 - u) * (1 - v) + ne * u * (1 - v) + sw * (1 - u) * v + se * u * v)
    bump = 4 * bil * (1 - bil)                     # 순수한 곳(0·1)에선 0 → 꽉 찬 칸은 잡음 없음
    return bil + noise * bump * 0.5


def wang_tile(i, A, B, noise, fine, st):
    f = wang_field(i, noise * st['amp'] + fine * st['fine'])
    d = f - 0.5                                   # + = a 쪽
    al = np.clip(d / st['soft'] + 0.5, 0, 1)
    al = al * al * (3 - 2 * al)
    b = B[..., :3].copy()
    a = A[..., :3].copy()
    out_b = np.clip(-d, 0, None)                  # b 쪽 경계까지 거리(f 단위)
    if st['shadow']:
        sh = st['shadow'] * np.exp(-out_b / 0.06) * (d < 0)
        b *= (1 - sh)[..., None]
    if st['wet']:                                 # 물가 — a(땅) 쪽 경계 안쪽이 젖어 어둡다
        a *= (1 - st['wet'] * np.exp(-np.clip(d, 0, None) / 0.05))[..., None]
    if st['rim']:                                 # 풀 끝 살짝 밝게
        a *= (1 + st['rim'] * np.exp(-np.clip(d, 0, None) / 0.03))[..., None]
    if st['foam']:                                # 물가 거품 — b(물) 쪽 띠, 잡음으로 끊김
        band = np.exp(-((out_b - 0.04) / 0.03) ** 2) * (d < 0)
        band *= np.clip(0.75 + fine * 1.0, 0, 1)
        fo = st['foam'] * band
        b = b * (1 - fo[..., None]) + 236 * fo[..., None]
    rgb = a * al[..., None] + b * (1 - al[..., None])
    return np.clip(rgb, 0, 255)


def wang_atlas(A, B, edge, seed):
    st = EDGE_STYLE[edge]
    noise = periodic_noise2(seed)
    fine = periodic_noise2(seed + 7, terms=((11, 1.0), (17, 0.8), (23, 0.6), (31, 0.4)))
    S = PX + 2 * GUT
    sheet = np.zeros((S * 4, S * 4, 3), np.float32)
    for i in range(16):         # 칸마다 거울 여백(GUT) — webp 손실 압축 필터·웹 확대 샘플이 옆 칸(다른 땅)을 끌어오지 않게
        r, c = divmod(i, 4)
        t = wang_tile(i, A, B, noise, fine, st)
        sheet[r * S:(r + 1) * S, c * S:(c + 1) * S] = np.pad(t, ((GUT, GUT), (GUT, GUT), (0, 0)), mode='symmetric')
    return Image.fromarray(sheet.astype(np.uint8), 'RGB')


def atlas_tiles(im):
    a = np.asarray(im.convert('RGB')).astype(np.float32)
    S = PX + 2 * GUT
    return [a[(i // 4) * S + GUT:(i // 4) * S + GUT + PX, (i % 4) * S + GUT:(i % 4) * S + GUT + PX] for i in range(16)]


def seam_check(tiles):
    """붙을 수 있는 칸끼리 이음(가로·세로) — 이음 줄 차 평균 − 바로 옆 안쪽 줄 차 평균(그 자리 결 고유의 차를 뺀 초과분). 최댓값."""
    worst, ref = 0.0, []
    for i in range(16):
        for j in range(16):
            if ((i >> 1) & 1) == (j & 1) and ((i >> 3) & 1) == ((j >> 2) & 1):          # 가로: i 의 NE·SE = j 의 NW·SW
                loc = (np.abs(tiles[i][:, -1] - tiles[i][:, -2]).mean() + np.abs(tiles[j][:, 1] - tiles[j][:, 0]).mean()) / 2
                worst = max(worst, float(np.abs(tiles[i][:, -1] - tiles[j][:, 0]).mean() - loc))
                ref.append(loc)
            if ((i >> 2) & 1) == (j & 1) and ((i >> 3) & 1) == ((j >> 1) & 1):          # 세로: i 의 SW·SE = j 의 NW·NE
                loc = (np.abs(tiles[i][-1] - tiles[i][-2]).mean() + np.abs(tiles[j][1] - tiles[j][0]).mean()) / 2
                worst = max(worst, float(np.abs(tiles[i][-1] - tiles[j][0]).mean() - loc))
                ref.append(loc)
    return worst, float(np.mean(ref))


def preview(tiles, seed, n=8, cell=128):
    """시험판 — 왼쪽: 지금처럼 네모 칸, 오른쪽: 이음 타일(이중 격자). 같은 무작위 칸 지도(n+1)²."""
    rng = np.random.default_rng(seed)
    m = n + 1
    sm = periodic_noise2(seed + 3, terms=((1, 1.0), (2, 0.7), (3, 0.4)), n=24)
    ox, oy = rng.integers(0, 24 - m, 2)
    world = (sm[oy:oy + m, ox:ox + m] + rng.normal(0, 0.18, (m, m)) > 0).astype(int)
    small = [Image.fromarray(t.astype(np.uint8)).resize((cell, cell), Image.LANCZOS) for t in tiles]
    W = n * cell
    left = Image.new('RGB', (W, W))
    right = Image.new('RGB', (W, W))
    for y in range(m):            # 네모 칸 — 땅 칸 중심이 이음 그림의 모서리 자리(반 칸 밀림)
        for x in range(m):
            left.paste(small[15 if world[y, x] else 0], (x * cell - cell // 2, y * cell - cell // 2))
    for y in range(n):
        for x in range(n):
            i = world[y, x] * 1 + world[y, x + 1] * 2 + world[y + 1, x] * 4 + world[y + 1, x + 1] * 8
            right.paste(small[i], (x * cell, y * cell))
    out = Image.new('RGB', (W * 2 + 16, W), (255, 255, 255))
    out.paste(left, (0, 0))
    out.paste(right, (W + 16, 0))
    return out


def _srclic(src_dir, tid):
    import json
    p = os.path.join(src_dir, tid + '.license.json')
    return json.load(open(p, encoding='utf-8')) if os.path.exists(p) else {}


def wang_main(argv):
    import json
    import shutil
    cfg_p = next((x for x in argv if x.endswith('.json')), os.path.join(ROOT, 'tools', 'ai-art', 'data', 'terrain_pairs.json'))
    cfg = json.load(open(cfg_p, encoding='utf-8'))
    only = argv[argv.index('--game') + 1] if '--game' in argv else None
    deploy = '--deploy' in argv
    src_dir = os.path.join(ROOT, 'saga-assets', 'web2d', 'tile')
    out_root = os.path.join(ROOT, 'tools', 'ai-art', '_out', 'terrain')
    bad = 0
    for game, pairs in cfg['games'].items():
        if only and game != only:
            continue
        spec = {'K': 'K-0162', 'scheme': 'wang16-corner-dualgrid', 'px': PX, 'atlas': '4x4', 'gutter': GUT, 'stride': PX + 2 * GUT,
                'rect': '칸 i 자리 = x (i%4)*stride+gutter · y (i//4)*stride+gutter · 크기 px×px(여백은 거울 — 그리지 않는다)',
                'index': 'i = NW*1 + NE*2 + SW*4 + SE*8 (비트 = 그 모서리 칸이 a) · 열 = i%4 · 행 = i//4 · 0 = 전부 b · 15 = 전부 a',
                'draw': '칸 격자에서 반 칸(왼쪽 위로) 밀린 격자에 그린다 — 그린 칸 (x,y) 의 네 모서리 = 땅 칸 (x,y)·(x+1,y)·(x,y+1)·(x+1,y+1). 결은 PX 주기 이음매 없음이라 어느 칸끼리 붙여도 이어진다',
                'pairs': {}}
        for p in pairs:
            A = load(os.path.join(src_dir, p['a'] + '.webp'))
            B = load(os.path.join(src_dir, p['b'] + '.webp'))
            seed = sum(map(ord, game + p['pair'])) * 131
            od = os.path.join(out_root, game, p['pair'])
            os.makedirs(od, exist_ok=True)
            ap = os.path.join(od, 'atlas.webp')
            wang_atlas(A, B, p['edge'], seed).save(ap, 'WEBP', quality=86, method=6)
            tiles = atlas_tiles(Image.open(ap))
            worst, inner = seam_check(tiles)
            ok = worst <= 4.0
            bad += 0 if ok else 1
            preview(tiles, seed).save(os.path.join(od, 'preview.png'))
            print('WANG16 %s/%s seam_excess=%.2f inner=%.1f %s %dKB' % (game, p['pair'], worst, inner, 'OK' if ok else 'FAIL', os.path.getsize(ap) // 1024))
            spec['pairs'][p['pair']] = {'atlas': p['pair'] + '/atlas.webp', 'a': p['a'], 'b': p['b'], 'edge': p['edge'],
                                        'kinds_a': p['kinds_a'], 'kinds_b': p['kinds_b'], 'seam_excess': round(worst, 2)}
            lic = {'id': '%s/%s' % (game, p['pair']), 'generator': 'tools/ai-art/edge_tiles.py --pairs (코드 합성 — 새 그림 없음, GPU 안 씀)',
                   'sources': ['saga-assets/web2d/tile/%s.webp' % p['a'], 'saga-assets/web2d/tile/%s.webp' % p['b']],
                   'model': ', '.join(sorted({_srclic(src_dir, p[k]).get('model', '?') for k in ('a', 'b')})),
                   'model_license': ', '.join(sorted({_srclic(src_dir, p[k]).get('model_license', '?') for k in ('a', 'b')})),
                   'license': '원본 두 장의 라이선스를 따른다(자체 AI 생성 — 상업 허용 모델) · 합성 코드는 이 저장소 것',
                   'derived': '16칸 모서리 꼴 이음(쌍선형 경계 + 주기 잡음, 경계 %s)' % p['edge'], 'date': '2026-10-21', 'ticket': 'K-0162'}
            json.dump(lic, open(os.path.join(od, 'atlas.license.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
        json.dump(spec, open(os.path.join(out_root, game, 'tiles.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
        if deploy:
            dst = os.path.join(ROOT, 'saga-assets', 'web2d', 'terrain', game)
            for p in pairs:
                os.makedirs(os.path.join(dst, p['pair']), exist_ok=True)
                for fn in ('atlas.webp', 'atlas.license.json'):
                    shutil.copyfile(os.path.join(out_root, game, p['pair'], fn), os.path.join(dst, p['pair'], fn))
            shutil.copyfile(os.path.join(out_root, game, 'tiles.json'), os.path.join(dst, 'tiles.json'))
            print('DEPLOY_CANON', dst)
    print('WANG16_RESULT', ('FAIL %d' % bad) if bad else 'OK')
    return 1 if bad else 0


if __name__ == '__main__':
    if '--pairs' in sys.argv:
        sys.exit(wang_main(sys.argv[1:]))
    main()
