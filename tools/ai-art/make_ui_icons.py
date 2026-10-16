"""K-0118 UI 아이콘 28 — 코드로 그린 단색 실루엣(그림체 C 색: 크림 채움·갈색 테두리·산호 강조).
  py tools/ai-art/make_ui_icons.py [--out tools/ai-art/_out/k118_pack_ui]

왜 코드인가: X·점 셋·되돌리기 화살표 같은 **기호**는 SD 가 늘 "단추 위의 무늬"로 그린다(10-17 시험 ui_x 4장 전부 상자).
도구줄·독의 Lucide 자리는 24px 안팎이라 실루엣이 읽혀야 한다 → 24격자 위에 직접 설계한 기하 도형.
Lucide 경로는 베끼지 않는다(모양은 흔한 관용 — 봉투·깃발·나침반 — 이고 좌표는 전부 여기서 새로 잡았다). 외부 그림 0 → CC0.

결과(place_icons.py 가 읽는 꼴과 같다): <out>/icon128/<키>_g0.png · icon64/<키>_g0.png · content/<키>.png · <키>.license.json
확인 시트: <out>/sheet_ui.png — 32px·64px × 흰·검 바탕.
"""
import datetime
import json
import math
import os
import sys

from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '_out', 'k118_pack_ui')
if '--out' in sys.argv:
    OUT = os.path.abspath(sys.argv[sys.argv.index('--out') + 1])

S = 512                 # 작업 해상도(24격자 → 1칸 21.3px), 128·64 로 줄인다
U = S / 24.0
O = 1.1                 # 테두리 두께(격자 칸)
CREAM = (247, 233, 207, 255)
BROWN = (74, 52, 38, 255)
CORAL = (226, 138, 112, 255)


def px(v):
    return v * U


class Icon:
    """실루엣 M · 테두리까지 O · 강조색 A · 세부 선 D — 넷 다 L 모드 마스크. 테두리는 도형마다 O 에 'o 만큼 부풀린 것'을 그려서 만든다(필터 없음)."""

    def __init__(self):
        self.M = Image.new('L', (S, S), 0)
        self.O = Image.new('L', (S, S), 0)
        self.A = Image.new('L', (S, S), 0)
        self.D = Image.new('L', (S, S), 0)
        self.dm, self.do, self.da, self.dd = (ImageDraw.Draw(x) for x in (self.M, self.O, self.A, self.D))

    # ── 채우는 도형 ──
    def poly(self, pts, accent=False):
        p = [(px(x), px(y)) for x, y in pts]
        self.dm.polygon(p, fill=255)
        self.do.polygon(p, fill=255)
        self.do.line(p + [p[0]], fill=255, width=int(px(2 * O)), joint='curve')
        for x, y in p:
            self.do.ellipse([x - px(O), y - px(O), x + px(O), y + px(O)], fill=255)
        if accent:
            self.da.polygon(p, fill=255)

    def ellipse(self, cx, cy, rx, ry=None, accent=False):
        ry = rx if ry is None else ry
        self.dm.ellipse([px(cx - rx), px(cy - ry), px(cx + rx), px(cy + ry)], fill=255)
        self.do.ellipse([px(cx - rx - O), px(cy - ry - O), px(cx + rx + O), px(cy + ry + O)], fill=255)
        if accent:
            self.da.ellipse([px(cx - rx), px(cy - ry), px(cx + rx), px(cy + ry)], fill=255)

    def rrect(self, x0, y0, x1, y1, r, accent=False):
        self.dm.rounded_rectangle([px(x0), px(y0), px(x1), px(y1)], radius=px(r), fill=255)
        self.do.rounded_rectangle([px(x0 - O), px(y0 - O), px(x1 + O), px(y1 + O)], radius=px(r + O), fill=255)
        if accent:
            self.da.rounded_rectangle([px(x0), px(y0), px(x1), px(y1)], radius=px(r), fill=255)

    def stroke(self, pts, w, accent=False):
        """굵은 선도 실루엣의 일부(둥근 끝)."""
        p = [(px(x), px(y)) for x, y in pts]
        for d, ww in ((self.dm, w), (self.do, w + 2 * O)) + (((self.da, w),) if accent else ()):
            d.line(p, fill=255, width=int(px(ww)), joint='curve')
            for x, y in p:
                d.ellipse([x - px(ww / 2), y - px(ww / 2), x + px(ww / 2), y + px(ww / 2)], fill=255)

    # ── 파내기 ──
    def cut_ellipse(self, cx, cy, rx, ry=None):
        ry = rx if ry is None else ry
        self.dm.ellipse([px(cx - rx), px(cy - ry), px(cx + rx), px(cy + ry)], fill=0)
        self.da.ellipse([px(cx - rx), px(cy - ry), px(cx + rx), px(cy + ry)], fill=0)
        if rx > O and ry > O:
            self.do.ellipse([px(cx - rx + O), px(cy - ry + O), px(cx + rx - O), px(cy + ry - O)], fill=0)

    def cut_poly(self, pts):
        p = [(px(x), px(y)) for x, y in pts]
        self.dm.polygon(p, fill=0)
        self.da.polygon(p, fill=0)
        self.do.polygon(p, fill=0)
        self.do.line(p + [p[0]], fill=255, width=int(px(2 * O)), joint='curve')   # 테두리 띠는 되살린다(= 파낸 자리 안쪽으로 테두리)

    # ── 세부 선(갈색, 맨 위) ──
    def line(self, pts, w=1.4):
        p = [(px(x), px(y)) for x, y in pts]
        self.dd.line(p, fill=255, width=int(px(w)), joint='curve')
        for x, y in p:
            self.dd.ellipse([x - px(w / 2), y - px(w / 2), x + px(w / 2), y + px(w / 2)], fill=255)

    def dot(self, cx, cy, r):
        self.dd.ellipse([px(cx - r), px(cy - r), px(cx + r), px(cy + r)], fill=255)

    def render(self):
        img = Image.new('RGBA', (S, S), (0, 0, 0, 0))
        img.paste(BROWN, mask=self.O)
        img.paste(CREAM, mask=self.M)
        a = Image.new('L', (S, S), 0)
        a.paste(self.A, mask=self.M)
        img.paste(CORAL, mask=a)
        img.paste(BROWN, mask=self.D)
        return img


