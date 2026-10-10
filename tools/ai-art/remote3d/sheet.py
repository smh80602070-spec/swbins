"""K-0096 — 받은 GLB 를 네 방향(0·90·180·300°)으로 렌더해 입력 그림과 한 장에 모은다(눈 판정용).

  py tools/ai-art/remote3d/sheet.py <GLB 폴더> [--in <입력 그림 폴더>] [--size 320]   → <GLB 폴더>/sheet.png (+ views/)

render_sprite.py 에는 절대 경로를 넘긴다(상대 경로면 Blender 가 드라이브 루트에 쓴다). Blender 는 </dev/null 과 같게 stdin 을 닫는다.
"""
import glob
import os
import subprocess
import sys

from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
RS = os.path.abspath(os.path.join(HERE, '..', '..', 'world-forge', 'render_sprite.py'))
B = os.environ.get('BLENDER', r'C:\Program Files\Blender Foundation\Blender 5.2\blender.exe')
AZ = (0, 90, 180, 300)
BG = (200, 205, 212)


def main():
    a = sys.argv[1:]
    opt = lambda k, d=None: a[a.index(k) + 1] if k in a else d
    d = os.path.abspath(a[0])
    src = opt('--in')
    px = int(opt('--size', '320'))
    vd = os.path.join(d, 'views')
    os.makedirs(vd, exist_ok=True)
    ids = sorted(os.path.splitext(os.path.basename(f))[0] for f in glob.glob(os.path.join(d, '*.glb')))
    for i in ids:
        for az in AZ:
            out = os.path.join(vd, '%s_%d.png' % (i, az))
            if not os.path.exists(out):
                subprocess.run([B, '-b', '--factory-startup', '-P', RS, '--', out, os.path.join(d, i + '.glb'), '--size', str(px), '--az', str(az), '--el', '15'],
                               stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    cols = len(AZ) + (1 if src else 0)
    sheet = Image.new('RGB', (px * cols, px * len(ids)), BG)
    dr = ImageDraw.Draw(sheet)
    for r, i in enumerate(ids):
        c0 = 0
        if src and os.path.exists(os.path.join(src, i + '.png')):
            im = Image.open(os.path.join(src, i + '.png')).convert('RGB')
            im.thumbnail((px, px))
            sheet.paste(im, (0, px * r))
        if src:
            c0 = 1
        for c, az in enumerate(AZ):
            p = os.path.join(vd, '%s_%d.png' % (i, az))
            if os.path.exists(p):
                im = Image.open(p).convert('RGBA')
                bg = Image.new('RGBA', im.size, BG + (255,))
                bg.alpha_composite(im)
                sheet.paste(bg.convert('RGB').resize((px, px)), (px * (c0 + c), px * r))
        dr.text((4, px * r + 4), i, fill=(0, 0, 0))
    sheet.save(os.path.join(d, 'sheet.png'))
    print('SHEET', len(ids), os.path.join(d, 'sheet.png'))


if __name__ == '__main__':
    main()
