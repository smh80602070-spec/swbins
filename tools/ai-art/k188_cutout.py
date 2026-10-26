"""K-0188 바닐라웨어식 컷아웃 — 손그림 일러스트 한 장을 뼈 16 부위로 잘라 `cutout2d.js` 규격(rig.json + 부위 webp)으로.

  py tools/ai-art/k188_cutout.py grid <그림.png|webp> <out.jpg>                 # 관절 찍기용 격자판(64px 굵은 줄·숫자)
  py tools/ai-art/k188_cutout.py auto <옆모습 그림> <joints.json> <확인판.jpg>     # 관절 자동 추정(실루엣 비율) + 점 덧그린 확인판 — 틀린 점만 손으로
  py tools/ai-art/k188_cutout.py cut <그림> <joints.json> <rig 폴더> [--far copy|own] [--fill none|smear|sd]
                                                                               # 부위 자르기 → <rig>/rig.json·<부위>.webp·rig.license.json
  py tools/ai-art/k188_cutout.py preview <rig 폴더> <out 줄기> [--h 520]          # 엔진과 같은 뼈 계산으로 walk·attack·idle 프레임 → <줄기>.png(띠)·<줄기>.gif

joints.json(그림 픽셀, 오른쪽을 본 그림 기준 — 왼쪽을 보면 "flip": true):
  { "top": [x,y](머리 끝) · "neck" · "pelvis"(허리 가운데) · "foot": y(발바닥)
    "N": { "sh","el","wr","tip","hip","kn","an","toe" }   바깥(화면 앞) 팔·다리 — 뼈 R
    "F": { … 같은 꼴 }                                    안쪽(몸 뒤) 팔·다리 — 뼈 L. 없으면 --far copy(N 을 어둡게 복사)
    "w": { "chest": 반폭px, "arm": …, "leg": …, "head": … }   (선택) 부위 두께 — 픽셀 배정 점수 dist − w
  }
배정: 불투명 픽셀마다 뼈 선분까지 거리 − 두께 가 가장 작은 부위(앞 팔·다리가 몸통보다 먼저 이긴다 — 두께 덤 1.15).
관절 덧살: 아이 부위는 제 관절 둘레 원(두께×0.9)을 부모 그림에서도 가져와 돌 때 틈이 안 보이게.
--fill: 앞 팔·다리에 가려 비는 몸통 자리(돌리면 드러남) — none 그대로 · smear 둘레 색 번짐 · sd 로컬 ComfyUI 인페인트(gen.py 그래프, 그림체 C).
그림은 상업 허용 모델 산출(K-0163 계열 일러스트)만 — license 는 원본 .license.json 을 따라 적는다.
"""
import json
import math
import os
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
SPEC = os.path.join(HERE, '_out', 'k188', 'clips.json')   # node 로 cutout2d.js 에서 뽑은 BONES·PARENT·REST·CLIPS(엔진과 같은 수)


def load_rgba(p):
    im = Image.open(p)
    if im.mode != 'RGBA':
        sys.path.insert(0, HERE)
        from k163_illust import cutout   # 바탕 있는 그림이면 K-0163 matte(u2net+matte2)
        im = cutout(im.convert('RGB'))
    return im


# ---------------------------------------------------------------- 격자판
def grid(src, out):
    im = load_rgba(src)
    bg = Image.new('RGBA', im.size, (235, 235, 235, 255)); bg.alpha_composite(im)
    d = ImageDraw.Draw(bg)
    for v in range(0, max(im.size), 32):
        c = (255, 0, 0, 255) if v % 128 == 0 else ((255, 150, 150, 255) if v % 64 == 0 else (255, 215, 215, 255))
        d.line((v, 0, v, im.height), fill=c); d.line((0, v, im.width, v), fill=(0, 0, 255, 255) if v % 128 == 0 else ((150, 150, 255, 255) if v % 64 == 0 else (215, 215, 255, 255)))
    for v in range(0, max(im.size), 64):
        d.text((v + 2, 2), str(v), fill=(200, 0, 0, 255)); d.text((2, v + 2), str(v), fill=(0, 0, 200, 255))
    bg.convert('RGB').save(out, quality=88); print(out, im.size)


