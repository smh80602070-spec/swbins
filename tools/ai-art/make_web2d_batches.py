"""K-0020 — data/web2d_plan.json → 배치 두 개 (배경 후보 40장 · 바닥 타일 30장).

py tools/ai-art/make_web2d_batches.py
  → batches/web2d_bg.json    (Illustrious-XL-v2.0, 지역 20 × 후보 2, id = bg_<판>_<지역>_<k>)
  → batches/web2d_tiles.json (sd_xl_base_1.0, 판 5 × 6, id = tile_<판>_<종류>)
이어서 돌리기: bash tools/ai-art/run_all.sh tools/ai-art/batches/web2d_bg.json <상태파일> (이미 만든 그림은 건너뛴다).
씨앗은 순서로 정해져 같은 계획표면 같은 배치가 나온다.
"""
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
PLAN = json.load(open(os.path.join(HERE, 'data', 'web2d_plan.json'), encoding='utf-8'))


def batch(kind, model, out, style, items):
    defaults = {'prompt_prefix': style['prefix'], 'width': style['width'], 'height': style['height'], 'steps': style['steps'],
                'cfg': style['cfg'], 'sampler': style['sampler'], 'negative': style['negative']}
    path = os.path.join(HERE, 'batches', out + '.json')
    json.dump({'model': model, 'out': out, 'defaults': defaults, 'items': items}, open(path, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print('BATCH', out, len(items))


def main():
    bg, tiles, n = [], [], 0
    cands = PLAN['budget']['bg_candidates']
    for g, spec in PLAN['games'].items():
        for r in spec['bg']:
            for k in range(1, cands + 1):
                n += 1
                bg.append({'id': f'bg_{g}_{r["id"]}_{k}', 'seed': 20261002 + 29 * n, 'prompt': r['prompt']})
        for t in spec['tiles']:
            n += 1
            tiles.append({'id': f'tile_{g}_{t["id"]}', 'seed': 20261002 + 29 * n, 'prompt': t['prompt']})
    batch('bg', PLAN['models']['bg'], 'web2d_bg', PLAN['bg_style'], bg)
    batch('tile', PLAN['models']['tile'], 'web2d_tiles', PLAN['tile_style'], tiles)


if __name__ == '__main__':
    main()
