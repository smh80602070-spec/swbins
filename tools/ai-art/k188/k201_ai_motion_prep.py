"""K-0201 시험 — 부위 뼈대로 만든 걷기 8프레임(자세는 맞음)을 밑그림으로, AI 가 이음새만 다시 그리게 하는 img2img 배치를 만든다.
  py tools/ai-art/k188/k201_ai_motion_prep.py [id=rf_sunce] [clip=walk] [n=8] [denoise=0.35]
  → tools/ai-art/_out/k201_ai/<id>_<clip>/init_<i>.png · tools/ai-art/batches/k201_ai_<id>_<clip>.json
  py tools/ai-art/gen.py tools/ai-art/batches/k201_ai_<id>_<clip>.json      (ComfyUI 켠 뒤 — start_sd.ps1)
컨트롤넷(자세 조건)이 없어 AI 가 자세를 새로 못 그린다 — 그래서 밑그림 자세를 그대로 두는 낮은 denoise 다. 씨앗은 프레임마다 같게(얼굴·옷 일관성)."""
import json
import os
import shutil
import sys
import tempfile

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..'))
import k188_cutout as K  # noqa: E402

pid = sys.argv[1] if len(sys.argv) > 1 else 'rf_sunce'
clip = sys.argv[2] if len(sys.argv) > 2 else 'walk'
N = int(sys.argv[3]) if len(sys.argv) > 3 else 8
DEN = float(sys.argv[4]) if len(sys.argv) > 4 else 0.35
SEED = 20261027
OUTD = os.path.join(HERE, '..', '_out', 'k201_ai', pid + '_' + clip)
os.makedirs(OUTD, exist_ok=True)
pack = json.load(open(os.path.join(K.ROOT, 'saga-assets', 'web2d', 'cutout', '_clips', 'side.json'), encoding='utf-8'))
src = os.path.join(K.ROOT, 'saga-assets', 'web2d', 'cutout', pid)
tmp = tempfile.mkdtemp(prefix='k201ai_')
d = os.path.join(tmp, 'r'); shutil.copytree(src, d)
rig = json.load(open(os.path.join(d, 'rig.json'), encoding='utf-8'))
robe = bool(rig.get('clips')) or bool(rig.get('skirt'))
rig['clips'] = {clip: pack.get(clip + '~robe', pack[clip]) if robe else pack[clip]}
json.dump(rig, open(os.path.join(d, 'rig.json'), 'w', encoding='utf-8'))
W, H = 768, 1024
items = []
for i in range(N):
    im = K.render(d, clip, i / N, 900)                       # 걷기는 한 바퀴 돌아 처음으로 — 끝 프레임을 빼서 이음 중복을 피함
    bg = Image.new('RGBA', (W, H), (214, 222, 210, 255))
    bg.alpha_composite(im, ((W - im.width) // 2, H - im.height - 30))
    p = os.path.join(OUTD, 'init_%d.png' % i); bg.convert('RGB').save(p)
    items.append({'id': '%s_%s_%d' % (pid, clip, i), 'seed': SEED, 'init_image': os.path.abspath(p), 'denoise': DEN,
                  'prompt': '1boy, solo, full body, side view, walking, slicked-back black pompadour hair with teal highlights, orange shoulder armor, dark navy bodysuit, black boots, flat colors, clean lineart, plain pale green background'})
batch = {'model': 'animagine-xl-4.0-opt', 'out': 'k201_ai_%s_%s' % (pid, clip),
         'note': 'K-0201 시험 — 부위 뼈대 걷기 프레임 img2img 이음새 정리(denoise %.2f)' % DEN,
         'defaults': {'prompt_prefix': 'masterpiece, high score, great score, absurdres', 'width': W, 'height': H, 'steps': 28, 'cfg': 5.0,
                      'sampler': 'Euler a', 'negative': 'lowres, bad anatomy, bad hands, text, watermark, blurry, extra limbs, multiple views', 'denoise': DEN},
         'items': items}
bp = os.path.join(HERE, '..', 'batches', 'k201_ai_%s_%s.json' % (pid, clip))
json.dump(batch, open(bp, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print('PREP', len(items), os.path.relpath(bp, K.ROOT))
