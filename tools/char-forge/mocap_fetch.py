"""K-0139 1단계 — CMU 모캡 BVH(Hahne 2010 변환)를 data/mocap_clips.json 의 번호대로 받는다.
  py tools/char-forge/mocap_fetch.py [--table data/clips30.json] [--extra 79_01,81_10]   → tools/char-forge/_in/mocap/<번호>.bvh + source.json
  (있으면 건너뜀, --extra = 표 밖 후보, --table = 다른 표 — K-0161 clips30 은 cmu 칸이 있는 줄만 받고 source.json 은 안 덮는다)
받기는 curl(Windows 10+ 기본) — urllib 는 이 PC 에서 응답 없이 멈춘 일이 있다(10-21).
거울: github.com/una-dinosauria/cmu-mocap (data/<사람 3자리>/<번호>.bvh). 라이선스 문구는 mocap_clips.json `source` 그대로.
"""
import json
import os
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '_in', 'mocap')
URL = 'https://raw.githubusercontent.com/una-dinosauria/cmu-mocap/master/data/{subj:03d}/{num}.bvh'


def main():
    tp = sys.argv[sys.argv.index('--table') + 1] if '--table' in sys.argv else os.path.join(HERE, 'data', 'mocap_clips.json')
    if not os.path.exists(tp):
        tp = os.path.join(HERE, tp)
    t = json.load(open(tp, encoding='utf-8'))
    os.makedirs(OUT, exist_ok=True)
    got = []
    extra = sys.argv[sys.argv.index('--extra') + 1].split(',') if '--extra' in sys.argv else []   # K-0148 후보(표에 넣기 전 재 볼 것)
    for c in [c for c in t['clips'] if c.get('cmu')] + [{'game': 'cand', 'cmu': n} for n in extra if n]:
        num = c['cmu']
        p = os.path.join(OUT, num + '.bvh')
        if not os.path.exists(p):
            u = URL.format(subj=int(num.split('_')[0]), num=num)
            subprocess.run(['curl', '-sS', '-f', '--max-time', '90', '-o', p, u], check=True, stdin=subprocess.DEVNULL)
        got.append({'game': c['game'], 'cmu': num, 'file': os.path.basename(p), 'bytes': os.path.getsize(p)})
    if '--table' in sys.argv:        # 다른 표는 source.json(K-0139 기록)을 덮지 않는다
        print('MOCAP_FETCH', len(got))
        return
    json.dump({'source': t['source'], 'mirror': 'https://github.com/una-dinosauria/cmu-mocap', 'files': got},
              open(os.path.join(OUT, 'source.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print('MOCAP_FETCH', len(got))


if __name__ == '__main__':
    main()