# ── 기하 도우미(격자 좌표) ──
def arc(cx, cy, r, a0, a1, n=48):
    """화면 좌표(y 아래) 각도 a0→a1(도)의 호 점들."""
    return [(cx + r * math.cos(math.radians(a0 + (a1 - a0) * i / n)), cy + r * math.sin(math.radians(a0 + (a1 - a0) * i / n))) for i in range(n + 1)]


def rot_rect(cx, cy, hw, hh, deg):
    c, s = math.cos(math.radians(deg)), math.sin(math.radians(deg))
    return [(cx + x * c - y * s, cy + x * s + y * c) for x, y in ((-hw, -hh), (hw, -hh), (hw, hh), (-hw, hh))]


def star(cx, cy, ro, ri, n=4, rot=-90):
    pts = []
    for i in range(2 * n):
        r = ro if i % 2 == 0 else ri
        a = math.radians(rot + 180.0 * i / n)
        pts.append((cx + r * math.cos(a), cy + r * math.sin(a)))
    return pts


def arrow_head(p, q, size):
    """점 p 에서 q 쪽을 보는 화살촉(q 가 촉 끝 방향)."""
    dx, dy = q[0] - p[0], q[1] - p[1]
    l = math.hypot(dx, dy) or 1
    dx, dy = dx / l, dy / l
    nx, ny = -dy, dx
    return [(p[0] + dx * size, p[1] + dy * size), (p[0] + nx * size * 0.75, p[1] + ny * size * 0.75), (p[0] - nx * size * 0.75, p[1] - ny * size * 0.75)]


# ── 28 아이콘(24격자) ──
def i_award(k):
    k.poly([(9, 13), (15, 13), (16.5, 22.5), (12, 19.5), (7.5, 22.5)], accent=True)
    k.ellipse(12, 8.5, 6.5)
    k.line(arc(12, 8.5, 3.2, 0, 360), 1.2)


def i_backpack(k):
    k.stroke([(8.5, 7), (8.5, 3.5), (15.5, 3.5), (15.5, 7)], 2.2)
    k.rrect(4, 6.5, 20, 22, 3)
    k.line([(4.5, 12), (19.5, 12)])
    k.line([(8, 22), (8, 16), (16, 16), (16, 22)])


def i_book_open(k):
    k.poly([(2, 4.5), (11, 6.5), (11, 21.5), (2, 19.5)])
    k.poly([(22, 4.5), (13, 6.5), (13, 21.5), (22, 19.5)])
    k.stroke([(12, 6), (12, 21.5)], 1.6)
    k.line([(4.5, 9.5), (8.5, 10.4)], 1.1)
    k.line([(4.5, 13), (8.5, 13.9)], 1.1)
    k.line([(15.5, 10.4), (19.5, 9.5)], 1.1)
    k.line([(15.5, 13.9), (19.5, 13)], 1.1)


