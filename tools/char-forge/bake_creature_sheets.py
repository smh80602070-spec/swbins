"""K-0090 ③ — 짐승·괴물 몸 2D 시트 굽기 드라이버. creature_sprites.py(Blender)로 프레임을 찍고 사람 시트와 같은 꼴로 묶는다.

  py tools/char-forge/bake_creature_sheets.py [id ...] [--force] [--out saga-assets/sprites2d]
  id 를 안 주면 saga-assets/world/toon 의 boss_* · mon_* 전부. --src <폴더> 면 그 폴더 몸(K-0143: saga-assets/creatures3d 종 몸).

산출: <out>/<id>/{idle,walk,attack,hit,death}.webp (가로 8프레임 × 세로 3방향 — 0 정면·1 옆(오른쪽)·2 뒤, 128px) + manifest.json
manifest 꼴은 사람 풀(pool_*)과 같다 + kind 'creature'·body·license. 이미 manifest 가 있으면 건너뛴다(--force 로 다시).
프레임(git 밖): tools/char-forge/_out/creature_frames/<id>/ . Blender 는 낮은 우선순위.
"""
import glob
import json
import os
import subprocess
import sys

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
BLENDER = os.environ.get('BLENDER', r'C:\Program Files\Blender Foundation\Blender 5.2\blender.exe')
TOON = os.path.join(ROOT, 'saga-assets', 'world', 'toon')
FRAMES = os.path.join(HERE, '_out', 'creature_frames')
BELOW_NORMAL = 0x00004000


def bake(cid, out_root, force, src=None):
    src = src or TOON
    dst = os.path.join(out_root, cid)
    if os.path.exists(os.path.join(dst, 'manifest.json')) and not force:
        return 'skip'
    fr = os.path.join(FRAMES, cid)
    env = dict(os.environ, SIDE_ALT='1') if src != TOON else None   # K-0143 종 몸: 반대쪽 옆도 찍어 밝은 쪽을 쓴다
    r = subprocess.run([BLENDER, '-b', '--factory-startup', '-P', os.path.join(HERE, 'creature_sprites.py'), '--',
                        os.path.join(src, cid + '.glb'), fr], stdin=subprocess.DEVNULL, capture_output=True, text=True, env=env,
                       encoding='utf-8', errors='replace', creationflags=BELOW_NORMAL if os.name == 'nt' else 0)
    if 'CREATURE_SPRITES' not in r.stdout:
        return 'fail: ' + (r.stdout + r.stderr)[-300:]
    meta = json.load(open(os.path.join(fr, 'meta.json'), encoding='utf-8'))
    px, n = meta['px'], meta['frames']
    os.makedirs(dst, exist_ok=True)
    side = 'd1'
    if os.path.exists(os.path.join(fr, meta['clips'][0], 'd3_f00.png')):
        def lum(p):
            a = Image.open(p).convert('RGBA')
            px_ = [(r * 0.299 + g * 0.587 + b * 0.114) for r, g, b, al in a.getdata() if al > 128]
            return sum(px_) / max(1, len(px_))
        l1 = lum(os.path.join(fr, meta['clips'][0], 'd1_f00.png'))
        l3 = lum(os.path.join(fr, meta['clips'][0], 'd3_f00.png'))
        if l3 > l1 + 12:            # 반대쪽이 확연히 밝으면(결이 한쪽만 어두움) 그쪽을 좌우 뒤집어 '오른쪽 옆' 줄로
            side = 'd3'
    for clip in meta['clips']:
        sheet = Image.new('RGBA', (px * n, px * 3), (0, 0, 0, 0))
        for d in range(3):
            for f in range(n):
                if d == 1 and side == 'd3':
                    im = Image.open(os.path.join(fr, clip, f'd3_f{f:02d}.png')).convert('RGBA').transpose(Image.FLIP_LEFT_RIGHT)
                else:
                    im = Image.open(os.path.join(fr, clip, f'd{d}_f{f:02d}.png')).convert('RGBA')
                sheet.alpha_composite(im, (f * px, d * px))
        sheet.save(os.path.join(dst, clip + '.webp'), 'WEBP', quality=88, method=6)
    lic = json.load(open(os.path.join(src, cid + '.license.json'), encoding='utf-8'))
    json.dump({'id': cid, 'body': cid, 'kind': 'creature', 'family': lic.get('family'), 'px': px, 'frames': n, 'dirs': [0, 1, 2],
               'clips': meta['clips'], 'side_src': side, 'ortho_m': meta['ortho_m'], 'cam_z': meta['cam_z'], 'anchor_feet_y_px': meta['anchor_feet_y_px'],
               'side_faces': 'right', 'license': lic.get('license', ''),
               'source': '%s/%s.glb (자기 동작 Idle·Walk·Attack·Hit·Death) — tools/char-forge/creature_sprites.py (K-0090 ③)' % (os.path.relpath(src, ROOT).replace(os.sep, '/'), cid)},
              open(os.path.join(dst, 'manifest.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    return 'ok %s %.2fm side %s' % (','.join(meta['clips']), meta['ortho_m'], side)


def main():
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass
    src = os.path.abspath(sys.argv[sys.argv.index('--src') + 1]) if '--src' in sys.argv else TOON   # K-0143: --src saga-assets/creatures3d(종 몸)
    args = [a for a in sys.argv[1:] if not a.startswith('--') and os.path.abspath(a) != src]
    out_root = os.path.join(ROOT, 'saga-assets', 'sprites2d')
    if '--out' in sys.argv:
        out_root = os.path.abspath(sys.argv[sys.argv.index('--out') + 1])
        args = [a for a in args if os.path.abspath(a) != out_root]
    ids = args or sorted(os.path.basename(p)[:-4] for p in glob.glob(os.path.join(TOON, '*.glb'))
                         if os.path.basename(p).startswith(('boss_', 'mon_')))
    bad = 0
    for cid in ids:
        r = bake(cid, out_root, '--force' in sys.argv, src)
        bad += r.startswith('fail')
        print(cid, r, flush=True)
    print('CREATURE_SHEETS', len(ids), '· 실패', bad)
    return 1 if bad else 0


if __name__ == '__main__':
    sys.exit(main())
