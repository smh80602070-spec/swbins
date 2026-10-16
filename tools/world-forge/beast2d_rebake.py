"""짐승 2D 다시 굽기 (K-0114) — 빌린 3D 로 구웠던 웹 짐승 그림을 자체 creatures3d 몸으로.

    py tools/world-forge/beast2d_rebake.py [--only 이름,이름] [--sheet 시트.png]
    py tools/world-forge/beast2d_rebake.py --sheets [--only 종류] [--sheet 비교.png]   # 3마을 들짐승 동작 시트(render_sheet.py)

짝 표 `tools/world-forge/data/k114_beasts.json`(옛 파일 → creatures3d id, null = 자체 몸 없음 → 옛 그림 그대로).
몸마다 Blender(`render_sprite.py`, 옆모습 — 오른쪽을 본다)로 512 렌더 → 알파 상자로 잘라 **옛 그림의 상자 안에 비율 그대로**
맞춰 넣는다(바닥·가운데 정렬, 그림 크기 그대로 — 코드는 이름으로 부르므로 0줄). 결과 = 정본 `saga-assets/sprites2d-creatures/beast/`
(+ 옆 license.json) — 트랙 자리는 `tools/asset-place/place.py --write`. Blender 는 한 번에 하나씩.
"""
import json
import os
import subprocess
import sys

from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
TABLE = os.path.join(ROOT, 'tools', 'world-forge', 'data', 'k114_beasts.json')
OUT = os.path.join(ROOT, 'saga-assets', 'sprites2d-creatures', 'beast')
CRE = os.path.join(ROOT, 'saga-web', 'shared', 'assets', 'creatures3d')
BLENDER = os.environ.get('BLENDER', r'C:\Program Files\Blender Foundation\Blender 5.2\blender.exe')
TMP = os.path.join(ROOT, 'tools', 'world-forge', '_out', 'k114')


def render(cid, az, el):
    os.makedirs(TMP, exist_ok=True)
    out = os.path.join(TMP, f'{cid}_{int(az)}_{int(el)}t.png')
    if not os.path.exists(out):
        subprocess.run([BLENDER, '-b', '--factory-startup', '-P', os.path.join(ROOT, 'tools', 'world-forge', 'render_sprite.py'),
                        '--', out, os.path.join(CRE, cid + '.glb'), '--size', '512', '--az', str(az), '--el', str(el), '--tight'],
                       stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)
    return Image.open(out).convert('RGBA')