def i_bot(k):
    k.stroke([(12, 8), (12, 4.5)], 1.8)
    k.ellipse(12, 3.5, 1.8, accent=True)
    k.rrect(4, 8, 20, 20.5, 2.5)
    k.rrect(1.5, 12.5, 4, 16.5, 0.8)
    k.rrect(20, 12.5, 22.5, 16.5, 0.8)
    k.dot(8.8, 13.8, 1.5)
    k.dot(15.2, 13.8, 1.5)
    k.line([(9, 17.5), (15, 17.5)], 1.3)


def i_box(k):
    k.poly([(12, 2.5), (21.5, 7.3), (12, 12), (2.5, 7.3)])
    k.poly([(2.5, 7.3), (12, 12), (12, 21.5), (2.5, 16.8)], accent=True)
    k.poly([(12, 12), (21.5, 7.3), (21.5, 16.8), (12, 21.5)])
    k.line([(2.5, 7.3), (12, 12), (21.5, 7.3)], 1.2)
    k.line([(12, 12), (12, 21.5)], 1.2)


def i_circle_question_mark(k):
    k.ellipse(12, 12, 10)
    k.line(arc(12, 8.8, 3.2, 190, 400) + [(12, 12.6), (12, 14.3)], 1.9)
    k.dot(12, 17.6, 1.3)


def i_clipboard_list(k):
    k.rrect(4.5, 4, 19.5, 22, 2)
    k.rrect(8.5, 2, 15.5, 6.5, 1.2, accent=True)
    k.line([(8, 11), (16, 11)], 1.3)
    k.line([(8, 14.8), (16, 14.8)], 1.3)
    k.line([(8, 18.6), (13, 18.6)], 1.3)


def i_coins(k):
    k.ellipse(15, 9, 6.5)
    k.line(arc(15, 9, 3.4, 0, 360), 1.1)
    k.ellipse(9, 15, 6.5)
    k.line(arc(9, 15, 6.5, 270, 400), 1.1)      # 앞 동전 윗가장자리 — 뒤 동전과 겹친 자리를 가른다
    k.ellipse(9, 15, 3.6, accent=True)


def i_compass(k):
    k.ellipse(12, 12, 10)
    k.poly([(12, 3.5), (14.6, 12), (9.4, 12)], accent=True)
    k.poly([(12, 20.5), (14.6, 12), (9.4, 12)])
    k.line([(9.4, 12), (14.6, 12)], 1.0)
    k.dot(12, 12, 1.3)


def i_ellipsis(k):
    for x in (4.5, 12, 19.5):
        k.ellipse(x, 12, 2.6)


def i_flag(k):
    k.poly([(6, 3), (21, 3), (17.5, 8.5), (21, 14), (6, 14)], accent=True)
    k.stroke([(5, 2.5), (5, 22)], 2.2)


def i_footprints(k):
    for ox, oy in ((0, 0), (9, 7)):
        k.ellipse(6.5 + ox, 10 + oy, 2.9, 4.3)
        for tx, ty, r in ((3.6, 3.9, 1.1), (5.8, 2.9, 1.2), (8.2, 3.2, 1.15), (10.1, 4.5, 1.0)):
            k.ellipse(tx + ox, ty + oy, r)


def i_ham(k):
    body = []
    for a in range(0, 360, 10):
        r = math.radians(a)
        x, y = 7.4 * math.cos(r), 5.2 * math.sin(r)
        c, s = math.cos(math.radians(42)), math.sin(math.radians(42))
        body.append((10 + x * c - y * s, 14 + x * s + y * c))
    k.poly(body)
    inner = []
    for a in range(0, 360, 10):
        r = math.radians(a)
        x, y = 4.6 * math.cos(r), 3.0 * math.sin(r)
        c, s = math.cos(math.radians(42)), math.sin(math.radians(42))
        inner.append((10 + x * c - y * s, 14 + x * s + y * c))
    k.poly(inner, accent=True)
    k.stroke([(15.5, 8.5), (19.5, 4.5)], 2.4)
    k.ellipse(20.5, 3, 1.9)
    k.ellipse(21.6, 5.4, 1.9)