# ---------------------------------------------------------------- 관절 자동 추정(옆모습)
# 비율 = sg_zhugeliang 옆모습에 손으로 찍은 값(머리 끝 0 · 발바닥 1) — 사람 손은 덧그린 점 확인판을 보고 틀린 것만 고친다
BLEED = int(os.environ.get('K188_BLEED', '3'))   # K-0200 이음 겹침 px(0 = 옛 판)
FAR = 0.6   # 10-26 — 다리·발 캡슐 반지름의 이만큼 밖이면 옷자락(허리에 묶음) · 기본 끔(70명 시험에서 나빠짐 — joints "far_cloth": true 로만)
CAP = float(os.environ.get('K188_CAP', '1.6'))   # K-0201 1.35→1.6(무릎 틈) · K-0199 무릎·팔꿈치 덧살 배수(두께 기준, 옛 0.9 — 90° 넘게 굽으면 바깥이 벌어짐)
FRONT_CLIPS = {   # K-0198 앞·뒷모습 클립(키 [t, 각, dx, dy] — 엔진 CLIPS 와 같은 꼴, 뼈 단위 몸 100)
    'walk': {'len': 1.0, 'loop': True, 'keys': {
        'hip': [[0, 0, 0, 0], [0.25, 0, 0, -1.2], [0.5, 0, 0, 0], [0.75, 0, 0, -1.2], [1, 0, 0, 0]], 'chest': [[0, 0], [0.25, 1.5], [0.75, -1.5], [1, 0]],
        'legUL': [[0, 0, 0, 0], [0.25, 0, 0, -3.5], [0.5, 0, 0, 0], [1, 0, 0, 0]], 'legUR': [[0, 0, 0, 0], [0.5, 0, 0, 0], [0.75, 0, 0, -3.5], [1, 0, 0, 0]],
        'armUL': [[0, 4], [0.5, -4], [1, 4]], 'armUR': [[0, -4], [0.5, 4], [1, -4]]}},
    'run': {'len': 0.6, 'loop': True, 'keys': {
        'hip': [[0, 0, 0, -1], [0.25, 0, 0, -3], [0.5, 0, 0, -1], [0.75, 0, 0, -3], [1, 0, 0, -1]], 'chest': [[0, 0], [0.25, 2.5], [0.75, -2.5], [1, 0]],
        'legUL': [[0, 0, 0, 0], [0.25, 0, 0, -6], [0.5, 0, 0, 0], [1, 0, 0, 0]], 'legUR': [[0, 0, 0, 0], [0.5, 0, 0, 0], [0.75, 0, 0, -6], [1, 0, 0, 0]],
        'armUL': [[0, 10], [0.5, -10], [1, 10]], 'armUR': [[0, -10], [0.5, 10], [1, -10]]}},
    'attack': {'len': 0.5, 'loop': False, 'keys': {
        'chest': [[0, 0], [0.3, -4], [0.5, 5], [1, 0]], 'armUR': [[0, 0], [0.3, -110], [0.55, -20], [1, -5]], 'armLR': [[0, 0], [0.3, -30], [1, 0]],
        'hip': [[0, 0, 0, 0], [0.5, 0, 0, 1], [1, 0, 0, 0]]}},
    'hit': {'len': 0.35, 'loop': False, 'keys': {'chest': [[0, 0], [0.3, -6], [1, 0]], 'head': [[0, 0], [0.3, -8], [1, 0]], 'hip': [[0, 0, 0, 0], [0.3, 0, 0, -2], [1, 0, 0, 0]],
                                                     'armUL': [[0, 0], [0.3, 25], [1, 0]], 'armUR': [[0, 0], [0.3, -25], [1, 0]]}},
}
PROP = {'neck': 0.139, 'sh': 0.219, 'el': 0.384, 'wr': 0.342, 'pelvis': 0.432, 'hip': 0.467, 'kn': 0.68, 'an': 0.95}


def row_span(a, y):
    xs = np.nonzero(a[int(y)])[0]
    return (xs.min(), xs.max()) if len(xs) else (None, None)


def auto(src, out_json, out_jpg, skirt=True):
    im = load_rgba(src); a = np.asarray(im)[..., 3] > 40
    rows = np.nonzero(a.any(1))[0]; top, foot = int(rows.min()), int(rows.max())
    Hh = foot - top; Y = lambda f: top + f * Hh
    # 몸통 가운데 x = 목~허리 띠의 실루엣 가운데(부채·무기처럼 옆으로 뻗은 건 띠 중앙값으로 무시)
    mid = lambda f0, f1: float(np.median([sum(row_span(a, y)) / 2 for y in range(int(Y(f0)), int(Y(f1)), 4) if row_span(a, y)[0] is not None]))
    cx_t, cx_l = mid(0.15, 0.42), mid(0.75, 0.93)
    head_x = mid(0.03, 0.12)
    j = {'top': [round(head_x), top], 'neck': [round(cx_t), round(Y(PROP['neck']))], 'pelvis': [round(cx_t), round(Y(PROP['pelvis']))], 'foot': foot,
         'N': {'sh': [round(cx_t - Hh * 0.03), round(Y(PROP['sh']))], 'el': [round(cx_t + Hh * 0.02), round(Y(PROP['el']))],
               'wr': [round(cx_t + Hh * 0.09), round(Y(PROP['wr']))], 'tip': [round(cx_t + Hh * 0.14), round(Y(PROP['wr']) - Hh * 0.015)],
               'hip': [round(cx_t + Hh * 0.01), round(Y(PROP['hip']))], 'kn': [round((cx_t + cx_l) / 2 + Hh * 0.02), round(Y(PROP['kn']))],
               'an': [round(cx_l - Hh * 0.02), round(Y(PROP['an']))], 'toe': [round(cx_l + Hh * 0.08), foot - 5]},
         'w': {'chest': round(Hh * 0.091), 'arm': round(Hh * 0.043), 'leg': round(Hh * 0.031), 'head': round(Hh * 0.05), 'hip': round(Hh * 0.105)}}
    if skirt:
        # 옷자락 끝 = 아래에서 위로 올라가며 실루엣 폭이 처음 다리 폭(머리 키 0.6배)을 넘는 줄
        lw = Hh * 0.075
        for y in range(foot - 5, int(Y(0.6)), -2):
            l, r = row_span(a, y)
            if l is not None and r - l > lw * 2.2:
                l2, r2 = row_span(a, int(y - Hh * 0.06))   # 10-26 — 앞꿈치·장화 발등 폭을 옷자락으로 잡던 것(바지 9명 다리가 허리에 박힘): 정강이 높이도 넓어야 옷자락
                if l2 is not None and r2 - l2 > lw * 2.2:
                    j['skirt'] = y; break
    json.dump(j, open(out_json, 'w'), indent=0)
    bg = Image.new('RGBA', im.size, (235, 235, 235, 255)); bg.alpha_composite(im); d = ImageDraw.Draw(bg)
    pts = [('top', j['top']), ('neck', j['neck']), ('pelvis', j['pelvis'])] + [(k, v) for k, v in j['N'].items()]
    for k, (x, y) in pts:
        d.ellipse((x - 7, y - 7, x + 7, y + 7), fill=(255, 0, 0, 255)); d.text((x + 9, y - 6), k, fill=(200, 0, 0, 255))
    for a_, b_ in (('sh', 'el'), ('el', 'wr'), ('wr', 'tip'), ('hip', 'kn'), ('kn', 'an'), ('an', 'toe')):
        d.line((*j['N'][a_], *j['N'][b_]), fill=(255, 0, 0, 255), width=3)
    if j.get('skirt'):
        d.line((0, j['skirt'], im.width, j['skirt']), fill=(0, 160, 0, 255), width=2)
    for v in range(0, max(im.size), 64):
        d.line((v, 0, v, im.height), fill=(255, 190, 190, 255)); d.line((0, v, im.width, v), fill=(190, 190, 255, 255))
        d.text((v + 2, 2), str(v), fill=(200, 0, 0, 255)); d.text((2, v + 2), str(v), fill=(0, 0, 200, 255))
    bg.convert('RGB').save(out_jpg, quality=86); print(out_json)


