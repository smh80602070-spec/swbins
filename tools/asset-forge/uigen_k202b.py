"""K-0202 ② 2차 — 다섯 판 UI 「A」(사용자 10-30 「a로」): 지난 1번(uigen_styles·uigen_stone)을 대신하는 새 모양 언어.
  go      = 등고선 지도판(지도 종이·진녹 선·붉은 핀 모서리)
  dungeon = 철판 + 룬 홈(리벳 철판·붉은 불씨·등급 빛)
  forest  = 천 조각 패치워크(생성 천·코랄 바느질)
  story   = 만화 컷(굵은 검은 테두리·밀린 그림자·노란 버튼)
  realm   = 목판 인쇄 문서(오사란 붉은 줄·한지)
uigen.py 와 같은 부품 19·같은 크기·같은 9분할(한가운데 줄 한 색 — 가로 무늬는 가장자리 조각에만).

  py tools/asset-forge/uigen_k202b.py [go,dungeon,forest,story,realm]   # _out/ui/<판>_k202b/ + 시트 _out/ui/k202b_<판>_sheet.jpg
  py tools/asset-forge/uigen_k202b.py --publish                          # 정본 saga-assets/ui/<판> · 웹 공용 · 판 폴더 assets/ui 덮기
"""
import json
import os
import shutil
import sys

from PIL import Image, ImageDraw, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
sys.path.insert(0, HERE)
from uigen_styles import SS, GRADE, bubble_generic, canvas, done, lerp, pill_fill, shadow_under  # noqa: E402

GAME = {'go': 'saga-go', 'dungeon': 'saga-dungeon', 'forest': 'saga-forest', 'story': 'saga-story', 'realm': 'saga-realm'}
NAME = {'go': '등고선 지도판', 'dungeon': '철판 + 룬 홈', 'forest': '천 조각 패치워크', 'story': '만화 컷', 'realm': '목판 인쇄 문서'}


def vgrad(w, h, top, bot):
    W, H = w * SS, h * SS
    g = Image.new('RGBA', (W, H))
    d = ImageDraw.Draw(g)
    for y in range(H):
        d.line((0, y, W, y), fill=lerp(top, bot, y / max(1, H - 1)) + (255,))
    return g


def rect_mask(w, h, x0, y0, x1, y1, r=0):
    m = Image.new('L', (w * SS, h * SS), 0)
    d = ImageDraw.Draw(m)
    box = (x0 * SS, y0 * SS, x1 * SS - 1, y1 * SS - 1)
    if r:
        d.rounded_rectangle(box, r * SS, fill=255)
    else:
        d.rectangle(box, fill=255)
    return m


def filled(w, h, top, bot, x0, y0, x1, y1, r=0):
    out = canvas(w, h)
    out.paste(vgrad(w, h, top, bot), (0, 0), rect_mask(w, h, x0, y0, x1, y1, r))
    return out


def outline(d, x0, y0, x1, y1, color, width, r=0):
    box = (x0 * SS, y0 * SS, x1 * SS - 1, y1 * SS - 1)
    if r:
        d.rounded_rectangle(box, r * SS, outline=color + (255,), width=int(width * SS))
    else:
        d.rectangle(box, outline=color + (255,), width=int(width * SS))


def dashed(d, x0, y0, x1, y1, color, width=1.6, dash=6, gap=4):
    """사각 둘레를 따라 바느질 점선(SS 좌표)."""
    pts = [(x0, y0), (x1, y0), (x1, y1), (x0, y1), (x0, y0)]
    for (ax, ay), (bx, by) in zip(pts, pts[1:]):
        L = max(abs(bx - ax), abs(by - ay))
        n = int(L / (dash + gap)) + 1
        for i in range(n):
            s = i * (dash + gap) / L
            e = min(1.0, (i * (dash + gap) + dash) / L)
            d.line((ax + (bx - ax) * s, ay + (by - ay) * s, ax + (bx - ax) * e, ay + (by - ay) * e), fill=color + (255,), width=int(width * SS))


class Base:
    """공통 — 부품 이름·크기는 uigen.PARTS 그대로. 서브클래스가 panel·button·tab·grade·gauge_frame·FILLS 를 채운다."""
    PAPER = ((240, 232, 212), (230, 220, 192))
    TAIL = ((230, 220, 192), (36, 51, 41))
    FILLS = {}

    def window(self): return done(self.panel(192, 192), 192, 192)
    def popup(self): return done(self.panel(256, 192), 256, 192)
    def card(self): return done(self.panel(160, 224, inner=True), 160, 224)
    def bubble(self): return bubble_generic(self.panel(192, 92), self.TAIL[0], self.TAIL[1])
    def gauge_fill(self, kind): return pill_fill(self.FILLS[kind], getattr(self, 'FILL_R', 4))


