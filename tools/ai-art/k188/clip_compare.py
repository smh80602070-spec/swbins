"""K-0199 — 컷아웃 클립 비교 시트: 한 사람 rig 에 새 클립 json 을 얹어 옛(엔진 기본·rig 손질) 줄과 새 줄을 위아래로.
  py tools/ai-art/k188/clip_compare.py <사람 id> <새 클립 .json> <out.png> [walk,run,idle] [--h 260]
"""
import json, os, shutil, sys, tempfile
from PIL import Image, ImageDraw
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
import k188_cutout as K

pid, cj, out = sys.argv[1:4]
names = (sys.argv[4] if len(sys.argv) > 4 and not sys.argv[4].startswith('--') else 'walk,run,idle').split(',')
H = int(sys.argv[sys.argv.index('--h') + 1]) if '--h' in sys.argv else 260
src = os.path.join(K.ROOT, 'saga-assets', 'web2d', 'cutout', pid)
new = json.load(open(cj, encoding='utf-8'))
tmp = tempfile.mkdtemp()
shutil.copytree(src, os.path.join(tmp, 'new'))
r = json.load(open(os.path.join(tmp, 'new', 'rig.json'), encoding='utf-8'))
r['clips'] = dict(r.get('clips') or {}, **{k: v for k, v in new.items() if k in names})
json.dump(r, open(os.path.join(tmp, 'new', 'rig.json'), 'w', encoding='utf-8'))
rows = []
for nm in names:
    spec = json.load(open(K.SPEC, encoding='utf-8'))['CLIPS']
    for tag, d in ((('옛', src),) if nm in spec else ()) + (('새', os.path.join(tmp, 'new')),):   # 엔진에 없는 새 클립은 새 줄만
        n = 8 if nm != 'idle' else 6
        fr = []
        for i in range(n):
            f = K.render(d, nm, i / n, H)
            bg = Image.new('RGBA', f.size, (214, 222, 210, 255)); bg.alpha_composite(f)
            ImageDraw.Draw(bg).text((4, 4), f'{tag} {nm} {i}/{n}', fill=(0, 0, 0, 255))
            fr.append(bg.convert('RGB'))
        row = Image.new('RGB', (sum(x.width for x in fr), fr[0].height), 'white'); x = 0
        for f in fr: row.paste(f, (x, 0)); x += f.width
        rows.append(row)
W = max(r.width for r in rows)
s = Image.new('RGB', (W, sum(r.height for r in rows)), 'white'); y = 0
for r_ in rows: s.paste(r_, (0, y)); y += r_.height
s.save(out); print('CMP', out, s.size)
shutil.rmtree(tmp, ignore_errors=True)
