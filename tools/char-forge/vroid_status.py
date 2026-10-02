"""VRoid 대량 들이기 진행표 (K-0022) — 인물 id × 단계 표와 요약.

  py tools/char-forge/vroid_status.py               요약 + 진행 중·완료인 줄(명단 대기는 묶어서)
  py tools/char-forge/vroid_status.py --all         명단 299 전부
  py tools/char-forge/vroid_status.py --missing     VRM 이 아직 없는 명단 id(사람이 만들어 줄 것)
  py tools/char-forge/vroid_status.py --json        _out/vroid/status.json 도 쓴다

행 = 명단(data/roster.json 299) + `_in/vroid/` 의 새 id + 이미 Godot 에 들어간 VRoid 몸(`saga-godot/assets/characters_vroid`).
단계(왼쪽부터): vrm(원본) · glb(GLB 사본) · anim(CC0 동작 8 굽기+검증) · web(웹용 경량 GLB) · 2d(스프라이트 시트)
  vrm  = _in/vroid/<id>.vrm  또는 Godot 폴더에 <id>.vrm|glb 가 있다
  glb  = _out/vroid/<id>/<id>.glb  또는 Godot <id>.glb
  anim = _out/vroid/<id>/<id>_anims.glb + verify.ok  또는 Godot anim_cc0/<id>_lib.res
  web  = _out/vroid/<id>/web/<id>.glb
  2d   = _out/sprites/<id>/manifest.json
명단(roster) 인물은 id = roster id(예: sg_guanyu) 의 .vrm 을 `_in/vroid/` 에 놓으면 vroid_batch.sh 가 이어서 처리한다. VRM 원본·산출은 git 밖.
"""
import glob
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
IN_DIR = os.path.join(HERE, '_in', 'vroid')
OUT_DIR = os.path.join(HERE, '_out', 'vroid')
SPR_DIR = os.path.join(HERE, '_out', 'sprites')
GODOT = os.path.join(ROOT, 'saga-godot', 'assets', 'characters_vroid')
STAGES = ('vrm', 'glb', 'anim', 'web', '2d')


def exists(*p):
    return os.path.exists(os.path.join(*p))


def stages_of(i):
    o = os.path.join(OUT_DIR, i)
    g = {
        'vrm': exists(IN_DIR, i + '.vrm') or exists(GODOT, i + '.vrm') or exists(GODOT, i + '.glb'),
        'glb': exists(o, i + '.glb') or exists(GODOT, i + '.glb'),
        'anim': (exists(o, i + '_anims.glb') and exists(o, 'verify.ok')) or exists(GODOT, 'anim_cc0', i + '_lib.res'),
        'web': exists(o, 'web', i + '.glb') or exists(ROOT, 'saga-web', 'saga-go', 'assets', 'models', 'people', 'anime', i.lower().replace('avatarsample', 'avatar_sample') + '.glb'),
        '2d': exists(SPR_DIR, i, 'manifest.json'),
    }
    return g


def load_rows():
    roster = json.load(open(os.path.join(HERE, 'data', 'roster.json'), encoding='utf-8'))['heroes']
    rows, seen = [], set()
    for h in roster:
        rows.append({'id': h['id'], 'group': 'roster', 'name': h.get('name', ''), 'src': h.get('src', '')})
        seen.add(h['id'])
    for p in sorted(glob.glob(os.path.join(IN_DIR, '*.vrm'))):
        i = os.path.splitext(os.path.basename(p))[0]
        if i not in seen:
            rows.append({'id': i, 'group': 'new', 'name': '', 'src': '_in'})
            seen.add(i)
    for p in sorted(glob.glob(os.path.join(GODOT, '*.glb'))):
        i = os.path.splitext(os.path.basename(p))[0]
        if i not in seen:
            rows.append({'id': i, 'group': 'existing', 'name': '', 'src': 'godot'})
            seen.add(i)
    for r in rows:
        r['stages'] = stages_of(r['id'])
        n = sum(r['stages'].values())
        r['state'] = 'done' if n == len(STAGES) else ('wip' if n else 'wait')
    return rows


def mark(b):
    return 'o' if b else '.'


def main():
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass
    a = sys.argv[1:]
    rows = load_rows()
    cnt = {'done': 0, 'wip': 0, 'wait': 0}
    for r in rows:
        cnt[r['state']] += 1
    if '--missing' in a:
        miss = [r for r in rows if not r['stages']['vrm'] and r['group'] == 'roster']
        for r in miss:
            print('%-24s %s %s' % (r['id'], r['src'], r['name']))
        print('VROID_MISSING %d' % len(miss))
        return 0
    show = rows if '--all' in a else [r for r in rows if r['state'] != 'wait' or r['group'] != 'roster']
    print('%-26s %-9s %s   %s' % ('id', '묶음', ' '.join(s.rjust(4) for s in STAGES), '상태'))
    for r in show:
        print('%-26s %-9s %s   %s' % (r['id'], r['group'], ' '.join(mark(r['stages'][s]).rjust(4) for s in STAGES), r['state']))
    roster_wait = sum(1 for r in rows if r['group'] == 'roster' and r['state'] == 'wait')
    if '--all' not in a and roster_wait:
        print('... 명단 대기 %d명(VRM 아직 없음) — --all 또는 --missing' % roster_wait)
    print('VROID_STATUS 완료 %d · 진행 %d · 대기 %d (행 %d, 명단 %d)' % (cnt['done'], cnt['wip'], cnt['wait'], len(rows), sum(1 for r in rows if r['group'] == 'roster')))
    if '--json' in a:
        os.makedirs(OUT_DIR, exist_ok=True)
        json.dump({'counts': cnt, 'rows': rows}, open(os.path.join(OUT_DIR, 'status.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    return 0


if __name__ == '__main__':
    sys.exit(main())
