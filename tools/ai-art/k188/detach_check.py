"""K-0199 — 컷아웃 「떨어지는 부위」 자동 검사: 사람(rig) × 공용 동작 팩 클립 × 시점마다 그려서 알파 덩어리를 센다.
가장 큰 덩어리 말고 따로 떠 있는 덩어리가 몸 넓이의 0.4% 넘으면 「떨어짐」(부위 이음이 벌어졌거나 부위가 날아감).
옷자락 인물(rig.clips 있음)은 팩의 <이름>~robe 를 쓴다(웹과 같은 규칙).

  py tools/ai-art/k188/detach_check.py [id,id…|all] [--clips a,b|all] [--phases 6] [--h 160] [--sheet out.png] [--cut 시험폴더]
  → 끝 줄 DETACH 떨어짐 n / 검사 m · _out/k199/detach.json(목록) · --sheet 이면 떨어진 장면 앞 40장 시트
"""
import json
import os
import sys

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
import k188_cutout as K  # noqa: E402

A = sys.argv[1:]
opt = lambda k, d=None: A[A.index(k) + 1] if k in A else d
CUT = os.path.join(K.ROOT, 'saga-assets', 'web2d', 'cutout')
CUT_IN = opt('--cut', CUT)   # 시험 자름 폴더(<id>/rig.json) — 팩·index 는 정본에서
pack = json.load(open(os.path.join(CUT, '_clips', 'side.json'), encoding='utf-8'))
idx = json.load(open(os.path.join(CUT, 'index.json'), encoding='utf-8'))['pools']
ids = sorted(set(idx.values())) if not A or A[0] in ('all',) or A[0].startswith('--') else A[0].split(',')
names = [k for k in pack if not k.endswith('~robe')] if opt('--clips', 'all') == 'all' else opt('--clips').split(',')
NP, H = int(opt('--phases', 6)), int(opt('--h', 160))
TH = float(opt('--th', 0.004))
OUT = os.path.join(K.ROOT, 'tools', 'char-forge', '_out', 'k199')
os.makedirs(OUT, exist_ok=True)

bad, n = [], 0
for pid in ids:
    d = os.path.join(CUT_IN, pid)
    rig = json.load(open(os.path.join(d, 'rig.json'), encoding='utf-8'))
    robe = bool(rig.get('clips'))
    tmp = os.path.join(OUT, '_rig_' + pid + ('_t' if CUT_IN != CUT else ''))
    os.makedirs(tmp, exist_ok=True)
    for f in os.listdir(d):
        if f.endswith('.webp'):   # K-0201 — 있으면 건너뛰던 것이 옛 그림을 남겨 다시 자른 뒤 숫자가 낡은 그림 기준이었다
            Image.open(os.path.join(d, f)).save(os.path.join(tmp, f))
    if '--noweapon' in sys.argv and os.path.exists(os.path.join(tmp, 'weapon.webp')):   # K-0201 — 가는 무기 줄이 몸과 떨어진 덩어리로 잡혀 숫자를 부풀림 — 무기 빼고 센다
        w_ = Image.open(os.path.join(tmp, 'weapon.webp')); Image.new('RGBA', w_.size, (0, 0, 0, 0)).save(os.path.join(tmp, 'weapon.webp'))
    rig2 = dict(rig, clips={k: (pack.get(k + '~robe', pack[k]) if robe else pack[k]) for k in names})
    json.dump(rig2, open(os.path.join(tmp, 'rig.json'), 'w', encoding='utf-8'))
    def offs(nm, ph):
        a = np.asarray(K.render(tmp, nm, ph, H))[..., 3] > 40
        lab, k = ndimage.label(a)
        if k < 2:
            return [], 1.0
        area = ndimage.sum(a, lab, range(1, k + 1))
        main = area.max()
        return [float(x) for x in area if x != main and x > main * TH], main
    # 기준 = 서기(idle 0) — 망토 술·깃털·부채처럼 원래 떠 있는 장식은 빼고, 동작에서 더 생긴 것만 센다(10-26)
    b0, m0 = offs('idle', 0.0) if 'idle' in rig2['clips'] else ([], 1.0)
    bn, bs = len(b0), sum(b0) / m0
    for nm in names:
        for i in range(NP):
            ph = i / NP if rig2['clips'][nm].get('loop') else i / max(1, NP - 1)
            n += 1
            off, main = offs(nm, ph)
            if len(off) <= bn and sum(off) / main <= bs * 1.5 + TH:
                continue
            if off:
                bad.append({'id': pid, 'clip': nm, 'phase': round(ph, 2), 'robe': robe, 'off_px': [int(x) for x in off], 'ratio': round(max(off) / main, 4)})
json.dump(bad, open(os.path.join(OUT, 'detach.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=0)
by_clip, by_id = {}, {}
for b in bad:
    by_clip[b['clip']] = by_clip.get(b['clip'], 0) + 1
    by_id[b['id']] = by_id.get(b['id'], 0) + 1
print('BY_CLIP', sorted(by_clip.items(), key=lambda x: -x[1])[:25])
print('BY_ID', sorted(by_id.items(), key=lambda x: -x[1])[:25])
if opt('--sheet') and bad:
    show = sorted(bad, key=lambda b: -b['ratio'])[:40]
    tiles = []
    for b in show:
        im = K.render(os.path.join(OUT, '_rig_' + b['id'] + ('_t' if CUT_IN != CUT else '')), b['clip'], b['phase'], H)
        bg = Image.new('RGBA', im.size, (214, 222, 210, 255)); bg.alpha_composite(im)
        ImageDraw.Draw(bg).text((3, 3), f"{b['id'][:12]} {b['clip']} {b['phase']}", fill=(0, 0, 0, 255))
        tiles.append(bg.convert('RGB'))
    w, h = tiles[0].size; c = 8
    s = Image.new('RGB', (w * c, h * ((len(tiles) + c - 1) // c)), 'white')
    for k, t in enumerate(tiles):
        s.paste(t.resize((w, h)), ((k % c) * w, (k // c) * h))
    s.save(opt('--sheet'))
print('DETACH', len(bad), '/', n)
