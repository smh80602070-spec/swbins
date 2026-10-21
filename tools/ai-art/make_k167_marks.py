"""K-0167 2D 표식 아이콘 25 — W-0350 MARK 표에 짝 없던 이모지의 '뜻'을 K-0118 ui 꼴(크림 채움·갈색 테·산호 강조, 24격자)로.
  py tools/ai-art/make_k167_marks.py [--out tools/ai-art/_out/k167_pack]

왜 코드인가: K-0118 메모 — ui 28 은 SD 가 기호를 '단추 위 무늬'로 그려 make_ui_icons.py 코드 실루엣이 정본. 같은 집안이어야 하니
같은 Icon 클래스·같은 색·같은 테 두께를 그대로 가져다 쓴다(원격 SD 시험 _out/k167 은 그림체 C 그림 아이콘이라 집안이 다름 — 메모).
이모지 그림은 베끼지 않는다(뜻만 — 샘·사당·계단… 흔한 관용 모양, 좌표는 전부 여기서 잡음). 외부 그림 0 → CC0.

결과(make_ui_icons.py 와 같은 꼴): <out>/icon128/ui_<이름>_g0.png · icon64/ · content/ · ui_<이름>.license.json · sheet_k167.png
"""
import datetime
import json
import math
import os
import sys

from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from make_ui_icons import Icon, arc, rot_rect, arrow_head, px  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '_out', 'k167_pack')
if '--out' in sys.argv:
    OUT = os.path.abspath(sys.argv[sys.argv.index('--out') + 1])


def hole(k, cx, cy, rx, ry):
    """갈색으로 칠한 구멍(세부 층) — 굴혈·눈."""
    k.dd.ellipse([px(cx - rx), px(cy - ry), px(cx + rx), px(cy + ry)], fill=255)


def leaf(p0, p1, w, n=16):
    dx, dy = p1[0] - p0[0], p1[1] - p0[1]
    l = math.hypot(dx, dy) or 1
    nx, ny = -dy / l, dx / l
    a = [(p0[0] + dx * i / n + nx * w * math.sin(math.pi * i / n), p0[1] + dy * i / n + ny * w * math.sin(math.pi * i / n)) for i in range(n + 1)]
    b = [(p0[0] + dx * i / n - nx * w * math.sin(math.pi * i / n), p0[1] + dy * i / n - ny * w * math.sin(math.pi * i / n)) for i in range(n, -1, -1)]
    return a + b


def quad(p0, c, p1, n=16):
    return [((1 - t) ** 2 * p0[0] + 2 * (1 - t) * t * c[0] + t * t * p1[0], (1 - t) ** 2 * p0[1] + 2 * (1 - t) * t * c[1] + t * t * p1[1])
            for t in (i / n for i in range(n + 1))]


# ── 25 아이콘(24격자, y 아래) ──
def m_spring(k):          # 💧 샘
    k.ellipse(12, 20.2, 9.5, 2.6, accent=True)
    k.poly([(12, 1.5)] + arc(12, 12, 5.6, -35, 215))
    k.line(arc(12, 12, 3.4, 100, 170, 12), 1.1)


def m_shrine(k):          # ⛩ 사당
    k.rrect(6, 6, 8.6, 22.5, 0.6)
    k.rrect(15.4, 6, 18, 22.5, 0.6)
    k.rrect(3.5, 9.6, 20.5, 11.8, 0.6)
    k.rrect(11, 6.5, 13, 9.8, 0.3)
    k.poly([(1.2, 2.8), (12, 4.2), (22.8, 2.8), (21.2, 6.6), (2.8, 6.6)], accent=True)


def m_stairs(k):          # 🪜 계단(아래로 — 아치 입구 안으로 내려가는 디딤)
    k.poly(arc(12, 10, 9, 180, 360, 32) + [(21, 22.4), (3, 22.4)])
    hole(k, 12, 15.6, 6.4, 6.8)
    k.dd.rectangle([px(5.6), px(9.8), px(18.4), px(22.4)], fill=255)
    for y0, h, x0, x1 in ((11.4, 1.3, 9.6, 14.4), (13.9, 1.8, 8.2, 15.8), (17.0, 2.4, 6.6, 17.4), (20.4, 2.0, 5.6, 18.4)):
        k.dd.rectangle([px(x0), px(y0), px(x1), px(y0 + h)], fill=0)
        k.da.rectangle([px(x0), px(y0), px(x1), px(y0 + h)], fill=255)


