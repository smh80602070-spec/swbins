"""K-0202 ② — 네 판 UI 「1번」(사용자 10-26 「1번으로 모두」): uigen.py 와 같은 부품 19·같은 크기·같은 9분할, 판마다 다른 모양 언어.
  go     = 지도 앱 알약(흰 카드·큰 둥근 모서리·청록 강조·알약 버튼)
  forest = 나무 판자(가로 판자 결·못 머리·통통한 초록 버튼)
  story  = 통통 게임창(흰 몸·두꺼운 남색 테두리·주황 머리띠·노란 젤리 버튼)
  realm  = 비단 족자(크림 비단·붉은 비단 띠·금 실선·위아래 나무 축·붉은 인장 버튼)
9분할: 늘어나는 한가운데는 가로 한 줄이 한 색(세로 그러데이션·가로 줄만) — `uigen.py --check` 통과. 2나락(乙 돌판)은 uigen_stone.py.

  py tools/asset-forge/uigen_styles.py [go,forest,story,realm]   # _out/ui/<판>_k202/ + 시트 _out/ui/k202_<판>_sheet.jpg
  py tools/asset-forge/uigen_styles.py --publish                  # 정본 saga-assets/ui/<판> · 웹 공용 · 판 폴더 assets/ui 덮기(같은 이름)
"""
import json
import os
import shutil
import sys

from PIL import Image, ImageDraw, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
SS = 4
GAME = {'go': 'saga-go', 'forest': 'saga-forest', 'story': 'saga-story', 'realm': 'saga-realm'}
GRADE = [(150, 150, 150), (96, 176, 92), (74, 140, 228), (160, 92, 220), (236, 160, 48)]


def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))


def canvas(w, h):
    return Image.new('RGBA', (w * SS, h * SS), (0, 0, 0, 0))


def vgrad_mask(w, h, top, bot, mask):
    W, H = w * SS, h * SS
    g = Image.new('RGBA', (W, H))
    d = ImageDraw.Draw(g)
    for y in range(H):
        d.line((0, y, W, y), fill=lerp(top, bot, y / max(1, H - 1)) + (255,))
    out = canvas(w, h)
    out.paste(g, (0, 0), mask)
    return out


def rmask(w, h, r, inset=0, extra_bottom=0):
    m = Image.new('L', (w * SS, h * SS), 0)
    ImageDraw.Draw(m).rounded_rectangle((inset * SS, inset * SS, (w - inset) * SS - 1, (h - inset + extra_bottom) * SS - 1), r * SS, fill=255)
    return m