# ---------------------------------------------------------------- 자르기
def seg_dist(px, py, a, b):
    ax, ay = a; bx, by = b
    vx, vy = bx - ax, by - ay; L = vx * vx + vy * vy or 1e-6
    t = np.clip(((px - ax) * vx + (py - ay) * vy) / L, 0, 1)
    return np.hypot(px - (ax + t * vx), py - (ay + t * vy))


def bones_of(j):
    """부위 → (선분 a, b, 두께, 관절(pivot), 부모 부위)"""
    N, F, w = j['N'], j.get('F'), j.get('w', {})
    top, neck, pel = j['top'], j['neck'], j['pelvis']
    hipmid = [(N['hip'][0] + (F or N)['hip'][0]) / 2, (N['hip'][1] + (F or N)['hip'][1]) / 2]
    if j.get('skirt'):                                   # 긴 도포·치마 — 허리 부위를 옷자락 끝(y)까지 늘려 다리와 같이 갈라지지 않게
        hipmid = [pel[0], j['skirt']]
    head_r = w.get('head', abs(neck[1] - top[1]) * 0.42)
    B = {
        'head': (neck, top, head_r, neck, 'chest'),
        'chest': (pel, neck, w.get('chest', head_r * 1.15), pel, 'hip'),
        'hip': (pel, hipmid, w.get('hip', head_r * 1.2), pel, None),
    }
    sides = [('R', N)] + ([('L', F)] if F else [])
    for s, L in sides:
        aw, lw = w.get('arm', head_r * 0.5), w.get('leg', head_r * 0.6)
        B['armU' + s] = (L['sh'], L['el'], aw, L['sh'], 'chest')
        B['armL' + s] = (L['el'], L['wr'], aw * 0.9, L['el'], 'armU' + s)
        B['hand' + s] = (L['wr'], L['tip'], aw * 0.8, L['wr'], 'armL' + s)
        B['legU' + s] = (L['hip'], L['kn'], lw, L['hip'], 'hip')
        B['legL' + s] = (L['kn'], L['an'], lw * 0.85, L['kn'], 'legU' + s)
        B['foot' + s] = (L['an'], L['toe'], lw * 0.7, L['an'], 'legL' + s)
    if j.get('weapon'):                                  # {"a":[x,y],"b":[x,y],"side":"L|R","w":두께} — 손 뼈에 붙는 따로 그림
        wp = j['weapon']; hs = 'hand' + wp.get('side', 'R')
        B['weapon'] = (wp['a'], wp['b'], wp.get('w', head_r * 0.4), B[hs][3], hs)
    return B


Z = {'armUL': 1, 'armLL': 2, 'handL': 3, 'legUL': 4, 'legLL': 4, 'footL': 5, 'hip': 8, 'legUR': 9, 'legLR': 9, 'footR': 10,
     'chest': 12, 'hair': 13, 'head': 14, 'armUR': 15, 'armLR': 16, 'handR': 17, 'weapon': 18}
FRONT = {'armUR', 'armLR', 'handR', 'legUR', 'legLR', 'footR'}   # 앞(화면 쪽) — 몸통보다 먼저 이긴다


