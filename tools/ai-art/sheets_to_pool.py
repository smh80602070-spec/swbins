"""K-0205 — 일러스트 시트 묶음(폴더 또는 zip) → 2D 인물 풀 한 명을 자동으로 만든다.

  py tools/ai-art/sheets_to_pool.py --id elf_002 --src <폴더 또는 .zip> [--games dungeon,go,forest,story] [--out <풀 폴더>] [--dry]

입력 규격(엘프 `SAGA_Character_001` 묶음과 같다): 이미지 한 장 = 동작 하나 × 방향 하나, 안에 8프레임(가로 4 × 세로 2).
  파일 이름 `<접두사><방향>_<동작>_8프레임.png` — 방향 앞·앞오른쪽·뒤오른쪽·뒤, 옆(오른쪽)은 방향 글자 없이 `<접두사><동작>_8프레임.png`
  (`오른쪽_<동작>`·`옆모습_<동작>` 도 받는다). 왼쪽 방향은 안 쓴다 — 게임이 오른쪽 그림을 뒤집는다. 접두사는 자동으로 찾는다.
  동작 이름은 아래 MOTIONS(한글 → 게임이 읽는 클립). 서있기(옆) 한 장이 키·발 기준 — 한 인물 모든 동작에 같은 배율·위치.
처리: 배경 따기(윤곽선 방식 — 글로우·흰 머리에 색 기준은 실패) → 한 배율로 192칸에 놓기(몸 150px · 발 88%) → 방향 5행 × 프레임 8열 webp → manifest.
등록: --out 기본 saga-web/saga-dungeon/assets/sprites2d_sheets/<id>. --games 를 주면 그 판들에 풀 폴더를 복사하고 index.json factory 와 core.js poolH 에 올린다.
  (주인공·동료 자리에 붙이는 건 판 `core.js` `pools.me`·`pools.ally` — 사람이 정한다. 이 도구는 붙이지 않는다.)
없는 동작은 건너뛰고 manifest `missing` 에 적는다. 서있기가 없으면 멈춘다.
"""
import argparse
import collections
import glob
import json
import os
import re
import sys
import tempfile
import time
import zipfile
from multiprocessing import Pool

import numpy as np
from PIL import Image
from scipy import ndimage as ndi

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
WEB = os.path.join(ROOT, 'saga-web')
PX, BODY, FOOT = 192, 150, 0.88
DIRS = [('front', '앞'), ('front_side', '앞오른쪽'), ('side', None), ('back_side', '뒤오른쪽'), ('back', '뒤')]
DIR_WORDS = ['앞오른쪽', '뒤오른쪽', '앞왼쪽', '뒤왼쪽', '오른쪽', '왼쪽', '옆모습', '앞', '뒤']
# (파일 동작 이름, 클립, fps, 반복)
MOTIONS = [('서있기', 'idle', 6, True), ('걷기', 'walk', 10, True), ('달리기', 'run', 12, True),
           ('한손검공격', 'attack', 14, False), ('활공격', 'attack2', 12, False), ('시전', 'cast', 12, False),
           ('죽기', 'death', 8, False), ('넘어짐', 'knockdown', 10, False), ('앉기', 'sit', 8, False),
           ('대화하기', 'talk', 6, True), ('막기', 'block', 10, False),
           ('맞기', 'hit', 12, False), ('양손검공격', 'heavy', 11, False),
           ('검방패공격', 'attack_shield', 14, False), ('단검공격', 'attack_dagger', 16, False),
           ('양손단검공격', 'attack_dagger2', 16, False), ('주먹공격', 'attack_fist', 14, False),
           ('다리공격', 'attack_kick', 14, False), ('지팡이공격', 'attack_staff', 12, False),
           ('한손총공격', 'attack_gun', 12, False), ('양손총공격', 'attack_gun2', 12, False)]
POST = '_8프레임.png'


