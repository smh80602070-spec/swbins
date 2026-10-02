"""render_clip_strip.py 가 남긴 프레임 파일(<접두>__<이름>_<보기>_<번호>.png)을 줄마다 한 장으로 잇는다(시스템 파이썬, PIL).
  py tools/char-forge/render/strip_join.py <출력.png>     # 프레임 파일은 지운다
"""
import sys, os, glob, re
from PIL import Image

out = os.path.abspath(sys.argv[1])
pre = os.path.splitext(out)[0] + '__'
rows = {}
for f in sorted(glob.glob(pre + '*.png')):
    name = os.path.basename(f)[len(os.path.basename(pre)):]
    m = re.match(r'(.+)_(34|side)_(\d+)\.png$', name)
    if m:
        rows.setdefault((m.group(1), m.group(2)), {})[int(m.group(3))] = f
if not rows:
    raise SystemExit('프레임 파일 없음')
W, H = Image.open(next(iter(next(iter(rows.values())).values()))).size
n = max(len(r) for r in rows.values())
img = Image.new('RGB', (W * n, H * len(rows)), (150, 160, 175))
for r, key in enumerate(sorted(rows)):
    for i, f in rows[key].items():
        img.paste(Image.open(f).convert('RGB'), (i * W, r * H))
        os.remove(f)
img.save(out)
print('JOIN', out, len(rows), '줄')
