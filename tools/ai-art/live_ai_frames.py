"""K-0110 — AI 대화 초상 인페인트 결과(batches/k110_ai_live.json → _out/k110_ai_live)를 split_portrait_layers.py 가 읽는 프레임 폴더로 모은다.
  py tools/ai-art/live_ai_frames.py [--picks tools/ai-art/data/live_ai_blink_picks.json] [--out tools/ai-art/_out/live_frames_ai] [--sheet <png>]
프레임: base = K-0047 원본(init_image) · blink = 고른 씨앗(blink_s0|s1) · blink_half · mouth_a·half·o · expr_<표정> — `<id>__<프레임>.png`
출처: `<id>__base.license.json` = 원본 license + 인페인트 배치 이름(split 이 이 파일이 있으면 AI 출처로 적는다).
--sheet 사람마다 [원본 | blink_s0 | blink_s1] 얼굴 띠(고르기용).
"""
import json
import os
import shutil
import sys

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
BATCH = os.path.join(HERE, 'batches', 'k110_ai_live.json')
SRC = os.path.join(HERE, '_out', 'k110_ai_live')
FRAMES = ['blink_half', 'mouth_a', 'mouth_half', 'mouth_o', 'expr_joy', 'expr_anger', 'expr_sorrow', 'expr_surprise']


def arg(k, d=None):
    a = sys.argv
    return a[a.index(k) + 1] if k in a else d


def main():
    sys.stdout.reconfigure(encoding='utf-8')
    items = json.load(open(BATCH, encoding='utf-8'))['items']
    init = {}
    for it in items:
        init.setdefault(it['hero'], it['init_image'])
    boxes = json.load(open(os.path.join(HERE, 'data', 'live_ai_boxes.json'), encoding='utf-8'))['boxes']
    sheet = arg('--sheet')
    if sheet:
        rows = []
        for h in init:
            if not all(os.path.exists(os.path.join(SRC, '%s__blink_s%d.png' % (h, k))) for k in (0, 1)):
                continue
            e = boxes[h]['eye']
            crop = (max(0, e[0] - 60), max(0, e[1] - 60), min(768, e[2] + 60), min(1024, e[3] + 60))
            ims = [Image.open(os.path.join(ROOT, init[h])).convert('RGB')] + \
                  [Image.open(os.path.join(SRC, '%s__blink_s%d.png' % (h, k))).convert('RGB') for k in (0, 1)]
            rows.append([im.crop(crop).resize((300, int(300 * (crop[3] - crop[1]) / (crop[2] - crop[0])))) for im in ims])
        H = sum(r[0].height + 4 for r in rows)
        s = Image.new('RGB', (900, H), (0, 0, 0))
        y = 0
        for r in rows:
            for k, im in enumerate(r):
                s.paste(im, (k * 300, y))
            y += r[0].height + 4
        s.save(sheet)
        print("SHEET", sheet, len(rows), "/", len(init))
        return
    picks = json.load(open(os.path.join(ROOT, arg('--picks', 'tools/ai-art/data/live_ai_blink_picks.json')), encoding='utf-8'))['picks']
    out = os.path.join(ROOT, arg('--out', 'tools/ai-art/_out/live_frames_ai'))
    os.makedirs(out, exist_ok=True)
    n = 0
    for h, src in init.items():
        if h not in picks:
            print('고른 눈 감음 없음 — 건너뜀', h)
            continue
        shutil.copy(os.path.join(ROOT, src), os.path.join(out, h + '__base.png'))
        shutil.copy(os.path.join(SRC, '%s__blink_s%d.png' % (h, picks[h])), os.path.join(out, h + '__blink.png'))
        for f in FRAMES:
            shutil.copy(os.path.join(SRC, '%s__%s.png' % (h, f)), os.path.join(out, '%s__%s.png' % (h, f)))
        lp = os.path.splitext(os.path.join(ROOT, src))[0] + '.license.json'
        lic = json.load(open(lp, encoding='utf-8')) if os.path.exists(lp) else {}
        lic.update(live_frames='tools/ai-art/batches/k110_ai_live.json(마스크 인페인트) · blink 씨앗 s%d' % picks[h], ticket='K-0110')
        json.dump(lic, open(os.path.join(out, h + '__base.license.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
        n += 1
    print('LIVE_AI_FRAMES', n, out)


if __name__ == '__main__':
    main()