def shadow_under(im, r_blur=3, dy=3, alpha=90):
    a = im.split()[3]
    sh = Image.new('RGBA', im.size, (0, 0, 0, 0))
    sh.putalpha(a.point(lambda v: v * alpha // 255))
    sh = sh.filter(ImageFilter.GaussianBlur(r_blur * SS))
    out = Image.new('RGBA', im.size, (0, 0, 0, 0))
    out.paste(sh, (0, dy * SS), sh)
    return Image.alpha_composite(out, im)


def done(im, w, h):
    return im.resize((w, h), Image.LANCZOS)


# ── 판마다 그리는 법 ──────────────────────────────────────────────
class Go:
    """지도 앱 알약."""
    BG_T, BG_B, LINE, ACC, ACC_D, TXT = (252, 254, 253), (240, 247, 245), (214, 232, 228), (23, 160, 143), (16, 112, 100), (23, 50, 58)

    def panel(self, w, h, r=24, inset=3):
        im = vgrad_mask(w, h, self.BG_T, self.BG_B, rmask(w, h, r, inset))
        d = ImageDraw.Draw(im)
        d.rounded_rectangle((inset * SS, inset * SS, (w - inset) * SS - 1, (h - inset) * SS - 1), r * SS, outline=self.LINE + (255,), width=int(1.5 * SS))
        return shadow_under(im, 2.5, 2, 70)

    def window(self): return done(self.panel(192, 192), 192, 192)

    def popup(self):
        im = self.panel(256, 192, 26)
        d = ImageDraw.Draw(im)
        d.rounded_rectangle((110 * SS, 9 * SS, 146 * SS, 13 * SS), 2 * SS, fill=self.LINE + (255,))      # 끌개 손잡이
        return done(im, 256, 192)

    def card(self):
        im = self.panel(160, 224, 22)
        d = ImageDraw.Draw(im)
        d.rounded_rectangle((12 * SS, 12 * SS, 148 * SS, 136 * SS), 16 * SS, fill=(230, 244, 241, 255))
        return done(im, 160, 224)

    def tab(self, on):
        w, h = 120, 44
        im = canvas(w, h)
        d = ImageDraw.Draw(im)
        d.rounded_rectangle((3 * SS, 4 * SS, (w - 3) * SS, (h - 4) * SS), 14 * SS, fill=(self.ACC if on else (230, 244, 241)) + (255,))
        return done(im, w, h)

    def btn(self, st):
        w = h = 96
        fill, rim = {'normal': ((23, 160, 143), (16, 112, 100)), 'hover': ((40, 182, 164), (16, 112, 100)),
                     'pressed': ((16, 120, 108), (10, 80, 72)), 'disabled': ((196, 206, 204), (160, 170, 168))}[st]
        im = canvas(w, h)
        d = ImageDraw.Draw(im)
        dy = 0 if st == 'pressed' else 4
        d.rounded_rectangle((4 * SS, 8 * SS, (w - 4) * SS, (h - 4) * SS), 22 * SS, fill=rim + (255,))   # 둥글기 ≤ 9분할 조각 24
        d.rounded_rectangle((4 * SS, (8 - dy + 4) * SS - 4 * SS if dy else 8 * SS, (w - 4) * SS, (h - 4 - dy) * SS), 22 * SS, fill=fill + (255,))
        if st in ('normal', 'hover'):
            d.line((24 * SS, 14 * SS, (w - 24) * SS, 14 * SS), fill=(255, 255, 255, 110), width=int(2 * SS))
        return done(im, w, h)

    def grade(self, n):
        w, h = 128, 160
        c = GRADE[n - 1]
        im = canvas(w, h)
        d = ImageDraw.Draw(im)
        d.rounded_rectangle((3 * SS, 3 * SS, (w - 3) * SS, (h - 3) * SS), 20 * SS, outline=c + (255,), width=int((3 + n * 0.6) * SS))
        if n >= 3:
            d.ellipse(((w / 2 - 6) * SS, 0, (w / 2 + 6) * SS, 12 * SS), fill=c + (255,), outline=(255, 255, 255, 255), width=SS)
        return done(shadow_under(im, 2, 1, 60) if n == 5 else im, w, h)

    def gauge_frame(self):
        w, h = 256, 28
        im = canvas(w, h)
        ImageDraw.Draw(im).rounded_rectangle((1 * SS, 1 * SS, (w - 1) * SS, (h - 1) * SS), 13 * SS, fill=(230, 244, 241, 255), outline=self.LINE + (255,), width=int(1.5 * SS))
        return done(im, w, h)

    def gauge_fill(self, kind):
        c = {'hp': ((255, 112, 92), (232, 72, 60)), 'mp': ((88, 168, 255), (52, 120, 230)), 'xp': ((44, 200, 176), (23, 160, 143))}[kind]
        return pill_fill(c)

    def bubble(self):
        return bubble_generic(self.panel(192, 92, 22), self.BG_B, self.LINE)


class Forest:
    """나무 판자."""
    PL = [(186, 130, 74), (176, 120, 66), (190, 136, 80), (172, 116, 62)]
    SEAM, RIM, NAIL = (120, 76, 38), (110, 67, 32), (90, 82, 74)

    def board(self, w, h, r=14, ph=34):
        W, H = w * SS, h * SS
        g = Image.new('RGBA', (W, H))
        d = ImageDraw.Draw(g)
        for y in range(H):
            k = (y // (ph * SS)) % len(self.PL)
            yy = (y % (ph * SS)) / (ph * SS)
            c = lerp(self.PL[k], lerp(self.PL[k], (0, 0, 0), 0.12), yy)
            if y % (ph * SS) < SS * 1.5:
                c = self.SEAM
            d.line((0, y, W, y), fill=c + (255,))
        im = canvas(w, h)
        im.paste(g, (0, 0), rmask(w, h, r, 2))
        d = ImageDraw.Draw(im)
        d.rounded_rectangle((2 * SS, 2 * SS, (w - 2) * SS - 1, (h - 2) * SS - 1), r * SS, outline=self.RIM + (255,), width=int(3.5 * SS))
        for cx, cy in ((11, 11), (w - 11, 11), (11, h - 11), (w - 11, h - 11)):
            d.ellipse(((cx - 4) * SS, (cy - 4) * SS, (cx + 4) * SS, (cy + 4) * SS), fill=self.NAIL + (255,), outline=(40, 34, 30, 255), width=SS)
            d.ellipse(((cx - 2) * SS, (cy - 3) * SS, cx * SS, (cy - 1) * SS), fill=(170, 160, 150, 255))
        return shadow_under(im, 2.5, 3, 80)

    def window(self): return done(self.board(192, 192), 192, 192)
    def popup(self): return done(self.board(256, 192, 16), 256, 192)

    def card(self):
        im = self.board(160, 224, 14)
        d = ImageDraw.Draw(im)
        d.rounded_rectangle((14 * SS, 16 * SS, 146 * SS, 136 * SS), 10 * SS, fill=(247, 236, 210, 255), outline=self.RIM + (255,), width=int(2 * SS))
        return done(im, 160, 224)

    def tab(self, on):
        w, h = 120, 44
        im = canvas(w, h)
        d = ImageDraw.Draw(im)
        d.rounded_rectangle((3 * SS, 4 * SS, (w - 3) * SS, (h + 10) * SS), 12 * SS, fill=((196, 140, 84) if on else (150, 104, 60)) + (255,), outline=self.RIM + (255,), width=int(2.5 * SS))
        return done(im, w, h)

    def btn(self, st):
        w = h = 96
        fill, rim = {'normal': ((124, 179, 66), (77, 122, 34)), 'hover': ((146, 198, 84), (77, 122, 34)),
                     'pressed': ((96, 150, 48), (60, 98, 24)), 'disabled': ((176, 168, 150), (138, 130, 112))}[st]
        im = canvas(w, h)
        d = ImageDraw.Draw(im)
        dy = 0 if st == 'pressed' else 6
        d.rounded_rectangle((4 * SS, 10 * SS, (w - 4) * SS, (h - 4) * SS), 24 * SS, fill=rim + (255,))
        d.rounded_rectangle((4 * SS, (10 - (0 if dy else -4)) * SS - (4 * SS if dy else 0), (w - 4) * SS, (h - 4 - dy) * SS), 24 * SS, fill=fill + (255,))
        if st in ('normal', 'hover'):
            d.ellipse((16 * SS, 12 * SS, 34 * SS, 22 * SS), fill=(255, 255, 255, 90))
        return done(im, w, h)

    def grade(self, n):
        w, h = 128, 160
        c = GRADE[n - 1]
        im = canvas(w, h)
        d = ImageDraw.Draw(im)
        d.rounded_rectangle((3 * SS, 3 * SS, (w - 3) * SS, (h - 3) * SS), 14 * SS, outline=self.RIM + (255,), width=int(7 * SS))
        d.rounded_rectangle((6 * SS, 6 * SS, (w - 6) * SS, (h - 6) * SS), 12 * SS, outline=c + (255,), width=int((2 + n * 0.5) * SS))
        if n >= 3:
            d.polygon([((w / 2) * SS, 0), ((w / 2 + 8) * SS, 8 * SS), ((w / 2) * SS, 16 * SS), ((w / 2 - 8) * SS, 8 * SS)], fill=c + (255,), outline=self.RIM + (255,))
        return done(im, w, h)

    def gauge_frame(self):
        w, h = 256, 28
        im = canvas(w, h)
        ImageDraw.Draw(im).rounded_rectangle((1 * SS, 1 * SS, (w - 1) * SS, (h - 1) * SS), 10 * SS, fill=(92, 58, 28, 255), outline=self.RIM + (255,), width=int(2.5 * SS))
        return done(im, w, h)

    def gauge_fill(self, kind):
        c = {'hp': ((236, 96, 80), (196, 56, 48)), 'mp': ((96, 166, 230), (56, 118, 196)), 'xp': ((244, 200, 72), (212, 156, 36))}[kind]
        return pill_fill(c)

    def bubble(self):
        return bubble_generic(self.board(192, 92, 16), self.PL[3], self.RIM)


class Story:
    """통통 게임창."""
    NAVY, NAVY_D, HEAD_T, HEAD_B = (43, 92, 148), (27, 61, 102), (255, 181, 71), (255, 138, 31)

    def frame(self, w, h, r=22, head=0):
        im = canvas(w, h)
        d = ImageDraw.Draw(im)
        d.rounded_rectangle((2 * SS, 4 * SS, (w - 2) * SS, (h - 1) * SS), r * SS, fill=self.NAVY_D + (255,))                       # 아래 그늘 테
        d.rounded_rectangle((2 * SS, 2 * SS, (w - 2) * SS, (h - 4) * SS), r * SS, fill=self.NAVY + (255,))
        d.rounded_rectangle((7 * SS, 7 * SS, (w - 7) * SS, (h - 9) * SS), (r - 5) * SS, fill=(255, 255, 255, 255))
        if head:
            m = rmask(w, h, r - 5, 7)
            hb = vgrad_mask(w, head, self.HEAD_T, self.HEAD_B, Image.new('L', (w * SS, head * SS), 255))
            band = canvas(w, h)
            band.paste(hb, (0, 0))
            band.putalpha(Image.composite(band.split()[3], Image.new('L', band.size, 0), m))
            im = Image.alpha_composite(im, band)
        return shadow_under(im, 3, 3, 90)

    def window(self): return done(self.frame(192, 192, 22, 30), 192, 192)
    def popup(self): return done(self.frame(256, 192, 24, 34), 256, 192)
    def card(self): return done(self.frame(160, 224, 20, 0), 160, 224)

    def tab(self, on):
        w, h = 120, 44
        im = canvas(w, h)
        d = ImageDraw.Draw(im)
        d.rounded_rectangle((3 * SS, 4 * SS, (w - 3) * SS, (h + 12) * SS), 14 * SS, fill=self.NAVY + (255,))
        d.rounded_rectangle((7 * SS, 8 * SS, (w - 7) * SS, (h + 12) * SS), 10 * SS, fill=((255, 225, 122) if on else (214, 228, 244)) + (255,))
        return done(im, w, h)

    def btn(self, st):
        w = h = 96
        fill = {'normal': (255, 225, 122), 'hover': (255, 236, 160), 'pressed': (240, 200, 90), 'disabled': (210, 214, 220)}[st]
        rim = self.NAVY if st != 'disabled' else (150, 158, 170)
        im = canvas(w, h)
        d = ImageDraw.Draw(im)
        dy = 0 if st == 'pressed' else 5
        d.rounded_rectangle((4 * SS, 9 * SS, (w - 4) * SS, (h - 3) * SS), 22 * SS, fill=rim + (255,))
        d.rounded_rectangle((4 * SS, 4 * SS + (5 * SS if not dy else 0), (w - 4) * SS, (h - 3 - dy) * SS), 22 * SS, fill=rim + (255,))
        d.rounded_rectangle((8 * SS, 8 * SS + (5 * SS if not dy else 0), (w - 8) * SS, (h - 7 - dy) * SS), 18 * SS, fill=fill + (255,))
        if st in ('normal', 'hover'):
            d.rounded_rectangle((16 * SS, 13 * SS, (w - 16) * SS, 20 * SS), 4 * SS, fill=(255, 255, 255, 140))
        return done(im, w, h)

    def grade(self, n):
        w, h = 128, 160
        c = GRADE[n - 1]
        im = canvas(w, h)
        d = ImageDraw.Draw(im)
        d.rounded_rectangle((3 * SS, 3 * SS, (w - 3) * SS, (h - 3) * SS), 18 * SS, outline=self.NAVY + (255,), width=int(6 * SS))
        d.rounded_rectangle((8 * SS, 8 * SS, (w - 8) * SS, (h - 8) * SS), 13 * SS, outline=c + (255,), width=int((2.5 + n * 0.5) * SS))
        for i in range(min(n, 5)):
            cx = w / 2 + (i - (n - 1) / 2) * 12
            d.ellipse(((cx - 4) * SS, 0, (cx + 4) * SS, 8 * SS), fill=(255, 225, 122, 255), outline=self.NAVY + (255,), width=SS)
        return done(im, w, h)

    def gauge_frame(self):
        w, h = 256, 28
        im = canvas(w, h)
        ImageDraw.Draw(im).rounded_rectangle((1 * SS, 1 * SS, (w - 1) * SS, (h - 1) * SS), 13 * SS, fill=(18, 36, 64, 255), outline=self.NAVY + (255,), width=int(3 * SS))
        return done(im, w, h)

    def gauge_fill(self, kind):
        c = {'hp': ((255, 96, 96), (220, 48, 64)), 'mp': ((86, 196, 255), (40, 140, 230)), 'xp': ((255, 214, 72), (255, 160, 20))}[kind]
        return pill_fill(c)

    def bubble(self):
        return bubble_generic(self.frame(192, 92, 20, 0), (255, 255, 255), self.NAVY)


class Realm:
    """비단 족자."""
    SILK_T, SILK_B, RED, RED_D, GOLD, ROD = (239, 228, 200), (226, 211, 174), (110, 42, 30), (74, 24, 16), (216, 181, 106), (42, 26, 14)

    def scroll(self, w, h, rods=True):
        im = canvas(w, h)
        d = ImageDraw.Draw(im)
        top = 9 if rods else 2
        d.rectangle((2 * SS, top * SS, (w - 2) * SS, (h - top) * SS), fill=self.RED + (255,))
        inner = vgrad_mask(w, h, self.SILK_T, self.SILK_B, Image.new('L', (w * SS, h * SS), 0))
        m = Image.new('L', (w * SS, h * SS), 0)
        ImageDraw.Draw(m).rectangle((13 * SS, (top + 11) * SS, (w - 13) * SS, (h - top - 11) * SS), fill=255)
        inner = vgrad_mask(w, h, self.SILK_T, self.SILK_B, m)
        im = Image.alpha_composite(im, inner)
        d = ImageDraw.Draw(im)
        d.rectangle((11 * SS, (top + 9) * SS, (w - 11) * SS, (h - top - 9) * SS), outline=self.GOLD + (255,), width=SS)
        if rods:
            for y in (0, h - 12):
                d.rounded_rectangle((0, y * SS, w * SS - 1, (y + 12) * SS), 5 * SS, fill=self.ROD + (255,))
                d.line((4 * SS, (y + 3) * SS, (w - 4) * SS, (y + 3) * SS), fill=(120, 84, 50, 255), width=SS)
        return shadow_under(im, 3, 3, 110)

    def window(self): return done(self.scroll(192, 192), 192, 192)
    def popup(self): return done(self.scroll(256, 192), 256, 192)
    def card(self): return done(self.scroll(160, 224, rods=False), 160, 224)

    def tab(self, on):
        w, h = 120, 44
        im = canvas(w, h)
        d = ImageDraw.Draw(im)
        d.rectangle((3 * SS, 5 * SS, (w - 3) * SS, h * SS), fill=(self.RED if on else (92, 70, 54)) + (255,))
        d.rectangle((8 * SS, 10 * SS, (w - 8) * SS, h * SS), fill=(self.SILK_T if on else (196, 182, 150)) + (255,))
        d.line((8 * SS, 10 * SS, (w - 8) * SS, 10 * SS), fill=self.GOLD + (255,), width=SS)
        return done(im, w, h)

    def btn(self, st):
        w = h = 96
        fill, rim = {'normal': ((247, 239, 220), self.RED), 'hover': ((255, 248, 232), (150, 56, 40)),
                     'pressed': ((226, 211, 174), self.RED_D), 'disabled': ((210, 204, 190), (140, 130, 116))}[st]
        im = canvas(w, h)
        d = ImageDraw.Draw(im)
        d.rectangle((4 * SS, 4 * SS, (w - 4) * SS, (h - 4) * SS), fill=rim + (255,))
        d.rectangle((9 * SS, 9 * SS, (w - 9) * SS, (h - 9) * SS), fill=fill + (255,))
        d.rectangle((12 * SS, 12 * SS, (w - 12) * SS, (h - 12) * SS), outline=(self.GOLD if st != 'disabled' else (170, 160, 140)) + (255,), width=SS)
        return done(shadow_under(im, 1.5, 2, 90) if st != 'pressed' else im, w, h)

    def grade(self, n):
        w, h = 128, 160
        c = GRADE[n - 1]
        im = canvas(w, h)
        d = ImageDraw.Draw(im)
        d.rectangle((3 * SS, 3 * SS, (w - 3) * SS, (h - 3) * SS), outline=self.RED + (255,), width=int(7 * SS))
        d.rectangle((9 * SS, 9 * SS, (w - 9) * SS, (h - 9) * SS), outline=c + (255,), width=int((2 + n * 0.5) * SS))
        if n >= 3:
            d.rectangle(((w - 26) * SS, (h - 26) * SS, (w - 8) * SS, (h - 8) * SS), fill=(181, 42, 30, 255))                    # 인장
        return done(im, w, h)

    def gauge_frame(self):
        w, h = 256, 28
        im = canvas(w, h)
        d = ImageDraw.Draw(im)
        d.rectangle((1 * SS, 2 * SS, (w - 1) * SS, (h - 2) * SS), fill=(40, 26, 18, 255), outline=self.RED + (255,), width=int(2.5 * SS))
        d.line((4 * SS, 5 * SS, (w - 4) * SS, 5 * SS), fill=self.GOLD + (200,), width=SS)
        return done(im, w, h)

    def gauge_fill(self, kind):
        c = {'hp': ((196, 52, 36), (130, 26, 16)), 'mp': ((70, 104, 160), (36, 58, 104)), 'xp': ((216, 181, 106), (160, 120, 50))}[kind]
        return pill_fill(c, r=2)

    def bubble(self):
        return bubble_generic(self.scroll(192, 92, rods=False), self.SILK_B, self.RED)


def pill_fill(c, r=9):
    w, h = 256, 20
    im = vgrad_mask(w, h, c[0], c[1], rmask(w, h, r))
    ImageDraw.Draw(im).line((8 * SS, 4 * SS, (w - 8) * SS, 4 * SS), fill=(255, 255, 255, 80), width=SS)
    return done(im, w, h)


def bubble_generic(body, fill, rim):
    w, h, bh = 192, 112, 92
    im = canvas(w, h)
    im.paste(body, (0, 0), body)
    d = ImageDraw.Draw(im)
    tail = [((w / 2 - 12) * SS, (bh - 8) * SS), ((w / 2 + 12) * SS, (bh - 8) * SS), (w / 2 * SS, (h - 3) * SS)]
    d.polygon(tail, fill=fill + (255,))
    d.line([tail[0], tail[2], tail[1]], fill=rim + (255,), width=int(2.5 * SS))
    return done(im, w, h)


STYLES = {'go': Go(), 'forest': Forest(), 'story': Story(), 'realm': Realm()}


def build(name):
    S = STYLES[name]
    out = os.path.join(HERE, '_out', 'ui', name + '_k202')
    os.makedirs(out, exist_ok=True)
    imgs = {'window': S.window(), 'popup': S.popup(), 'card': S.card(), 'tab_on': S.tab(True), 'tab_off': S.tab(False),
            'btn_normal': S.btn('normal'), 'btn_hover': S.btn('hover'), 'btn_pressed': S.btn('pressed'), 'btn_disabled': S.btn('disabled'),
            'gauge_frame': S.gauge_frame(), 'gauge_fill_hp': S.gauge_fill('hp'), 'gauge_fill_mp': S.gauge_fill('mp'), 'gauge_fill_xp': S.gauge_fill('xp'),
            'bubble': S.bubble()}
    for n in range(1, 6):
        imgs[f'grade_{n}'] = S.grade(n)
    style_name = {'go': '지도 앱 알약', 'forest': '나무 판자', 'story': '통통 게임창', 'realm': '비단 족자'}[name]
    for pn, im in imgs.items():
        im.save(os.path.join(out, pn + '.png'), optimize=True)
        json.dump({'id': f'{name}/{pn}', 'generator': f'tools/asset-forge/uigen_styles.py (K-0202 1번 {style_name})', 'license': 'CC0-1.0 (코드로 그린 그림 — 외부 입력 없음)',
                   'theme': name, 'game': GAME[name], 'part': pn, 'size': list(im.size)},
                  open(os.path.join(out, pn + '.license.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    bg = {'go': (90, 140, 150), 'forest': (70, 100, 56), 'story': (110, 170, 220), 'realm': (52, 44, 36)}[name]
    sh = Image.new('RGB', (1100, 420), bg)
    def put(pn, x, y):
        sh.paste(imgs[pn], (x, y), imgs[pn])
    put('window', 10, 10); put('popup', 212, 10); put('card', 478, 10)
    for i, b in enumerate(('btn_normal', 'btn_hover', 'btn_pressed', 'btn_disabled')):
        put(b, 650 + i * 104, 10)
    for n in range(1, 6):
        put(f'grade_{n}', 10 + (n - 1) * 136, 240)
    for i, g in enumerate(('hp', 'mp', 'xp')):
        put('gauge_frame', 700, 130 + i * 40); put('gauge_fill_' + g, 700, 134 + i * 40)
    put('tab_on', 700, 260); put('tab_off', 830, 260); put('bubble', 700, 300)
    sh.save(os.path.join(HERE, '_out', 'ui', f'k202_{name}_sheet.jpg'), quality=90)
    print('K202_STYLE', name, len(imgs))
    return out


def publish(name, out):
    for dst in (f'saga-assets/ui/{name}', f'saga-web/shared/assets/ui/{name}', f'saga-web/{GAME[name]}/assets/ui'):
        d = os.path.join(ROOT, dst)
        os.makedirs(d, exist_ok=True)
        for f in os.listdir(out):
            if f.endswith('.png') or os.path.exists(os.path.join(d, f)) or not dst.endswith('assets/ui'):
                shutil.copy(os.path.join(out, f), os.path.join(d, f))
    print('K202_PUBLISH', name)


if __name__ == '__main__':
    names = [a for a in sys.argv[1:] if not a.startswith('--')]
    names = names[0].split(',') if names else list(STYLES)
    for nm in names:
        o = build(nm)
        if '--publish' in sys.argv:
            publish(nm, o)
