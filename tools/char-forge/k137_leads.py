"""K-0137 주역 10 고유 몸 — data/k137_leads.json 대로 밑몸(_in/vroid/<id>.glb, K-0024 옷 이식) 에 다른 샘플 머리카락·뼈 비율·얼굴 레이어를 얹는다.

  py tools/char-forge/k137_leads.py build [id…]    # _out/k137/lead/<id>.glb (vrm_mix → face_layers, 있으면 건너뜀 · --force)
  py tools/char-forge/k137_leads.py render [id…]   # 머리 정면 CPU 렌더 옛(_in)·새 → _out/k137/lead/render · 시트 _out/k137/leads_cmp.jpg
  py tools/char-forge/k137_leads.py install        # _in/vroid/<id>.glb 를 _in/vroid_k137_bak/ 에 두고 새 몸으로 갈아 끼움(뒤는 vroid_batch)
머리 공급원 = saga-assets/characters/vroid/avatar_sample_<hair>.glb(VRM 1.0 샘플, 상업·개작·재배포 허용). 얼굴 레이어 셰이프키 이름은 밑몸 샘플에서.
Blender 하나씩(낮은 우선순위) · 렌더는 CPU(Cycles) 라 SD 사슬과 겹쳐도 된다.
"""
import json
import os
import shutil
import sys

from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
sys.path.insert(0, HERE)
from vrm_mix_batch import blender  # noqa: E402

LEADS = os.path.join(HERE, 'data', 'k137_leads.json')
IN = os.path.join(HERE, '_in', 'vroid')
BAK = os.path.join(HERE, '_in', 'vroid_k137_bak')
OUT = os.path.join(HERE, '_out', 'k137', 'lead')
SAMPLE = os.path.join(ROOT, 'saga-assets', 'characters', 'vroid', 'avatar_sample_%s.glb')


def rows(ids):
    r = json.load(open(LEADS, encoding='utf-8'))['leads']
    return [x for x in r if not ids or x['id'] in ids]


def src_of(cid):
    """갈아 끼운 뒤에도 원래 밑몸에서 다시 굽도록 백업이 있으면 그쪽."""
    b = os.path.join(BAK, cid + '.glb')
    return b if os.path.exists(b) else os.path.join(IN, cid + '.glb')


def build(rs, force):
    os.makedirs(OUT, exist_ok=True)
    ok = 0
    for r in rs:
        dst = os.path.join(OUT, r['id'] + '.glb')
        if os.path.exists(dst) and not force:
            ok += 1
            continue
        mix = os.path.join(OUT, r['id'] + '_mix.glb')
        ratio = ','.join('%s=%s' % kv for kv in r['ratio'].items())
        code, out = blender(['-P', os.path.join(HERE, 'vrm_mix.py'), '--', src_of(r['id']), SAMPLE % r['hair'].lower(), mix, ratio])
        line = [l for l in out.splitlines() if l.startswith('MIX_OK')]
        if not line:
            print(r['id'], 'MIX_FAIL', out[-600:])
            continue
        code, out = blender(['-P', os.path.join(HERE, 'face_layers.py'), '--', mix, SAMPLE % r['body'].lower(), dst, r['face']])
        good = 'FACE_OK' in out and os.path.exists(dst)
        ok += good
        print(r['id'], line[0][:160], '· FACE_OK' if good else '· FACE_FAIL ' + out[-400:], flush=True)
        if os.path.exists(mix):
            os.remove(mix)
    print('K137_BUILD %d/%d' % (ok, len(rs)))


def render(rs):
    rd = os.path.join(OUT, 'render')
    od = os.path.join(rd, 'old')
    os.makedirs(od, exist_ok=True)
    new = [os.path.join(OUT, r['id'] + '.glb') for r in rs if os.path.exists(os.path.join(OUT, r['id'] + '.glb'))]
    old = [src_of(r['id']) for r in rs]
    tool = os.path.join(HERE, 'render', 'render_heads_cpu.py')
    blender(['-P', tool, '--', rd] + new)
    blender(['-P', tool, '--', od] + old)
    cw = 240
    sh = Image.new('RGB', (cw * 2 * 5, (cw + 16) * ((len(rs) + 4) // 5)), (205, 208, 212))
    d = ImageDraw.Draw(sh)
    for k, r in enumerate(rs):
        x, y = (k % 5) * cw * 2, (k // 5) * (cw + 16)
        for j, p in enumerate((os.path.join(od, r['id'] + '_hc.png'), os.path.join(rd, r['id'] + '_hc.png'))):
            if os.path.exists(p):
                im = Image.open(p).convert('RGBA')
                im.thumbnail((cw, cw))
                sh.paste(im, (x + j * cw, y), im)
        d.text((x + 2, y + cw + 2), '%s  old | new (hair %s)' % (r['id'], r['hair']), fill=(0, 0, 0))
    out = os.path.join(HERE, '_out', 'k137', 'leads_cmp.jpg')
    sh.save(out, quality=90)
    print('K137_SHEET', out)


def install(rs):
    os.makedirs(BAK, exist_ok=True)
    n = 0
    for r in rs:
        new = os.path.join(OUT, r['id'] + '.glb')
        if not os.path.exists(new):
            continue
        cur = os.path.join(IN, r['id'] + '.glb')
        bak = os.path.join(BAK, r['id'] + '.glb')
        if not os.path.exists(bak):
            shutil.copyfile(cur, bak)
        shutil.copyfile(new, cur)
        n += 1
    print('K137_INSTALL', n)


if __name__ == '__main__':
    cmd = sys.argv[1] if len(sys.argv) > 1 else ''
    ids = [a for a in sys.argv[2:] if not a.startswith('--')]
    rs = rows(ids)
    if cmd == 'build':
        build(rs, '--force' in sys.argv)
    elif cmd == 'render':
        render(rs)
    elif cmd == 'install':
        install(rs)
    else:
        print(__doc__)