def fit(new, old):
    """new(알파 상자로 자름)를 old 그림의 알파 상자 안에 비율 그대로 — 바닥·가운데 정렬"""
    nb = new.getbbox()
    ob = old.getbbox() or (0, 0) + old.size
    crop = new.crop(nb)
    bw, bh = ob[2] - ob[0], ob[3] - ob[1]
    W, H = old.size
    # 옛 상자 안 맞춤은 몸 비율이 다른 종(가로 긴 옛 → 세로 선 새)을 점으로 만든다 — 옛과 같은 넓이까지는 키우되 칸(여백 2)은 안 넘김
    s_box = min(bw / crop.width, bh / crop.height)
    s_area = (bw * bh / (crop.width * crop.height)) ** 0.5
    s_can = min((W - 4) / crop.width, (H - 4) / crop.height)
    s = min(s_can, max(s_box, s_area))
    w, h = max(1, round(crop.width * s)), max(1, round(crop.height * s))
    crop = crop.resize((w, h), Image.LANCZOS)
    canvas = Image.new('RGBA', old.size, (0, 0, 0, 0))
    x = min(max(2, ob[0] + (bw - w) // 2), W - 2 - w)
    y = max(2, ob[3] - h)
    canvas.alpha_composite(crop, (x, y))
    return canvas


def bake_sheet(row):
    """3마을 시트 — 4줄(0 서기·왼 / 1 서기·오른 / 2 달리기·왼 / 3 달리기·오른) × 4컷, 컷 cw×ch"""
    cw, ch, cid = row['cw'], row['ch'], row['id']
    d = os.path.join(TMP, f'sheet_{cid}_{cw}x{ch}')
    if not os.path.exists(os.path.join(d, 'run_3.png')):
        subprocess.run([BLENDER, '-b', '--factory-startup', '-P', os.path.join(ROOT, 'tools', 'world-forge', 'render_sheet.py'),
                        '--', d, os.path.join(CRE, cid + '.glb'), '--cw', str(cw), '--ch', str(ch)],
                       stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)
    def build(flip_even):
        sheet_im = Image.new('RGBA', (cw * 4, ch * 4), (0, 0, 0, 0))
        for r in range(4):
            for f in range(4):
                im = Image.open(os.path.join(d, f"{'idle' if r < 2 else 'run'}_{f}.png")).convert('RGBA').resize((cw, ch), Image.LANCZOS)
                if (r % 2 == 0) == flip_even:
                    im = im.transpose(Image.FLIP_LEFT_RIGHT)
                sheet_im.alpha_composite(im, (f * cw, r * ch))
        return sheet_im
    # render_sheet.py 원본 컷은 머리가 왼쪽(카메라 +X) — 왼쪽 줄(0·2)은 그대로, 오른쪽 줄(1·3)을 뒤집는다(눈으로 확인 10-16)
    return build(False)


def main():
    t = json.load(open(TABLE, encoding='utf-8'))
    if '--sheets' in sys.argv:
        only = set(sys.argv[sys.argv.index('--only') + 1].split(',')) if '--only' in sys.argv else None
        pairs = []
        for row in t['sheets']:
            if only and row['name'] not in only:
                continue
            new = bake_sheet(row)
            old = Image.open(os.path.join(ROOT, row['old'])).convert('RGBA')
            assert new.size == old.size, (row['name'], new.size, old.size)
            dst = os.path.join(OUT, row['out'])
            os.makedirs(os.path.dirname(dst), exist_ok=True)
            new.save(dst, optimize=True)
            json.dump({'id': row['name'], 'generator': 'tools/world-forge/beast2d_rebake.py --sheets (Blender render_sheet.py, Idle·Run 4컷)',
                       'source': f"self: creatures3d/{row['id']}", 'license': 'CC0-1.0 (자체 3D 몸 렌더 — 외부 입력 없음, 몸 출처는 creatures3d license)',
                       'ticket': 'K-0114'}, open(os.path.splitext(dst)[0] + '.license.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
            pairs.append((old, new, row['name']))
        print(f'K-0114 시트 {len(pairs)}')
        if '--sheet' in sys.argv:
            p = sys.argv[sys.argv.index('--sheet') + 1]
            W = max(o.width for o, _, _ in pairs) * 2 + 20
            im = Image.new('RGBA', (W * 2, sum(o.height * 2 + 10 for o, _, _ in pairs)), (205, 210, 200, 255))
            y = 0
            for o, n, _ in pairs:
                im.alpha_composite(o.resize((o.width * 2, o.height * 2), Image.NEAREST), (0, y))
                im.alpha_composite(n.resize((n.width * 2, n.height * 2), Image.NEAREST), (W, y))
                y += o.height * 2 + 10
            im.save(p)
        return
    only = set(sys.argv[sys.argv.index('--only') + 1].split(',')) if '--only' in sys.argv else None
    az, el = t.get('az', 90), t.get('el', 12)
    os.makedirs(OUT, exist_ok=True)
    done, skip = 0, []
    pairs = []
    for row in t['rows']:
        name, cid = row['name'], row['id']
        if only and name not in only:
            continue
        if not cid:
            skip.append(name)
            continue
        old = Image.open(os.path.join(ROOT, row['old'])).convert('RGBA')
        new = fit(render(cid, row.get('az', az), row.get('el', el)), old)
        dst = os.path.join(OUT, row['out'])
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        new.save(dst, optimize=True)
        lic = os.path.splitext(dst)[0] + '.license.json'
        json.dump({'id': os.path.splitext(row['out'])[0], 'generator': 'tools/world-forge/beast2d_rebake.py (Blender render_sprite.py)',
                   'source': f'self: creatures3d/{cid}', 'license': 'CC0-1.0 (자체 3D 몸 렌더 — 외부 입력 없음, 몸 출처는 creatures3d license)',
                   'ticket': 'K-0114'}, open(lic, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
        pairs.append((old, new, name))
        done += 1
    print(f'K-0114 구움 {done} · 자체 몸 없음 {len(skip)}: {", ".join(skip)}')
    if '--sheet' in sys.argv:
        sheet(sys.argv[sys.argv.index('--sheet') + 1], pairs)


def sheet(path, pairs, cols=6, cell=160):
    """옛·새 쌍 시트 — 칸마다 위 옛, 아래 새"""
    rows = (len(pairs) + cols - 1) // cols
    im = Image.new('RGBA', (cols * cell, rows * cell * 2), (205, 210, 200, 255))
    for i, (o, n, _) in enumerate(pairs):
        x, y = (i % cols) * cell, (i // cols) * cell * 2
        im.alpha_composite(o.resize((cell, cell), Image.NEAREST), (x, y))
        im.alpha_composite(n.resize((cell, cell), Image.LANCZOS), (x, y + cell))
    im.save(path)


if __name__ == '__main__':
    main()
