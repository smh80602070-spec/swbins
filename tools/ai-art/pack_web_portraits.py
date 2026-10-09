"""AI 초상(_out/web_heroes_105) → 웹 다섯 판의 도감 초상 webp 로 자르고 굽는다.

  py tools/ai-art/pack_web_portraits.py [--games saga-go,saga-dungeon,...] [--only id,id] [--src web_dungeon_30|web_realm_194] [--preview 경로]

`--dest <폴더>`(K-0027): 판 폴더 대신 정본(예 saga-assets/portraits-hero)에 **새 인물도** 쓴다 → place portraits-hero 로 다섯 판 →
같은 명령을 `--dest` 없이 한 번 더 돌리면 판마다 `_ai_provenance.json` 에 합쳐진다(같은 입력이라 webp 는 같은 바이트).
`--src` 는 `_out/` 아래 폴더 이름(기본 web_heroes_105, 파일명 `hero_<id>.png`). 던전 30·국지 194 는 파일명이 `<id>.png` 이고 그 판에만 있는 인물이라 `--games` 도 함께.
출처 표는 `_ai_provenance.json` 에 **합쳐 쓴다**(도감 105 표를 지우지 않는다).

게임은 `assets/portraits/hero/<id>_s.webp`(정사각 192)·`<id>_c.webp`(카드 300×344)를 그대로 `<img>` 로 쓴다(manifest.js 에 적힌 id 만) —
이름·크기만 맞추면 게임 코드는 안 바뀐다. 다섯 판 모두 도감 105 id 를 갖고 있다(던전은 미래 인물 30·국지는 장수 194 를 따로 더 갖는데 그건 건드리지 않는다).
되돌리기 = git 에서 옛 webp 복구(웹 초상 파일은 추적된다).
출처: 각 판 `assets/portraits/hero/_ai_provenance.json` 한 장(모델·라이선스·씨앗 표) + 그림별 원본 `.license.json` 은 tools/ai-art/_out 에 둔다.
"""
import glob
import json
import os
import sys

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, '_out', 'web_heroes_105')
WEB = os.path.join(HERE, '..', '..', 'saga-web')
GAMES = ['saga-go', 'saga-dungeon', 'saga-forest', 'saga-story', 'saga-realm']
# 768x1024 원본에서 얼굴이 위쪽 가운데 — 정사각은 얼굴 중심, 카드는 어깨까지
SQ_BOX = (48, 40, 720, 712)      # 672x672 -> 192
CARD_BOX = (34, 24, 734, 827)    # 700x803 -> 300x344 (비율 150:172)


def crops(im):
    s = im.crop(SQ_BOX).resize((192, 192), Image.LANCZOS)
    c = im.crop(CARD_BOX).resize((300, 344), Image.LANCZOS)
    return s, c


def main():
    a = sys.argv[1:]
    opt = lambda k, d: a[a.index(k) + 1] if k in a else d
    games = opt('--games', ','.join(GAMES)).split(',')
    only = set(opt('--only', '').split(',')) - {''}
    src = os.path.join(HERE, '_out', opt('--src', 'web_heroes_105'))
    files = sorted(f for f in glob.glob(os.path.join(src, '*.png')) if not f.endswith('.old.png'))
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
        hid = os.path.basename(f)[:-4]
        if hid.startswith('hero_'):
            hid = hid[5:]
        if only and hid not in only:
            continue
        lic = json.load(open(f[:-4] + '.license.json', encoding='utf-8'))
        prov[hid] = {'model': lic['model'], 'license': lic['model_license'], 'seed': lic['seed'], 'date': lic['date']}
        if lic.get('mode') == 'img2img':      # 밑그림 = 공방 몸 렌더(입력 전부 CC0)
            prov[hid].update({'mode': 'img2img', 'base_body': lic['base_body'], 'base_license': lic['base_license'], 'denoise': lic['denoise']})
        s, c = crops(Image.open(f).convert('RGB'))
        if opt('--dest', ''):
            s.save(os.path.join(opt('--dest', ''), hid + '_s.webp'), 'WEBP', quality=84, method=6)
            c.save(os.path.join(opt('--dest', ''), hid + '_c.webp'), 'WEBP', quality=84, method=6)
            continue
        for g in games:
            d = os.path.join(WEB, g, 'assets', 'portraits', 'hero')
            if not os.path.exists(os.path.join(d, hid + '_s.webp')):
                continue          # 그 판에 없는 인물은 건드리지 않는다
            s.save(os.path.join(d, hid + '_s.webp'), 'WEBP', quality=84, method=6)
            c.save(os.path.join(d, hid + '_c.webp'), 'WEBP', quality=84, method=6)
    for g in ([None] if opt('--dest', '') else games):
        d = opt('--dest', '') if g is None else os.path.join(WEB, g, 'assets', 'portraits', 'hero')
        pj = os.path.join(d, '_ai_provenance.json')
        items = json.load(open(pj, encoding='utf-8')).get('items', {}) if os.path.exists(pj) else {}
        items.update({k: v for k, v in prov.items() if os.path.exists(os.path.join(d, k + '_s.webp'))})
        json.dump({'note': 'AI 생성 초상 — tools/ai-art (swbins3 ComfyUI, 상업 허용 모델). 프롬프트는 tools/ai-art/batches/web_heroes_105.json',
                   'items': items}, open(pj, 'w', encoding='utf-8'), ensure_ascii=False, indent=0)
    print('packed', len(prov), 'heroes ->', games)


if __name__ == '__main__':
    main()
