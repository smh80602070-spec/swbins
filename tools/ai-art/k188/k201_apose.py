"""K-0201 — 「가려진 데 없는 그림」 자동 만들기: 원본 한 장은 팔이 몸통 앞에 붙어 있어, 팔을 움직이면 그 뒤 몸통이 원래 그림에 없어 빈다(사용자 10-27).
그래서 ① 지금 뼈대로 앞 팔을 몸에서 떼어 앞으로 든 자세를 그리고 ② 팔이 가리던 몸통 자리(=채움 자리)만 마스크로 AI 인페인트 ③ 그 그림으로 다시 자른다.
쉼 보정(rest_fix)이 그려진 팔 각도를 빼므로 동작 팩은 그대로 쓴다.

  py tools/ai-art/k188/k201_apose.py prep <id> [--arm 55] [--el 0] [--den 0.95]
     → _out/k188/p/<id>/apose/{base.png, mask.png, alpha.png, joints.json} · batches/k201_apose_<id>.json
  py tools/ai-art/gen.py tools/ai-art/batches/k201_apose_<id>.json          (ComfyUI 켠 뒤)
  py tools/ai-art/k188/k201_apose.py finish <id>
     → apose/side.png(인페인트 RGB + 실루엣 알파) · apose/rig(다시 자름) · tasks/sheets/k201_apose_<id>_strip.png(전후 걷기·달리기)
  py tools/ai-art/k188/k201_apose.py adopt <id>      → p/<id>/side.png·joints.json 를 apose 것으로(옛 것 *.bak_apose) — publish 는 따로
"""
import json
import math
import os
import shutil
import subprocess
import sys
import tempfile

import numpy as np
from PIL import Image, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..'))
import k188_cutout as K  # noqa: E402

A = sys.argv[1:]
opt = lambda k, d=None: A[A.index(k) + 1] if k in A else d
cmd, pid = A[0], A[1]
P = os.path.join(K.ROOT, 'tools', 'ai-art', '_out', 'k188', 'p', pid)
OUT = os.path.join(P, 'apose')
os.makedirs(OUT, exist_ok=True)
PY = sys.executable


def cut(src, jp, outdir, mark=False):
    env = dict(os.environ, PYTHONIOENCODING='utf-8')
    if mark:
        env['K188_HOLE_MARK'] = '1'
    r = subprocess.run([PY, os.path.join(K.ROOT, 'tools', 'ai-art', 'k188_cutout.py'), 'cut', src, jp, outdir], env=env, capture_output=True, text=True, encoding='utf-8')
    if r.returncode:
        sys.exit('cut 실패\n' + r.stderr[-800:])


def pose_render(rigdir, keys, Hpx, drop_far=True):
    """키(뼈: 각도 deg)를 고정한 한 자세 — 먼 쪽(L) 부위는 빼고(다시 자를 때 copyall 로 다시 생긴다) 그린다."""
    rig = json.load(open(os.path.join(rigdir, 'rig.json'), encoding='utf-8'))
    rig['clips'] = {'apose': {'len': 1, 'loop': True, 'keys': {b: [[0, a], [1, a]] for b, a in keys.items()}}}
    if drop_far:
        rig['parts'] = [p for p in rig['parts'] if not (p['bone'].endswith('L') and p['bone'][:-1] in ('armU', 'armL', 'hand', 'legU', 'legL', 'foot'))]
    json.dump(rig, open(os.path.join(rigdir, 'rig.json'), 'w', encoding='utf-8'))
    return K.render(rigdir, 'apose', 0, Hpx)