def smear_fill(rgb, hole, keep, it=400, smooth=60):
    """구멍(hole) 을 둘레 keep 픽셀 색으로 번져 채우기 — 가벼운 인페인트 대역.
    K-0201: 옛 판은 40px 만 번져 큰 구멍에 원래 팔 색·줄무늬가 남았다 → 끝까지 번지고(it) 구멍 안만 확산으로 매끈하게(smooth)."""
    from scipy import ndimage as _nd
    a = rgb.astype(np.float32); have = keep.copy()
    for _ in range(it):
        if not (hole & ~have).any():
            break
        acc = np.zeros_like(a); n = np.zeros(have.shape, np.float32)
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (-1, -1), (1, -1), (-1, 1)):
            sh = np.roll(np.roll(have, dy, 0), dx, 1); sa = np.roll(np.roll(a, dy, 0), dx, 1)
            acc += sa * sh[..., None]; n += sh
        grow = hole & ~have & (n > 0)
        a[grow] = acc[grow] / n[grow][:, None]; have = have | grow
    ys_, xs_ = np.nonzero(hole)
    if len(ys_) and smooth:
        y0, y1, x0, x1 = max(0, ys_.min() - 4), ys_.max() + 5, max(0, xs_.min() - 4), xs_.max() + 5
        sub, hm = a[y0:y1, x0:x1], hole[y0:y1, x0:x1]
        for _ in range(smooth):
            b = _nd.uniform_filter(sub, size=(5, 5, 1))
            sub[hm] = b[hm]
        a[y0:y1, x0:x1] = sub
    return np.clip(a, 0, 255).astype(np.uint8)


