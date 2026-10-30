"""K-0196 ④ 세트 문양 — 세트 아이콘 알맹이(icons/content/set_<id>.png)를 32px 작은 표식으로 줄인다(코드만, 새 그림 없음).
  py tools/ai-art/set_marks.py            → saga-assets/icons/mark32/set_<id>.png + license/ + index.json
하는 일: 알파 바깥 여백 자르기 → 정사각 → 줄이기(LANCZOS) → 채도·대비 살짝 올림 → 1px 어두운 테두리(작은 칸 배경에서도 모양이 읽히게).
웹 배선(세트 옷 칸·도감에 붙이기)은 웹 몫 — index.json 의 "<세트 id>": "mark32/set_<id>.png".
"""
import glob
import json
import os
import re

from PIL import Image, ImageEnhance, ImageFilter

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
ICONS = os.path.join(ROOT, 'saga-assets', 'icons')
OUT = os.path.join(ICONS, 'mark32')
SIZE = 32


def mark(src):
    im = Image.open(src).convert('RGBA')
    a = im.getchannel('A').point(lambda v: 255 if v > 40 else 0)   # 옅은 번짐(흰 테두리 그림자)은 버린다
    im.putalpha(a)
    box = a.getbbox()
    im = im.crop(box)
    s = max(im.size)
    sq = Image.new('RGBA', (s, s), (0, 0, 0, 0)); sq.paste(im, ((s - im.width) // 2, (s - im.height) // 2))
    inner = SIZE - 2                                    # 테두리 자리 1px 씩
    sm = sq.resize((inner, inner), Image.LANCZOS)
    rgb = ImageEnhance.Color(sm.convert('RGB')).enhance(1.3)
    rgb = ImageEnhance.Contrast(rgb).enhance(1.18).filter(ImageFilter.UnsharpMask(radius=0.8, percent=70, threshold=2))
    fg = rgb.convert('RGBA'); fg.putalpha(sm.getchannel('A'))
    out = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))
    edge = fg.getchannel('A').filter(ImageFilter.MaxFilter(3))   # 알파를 1px 부풀린 것 = 테두리 자리
    ol = Image.new('RGBA', (inner, inner), (18, 16, 22, 255)); ol.putalpha(edge)
    out.alpha_composite(ol, (1, 1)); out.alpha_composite(fg, (1, 1))
    return out


def main():
    os.makedirs(OUT, exist_ok=True)
    idx = {}
    for f in sorted(glob.glob(os.path.join(ICONS, 'content', 'set_*.png'))):
        sid = re.sub(r'^set_|\.png$', '', os.path.basename(f))
        mark(f).save(os.path.join(OUT, f'set_{sid}.png'))
        lp = os.path.join(ICONS, 'license', f'set_{sid}.license.json')
        lic = json.load(open(lp, encoding='utf-8')) if os.path.exists(lp) else {}
        lic.update({'id': f'mark32_set_{sid}', 'derived_from': f'saga-assets/icons/content/set_{sid}.png',
                    'packed_by': 'tools/ai-art/set_marks.py(알맹이 자르기·32px 줄이기·채도 대비·1px 테두리 — 코드만)'})
        os.makedirs(os.path.join(OUT, 'license'), exist_ok=True)
        json.dump(lic, open(os.path.join(OUT, 'license', f'set_{sid}.license.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
        idx[sid] = f'mark32/set_{sid}.png'
    json.dump({'size': SIZE, 'note': 'K-0196 ④ 세트 문양 32px — 웹 배선은 웹 몫', 'marks': idx},
              open(os.path.join(OUT, 'index.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print('SET_MARKS', len(idx))


if __name__ == '__main__':
    main()
