"""K-0110 — 인페인트 마스크(eye·mouth·face)를 data/live_ai_boxes.json 상자에서 굽는다 → _out/k110_masks/<id>__<부위>.png
  py tools/ai-art/live_ai_masks.py [<id> ...]        # 인자 없으면 23명 전부
규칙(10-15): 상자를 PAD 만큼 넓힌 네모를 흐림 8 → 상자 안은 완전 흰색(255), 밖으로 ~20px 번짐.
  옛 마스크(상자 네모를 그대로 흐림 8)는 흰 곳이 상자 안쪽 20px 로 줄어 눈 높이 50px 상자면 가는 띠뿐 → 감음·표정 약함(무사시 ✗).
  입은 아래로 더(벌린 턱 자리) · face(표정) = 눈썹 위 45px ~ 입 아래 10px.
쓰기는 임시 파일 → os.replace(사슬이 그림마다 마스크를 다시 읽는다).
"""
import json
import os
import sys

from PIL import Image, ImageDraw, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '_out', 'k110_masks')
W, H = 768, 1024
BLUR = 8
PAD = {'eye': (20, 20, 20, 20), 'mouth': (20, 16, 20, 30), 'face': (20, 20, 20, 20)}   # 왼·위·오른·아래


def regions(b):
    e, m = b['eye'], b['mouth']
    face = [min(e[0], m[0]) - 20, e[1] - 45, max(e[2], m[2]) + 20, m[3] + 10]
    return {'eye': e, 'mouth': m, 'face': face}


def mask(box, pad):
    im = Image.new('L', (W, H), 0)
    x0, y0, x1, y1 = box
    ImageDraw.Draw(im).rectangle((x0 - pad[0], y0 - pad[1], x1 + pad[2], y1 + pad[3]), fill=255)
    return im.filter(ImageFilter.GaussianBlur(BLUR)).convert('RGB')


def main():
    sys.stdout.reconfigure(encoding='utf-8')
    boxes = json.load(open(os.path.join(HERE, 'data', 'live_ai_boxes.json'), encoding='utf-8'))['boxes']
    ids = sys.argv[1:] or list(boxes)
    os.makedirs(OUT, exist_ok=True)
    for h in ids:
        for part, box in regions(boxes[h]).items():
            p = os.path.join(OUT, '%s__%s.png' % (h, part))
            tmp = p + '.tmp.png'
            mask(box, PAD[part]).save(tmp)
            os.replace(tmp, p)
        print('ok', h)


if __name__ == '__main__':
    main()
