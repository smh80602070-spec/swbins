"""K-0110 — 인페인트 마스크(eye·mouth·face)를 data/live_ai_boxes.json 상자에서 굽는다 → _out/k110_masks/<id>__<부위>.png
  py tools/ai-art/live_ai_masks.py [<id> ...]        # 인자 없으면 23명 전부
규칙(10-15): 상자를 PAD 만큼 넓힌 네모를 흐림 8 → 상자 안은 완전 흰색(255), 밖으로 ~20px 번짐.
  옛 마스크(상자 네모를 그대로 흐림 8)는 흰 곳이 상자 안쪽 20px 로 줄어 눈 높이 50px 상자면 가는 띠뿐 → 감음·표정 약함(무사시 ✗).
  입은 아래로 더(벌린 턱 자리) · face(표정) = 눈썹까지 올린 눈 타원 + 입 네모(얼굴 네모 전체는 투구·흉터가 생김).
  eye(깜빡임, d0.95)는 눈마다 타원 하나(상자 왼 42%·오른 42%+눈꼬리 14px, 가운데 콧등 뺌(6px 은 눈꼬리 속눈썹이 남아 반쯤 뜸 — 토모에), 흐림 6 · 한 눈만 보이면 상자 json `eye_ellipses` 로 직접) — 네모+PAD 20 은 콧등·얼굴 윤곽까지 다시 그려 눈썹·코가 옮겨짐(황충 ✗).
  py tools/ai-art/live_ai_masks.py --parts eye <id> ...   # 부위만
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


def eye_mask(box, ells=None):
    im = Image.new('L', (W, H), 0)
    d = ImageDraw.Draw(im)
    x0, y0, x1, y1 = box
    w = x1 - x0
    for e in ells or [(x0 - 14, y0 - 4, x0 + 0.42 * w, y1 + 6), (x0 + 0.58 * w, y0 - 4, x1 + 14, y1 + 6)]:
        d.ellipse(tuple(e), fill=255)
    return im.filter(ImageFilter.GaussianBlur(6)).convert('RGB')


def face_mask(b):
    # 표정 = 눈썹·눈(눈 타원을 위로 35px) + 입 네모 — 얼굴 네모 전체를 열면 이마·머리까지 다시 그려 투구가 덮이거나(레오니다스 ✗) 흉터·화풍이 바뀐다(요시쓰네)
    im = Image.new('L', (W, H), 0)
    d = ImageDraw.Draw(im)
    x0, y0, x1, y1 = b['eye']
    w = x1 - x0
    for e in b.get('eye_ellipses') or [(x0 - 14, y0 - 4, x0 + 0.42 * w, y1 + 6), (x0 + 0.58 * w, y0 - 4, x1 + 14, y1 + 6)]:
        d.ellipse((e[0], e[1] - 35, e[2], e[3]), fill=255)
    m, pd = b['mouth'], PAD['mouth']
    d.rectangle((m[0] - pd[0], m[1] - pd[1], m[2] + pd[2], m[3] + pd[3]), fill=255)
    return im.filter(ImageFilter.GaussianBlur(6)).convert('RGB')


def main():
    sys.stdout.reconfigure(encoding='utf-8')
    boxes = json.load(open(os.path.join(HERE, 'data', 'live_ai_boxes.json'), encoding='utf-8'))['boxes']
    a = sys.argv[1:]
    parts = None
    if '--parts' in a:
        k = a.index('--parts')
        parts = a[k + 1].split(',')
        a = a[:k] + a[k + 2:]
    ids = a or list(boxes)
    os.makedirs(OUT, exist_ok=True)
    for h in ids:
        for part, box in regions(boxes[h]).items():
            if parts and part not in parts:
                continue
            p = os.path.join(OUT, '%s__%s.png' % (h, part))
            tmp = p + '.tmp.png'
            if part == 'eye':
                im = eye_mask(box, boxes[h].get('eye_ellipses'))
            elif part == 'face':
                im = face_mask(boxes[h])
            else:
                im = mask(box, PAD[part])
            im.save(tmp)
            os.replace(tmp, p)
        print('ok', h)


if __name__ == '__main__':
    main()
