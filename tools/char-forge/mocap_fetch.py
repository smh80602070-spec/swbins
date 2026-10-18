"""K-0139 1단계 — CMU 모캡 BVH(Hahne 2010 변환)를 data/mocap_clips.json 의 번호대로 받는다.
  py tools/char-forge/mocap_fetch.py            → tools/char-forge/_in/mocap/<번호>.bvh + source.json (있으면 건너뜀)
거울: github.com/una-dinosauria/cmu-mocap (data/<사람 3자리>/<번호>.bvh). 라이선스 문구는 mocap_clips.json `source` 그대로.
"""
import json
import os
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '_in', 'mocap')
URL = 'https://raw.githubusercontent.com/una-dinosauria/cmu-mocap/master/data/{subj:03d}/{num}.bvh'


def main():
    t = json.load(open(os.path.join(HERE, 'data', 'mocap_clips.json'), encoding='utf-8'))
    os.makedirs(OUT, exist_ok=True)
    got = []
    for c in t['clips']:
        num = c['cmu']
        p = os.path.join(OUT, num + '.bvh')
        if not os.path.exists(p):
            u = URL.format(subj=int(num.split('_')[0]), num=num)
            with urllib.request.urlopen(u, timeout=60) as r:
                open(p, 'wb').write(r.read())
        got.append({'game': c['game'], 'cmu': num, 'file': os.path.basename(p), 'bytes': os.path.getsize(p)})
    json.dump({'source': t['source'], 'mirror': 'https://github.com/una-dinosauria/cmu-mocap', 'files': got},
              open(os.path.join(OUT, 'source.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print('MOCAP_FETCH', len(got))


if __name__ == '__main__':
    main()
