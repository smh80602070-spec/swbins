# -*- coding: utf-8 -*-
"""
에셋 배치 — 정본 `saga-assets/` 한 곳에서 세 트랙(웹·Godot·Unity) 폴더로 **배포만** 한다(K-0019).
웹·고돗·유니티 갈래는 에셋을 안 고친다 — 에셋은 여기서만 들어간다.

    py tools/asset-place/place.py            # = --check : 등록된 배포 대상이 정본과 같은지(내용 md5) 본다
    py tools/asset-place/place.py --write    # 빠졌거나 다른 파일만 정본에서 복사한다(두 번째 실행은 아무것도 안 한다)
    py tools/asset-place/place.py --item bgm # 한 항목만
    py tools/asset-place/place.py --write --engine godot|unity|all   # 부속(.import/.meta)이 빠진 트랙만 엔진을 한 번 불러 만든다
      (엔진 실행 파일: 환경변수 GODOT·UNITY 또는 자동 탐색. 엔진이 이미 떠 있으면 다른 세션 것일 수 있어 건너뛴다. --dry-engine 은 명령만 보여 준다)

등록 표: tools/asset-place/asset-place.json — 항목마다 정본 폴더(src)·포함 패턴(include)·대상 목록(targets).
  대상 한 개 = {track, dir, rename?(정본 이름 → 대상 이름, 있으면 그 파일만), only?(정본 하위 폴더 이름 목록), sidecar?}
  sidecar(.import·.meta)는 엔진이 만드는 부속 파일이라 **비교하지 않고** 빠진 개수만 알려 준다
  (Godot `godot --headless --import`·Unity `unity-batch.sh` 가 만든다 — 이 PC 에 엔진이 없으면 그 세션에서).
종료 코드: --check 에서 빠짐·다름이 있으면 1. 의존 없음(표준 라이브러리).
"""
import fnmatch
import hashlib
import json
import os
import glob
import shutil
import subprocess
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
MANIFEST = os.path.join(ROOT, 'tools', 'asset-place', 'asset-place.json')


TEXT_EXT = ('.json', '.md', '.txt', '.cfg')


def md5(p):
    """내용 md5. 글 파일(json 등)은 줄바꿈(CRLF/LF) 차이를 무시한다 - 체크아웃 설정에 따라 달라지는 값이라."""
    h = hashlib.md5()
    with open(p, 'rb') as f:
        data = f.read()
    if p.lower().endswith(TEXT_EXT):
        data = data.replace(bytes([13, 10]), bytes([10]))
    h.update(data)
    return h.hexdigest()


def canon_files(src, include, recursive, only):
    """정본 폴더의 (상대경로) 목록."""
    base = os.path.join(ROOT, src)
    out = []
    if recursive:
        for dp, _dn, fns in os.walk(base):
            rel_dir = os.path.relpath(dp, base).replace('\\', '/')
            if only is not None and rel_dir.split('/')[0] not in only:
                continue
            for fn in fns:
                if any(fnmatch.fnmatch(fn, pat) for pat in include):
                    out.append(fn if rel_dir == '.' else rel_dir + '/' + fn)
    else:
        for fn in os.listdir(base):
            if os.path.isfile(os.path.join(base, fn)) and any(fnmatch.fnmatch(fn, pat) for pat in include):
                out.append(fn)
    return sorted(out)


def plan(item):
    """[(정본 절대경로, 대상 절대경로, track, dir, 상대이름)]"""
    rows = []
    recursive = item.get('recursive', False)
    for t in item['targets']:
        names = canon_files(item['src'], item.get('include', ['*']), recursive, t.get('only'))
        rename = t.get('rename')
        if rename:
            names = [n for n in names if n in rename]
        for n in names:
            dst_name = rename[n] if rename else n
            rows.append((os.path.join(ROOT, item['src'], n), os.path.join(ROOT, t['dir'], dst_name), t['track'], t['dir'], dst_name, t.get('sidecar', [])))
    return rows


def find_exe(track):
    env = os.environ.get('GODOT' if track == 'godot' else 'UNITY')
    if env and os.path.exists(env):
        return env
    pats = {'godot': ['C:/Users/*/AppData/Local/Temp/claude/*/*/scratchpad/godot/*console.exe', 'C:/Program Files/Godot*/*console.exe'],
            'unity': ['C:/Program Files/Unity/Hub/Editor/*/Editor/Unity.exe']}[track]
    found = sorted((f for p in pats for f in glob.glob(p)), key=os.path.getmtime)
    return found[-1] if found else None


