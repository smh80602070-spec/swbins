"""K-0198 A자세 정면 — 팔이 몸통에 붙은 그림은 팔 부위에 몸통 옷이 섞이고(찢긴 조각), 몸통엔 팔이 가리던 자리가 빈다(사용자 10-30 「어깨랑 팔이 너무 붙어 있거나 누락」).
그래서 정면 stand 에서 **팔만 인페인트**해 몸에서 떼어 든 A자세로 다시 그린다 — 마스크 밖(얼굴·옷)은 원본 그대로라 같은 사람.
  py tools/ai-art/k198_apose.py prep <id>… [--deg 35]   → _out/k198/apose_src/<id>.png(+_mask.png) · batches/k198_apose.json (먼저 `bash tools/ai-art/k198_front.sh <id>` 로 정면 관절)
  py tools/ai-art/gen.py tools/ai-art/batches/k198_apose.json --variants 3 [--only <id>_apose]
마스크 = 원래 팔 캡슐(지울 자리) + 몸에서 deg 만큼 벌린 새 팔 캡슐(그릴 자리). 관절은 front.png 좌표 그대로(640×1024 로 맞춤).
"""
import json
import math
import os
import sys

from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
HERE = os.path.join(ROOT, 'tools', 'ai-art')
OUT = os.path.join(HERE, '_out', 'k198')
W, H = 640, 1024
BG = (232, 240, 230)


def rot(p, o, deg):
    a = math.radians(deg); dx, dy = p[0] - o[0], p[1] - o[1]
    return [o[0] + dx * math.cos(a) - dy * math.sin(a), o[1] + dx * math.sin(a) + dy * math.cos(a)]


def prep(i, deg):
    fdir = os.path.join(OUT, f'{i}_front')
    j = json.load(open(os.path.join(fdir, 'joints.json'), encoding='utf-8'))
    st = Image.open(os.path.join(ROOT, 'saga-assets', 'illust', 'shared', i, 'stand.webp')).convert('RGBA')   # 다시 딴 front.png 는 가장자리가 거칠다 — 투명 배경이 깨끗한 원본을 얹는다(같은 크기라 관절 좌표 그대로)
    sc = 0.9 * H / st.height                                            # 비율 유지로 줄여 가운데(여백을 둬 머리·발이 안 잘리게)
    nw, nh = int(st.width * sc), int(st.height * sc)
    ox, oy = (W - nw) // 2, (H - nh) // 2
    bg = Image.new('RGBA', (W, H), BG + (255,)); bg.alpha_composite(st.resize((nw, nh), Image.LANCZOS), (ox, oy))
    init = bg.convert('RGB')
    T = lambda p: [p[0] * sc + ox, p[1] * sc + oy]
    cx = T(j['pelvis'])[0]
    rad = j['w']['arm'] * 1.25 * sc
    m = Image.new('L', (W, H), 0); d = ImageDraw.Draw(m)

    def cap(pts, r):
        for a, b in zip(pts, pts[1:]):
            d.line([tuple(a), tuple(b)], fill=255, width=int(r * 2))
        for p in pts:
            d.ellipse([p[0] - r, p[1] - r, p[0] + r, p[1] + r], fill=255)

    for side in ('N', 'F'):
        s = j[side]
        pts = [T(s[k]) for k in ('sh', 'el', 'wr', 'tip')]
        cap(pts, rad)                                                      # 지울 자리(원래 팔)
        for sg in (deg, -deg):                                             # 몸에서 멀어지는 쪽으로 벌린 새 팔
            new = [pts[0]] + [rot(p, pts[0], sg) for p in pts[1:]]
            if abs(new[3][0] - cx) > abs(pts[3][0] - cx):
                cap(new, rad * 1.1); break
    m = m.filter(ImageFilter.GaussianBlur(5)).point(lambda v: 255 if v > 90 else int(v * 2.8))
    os.makedirs(os.path.join(OUT, 'apose_src'), exist_ok=True)
    sp = os.path.join(OUT, 'apose_src', f'{i}.png'); mp = os.path.join(OUT, 'apose_src', f'{i}_mask.png')
    init.save(sp); m.convert('RGB').save(mp)
    return sp, mp


