# -*- coding: utf-8 -*-
"""
K-0029 단계 5 — 다 구운 8방향 무기 시트(`_out/sprites8/<id>/`, run_combat_sprites.sh)를 정본 `saga-assets/characters/sprites2d8/<id>/` 로 올린다.
웹 배치는 그 다음 `py tools/asset-place/place.py --write --item characters-sprites2d8`(→ saga-web/shared/assets/characters2d8).

    py tools/char-forge/promote_sprites8.py            # 올릴 것만 센다(쓰지 않음)
    py tools/char-forge/promote_sprites8.py --write    # manifest.json 이 있는(다 구운) 인물만, 바뀐 파일만 복사 — 멱등

올리는 것: `<역할>.webp` 8개 + manifest.json. bake.log 는 안 올린다.
출처: 같은 인물의 옛 2D 시트 `sprites2d/<id>/<id>.license.json`(옷 이식 VRoid 샘플 — 상업·재배포 허용)을 이어받아
`<id>.license.json` 을 새로 쓴다(credits.py·audit.py 가 읽는다). 옛 출처가 없는 인물은 건너뛰고 알린다.
굽는 도중(manifest 없음)인 인물은 손대지 않는다 — 굽기와 나란히 몇 번이고 돌려도 된다.

    py tools/char-forge/promote_sprites8.py --town [--write]   # K-0083 마을 사람 맨손 시트(`_out/sprites8_town/<id>/`, data/town_sprite_plan.json)
      idle_town·walk_town.webp 둘만 정본 인물 폴더에 더하고 정본 manifest 에 `town`·`town_clipmap` 칸만 넣는다 — 전투 시트·출처는 안 건드린다.
      정본 폴더(전투 시트)가 아직 없는 인물은 건너뛴다(manifest 를 새로 만들지 않는다).
"""
import hashlib
import json
import os
import shutil
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
SRC = os.path.join(ROOT, 'tools', 'char-forge', '_out', 'sprites8')
OLD = os.path.join(ROOT, 'saga-assets', 'characters', 'sprites2d')
DST = os.path.join(ROOT, 'saga-assets', 'characters', 'sprites2d8')


def md5(p):
    with open(p, 'rb') as f:
        return hashlib.md5(f.read()).hexdigest()


def license_for(pid, man):
    old = os.path.join(OLD, pid, pid + '.license.json')
    if not os.path.exists(old):
        return None
    lic = json.load(open(old, encoding='utf-8'))
    lic['id'] = pid + '_sprites2d8'
    lic['generator'] = 'tools/char-forge/bake_sprite_batch.py + gear_sprites.py + weapon_attach.py (K-0029 단계 5, 몸은 ' + lic.get('generator', '') + ')'
    lic['note'] = (lic.get('note', '') + ' 8방향 무기 시트: 무기 ' + str(man.get('weapon')) + '(절차 생성 모형, 자체)·동작 ' +
                   ', '.join(sorted(set((man.get('clipmap') or {}).values()))) + '(CC0 UAL + 자체 CF_*).').strip()
    return json.dumps(lic, ensure_ascii=False, indent=1) + '\n'


def town(write):
    """K-0083 — 맨손 평상 시트 둘을 정본에 더한다(전투 manifest 는 칸만 더함)."""
    src = os.path.join(ROOT, 'tools', 'char-forge', '_out', 'sprites8_town')
    ids = sorted(i for i in os.listdir(src) if os.path.exists(os.path.join(src, i, 'manifest.json'))) if os.path.isdir(src) else []
    add = same = 0
    skip = []
    for pid in ids:
        sd, dd = os.path.join(src, pid), os.path.join(DST, pid)
        dm = os.path.join(dd, 'manifest.json')
        if not os.path.exists(dm):
            skip.append(pid)
            continue
        tm = json.load(open(os.path.join(sd, 'manifest.json'), encoding='utf-8'))
        roles = [r for r in tm.get('clips', []) if os.path.exists(os.path.join(sd, r + '.webp'))]
        man = json.load(open(dm, encoding='utf-8'))
        diff = [r for r in roles if not os.path.exists(os.path.join(dd, r + '.webp')) or md5(os.path.join(sd, r + '.webp')) != md5(os.path.join(dd, r + '.webp'))]
        man_new = dict(man, town=roles, town_clipmap=tm.get('clipmap') or {})
        if not diff and man_new == man:
            same += 1
            continue
        add += 1
        if write:
            for r in diff:
                shutil.copyfile(os.path.join(sd, r + '.webp'), os.path.join(dd, r + '.webp'))
            with open(dm, 'w', encoding='utf-8', newline='\n') as fh:
                fh.write(json.dumps(man_new, ensure_ascii=False, indent=1))
    print(('올림' if write else '올릴 것') + f' 마을 시트 {add} · 같음 {same} · 다 구운 인물 {len(ids)}' + (f' · 정본 전투 시트 없어 건너뜀 {len(skip)}' if skip else ''))
    return 0


def main():
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass
    write = '--write' in sys.argv
    if '--town' in sys.argv:
        return town(write)
    ids = sorted(i for i in os.listdir(SRC) if os.path.exists(os.path.join(SRC, i, 'manifest.json'))) if os.path.isdir(SRC) else []
    new = changed = same = 0
    nolic = []
    for pid in ids:
        sd, dd = os.path.join(SRC, pid), os.path.join(DST, pid)
        man = json.load(open(os.path.join(sd, 'manifest.json'), encoding='utf-8'))
        lic = license_for(pid, man)
        if lic is None:
            nolic.append(pid)
            continue
        files = [f for f in os.listdir(sd) if f.endswith('.webp') or f == 'manifest.json']
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
          (f' · 옛 출처 없어 건너뜀 {len(nolic)}: {", ".join(nolic[:8])}' if nolic else ''))
    return 0


if __name__ == '__main__':
    sys.exit(main())
