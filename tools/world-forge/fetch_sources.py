"""world-forge 재질 사진 받기 — Poly Haven CC0 (api.polyhaven.com). 건물·지형·지물·탈것이 쓰는 PBR 세트(밝기·노멀·거칠기)를 `_src/polyhaven/` 에 받는다.

  py tools/world-forge/fetch_sources.py            # 없는 것만 받는다(체크섬 어긋나면 멈춘다)
  py tools/world-forge/fetch_sources.py --force    # 다시 받는다

`sources.json` 의 items 는 {재질 id: {"role": 쓰임, "res": "2k"}}. 받은 파일의 md5 는 Poly Haven API 가 주는 값으로 검사한다.
전부 CC0-1.0(표시 의무·상업 제한 없음). `_src/` 는 gitignore — 다른 PC 는 이 스크립트를 다시 돌린다.
"""
import hashlib
import json
import os
import sys
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '_src', 'polyhaven')
UA = {'User-Agent': 'saga-world-forge'}
# (지도 이름, API 칸, 받을 확장자 우선순위) — 노멀은 OpenGL(y+) 판
MAPS = [('diff', 'Diffuse', ('jpg', 'png')), ('nor', 'nor_gl', ('png', 'jpg', 'exr')), ('rough', 'Rough', ('jpg', 'png'))]


def get(url):
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=120) as r:
        return r.read()


def pick(files, key, res, exts):
    node = files.get(key, {}).get(res)
    if not node:
        return None
    for e in exts:
        if e in node:
            return e, node[e]
    return None


def fetch(tid, res, force):
    files = json.loads(get(f'https://api.polyhaven.com/files/{tid}'))
    made = {}
    for name, key, exts in MAPS:
        hit = pick(files, key, res, exts)
        if hit is None:
            print(f'  {tid}: {name} {res} 없음 — 건너뜀')
            continue
        ext, info = hit
        dst = os.path.join(OUT, f'{tid}_{name}_{res}.{ext}')
        if os.path.exists(dst) and not force:
            made[name] = os.path.basename(dst)
            continue
        data = get(info['url'])
        if hashlib.md5(data).hexdigest() != info['md5']:
            sys.exit(f'{tid} {name}: md5 불일치 — 사진이 바뀌었거나 받다가 깨졌다. 다시 받아 본다')
        open(dst, 'wb').write(data)
        made[name] = os.path.basename(dst)
    return made


def main():
    force = '--force' in sys.argv
    src = json.load(open(os.path.join(HERE, 'sources.json'), encoding='utf-8'))
    os.makedirs(OUT, exist_ok=True)
    got = {}
    for tid, meta in src['items'].items():
        got[tid] = fetch(tid, meta.get('res', '2k'), force)
        print('ok', tid, sorted(got[tid]))
    json.dump(got, open(os.path.join(OUT, 'index.json'), 'w', encoding='utf-8'), indent=1)
    print('ok polyhaven', len(got), src['license'])


if __name__ == '__main__':
    main()