def m_elite(k):           # 💠 정예
    k.poly([(12, 1.2), (22.8, 12), (12, 22.8), (1.2, 12)])
    k.poly([(12, 5.8), (18.2, 12), (12, 18.2), (5.8, 12)], accent=True)
    k.line([(12, 5.8), (18.2, 12), (12, 18.2), (5.8, 12), (12, 5.8)], 1.0)
    k.line([(12, 1.6), (12, 5.8)], 1.0)
    k.line([(12, 18.2), (12, 22.4)], 1.0)
    k.line([(1.6, 12), (5.8, 12)], 1.0)
    k.line([(18.2, 12), (22.4, 12)], 1.0)


def m_boss(k):            # 👹 두목(뿔 달린 탈)
    k.poly([(5.5, 10), (2.5, 1.8), (10, 7.2)], accent=True)
    k.poly([(18.5, 10), (21.5, 1.8), (14, 7.2)], accent=True)
    k.ellipse(12, 14, 8.2, 8)
    k.line([(6.8, 10.6), (10.6, 12.4)], 1.5)
    k.line([(17.2, 10.6), (13.4, 12.4)], 1.5)
    k.dot(8.9, 14.2, 1.35)
    k.dot(15.1, 14.2, 1.35)
    k.line([(7.6, 18.2), (16.4, 18.2)], 1.3)
    k.line([(9.2, 18.2), (9.9, 16.6)], 1.0)
    k.line([(14.8, 18.2), (14.1, 16.6)], 1.0)


def m_mine(k):            # ⛏ 굴(곡괭이)
    k.stroke([(4, 21.5), (14.6, 9.4)], 2.3)
    k.stroke(quad((2.8, 6.8), (13.5, 3.2), (20.8, 14.2)), 2.6, accent=True)
    k.ellipse(14.6, 8.8, 2.0)


def m_merchant(k):        # 🧺 상인(바구니)
    k.stroke(arc(12, 11, 7, 180, 360, 24), 1.8)
    k.poly([(3.2, 11), (20.8, 11), (18.6, 22), (5.4, 22)])
    k.rrect(1.8, 9.4, 22.2, 12.8, 1.2, accent=True)
    for x0, x1 in ((7.6, 8.2), (12, 12), (16.4, 15.8)):
        k.line([(x0, 13.6), (x1, 21.2)], 1.0)
    k.line([(4.4, 17.2), (19.6, 17.2)], 1.0)


def m_puzzle(k):          # 🧩 수수께끼
    k.rrect(3.5, 7, 17.5, 21, 1.2, accent=True)
    k.ellipse(10.5, 5.6, 3.0, accent=True)
    k.ellipse(19.2, 14, 3.0, accent=True)
    k.cut_ellipse(3.6, 14, 2.6)
    k.cut_ellipse(10.5, 21.2, 2.6)


def m_event(k):           # 🙏 사건(모은 두 손)
    k.poly([(11.6, 1.8), (11.6, 18.5), (6.2, 18.5), (5.0, 14.2), (6.0, 9.0), (8.4, 3.6), (10.2, 1.8)])
    k.poly([(12.4, 1.8), (12.4, 18.5), (17.8, 18.5), (19.0, 14.2), (18.0, 9.0), (15.6, 3.6), (13.8, 1.8)])
    k.ellipse(8.4, 14.0, 2.4, 3.2)
    k.ellipse(15.6, 14.0, 2.4, 3.2)
    k.rrect(5.0, 18, 11.6, 22.6, 0.8, accent=True)
    k.rrect(12.4, 18, 19.0, 22.6, 0.8, accent=True)
    k.line([(12, 2.2), (12, 18)], 1.1)
    k.line([(9.6, 4.6), (9.0, 10.2)], 0.9)
    k.line([(14.4, 4.6), (15.0, 10.2)], 0.9)
    k.line(arc(8.4, 14.0, 2.4, 200, 340, 12), 0.9)
    k.line(arc(15.6, 14.0, 2.4, 200, 340, 12), 0.9)


