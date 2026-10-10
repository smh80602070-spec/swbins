"""K-0096 — 다듬은 GLB(finish → creature_fill → compress 끝난 <묶음>/anim)를 정본 saga-assets/creatures3d 로 올린다.

  py tools/ai-art/remote3d/promote.py <묶음 폴더> --ids duck,owl [--write]
  … --rig <뼈 심고 압축한 폴더>  # anim/ 대신 creature_rig.py(자체 뼈 + 동작 7) → compress.mjs 결과를 올린다

license = run_kaggle 이 쓴 것(TRELLIS MIT + 입력 그림 출처) + 다듬기 단계·대신하는 빌린 파일(대상 표 borrowed)·yaw·키.
그 다음: `py tools/asset-place/place.py --write --item creatures3d` · `py tools/asset-audit/credits.py`.
"""
import json
import os
import shutil
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
CANON = os.path.join(ROOT, 'saga-assets', 'creatures3d')
PIPE = 'remote3d/finish.py(얼굴 +Z·발 밑 원점·키 m·떨어진 조각·바닥 판 지움) → glb-compress/creature_fill.mjs --forward-z(뼈 없는 동작 7) → compress.mjs(Meshopt·WebP)'
PIPE_RIG = 'remote3d/finish.py(얼굴 +Z·발 밑 원점·키 m·떨어진 조각·바닥 판 지움) → asset-forge/creature_rig.py(자체 뼈대 + 자체 키프레임 동작 7, quad·bird·worm) → glb-compress/compress.mjs(Meshopt·WebP)'


def main():
    sys.stdout.reconfigure(encoding='utf-8')
    a = sys.argv[1:]
    opt = lambda k, d=None: a[a.index(k) + 1] if k in a else d
    d = os.path.abspath(a[0])
    T = {t['id']: t for t in json.load(open(os.path.join(HERE, 'k96_targets.json'), encoding='utf-8'))['items']}
    ids = opt('--ids').split(',')
    rig = opt('--rig')
    gd = os.path.abspath(rig) if rig else os.path.join(d, 'anim')
    for i in ids:
        for p in (os.path.join(gd, i + '.glb'), os.path.join(d, i + '.license.json')):
            if not os.path.exists(p):
                sys.exit('없음: ' + p)
        if i not in T:
            sys.exit('대상 표에 없음: ' + i)
    print('올릴 것 %d: %s' % (len(ids), ','.join(ids)))
    if '--write' not in a:
        return
    os.makedirs(CANON, exist_ok=True)
    for i in ids:
        t = T[i]
        shutil.copy2(os.path.join(gd, i + '.glb'), os.path.join(CANON, i + '.glb'))
        lic = json.load(open(os.path.join(d, i + '.license.json'), encoding='utf-8'))
        lic.update(pipeline=PIPE_RIG if rig else PIPE, yaw=t.get('yaw', 0), height_m=t.get('height', 1.0), replaces=t['borrowed'],
                   commercial_use=True, note='K-0096 자체 생성(입력 = 우리 txt2img 그림). 빌린 모델을 대신한다 — 게임 참조 바꾸기는 W 티켓.')
        if rig:
            lic['rig'] = t.get('rig', 'quad')
        json.dump(lic, open(os.path.join(CANON, i + '.license.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print('PROMOTE_OK %d → %s' % (len(ids), CANON))


if __name__ == '__main__':
    main()
