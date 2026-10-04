"""world-forge 몬스터·보스 몸 (K-0043) — 비인간형 몸을 계통별로 코드로 조립한다. 재질만 Poly Haven CC0 사진(툰 256px), 형태는 전부 코드.

  blender -b --factory-startup -P tools/world-forge/build_monster.py -- --id mon_quad_01 --out <절대>/mon_quad_01.glb [--style toon]
  blender -b --factory-startup -P tools/world-forge/build_monster.py -- --all --out-dir <절대 폴더> [--style toon]
  blender -b --factory-startup -P tools/world-forge/build_monster.py -- --list

계통 5 × 변형 4 = 20 + 보스 12 = 32종. id 는 `mon_<계통>_<nn>`·`boss_<nn>`(원작 몬스터 이름·모양 모사 없음 — 일반 계통 이름만).
  quad(네발 짐승) · wing(날개) · serp(뱀형) · cons(기계·구조물) · spir(정령)
원점 = 발 밑 가운데, 얼굴이 Blender -y(glTF +z) 쪽, 단위 m, 한 변 약 1~1.6m(보스는 ×2.6~3.4). 동작은 뼈 없이 `tools/glb-compress/creature_fill.mjs`
(몸 루트 노드 변환 키프레임)로 7칸을 채운다 — 코드 몸은 부품이 한 메시라 뼈 리깅 없이 쓴다.
"""
import json
import math
import os
import random
import sys

import bpy
from mathutils import Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import build_prop as BP  # noqa: E402
import wf_common as W  # noqa: E402
from build_prop import tube, obox, A, arg  # noqa: E402

BP.TRIS_MAX = 4000
BP.GENERATOR = 'tools/world-forge/build_monster.py'

# 계통별 피부 후보(재질, 타일, 색) — 변형마다 하나씩, 보스는 따로
SKINS = [
    ('forest_ground_04', 1.2, '#5a6b3a'), ('dry_ground_01', 1.2, '#8a6a44'), ('cliff_side', 1.5, '#6b5a50'), ('aerial_rocks_02', 1.5, '#4f5663'),
    ('brown_mud', 1.2, '#6a4a34'), ('coast_sand_rocks_02', 1.5, '#a89a80'), ('grey_plaster', 1.2, '#5d6b7a'), ('snow_02', 1.5, '#cfd8e0'),
]
EYES = ['#ffd24a', '#ff4a3a', '#6af0ff', '#b86aff']


def blob(M, c, r, slot, nu=10, nv=6, tile=1.0):
    """타원체 (중심 c, 반지름 r=(x,y,z)) — 위·아래 극은 삼각형 부채. 면마다 점이 따로라 저폴리 각진 맛."""
    cx, cy, cz = c
    rx, ry, rz = r

    def pt(i, j):
        th = math.pi * j / nv
        ph = 2 * math.pi * (i % nu) / nu
        return (cx + rx * math.sin(th) * math.cos(ph), cy + ry * math.sin(th) * math.sin(ph), cz + rz * math.cos(th))
    for j in range(nv):
        for i in range(nu):
            u0, u1 = i / nu * 2 * math.pi * max(rx, ry) / tile, (i + 1) / nu * 2 * math.pi * max(rx, ry) / tile
            v0, v1 = j / nv * math.pi * rz / tile, (j + 1) / nv * math.pi * rz / tile
            if j == 0:
                M.face([pt(i, 0), pt(i + 1, 1), pt(i, 1)], [((u0 + u1) / 2, v0), (u1, v1), (u0, v1)], slot)
            elif j == nv - 1:
                M.face([pt(i, nv), pt(i, nv - 1), pt(i + 1, nv - 1)], [((u0 + u1) / 2, v1), (u0, v0), (u1, v0)], slot)
            else:
                M.face([pt(i, j), pt(i + 1, j), pt(i + 1, j + 1), pt(i, j + 1)], [(u0, v0), (u1, v0), (u1, v1), (u0, v1)], slot)


def cone(M, base, tip, r, slot, n=6):
    tube(M, base, tip, r, 0.0, slot, 1.0, n, caps=True)


def mats(C, rnd, skin=None, boss=False):
    sk = skin or rnd.choice(SKINS)
    body = C.s(sk[0], sk[1], sk[2])
    dark = C.s(sk[0], sk[1], _shade(sk[2], 0.55))
    belly = C.s(sk[0], sk[1], _shade(sk[2], 1.35))
    eye = C.s('white_stucco', 1.0, rnd.choice(EYES), gain=1.9)
    horn = C.s('coast_sand_rocks_02', 1.0, '#d8cdb0' if not boss else '#2e2a33')
    return body, dark, belly, eye, horn