# ───────────────────────── 1만리 · 등고선 지도판 ─────────────────────────
class Go(Base):
    INK, LINE, RED, BLUE = (36, 51, 41), (183, 157, 107), (210, 69, 47), (111, 163, 184)
    FILLS = {'hp': ((226, 92, 70), (190, 60, 44)), 'mp': ((111, 163, 184), (72, 120, 142)), 'xp': ((110, 170, 100), (70, 128, 66))}

    def panel(self, w, h, inner=False):
        im = filled(w, h, (240, 232, 212), (230, 220, 192), 4, 4, w - 4, h - 4)
        d = ImageDraw.Draw(im)
        outline(d, 4, 4, w - 4, h - 4, self.INK, 3)
        outline(d, 10, 10, w - 10, h - 10, self.LINE, 1)
        for x, y in ((10, 10), (w - 10, 10), (10, h - 10), (w - 10, h - 10)):                     # 붉은 핀 모서리
            d.ellipse(((x - 6) * SS, (y - 6) * SS, (x + 6) * SS, (y + 6) * SS), fill=self.RED + (255,), outline=(239, 232, 211, 255), width=2 * SS)
        if inner:
            outline(d, 18, 18, w - 18, h - 70, self.LINE, 1)
            d.rectangle((19 * SS, 19 * SS, (w - 19) * SS, (h - 71) * SS), fill=(247, 241, 224, 255))
        return shadow_under(im, 2.5, 3, 80)

    def tab(self, on):
        w, h = 120, 44
        im = canvas(w, h)
        d = ImageDraw.Draw(im)
        fill = (240, 232, 212) if on else (214, 202, 172)
        d.polygon([(3 * SS, (h - 2) * SS), (3 * SS, 14 * SS), (12 * SS, 5 * SS), ((w - 12) * SS, 5 * SS), ((w - 3) * SS, 14 * SS), ((w - 3) * SS, (h - 2) * SS)], fill=fill + (255,), outline=self.INK + (255,), width=int((3 if on else 2) * SS))
        return done(im, w, h)

    def btn(self, st):
        w = h = 96
        fill, rim = {'normal': ((36, 51, 41), (20, 30, 24)), 'hover': ((52, 78, 60), (20, 30, 24)), 'pressed': ((26, 40, 32), (14, 22, 17)), 'disabled': ((190, 184, 168), (150, 144, 128))}[st]
        im = canvas(w, h)
        d = ImageDraw.Draw(im)
        dy = 0 if st == 'pressed' else 4
        d.rounded_rectangle((4 * SS, 8 * SS, (w - 4) * SS, (h - 4) * SS), 8 * SS, fill=rim + (255,))
        d.rounded_rectangle((4 * SS, (8 + (0 if dy else 4)) * SS, (w - 4) * SS, (h - 4 - dy) * SS), 8 * SS, fill=fill + (255,))
        if st in ('normal', 'hover'):
            d.line((16 * SS, 14 * SS, (w - 16) * SS, 14 * SS), fill=(239, 232, 211, 120), width=int(1.6 * SS))
        return done(im, w, h)

    def grade(self, n):
        w, h = 128, 160
        c = GRADE[n - 1]
        im = canvas(w, h)
        d = ImageDraw.Draw(im)
        outline(d, 3, 3, w - 3, h - 3, c, 3 + n * 0.6)
        if n >= 3:
            for x, y in ((8, 8), (w - 8, 8), (8, h - 8), (w - 8, h - 8)):
                d.ellipse(((x - 5) * SS, (y - 5) * SS, (x + 5) * SS, (y + 5) * SS), fill=c + (255,), outline=(239, 232, 211, 255), width=SS)
        return done(shadow_under(im, 2, 1, 60) if n == 5 else im, w, h)

    def gauge_frame(self):
        w, h = 256, 28
        im = canvas(w, h)
        d = ImageDraw.Draw(im)
        d.rounded_rectangle((1 * SS, 1 * SS, (w - 1) * SS, (h - 1) * SS), 4 * SS, fill=(236, 228, 206, 255), outline=self.INK + (255,), width=int(2 * SS))
        return done(im, w, h)


