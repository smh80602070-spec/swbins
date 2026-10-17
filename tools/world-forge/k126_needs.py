"""K-0126 단계 1 — 1만리·2나락·5천하가 실제로 부르는 빌린 건물·자연·소품·던전 모델 목록 → data/k126_needs.json.
  py tools/world-forge/k126_needs.py            # 표를 쓴다(짝 칸은 data/k126_pairs.json 에서 읽어 붙임)
  py tools/world-forge/k126_needs.py --print    # 표만 화면에

입력: tools/asset-audit/out/models_inventory.json(K-0119, src=borrow·used) 중 폴더 buildings·nature·props·dungeon.
"쓰임" 은 재고 도구가 이름 줄기만 봐서 넓다 → 여기서는 판 js(dist 제외)에 `<이름>.glb|gltf` 가 **글자 그대로** 나오는 것만 "부름",
이어 붙여 만드는 경로('House_' + n 같은 것)는 `prefix` 로 따로 잡아 "이어 부름" 으로 둔다(K-0119 오탐 교훈).
짝(자체 world3d id)은 사람이(Claude) data/k126_pairs.json 에 적는다 — 없으면 "새로 만듦" 후보.
"""
import glob
import json
import os
import re
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
GAMES = ('saga-go', 'saga-dungeon', 'saga-realm')
CATS = ('buildings', 'nature', 'props', 'dungeon')
OUT = os.path.join(ROOT, 'tools', 'world-forge', 'data', 'k126_needs.json')
PAIRS = os.path.join(ROOT, 'tools', 'world-forge', 'data', 'k126_pairs.json')


def main():
    inv = json.load(open(os.path.join(ROOT, 'tools', 'asset-audit', 'out', 'models_inventory.json'), encoding='utf-8'))['rows']
    rows = [r for r in inv if r['game'] in GAMES and r['src'] == 'borrow' and r['used'] and r['folder'].split('/')[0] in CATS
            and os.path.exists(os.path.join(ROOT, r['path']))]
    js = {}
    for g in GAMES:
        for f in glob.glob(os.path.join(ROOT, 'saga-web', g, 'js', '**', '*.js'), recursive=True):
            p = f.replace(os.sep, '/')
            if '/dist/' in p:
                continue
            js[p] = open(f, encoding='utf-8', errors='replace').read()
    pairs = json.load(open(PAIRS, encoding='utf-8')) if os.path.exists(PAIRS) else {}
    out = []
    for r in rows:
        base = os.path.splitext(os.path.basename(r['path']))[0]
        hits, pre = [], []
        stem = re.sub(r'[_-]?\d+$', '', base)
        for p, t in js.items():
            if '/' + r['game'] + '/' not in p:
                continue
            for m in re.finditer(re.escape(base) + r'\.(glb|gltf)', t):
                hits.append('%s:%d' % (os.path.basename(p), t.count('\n', 0, m.start()) + 1))
            if not hits and stem != base:
                for m in re.finditer(r"['\"]" + re.escape(stem) + r"[_-]?['\"]\s*\+", t):
                    pre.append('%s:%d' % (os.path.basename(p), t.count('\n', 0, m.start()) + 1))
        key = '%s:%s/%s' % (r['game'], r['folder'], base)
        out.append({'key': key, 'game': r['game'], 'folder': r['folder'], 'name': base, 'path': r['path'],
                    'call': 'name' if hits else ('prefix' if pre else 'none'), 'where': (hits or pre)[:4],
                    'pair': pairs.get(key)})
    summary = {c: sum(1 for o in out if o['call'] == c) for c in ('name', 'prefix', 'none')}
    summary['pair'] = sum(1 for o in out if o['pair'])
    if '--print' in sys.argv:
        for o in out:
            print(o['game'].replace('saga-', ''), o['folder'], o['name'], o['call'], ' '.join(o['where'][:2]), '→', o['pair'] or '-')
    else:
        json.dump({'note': 'K-0126 생성물 — tools/world-forge/k126_needs.py. pair 는 data/k126_pairs.json(손).', 'summary': summary, 'items': out},
                  open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print('K126', len(out), summary)


if __name__ == '__main__':
    main()
