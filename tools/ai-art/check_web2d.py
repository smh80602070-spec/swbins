"""K-0020 점검 — 계획표·후보·최종 산출을 센다.

  py tools/ai-art/check_web2d.py                       계획표만(지역·후보·타일·층 수)
  py tools/ai-art/check_web2d.py --cand                후보 그림(_out/web2d_bg·web2d_tiles)과 .license.json 이 다 있나
  py tools/ai-art/check_web2d.py --final <폴더> [--strict]
        최종 = <폴더>/bg/<판>_<지역>_<far|mid|near>.webp + <폴더>/tile/<판>_<종류>.webp (옆에 .license.json)
        개수 · 판당·합계 용량(WebP) · 이음매 가장자리 평균차(좌우, 타일은 상하도) ≤ 한도
끝 줄 WEB2D_OK/WEB2D_FAIL, 종료 0/1.
"""
import json
import os
import sys

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
PLAN = json.load(open(os.path.join(HERE, 'data', 'web2d_plan.json'), encoding='utf-8'))
FAIL = []


def bad(m):
    FAIL.append(m)


def edge_diff(path, vertical=False):
    """이음매 판정값 → (이음매 평균차, 허용값). 허용 = max(한도, 1.35 × 그 그림의 자연 이웃 열·행 평균차).
    모래·돌처럼 알갱이가 거친 그림은 이음매가 없어도 이웃 열 차이가 크다(절대값 8 은 매끈한 그림에만 맞는다, 2026-10-02 실측)."""
    im = Image.open(path).convert('RGBA')
    a = np.asarray(im).astype(np.float32)
    pairs = [(a[:, 0], a[:, -1], np.abs(np.diff(a[:, :, :3], axis=1)).mean())]
    if vertical:
        pairs.append((a[0], a[-1], np.abs(np.diff(a[:, :, :3], axis=0)).mean()))
    worst, allow = 0.0, 0.0
    for x, y, nat in pairs:
        m = (x[:, 3] > 8) & (y[:, 3] > 8)
        if m.any():
            s = float(np.abs(x[m, :3] - y[m, :3]).mean())
            lim = max(float(PLAN['budget']['seam_max_diff']), 1.35 * float(nat))
            if s - lim > worst - allow:
                worst, allow = s, lim
    return worst, allow


def main():
    games = PLAN['games']
    layers = PLAN['layers']
    regions = [(g, r['id']) for g, s in games.items() for r in s['bg']]
    tiles = [(g, t['id']) for g, s in games.items() for t in s['tiles']]
    cand = PLAN['budget']['bg_candidates']
    if len(games) != 5:
        bad('판이 다섯이 아니다')
    for g, s in games.items():
        if len(s['bg']) != 4 or len(s['tiles']) != 6:
            bad(f'{g}: 배경 {len(s["bg"])}(규칙 4) · 타일 {len(s["tiles"])}(규칙 6)')
    ids = [f'{g}_{r}' for g, r in regions] + [f'{g}_{t}' for g, t in tiles]
    if len(set(ids)) != len(ids):
        bad('id 중복')
    print(f'plan: 지역 {len(regions)} · 후보 {len(regions) * cand} · 층 {len(regions) * len(layers)} · 타일 {len(tiles)}')

    if '--cand' in sys.argv:
        for sub, want in (('web2d_bg', [f'bg_{g}_{r}_{k}' for g, r in regions for k in range(1, cand + 1)]),
                          ('web2d_tiles', [f'tile_{g}_{t}' for g, t in tiles])):
            d = os.path.join(HERE, '_out', sub)
            have = [i for i in want if os.path.exists(os.path.join(d, i + '.png')) and os.path.exists(os.path.join(d, i + '.license.json'))]
            print(f'cand {sub}: {len(have)}/{len(want)}')
            if '--strict' in sys.argv and len(have) != len(want):
                bad(f'{sub} 후보 {len(want) - len(have)}장 빠짐')

    if '--final' in sys.argv:
        root = sys.argv[sys.argv.index('--final') + 1]
        want_bg = [f'{g}_{r}_{l}' for g, r in regions for l in layers]
        want_tile = [f'{g}_{t}' for g, t in tiles]
        per_game, total = {}, 0
        worst = 0.0
        for sub, want, vert in (('bg', want_bg, False), ('tile', want_tile, True)):
            have = 0
            for i in want:
                p = os.path.join(root, sub, i + '.webp')
                if not (os.path.exists(p) and os.path.exists(os.path.join(root, sub, i + '.license.json'))):
                    continue
                have += 1
                sz = os.path.getsize(p)
                per_game[i.split('_')[0]] = per_game.get(i.split('_')[0], 0) + sz
                total += sz
                d, allow = edge_diff(p, vertical=vert)
                worst = max(worst, d)
                if d > allow:
                    bad(f'이음매 {sub}/{i}: 평균차 {d:.1f} > 허용 {allow:.1f}')
            print(f'final {sub}: {have}/{len(want)}')
            if have != len(want):
                bad(f'{sub} 최종 {len(want) - have}장 빠짐')
        mb = {g: round(v / 1048576, 2) for g, v in per_game.items()}
        print(f'용량 판별 MB {mb} · 합계 {total / 1048576:.1f}MB · 이음매 최대 평균차 {worst:.1f}/255(허용은 그림마다 max(8, 1.35×자연 이웃차))')
        for g, v in per_game.items():
            if v / 1048576 > PLAN['budget']['per_game_mb']:
                bad(f'{g} {v / 1048576:.1f}MB > {PLAN["budget"]["per_game_mb"]}MB')
        if total / 1048576 > PLAN['budget']['total_mb']:
            bad(f'합계 {total / 1048576:.1f}MB > {PLAN["budget"]["total_mb"]}MB')

    for m in FAIL:
        print('FAIL', m)
    print('WEB2D_FAIL' if FAIL else 'WEB2D_OK')
    return 1 if FAIL else 0


if __name__ == '__main__':
    sys.exit(main())
