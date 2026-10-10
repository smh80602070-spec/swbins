"""K-0028 — 다 구운 인물(vroid_batch.sh 산출)을 정본 웹 3D·2D 시트로 올린다. K-0024 299 와 같은 모양(GLB + tex/ 공용 · <id>.license.json).

    py tools/char-forge/promote_web_chars.py --ids a,b            # 올릴 것만 센다
    py tools/char-forge/promote_web_chars.py --ids a,b --write    # web_share_textures → saga-assets/characters/web3d · _out/sprites/<id> → sprites2d/<id>
    py tools/char-forge/promote_web_chars.py --plan-from 299 --write   # 조합표 299 번째 줄부터(K-0028 새 201)

다 안 구운 인물(웹 표시 .morph11 또는 2D manifest 없음)은 건너뛰고 알린다 — 굽기와 나란히 몇 번이고 돌려도 된다(멱등).
출처: 조합표 줄(몸·옷 출처 샘플·무늬)에서 쓴다. 무늬(K-0028)가 있으면 그 무늬 출처(AI 생성 OpenRAIL++-M)를 덧붙인다.
그 다음 배치: `py tools/asset-place/place.py --write --item characters-web3d` · `--item characters-sprites2d`.
"""
import json
import os
import shutil
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
CANON = os.path.join(ROOT, 'saga-assets', 'characters')
VR = os.path.join(HERE, '_out', 'vroid')
SP = os.path.join(HERE, '_out', 'sprites')
PLAN = os.path.join(HERE, 'data', 'outfit_swap_plan.json')
LIC = 'VRoid Studio 공식 샘플 이용 조건: 상업 사용·개작본 재배포 허용, 크레딧 불필요(VRM 메타 확인)'
GEN = 'tools/char-forge/outfit_swap.py + vroid_batch.sh + web_share_textures.py (K-0024)'


def sample(L):
    return 'AvatarSample_' + L.upper() if len(L) == 1 else L + '.vrm'


def lic_of(r, suffix=''):
    srcs = sorted({sample(r['body'])} | {sample(v) for v in r['kit'].values()})
    d = {'id': r['id'] + suffix, 'generator': GEN, 'license': LIC, 'commercial_use': True, 'source_samples': srcs,
         'body': sample(r['body']), 'kit': r['kit'],
         'note': '옷·몸 조각을 샘플 사이에서 이식한 인물. 얼굴·머리는 샘플 그대로(약간 다르게만, 사용자 2026-10-02).'}
    if r.get('pattern'):
        d['pattern'] = dict(r['pattern'], source='saga-assets/patterns/%s.webp' % r['pattern']['name'],
                            license='CreativeML OpenRAIL++-M (AI 생성 무늬 타일, saga-assets/patterns/_provenance.json)')
        d['note'] += ' K-0028: 무늬 한 칸 합성(outfit_swap.py).'
    return d


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    a = sys.argv[1:]
    opt = lambda k, d=None: a[a.index(k) + 1] if k in a else d
    rows = json.load(open(PLAN, encoding='utf-8'))['entries']
    if opt('--plan-from'):
        rows = rows[int(opt('--plan-from')):]
    if opt('--ids'):
        want = set(opt('--ids').split(','))
        rows = [r for r in rows if r['id'] in want]
    write = '--write' in a
    ready, skip = [], []
    for r in rows:
        i = r['id']
        ok3 = os.path.exists(os.path.join(VR, i, 'web', '.morph11')) and os.path.exists(os.path.join(VR, i, 'web', i + '.glb'))
        ok2 = os.path.exists(os.path.join(SP, i, 'manifest.json'))
        (ready if ok3 and ok2 else skip).append(r)
    print('올릴 것 %d · 아직 %d%s' % (len(ready), len(skip), (' — ' + ','.join(r['id'] for r in skip[:8])) if skip else ''))
    if not write or not ready:
        return
    ids = ','.join(r['id'] for r in ready)
    w3 = os.path.join(CANON, 'web3d')
    rc = subprocess.run([sys.executable, os.path.join(HERE, 'web_share_textures.py'), w3, '--ids', ids]).returncode
    if rc:
        sys.exit('web_share_textures 실패')
    for r in ready:
        i = r['id']
        json.dump(lic_of(r), open(os.path.join(w3, i + '.license.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
        d2 = os.path.join(CANON, 'sprites2d', i)
        os.makedirs(d2, exist_ok=True)
        for f in os.listdir(os.path.join(SP, i)):
            if f.endswith('.webp') or f == 'manifest.json':
                shutil.copy(os.path.join(SP, i, f), os.path.join(d2, f))
        json.dump(lic_of(r, '_sprites2d'), open(os.path.join(d2, i + '.license.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print('PROMOTE 올림 %d' % len(ready))


if __name__ == '__main__':
    main()
