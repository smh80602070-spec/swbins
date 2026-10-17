"""K-0129 단계 1 — 유니티에 남은 빌린 모델(PolyHaven 소품 · Quaternius 식물 · 짐승 셋)이 실제로 쓰이는지 → data/k129_unity.json.
  py tools/world-forge/k129_unity.py [--print]

쓰임 = 그 파일 .meta 의 guid 가 씬·프리팹·에셋(.unity·.prefab·.asset·.mat·.controller·.overrideController)에 나오거나,
       파일 줄기 이름이 C# 에 문자열로 나옴(Resources.Load·경로 문자열). 짝(pair)은 data/k129_pairs.json(손)에서 붙인다.
"""
import glob
import json
import os
import re
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
U = os.path.join(ROOT, 'saga-unity', 'Assets')
DIRS = ['Art/Props/PolyHaven', 'Art/Vegetation/QuaterniusNature', 'Art/Creatures/Fox', 'Art/Creatures/Snake', 'Art/Creatures/Birb']
MODEL = ('.gltf', '.glb', '.fbx', '.obj')
OUT = os.path.join(ROOT, 'tools', 'world-forge', 'data', 'k129_unity.json')
PAIRS = os.path.join(ROOT, 'tools', 'world-forge', 'data', 'k129_pairs.json')


def guid_of(meta):
    m = re.search(r'^guid: ([0-9a-f]{32})', open(meta, encoding='utf-8', errors='replace').read(), re.M)
    return m.group(1) if m else None


def main():
    items = []
    for d in DIRS:
        base = os.path.join(U, d)
        for f in sorted(glob.glob(os.path.join(base, '**', '*'), recursive=True)):
            if f.lower().endswith(MODEL) and os.path.exists(f + '.meta'):
                items.append({'dir': d, 'file': os.path.relpath(f, U).replace(os.sep, '/'), 'name': os.path.splitext(os.path.basename(f))[0],
                              'guid': guid_of(f + '.meta')})
    guids = {it['guid']: it for it in items if it['guid']}
    hits = {g: [] for g in guids}
    own = tuple(os.path.join(U, d) for d in DIRS)
    for f in glob.glob(os.path.join(U, '**', '*'), recursive=True):
        if not f.endswith(('.unity', '.prefab', '.asset', '.mat', '.controller', '.overrideController')) or f.startswith(own):
            continue
        try:
            t = open(f, encoding='utf-8', errors='replace').read()
        except OSError:
            continue
        for g in set(re.findall(r'guid: ([0-9a-f]{32})', t)):
            if g in hits:
                hits[g].append(os.path.relpath(f, U).replace(os.sep, '/'))
    cs = {f: open(f, encoding='utf-8', errors='replace').read() for f in glob.glob(os.path.join(U, '**', '*.cs'), recursive=True)}
    pairs = json.load(open(PAIRS, encoding='utf-8')) if os.path.exists(PAIRS) else {}
    for it in items:
        it['refs'] = hits.get(it['guid'], [])[:4]
        it['cs'] = [os.path.basename(f) for f, t in cs.items() if re.search(r'["/]' + re.escape(it['name']) + r'["\.]', t)][:4]
        it['used'] = bool(it['refs'] or it['cs'])
        it['pair'] = pairs.get(it['name'])
    summ = {'items': len(items), 'used': sum(it['used'] for it in items), 'paired_used': sum(1 for it in items if it['used'] and it['pair'])}
    if '--print' in sys.argv:
        for it in items:
            print(it['dir'].split('/')[-1], it['name'], 'USED' if it['used'] else '-', ' '.join(it['refs'][:2] + it['cs'][:2])[:150], '→', it['pair'] or '-')
    json.dump({'note': 'K-0129 생성물 — tools/world-forge/k129_unity.py', 'summary': summ, 'items': items}, open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print('K129', summ)


if __name__ == '__main__':
    main()
