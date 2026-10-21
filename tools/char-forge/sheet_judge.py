"""K-0158 시트 자동 판정 — 공장 규격(manifest.json) 풀 폴더마다 다섯 줄을 재서 PASS/FAIL.

  py tools/char-forge/sheet_judge.py [풀 폴더들의 상위 = tools/char-forge/_out/factory/styled] [--only id1,id2]
  → tools/char-forge/_out/factory/judge.json · 종료 코드 FAIL 있으면 1

다섯 줄(칸 = px × px, 알파 > 128 을 몸으로 본다):
 1 same    같은 사람 — 칸마다 몸 색 분포(RGB 4×4×4 히스토그램)가 그 풀 같은 방향 idle 첫 칸과 겹치는 정도 ≥ 0.40 (다른 몸·빈 칸·색 깨짐을 잡는다)
 2 foot    발 기준선 — 땅을 딛는 동작(idle·walk·attack·attack2·cast·talk·hit·sit)의 칸마다 몸 맨 아래 줄이 foot×px ±2px
           (run·death 는 뜨는 칸이 있어 바닥 아래로 +2 를 넘지 않는지만)
 3 flicker 깜빡임 — 같은 줄(방향)에서 한 칸만 튀었다 돌아오는 것(앞뒤 칸과 둘 다 다르고 앞뒤끼리는 비슷함):
           넓이 20%·중심 px×0.08·밝기 0.06 넘는 튐 없음(돌림 동작은 끝↔처음도 이웃) + 이웃 칸 사이 넓이 60%·중심 px×0.3·밝기 0.12 넘는 급변 없음
 4 crop    잘림 — 칸 가장자리 1px 띠에 알파 > 32 인 픽셀이 없음
 5 border  투명 테두리 — 칸 가장자리 2px 띠 알파 전부 0 · 몸 밖 반투명 찌꺼기(0 < 알파 < 40, 몸에서 3px 넘게 떨어짐) 없음 · 빈 칸 없음
 6 still   K-0159 판의 한 장 그림과 같은 사람 — idle 정면 첫 칸 ↔ web2d/moving/<풀>/front.webp 의 머리·윗몸·아랫몸 띠 색(still_match.py)
           가중 ≥ STILL_MIN 이고 띠 하나라도 STILL_BAND_MIN 밑이면 FAIL (머리색이 다르거나 옷 색이 다른 몸을 잡는다 — K-0158 hero_m)
"""
import json
import os
import sys

import numpy as np
from PIL import Image, ImageFilter

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import still_match  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '_out', 'factory')
STAND = ('idle', 'walk', 'attack', 'attack2', 'cast', 'talk', 'hit', 'sit')
SAME_MIN, FOOT_TOL = 0.40, 2     # K-0159: 0.45 → 0.40(같은 방향 idle 과 비교로 바꾸며 — 망토 뒷모습 인사 0.44, 다른 몸은 still 줄이 잡음)
SPIKE = (0.20, 0.08, 0.06)          # 넓이 비·중심 이동(÷px)·밝기 — 한 칸만 튀는 깜빡임
JUMP = (0.60, 0.30, 0.12)           # 이웃 칸 급변 상한
# K-0159: 동작별 넓이 상한 — 달리기(긴 두루마기 0.31)·걷기는 망토·옷자락이 펄럭여 옆모습 넓이가 칸마다 0.2~0.3 바뀐다(대조판 눈 판정 ○),
#         쓰러짐은 6칸에 서 있다 눕는 것이라 앞·뒤 모습에서 넓이가 한 번에 크게 줄어든다(눕는 칸은 줄어든 몸이 정상)
SPIKE_AREA = {'run': 0.35, 'walk': 0.30, 'attack': 0.30, 'attack2': 0.30}   # 휘두르는 칼날이 옆으로 섰다 누웠다
JUMP_MOVE = (0.60, 0.30, 0.18)    # 달리기·걷기·공격 이웃 칸 — 망토 안·겉이 번갈아 보여 밝기가 0.13~0.15 바뀜
JUMP_DEATH = (0.85, 0.30, 0.30)   # 쓰러짐 이웃 칸 상한(넓이·이동·밝기 — 흰 망토 뒷모습 → 누운 몸은 밝기도 한 번에 바뀜)