def i_hammer(k):
    k.stroke([(13.5, 10.5), (4, 20)], 2.8)
    k.poly(rot_rect(15, 8, 6.2, 3.2, 45))
    k.line(rot_rect(15, 8, 6.2, 0.0, 45)[:2], 1.0)


def i_mail(k):
    k.rrect(2, 4.5, 22, 19.5, 2)
    k.line([(2.5, 6), (12, 13.5), (21.5, 6)], 1.5)
    k.ellipse(12, 14.2, 1.6, accent=True)


def i_map(k):
    k.poly([(2, 5), (8.5, 2.5), (8.5, 19), (2, 21.5)])
    k.poly([(8.5, 2.5), (15.5, 5.5), (15.5, 22), (8.5, 19)], accent=True)
    k.poly([(15.5, 5.5), (22, 2.5), (22, 19), (15.5, 21.5)])
    k.line([(8.5, 2.5), (8.5, 19)], 1.1)
    k.line([(15.5, 5.5), (15.5, 22)], 1.1)


def i_medal(k):
    k.poly([(6.5, 2), (10.5, 2), (12, 8.5), (13.5, 2), (17.5, 2), (14.5, 12.5), (9.5, 12.5)], accent=True)
    k.ellipse(12, 16.5, 5.8)
    k.line(arc(12, 16.5, 3, 0, 360), 1.1)


def i_palette(k):
    k.ellipse(12, 12, 10, 9.2)
    k.cut_ellipse(16, 15.5, 2.6)
    k.ellipse(7, 9, 1.9, accent=True)
    k.dot(12, 6.3, 1.7)
    k.dot(16.8, 8.6, 1.7)
    k.dot(7.3, 15.2, 1.6)


def i_rotate_ccw(k):
    pts = arc(12, 12.5, 8, 150, -150)          # 150° → -150°: 화면에서 반시계로 300°, 왼쪽이 트임
    k.stroke(pts, 2.4)
    end = pts[-1]
    k.poly(arrow_head(end, (end[0] - 0.5, end[1] + 0.866), 4.8))   # 진행 방향(아래·왼쪽)으로 촉


def i_satellite_dish(k):
    k.poly([(4, 20)] + arc(4, 20, 10.5, 270, 360))
    k.line([(8, 16), (12.5, 11.5)], 1.6)
    k.stroke(arc(11.5, 12.5, 5.5, 270, 360), 1.7)
    k.stroke(arc(11.5, 12.5, 9.5, 270, 360), 1.7)
    k.ellipse(12.5, 11.5, 1.6, accent=True)


def i_scroll(k):
    k.rrect(5, 4, 19.5, 19, 1.5)
    k.rrect(3, 2.5, 19.5, 6.5, 2)
    k.rrect(3, 17, 21, 22, 2.5)
    k.line([(5.5, 6.5), (18.5, 6.5)], 1.0)
    k.line([(5.5, 17), (18.5, 17)], 1.0)


def i_scroll_text(k):
    i_scroll(k)
    k.line([(8.5, 10), (16, 10)], 1.3)
    k.line([(8.5, 13.5), (16, 13.5)], 1.3)


def i_sparkles(k):
    k.poly(star(10.5, 13, 9.5, 2.6))
    k.poly(star(19.5, 5, 3.6, 1.1), accent=True)
    k.poly(star(20.5, 18.5, 2.8, 0.9), accent=True)


def i_store(k):
    k.rrect(4, 9, 20, 21.5, 1.2)
    k.poly([(3, 3), (21, 3), (22.5, 9), (1.5, 9)], accent=True)
    for x in (6.7, 12, 17.3):
        k.ellipse(x, 9, 2.7, 1.8, accent=True)
    k.line([(8, 3.3), (7.3, 9)], 1.0)
    k.line([(12, 3.3), (12, 9)], 1.0)
    k.line([(16, 3.3), (16.7, 9)], 1.0)
    k.line([(10, 21.5), (10, 15), (14, 15), (14, 21.5)], 1.2)


def i_swords(k):
    def sword(tip, guard, hilt):
        k.stroke([tip, guard], 2.6)
        dx, dy = guard[0] - tip[0], guard[1] - tip[1]
        l = math.hypot(dx, dy)
        nx, ny = -dy / l * 2.6, dx / l * 2.6
        k.stroke([(guard[0] + nx, guard[1] + ny), (guard[0] - nx, guard[1] - ny)], 1.8, accent=True)
        k.stroke([guard, hilt], 2.0)
        k.line([(tip[0] + dx * 0.08, tip[1] + dy * 0.08), (guard[0] - dx * 0.12, guard[1] - dy * 0.12)], 0.9)
    sword((3.5, 3.5), (16, 16), (20.2, 20.2))
    sword((20.5, 3.5), (8, 16), (3.8, 20.2))


