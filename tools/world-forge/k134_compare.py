"""K-0134 3단계 — 짐승 2D 옛(K-0114, 검은 몸)·새(K-0133 고친 몸) 나란히 시트.
  py tools/world-forge/k134_compare.py <옛 폴더> <새 폴더> <출력.jpg> [--n 24]
옛·새 폴더는 같은 상대 경로 이름(beast/*.png, beast/animals/*.png)을 가진다. 체크무늬 위에 옛|새 한 쌍씩, 이름 아래.
"""
import os
import sys

from PIL import Image, ImageDraw

old_dir, new_dir, out = sys.argv[1:4]
n = int(sys.argv[sys.argv.index('--n') + 1]) if '--n' in sys.argv else 24
names = []
for root, _, files in os.walk(new_dir):
    for f in sorted(files):
        if f.endswith('.png'):
            rel = os.path.relpath(os.path.join(root, f), new_dir)
            if os.path.exists(os.path.join(old_dir, rel)):
                names.append(rel)
sheets = [x for x in names if os.sep + 'animals' + os.sep in os.sep + x or x.startswith('animals')]
pick = sheets + [x for x in names if x not in sheets][: max(0, n - len(sheets))]
C, cols = 120, 4


def checker(w, h):
    im = Image.new('RGB', (w, h), (200, 200, 200))
    d = ImageDraw.Draw(im)
    for y in range(0, h, 10):
        for x in range(0, w, 10):
            if (x // 10 + y // 10) % 2:
                d.rectangle([x, y, x + 9, y + 9], fill=(235, 235, 235))
    return im


rows = (len(pick) + cols - 1) // cols
sheet = Image.new('RGB', (cols * (2 * C + 10), rows * (C + 16)), (40, 40, 48))
d = ImageDraw.Draw(sheet)
for i, rel in enumerate(pick):
    x0, y0 = (i % cols) * (2 * C + 10), (i // cols) * (C + 16)
    for j, base in enumerate((old_dir, new_dir)):
        im = Image.open(os.path.join(base, rel)).convert('RGBA')
        im.thumbnail((C - 4, C - 4), Image.NEAREST if max(im.size) < C else Image.LANCZOS)
        if max(im.size) < C // 2:
            k = (C - 4) // max(im.size)
            im = im.resize((im.width * k, im.height * k), Image.NEAREST)
        bg = checker(C, C)
        bg.paste(im, ((C - im.width) // 2, (C - im.height) // 2), im)
        sheet.paste(bg, (x0 + j * C, y0))
    d.text((x0 + 2, y0 + C + 2), rel.replace(os.sep, '/')[:38], fill=(230, 230, 230))
sheet.save(out, quality=88)
print('K134_SHEET', len(pick), out)