def arm_chains(i, img_path, dy=0):
    """생성된 A자세 그림에서 팔이 실제로 놓인 방향·길이를 찾아 팔 관절(sh·el·wr·tip)을 그 위에 놓는다 — 자동 관절은 팔이 곧게 내려온다고(비율로) 가정해 벌어진 팔을 놓친다.
    어깨에서 각도(0~90°, 5° 간격)마다 팔 길이의 30~100% 구간에 바탕이 아닌 점 비율을 재어 가장 높은 각도들의 평균 = 팔 방향, 그 방향으로 바탕이 끊기는 곳 = 팔 끝."""
    import math
    import numpy as np
    from scipy.ndimage import maximum_filter
    j = json.load(open(os.path.join(OUT, f'{i}_front', 'joints.json'), encoding='utf-8'))
    st = Image.open(os.path.join(ROOT, 'saga-assets', 'illust', 'shared', i, 'stand.webp'))
    sc = 0.9 * H / st.height; ox = (W - int(st.width * sc)) // 2; oy = (H - int(st.height * sc)) // 2
    T = lambda p: [p[0] * sc + ox, p[1] * sc + oy + dy]
    a = np.asarray(Image.open(img_path).convert('RGB')).astype(int)
    IH = a.shape[0]                                         # 뒷모습 그림은 위아래 여백이 더해져 키가 다르다
    fg = maximum_filter(np.abs(a - np.array(BG)).sum(2) > 45, size=5)    # 가는 팔이 점에서 조금 벗어나도 팔로 읽게
    L0 = 0.30 * H
    ok = lambda x, y: 0 <= x < W and 0 <= y < IH and fg[y, x]
    res = {}; found = {}
    for side, sgn in (('N', 1), ('F', -1)):                              # N = 화면 오른쪽(원본 관절 규약)
        sh = T(j[side]['sh'])
        if (sh[0] - T(j['pelvis'])[0]) * sgn < 0:
            sgn = -sgn
        cov = {}
        for ang in range(0, 95, 5):
            r = math.radians(ang); d = (sgn * math.sin(r), math.cos(r))
            cov[ang] = sum(ok(int(sh[0] + d[0] * L0 * f), int(sh[1] + d[1] * L0 * f)) for f in np.linspace(0.3, 1.0, 8)) / 8
        top = max(cov.values())
        found[side] = top >= 0.5
        ang = float(np.mean([k for k, v in cov.items() if v >= top - 0.05])) if top >= 0.5 else 0.0
        r = math.radians(ang); d = (sgn * math.sin(r), math.cos(r))
        miss = 0; end = 0.3
        for f in np.arange(0.3, 1.6, 0.05):                              # 바탕이 연달아 3번 끊기면 팔 끝
            if ok(int(sh[0] + d[0] * L0 * f), int(sh[1] + d[1] * L0 * f)):
                end = f; miss = 0
            else:
                miss += 1
                if miss >= 3:
                    break
        Ln = max(0.55, min(1.3, end)) * L0
        pt = lambda f: [sh[0] + d[0] * Ln * f, sh[1] + d[1] * Ln * f]
        res[side] = (ang, [sh, pt(0.5), pt(0.92), pt(1.0)], Ln, sgn, sh)
    for side, other in (('N', 'F'), ('F', 'N')):                         # 한쪽 팔을 못 찾았으면(옷에 가렸거나 어깨 위치가 어긋남) 반대쪽 각도·길이를 대칭으로 쓴다
        if not found[side] and found[other]:
            ang, _, Ln, sgn, sh = res[side][0], None, res[other][2], res[side][3], res[side][4]
            r = math.radians(ang_o := res[other][0]); d = (sgn * math.sin(r), math.cos(r))
            pt = lambda f, d=d, sh=sh, Ln=Ln: [sh[0] + d[0] * Ln * f, sh[1] + d[1] * Ln * f]
            res[side] = (ang_o, [sh, pt(0.5), pt(0.92), pt(1.0)], Ln, sgn, sh)
    return {k: (v[0], v[1]) for k, v in res.items()}


