"""K-0112 등신 눈 자 — 포장된 <풀>/<방향>.webp 를 키 480px 로 키워 1/16 눈금(번호)을 붙인다 — 턱이 몇 번 칸에서 끝나는지 눈으로 읽어 등신 = 16 / 턱 눈금.
py tools/ai-art/heads_ruler.py <포장폴더> <출력.jpg> [방향=front]
--heads(실루엣 측정)는 모자·두건·수염·말에 흔들려 판정 못 씀 → 이 판으로 Claude 가 머리 꼭대기·턱 칸을 읽는다(창끝·모자 빼고)."""
import os
import sys
from PIL import Image, ImageDraw
src, out = sys.argv[1], sys.argv[2]
view = sys.argv[3] if len(sys.argv) > 3 else 'front'
pools = sorted(d for d in os.listdir(src) if os.path.isfile(os.path.join(src, d, view + '.webp')))
H, W = 480, 300
sheet = Image.new('RGB', (W * len(pools), H + 40), (40, 44, 52))
d = ImageDraw.Draw(sheet)
for i, p in enumerate(pools):
    im = Image.open(os.path.join(src, p, view + '.webp')).convert('RGBA')
    bb = im.getchannel('A').point(lambda x: 255 if x > 24 else 0).getbbox()
    im = im.crop(bb)
    s = H / im.height
    im = im.resize((max(1, int(im.width * s)), H))
    if im.width > W - 30:
        im = im.resize((W - 30, int(H * (W - 30) / im.width)))
    x0, y0 = i * W + 28, 30
    sheet.paste(im, (x0, y0), im)
    hh = im.height
    for k in range(17):
        y = y0 + int(hh * k / 16)
        d.line((i * W, y, i * W + 24, y), fill=(255, 220, 80) if k % 2 == 0 else (150, 140, 90))
        d.line((x0, y, x0 + im.width, y), fill=(255, 220, 80, 60) if k % 2 == 0 else (110, 110, 90))
        d.text((i * W + 2, y - 6), str(k), fill=(255, 255, 255))
    d.text((i * W + 4, 4), p[:30], fill=(230, 230, 230))
sheet.save(out, quality=90)
print(out, sheet.size, pools)
