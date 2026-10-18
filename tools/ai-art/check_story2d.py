"""K-0135 검증 — 4종횡 2D 정본(saga-assets/web2d/story-{tile,prop,front}) 세기·크기·알파·이음.
  py tools/ai-art/check_story2d.py [--strict] [--root saga-assets/web2d]
기준: 타일 80(지역 10 × ground·wall·ground_top·plat_l·plat_m·plat_r·rope·ladder, 48×48 · plat 48×24) · 소품 50(96×96, 투명 ≥ 20%) ·
앞 층 10(1920 폭, 맨 위 두 줄 알파 평균 ≤ 128 · 맨 아래 줄 ≥ 200) · .license.json 100% · 이음: ground·wall·ground_top·plat_m 은 왼끝↔오른끝 열 차가 안쪽 이웃 열 차의 1.5배 + 2 이하,
rope·ladder 는 위↔아래 같은 기준. 끝 줄 STORY2D_OK / STORY2D_FAIL.
"""
import os
import sys

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
REG = ['forest', 'field_meadow', 'mountain_shrine', 'old_battlefield', 'cave_mouth', 'deep_cave', 'fire_gorge', 'ruined_city', 'orbital_base', 'sky_bridge']
TILES = ['ground', 'wall', 'ground_top', 'plat_l', 'plat_m', 'plat_r', 'rope', 'ladder']
PROPS = ['lamp', 'sign', 'bush', 'rock', 'crate']


def seam(a, axis):
    if axis == 0:
        a = a.transpose(1, 0, 2)
    a = a.astype(np.float32)
    d = np.abs(a[:, 0] - a[:, -1]).mean()
    base = np.abs(np.diff(a, axis=1)).mean()
    return d, base


def main():
    root = sys.argv[sys.argv.index('--root') + 1] if '--root' in sys.argv else os.path.join(ROOT, 'saga-assets', 'web2d')
    bad = []
    n = {'tile': 0, 'prop': 0, 'front': 0}
    for r in REG:
        key = 'story_' + r
        for t in TILES:
            p = os.path.join(root, 'story-tile', f'{key}-{t}.png')
            if not os.path.exists(p):
                bad.append(f'없음 {os.path.basename(p)}'); continue
            n['tile'] += 1
            im = Image.open(p).convert('RGBA')
            want = (48, 24) if t.startswith('plat') else (48, 48)
            if im.size != want:
                bad.append(f'크기 {os.path.basename(p)} {im.size}')
            a = np.asarray(im)
            if t in ('ground', 'wall', 'ground_top', 'plat_m', 'rope', 'ladder'):
                d, base = seam(a, 0 if t in ('rope', 'ladder') else 1)
                if d > base * 1.5 + 2:
                    bad.append(f'이음 {os.path.basename(p)} {d:.1f}>{base:.1f}')
            if not os.path.exists(p[:-4] + '.license.json'):
                bad.append(f'license 없음 {os.path.basename(p)}')
        for t in PROPS:
            p = os.path.join(root, 'story-prop', f'{key}-{t}.png')
            if not os.path.exists(p):
                bad.append(f'없음 {os.path.basename(p)}'); continue
            n['prop'] += 1
            im = Image.open(p).convert('RGBA')
            if im.size != (96, 96):
                bad.append(f'크기 {os.path.basename(p)} {im.size}')
            tr = (np.asarray(im.getchannel('A')) < 16).mean()
            if tr < 0.2:
                bad.append(f'투명 적음 {os.path.basename(p)} {tr:.2f}')
            if not os.path.exists(p[:-4] + '.license.json'):
                bad.append(f'license 없음 {os.path.basename(p)}')
        p = os.path.join(root, 'story-front', f'{key}_front.webp')
        if not os.path.exists(p):
            bad.append(f'없음 {os.path.basename(p)}')
        else:
            n['front'] += 1
            im = Image.open(p).convert('RGBA')
            al = np.asarray(im.getchannel('A'))
            top, bot = al[:2].mean(), al[-1].mean()
            if im.width != 1920 or top > 128 or bot < 200:
                bad.append(f'앞 층 {os.path.basename(p)} {im.size} 위 알파 {top:.0f} 아래 {bot:.0f}')
            if not os.path.exists(p[:-5] + '.license.json'):
                bad.append(f'license 없음 {os.path.basename(p)}')
    print(f"타일 {n['tile']}/80 · 소품 {n['prop']}/50 · 앞 층 {n['front']}/10 · 문제 {len(bad)}")
    for b in bad[:30]:
        print(' ', b)
    print('STORY2D_OK' if not bad else 'STORY2D_FAIL')
    sys.exit(1 if bad and '--strict' in sys.argv else 0)


if __name__ == '__main__':
    main()