def _shade(h, k):
    h = h.lstrip('#')
    v = [min(255, int(int(h[i:i + 2], 16) * k)) for i in (0, 2, 4)]
    return '#%02x%02x%02x' % tuple(v)


def eyes(M, eye, y, z, x, r=0.035):
    for s in (-1, 1):
        blob(M, (s * x, y, z), (r, r * 0.8, r), eye, 6, 4)


# ---------------------------------------------------------------- 계통 레시피 (rnd 로 변형, k = 크기 배율)
def quad(C, rnd, k=1.0, boss=False, skin=None):
    M = C.M
    body, dark, belly, eye, horn = mats(C, rnd, skin, boss)
    bl = rnd.uniform(0.85, 1.15) * k
    bw = rnd.uniform(0.26, 0.36) * k
    bh = rnd.uniform(0.26, 0.34) * k
    lh = rnd.uniform(0.30, 0.46) * k                                      # 다리 길이
    zc = lh + bh * 0.7
    blob(M, (0, 0, zc), (bw, bl * 0.55, bh), body, 10, 6)                 # 몸통
    blob(M, (0, -0.05 * k, zc - bh * 0.35), (bw * 0.8, bl * 0.45, bh * 0.6), belly, 8, 5)
    hy = -bl * 0.55 - 0.14 * k
    hz = zc + bh * rnd.uniform(0.2, 0.6)
    tube(M, (0, -bl * 0.35, zc + bh * 0.3), (0, hy + 0.1 * k, hz), bw * 0.55, bw * 0.42, body, 1.0, 7)   # 목
    hr = rnd.uniform(0.17, 0.24) * k
    blob(M, (0, hy, hz), (hr, hr * 1.05, hr * 0.95), body, 9, 6)          # 머리
    sn = rnd.uniform(0.07, 0.16) * k
    blob(M, (0, hy - hr * 0.9, hz - hr * 0.2), (hr * 0.55, sn + 0.06 * k, hr * 0.45), belly, 7, 4)       # 주둥이
    eyes(M, eye, hy - hr * 0.55, hz + hr * 0.2, hr * 0.5, 0.03 * k + 0.01)
    for s in (-1, 1):                                                       # 귀 또는 뿔
        if rnd.random() < 0.5:
            cone(M, (s * hr * 0.55, hy + 0.02, hz + hr * 0.7), (s * hr * 0.9, hy + 0.05, hz + hr * 1.5), hr * 0.28, body, 5)
        else:
            tube(M, (s * hr * 0.5, hy, hz + hr * 0.8), (s * hr * 1.1, hy - 0.05 * k, hz + hr * 1.7), hr * 0.18, 0.0, horn, 1.0, 5)
    for sx in (-1, 1):                                                      # 다리 넷
        for sy in (-1, 1):
            x, y = sx * bw * 0.75, sy * bl * 0.33 - 0.02 * k
            tube(M, (x, y, zc - bh * 0.2), (x * 1.05, y + sy * 0.03, 0.05 * k), 0.12 * k, 0.08 * k, dark, 1.0, 6)
            blob(M, (x * 1.05, y - 0.04 * k, 0.04 * k), (0.085 * k, 0.12 * k, 0.045 * k), dark, 6, 4)
    tl = rnd.uniform(0.35, 0.7) * k                                          # 꼬리 둘 마디
    tube(M, (0, bl * 0.5, zc + 0.02), (0, bl * 0.5 + tl * 0.5, zc + 0.08 * k), 0.09 * k, 0.06 * k, body, 1.0, 6)
    tube(M, (0, bl * 0.5 + tl * 0.5, zc + 0.08 * k), (0, bl * 0.5 + tl, zc + rnd.uniform(0.0, 0.3) * k), 0.06 * k, 0.025 * k, dark, 1.0, 6)
    if rnd.random() < 0.65 or boss:                                          # 등 가시
        n = rnd.randint(3, 5)
        for i in range(n):
            y = -bl * 0.35 + i * bl * 0.7 / max(1, n - 1)
            cone(M, (0, y, zc + bh * 0.85), (0, y + 0.04, zc + bh * 0.85 + rnd.uniform(0.12, 0.22) * k), 0.045 * k, horn, 4)
    return {'h': zc + bh + 0.25 * k, 'head': (0, hy, hz + hr * 0.9, hr)}


