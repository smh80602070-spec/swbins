"""K-0212 ⓐ — 정본 GLB 의 .license.json(input_license) 에서 TRELLIS 입력 그림을 같은 씨앗·프롬프트로 다시 뽑을 배치를 만든다.
  py tools/ai-art/remote3d/regen_inputs.py [--dir saga-assets/creatures3d,saga-assets/pets3d] [--out k212_in] [--skip-done] [--chunk 40]
결과 tools/ai-art/batches/<out>_NN.json (청크마다) — 이어서 py tools/ai-art/gen.py <배치> 로 뽑는다(그림은 tools/ai-art/_out/<out>_NN/<id>.png).
GLB 쪽 id 와 같은 파일 이름이라 trellis_local.py 입력 폴더로 모으기 쉽다. init_image 가 있는 입력(img2img)은 건너뛰고 목록만 알린다.
"""
import glob
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))


def main():
    sys.stdout.reconfigure(encoding='utf-8')
    a = sys.argv[1:]
    opt = lambda k, d=None: a[a.index(k) + 1] if k in a else d
    dirs = opt('--dir', 'saga-assets/creatures3d,saga-assets/pets3d').split(',')
    out = opt('--out', 'k212_in')
    chunk = int(opt('--chunk', '40'))
    items, skipped, seen = [], [], set()
    for dr in dirs:
        for f in sorted(glob.glob(os.path.join(ROOT, dr, '*.license.json'))):
            d = json.load(open(f, encoding='utf-8'))
            il = d.get('input_license')
            if 'TRELLIS' not in d.get('generator', '') or not il:
                continue
            i = d['id']
            if i in seen:
                continue
            seen.add(i)
            if il.get('init_image') or 'seed' not in il:
                skipped.append(i)
                continue
            if '--skip-done' in a and glob.glob(os.path.join(ROOT, 'tools', 'ai-art', '_out', out + '_*', i + '.png')):
                continue
            w, h = il.get('size', [768, 768])
            items.append({'id': i, 'seed': il['seed'], 'prompt': il['prompt'], 'negative': il.get('negative_prompt', ''),
                          'width': w, 'height': h, 'steps': il.get('steps', 28), 'cfg': il.get('cfg_scale', 5.5)})
    n = 0
    for k in range(0, len(items), chunk):
        n += 1
        b = {'model': 'animagine-xl-4.0-opt', 'out': f'{out}_{n:02d}',
             'defaults': {'prompt_prefix': '', 'width': 768, 'height': 768, 'steps': 28, 'cfg': 5.5, 'sampler': 'Euler a', 'variants': 1},
             'items': items[k:k + chunk]}
        p = os.path.join(ROOT, 'tools', 'ai-art', 'batches', f'{out}_{n:02d}.json')
        json.dump(b, open(p, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print(f'항목 {len(items)} · 청크 {n} · 건너뜀(img2img 등) {len(skipped)}: {",".join(skipped)}')


if __name__ == '__main__':
    main()