def m_herb(k):            # 🌿 약초
    k.stroke(quad((6, 22), (10, 14), (16, 3.5)), 1.5)
    k.poly(leaf((8.4, 16.6), (2.4, 9.6), 2.6))
    k.poly(leaf((10.6, 12.2), (19.6, 9.4), 2.6), accent=True)
    k.poly(leaf((13.4, 7.6), (8.2, 2.0), 2.3))
    k.poly(leaf((8.0, 19.8), (16.8, 18.6), 2.3))
    k.line([(8.4, 16.6), (4.2, 11.6)], 0.9)
    k.line([(13.4, 7.6), (9.6, 3.6)], 0.9)
    k.line([(8.0, 19.8), (14.6, 19.0)], 0.9)


def m_signpost(k):        # 🪧 팻말
    k.stroke([(12, 11), (12, 22.3)], 2.4)
    k.rrect(2.8, 3, 21.2, 12.6, 1.4)
    k.rrect(10.8, 20.8, 13.2, 22.6, 0.4, accent=True)
    k.line([(6, 6.6), (18, 6.6)], 1.2)
    k.line([(6, 9.4), (14.5, 9.4)], 1.2)


def m_pit(k):             # 🕳 굴혈
    k.ellipse(12, 13.4, 10.6, 7.2)
    hole(k, 12, 14.4, 7.6, 4.4)
    k.line([(7.6, 18.0), (7.0, 19.6)], 1.0)
    k.line([(16.4, 18.0), (17.0, 19.6)], 1.0)
    k.line([(7.0, 7.0), (6.2, 8.6)], 1.0)
    k.line([(16.6, 6.6), (17.6, 8.2)], 1.0)


def m_rock(k):            # 🪨 돌
    k.poly([(2.5, 20.5), (3.6, 13), (7.6, 7), (13.6, 4.8), (19, 8), (21.6, 14.4), (21.4, 20.5)])
    k.line([(7.6, 7), (10.6, 12.4), (16.4, 12.0), (19, 8)], 1.0)
    k.line([(10.6, 12.4), (8.6, 20.2)], 1.0)
    k.line([(16.4, 12.0), (18.0, 20.2)], 1.0)
    k.poly([(10.4, 7.6), (13.6, 6.4), (15.2, 8.6)], accent=True)


def m_portal(k):          # 🌀 역참·문(소용돌이)
    pts = []
    for i in range(121):
        t = i / 120.0
        a = math.radians(-90 + 720 * t)
        r = 10.2 - 8.6 * t
        pts.append((12 + r * math.cos(a), 12 + r * math.sin(a)))
    k.stroke(pts, 2.3, accent=True)


def m_skull(k):           # ☠ 결사비
    k.stroke([(3.5, 15.5), (20.5, 22)], 2.0)
    k.stroke([(20.5, 15.5), (3.5, 22)], 2.0)
    for x, y in ((3.5, 15.5), (20.5, 22), (20.5, 15.5), (3.5, 22)):
        k.ellipse(x, y, 1.7)
    k.ellipse(12, 9, 7.6, 7.2)
    k.rrect(8.2, 13, 15.8, 18.6, 1.6)
    hole(k, 9.2, 9.6, 1.9, 2.0)
    hole(k, 14.8, 9.6, 1.9, 2.0)
    k.poly([(12, 12), (13, 13.8), (11, 13.8)])
    k.line([(12, 12), (13, 13.8), (11, 13.8), (12, 12)], 0.9)
    k.line([(10.4, 16.2), (10.4, 18.4)], 0.9)
    k.line([(13.6, 16.2), (13.6, 18.4)], 0.9)


def m_crossing(k):        # ↔ 건너기
    k.stroke([(6.2, 10), (17.8, 10)], 3.0, accent=True)
    k.poly(arrow_head((6.4, 10), (0, 10), 4.6), accent=True)
    k.poly(arrow_head((17.6, 10), (24, 10), 4.6), accent=True)
    k.stroke([(3.5, 18.5), (6, 17), (8.5, 18.5), (11, 17), (13.5, 18.5), (16, 17), (18.5, 18.5), (21, 17)], 1.6)


def m_gravestone(k):      # 🪦 비석
    k.poly(arc(12, 9, 6.6, 180, 360, 24) + [(18.6, 19.6), (5.4, 19.6)])
    k.rrect(3, 19, 21, 22.6, 0.8, accent=True)
    k.line([(9, 9.4), (15, 9.4)], 1.2)
    k.line([(9, 12.6), (15, 12.6)], 1.2)
    k.line([(10, 15.8), (14, 15.8)], 1.2)