def unzip(path):
    """zip → 새 빈 폴더(신뢰 안 하는 압축 — 경로 이탈 막고 한글 이름 복구)."""
    out = tempfile.mkdtemp(prefix='sheets_')
    with zipfile.ZipFile(path) as z:
        for zi in z.infolist():
            name = zi.filename
            if not (zi.flag_bits & 0x800):
                try:
                    name = name.encode('cp437').decode('cp949')
                except Exception:
                    pass
            name = name.replace('\\', '/')
            if name.endswith('/') or '..' in name.split('/'):
                continue
            dst = os.path.join(out, os.path.basename(name))
            with z.open(zi) as f, open(dst, 'wb') as g:
                g.write(f.read())
    return out


def find_prefix(src):
    """`…서있기_8프레임.png` 파일들에서 접두사(방향 글자 뗀)를 센다 — 가장 많은 것."""
    cnt = collections.Counter()
    for p in glob.glob(os.path.join(src, '*서있기' + POST)):
        stem = os.path.basename(p)[:-len('서있기' + POST)]
        for w in DIR_WORDS:
            if stem.endswith(w + '_'):
                stem = stem[:-len(w) - 1]
                break
        cnt[stem] += 1
    return cnt.most_common(1)[0][0] if cnt else None


def find(src, pre, dname, motion):
    cands = [dname + '_' + motion] if dname else [motion, '오른쪽_' + motion, '옆모습_' + motion]
    for c in cands:
        p = os.path.join(src, pre + c + POST)
        if os.path.exists(p):
            return p
    return None


def matte(a):
    ch = [ndi.gaussian_filter(a[..., c], 1.0) for c in range(3)]
    gc = sum(np.hypot(ndi.sobel(x, 0), ndi.sobel(x, 1)) for x in ch)
    e = ndi.binary_closing(gc > 60, structure=np.ones((3, 3)), iterations=5)
    fg = ndi.binary_fill_holes(e)
    lab, n = ndi.label(fg)
    if n == 0:
        return np.dstack([a, np.zeros(a.shape[:2])]).astype(np.uint8)
    s = ndi.sum(fg, lab, range(1, n + 1))
    fg = lab == (1 + int(np.argmax(s)))
    fg = ndi.binary_opening(ndi.binary_erosion(fg, iterations=3), iterations=2)
    return np.dstack([a, ndi.gaussian_filter(fg.astype(float), 1.0) * 255]).astype(np.uint8)


