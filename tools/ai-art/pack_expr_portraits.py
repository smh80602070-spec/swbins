"""K-0047 표정 초상 → 정본 `saga-assets/portraits-expr/<id>__<표정>_c.webp`(카드 300×344, 도감 `_c` 와 같은 자르기) + `.license.json`.

  py tools/ai-art/pack_expr_portraits.py [--check]

입력: `data/expression_plan.json`(주역·표정) · 고른 판 `data/k47_expr_picks.json` {"<id>__<표정>": "first"|"redo"}(없으면 first)
  first = `_out/k47_expr`(denoise 0.42) · redo = `_out/k47_expr_redo`(약한 슬픔·놀람만, 0.5·무게 1.4)
`--check` = 쓰지 않고 빠진 그림·출처만 센다. 배치는 `tools/asset-place` 의 portraits-expr-<판> 항목(cast 의 game 판에만).
"""
import json
import os
import sys

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, '..', '..')
DEST = os.path.join(ROOT, 'saga-assets', 'portraits-expr')
SRC = {'first': os.path.join(HERE, '_out', 'k47_expr'), 'redo': os.path.join(HERE, '_out', 'k47_expr_redo')}
CARD_BOX = (34, 24, 734, 827)    # pack_web_portraits.py 와 같은 틀 — 700x803 -> 300x344


def main():
    check = '--check' in sys.argv[1:]
    cast = json.load(open(os.path.join(HERE, 'data', 'expression_plan.json'), encoding='utf-8'))['cast']
    pp = os.path.join(HERE, 'data', 'k47_expr_picks.json')
    picks = json.load(open(pp, encoding='utf-8')).get('picks', {}) if os.path.exists(pp) else {}
    os.makedirs(DEST, exist_ok=True)
    n, miss = 0, []
    for c in cast:
        for e in c['expressions']:
            k = '%s__%s' % (c['id'], e)
            src = os.path.join(SRC[picks.get(k, 'first')], k + '.png')
            lp = src[:-4] + '.license.json'
            if not (os.path.exists(src) and os.path.exists(lp)):
                miss.append(k)
                continue
            lic = json.load(open(lp, encoding='utf-8'))
            if 'CC0' not in lic.get('base_license', ''):
                miss.append(k + '(출처)')
                continue
            n += 1
            if check:
                continue
            Image.open(src).convert('RGB').crop(CARD_BOX).resize((300, 344), Image.LANCZOS).save(
                os.path.join(DEST, k + '_c.webp'), 'WEBP', quality=84, method=6)
            lic.update(id=k + '_c', hero=c['id'], expr=e, game=c['game'], size=[300, 344],
                       packed='tools/ai-art/pack_expr_portraits.py (CARD_BOX %s → 300x344, 판 %s)' % (list(CARD_BOX), picks.get(k, 'first')))
            json.dump(lic, open(os.path.join(DEST, k + '_c.license.json'), 'w', encoding='utf-8', newline='\n'), ensure_ascii=False, indent=1)
    print('EXPR_PACK', n, '빠짐', len(miss), miss[:8])
    sys.exit(1 if miss else 0)


if __name__ == '__main__':
    main()