def cut(src, jp, outdir, far='copy', fill='smear'):
    os.makedirs(outdir, exist_ok=True)
    j = json.load(open(jp, encoding='utf-8'))
    far, fill = j.get('far', far), j.get('fill', fill)   # K-0200 — 사람마다 고른 길(먼 팔 copyall·몸통 smear)을 관절 파일에 적어 둔다
    im = load_rgba(src)
    if j.get('flip'):
        im = im.transpose(Image.FLIP_LEFT_RIGHT)
    A = np.asarray(im).copy(); H, W = A.shape[:2]
    for poly in j.get('drop_poly', []):                   # 바닥 그림자·떠 있는 장식처럼 몸에 안 붙일 영역 — 지운다
        dm = Image.new('L', (W, H), 0); ImageDraw.Draw(dm).polygon([tuple(q) for q in poly], fill=255)
        dm = np.asarray(dm) > 0
        keep = (A[..., 3] > 24) & ~dm
        A[..., 3] = np.where(dm & (A[..., 3] > 0) & ~(keep), 0, A[..., 3])
    alpha = A[..., 3] > 24
    ys, xs = np.mgrid[0:H, 0:W]
    B = bones_of(j)
    if j.get('hair_poly') and j.get('hair_root'):         # K-0200 — 머리카락·깃털·갓끈 덧뼈(엔진 hair 뼈, 부모 head) — 윤곽 안만, 뿌리 = 도는 자리
        hr = j['hair_root']; B['hair'] = (hr, hr, float(j.get('hair_cap', 16)), hr, 'head')   # 반지름 = 뿌리 둘레 덧살(모자·머리 조각을 조금 가져가 숙여도 안 떨어지게)
    names = list(B)
    score = np.full((len(names), H, W), 1e9, np.float32)
    w_leg = j.get('w', {}).get('leg', 33)
    for k, n in enumerate(names):
        a, b, r, _, _ = B[n]
        d = seg_dist(xs, ys, a, b) - r * (1.15 if n in FRONT else 1.0)
        if j.get('skirt_cut') and j.get('skirt') and n in ('hip', 'chest'):   # 무릎 아래 단 — 둥근 끝이 단 아래 정강이를 먹지 않게 단에서 자름
            d = np.where(ys > j['skirt'] + 6, 1e9, d)
        if n == 'hair':
            d = np.full_like(d, 1e9)                   # 거리로는 아무것도 안 가져감(윤곽으로만)
        if n == 'hip' and not j.get('skirt') and j.get('hip_cap', True):   # K-0201 — 바지 인물: 허리가 고관절 아래 허벅지를 가져가면 이음선이 축에서 멀어 다리가 돌 때 크게 벌어졌다(허벅지 중간 틈)
            hy = max(j['N']['hip'][1], (j.get('F') or j['N'])['hip'][1]) + w_leg * 0.4
            d = np.where(ys > hy, 1e9, d)
        score[k] = d
    lab = np.argmin(score, 0)
    for k, n in enumerate(names):                      # 10-26 K-0199 떨어짐 검사 — 몸통·팔·손에 간 목 위 픽셀(갓 챙·깃털)은 머리에(머리가 숙이면 남아 떠 있었다)
        if (n == 'chest' or n[:3] in ('arm', 'han')) and 'head' in names and j.get('head_above_neck', True):
            lab = np.where((lab == k) & (ys < j['neck'][1]), names.index('head'), lab)
        elif j.get('far_cloth', False) and n[:3] in ('leg', 'foo'):   # 다리·발 캡슐 밖 망토 자락 → 허리(기본 끔 — joints "far_cloth": true)
            lab = np.where((lab == k) & (score[k] > B[n][2] * FAR), names.index('hip'), lab)
    for s_, L_ in (('R', j['N']), ('L', j.get('F') or {})):
        if L_.get('poly'):                                 # 팔 윤곽(옆모습 소매는 몸통 위에 겹쳐 거리로는 못 가른다) — 안쪽은 그 팔 부위로만
            pm = Image.new('L', (W, H), 0); ImageDraw.Draw(pm).polygon([tuple(q) for q in L_['poly']], fill=255)
            pm = np.asarray(pm) > 0
            arm_ids = [names.index(x + s_) for x in ('armU', 'armL', 'hand') if x + s_ in names]
            sub = np.argmin(score[arm_ids], 0); best = np.min(score[arm_ids], 0)
            near = best < j.get('w', {}).get('arm', 40) * L_.get('reach', 0.6)   # 윤곽 안이라도 팔 선분 가까이만 — 손 둘레 갑옷·치마는 몸에 남김
            lab = np.where(pm & near, np.array(arm_ids)[sub], np.where(pm & ~near & np.isin(lab, arm_ids), names.index('chest'), lab))
            if j.get('arm_poly_only', True):            # K-0200 — 윤곽 밖인데 거리로 팔·손에 간 픽셀(주먹 앞 바지 등)은 팔 아닌 다음 가까운 부위로(칼날 조각 막기)
                out_ = ~pm & np.isin(lab, arm_ids)
                if out_.any():
                    sc2 = score.copy(); sc2[arm_ids] = 1e9
                    if 'weapon' in names:
                        sc2[names.index('weapon')] = 1e9
                    lab = np.where(out_, np.argmin(sc2, 0), lab)
    for key, bone in (('chest_poly', 'chest'), ('hip_poly', 'hip')) + ((('hair_poly', 'hair'),) if 'hair' in B else ()):   # 망토·앞자락처럼 몸통·허리에 묶을 영역(팔·다리 거리로 가면 떠다닌다)
        for poly in j.get(key, []):
            pm = Image.new('L', (W, H), 0); ImageDraw.Draw(pm).polygon([tuple(q) for q in poly], fill=255)
            lab = np.where(np.asarray(pm) > 0, names.index(bone), lab)
    if 'weapon' in B:                                      # 무기 선은 몸 위를 가로질러도 무기로(창이 다리·몸통 조각으로 갈라지지 않게)
        a_, b_, r_, _, _ = B['weapon']
        lab = np.where(seg_dist(xs, ys, a_, b_) < r_, names.index('weapon'), lab)
    lab[~alpha] = -1
    foot_y = j.get('foot', int(np.nonzero(alpha.any(1))[0].max()))
    top_y = j['top'][1]
    S = 100.0 / (foot_y - top_y)                       # 픽셀 → 뼈 단위(몸 높이 100)
    to_u = lambda p: ((p[0] - j['pelvis'][0]) * S, (p[1] - foot_y) * S)   # 발 = 0, 가로 0 = 골반

    rgb = A[..., :3]
    UNDER = [None]
    parts, bones = [], {}
    piv = {n: B[n][3] for n in names}
    for k, n in enumerate(names):
        m = lab == k
        _, _, r, pv, par = B[n]
        # 관절 덧살 — 제 관절 둘레 원(부모 쪽 그림)을 같이 가져간다
        cap = (np.hypot(xs - pv[0], ys - pv[1]) < r * (CAP if n[:4] in ('legL', 'armL') else 0.9)) & alpha   # K-0199 — 무릎·팔꿈치는 크게 굽어(모캡 동작) 덧살을 키운다
        if j.get('skirt') and n[:4] in ('legU', 'legL') and pv[1] < j['skirt']:
            cap = cap & False                              # 옷자락 속 관절 — 둘레 원을 가져가면 도포 조각이 떠다닌다
        kin = [k] + ([names.index(par)] if par in names else []) + [names.index(c_) for c_, v_ in B.items() if v_[4] == n and c_ != 'weapon']
        m2 = m | (cap & np.isin(lab, kin))                 # 덧살은 이웃 부위 픽셀만 — 손 둘레 갑옷·치마를 끌고 가지 않게
        if not m2.any():
            continue
        # 아이 관절 둘레도 가져간다(아이가 돌면 부모 끝이 납작하게 잘린 게 보이지 않게)
        for c_, (_, _, cr, cpv, cpar) in B.items():
            if cpar == n and c_ != 'weapon' and not (j.get('skirt') and cpv[1] < j['skirt']):
                m2 = m2 | ((np.hypot(xs - cpv[0], ys - cpv[1]) < cr * (CAP if c_[:4] in ('legL', 'armL') else 0.9)) & alpha & np.isin(lab, [k, names.index(c_)]))
        rgb = A[..., :3]                                   # 부위마다 원본에서 — 몸통 채움 색이 뒤 순서 팔·손 조각에 새지 않게(10-24 버그)
        if n in ('chest', 'hip') and fill != 'none':
            # 팔·다리에 가린 몸통·허리 자리(돌리면 드러남) — 제 캡슐 안인데 팔·다리가 가져간 곳을 둘레 색으로 채움
            a, b, rr, _, _ = B[n]
            limbs = [names.index(x) for x in names if x not in ('chest', 'hip', 'head')]
            under = (seg_dist(xs, ys, a, b) < rr) & alpha & np.isin(lab, limbs)
            if n == 'hip' and not j.get('skirt') and j.get('hip_cap', True):   # K-0201 — 고관절 선 아래 허벅지 자리는 안 채움(다리가 돌면 배경이 보여야 맞고, 채우면 줄무늬 덩어리가 드러났다)
                under = under & (ys <= max(j['N']['hip'][1], (j.get('F') or j['N'])['hip'][1]) + w_leg * 0.4)
            if under.any():
                if fill == 'sd' and j.get('fill_img'):     # 로컬 AI 인페인트 판(팔을 지운 몸통 — 같은 사람·같은 빛)에서 그 자리만
                    F_ = np.asarray(Image.open(os.path.join(ROOT, j['fill_img'])).convert('RGB').resize((W, H)))
                    rgb = rgb.copy(); rgb[under] = F_[under]
                else:
                    from scipy import ndimage as _nd2
                    ring = _nd2.binary_dilation(under, iterations=6) & m & ~under   # K-0201 — 구멍 둘레 6px(팔 윤곽선·주먹 살색)도 같이 채우고 색 재료에서는 뺌(흰·검은 얼룩)
                    hole_ = under | ring
                    rgb = rgb.copy(); rgb[hole_] = smear_fill(A[..., :3], hole_, m & ~hole_)[hole_]
                    rgb[hole_] = (rgb[hole_].astype(np.float32) * j.get('fill_shade', 0.75)).astype(np.uint8)   # 팔 뒤 몸통 = 그늘(밝은 회색 얼룩으로 튀지 않게)
                m2 = m2 | under
                UNDER[0] = under if UNDER[0] is None else (UNDER[0] | under)
        if BLEED > 0 and n != 'weapon':                 # K-0200 — 이음 겹침: 몸 안쪽으로 BLEED px 더 가져가 돌 때 흰 실금이 안 비치게(옛 1px)
            from scipy import ndimage as _nd
            m2 = m2 | (_nd.binary_dilation(m2, iterations=BLEED) & alpha)
        yy, xx = np.nonzero(m2)
        x0, x1, y0, y1 = xx.min(), xx.max() + 1, yy.min(), yy.max() + 1
        P = np.zeros((y1 - y0, x1 - x0, 4), np.uint8)
        soft = np.asarray(Image.fromarray(((m2 | ~alpha)[y0:y1, x0:x1] * 255).astype(np.uint8))   # K-0200 — 배경 쪽은 안으로 쳐서 바깥 윤곽은 안 흐리게(안쪽 이음만 부드럽게)
       .filter(ImageFilter.MaxFilter(3)).filter(ImageFilter.GaussianBlur(1.2))).astype(np.float32) / 255
        P[..., :3] = rgb[y0:y1, x0:x1]; near = np.asarray(Image.fromarray((m2[y0:y1, x0:x1] * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(5))) > 0   # K-0200 — 이웃 부위 윤곽 찌꺼기가 상자 안에서 새지 않게
        P[..., 3] = (A[y0:y1, x0:x1, 3] * np.minimum(1, soft * 1.25) * near).astype(np.uint8)   # 자른 안쪽 가장자리만 살짝 부드럽게
        pim = Image.fromarray(P).filter(ImageFilter.SMOOTH) if False else Image.fromarray(P)
        pim.save(os.path.join(outdir, n + '.webp'), 'WEBP', quality=90, method=6)
        if n == 'weapon':
            pv = B[B[n][4]][3]
        parts.append({'bone': B[n][4] if n == 'weapon' else n, 'img': n + '.webp', 'x': round((x0 - pv[0]) * S, 2), 'y': round((y0 - pv[1]) * S, 2),
                      'w': round((x1 - x0) * S, 2), 'h': round((y1 - y0) * S, 2), 'z': Z.get(n, 6)})
    # 뼈 쉬는 자리 — 부모 관절에서의 자리(뼈 단위)
    for n in names:
        if n == 'weapon':
            continue
        _, _, _, pv, par = B[n]
        if par is None:
            u = to_u(pv); bones[n] = {'x': round(u[0], 2), 'y': round(u[1], 2), 'rot': 0}
        else:
            bones[n] = {'x': round((pv[0] - piv[par][0]) * S, 2), 'y': round((pv[1] - piv[par][1]) * S, 2), 'rot': 0}
    # K-0201 쉼 보정 — 팩 동작은 「팔다리 곧게 아래·몸통 곧게 위·발 앞」 기준 각인데 그림은 숙이고 팔을 뒤로 늘어뜨린 채 그려져 있어,
    # 그대로 더하면 팔이 원본보다 훨씬 뒤로 돌고 몸이 기울어 「뒤로 걷는·팔 거꾸로·젖혀진」 꼴(사용자 10-26). 뼈마다 그려진 각(부모 기준)을 쉼 rot 에서 뺀다.
    #   손(hand)은 0 — 펴면 쥔 물건째 손목에서 벌어졌다(K-0201 16명) · joints "rest_fix": {뼈: 0~1} 로 덜 고칠 수 있다(부채 든 손처럼 그림 자세를 살릴 때) · "rest_fix": false 면 끔
    if j.get('rest_fix', True) is not False:
        CAN = {'hip': (0, 1), 'chest': (0, -1), 'head': (0, -1), 'foot': (1, 0)}
        def _cw(n):
            a, b = B[n][0], B[n][1]
            dx, dy = b[0] - a[0], b[1] - a[1]
            c = CAN.get(n, CAN.get(n[:4], (0, 1)))
            return math.degrees(math.atan2(c[0] * dy - c[1] * dx, c[0] * dx + c[1] * dy))   # 화면(y 아래)에서 시계 = +
        RW = dict({'hip': 1.0, 'chest': 1.0, 'head': 0.8, 'armU': 1.0, 'armL': 0.7, 'hand': 0.0, 'legU': 1.0, 'legL': 1.0, 'foot': 1.0}, **(j.get('rest_fix') if isinstance(j.get('rest_fix'), dict) else {}))
        drawn = {n: _cw(n) for n in names if n not in ('weapon', 'hair') and B[n][0] != B[n][1]}
        for n, th in drawn.items():
            par = B[n][4]
            rel = th - (drawn.get(par, 0.0) if par else 0.0)
            rel = (rel + 180) % 360 - 180
            w_ = RW.get(n, RW.get(n[:4], 1.0))
            if n in bones:
                bones[n]['rot'] = round(-rel * w_, 2)
    if 'armUL' not in B and far in ('copy', 'copyall'):   # K-0200 — copyall 이 조건에서 빠져 먼 다리까지 없어지던 것
        # 안쪽 팔·다리 = 바깥 것을 어둡게 복사(몸 뒤, z 낮게) — 옆모습에서 가려 안 보이는 쪽
        # 팔은 복사하지 않는다 — 인페인트 몸통이 몸에 붙은 팔을 새로 그려 그게 뒤팔 노릇을 한다(K-0188 ② 눈 판정 · 셋째 팔 막기)
        for s in (('armU', 'armL', 'hand', 'legU', 'legL', 'foot') if far == 'copyall' else ('legU', 'legL', 'foot')):
            src_p = next((p for p in parts if p['bone'] == s + 'R' and p['img'] == s + 'R.webp'), None)   # K-0201 — 같은 뼈의 무기 그림을 집으면 없는 파일을 열었다(jp_murasaki)
            if not src_p or not os.path.exists(os.path.join(outdir, s + 'R.webp')):
                continue
            q = Image.open(os.path.join(outdir, s + 'R.webp')).convert('RGBA'); qa = np.asarray(q).astype(np.float32)
            qa[..., :3] *= 0.72
            Image.fromarray(qa.astype(np.uint8)).save(os.path.join(outdir, s + 'L.webp'), 'WEBP', quality=90, method=6)
            parts.append(dict(src_p, bone=s + 'L', img=s + 'L.webp', z=Z[s + 'L']))
            bones[s + 'L'] = dict(bones[s + 'R'])
        # 다리는 앞뒤로 살짝 벌려 서게(같은 자리면 겹쳐 하나로 보인다)
    bones.setdefault('hair', {'x': 0, 'y': 0, 'rot': 0})
    if UNDER[0] is not None:                           # 인페인트 마스크(--fill sd 첫 판을 만들 재료)
        mk = Image.fromarray((UNDER[0] * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(9)).filter(ImageFilter.GaussianBlur(4))
        if j.get('flip'):
            mk = mk.transpose(Image.FLIP_LEFT_RIGHT)
        mk.save(os.path.join(outdir, '_under_mask.png'))
    clips = {}
    if j.get('skirt'):
        # 옷자락 인물 — 다리는 옷자락 밑에서만 보이니 엔진 기본 걷기·달리기의 다리 각을 줄인다(rig.clips 덮어쓰기)
        spec = json.load(open(SPEC, encoding='utf-8'))
        for cn in ('walk', 'run', 'attack', 'hit'):
            c = json.loads(json.dumps(spec['CLIPS'][cn]))
            for bn in ('legUL', 'legUR', 'legLL', 'legLR'):
                if bn in c['keys']:
                    c['keys'][bn] = [[k[0], k[1] * 0.35] + k[2:] for k in c['keys'][bn]]
            clips[cn] = c
    if j.get('view') in ('front', 'back'):
        # K-0198 — 앞·뒷모습: 엔진 기본 클립은 옆 기준(다리·팔 앞뒤 회전)이라 앞에서 보면 다리가 옆으로 벌어진다 → 다리는 번갈아 들기(dy),
        # 팔은 작게 흔들기, 골반 오르내림·몸통 좌우 흔들림. 뒤모습도 같은 클립(보는 쪽만 다르다)
        clips = json.loads(json.dumps(FRONT_CLIPS))
    if j.get('head_flip'):                             # K-0201 — 그림이 「몸은 오른쪽·고개는 뒤돌아 왼쪽」(rf_sunce) → 걸으면 뒤를 보며 걷는 꼴(사용자 10-26). 머리(와 머리카락)만 목 축으로 좌우 뒤집기
        for p in parts:
            if p['bone'] in ('head', 'hair') and p['img'] in ('head.webp', 'hair.webp'):
                f_ = os.path.join(outdir, p['img'])
                Image.open(f_).transpose(Image.FLIP_LEFT_RIGHT).save(f_, 'WEBP', quality=90, method=6)
                p['x'] = round(-(p['x'] + p['w']), 2)
        if 'hair' in bones:
            bones['hair']['x'] = round(-bones['hair'].get('x', 0), 2)
        if 'head' in bones:
            bones['head']['rot'] = round(-bones['head'].get('rot', 0), 2)   # 그려진 머리 기울기도 거울(몸통 기울기는 작아 무시)
    rig = {'h': 100, 'clips': clips, 'src': os.path.relpath(src, ROOT).replace('\\', '/'), 'bones': bones, 'parts': sorted(parts, key=lambda p: p['z']), 'sway': ({'hair': 0.6} if 'hair' in B else {})}   # K-0200 — hair 부위가 있으면 엔진 이동 관성도
    json.dump(rig, open(os.path.join(outdir, 'rig.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    lp = os.path.splitext(src)[0] + '.license.json'
    lic = json.load(open(lp, encoding='utf-8')) if os.path.exists(lp) else {}
    json.dump({'ticket': 'K-0188', 'from': rig['src'], 'model': lic.get('model'), 'model_license': lic.get('model_license'),
               'tool': 'tools/ai-art/k188_cutout.py cut', 'far': far, 'fill': fill}, open(os.path.join(outdir, 'rig.license.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print('cut', outdir, len(parts), 'parts · S', round(S, 4))


# ---------------------------------------------------------------- 보기(엔진과 같은 뼈 계산)
def mul(m, n):
    return [m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1], m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3], m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5]]


def tr(x, y, deg):
    a = math.radians(deg); c, s = math.cos(a), math.sin(a)
    return [c, s, -s, c, x, y]


def ease(u):
    return u * u * (3 - 2 * u)


def at(keys, ph):
    if not keys:
        return None
    if len(keys) == 1 or ph <= keys[0][0]:
        return keys[0]
    for i in range(1, len(keys)):
        if ph <= keys[i][0]:
            a, b = keys[i - 1], keys[i]; u = ease((ph - a[0]) / max(1e-6, b[0] - a[0]))
            g = lambda v, k: (v[k] if len(v) > k else 0)
            return [ph] + [g(a, k) + (g(b, k) - g(a, k)) * u for k in (1, 2, 3)]
    return keys[-1]


def pose(spec, rig, clip, ph):
    c = (rig.get('clips') or {}).get(clip) or spec['CLIPS'][clip]
    M = {}
    for b in spec['BONES']:
        r = rig['bones'].get(b) or spec['REST'][b]; k = at(c['keys'].get(b), ph)
        g = lambda k_, i: (k_[i] if k_ and len(k_) > i else 0)
        loc = tr(r.get('x', 0) + g(k, 2), r.get('y', 0) + g(k, 3), r.get('rot', 0) + g(k, 1))
        p = spec['PARENT'][b]
        M[b] = mul(M[p], loc) if p else loc
    return M


def render(rigdir, clip, ph, Hpx, W=None):
    spec = json.load(open(SPEC, encoding='utf-8'))
    rig = json.load(open(os.path.join(rigdir, 'rig.json'), encoding='utf-8'))
    k = Hpx / rig['h']; W = W or int(Hpx * 0.9)
    cv = Image.new('RGBA', (W, int(Hpx * 1.25)), (0, 0, 0, 0))
    ox, oy = W * 0.45, Hpx * 1.15
    M = pose(spec, rig, clip, ph)
    for p in sorted(rig['parts'], key=lambda q: q['z']):
        m = M.get(p['bone'])
        if not m:
            continue
        im = Image.open(os.path.join(rigdir, p['img'])).convert('RGBA')
        sx, sy = p['w'] / im.width, p['h'] / im.height
        # 그림 픽셀(u,v) → 화면: G·(p.x + u·sx, p.y + v·sy), G = 화면배율·m
        a, b, c, d, e, f = m
        A_ = [k * a * sx, k * b * sx, k * c * sy, k * d * sy, k * (a * p['x'] + c * p['y'] + e) + ox, k * (b * p['x'] + d * p['y'] + f) + oy]
        det = A_[0] * A_[3] - A_[2] * A_[1]
        inv = [A_[3] / det, -A_[1] / det, -A_[2] / det, A_[0] / det]
        ia, ib, ic, id_ = inv
        # PIL affine: 출력(x,y) → 입력 = (ia*(x-tx) + ic*(y-ty), ib*(x-tx) + id*(y-ty))
        tx, ty = A_[4], A_[5]
        coeff = (ia, ic, -(ia * tx + ic * ty), ib, id_, -(ib * tx + id_ * ty))
        layer = im.transform(cv.size, Image.AFFINE, coeff, resample=Image.BICUBIC)
        cv.alpha_composite(layer)
    return cv


def preview(rigdir, stem, H=520):
    frames, strip = [], []
    for clip, n in (('idle', 4), ('walk', 8), ('attack', 6), ('run', 6)):
        for i in range(n):
            ph = i / n if clip in ('walk', 'run', 'idle') else i / (n - 1)
            f = render(rigdir, clip, ph, H)
            bg = Image.new('RGBA', f.size, (214, 222, 210, 255)); bg.alpha_composite(f)
            ImageDraw.Draw(bg).text((6, 6), f'{clip} {ph:.2f}', fill=(0, 0, 0, 255))
            frames.append(bg.convert('RGB'))
            if clip in ('walk', 'attack') and i % 2 == 0:
                strip.append(bg.convert('RGB'))
    frames[0].save(stem + '.gif', save_all=True, append_images=frames[1:], duration=110, loop=0)
    sh = Image.new('RGB', (sum(f.width for f in strip), strip[0].height), 'white'); x = 0
    for f in strip:
        sh.paste(f, (x, 0)); x += f.width
    sh.save(stem + '.png'); print(stem + '.png', stem + '.gif')


if __name__ == '__main__':
    a = sys.argv[1:]
    opt = lambda k, d: a[a.index(k) + 1] if k in a else d
    if a[0] == 'grid':
        grid(a[1], a[2])
    elif a[0] == 'auto':
        auto(a[1], a[2], a[3])
    elif a[0] == 'cut':
        cut(a[1], a[2], a[3], far=opt('--far', 'copy'), fill=opt('--fill', 'smear'))
    elif a[0] == 'preview':
        preview(a[1], a[2], int(opt('--h', 520)))
    else:
        print(__doc__)
