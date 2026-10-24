"""K-0188 ② 정본 올리기 — _out/k188/p/<id>/rig 를 saga-assets/web2d/cutout/<id>/ 로(부위 webp·rig.json·rig.license.json) + index.json pools.
  py tools/ai-art/k188/publish.py            # p/ 안 rig 있는 사람 전부
  py tools/ai-art/k188/publish.py id1,id2    # 몇 명만
웹 자리는 그다음 `py tools/asset-place/place.py --item web2d-cutout --write`.
옛 렌더 대역(K-0150·K-0169 sg_zhugeliang·hl_mukhyang)은 손그림 판으로 덮는다 — 되돌리기는 git.
"""
import glob
import json
import os
import shutil
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '..'))
P = os.path.join(ROOT, 'tools', 'ai-art', '_out', 'k188', 'p')
CANON = os.path.join(ROOT, 'saga-assets', 'web2d', 'cutout')
SOSO = {'kr_gyebaek', 'jp_yoshitsune', 'ru_geohae', 'rf_gongsunzan', 'wd_shaka'}   # △ — Claude 눈 판정(K-0188 메모)


def main():
    ids = sys.argv[1].split(',') if len(sys.argv) > 1 else sorted(os.listdir(P))
    idx_p = os.path.join(CANON, 'index.json')
    index = json.load(open(idx_p, encoding='utf-8')) if os.path.exists(idx_p) else {'pools': {}}
    n = 0
    for i in ids:
        rig = os.path.join(P, i, 'rig')
        if not os.path.exists(os.path.join(rig, 'rig.json')):
            print('없음', i); continue
        out = os.path.join(CANON, i)
        if os.path.isdir(out):
            shutil.rmtree(out)
        os.makedirs(out)
        for f in glob.glob(os.path.join(rig, '*.webp')):
            shutil.copy(f, out)
        r = json.load(open(os.path.join(rig, 'rig.json'), encoding='utf-8'))
        r['src'] = f'tools/ai-art/_out/k188/p/{i}/side.png'
        json.dump(r, open(os.path.join(out, 'rig.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
        lic = json.load(open(os.path.join(P, i, 'side.license.json'), encoding='utf-8'))
        lic.update(json.load(open(os.path.join(rig, 'rig.license.json'), encoding='utf-8')))
        lic.update({'id': f'cutout_{i}', 'joints': f'tools/ai-art/k188/{i}.joints.json',
                    'packed_by': 'K-0188 tools/ai-art/k188/person.sh(옆모습 일러스트 → 관절 → 가린 몸통 로컬 SD 인페인트 → k188_cutout.py cut) → publish.py',
                    'judge': '△' if i in SOSO else '○'})
        json.dump(lic, open(os.path.join(out, 'rig.license.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
        index['pools'][i] = i
        n += 1
    index['pools'] = dict(sorted(index['pools'].items()))
    json.dump(index, open(idx_p, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print('K188_PUBLISH', n, '· pools', len(index['pools']))


if __name__ == '__main__':
    main()