def wing(C, rnd, k=1.0, boss=False, skin=None):
    M = C.M
    body, dark, belly, eye, horn = mats(C, rnd, skin, boss)
    bl = rnd.uniform(0.55, 0.75) * k
    zc = 0.55 * k
    blob(M, (0, 0, zc), (0.22 * k, bl * 0.6, 0.24 * k), body, 10, 6)
    blob(M, (0, -0.02, zc - 0.07 * k), (0.17 * k, bl * 0.45, 0.17 * k), belly, 8, 5)
    hy, hz = -bl * 0.6 - 0.1 * k, zc + 0.2 * k
    tube(M, (0, -bl * 0.4, zc + 0.1 * k), (0, hy + 0.05, hz), 0.13 * k, 0.09 * k, body, 1.0, 6)
    blob(M, (0, hy, hz), (0.13 * k, 0.15 * k, 0.13 * k), body, 8, 5)
    bk = rnd.uniform(0.12, 0.22) * k
    tube(M, (0, hy - 0.08 * k, hz - 0.02 * k), (0, hy - 0.08 * k - bk, hz - 0.05 * k), 0.07 * k, 0.0, horn, 1.0, 5)   # 부리
    eyes(M, eye, hy - 0.08 * k, hz + 0.04 * k, 0.07 * k, 0.025 * k + 0.008)
    span = rnd.uniform(0.7, 1.1) * k
    for s in (-1, 1):                                                       # 날개 — 팔 마디 + 깃 판 셋
        e = (s * span * 0.45, bl * 0.05, zc + 0.15 * k)
        tube(M, (s * 0.15 * k, 0, zc + 0.1 * k), e, 0.06 * k, 0.045 * k, body, 1.0, 5)
        for i, (ln, dy) in enumerate(((span * 0.62, 0.0), (span * 0.52, bl * 0.22), (span * 0.40, bl * 0.42))):
            blob(M, (s * (span * 0.45 + ln * 0.5), bl * 0.05 + dy, zc + 0.13 * k - i * 0.035 * k), (ln * 0.55, 0.09 * k + bl * 0.1, 0.022 * k), dark if i else body, 8, 4)
    for s in (-1, 1):                                                       # 다리 둘
        tube(M, (s * 0.1 * k, 0.05, zc - 0.15 * k), (s * 0.1 * k, 0.0, 0.03 * k), 0.05 * k, 0.03 * k, dark, 1.0, 5)
        for t in (-1, 0, 1):
            cone(M, (s * 0.1 * k, 0.0, 0.03 * k), (s * 0.1 * k + t * 0.04 * k, -0.12 * k, 0.0), 0.02 * k, horn, 4)
    tube(M, (0, bl * 0.55, zc), (0, bl * 0.55 + rnd.uniform(0.25, 0.45) * k, zc - 0.05 * k), 0.1 * k, 0.04 * k, dark, 1.0, 5)
    if rnd.random() < 0.6 or boss:
        cone(M, (0, hy + 0.02, hz + 0.12 * k), (0, hy + 0.12 * k, hz + 0.34 * k), 0.05 * k, horn, 5)    # 볏
    return {'h': zc + 0.6 * k, 'head': (0, hy, hz + 0.13 * k, 0.14 * k)}