def i_user(k):
    k.poly([(4, 22)] + arc(12, 22, 8, 180, 360) + [(20, 22)])
    k.ellipse(12, 7.5, 4.8)


def i_wrench(k):
    k.stroke([(13.5, 10.5), (4, 20)], 3.6)
    k.ellipse(16.5, 7.5, 6)
    k.cut_poly([(16.5, 7.5), (20.5, 1.5), (24, 4.5), (19.5, 9.5)])


def i_x(k):
    k.stroke([(5.5, 5.5), (18.5, 18.5)], 3.2, accent=True)
    k.stroke([(18.5, 5.5), (5.5, 18.5)], 3.2, accent=True)


ICONS = {
    'ui_award': i_award, 'ui_backpack': i_backpack, 'ui_book_open': i_book_open, 'ui_bot': i_bot, 'ui_box': i_box,
    'ui_circle_question_mark': i_circle_question_mark, 'ui_clipboard_list': i_clipboard_list, 'ui_coins': i_coins,
    'ui_compass': i_compass, 'ui_ellipsis': i_ellipsis, 'ui_flag': i_flag, 'ui_footprints': i_footprints,
    'ui_ham': i_ham, 'ui_hammer': i_hammer, 'ui_mail': i_mail, 'ui_map': i_map, 'ui_medal': i_medal,
    'ui_palette': i_palette, 'ui_rotate_ccw': i_rotate_ccw, 'ui_satellite_dish': i_satellite_dish, 'ui_scroll': i_scroll,
    'ui_scroll_text': i_scroll_text, 'ui_sparkles': i_sparkles, 'ui_store': i_store, 'ui_swords': i_swords,
    'ui_user': i_user, 'ui_wrench': i_wrench, 'ui_x': i_x,
}


def main():
    for d in ('icon128', 'icon64', 'content'):
        os.makedirs(os.path.join(OUT, d), exist_ok=True)
    today = datetime.date.today().isoformat()
    rendered = {}
    for key, fn in ICONS.items():
        k = Icon()
        fn(k)
        img = k.render()
        rendered[key] = img
        img.resize((128, 128), Image.LANCZOS).save(os.path.join(OUT, 'icon128', key + '_g0.png'))
        img.resize((64, 64), Image.LANCZOS).save(os.path.join(OUT, 'icon64', key + '_g0.png'))
        img.resize((128, 128), Image.LANCZOS).save(os.path.join(OUT, 'content', key + '.png'))
        json.dump({'id': key, 'generator': 'tools/ai-art/make_ui_icons.py', 'model': 'none',
                   'license': 'CC0-1.0 (코드 생성 — 24격자 기하 도형, 외부 그림·Lucide 경로 없음)', 'date': today,
                   'note': 'K-0118 UI 실루엣 아이콘(그림체 C 색: 크림 채움·갈색 테두리·산호 강조). 도구줄·독·☰ 메뉴의 Lucide 자리.'},
                  open(os.path.join(OUT, key + '.license.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    # 확인 시트: 32·64 × 흰·검
    keys = list(ICONS)
    cols = 14
    rows_per = (len(keys) + cols - 1) // cols
    blocks = []
    for size in (64, 32):
        for bg in ((255, 255, 255), (28, 28, 34)):
            cell = size + 10
            im = Image.new('RGB', (cols * cell + 10, rows_per * cell + 10), bg)
            for i, key in enumerate(keys):
                ic = rendered[key].resize((size, size), Image.LANCZOS)
                im.paste(ic, (10 + (i % cols) * cell, 10 + (i // cols) * cell), ic)
            blocks.append(im)
    w = max(b.width for b in blocks)
    sheet = Image.new('RGB', (w, sum(b.height for b in blocks) + 8 * len(blocks)), (120, 120, 120))
    y = 0
    for b in blocks:
        sheet.paste(b, (0, y))
        y += b.height + 8
    sheet.save(os.path.join(OUT, 'sheet_ui.png'))
    print('UI 아이콘 %d개 → %s (sheet_ui.png)' % (len(keys), OUT))
    return 0


if __name__ == '__main__':
    sys.exit(main())