# ───────────────────────── 2나락 · 철판 + 룬 홈 ─────────────────────────
class Dungeon(Base):
    EDGE, BEVEL, RED = (7, 8, 10), (58, 61, 68), (255, 74, 42)
    TAIL = ((30, 31, 36), (7, 8, 10))
    FILLS = {'hp': ((200, 50, 34), (120, 20, 14)), 'mp': ((70, 110, 190), (32, 56, 120)), 'xp': ((214, 160, 60), (130, 90, 26))}

    def panel(self, w, h, inner=False):
        im = filled(w, h, (42, 44, 49), (27, 28, 32), 3, 3, w - 3, h - 3)
        d = ImageDraw.Draw(im)
        outline(d, 3, 3, w - 3, h - 3, self.EDGE, 3)
        outline(d, 7, 7, w - 7, h - 7, self.BEVEL, 4)
        outline(d, 11, 11, w - 11, h - 11, (10, 11, 13), 1)
        for x, y in ((15, 15), (w - 15, 15), (15, h - 15), (w - 15, h - 15)):                      # 리벳
            d.ellipse(((x - 6) * SS, (y - 6) * SS, (x + 6) * SS, (y + 6) * SS), fill=(26, 27, 31, 255))
            d.ellipse(((x - 5) * SS, (y - 5) * SS, (x + 5) * SS, (y + 5) * SS), fill=(110, 114, 124, 255))
            d.ellipse(((x - 3) * SS, (y - 3) * SS, (x + 4) * SS, (y + 4) * SS), fill=(52, 55, 62, 255))
            d.ellipse(((x - 3) * SS, (y - 4) * SS, (x) * SS, (y - 1) * SS), fill=(170, 174, 184, 255))
        if inner:
            outline(d, 18, 18, w - 18, h - 72, (10, 11, 13), 2)
            d.rectangle((20 * SS, 20 * SS, (w - 20) * SS, (h - 74) * SS), fill=(18, 19, 23, 255))
        return shadow_under(im, 3, 3, 120)

    def tab(self, on):
        w, h = 120, 44
        im = canvas(w, h)
        d = ImageDraw.Draw(im)
        d.rounded_rectangle((3 * SS, 4 * SS, (w - 3) * SS, (h - 2) * SS), 4 * SS, fill=((52, 55, 62) if on else (30, 31, 36)) + (255,), outline=self.EDGE + (255,), width=int(2 * SS))
        d.line((8 * SS, 8 * SS, (w - 8) * SS, 8 * SS), fill=(self.RED if on else (70, 72, 78)) + (255,), width=int(2.5 * SS))
        return done(im, w, h)

    def btn(self, st):
        w = h = 96
        top, bot = {'normal': ((64, 67, 74), (34, 36, 41)), 'hover': ((78, 81, 90), (42, 44, 50)), 'pressed': ((30, 31, 36), (22, 23, 27)), 'disabled': ((62, 62, 64), (46, 46, 48))}[st]
        im = canvas(w, h)
        if st == 'hover':
            g = canvas(w, h)
            ImageDraw.Draw(g).rounded_rectangle((3 * SS, 4 * SS, (w - 3) * SS, (h - 3) * SS), 8 * SS, outline=self.RED + (255,), width=4 * SS)
            im = Image.alpha_composite(im, g.filter(ImageFilter.GaussianBlur(4 * SS)))
        dy = 2 if st == 'pressed' else 0
        body = filled(w, h, top, bot, 4, 6 + dy, w - 4, h - 4, 7)
        im = Image.alpha_composite(im, body)
        d = ImageDraw.Draw(im)
        d.rounded_rectangle((4 * SS, (6 + dy) * SS, (w - 4) * SS, (h - 4) * SS), 7 * SS, outline=self.EDGE + (255,), width=int(3 * SS))
        if st in ('normal', 'hover'):
            d.line((14 * SS, 12 * SS, (w - 14) * SS, 12 * SS), fill=(110, 114, 124, 255), width=int(1.6 * SS))
        return done(im, w, h)

    def grade(self, n):
        w, h = 128, 160
        c = GRADE[n - 1]
        im = canvas(w, h)
        if n >= 3:
            g = canvas(w, h)
            ImageDraw.Draw(g).rectangle((4 * SS, 4 * SS, (w - 4) * SS, (h - 4) * SS), outline=c + (255,), width=5 * SS)
            im = Image.alpha_composite(im, g.filter(ImageFilter.GaussianBlur(3 * SS)))
        d = ImageDraw.Draw(im)
        outline(d, 3, 3, w - 3, h - 3, c, 3 + n * 0.6)
        outline(d, 3 + 3 + n * 0.6, 3 + 3 + n * 0.6, w - 6 - n * 0.6, h - 6 - n * 0.6, self.EDGE, 1.5)
        return done(im, w, h)

    def gauge_frame(self):
        w, h = 256, 28
        im = canvas(w, h)
        d = ImageDraw.Draw(im)
        d.rounded_rectangle((1 * SS, 1 * SS, (w - 1) * SS, (h - 1) * SS), 5 * SS, fill=(16, 17, 20, 255), outline=self.BEVEL + (255,), width=int(2 * SS))
        d.rounded_rectangle((3 * SS, 3 * SS, (w - 3) * SS, (h - 3) * SS), 4 * SS, outline=self.EDGE + (255,), width=int(1.5 * SS))
        return done(im, w, h)


