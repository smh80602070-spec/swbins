"""K-0188 ② 옆모습 고르기 판 — 초상 · 일러스트 스탠딩 · 옆모습 6변주(같은 사람·오른쪽 봄·발 보임)."""
import os, sys
from PIL import Image, ImageDraw
R = r'C:\swbins'
ids, out = sys.argv[1].split(','), sys.argv[2]
C = 260
sh = Image.new('RGB', (C * 8, (int(C * 1.5) + 16) * len(ids)), 'white'); d = ImageDraw.Draw(sh)
for r, i in enumerate(ids):
    y = r * (int(C * 1.5) + 16)
    cells = [Image.open(os.path.join(R, 'saga-assets', 'portraits-hero', i + '_c.webp')).convert('RGB')]
    st = os.path.join(R, 'saga-assets', 'illust', 'shared', i, 'stand.webp')
    cells.append(Image.alpha_composite(Image.new('RGBA', Image.open(st).size, (235, 235, 235, 255)), Image.open(st).convert('RGBA')).convert('RGB') if os.path.exists(st) else Image.new('RGB', (C, C), 'gray'))
    for k in range(1, 7):
        p = os.path.join(R, 'tools', 'ai-art', '_out', 'k188', 'side', f'{i}_side_v{k:02d}.png')
        cells.append(Image.open(p).convert('RGB') if os.path.exists(p) else Image.new('RGB', (C, C), (90, 0, 0)))
    for k, c in enumerate(cells):
        c.thumbnail((C, int(C * 1.5))); sh.paste(c, (k * C, y + 16))
    d.text((2, y + 2), f'{i}   por | stand | v01 … v06', fill=(0, 0, 0))
sh.save(out, quality=84); print(out)