def cells(path):
    im = Image.open(path).convert('RGB')
    cw, ch = im.width // 4, im.height // 2
    return [im.crop(((i % 4) * cw, (i // 4) * ch, (i % 4 + 1) * cw, (i // 4 + 1) * ch)) for i in range(8)]


def place(rgba, scale, gx, gy):
    im = Image.fromarray(rgba, 'RGBA')
    w, h = im.size
    im = im.resize((max(1, round(w * scale)), max(1, round(h * scale))), Image.LANCZOS)
    canvas = Image.new('RGBA', (PX, PX))
    canvas.paste(im, (round(PX / 2 - gx * scale), round(PX * FOOT - gy * scale)), im)
    return canvas


def job(args):
    key, path, scale, gx, gy = args
    fr = [place(matte(np.asarray(c).astype(float)), scale, gx, gy) for c in cells(path)]
    return key, [np.asarray(f) for f in fr]


def ys(rgba):
    y = np.where(rgba[..., 3] > 128)[0]
    return y.min(), y.max()


def insert_crlf_safe(path, old, new, once=True):
    b = open(path, 'rb').read()
    if new.encode() in b:
        return False
    assert b.count(old.encode()) == 1, (path, old)
    open(path, 'wb').write(b.replace(old.encode(), new.encode()))
    return True


def register(pid, pool_dir, games):
    for g in games:
        gd = os.path.join(WEB, 'saga-' + g)
        dst = os.path.join(gd, 'assets', 'sprites2d_sheets', pid)
        if os.path.abspath(dst) != os.path.abspath(pool_dir):
            os.makedirs(dst, exist_ok=True)
            for f in os.listdir(pool_dir):
                with open(os.path.join(pool_dir, f), 'rb') as a, open(os.path.join(dst, f), 'wb') as b:
                    b.write(a.read())
        ix = os.path.join(gd, 'assets', 'sprites2d_sheets', 'index.json')
        b = open(ix, 'rb').read()
        if ('"%s"' % pid).encode() not in b:
            m = re.search(rb'"factory": \[(\r?\n)(\s*)', b)
            assert m, ix
            b = b[:m.end()] + ('"%s",' % pid).encode() + m.group(1) + m.group(2) + b[m.end():]
            open(ix, 'wb').write(b)
        core = os.path.join(gd, 'js', 'core.js')
        cb = open(core, 'rb').read()
        if re.search(rb'poolH: \{[^}]*\b%s:' % pid.encode(), cb) is None:
            m = re.search(rb'poolH: \{ ', cb)
            if m:
                open(core, 'wb').write(cb[:m.end()] + ('%s: %d, ' % (pid, BODY)).encode() + cb[m.end():])
            else:
                print('  ! %s core.js 에 poolH 줄이 없다 — 손으로 `%s: %d` 추가' % (g, pid, BODY))
        print('  등록', g)


def build_one(a):
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass
    t0 = time.time()
    src = unzip(a.src) if a.src.lower().endswith('.zip') else a.src
    pre = find_prefix(src)
    if pre is None:
        print('서있기 그림을 못 찾았다(`…서있기_8프레임.png`) — 멈춤'); return None
    print('접두사', repr(pre))
    plan, missing = {}, []
    for m, clip, fps, loop in MOTIONS:
        have = 0
        for r, (dn, dk) in enumerate(DIRS):
            p = find(src, pre, dk, m)
            if p:
                plan[(clip, r)] = p; have += 1
        if not have:
            missing.append(clip)
    if ('idle', 2) not in plan:
        print('옆모습 서있기가 없다 — 키·발 기준을 못 정해 멈춤'); return None
    print('시트', len(plan), '장 · 없는 동작', missing or '없음')
    if a.dry:
        return 0
    ref = matte(np.asarray(cells(plan[('idle', 2)])[0]).astype(float))
    y0, y1 = ys(ref)
    scale = BODY / (y1 - y0 + 1)
    gx = ref.shape[1] / 2
    print('기준 키', y1 - y0 + 1, 'px · 배율', round(scale, 4))
    tasks = [((c, r), p, scale, gx, y1) for (c, r), p in plan.items()]
    res = {}
    with Pool(a.procs) as pool:
        for n, (key, fr) in enumerate(pool.imap_unordered(job, tasks), 1):
            res[key] = fr
            if n % 20 == 0:
                print(' ', n, '/', len(tasks), int(time.time() - t0), 's', flush=True)
    out = a.out or os.path.join(WEB, 'saga-dungeon', 'assets', 'sprites2d_sheets', a.id)
    os.makedirs(out, exist_ok=True)
    clips = {}
    for m, clip, fps, loop in MOTIONS:
        sheet = Image.new('RGBA', (PX * 8, PX * 5))
        have = 0
        for r in range(5):
            if (clip, r) in res:
                have += 1
                for i, f in enumerate(res[(clip, r)]):
                    sheet.paste(Image.fromarray(f, 'RGBA'), (i * PX, r * PX))
        if have:
            sheet.save(os.path.join(out, clip + '.webp'), quality=88)
            clips[clip] = {'frames': 8, 'fps': fps, 'loop': loop, 'file': clip + '.webp'}
    manifest = {'id': a.id, 'px': PX, 'dirs': [0, 1, 2, 3, 4], 'dir_names': [d for d, _ in DIRS], 'ndir': 8, 'mirror': True,
                'side_faces': 'right', 'layout': '가로 = 프레임, 세로 = 방향(dirs 순서)', 'foot': FOOT, 'clips': clips,
                'missing': missing, 'body': 'sheets_to_pool.py (일러스트 시트 %d장)' % len(plan),
                'note': '무기별 공격(attack_*)은 게임이 아직 안 읽음 — attack·attack2·heavy 만 읽는다'}
    tpl = os.path.join(WEB, 'saga-dungeon', 'assets', 'sprites2d_sheets', 'elf_001', 'manifest.json')
    if os.path.exists(tpl):   # 칸 규칙(foot·mirror 등)은 엘프 풀과 같아야 한다 — 템플릿 값이 있으면 그걸 우선
        t = json.load(open(tpl, encoding='utf-8'))
        for k, v in t.items():
            if k not in ('id', 'clips', 'missing', 'body', 'note'):
                manifest[k] = v
    json.dump(manifest, open(os.path.join(out, 'manifest.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    # 미리보기: 모션 한 줄 × 오른쪽 8프레임, 방향 5칸
    S = 96
    names = [c for c in clips]
    big = Image.new('RGB', (S * 13, S * len(names)), (60, 70, 60))
    for ri, c in enumerate(names):
        for i in range(8):
            if (c, 2) in res:
                im = Image.fromarray(res[(c, 2)][i], 'RGBA').resize((S, S), Image.LANCZOS); big.paste(im, (i * S, ri * S), im)
        for r in range(5):
            if (c, r) in res:
                im = Image.fromarray(res[(c, r)][3], 'RGBA').resize((S, S), Image.LANCZOS); big.paste(im, ((8 + r) * S, ri * S), im)
    prev = os.path.join(ROOT, 'tools', 'ai-art', '_out', 'pool_preview_%s.png' % a.id)
    os.makedirs(os.path.dirname(prev), exist_ok=True)
    big.save(prev)
    print('풀', out, '· 동작', len(clips), '· 방향 5 ·', int(time.time() - t0), 's')
    games = [g for g in a.games.split(',') if g]
    if games:
        register(a.id, out, games)
    print('끝 — 미리보기', prev)
    return 0




def ascii_id(name):
    s = re.sub(r'[^a-z0-9]+', '_', os.path.splitext(name)[0].lower()).strip('_')
    return s or None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--id')
    ap.add_argument('--src')
    ap.add_argument('--batch', help='상위 폴더 — 안의 하위 폴더·zip 하나가 인물 한 명(이름 순). id 는 --ids 순서대로, 없으면 이름의 영문·숫자')
    ap.add_argument('--ids', default='', help='--batch 용 id 목록(쉼표, 하위 항목 이름순과 같은 순서)')
    ap.add_argument('--out', help='풀 폴더(--batch 일 땐 상위 폴더 — 그 안에 id 별로)')
    ap.add_argument('--games', default='')
    ap.add_argument('--dry', action='store_true')
    ap.add_argument('--procs', type=int, default=4)
    a = ap.parse_args()
    if a.batch:
        items = sorted(os.path.join(a.batch, n) for n in os.listdir(a.batch)
                       if os.path.isdir(os.path.join(a.batch, n)) or n.lower().endswith('.zip'))
        ids = [x for x in a.ids.split(',') if x]
        if ids and len(ids) != len(items):
            print('--ids %d 개 ≠ 하위 항목 %d 개 — 멈춤: %s' % (len(ids), len(items), [os.path.basename(x) for x in items])); return 1
        rows = []
        for n, it in enumerate(items):
            pid = ids[n] if ids else ascii_id(os.path.basename(it))
            if not pid:
                print('id 를 못 정함(--ids 로 주세요):', os.path.basename(it)); return 1
            rows.append((pid, it))
        if len({r[0] for r in rows}) != len(rows):
            print('id 가 겹친다 — --ids 로 주세요'); return 1
        res = []
        for pid, it in rows:
            print('=== %s ← %s' % (pid, os.path.basename(it)), flush=True)
            b = argparse.Namespace(id=pid, src=it, out=os.path.join(a.out, pid) if a.out else None, games=a.games, dry=a.dry, procs=a.procs)
            try:
                r = build_one(b)
            except Exception as e:   # 한 명이 깨져도 나머지는 돈다
                print('  실패:', e); r = None
            res.append((pid, r == 0))
        print('--- 요약: 성공 %d · 실패 %d' % (sum(1 for _, ok in res if ok), sum(1 for _, ok in res if not ok)))
        for pid, ok in res:
            print('  ', 'ok  ' if ok else 'FAIL', pid)
        return 0 if all(ok for _, ok in res) else 1
    if not (a.id and a.src):
        ap.error('--id 와 --src 를, 또는 --batch 를 주세요')
    return 0 if build_one(a) == 0 else 1


if __name__ == '__main__':
    sys.exit(main())
