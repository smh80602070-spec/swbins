"""AI 펫 초상(_out/web_pets_105, 768x896) → 웹 다섯 판의 도감 초상 webp 로 굽는다.

  py tools/ai-art/pack_web_pet_portraits.py [--games saga-go,...] [--only id,id] [--preview 경로]

게임은 `assets/portraits/pet/<id>_s.webp`(정사각 192)·`<id>_c.webp`(카드 300×344)를 그대로 `<img>` 로 쓴다 — 이름·크기만 맞추면 게임 코드는 안 바뀐다.
카드는 원본 통째(비율 300:344 = 768:880 에 가깝게 아래쪽 16px 만 자름), 정사각은 가운데 768x768 을 192 로. 그 판에 없는 펫은 건드리지 않는다.
되돌리기 = git 에서 옛 webp 복구. 출처: 각 판 `assets/portraits/pet/_ai_provenance.json`.
"""
import glob
import json
import os
import sys

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, '_out', 'web_pets_105')
WEB = os.path.join(HERE, '..', '..', 'saga-web')
GAMES = ['saga-go', 'saga-dungeon', 'saga-forest', 'saga-story', 'saga-realm']


def crops(im):
    w, h = im.size                                   # 768x896
    ch = round(w * 344 / 300)                        # 880
    c = im.crop((0, 0, w, min(h, ch))).resize((300, 344), Image.LANCZOS)
    top = max(0, (h - w) // 2 - 16)
    s = im.crop((0, top, w, top + w)).resize((192, 192), Image.LANCZOS)
    return s, c


def main():
    a = sys.argv[1:]
    opt = lambda k, d: a[a.index(k) + 1] if k in a else d
    games = opt('--games', ','.join(GAMES)).split(',')
    only = set(opt('--only', '').split(',')) - {''}
    files = sorted(f for f in glob.glob(os.path.join(SRC, '*.png')) if not f.endswith('.old.png'))
    if opt('--preview', ''):
        row = [crops(Image.open(f).convert('RGB')) for f in files[:8]]
        sheet = Image.new('RGB', (300 * 8, 344 + 192))
        for i, (s, c) in enumerate(row):
            sheet.paste(c, (300 * i, 0))
            sheet.paste(s, (300 * i, 344))
        sheet.save(opt('--preview', ''), quality=88)
        return
    prov = {}
    for f in files:
        pid = os.path.basename(f)[:-4]
        if only and pid not in only:
            continue
        lic = json.load(open(f[:-4] + '.license.json', encoding='utf-8'))
        prov[pid] = {'model': lic['model'], 'license': lic['model_license'], 'seed': lic['seed'], 'date': lic['date']}
        s, c = crops(Image.open(f).convert('RGB'))
        for g in games:
            d = os.path.join(WEB, g, 'assets', 'portraits', 'pet')
            if not os.path.exists(os.path.join(d, pid + '_s.webp')):
                continue
            s.save(os.path.join(d, pid + '_s.webp'), 'WEBP', quality=84, method=6)
            c.save(os.path.join(d, pid + '_c.webp'), 'WEBP', quality=84, method=6)
    for g in games:
        d = os.path.join(WEB, g, 'assets', 'portraits', 'pet')
        if os.path.isdir(d):
            json.dump({'note': 'AI 생성 초상 — tools/ai-art (swbins3 sd-webui, 상업 허용 모델). 프롬프트는 tools/ai-art/batches/web_pets_105.json',
                       'items': prov}, open(os.path.join(d, '_ai_provenance.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=0)
    print('packed', len(prov), 'pets ->', games)


if __name__ == '__main__':
    main()