def serp(C, rnd, k=1.0, boss=False, skin=None):
    M = C.M
    body, dark, belly, eye, horn = mats(C, rnd, skin, boss)
    n = rnd.randint(8, 11)
    amp = rnd.uniform(0.18, 0.3) * k
    seg = 0.2 * k
    pts = []
    for i in range(n):
        t = i / (n - 1)
        pts.append((math.sin(t * math.pi * rnd.uniform(1.6, 2.4)) * amp, i * seg, (0.10 + 0.05 * (1 - t)) * k))
    for i, p in enumerate(pts):
        r = (0.17 - 0.12 * (i / (n - 1))) * k
        blob(M, (p[0], p[1], p[2] + r * 0.6), (r, seg * 1.05, r * 0.9), body if i % 2 == 0 else dark, 8, 4)
        if i:
            q = pts[i - 1]
            tube(M, (q[0], q[1], q[2] + r * 0.6), (p[0], p[1], p[2] + r * 0.6), r * 0.85, r * 0.8, body, 1.0, 6)
    h0 = pts[0]
    hr = 0.19 * k
    blob(M, (h0[0], h0[1] - 0.2 * k, 0.22 * k + 0.0), (hr, hr * 1.3, hr * 0.8), body, 9, 5)                # 머리 + 위로 든 목
    blob(M, (h0[0], h0[1] - 0.05 * k, 0.16 * k), (hr * 0.8, 0.2 * k, 0.15 * k), body, 8, 4)
    eyes(M, eye, h0[1] - 0.3 * k, 0.28 * k, hr * 0.55, 0.03 * k + 0.01)
    for s in (-1, 1):
        tube(M, (h0[0] + s * hr * 0.4, h0[1] - 0.12 * k, 0.28 * k), (h0[0] + s * hr * 0.9, h0[1] + 0.05 * k, 0.5 * k), hr * 0.16, 0.0, horn, 1.0, 5)
        cone(M, (h0[0] + s * hr * 0.2, h0[1] - 0.46 * k, 0.17 * k), (h0[0] + s * hr * 0.2, h0[1] - 0.55 * k, 0.12 * k), 0.02 * k, eye, 4)    # 송곳니
    if rnd.random() < 0.7 or boss:
        for i in range(1, n - 1, 2):                                        # 등지느러미 가시
            p = pts[i]
            cone(M, (p[0], p[1], p[2] + 0.2 * k), (p[0], p[1] + 0.03, p[2] + 0.2 * k + rnd.uniform(0.1, 0.2) * k), 0.04 * k, horn, 4)
    return {'h': 0.55 * k, 'head': (h0[0], h0[1] - 0.2 * k, 0.22 * k + hr * 0.8, hr)}


def cons(C, rnd, k=1.0, boss=False, skin=None):
    M = C.M
    metal = C.s('corrugated_iron', 1.2, rnd.choice(['#6a727d', '#7b6a58', '#4f5f6a', '#6b5470']))
    dark = C.s('bitumen', 1.0, '#26282e')
    core = C.s('white_stucco', 1.0, rnd.choice(EYES), gain=2.1)
    trim = C.s('corrugated_iron', 1.0, rnd.choice(['#b08a4a', '#8f9aa5', '#a35a3a']))
    bw, bd, bh = rnd.uniform(0.5, 0.7) * k, rnd.uniform(0.4, 0.55) * k, rnd.uniform(0.55, 0.8) * k
    zl = rnd.uniform(0.3, 0.45) * k
    obox(M, (0, 0, zl), (bw, bd, bh), 0, metal, 0.8)                           # 몸통 상자
    obox(M, (0, 0, zl + bh * 0.1), (bw + 0.06 * k, bd * 0.4, bh * 0.2), 0, trim, 0.6)
    obox(M, (0, -bd / 2 - 0.01, zl + bh * 0.55), (bw * 0.45, 0.03 * k, bw * 0.45), 0, core, 0.5)   # 가슴 심장
    hz = zl + bh
    obox(M, (0, -0.02, hz), (bw * 0.6, bd * 0.6, 0.28 * k), 0, dark, 0.6)                 # 머리
    for s in (-1, 1):
        obox(M, (s * bw * 0.16, -bd * 0.3 - 0.01, hz + 0.13 * k), (0.07 * k, 0.03 * k, 0.045 * k), 0, core, 0.4)
    tube(M, (rnd.uniform(-0.1, 0.1) * k, 0, hz + 0.28 * k), (0.0, 0.0, hz + 0.28 * k + rnd.uniform(0.18, 0.4) * k), 0.025 * k, 0.012 * k, trim, 1.0, 5)   # 안테나
    for s in (-1, 1):                                                       # 팔(어깨 구 + 팔뚝)
        blob(M, (s * (bw / 2 + 0.07 * k), 0, hz - 0.12 * k), (0.1 * k, 0.1 * k, 0.1 * k), trim, 7, 4)
        tube(M, (s * (bw / 2 + 0.08 * k), 0, hz - 0.12 * k), (s * (bw / 2 + 0.12 * k), -0.25 * k, hz - 0.45 * k), 0.07 * k, 0.09 * k, metal, 1.0, 6)
        for t in (-1, 1):
            cone(M, (s * (bw / 2 + 0.12 * k), -0.25 * k, hz - 0.45 * k), (s * (bw / 2 + 0.12 * k) + t * 0.05 * k, -0.4 * k, hz - 0.5 * k), 0.035 * k, dark, 4)
    for s in (-1, 1):                                                       # 다리
        tube(M, (s * bw * 0.28, 0, zl + 0.02), (s * bw * 0.3, 0, 0.06 * k), 0.09 * k, 0.07 * k, dark, 1.0, 6)
        obox(M, (s * bw * 0.3, -0.06 * k, 0), (0.17 * k, 0.28 * k, 0.07 * k), 0, metal, 0.5)
    if rnd.random() < 0.6 or boss:
        tube(M, (0, bd / 2, zl + bh * 0.6), (0, bd / 2 + 0.15 * k, zl + bh * 1.0), 0.06 * k, 0.04 * k, dark, 1.0, 6)           # 등 배기관
    return {'h': hz + 0.4 * k, 'head': (0, -0.02, hz + 0.28 * k, 0.2 * k)}


