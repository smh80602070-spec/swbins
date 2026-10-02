"""region_hero.py 결과에 번짐(블룸)·살짝 비네팅을 얹는다(PIL) — Blender 5 의 컴포지터 API 가 바뀌어 후처리는 따로 한다.
  py tools/world-forge/hero_post.py <입력.png> <출력.png> [강도=0.9]
"""
import sys
from PIL import Image, ImageFilter, ImageChops
import numpy as np

src, dst = sys.argv[1], sys.argv[2]
k = float(sys.argv[3]) if len(sys.argv) > 3 else 0.9
im = Image.open(src).convert('RGB')
a = np.asarray(im).astype(np.float32) / 255
lum = a.max(axis=2)
mask = np.clip((lum - 0.62) / 0.38, 0, 1)[..., None]
bright = Image.fromarray((a * mask * 255).astype(np.uint8))
glow = Image.new('RGB', im.size)
acc = np.zeros_like(a)
for r in (6, 18, 48):
    g = np.asarray(bright.filter(ImageFilter.GaussianBlur(r))).astype(np.float32) / 255
    acc += g * (0.5 if r < 20 else 0.6)
out = 1 - (1 - a) * (1 - np.clip(acc * k, 0, 1))
h, w = out.shape[:2]
yy, xx = np.mgrid[0:h, 0:w]
v = 1 - 0.28 * (((xx - w / 2) / (w / 2)) ** 2 + ((yy - h / 2) / (h / 2)) ** 2) ** 1.2
out *= v[..., None]
Image.fromarray((np.clip(out, 0, 1) * 255).astype(np.uint8)).save(dst)
print('SAVED', dst)
