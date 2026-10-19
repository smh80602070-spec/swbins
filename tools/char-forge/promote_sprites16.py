# -*- coding: utf-8 -*-
"""
K-0138 — 다 구운 16방향·동작별 시트(`_out/sprites16/<id>/`, data/sprite_plan_16.json)를 정본 `saga-assets/characters/sprites2d16/<id>/` 로 올린다.
웹 배치는 그 다음 `py tools/asset-place/place.py --write --item characters-sprites2d16`(→ saga-web/shared/assets/characters2d16, 웹 sheetspec.js 가 sheet.json 을 읽는다).

    py tools/char-forge/promote_sprites16.py            # 올릴 것만 센다(쓰지 않음)
    py tools/char-forge/promote_sprites16.py --write    # sheet.json 이 있는(다 구운) 인물만, 바뀐 파일만 복사 — 멱등

올리는 것: `<역할>.webp`(sheet.json roles) + sheet.json + manifest.json. bake.log 는 안 올린다.
출처: 같은 인물의 8방향 정본 `sprites2d8/<id>/<id>.license.json` 을 이어받아(몸·무기 같음) 동작 출처(CMU 모캡 K-0139)만 더한다.
8방향 출처가 없는 인물은 건너뛰고 알린다. 굽는 도중(sheet.json 없음)인 인물은 손대지 않는다.
"""
import hashlib
import json
import os
import shutil
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
SRC = os.path.join(ROOT, 'tools', 'char-forge', '_out', 'sprites16')
OLD = os.path.join(ROOT, 'saga-assets', 'characters', 'sprites2d8')
DST = os.path.join(ROOT, 'saga-assets', 'characters', 'sprites2d16')
MOCAP_LIC = 'saga-assets/characters/anim-src/mocap/vroid_mocap_anims.license.json'


def md5(p):
    with open(p, 'rb') as f:
        return hashlib.md5(f.read()).hexdigest()


def license_for(pid, sj):
    old = os.path.join(OLD, pid, pid + '.license.json')
    if not os.path.exists(old):
        return None
    lic = json.load(open(old, encoding='utf-8'))
    lic['id'] = pid + '_sprites2d16'
    lic['generator'] = 'tools/char-forge/bake_sprite_batch.py(data/sprite_plan_16.json) + gear_sprites.py + weapon_attach.py (K-0138 16방향, 몸·무기는 8방향과 같음)'
    clips = json.load(open(os.path.join(SRC, pid, 'manifest.json'), encoding='utf-8')).get('clipmap') or {}
    lic['motion'] = {'mocap': sorted(v for v in clips.values() if v.startswith('m.')), 'mocap_license': MOCAP_LIC + ' (CMU 모캡 — 자유 사용, K-0139)',
                     'body_anims': sorted(v for v in clips.values() if not v.startswith('m.'))}
    return json.dumps(lic, ensure_ascii=False, indent=1) + '\n'


def main():
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass
    write = '--write' in sys.argv
    ids = sorted(i for i in os.listdir(SRC) if os.path.exists(os.path.join(SRC, i, 'sheet.json'))) if os.path.isdir(SRC) else []
    new = changed = same = 0
    nolic, kb = [], {}
    for pid in ids:
        sd, dd = os.path.join(SRC, pid), os.path.join(DST, pid)
        sj = json.load(open(os.path.join(sd, 'sheet.json'), encoding='utf-8'))
        lic = license_for(pid, sj)
        if lic is None:
            nolic.append(pid)
            continue
        files = [r + '.webp' for r in sj['roles']] + ['sheet.json', 'manifest.json']
        if any(not os.path.exists(os.path.join(sd, f)) for f in files):
            continue                                                # 역할 그림이 덜 구워짐
        kb[pid] = sum(os.path.getsize(os.path.join(sd, f)) for f in files) / 1024
        diff = [f for f in files if not os.path.exists(os.path.join(dd, f)) or md5(os.path.join(sd, f)) != md5(os.path.join(dd, f))]
        lp = os.path.join(dd, pid + '.license.json')
        lic_diff = not os.path.exists(lp) or open(lp, encoding='utf-8').read() != lic
        if not diff and not lic_diff:
            same += 1
            continue
        if os.path.isdir(dd):
            changed += 1
        else:
            new += 1
        if write:
            os.makedirs(dd, exist_ok=True)
            for f in diff:
                shutil.copyfile(os.path.join(sd, f), os.path.join(dd, f))
            if lic_diff:
                with open(lp, 'w', encoding='utf-8', newline='\n') as fh:
                    fh.write(lic)
    print(('올림' if write else '올릴 것') + f' 새 {new} · 바뀜 {changed} · 같음 {same} · 다 구운 인물 {len(ids)}' +
          (f' · 8방향 출처 없어 건너뜀 {len(nolic)}: {", ".join(nolic[:8])}' if nolic else ''))
    if kb:
        print(f'받는 양: 인물당 평균 {sum(kb.values()) / len(kb):.0f}KB · 최대 {max(kb.values()):.0f}KB({max(kb, key=kb.get)}) · 합계 {sum(kb.values()) / 1024:.1f}MB')
    return 0


if __name__ == '__main__':
    sys.exit(main())
