"""K-0133 — 뼈 심은 짐승을 고친 creature_rig.py(다리뼈 판정)로 다시 심고 정본까지 올리는 한 명령.
  py tools/ai-art/remote3d/rerig.py --kinds quad,bird [--ids a,b] [--phase rig|fix|compress|promote|render|all] [--sheet]

어디서 읽나: 대상 표 k96_targets.json 의 rig 칸(quad·bird·worm). 종마다 fin/<id>.glb 가 있는 **가장 최근 묶음**(폴더 mtime)을 입력으로.
단계: rig(Blender, <묶음>/rig2/<id>.glb — 있으면 건너뜀) → fix(creature_fix.py, 압축 전 PNG 결에 — license 는 묶음 것을 옆에 복사)
   → compress(compress.mjs <묶음>/rig2 — Meshopt·WebP, asset.extras 의 고침 표시가 남는지 한 번 확인했다 10-17) → promote(promote.py --rig … --write)
   → render(눈 판정: 쉼 + Walk 0.3 두 컷, tools/_out/creature_rig/k133/<id>_rest.png·_walk.png, --sheet 면 한 장으로).
그 뒤 사람이(Claude 눈) 시트를 보고 → `py tools/asset-place/place.py --write --item creatures3d` · `py tools/asset-audit/credits.py`.
벌레(worm)는 다리뼈 판정과 무관하니 기본에서 뺀다. Blender 는 CPU 만 쓴다(SD 사슬과 겹쳐도 됨).
"""
import glob
import json
import os
import shutil
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
OUT3D = os.path.join(ROOT, 'tools', 'ai-art', '_out', 'remote3d')
SHEET = os.path.join(ROOT, 'tools', '_out', 'creature_rig', 'k133')
BLENDER = os.environ.get('BLENDER', r'C:\Program Files\Blender Foundation\Blender 5.2\blender.exe')
RIG = os.path.join(ROOT, 'tools', 'asset-forge', 'creature_rig.py')
RENDER = os.path.join(ROOT, 'tools', 'asset-forge', 'render_glb_check.py')
FIX = os.path.join(ROOT, 'tools', 'glb-compress', 'creature_fix.py')
COMPRESS = os.path.join(ROOT, 'tools', 'glb-compress', 'compress.mjs')
PROMOTE = os.path.join(HERE, 'promote.py')


def opt(k, d=None):
    return sys.argv[sys.argv.index(k) + 1] if k in sys.argv else d


def targets(kinds, ids):
    T = json.load(open(os.path.join(HERE, 'k96_targets.json'), encoding='utf-8'))['items']
    sel = [t for t in T if (t.get('rig') or 'quad') in kinds and t.get('rig') != 'none' and (not ids or t['id'] in ids)]
    out = []
    for t in sel:
        cands = [p for p in glob.glob(os.path.join(OUT3D, '*', 'fin', t['id'] + '.glb'))]
        if not cands:
            print('SKIP(fin 없음)', t['id'])
            continue
        fin = max(cands, key=os.path.getmtime)
        batch = os.path.dirname(os.path.dirname(fin))
        out.append((t['id'], t.get('rig') or 'quad', batch, fin))
    return out


def run(cmd, **kw):
    return subprocess.run(cmd, cwd=ROOT, stdin=subprocess.DEVNULL, capture_output=True, text=True, encoding='utf-8', errors='replace', **kw)


def main():
    kinds = opt('--kinds', 'quad,bird').split(',')
    ids = opt('--ids', '').split(',') if '--ids' in sys.argv else []
    phase = opt('--phase', 'all')
    rows = targets(kinds, ids)
    print('대상 %d' % len(rows))
    by_batch = {}
    for i, kind, batch, fin in rows:
        by_batch.setdefault(batch, []).append(i)
    if phase in ('rig', 'all'):
        for i, kind, batch, fin in rows:
            dst = os.path.join(batch, 'rig2', i + '.glb')
            os.makedirs(os.path.dirname(dst), exist_ok=True)
            if os.path.exists(dst):
                print('HAVE', i)
                continue
            r = run([BLENDER, '-b', '--factory-startup', '-P', RIG, '--', fin, dst, kind], timeout=900)
            ok = os.path.exists(dst)
            print('RIG' if ok else 'FAIL', i, kind, os.path.relpath(batch, ROOT), '' if ok else r.stdout[-300:] + r.stderr[-300:])
            if ok:
                shutil.copyfile(os.path.join(batch, i + '.license.json'), os.path.join(batch, 'rig2', i + '.license.json'))
    if phase in ('fix', 'all'):
        for batch in by_batch:
            r = run(['py', FIX, os.path.join(batch, 'rig2')])
            print('FIX', os.path.relpath(batch, ROOT), r.stdout.strip().splitlines()[-1] if r.stdout.strip() else r.stderr[-300:])
    if phase in ('render', 'all'):
        os.makedirs(SHEET, exist_ok=True)
        for i, kind, batch, fin in rows:
            src = os.path.join(batch, 'rig2', i + '.glb')
            for tag, extra in (('rest', []), ('walk', ['Walk', '0.3'])):
                png = os.path.join(SHEET, '%s_%s.png' % (i, tag))
                if os.path.exists(png) or not os.path.exists(src):
                    continue
                run([BLENDER, '-b', '--python', RENDER, '--', src, png, '256'] + extra, timeout=600)
            print('RENDER', i)
        if '--sheet' in sys.argv:
            from PIL import Image, ImageDraw
            S = 256
            cols = 6
            n = len(rows)
            rws = (n + cols - 1) // cols
            sheet = Image.new('RGB', (cols * S * 2, rws * (S + 16)), 'white')
            d = ImageDraw.Draw(sheet)
            for k, (i, kind, batch, fin) in enumerate(rows):
                x, y = (k % cols) * S * 2, (k // cols) * (S + 16)
                for j, tag in enumerate(('rest', 'walk')):
                    p = os.path.join(SHEET, '%s_%s.png' % (i, tag))
                    if os.path.exists(p):
                        sheet.paste(Image.open(p).convert('RGB'), (x + j * S, y + 16))
                d.text((x + 4, y + 2), '%s (%s)' % (i, kind), fill='black')
            sheet.save(os.path.join(SHEET, 'sheet.jpg'), quality=88)
            print('SHEET', os.path.join(SHEET, 'sheet.jpg'))
    if phase in ('compress', 'all'):
        for batch in by_batch:
            r = run(['node', COMPRESS, os.path.join(batch, 'rig2'), '--force'], timeout=1800)
            print('COMPRESS', os.path.relpath(batch, ROOT), (r.stdout.strip().splitlines() or [''])[-1][:160], r.stderr[-200:] if r.returncode else '')
    if phase in ('promote', 'all'):
        for batch, ids_ in by_batch.items():
            r = run(['py', PROMOTE, batch, '--ids', ','.join(ids_), '--rig', os.path.join(batch, 'rig2'), '--write'])
            print('PROMOTE', os.path.relpath(batch, ROOT), (r.stdout.strip().splitlines() or [''])[-1][:160], r.stderr[-200:] if r.returncode else '')
    print('RERIG_DONE', phase)


if __name__ == '__main__':
    main()
