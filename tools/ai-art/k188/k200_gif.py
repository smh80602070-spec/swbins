"""K-0200 움직임 시트 — rig 폴더 여럿 × 팩 클립 여럿을 실제 시간(30fps)으로 돌려 gif + 프레임 띠 png(눈 판정용).
  py tools/ai-art/k188/k200_gif.py <out 이름> <rig폴더[=라벨]>,… [--clips idle,walk,run,attack,hit,jump] [--h 220] [--n 8] [--pack side.json]
  → tasks/sheets/<out>.gif(열 = rig, 행 = 클립, 클립마다 제 길이로 감기) · tasks/sheets/<out>_strip.png(클립마다 n 장 띠)
팩 = 정본 `_clips/side.json`, 옷자락 rig(rig.skirt·rig.clips 있음)는 `<이름>~robe`(엔진과 같은 규칙).
"""
import json
import os
import shutil
import sys
import tempfile

from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..'))
import k188_cutout as K  # noqa: E402

A = sys.argv[1:]
opt = lambda k, d=None: A[A.index(k) + 1] if k in A else d
OUT = os.path.join(K.ROOT, 'tasks', 'sheets')
name, rigs = A[0], [x.split('=') for x in A[1].split(',')]
clips = opt('--clips', 'idle,walk,run,attack,hit,jump').split(',')
H, N = int(opt('--h', 220)), int(opt('--n', 8))
pack = json.load(open(opt('--pack', os.path.join(K.ROOT, 'saga-assets', 'web2d', 'cutout', '_clips', 'side.json')), encoding='utf-8'))   # --pack = 다른 팩과 비교
tmp = tempfile.mkdtemp(prefix='k200_')
dirs = []
for k, r in enumerate(rigs):
    src, lab = r[0], (r[1] if len(r) > 1 else os.path.basename(os.path.normpath(r[0])))
    d = os.path.join(tmp, str(k)); shutil.copytree(src, d)
    rig = json.load(open(os.path.join(d, 'rig.json'), encoding='utf-8'))
    robe = bool(rig.get('clips')) or bool(rig.get('skirt'))
    rig['clips'] = {c: pack.get(c + '~robe', pack[c]) if robe else pack[c] for c in clips}
    json.dump(rig, open(os.path.join(d, 'rig.json'), 'w', encoding='utf-8'))
    dirs.append((d, lab))
W = int(H * 0.9)
bg = (214, 222, 210, 255)


def frame(d, c, ph):
    im = K.render(d, c, ph, H)
    t = Image.new('RGBA', (W, H + 14), bg)
    t.alpha_composite(im.crop((max(0, im.width // 2 - W // 2), 0, max(0, im.width // 2 - W // 2) + W, im.height)) if im.width > W else im, (max(0, (W - im.width) // 2), 14))
    return t


# gif — 가장 긴 클립 길이만큼, 클립마다 제 길이로 감는다(한 번 클립은 끝에서 0.4초 쉬고 다시)
L = max(pack[c]['len'] for c in clips) + 0.4
fr = []
for i in range(int(L * 30)):
    s = i / 30
    sheet = Image.new('RGBA', (W * len(dirs), (H + 14) * len(clips)), bg)
    dr = ImageDraw.Draw(sheet)
    for ci, c in enumerate(clips):
        cl = pack[c]['len']; loop = pack[c].get('loop')
        ph = (s / cl) % 1 if loop else min(1.0, (s % (cl + 0.4)) / cl)
        for k, (d, lab) in enumerate(dirs):
            sheet.alpha_composite(frame(d, c, ph), (k * W, ci * (H + 14)))
            dr.text((k * W + 3, ci * (H + 14) + 2), f'{lab} {c}', fill=(0, 0, 0, 255))
    fr.append(sheet.convert('RGB'))
os.makedirs(OUT, exist_ok=True)
fr[0].save(os.path.join(OUT, name + '.gif'), save_all=True, append_images=fr[1:], duration=33, loop=0)
# 띠 — 클립마다 n 장(위상 0..1), rig 마다 한 줄
rows = []
for c in clips:
    for d, lab in dirs:
        row = Image.new('RGBA', (W * N, H + 14), bg); dr = ImageDraw.Draw(row)
        for i in range(N):
            ph = i / N if pack[c].get('loop') else i / (N - 1)
            row.alpha_composite(frame(d, c, ph), (i * W, 0))
        dr.text((3, 2), f'{lab} {c}', fill=(0, 0, 0, 255))
        rows.append(row)
S = Image.new('RGB', (W * N, (H + 14) * len(rows)), bg[:3])
for i, r in enumerate(rows):
    S.paste(r.convert('RGB'), (0, i * (H + 14)))
S.save(os.path.join(OUT, name + '_strip.png'))
shutil.rmtree(tmp, ignore_errors=True)
print('K200_GIF', os.path.join('tasks', 'sheets', name + '.gif'), len(fr), 'frames ·', os.path.join('tasks', 'sheets', name + '_strip.png'), S.size)
