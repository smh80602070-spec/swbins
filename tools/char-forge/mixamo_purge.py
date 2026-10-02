"""Mixamo 제거 도구 (K-0018) — 사용자 결정 2026-10-02 "Mixamo 제거". 지우지 않고 저장소 밖으로 **옮긴다**(되돌릴 수 있다).

  py tools/char-forge/mixamo_purge.py                         # 목록과 크기만(아무것도 안 옮김)
  py tools/char-forge/mixamo_purge.py --group godot --yes     # Godot 쪽(게임이 안 씀)을 옮김
  py tools/char-forge/mixamo_purge.py --group unity --yes     # Unity 쪽 — Unity 가 VRoid 로 배선된 **뒤에만**(아니면 Unity 몸이 전부 사라진다)
  py tools/char-forge/mixamo_purge.py --restore <스탬프>      # 옮긴 것을 원래 자리로
옮기는 곳: C:/_removed_mixamo/<스탬프>/<원래 상대 경로> + manifest.json(복원용). 같은 드라이브면 이름만 바뀌어 순간이다.
묶음(group):
  godot = saga-godot/assets/_mixamo_src · saga-godot/assets/characters_vroid/anim (CC0 동작으로 대체돼 안 씀 — 개발 도구 mixamo_retarget.gd 만 참조)
  unity = saga-unity/Assets/Art/CharactersRealistic(+.meta) (Editor 씬 빌더 12개 파일이 참조 — 배선 뒤에)
다시 받는 법: tools/mixamo_automation (Adobe 로그인은 사람 몫).
"""
import json
import os
import shutil
import sys
import time

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
DEST = 'C:/_removed_mixamo'
GROUPS = {
    'godot': ['saga-godot/assets/_mixamo_src', 'saga-godot/assets/characters_vroid/anim'],
    'unity': ['saga-unity/Assets/Art/CharactersRealistic', 'saga-unity/Assets/Art/CharactersRealistic.meta'],
}


def size_of(p):
    if os.path.isfile(p):
        return os.path.getsize(p), 1
    total, n = 0, 0
    for r, _, fs in os.walk(p):
        for f in fs:
            try:
                total += os.path.getsize(os.path.join(r, f))
                n += 1
            except OSError:
                pass
    return total, n


def main():
    a = sys.argv[1:]
    if '--restore' in a:
        stamp = a[a.index('--restore') + 1]
        base = os.path.join(DEST, stamp)
        man = json.load(open(os.path.join(base, 'manifest.json'), encoding='utf-8'))
        for rel in man['moved']:
            src, dst = os.path.join(base, rel), os.path.join(ROOT, rel)
            if os.path.exists(dst):
                print('이미 있음, 건너뜀:', rel)
                continue
            os.makedirs(os.path.dirname(dst), exist_ok=True)
            shutil.move(src, dst)
            print('복원:', rel)
        return 0
    group = a[a.index('--group') + 1] if '--group' in a else 'all'
    names = GROUPS['godot'] + GROUPS['unity'] if group == 'all' else GROUPS[group]
    go = '--yes' in a
    stamp = time.strftime('%Y%m%d-%H%M%S')
    moved = []
    for rel in names:
        p = os.path.join(ROOT, rel)
        if not os.path.exists(p):
            print('없음:', rel)
            continue
        sz, n = size_of(p)
        print('%s  %.1f MB · %d파일' % (rel, sz / 1048576, n))
        if go:
            dst = os.path.join(DEST, stamp, rel)
            os.makedirs(os.path.dirname(dst), exist_ok=True)
            shutil.move(p, dst)
            moved.append(rel)
    if go and moved:
        json.dump({'stamp': stamp, 'moved': moved}, open(os.path.join(DEST, stamp, 'manifest.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
        print('MIXAMO_PURGE 옮김 %d → %s/%s  (복원: py tools/char-forge/mixamo_purge.py --restore %s)' % (len(moved), DEST, stamp, stamp))
    elif not go:
        print('(목록만 — 옮기려면 --yes)')
    return 0


if __name__ == '__main__':
    sys.exit(main())
