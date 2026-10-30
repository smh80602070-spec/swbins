"""K-0202 ④ — 판마다 결이 다른 UI 아이콘 후처리. 흰 배경 제거(matte2) → 알맹이 bbox → 정사각 여백 → 128·64px 투명 PNG.

  py tools/ai-art/k202_icon_pack.py go <입력폴더> [<입력폴더> …] [--out <폴더>] [--sheet <PNG>]
      입력 = gen.py 산출(ic_<판>_<이름>[_v01].png). 같은 이름 후보가 여럿이면 `_v01` 을 쓴다(`--pick 이름=_v02` 로 바꿈).
      → <out>/<판>/<이름>_128.png · _64.png + <이름>.license.json  (기본 out = saga-assets/icons/glyph)

gen.py 의 .license.json(모델·프롬프트·씨앗)을 이어받아 note 에 후처리를 적는다.
"""
import glob
import json
import os
import re
import sys

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
sys.path.insert(0, HERE)
from matte_util import matte2  # noqa: E402


def pack(game, dirs, out, picks):
    seen = {}
    for d in dirs:
        for f in sorted(glob.glob(os.path.join(d, 'ic_%s_*.png' % game))):
            m = re.match(r'ic_%s_(.+?)(_v\d\d)?\.png$' % game, os.path.basename(f))
            name, v = m.group(1), m.group(2) or ''
            if name in picks and v != picks[name]:
                continue
            if name in seen and not (name in picks):
                continue
            seen[name] = f
    odir = os.path.join(out, game)
    os.makedirs(odir, exist_ok=True)
    done = []
    for name, f in sorted(seen.items()):
        im = matte2(Image.open(f).convert('RGBA'))
        bb = im.getchannel('A').point(lambda v: 255 if v > 24 else 0).getbbox()
        if not bb:
            print('빈 그림', name)
            continue
        im = im.crop(bb)
        s = max(im.size)
        pad = int(s * 0.08)
        sq = Image.new('RGBA', (s + pad * 2, s + pad * 2), (0, 0, 0, 0))
        sq.paste(im, ((sq.width - im.width) // 2, (sq.height - im.height) // 2), im)
        sq.resize((128, 128), Image.LANCZOS).save(os.path.join(odir, name + '_128.png'), optimize=True)
        sq.resize((64, 64), Image.LANCZOS).save(os.path.join(odir, name + '_64.png'), optimize=True)
        src_lic = os.path.splitext(f)[0] + '.license.json'
        lic = json.load(open(src_lic, encoding='utf-8')) if os.path.exists(src_lic) else {}
        lic['id'] = 'glyph/%s/%s' % (game, name)
        lic['note'] = 'K-0202 ④ UI 아이콘(%s) — 흰 배경 제거·정사각 128·64 (k202_icon_pack.py)' % game
        json.dump(lic, open(os.path.join(odir, name + '.license.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
        done.append(name)
    return done


def sheet(game, out, names, path):
    odir = os.path.join(out, game)
    cols = 10
    rows = (len(names) + cols - 1) // cols
    S = Image.new('RGBA', (cols * 76 + 8, rows * 76 + 8), (200, 190, 168, 255))
    for i, n in enumerate(names):
        im = Image.open(os.path.join(odir, n + '_64.png')).convert('RGBA')
        S.alpha_composite(im, (8 + (i % cols) * 76, 8 + (i // cols) * 76))
    S.convert('RGB').save(path)


if __name__ == '__main__':
    args = sys.argv[1:]
    out = os.path.join(ROOT, 'saga-assets', 'icons', 'glyph')
    sheet_path = None
    picks = {}
    pos = []
    i = 0
    while i < len(args):
        if args[i] == '--out':
            out = args[i + 1]
            i += 2
        elif args[i] == '--sheet':
            sheet_path = args[i + 1]
            i += 2
        elif args[i] == '--pick':
            k, v = args[i + 1].split('=')
            picks[k] = v
            i += 2
        else:
            pos.append(args[i])
            i += 1
    game, dirs = pos[0], pos[1:]
    names = pack(game, dirs, out, picks)
    print('K202_ICONS', game, len(names))
    if sheet_path:
        sheet(game, out, names, sheet_path)