def m_worship(k):         # 🧎 참배(무릎 꿇고 절)
    k.ellipse(17.2, 9.4, 2.7)
    k.poly([(6.2, 13.2), (8.6, 9.4), (14.2, 9.6), (15.6, 13.2), (12, 16.2), (7, 16.6)])
    k.stroke([(14, 12.6), (18.6, 15.4)], 1.9)
    k.stroke([(7.2, 16), (15.6, 18.4)], 2.6)
    k.stroke([(15.4, 19.8), (4.6, 20.6)], 2.0)
    k.rrect(1.5, 21.6, 22.5, 23, 0.6, accent=True)


def m_statue(k):          # 🗿 석상
    k.poly([(6.8, 3), (16.6, 2.4), (18.2, 8), (17, 20.5), (7.6, 20.5), (6.0, 8)])
    k.rrect(4, 19.8, 20, 22.8, 0.8, accent=True)
    k.line([(7.6, 8.8), (16.6, 8.4)], 1.3)
    k.line([(12.6, 9.0), (14.2, 14.2), (11.6, 14.6)], 1.1)
    k.line([(9.6, 17.0), (15.0, 16.8)], 1.2)
    k.dot(9.8, 10.8, 0.9)
    k.dot(15.2, 10.6, 0.9)


def m_bell(k):            # 🔔 종
    k.ellipse(12, 2.6, 1.6)
    k.poly(arc(12, 9, 6.2, 180, 360, 24) + [(18.2, 9), (18.8, 15.6), (21.2, 18.4), (2.8, 18.4), (5.2, 15.6), (5.8, 9)])
    k.ellipse(12, 20.6, 2.2, accent=True)
    k.line([(5.6, 14.0), (18.4, 14.0)], 1.1)
    k.line([(8.4, 8.0), (8.4, 11.4)], 1.0)


def m_mirror(k):          # 🪞 거울(둥근 손거울 — 산호 테·크림 유리)
    k.rrect(10.4, 15.6, 13.6, 22.6, 1.2)
    k.ellipse(12, 9.2, 8.2, accent=True)
    k.da.ellipse([px(12 - 5.8), px(9.2 - 5.8), px(12 + 5.8), px(9.2 + 5.8)], fill=0)
    k.line(arc(12, 9.2, 5.8, 0, 360, 48), 1.0)
    k.line([(8.6, 10.6), (11.8, 5.6)], 1.2)
    k.line([(11.0, 12.4), (13.6, 8.4)], 1.2)


def m_seal(k):            # 🔏 봉인(자물쇠+인)
    k.stroke(arc(12, 8.6, 4.6, 180, 360, 24) + [(16.6, 11)], 2.0)
    k.stroke([(7.4, 8.6), (7.4, 11)], 2.0)
    k.rrect(4, 10.4, 20, 22.4, 2.4)
    k.ellipse(12, 16.4, 3.8, accent=True)
    k.dot(12, 15.6, 1.1)
    k.line([(12, 15.6), (12, 18.2)], 1.0)


def m_wine(k):            # 🍶 술(병+잔)
    k.ellipse(9.2, 15.4, 6.2, 6.8)
    k.rrect(7.4, 3.6, 11, 10, 0.8)
    k.rrect(6.6, 2.0, 11.8, 4.2, 0.8, accent=True)
    k.poly([(15.6, 16.4), (22.4, 16.4), (21.2, 21.6), (16.8, 21.6)], accent=True)
    k.line([(4, 14.6), (14.4, 14.6)], 1.0)


def m_potion(k):          # 🧪 물약
    k.rrect(9.4, 3.6, 14.6, 10, 0.6)
    k.ellipse(12, 15, 7.6)
    k.rrect(8.6, 1.4, 15.4, 4.4, 1.0, accent=True)
    k.da.rectangle([px(0), px(14.4), px(24), px(24)], fill=255)
    k.line([(4.6, 14.4), (19.4, 14.4)], 1.0)
    k.dot(9.4, 18.0, 0.9)
    k.dot(13.6, 19.6, 0.7)


def m_lantern(k):         # 🏮 등롱
    k.stroke([(12, 0.8), (12, 3.2)], 1.4)
    k.rrect(8, 2.6, 16, 5.2, 0.8)
    k.rrect(8, 19.8, 16, 22.4, 0.8)
    k.ellipse(12, 12.5, 8, 7.8, accent=True)
    for y in (9.0, 12.5, 16.0):
        hw = 8 * math.sqrt(max(0.0, 1 - ((y - 12.5) / 7.8) ** 2)) - 0.6
        k.line([(12 - hw, y), (12 + hw, y)], 0.9)
    k.line([(12, 5.2), (12, 19.8)], 0.9)


