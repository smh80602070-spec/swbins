"""K-0212 — 지포스 PC 에서 TRELLIS 생성 + 순수 torch 굽기(bake_free)까지 한 번에.

  C:\swbins3\trellis-venv\Scripts\python.exe tools\ai-art\remote3d\trellis_local.py <입력 폴더> <출력 폴더> [--only a,b] [--seed 1]

입력 폴더의 <id>.png 마다 <출력 폴더>/<id>.glb 를 만든다(이미 있으면 건너뜀 — 원본 덮어쓰기 금지).
환경: C:\swbins3\trellis-venv · 모델 C:\swbins3\trellis-work\model · TRELLIS 클론 C:\swbins3\trellis-work\TRELLIS(PC 로컬).
"""
import os
import sys
import time

os.environ['ATTN_BACKEND'] = 'xformers'
os.environ['SPCONV_ALGO'] = 'native'
WORK = os.environ.get('TRELLIS_WORK', r'C:\swbins3\trellis-work')
sys.path.insert(0, os.path.join(WORK, 'TRELLIS'))
sys.path.insert(0, os.path.join(WORK, 'stub'))   # kaolin 대역(FlexiCubes 가 check_tensor 하나만 씀)
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import torch  # noqa: E402
from PIL import Image  # noqa: E402

import bake_free  # noqa: E402


def opt(f, d=None):
    return sys.argv[sys.argv.index(f) + 1] if f in sys.argv else d


def main():
    src, dst = sys.argv[1], sys.argv[2]
    only = [x for x in (opt('--only') or '').split(',') if x]
    seed = int(opt('--seed', 1))
    os.makedirs(dst, exist_ok=True)
    ids = sorted(os.path.splitext(f)[0] for f in os.listdir(src) if f.lower().endswith('.png'))
    ids = [i for i in ids if (not only or i in only) and not os.path.exists(os.path.join(dst, i + '.glb'))]
    if not ids:
        print('할 것 없음')
        return
    from trellis.pipelines import TrellisImageTo3DPipeline
    p = TrellisImageTo3DPipeline.from_pretrained(os.path.join(WORK, 'model'))
    p.cuda()
    for i in ids:
        t = time.time()
        out = p.run(Image.open(os.path.join(src, i + '.png')), seed=seed)
        g, m = out['gaussian'][0], out['mesh'][0]
        gd = {'xyz': g.get_xyz, 'scaling': g.get_scaling, 'opacity': g.get_opacity, 'features': g.get_features,
              'rotation': g._rotation + g.rots_bias[None, :]}
        glb = bake_free.to_glb_free(gd, m.vertices, m.faces)
        glb.export(os.path.join(dst, i + '.glb'))
        print('ok', i, round(time.time() - t, 1), 's', flush=True)
        torch.cuda.empty_cache()


if __name__ == '__main__':
    main()