def patch_joints(i, v):
    jp = os.path.join(OUT, f'{i}_apose', 'joints.json')
    jj = json.load(open(jp, encoding='utf-8'))
    ch = arm_chains(i, os.path.join(OUT, 'apose', f'{i}_apose_v{int(v):02d}.png'))
    for side in ('N', 'F'):
        for k, p in zip(('sh', 'el', 'wr', 'tip'), ch[side][1]):
            jj[side][k] = [round(p[0]), round(p[1])]
    json.dump(jj, open(jp, 'w'))
    print('ARMS', i, {s: ch[s][0] for s in ch})


def patch_back(i, v):
    jp = os.path.join(OUT, f'{i}_back', 'joints.json')
    jj = json.load(open(jp, encoding='utf-8'))
    ch = arm_chains(i, os.path.join(OUT, 'back_a', f'{i}_back_v{int(v):02d}.png'), dy=64)   # 뒷모습은 A자세 정면을 위에 64px 여백으로 얹어 만들었다
    for side in ('N', 'F'):
        for k, p in zip(('sh', 'el', 'wr', 'tip'), ch[side][1]):
            jj[side][k] = [round(p[0]), round(p[1])]
    json.dump(jj, open(jp, 'w'))
    print('BACKARMS', i, {s: ch[s][0] for s in ch})


def main():
    a = [x for x in sys.argv[1:] if not x.startswith('--')]
    deg = 35
    if '--deg' in sys.argv:
        deg = float(sys.argv[sys.argv.index('--deg') + 1]); a = [x for x in a if x != str(sys.argv[sys.argv.index('--deg') + 1])]
    if a and a[0] == 'joints_back':
        patch_back(a[1], a[2]); return
    if a and a[0] == 'joints':
        patch_joints(a[1], a[2]); return
    if a and a[0] == 'prep':
        a = a[1:]
    back = json.load(open(os.path.join(HERE, 'batches', 'k198_back.json'), encoding='utf-8'))
    by = {x['id'][:-5]: x for x in back['items']}
    items = []
    for i in a:
        sp, mp = prep(i, deg)
        pr = by[i]['prompt']
        for t in (', (from behind:1.5), (back view:1.5), facing away from viewer, rear view, back of head, hands empty, (full body from head to toe:1.3), whole body visible, head visible',):
            pr = pr.replace(t, '')
        pr += ', front view, (A-pose:1.5), (arms spread away from the body:1.4), (clear gap between arms and torso:1.3), hands apart from the torso, hands empty'
        items.append({'id': f'{i}_apose', 'init_image': os.path.relpath(sp, HERE).replace('\\', '/'), 'mask_image': os.path.relpath(mp, HERE).replace('\\', '/'),
                      'denoise': 0.92, 'seed': by[i]['seed'] + 2000, 'prompt': pr,
                      'negative': 'arms crossed, hands on hips, arms behind back, arms touching the body, back view, weapon, polearm, text, watermark, black background, extra arms, extra limbs'})
    d = {k: v for k, v in back.items() if k != 'items'}
    d['items'] = items; d['out'] = 'k198/apose'; d['note'] = 'K-0198 A자세 정면 — 팔만 인페인트'
    d['defaults'] = dict(d['defaults'], width=W, height=H)
    json.dump(d, open(os.path.join(HERE, 'batches', 'k198_apose.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print('APOSE_PREP', len(items))


if __name__ == '__main__':
    main()