def spir(C, rnd, k=1.0, boss=False, skin=None):
    M = C.M
    sk = skin or rnd.choice([('snow_02', 1.0, '#9fd8ff'), ('white_stucco', 1.0, '#c9a6ff'), ('white_stucco', 1.0, '#9ff2c0'), ('white_stucco', 1.0, '#ffb46a')])
    body = C.s(sk[0], sk[1], sk[2], gain=1.35)
    inner = C.s('white_stucco', 1.0, _shade(sk[2], 1.0), gain=2.0)
    dark = C.s('bitumen', 1.0, '#2a2f45')
    eye = C.s('white_stucco', 1.0, rnd.choice(EYES), gain=2.0)
    zc = rnd.uniform(0.55, 0.8) * k
    r = rnd.uniform(0.26, 0.36) * k
    blob(M, (0, 0, zc), (r, r * 0.9, r * 1.15), body, 10, 7)               # 떠 있는 몸
    blob(M, (0, 0, zc + r * 0.2), (r * 0.55, r * 0.5, r * 0.6), inner, 8, 5)  # 안쪽 빛
    for s in (-1, 1):
        blob(M, (s * r * 0.4, -r * 0.8, zc + r * 0.3), (r * 0.18, r * 0.1, r * 0.22), eye, 6, 4)
    n = rnd.randint(3, 5)
    for i in range(n):                                                      # 꼬리 불꽃/자락
        a = math.pi + (i - (n - 1) / 2) * 0.45
        tube(M, (math.sin(a) * r * 0.4, math.cos(a) * -r * 0.3 + r * 0.4, zc - r * 0.5), (math.sin(a) * r * 1.0, r * 0.9 + rnd.uniform(0.1, 0.3) * k, zc - r * 1.4 - rnd.uniform(0.0, 0.3) * k),
             r * 0.35, 0.0, body, 1.0, 6)
    for i in range(rnd.randint(2, 4)):                                     # 맴도는 조각
        a = rnd.uniform(0, 6.28)
        cone(M, (math.cos(a) * r * 1.5, math.sin(a) * r * 1.5, zc + rnd.uniform(-0.2, 0.3) * k), (math.cos(a) * r * 1.5, math.sin(a) * r * 1.5, zc + rnd.uniform(0.15, 0.4) * k + 0.1), 0.05 * k, dark, 4)
    if rnd.random() < 0.6 or boss:
        for s in (-1, 1):
            tube(M, (s * r * 0.45, 0, zc + r * 0.9), (s * r * 0.8, -0.05, zc + r * 1.7), r * 0.14, 0.0, inner, 1.0, 5)         # 불꽃 뿔
    return {'h': zc + r * 1.8, 'head': (0, 0, zc + r * 1.15, r * 0.7)}


FAMILIES = {'quad': quad, 'wing': wing, 'serp': serp, 'cons': cons, 'spir': spir}
VARIANTS = 4
# 보스 12 — (계통, 배율, 장식)
BOSSES = [('quad', 3.0, 'plates'), ('quad', 3.2, 'crown'), ('quad', 2.8, 'runes'), ('wing', 3.2, 'crown'), ('wing', 3.0, 'plates'),
          ('serp', 3.4, 'crown'), ('serp', 3.0, 'runes'), ('cons', 3.0, 'plates'), ('cons', 3.2, 'runes'), ('spir', 3.0, 'crown'), ('spir', 3.3, 'runes'), ('quad', 3.4, 'plates')]
BOSS_SKINS = [('cliff_side', 1.5, '#6a5a64'), ('aerial_rocks_02', 1.5, '#4f5a6e'), ('brown_mud', 1.2, '#6e4a44'), ('grey_plaster', 1.2, '#4f6480')]