MARKS = [
    ('spring', '💧', '샘', m_spring), ('shrine', '⛩', '사당', m_shrine), ('stairs', '🪜', '계단', m_stairs),
    ('elite', '💠', '정예', m_elite), ('boss', '👹', '두목', m_boss), ('mine', '⛏', '굴', m_mine),
    ('merchant', '🧺', '상인', m_merchant), ('puzzle', '🧩', '수수께끼', m_puzzle), ('event', '🙏', '사건', m_event),
    ('herb', '🌿', '약초', m_herb), ('signpost', '🪧', '팻말', m_signpost), ('pit', '🕳', '굴혈', m_pit),
    ('rock', '🪨', '돌', m_rock), ('portal', '🌀', '역참·문', m_portal), ('skull', '☠', '결사비', m_skull),
    ('crossing', '↔', '건너기', m_crossing), ('gravestone', '🪦', '비석', m_gravestone), ('worship', '🧎', '참배', m_worship),
    ('statue', '🗿', '석상', m_statue), ('bell', '🔔', '종', m_bell), ('mirror', '🪞', '거울', m_mirror),
    ('seal', '🔏', '봉인', m_seal), ('wine', '🍶', '술', m_wine), ('potion', '🧪', '물약', m_potion), ('lantern', '🏮', '등롱', m_lantern),
]
# 시험판에 같이 놓는 기존 ui 8(같은 집안 비교)
OLD8 = ['flag', 'compass', 'map', 'scroll', 'coins', 'store', 'swords', 'box']


def sheet(rendered, old_dir, path):
    keys = [('ui_' + n, None) for n in OLD8] + [('ui_' + m[0], m) for m in MARKS]
    cols = 11
    rows = (len(keys) + cols - 1) // cols
    blocks = []
    for size in (64, 32):
        for bg in ((255, 255, 255), (28, 28, 34), (96, 128, 84)):
            cell = size + 12
            im = Image.new('RGB', (cols * cell + 12, rows * cell + 12), bg)
            for i, (key, m) in enumerate(keys):
                src = rendered[key] if m else Image.open(os.path.join(old_dir, key + '_g0.png')).convert('RGBA')
                ic = src.resize((size, size), Image.LANCZOS)
                im.paste(ic, (12 + (i % cols) * cell, 12 + (i // cols) * cell), ic)
            blocks.append(im)
    w = max(b.width for b in blocks)
    sh = Image.new('RGB', (w, sum(b.height for b in blocks) + 8 * len(blocks)), (120, 120, 120))
    y = 0
    for b in blocks:
        sh.paste(b, (0, y))
        y += b.height + 8
    sh.save(path)


def main():
    for d in ('icon128', 'icon64', 'content'):
        os.makedirs(os.path.join(OUT, d), exist_ok=True)
    today = datetime.date.today().isoformat()
    rendered = {}
    for name, emo, ko, fn in MARKS:
        key = 'ui_' + name
        k = Icon()
        fn(k)
        img = k.render()
        rendered[key] = img
        img.resize((128, 128), Image.LANCZOS).save(os.path.join(OUT, 'icon128', key + '_g0.png'))
        img.resize((64, 64), Image.LANCZOS).save(os.path.join(OUT, 'icon64', key + '_g0.png'))
        img.resize((128, 128), Image.LANCZOS).save(os.path.join(OUT, 'content', key + '.png'))
        json.dump({'id': key, 'generator': 'tools/ai-art/make_k167_marks.py', 'model': 'none',
                   'license': 'CC0-1.0 (코드 생성 — 24격자 기하 도형, 외부 그림·이모지 그림 없음)', 'date': today,
                   'note': 'K-0167 2D 표식 아이콘(%s %s) — K-0118 ui 꼴(크림 채움·갈색 테·산호 강조). W-0350 mode2d MARK 표 이름 %s.' % (emo, ko, name)},
                  open(os.path.join(OUT, key + '.license.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    old_dir = os.path.join(HERE, '..', '..', 'saga-web', 'shared', 'assets', 'icons', 'icon64')
    sheet(rendered, old_dir, os.path.join(OUT, 'sheet_k167.png'))
    print('K-0167 표식 %d개 → %s (sheet_k167.png)' % (len(MARKS), OUT))
    return 0


if __name__ == '__main__':
    sys.exit(main())