# ───────────────────────── 3마을 · 천 조각 패치워크 ─────────────────────────
class Forest(Base):
    CREAM, CORAL = ((243, 233, 212), (236, 224, 198)), (232, 134, 106)
    TAIL = ((238, 228, 204), (232, 134, 106))
    FILLS = {'hp': ((240, 140, 120), (214, 104, 84)), 'mp': ((140, 190, 222), (100, 150, 190)), 'xp': ((150, 196, 120), (110, 160, 84))}
    FILL_R = 9

    def panel(self, w, h, inner=False):
        im = filled(w, h, self.CREAM[0], self.CREAM[1], 4, 4, w - 4, h - 4, 8)
        d = ImageDraw.Draw(im)
        outline(d, 4, 4, w - 4, h - 4, self.CORAL, 3, 8)
        dashed(d, 11 * SS, 11 * SS, (w - 11) * SS, (h - 11) * SS, self.CORAL, 1.8, 7, 5)
        for x, y in ((11, 11), (w - 11, 11), (11, h - 11), (w - 11, h - 11)):                      # 단추
            d.ellipse(((x - 6) * SS, (y - 6) * SS, (x + 6) * SS, (y + 6) * SS), fill=(255, 248, 236, 255), outline=(201, 164, 106, 255), width=2 * SS)
            for dx, dy in ((-2, -2), (2, 2)):
                d.ellipse(((x + dx - 1) * SS, (y + dy - 1) * SS, (x + dx + 1) * SS, (y + dy + 1) * SS), fill=(160, 120, 70, 255))
        if inner:
            d.rounded_rectangle((20 * SS, 20 * SS, (w - 20) * SS, (h - 74) * SS), 6 * SS, fill=(191, 220, 176, 255), outline=(255, 249, 236, 255), width=2 * SS)
            dashed(d, 25 * SS, 25 * SS, (w - 25) * SS, (h - 79) * SS, (255, 249, 236), 1.4, 5, 4)
        return shadow_under(im, 2.5, 3, 70)

    def tab(self, on):
        w, h = 120, 44
        im = canvas(w, h)
        d = ImageDraw.Draw(im)
        fill = (191, 220, 176) if on else (232, 224, 204)
        d.rounded_rectangle((3 * SS, 4 * SS, (w - 3) * SS, (h - 4) * SS), 12 * SS, fill=fill + (255,))
        dashed(d, 9 * SS, 10 * SS, (w - 9) * SS, (h - 10) * SS, (255, 249, 236) if on else (201, 190, 164), 1.4, 5, 4)
        return done(im, w, h)

    def btn(self, st):
        w = h = 96
        fill, rim = {'normal': ((232, 134, 106), (190, 96, 70)), 'hover': ((242, 154, 126), (190, 96, 70)), 'pressed': ((210, 112, 86), (170, 80, 58)), 'disabled': ((206, 198, 182), (176, 168, 152))}[st]
        im = canvas(w, h)
        d = ImageDraw.Draw(im)
        dy = 0 if st == 'pressed' else 4
        d.rounded_rectangle((4 * SS, 8 * SS, (w - 4) * SS, (h - 4) * SS), 22 * SS, fill=rim + (255,))
        d.rounded_rectangle((4 * SS, (8 + (0 if dy else 4)) * SS, (w - 4) * SS, (h - 4 - dy) * SS), 22 * SS, fill=fill + (255,))
        dashed(d, 13 * SS, (16 - dy // 2) * SS, (w - 13) * SS, (h - 10 - dy) * SS, (255, 248, 236), 1.6, 6, 4)
        return done(im, w, h)

    def grade(self, n):
        w, h = 128, 160
        c = GRADE[n - 1]
        im = canvas(w, h)
        d = ImageDraw.Draw(im)
        outline(d, 3, 3, w - 3, h - 3, c, 3 + n * 0.6, 16)
        dashed(d, 12 * SS, 12 * SS, (w - 12) * SS, (h - 12) * SS, c, 1.4, 5, 4)
        return done(shadow_under(im, 2, 1, 60) if n == 5 else im, w, h)

    def gauge_frame(self):
        w, h = 256, 28
        im = canvas(w, h)
        d = ImageDraw.Draw(im)
        d.rounded_rectangle((1 * SS, 1 * SS, (w - 1) * SS, (h - 1) * SS), 13 * SS, fill=(250, 244, 228, 255), outline=self.CORAL + (255,), width=int(2 * SS))
        return done(im, w, h)


# ───────────────────────── 4종횡 · 만화 컷 ─────────────────────────
class Story(Base):
    BLK = (17, 17, 17)
    TAIL = ((255, 243, 200), (17, 17, 17))
    FILLS = {'hp': ((238, 66, 102), (200, 40, 76)), 'mp': ((60, 190, 230), (30, 150, 200)), 'xp': ((255, 210, 63), (230, 170, 30))}
    FILL_R = 3

    def panel(self, w, h, inner=False):
        im = canvas(w, h)
        d = ImageDraw.Draw(im)
        d.rectangle((9 * SS, 9 * SS, (w - 3) * SS, (h - 3) * SS), fill=self.BLK + (255,))                 # 밀린 그림자
        body = filled(w, h, (255, 247, 214), (255, 240, 190), 3, 3, w - 9, h - 9)
        im = Image.alpha_composite(im, body)
        d = ImageDraw.Draw(im)
        outline(d, 3, 3, w - 9, h - 9, self.BLK, 5)
        for x, y in ((14, 14), (w - 20, 14), (14, h - 20), (w - 20, h - 20)):                       # 망점
            for i in range(3):
                for j in range(3):
                    d.ellipse(((x + i * 5 - 1) * SS, (y + j * 5 - 1) * SS, (x + i * 5 + 1) * SS, (y + j * 5 + 1) * SS), fill=(232, 185, 43, 255))
        if inner:
            d.rectangle((20 * SS, 20 * SS, (w - 26) * SS, (h - 78) * SS), fill=(255, 255, 255, 255), outline=self.BLK + (255,), width=3 * SS)
        return im

    def tab(self, on):
        w, h = 120, 44
        im = canvas(w, h)
        d = ImageDraw.Draw(im)
        d.rectangle((6 * SS, 8 * SS, (w - 3) * SS, (h - 3) * SS), fill=self.BLK + (255,))
        d.rectangle((3 * SS, 4 * SS, (w - 6) * SS, (h - 7) * SS), fill=((255, 210, 63) if on else (255, 247, 214)) + (255,), outline=self.BLK + (255,), width=int(4 * SS))
        return done(im, w, h)

    def btn(self, st):
        w = h = 96
        fill = {'normal': (255, 210, 63), 'hover': (255, 226, 110), 'pressed': (240, 190, 40), 'disabled': (206, 202, 190)}[st]
        im = canvas(w, h)
        d = ImageDraw.Draw(im)
        off = 0 if st == 'pressed' else 5
        if off:
            d.rectangle((9 * SS, 9 * SS, (w - 3) * SS, (h - 3) * SS), fill=self.BLK + (255,))
        d.rectangle(((4 + (5 - off)) * SS, (4 + (5 - off)) * SS, (w - 4 - off) * SS, (h - 4 - off) * SS), fill=fill + (255,), outline=self.BLK + (255,), width=int(4 * SS))
        return done(im, w, h)

    def grade(self, n):
        w, h = 128, 160
        c = GRADE[n - 1]
        im = canvas(w, h)
        d = ImageDraw.Draw(im)
        outline(d, 3, 3, w - 3, h - 3, self.BLK, 6 + n * 0.5)
        outline(d, 9 + n * 0.5, 9 + n * 0.5, w - 9 - n * 0.5, h - 9 - n * 0.5, c, 3)
        return done(im, w, h)

    def gauge_frame(self):
        w, h = 256, 28
        im = canvas(w, h)
        d = ImageDraw.Draw(im)
        d.rectangle((1 * SS, 1 * SS, (w - 1) * SS, (h - 1) * SS), fill=(255, 255, 255, 255), outline=self.BLK + (255,), width=int(3 * SS))
        return done(im, w, h)


# ───────────────────────── 5천하 · 목판 인쇄 문서 ─────────────────────────
class Realm(Base):
    RED, INK = (181, 55, 42), (36, 26, 18)
    TAIL = ((236, 226, 200), (181, 55, 42))
    FILLS = {'hp': ((181, 55, 42), (140, 36, 26)), 'mp': ((60, 90, 130), (36, 60, 96)), 'xp': ((176, 132, 40), (130, 92, 24))}
    FILL_R = 1

    def panel(self, w, h, inner=False):
        im = filled(w, h, (239, 230, 207), (232, 220, 192), 3, 3, w - 3, h - 3)
        d = ImageDraw.Draw(im)
        outline(d, 3, 3, w - 3, h - 3, self.RED, 3)
        outline(d, 9, 9, w - 9, h - 9, self.RED, 1)
        for x in (17, w - 17):                                                                           # 오사란 세로줄(가장자리 조각 안)
            d.line((x * SS, 12 * SS, x * SS, (h - 12) * SS), fill=self.RED + (110,), width=int(1 * SS))
        for x, y in ((9, 9), (w - 9, 9), (9, h - 9), (w - 9, h - 9)):
            d.rectangle(((x - 4) * SS, (y - 4) * SS, (x + 4) * SS, (y + 4) * SS), fill=self.RED + (255,))
        if inner:
            outline(d, 24, 24, w - 24, h - 76, self.RED, 1)
        return shadow_under(im, 3, 3, 90)

    def tab(self, on):
        w, h = 120, 44
        im = canvas(w, h)
        d = ImageDraw.Draw(im)
        d.rectangle((3 * SS, 5 * SS, (w - 3) * SS, (h - 3) * SS), fill=(self.RED if on else (239, 230, 207)) + (255,), outline=self.RED + (255,), width=int(2.5 * SS))
        return done(im, w, h)

    def btn(self, st):
        w = h = 96
        fill, line, hi = {'normal': ((246, 238, 218), self.RED, False), 'hover': ((248, 226, 216), self.RED, False), 'pressed': (self.RED, (120, 30, 22), False), 'disabled': ((226, 218, 200), (160, 150, 136), False)}[st][:3]
        im = canvas(w, h)
        d = ImageDraw.Draw(im)
        d.rectangle((5 * SS, 7 * SS, (w - 5) * SS, (h - 5) * SS), fill=fill + (255,), outline=line + (255,), width=int(3 * SS))
        if st in ('normal', 'hover'):
            d.rectangle((10 * SS, 12 * SS, (w - 10) * SS, (h - 10) * SS), outline=line + (120,), width=int(1 * SS))
        return done(im, w, h)

    def grade(self, n):
        w, h = 128, 160
        c = GRADE[n - 1]
        im = canvas(w, h)
        d = ImageDraw.Draw(im)
        outline(d, 3, 3, w - 3, h - 3, c, 3 + n * 0.6)
        if n >= 3:
            for x, y in ((8, 8), (w - 8, 8), (8, h - 8), (w - 8, h - 8)):
                d.rectangle(((x - 5) * SS, (y - 5) * SS, (x + 5) * SS, (y + 5) * SS), fill=c + (255,), outline=(239, 230, 207, 255), width=SS)
        return done(shadow_under(im, 2, 1, 60) if n == 5 else im, w, h)

    def gauge_frame(self):
        w, h = 256, 28
        im = canvas(w, h)
        d = ImageDraw.Draw(im)
        d.rectangle((1 * SS, 1 * SS, (w - 1) * SS, (h - 1) * SS), fill=(244, 236, 214, 255), outline=self.RED + (255,), width=int(2 * SS))
        return done(im, w, h)


STYLES = {'go': Go(), 'dungeon': Dungeon(), 'forest': Forest(), 'story': Story(), 'realm': Realm()}
BG = {'go': (90, 140, 150), 'dungeon': (14, 12, 11), 'forest': (70, 100, 56), 'story': (110, 170, 220), 'realm': (52, 44, 36)}


def build(name):
    S = STYLES[name]
    out = os.path.join(HERE, '_out', 'ui', name + '_k202b')
    os.makedirs(out, exist_ok=True)
    imgs = {'window': S.window(), 'popup': S.popup(), 'card': S.card(), 'tab_on': S.tab(True), 'tab_off': S.tab(False),
            'btn_normal': S.btn('normal'), 'btn_hover': S.btn('hover'), 'btn_pressed': S.btn('pressed'), 'btn_disabled': S.btn('disabled'),
            'gauge_frame': S.gauge_frame(), 'gauge_fill_hp': S.gauge_fill('hp'), 'gauge_fill_mp': S.gauge_fill('mp'), 'gauge_fill_xp': S.gauge_fill('xp'),
            'bubble': S.bubble()}
    for n in range(1, 6):
        imgs['grade_%d' % n] = S.grade(n)
    for pn, im in imgs.items():
        im.save(os.path.join(out, pn + '.png'), optimize=True)
        json.dump({'id': '%s/%s' % (name, pn), 'generator': 'tools/asset-forge/uigen_k202b.py (K-0202 2차 A %s)' % NAME[name], 'license': 'CC0-1.0 (코드로 그린 그림 — 외부 입력 없음)',
                   'theme': name, 'game': GAME[name], 'part': pn, 'size': list(im.size)},
                  open(os.path.join(out, pn + '.license.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    sh = Image.new('RGB', (1100, 420), BG[name])

    def put(pn, x, y):
        sh.paste(imgs[pn], (x, y), imgs[pn])
    put('window', 10, 10); put('popup', 212, 10); put('card', 478, 10)
    for i, b in enumerate(('btn_normal', 'btn_hover', 'btn_pressed', 'btn_disabled')):
        put(b, 650 + i * 104, 10)
    for n in range(1, 6):
        put('grade_%d' % n, 10 + (n - 1) * 136, 240)
    for i, g in enumerate(('hp', 'mp', 'xp')):
        put('gauge_frame', 700, 130 + i * 40); put('gauge_fill_' + g, 700, 134 + i * 40)
    put('tab_on', 700, 260); put('tab_off', 830, 260); put('bubble', 700, 300)
    sh.save(os.path.join(HERE, '_out', 'ui', 'k202b_%s_sheet.jpg' % name), quality=90)
    print('K202B_STYLE', name, len(imgs))
    return out


def check(name, out):
    """9분할 한가운데 줄이 한 색(uigen.check 와 같은 기준)인지 — 정본에 놓기 전에."""
    sys.path.insert(0, HERE)
    from uigen import PARTS
    bad = []
    for pname, (w, h, k) in PARTS.items():
        p = os.path.join(out, pname + '.png')
        im = Image.open(p)
        if im.size != (w, h):
            bad.append('크기 %s/%s %s' % (name, pname, im.size))
        if isinstance(k, int) and pname != 'card':
            a = im.convert('RGBA')
            mid = [a.getpixel((x, h // 2)) for x in range(k + 2, w - k - 2)]
            if len(set(mid)) > 12:
                bad.append('9분할 가운데 줄이 한 색이 아님 %s/%s (%d색)' % (name, pname, len(set(mid))))
    return bad


def publish(name, out):
    for dst in ('saga-assets/ui/%s' % name, 'saga-web/shared/assets/ui/%s' % name, 'saga-web/%s/assets/ui' % GAME[name]):
        d = os.path.join(ROOT, dst)
        os.makedirs(d, exist_ok=True)
        for f in os.listdir(out):
            if f.endswith('.png') or os.path.exists(os.path.join(d, f)) or not dst.endswith('assets/ui'):
                shutil.copy(os.path.join(out, f), os.path.join(d, f))
    print('K202B_PUBLISH', name)


if __name__ == '__main__':
    names = [a for a in sys.argv[1:] if not a.startswith('--')]
    names = names[0].split(',') if names else list(STYLES)
    fails = 0
    for nm in names:
        o = build(nm)
        bad = check(nm, o)
        for b in bad:
            print(' -', b)
        fails += len(bad)
        if '--publish' in sys.argv and not bad:
            publish(nm, o)
    print('UI_FAIL' if fails else 'UI_OK')
    sys.exit(1 if fails else 0)