if cmd == 'prep':
    j = json.load(open(os.path.join(P, 'joints.json'), encoding='utf-8'))
    src = os.path.join(P, 'side.png')
    im0 = Image.open(src)
    arm, el = float(opt('--arm', 55)), float(opt('--el', 0))
    keys = {'armUR': -arm, 'armLR': el}
    tmp = tempfile.mkdtemp(prefix='k201ap_')
    jn = dict(j); jn['fill'] = j.get('fill', 'smear')
    jn.pop('hip_under_r', None); jn['hip_cap'] = True        # 허벅지 빈칸용 넓은 허리 채움은 빼고 — 팔 뒤 몸통만 다시 그린다(허리 뒤로 상자가 튀어나와 마스크에 들어갔다)
    jp = os.path.join(tmp, 'j.json'); json.dump(jn, open(jp, 'w', encoding='utf-8'))
    cut(src, jp, os.path.join(tmp, 'n'))
    cut(src, jp, os.path.join(tmp, 'm'), mark=True)
    foot_y = j.get('foot'); top_y = j['top'][1]
    Hpx = foot_y - top_y                                   # 1 뼈 단위 = 원본 픽셀 S⁻¹ — 원본과 같은 크기로 그린다
    rn = pose_render(os.path.join(tmp, 'n'), keys, Hpx)
    rm = pose_render(os.path.join(tmp, 'm'), keys, Hpx)
    W = int(Hpx * 0.9); ox, oy = W * 0.45, Hpx * 1.15
    dx, dy = int(round(j['pelvis'][0] - ox)), int(round(foot_y - oy))
    bgc = (214, 222, 210)
    base = Image.new('RGBA', im0.size, bgc + (255,)); base.alpha_composite(rn, (dx, dy)) if dx >= 0 and dy >= 0 else base.paste(rn, (dx, dy), rn)
    lay = Image.new('RGBA', im0.size, (0, 0, 0, 0)); lay.paste(rn, (dx, dy), rn)
    laym = Image.new('RGBA', im0.size, (0, 0, 0, 0)); laym.paste(rm, (dx, dy), rm)
    am = np.asarray(laym).astype(np.int16)
    mag = (am[..., 3] > 100) & (am[..., 0] > 235) & (am[..., 1] < 25) & (am[..., 2] > 235)
    from scipy import ndimage as nd
    al = np.asarray(lay)[..., 3] > 100
    full = nd.binary_fill_holes(nd.binary_closing(al, iterations=6))   # 실루엣 안 구멍(허리-허벅지 이음 등)도 몸 — 마스크에 넣고 알파도 채운다
    holes = full & ~al
    lb_, n_ = nd.label(holes)
    if n_:
        sz_ = nd.sum(holes, lb_, range(1, n_ + 1))
        holes = np.isin(lb_, [i + 1 for i, s_ in enumerate(sz_) if s_ >= 150])   # 외곽선 따라 생긴 작은 틈은 빼고(선이 다시 그려져 흔들린다)
    mk = nd.binary_dilation(mag | holes, iterations=10)
    mimg = Image.fromarray((mk * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(6))
    base.convert('RGB').save(os.path.join(OUT, 'base.png'))
    mimg.save(os.path.join(OUT, 'mask.png'))
    Image.fromarray(np.maximum(np.asarray(lay)[..., 3], (full * 255).astype(np.uint8))).save(os.path.join(OUT, 'alpha.png'))
    # 새 관절 = 원본 관절점을 그 뼈의 변환으로 옮김
    spec = json.load(open(K.SPEC, encoding='utf-8'))
    rig = json.load(open(os.path.join(tmp, 'n', 'rig.json'), encoding='utf-8'))
    M = K.pose(spec, rig, 'apose', 0)
    B = K.bones_of(j)
    S = 100.0 / (foot_y - top_y); k = Hpx / rig['h']
    def mv(p, b):
        a_, b_, c_, d_, e_, f_ = M[b]; pv = B[b][3]
        u = ((p[0] - pv[0]) * S, (p[1] - pv[1]) * S)
        return [round(k * (a_ * u[0] + c_ * u[1] + e_) + ox + dx, 1), round(k * (b_ * u[0] + d_ * u[1] + f_) + oy + dy, 1)]
    N = j['N']; N2 = dict(N)
    for key, b in (('sh', 'armUR'), ('el', 'armLR'), ('wr', 'handR'), ('tip', 'handR'), ('hip', 'legUR'), ('kn', 'legLR'), ('an', 'footR'), ('toe', 'footR')):
        N2[key] = mv(N[key], b)
    if N.get('poly'):                                       # 팔 윤곽 — 점마다 가까운 팔 뼈로
        segs = [('armUR', N['sh'], N['el']), ('armLR', N['el'], N['wr']), ('handR', N['wr'], N['tip'])]
        def near(p):
            return min(segs, key=lambda s: float(K.seg_dist(np.array([p[0]]), np.array([p[1]]), s[1], s[2])[0]))[0]
        N2['poly'] = [mv(p, near(p)) for p in N['poly']]
    j2 = dict(j, N=N2, top=mv(j['top'], 'head'), neck=mv(j['neck'], 'chest'), pelvis=mv(j['pelvis'], 'hip'))
    for k_ in ('fill_img', 'chest_poly', 'drop_poly'):
        j2.pop(k_, None)
    json.dump(j2, open(os.path.join(OUT, 'joints.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    lic = {}
    lp = os.path.join(P, 'side.license.json')
    if os.path.exists(lp):
        lic = json.load(open(lp, encoding='utf-8'))
    prompt = opt('--prompt', lic.get('prompt') or 'full body, side view, standing, flat colors, clean lineart')
    batch = {'model': opt('--model', 'animagine-xl-4.0-opt'), 'out': 'k201_apose_' + pid,
             'note': 'K-0201 apose — 팔이 가리던 몸통 자리만 인페인트',
             'defaults': {'prompt_prefix': 'masterpiece, high score, great score, absurdres', 'width': im0.width, 'height': im0.height, 'steps': 28, 'cfg': 5.0,
                          'sampler': 'Euler a', 'negative': 'lowres, bad anatomy, extra arms, extra hands, extra limbs, arm, hand, fist, text, watermark, blurry', 'denoise': float(opt('--den', 0.95))},
             'items': [{'id': 'k201_apose_' + pid, 'seed': 20261027, 'init_image': os.path.abspath(os.path.join(OUT, 'base.png')),
                        'mask_image': os.path.abspath(os.path.join(OUT, 'mask.png')), 'prompt': prompt + ', torso without arm in front, clothing continues'}]}
    bp = os.path.join(K.ROOT, 'tools', 'ai-art', 'batches', 'k201_apose_%s.json' % pid)
    json.dump(batch, open(bp, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print('APOSE_PREP', pid, 'mask px', int(mag.sum()), os.path.relpath(bp, K.ROOT))

elif cmd == 'finish':
    g = os.path.join(K.ROOT, 'tools', 'ai-art', '_out', 'k201_apose_' + pid, 'k201_apose_' + pid + '.png')
    rgb = Image.open(g).convert('RGB')
    al = Image.open(os.path.join(OUT, 'alpha.png')).convert('L')
    rgb = rgb.resize(al.size)
    out = rgb.convert('RGBA'); out.putalpha(al)
    out.save(os.path.join(OUT, 'side.png'))
    lp = os.path.join(P, 'side.license.json')
    if os.path.exists(lp):
        lic = json.load(open(lp, encoding='utf-8'))
        gl = g[:-4] + '.license.json'
        lic['k201_apose'] = json.load(open(gl, encoding='utf-8')) if os.path.exists(gl) else 'inpaint'
        json.dump(lic, open(os.path.join(OUT, 'side.license.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    cut(os.path.join(OUT, 'side.png'), os.path.join(OUT, 'joints.json'), os.path.join(OUT, 'rig'))
    r = subprocess.run([PY, os.path.join(HERE, 'k200_gif.py'), 'k201_apose_' + pid, os.path.join(P, 'rig') + '=전,' + os.path.join(OUT, 'rig') + '=후',
                        '--clips', 'idle,walk,run,attack', '--n', '8', '--h', '260'], capture_output=True, text=True, encoding='utf-8')
    print(r.stdout[-300:], r.stderr[-500:])
    print('APOSE_FINISH', pid)

elif cmd == 'adopt':
    for f in ('side.png', 'joints.json', 'side.license.json'):
        s = os.path.join(OUT, f)
        if os.path.exists(s):
            d = os.path.join(P, f)
            if os.path.exists(d):
                shutil.copy2(d, d + '.bak_apose')
            shutil.copy2(s, d)
    shutil.copy2(os.path.join(OUT, 'joints.json'), os.path.join(HERE, pid + '.joints.json'))
    cut(os.path.join(P, 'side.png'), os.path.join(P, 'joints.json'), os.path.join(P, 'rig'))
    print('APOSE_ADOPT', pid)