def flick(seq, px, loop, role=None):
    """seq = [(넓이, cx, cy, 밝기)…] → (최악 튐 비, [(f, 이유)…])"""
    n = len(seq)
    if n < 3:
        return 0.0, []
    am = max(1.0, sum(s[0] for s in seq) / n)

    def d(i, j):
        a, b = seq[i], seq[j]
        return (abs(a[0] - b[0]) / am, ((a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2) ** 0.5 / px, abs(a[3] - b[3]))
    worst, bad = 0.0, []
    for f in range(n):
        if f + 1 < n or loop:
            j = d(f, (f + 1) % n)
            jl = JUMP_DEATH if role == 'death' else (JUMP_MOVE if role in ('run', 'walk', 'attack', 'attack2') else JUMP)
            if any(j[k] > jl[k] for k in range(3)):
                bad.append((f, '급변 넓이 %.2f 이동 %.2f 밝기 %.2f' % j))
        if not loop and (f == 0 or f == n - 1):
            continue
        p, q, nb = d(f, (f - 1) % n), d(f, (f + 1) % n), d((f - 1) % n, (f + 1) % n)
        for k in range(3):
            s = min(p[k], q[k])
            lim = SPIKE_AREA.get(role, SPIKE[0]) if k == 0 else SPIKE[k]
            worst = max(worst, s / lim)
            if s > lim and nb[k] < 0.5 * s:
                bad.append((f, '튐 %s %.2f' % (('넓이', '이동', '밝기')[k], s)))
    return round(worst, 2), bad


def hist(cell):
    m = cell[..., 3] > 128
    if m.sum() < 20:
        return None
    q = (cell[..., :3][m] // 64).astype(np.int32)
    h = np.bincount(q[:, 0] * 16 + q[:, 1] * 4 + q[:, 2], minlength=64).astype(np.float64)
    return h / h.sum()


def judge_pool(pdir, still_game=None):
    man = json.load(open(os.path.join(pdir, 'manifest.json'), encoding='utf-8'))
    px, foot = man['px'], man['foot']
    fy = foot * px
    refs = {}
    chk = {k: {'ok': True, 'worst': None, 'bad': []} for k in ('same', 'foot', 'flicker', 'crop', 'border', 'still')}

    def bad(k, msg, val=None):
        chk[k]['ok'] = False
        if len(chk[k]['bad']) < 8:
            chk[k]['bad'].append(msg)

    cells = 0
    for role, c in man['clips'].items():
        im = np.asarray(Image.open(os.path.join(pdir, c['file'])).convert('RGBA'))
        nf = im.shape[1] // px
        if nf != c['frames'] or im.shape[0] // px != len(man['dirs']):
            bad('border', f'{role}: 시트 크기 {im.shape[1]}x{im.shape[0]} ≠ {c["frames"]}프레임×{len(man["dirs"])}방향')
        for r in range(im.shape[0] // px):
            seq = []
            for f in range(nf):
                cell = im[r * px:(r + 1) * px, f * px:(f + 1) * px]
                cells += 1
                a = cell[..., 3]
                tag = f'{role} d{man["dirs"][r]} f{f}'
                body = a > 128
                if body.sum() < 30:
                    bad('border', f'{tag}: 빈 칸')
                    continue
                if role == 'idle' and r not in refs:      # K-0159: 같은 방향 idle 첫 칸과(망토 뒷모습은 정면과 달라도 같은 사람)
                    refs[r] = hist(cell)
                ref = refs.get(r)
                if role == 'death' and refs:       # 누운 몸은 어느 방향 idle 과도 같은 사람이면 된다(뒤에서 본 눕기는 얼굴·다리가 보임)
                    ref = None
                # 1 같은 사람
                h = hist(cell)
                if (ref is not None or (role == 'death' and refs)) and h is not None:
                    s = float(np.minimum(h, ref).sum()) if ref is not None else max(float(np.minimum(h, x).sum()) for x in refs.values() if x is not None)
                    w = chk['same']['worst']
                    chk['same']['worst'] = s if w is None else min(w, s)
                    if s < SAME_MIN:
                        bad('same', f'{tag}: {s:.2f}')
                # 2 발
                ys = np.where(body.any(1))[0]
                low = int(ys.max()) + 1                      # 몸 맨 아래 줄 아래 경계(px)
                dv = low - fy
                if role in STAND:
                    chk['foot']['worst'] = max(chk['foot']['worst'] or 0, abs(dv))
                    if abs(dv) > FOOT_TOL:
                        bad('foot', f'{tag}: {dv:+.1f}px')
                elif dv > FOOT_TOL:
                    bad('foot', f'{tag}: 바닥 아래로 {dv:+.1f}px')
                # 3 깜빡임(줄 끝에서 판정)
                yy, xx = np.where(body)
                seq.append((float(body.sum()), float(xx.mean()), float(yy.mean()), float(cell[..., :3][body].mean()) / 255))
                # 4 잘림
                edge = np.concatenate([a[0], a[-1], a[:, 0], a[:, -1]])
                if (edge > 32).any():
                    bad('crop', f'{tag}: 가장자리 {int((edge > 32).sum())}px')
                # 5 투명 테두리·찌꺼기
                e2 = np.concatenate([a[:2].ravel(), a[-2:].ravel(), a[:, :2].ravel(), a[:, -2:].ravel()])
                if (e2 > 0).any():
                    bad('border', f'{tag}: 가장자리 2px 알파 {int((e2 > 0).sum())}px')
                near = np.asarray(Image.fromarray((a > 40).astype(np.uint8) * 255).filter(ImageFilter.MaxFilter(7))) > 0
                junk = int(((a > 0) & (a < 40) & ~near).sum())
                if junk > 3:
                    bad('border', f'{tag}: 떨어진 반투명 {junk}px')
            w, fb = flick(seq, px, bool(c.get('loop')), role)
            chk['flicker']['worst'] = max(chk['flicker']['worst'] or 0, w)
            for f, why in fb:
                bad('flicker', f'{role} d{man["dirs"][r]} f{f}: {why}')
    # 6 still — 판의 한 장 그림과 같은 사람(띠 색)
    sf = still_match.still_features(still_game, os.path.basename(pdir)) if still_game else None
    if sf is not None and 'idle' in man['clips']:
        im = np.asarray(Image.open(os.path.join(pdir, man['clips']['idle']['file'])).convert('RGBA'))
        s, per = still_match.similarity(sf, still_match.features(im[:px, :px]))
        chk['still']['worst'] = round(s, 3)
        chk['still']['bands'] = [round(x, 3) for x in per]
        if s < still_match.STILL_MIN or min(per) < still_match.STILL_BAND_MIN:
            bad('still', f'{still_game} still 대조 {s:.2f} (머리·윗몸·아랫몸 {per[0]:.2f}·{per[1]:.2f}·{per[2]:.2f})')
    return {'pass': all(v['ok'] for v in chk.values()), 'cells': cells, 'checks': chk, 'px': px, 'foot_px': fy,
            'clips': list(man['clips']), 'missing': man.get('missing', [])}


def judge_all(root=os.path.join(OUT, 'styled'), only=None, still_games=None):
    res = {}
    for d in sorted(os.listdir(root)):
        if only and d not in only:
            continue
        if os.path.exists(os.path.join(root, d, 'manifest.json')):
            res[d] = judge_pool(os.path.join(root, d), (still_games or {}).get(d, 'saga-dungeon') if still_games is not None else STILL_GAME.get(d, 'saga-dungeon'))
    jp = os.path.join(OUT, 'judge.json')
    old = json.load(open(jp, encoding='utf-8')) if os.path.exists(jp) else {}
    old.update(res)
    os.makedirs(OUT, exist_ok=True)
    json.dump(old, open(jp, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    return res


STILL_GAME = {}          # 명령줄로 돌 때 풀 → still 판(5천하 rts_* 는 saga-realm, 나머지는 saga-dungeon 그림과 같다)
for _p in ('rts_inf_ally', 'rts_inf_enemy', 'rts_arc_ally', 'rts_arc_enemy', 'rts_cav_ally', 'rts_cav_enemy'):
    STILL_GAME[_p] = 'saga-realm'


if __name__ == '__main__':
    a = sys.argv[1:]
    only = a[a.index('--only') + 1].split(',') if '--only' in a else None
    root = next((x for x in a if not x.startswith('--') and (not only or x not in ','.join(only))), os.path.join(OUT, 'styled'))
    res = judge_all(root, only)
    for k, v in res.items():
        print(k, 'PASS' if v['pass'] else 'FAIL', f'{v["cells"]}칸',
              ' · '.join(f'{c} {"○" if x["ok"] else "×"}{"" if x["worst"] is None else " " + str(round(x["worst"], 2))}' for c, x in v['checks'].items()))
        for c, x in v['checks'].items():
            for b in x['bad'][:3]:
                print('   ', c, b)
    sys.exit(1 if any(not v['pass'] for v in res.values()) else 0)
