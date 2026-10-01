"""K-0015 단계 5 — 배경 한 장을 좌우 스크롤용 3층(far·mid·near)으로 나눈다.

py tools/ai-art/split_bg_layers.py <그림.png|폴더> [출력폴더]
 far  = 그림 전체(가장 느리게)           mid  = 아래 40%, 위쪽 가장자리가 투명하게 번짐(중간 속도)
 near = 아래 14%, 위쪽이 번지고 살짝 어둡게(가장 빠르게, 캐릭터 발 앞에 그린다)
 셋 다 좌우로 이어 붙을 수 있게 원본 + 좌우 뒤집은 사본 = 가로 2배(왕복 반복). WebP, 960x540 기준.
 layers.json: 층별 y·높이·속도 비율(far 0.2 · mid 0.5 · near 1.0)
산출은 tools/ai-art/_out/bg_layers/<이름>/ (git 밖).
"""
import json
import os
import sys

from PIL import Image, ImageOps

W, H = 960, 540
SPEC = {'far': dict(y=0, h=540, feather=0, dark=1.0, speed=0.2),
        'mid': dict(y=324, h=216, feather=0.30, dark=1.0, speed=0.5),
        'near': dict(y=464, h=76, feather=0.45, dark=0.82, speed=1.0)}


def layer(img, spec):
    crop = img.crop((0, spec['y'], W, spec['y'] + spec['h'])).convert('RGBA')
    if spec['dark'] != 1.0:
        r, g, b, a = crop.split()
        rgb = Image.merge('RGB', (r, g, b)).point(lambda v: int(v * spec['dark']))
        crop = Image.merge('RGBA', (*rgb.split(), a))
    if spec['feather']:
        n = max(2, int(spec['h'] * spec['feather']))
        a = crop.getchannel('A')
        px = a.load()
        for y in range(n):
            k = int(255 * y / n)
            for x in range(W):
                px[x, y] = min(px[x, y], k)
        crop.putalpha(a)
    wide = Image.new('RGBA', (W * 2, spec['h']), (0, 0, 0, 0))
    wide.paste(crop, (0, 0))
    wide.paste(ImageOps.mirror(crop), (W, 0))        # 이음매 없이 왕복
    return wide


def split(path, outdir):
    img = Image.open(path).convert('RGB').resize((W, H))
    os.makedirs(outdir, exist_ok=True)
    meta = {}
    for name, spec in SPEC.items():
        wide = layer(img, spec)
        wide.save(os.path.join(outdir, name + '.webp'), 'WEBP', quality=78 if name == 'far' else 82, method=6)
        meta[name] = {'y': spec['y'], 'h': spec['h'], 'speed': spec['speed'], 'w': W * 2}
    json.dump(meta, open(os.path.join(outdir, 'layers.json'), 'w'), indent=1)
    return sum(os.path.getsize(os.path.join(outdir, n + '.webp')) for n in SPEC)


def main():
    src = sys.argv[1]
    out_root = sys.argv[2] if len(sys.argv) > 2 else os.path.join(os.path.dirname(os.path.abspath(__file__)), '_out', 'bg_layers')
    files = [src] if os.path.isfile(src) else sorted(os.path.join(src, f) for f in os.listdir(src) if f.startswith('bg_') and f.endswith('.png'))
    for f in files:
        name = os.path.splitext(os.path.basename(f))[0].replace('bg_', '')
        kb = split(f, os.path.join(out_root, name)) / 1024
        print(f'{name} {kb:.0f}KB')


if __name__ == '__main__':
    main()