def decorate(C, rnd, fam, k, kind, h, info):
    M = C.M
    horn = C.s('coast_sand_rocks_02', 1.0, '#2e2a33')
    glow = C.s('white_stucco', 1.0, rnd.choice(['#ff4a2a', '#ff9a2a', '#b86aff', '#4adfff']), gain=2.1)
    plate = C.s('corrugated_iron', 1.2, '#4a4650')
    if kind == 'crown':
        hx, hy, hz, hr = info['head']
        n = 7
        for i in range(n):
            a = 2 * math.pi * i / n
            r = hr * 0.85
            cone(M, (hx + math.cos(a) * r, hy + math.sin(a) * r, hz - hr * 0.2), (hx + math.cos(a) * r * 1.15, hy + math.sin(a) * r * 1.15, hz + hr * rnd.uniform(0.9, 1.6)), hr * 0.2, horn, 5)
    elif kind == 'plates':
        for i in range(4):
            y = -0.2 * k + i * 0.22 * k
            obox(M, (0, y, h * 0.72 + 0.02 * k), (0.34 * k, 0.16 * k, 0.07 * k), 0, plate, 0.6)
            cone(M, (0, y, h * 0.72 + 0.08 * k), (0, y + 0.02, h * 0.72 + 0.25 * k), 0.05 * k, horn, 4)
    else:                                                                   # runes — 발광 띠 셋
        for i in range(3):
            obox(M, (0, 0.05 * k + i * 0.25 * k, h * 0.55), (0.5 * k, 0.04 * k, 0.025 * k), 0, glow, 0.5)


def build_one(pid):
    kind, rest = pid.split('_', 1)
    rnd = random.Random(sum(ord(c) * (i + 3) for i, c in enumerate(pid)))
    C = BP.Ctx(pid)
    if kind == 'mon':
        fam, nn = rest.split('_')
        FAMILIES[fam](C, rnd, 1.0, False)
    else:
        fam, k, deco = BOSSES[int(rest) - 1]
        info = FAMILIES[fam](C, rnd, k, True, BOSS_SKINS[(int(rest) - 1) % len(BOSS_SKINS)])
        decorate(C, rnd, fam, k, deco, info['h'], info)
    return C


IDS = [f'mon_{f}_{i:02d}' for f in FAMILIES for i in range(1, VARIANTS + 1)] + [f'boss_{i:02d}' for i in range(1, len(BOSSES) + 1)]


def build(pid, out, style):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    W._mat_cache.clear()
    W.set_style(style)
    C = build_one(pid)
    ob = C.M.build()
    for p in ob.data.polygons:
        p.use_smooth = False
    tris = sum(len(p.vertices) - 2 for p in ob.data.polygons)
    pts = [Vector(c) for c in ob.bound_box]
    lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
    hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    size = [round(hi[i] - lo[i], 2) for i in range(3)]
    bpy.context.view_layer.objects.active = ob
    os.makedirs(os.path.dirname(os.path.abspath(out)), exist_ok=True)
    W.export_glb([ob], out, int(os.environ.get('WF_TOON_PX', '256')) if style == 'toon' else 1024, 'JPEG' if style == 'toon' else 'AUTO')
    lic = {'id': pid, 'generator': BP.GENERATOR, 'blender': bpy.app.version_string, 'style': style,
           'license': 'CC0-1.0 (재질 사진 전부 Poly Haven CC0, 형태는 전부 코드)', 'inputs': sorted(f'polyhaven: {m}' for m in C.mats),
           'size_m': size, 'tris': tris, 'family': pid.split('_')[1] if pid.startswith('mon') else BOSSES[int(pid.split('_')[1]) - 1][0]}
    json.dump(lic, open(os.path.splitext(out)[0] + '.license.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    kb = os.path.getsize(out) // 1024
    print('WORLDFORGE', json.dumps({'id': pid, 'tris': tris, 'size_m': size, 'kb': kb, 'ok': tris <= BP.TRIS_MAX and (style != 'toon' or kb <= 512)}))


if __name__ == '__main__':
    style = arg('--style', 'real')
    if '--list' in A:
        print('IDS', ' '.join(IDS))
    elif '--all' in A:
        d = arg('--out-dir')
        for pid in IDS:
            build(pid, os.path.join(d, pid + '.glb'), style)
    else:
        build(arg('--id'), arg('--out'), style)