def engine_running(track):
    name = 'Unity.exe' if track == 'unity' else 'Godot'
    try:
        out = subprocess.run(['tasklist'], capture_output=True, text=True, timeout=30).stdout
    except Exception:
        return False
    return any(name.lower() in line.lower() for line in out.splitlines())


def run_engine(track, dry):
    """엔진을 한 번 불러 부속을 만든다. 돌렸으면 True, 건너뛰었으면 False."""
    exe = find_exe(track)
    if not exe:
        print('  [%s] 엔진 실행 파일을 못 찾음 - GODOT·UNITY 환경변수를 주거나 그 세션에서 만든다' % track)
        return False
    if engine_running(track) and not dry:
        print('  [%s] 엔진이 이미 실행 중(다른 세션일 수 있음) - 건너뜀, 끝난 뒤 다시' % track)
        return False
    if track == 'godot':
        cmd = [exe, '--headless', '--editor', '--path', os.path.join(ROOT, 'saga-godot'), '--quit']
    else:
        log = os.path.join(ROOT, 'saga-unity', 'Temp', 'asset-place-refresh.log')
        cmd = ['bash', os.path.join(ROOT, 'saga-unity', 'tools', 'unity-batch.sh'), '--', exe, '-batchmode', '-nographics', '-quit',
               '-projectPath', os.path.join(ROOT, 'saga-unity'), '-logFile', log]
    print('  [%s] %s' % (track, ' '.join(cmd)))
    if dry:
        return False
    r = subprocess.run(cmd, stdin=subprocess.DEVNULL, capture_output=True, text=True, timeout=3600)
    print('  [%s] 종료 코드 %d' % (track, r.returncode))
    return r.returncode == 0


def main():
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass
    argv = sys.argv[1:]
    write = '--write' in argv
    only_item = argv[argv.index('--item') + 1] if '--item' in argv else None
    engine = argv[argv.index('--engine') + 1] if '--engine' in argv else None
    dry_engine = '--dry-engine' in argv
    side_by_track = {}
    manifest = json.load(open(MANIFEST, encoding='utf-8'))
    bad = 0
    total = 0
    copied = 0
    for item in manifest['items']:
        if only_item and item['id'] != only_item:
            continue
        rows = plan(item)
        stat = {}
        side_missing = 0
        for src, dst, track, ddir, dname, sidecars in rows:
            total += 1
            key = (track, ddir)
            st = stat.setdefault(key, {'ok': 0, 'missing': 0, 'diff': 0})
            if not os.path.exists(src):
                st['missing'] += 1
                bad += 1
                continue
            if not os.path.exists(dst):
                st['missing'] += 1
                if write:
                    os.makedirs(os.path.dirname(dst), exist_ok=True)
                    shutil.copyfile(src, dst)
                    copied += 1
                else:
                    bad += 1
                continue
            if md5(src) != md5(dst):
                st['diff'] += 1
                if write:
                    shutil.copyfile(src, dst)
                    copied += 1
                else:
                    bad += 1
                continue
            st['ok'] += 1
            for ext in ([] if dst.lower().endswith(TEXT_EXT) else sidecars):
                if not os.path.exists(dst + ext):
                    side_missing += 1
                    side_by_track[track] = side_by_track.get(track, 0) + 1
        print('== %s (%d 대상)' % (item['id'], len({(r[2], r[3]) for r in rows})))
        for (track, ddir), st in sorted(stat.items()):
            flag = 'OK  ' if not st['missing'] and not st['diff'] else ('복사' if write else 'FAIL')
            print('  %s %-6s %-62s 같음 %d · 빠짐 %d · 다름 %d' % (flag, track, ddir, st['ok'], st['missing'], st['diff']))
        if side_missing:
            print('  (부속 .import/.meta 없음 %d: 엔진 세션에서 생성)' % side_missing)
    print('\n파일 %d · %s' % (total, ('복사 %d' % copied) if write else ('불일치 %d' % bad)))
    if engine:
        for tr in (['godot', 'unity'] if engine == 'all' else [engine]):
            n = side_by_track.get(tr, 0)
            if not n:
                print('부속 %s: 빠진 것 0 - 엔진을 부르지 않는다' % tr)
                continue
            print('부속 %s: 빠진 것 %d - 엔진 호출' % (tr, n))
            run_engine(tr, dry_engine)
        print('엔진이 새로 만든 부속은 git status 로 확인해 같이 커밋하고, 엔진이 고쳐 쓴 남의 .import·.uid 는 되돌린다')
    return 1 if (bad and not write) else 0


if __name__ == '__main__':
    sys.exit(main())
