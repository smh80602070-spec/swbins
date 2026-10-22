"""K-0163 인물 일러스트 — 주역 30 전신 스탠딩(투명, 세로 1024) + 표정 4(neutral·happy·angry·sad, 반신 512).

  py tools/ai-art/k163_illust.py refs [id…]     # 3D 몸(idle 첫 프레임) 정면·¾ 렌더 1024 → _out/k163_ref/<id>/{front,three}.png
                                                 #   Blender 하나씩 — 다른 blender.exe 가 돌면 끝날 때까지 기다린다(K-0160 등과 안 겹치게)
  py tools/ai-art/k163_illust.py init           # 정면 렌더를 연회녹 바탕 768x1152 에 앉힌 밑그림 _out/k163_init/<id>.png + .license.json
  py tools/ai-art/k163_illust.py stand_txt      # K-0178 — 밑그림 없이 묘사(data/k178_desc.json, 초상 보고 적음)로 txt2img 4 변주 배치
                                                 #   → batches/k178_stand.json (원격 push_batch). 고른 판·눈 판정 칸을 비운다
  py tools/ai-art/k163_illust.py bust           # 고른 스탠딩 → 머리·가슴 자르기 확대 밑그림 _out/k163_bust_init/<id>.png (반신 다듬기 i2i 용)
  py tools/ai-art/k163_illust.py masks          # 고른 반신 → 얼굴 마스크 _out/k163_masks/<id>.png (눈썹~턱 타원, 흐림)
  py tools/ai-art/k163_illust.py expr_batch     # 표정 셋(happy·angry·sad) 인페인트 _in 배치 → batches/_in/k163_expr.json
  py tools/ai-art/k163_illust.py sheet <단계>   # 대조판 _out/k163_sheet/<단계>_<n>.jpg (기존 초상 · 참조 렌더 · 새 그림)
  py tools/ai-art/k163_illust.py pack [--check] # 눈 ○ 만 {stand,neutral,happy,angry,sad}.webp + <id>.license.json → 정본 saga-assets/illust/<판>/<id> + <판>/manifest.js (asset-place illust-<판>)

명단·고른 판·눈 판정 = data/k163_cast.json(표시 이름은 가명). 렌더 = char-forge gear_sprites.py(SPRITE_MODE, 192px 시트와 같은 몸·같은 idle).
K-0178: 3D 몸이 초상과 다른 사람(현대 옷·소녀)이라 그 렌더 밑그림(refs·init·stand_batch)은 쓰지 않는다 — 스탠딩은 stand_txt, 이후 bust 부터 같은 길.
"""
import json
import os
import subprocess
import sys
import time

from PIL import Image, ImageDraw, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
CAST = os.path.join(HERE, 'data', 'k163_cast.json')
OUT = os.path.join(HERE, '_out')
REF = os.path.join(OUT, 'k163_ref')
INIT = os.path.join(OUT, 'k163_init')
BLENDER = os.environ.get('BLENDER', r'C:\Program Files\Blender Foundation\Blender 5.2\blender.exe')
BG = (214, 222, 210)          # 키트 'plain pastel gray-green background' 와 비슷한 바탕(투명 → 검정 함정 피함, K-0121)
W, H = 768, 1152
EXPRS = ('neutral', 'happy', 'angry', 'sad')
FORCE = False


def cast():
    return json.load(open(CAST, encoding='utf-8'))


def rows(ids=None):
    r = cast()['cast']
    return [x for x in r if not ids or x['id'] in ids]


def other_blender():
    o = subprocess.run(['tasklist', '/FI', 'IMAGENAME eq blender.exe', '/FO', 'CSV', '/NH'], capture_output=True, text=True).stdout
    return 'blender.exe' in o.lower()


def refs(ids):
    for x in rows(ids):
        iid = x['id']
        d = os.path.join(REF, iid)
        if os.path.exists(os.path.join(d, 'front.png')):
            continue
        w = 0
        while other_blender():
            if w % 10 == 0:
                print('다른 Blender 가 돈다 — 기다림', iid, flush=True)
            time.sleep(30); w += 1
        vd = os.path.join(ROOT, 'tools', 'char-forge', '_out', 'vroid', iid)
        tmp = os.path.join(d, '_r')
        os.makedirs(tmp, exist_ok=True)
        env = dict(os.environ, SPRITE_MODE='1', CLIP='idle', NFR='1', NDIR='8', DIR_LIST='0,1', SPRITE_PX='1024', ORTHO='2.1', CAM_Z='0.88',
                   ANIM_GLB=os.path.join(vd, iid + '_anims.glb'))
        cmd = [BLENDER, '-b', '--factory-startup', '-P', os.path.join(ROOT, 'tools', 'char-forge', 'gear_sprites.py'), '--',
               os.path.join(vd, iid + '.glb'), tmp, 'human']
        with open(os.path.join(d, 'render.log'), 'w', encoding='utf-8', errors='replace') as lg:
            p = subprocess.Popen(cmd, env=env, stdout=lg, stderr=subprocess.STDOUT, stdin=subprocess.DEVNULL,
                                 creationflags=0x00004000)   # BELOW_NORMAL_PRIORITY_CLASS
            p.wait()
        ok = all(os.path.exists(os.path.join(tmp, f'd{k}_f00.png')) for k in (0, 1))
        if ok:
            os.replace(os.path.join(tmp, 'd1_f00.png'), os.path.join(d, 'three.png'))
            os.replace(os.path.join(tmp, 'd0_f00.png'), os.path.join(d, 'front.png'))
        print('ref', iid, 'ok' if ok else 'FAIL', flush=True)


def bbox_alpha(im, thr=40):
    a = im.split()[-1].point(lambda v: 255 if v > thr else 0)
    return a.getbbox()


def init():
    os.makedirs(INIT, exist_ok=True)
    for x in rows():
        iid = x['id']
        src = os.path.join(REF, iid, 'front.png')
        if not os.path.exists(src):
            print('렌더 없음', iid); continue
        im = Image.open(src).convert('RGBA')
        bb = bbox_alpha(im)
        fig = im.crop(bb)
        s = min(1040 / fig.height, (W - 40) / fig.width)
        fig = fig.resize((max(1, round(fig.width * s)), max(1, round(fig.height * s))), Image.LANCZOS)
        cv = Image.new('RGBA', (W, H), BG + (255,))
        cv.alpha_composite(fig, ((W - fig.width) // 2, H - 56 - fig.height))
        p = os.path.join(INIT, iid + '.png')
        cv.convert('RGB').save(p)
        wl = os.path.join(ROOT, 'saga-assets', 'characters', 'web3d', iid + '.license.json')
        bl = json.load(open(wl, encoding='utf-8')).get('license', '') if os.path.exists(wl) else '(web3d license 없음)'
        lic = {'source': 'saga 자체 3D 몸 렌더(K-0163 참조)', 'base_body': f'saga-assets/characters/web3d/{iid}.glb',
               'base_license': bl, 'base_inputs': [f'tools/char-forge/_out/vroid/{iid}/{iid}.glb (idle)'],
               'render': 'gear_sprites.py SPRITE_MODE idle 첫 프레임 정면 1024 → 768x1152 연회녹 바탕', 'license': 'self'}
        json.dump(lic, open(p[:-4] + '.license.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
        print('init', iid, fig.size)


# ---------------------------------------------------------------- 생성 배치
STAND = os.path.join(OUT, 'k178_stand')           # 스탠딩 후보(gen.py out) — K-0163 옛 i2i 판은 k162_illust30
DESC = os.path.join(HERE, 'data', 'k178_desc.json')
BUST_INIT = os.path.join(OUT, 'k163_bust_init')
BUST = os.path.join(OUT, 'k163_bust')               # 반신 다듬기 후보
MASKS = os.path.join(OUT, 'k163_masks')
EXPR = os.path.join(OUT, 'k163_expr')               # 표정 인페인트 후보
EXPR_TAGS = {'happy': '(happy, smile, open mouth:1.3), joyful eyes',
             'angry': '(angry, furrowed brows, glaring:1.3), frown, clenched teeth, v-shaped eyebrows',
             'sad': '(sad, teary eyes, tears:1.3), downturned mouth, worried eyebrows'}


def subj(x):
    sex = '1boy, male focus' if x['sex'] == 'm' else '1girl'
    d = json.load(open(DESC, encoding='utf-8'))['desc'] if os.path.exists(DESC) else {}
    return f"{sex}, {d.get(x['id']) or x['look']}"   # look = 3D 몸 렌더에 보이던 옷(K-0163) — 묘사가 있으면 초상 쪽


def write_in(name, items, spec, note, variants=4):
    d = {'name': name, 'spec': spec, 'style': 'C', 'model': 'animagine-xl-4.0-opt', 'variants': variants, 'note': note, 'items': items}
    p = os.path.join(HERE, 'batches', '_in', name + '.json')
    json.dump(d, open(p, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print('썼다', p, len(items))


def stand_batch():
    items = []
    for x in rows():
        items.append({'id': x['id'], 'subject': subj(x), 'subject_ko': x['role'], 'view': 'front',
                      'extra': 'arms at sides, feet visible, looking at viewer',
                      'init_image': f"tools/ai-art/_out/k163_init/{x['id']}.png", 'denoise': 0.62, 'width': W, 'height': H,
                      'seed': 2026102100 + len(items) * 101})
    write_in('k162_illust30', items, 'character_tall',
             'K-0163 주역 30 전신 스탠딩 — 3D 몸 idle 정면 렌더(연회녹 바탕)를 밑그림으로 img2img 0.62, 그림체 C. 주제 = 렌더에 보이는 머리·옷 색과 모양(가명·실명 없음)')


def stand_txt():
    c = cast(); d = json.load(open(DESC, encoding='utf-8'))['desc']
    items = []
    for x in c['cast']:
        if x['id'] not in d:
            print('묘사 없음', x['id']); continue
        for k in ('stand_pick', 'bust_pick', 'neutral_pick', 'expr_pick', 'face', 'face_note', 'eye'):
            x.pop(k, None)
        items.append({'id': x['id'], 'subject': subj(x), 'subject_ko': x['role'], 'view': 'front',
                      'extra': 'arms at sides, feet visible, looking at viewer', 'width': W, 'height': H,
                      'seed': 2026102200 + len(items) * 101})
    json.dump(c, open(CAST, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    write_in('k178_stand', items, 'character_tall',
             'K-0178 주역 30 전신 스탠딩 — 밑그림 없이 txt2img, 주제 = 초상(portraits-hero _c)을 보고 적은 묘사(data/k178_desc.json), 그림체 C')


def head_box(im):
    """스탠딩 그림에서 머리 자리 추정 — 몸 키의 0.15 를 머리로, 가로 가운데는 그 띠의 무게중심."""
    import numpy as np
    sys.path.insert(0, HERE)
    from seg_mask import object_mask
    m = object_mask(im.convert('RGB')) > 0.5          # K-0178 — 밑그림이 없어 생성 그림에서 바로(바탕이 BG 와 꼭 같진 않다)
    ys, xs = np.nonzero(m)
    y0, y1 = ys.min(), ys.max()
    hh = (y1 - y0) * 0.15
    band = m[y0:int(y0 + hh)]
    cols = band.sum(axis=0)
    cx = (cols * np.arange(len(cols))).sum() / max(1, cols.sum())
    return float(cx), float(y0), float(hh)


def bust():
    """고른 스탠딩(cast stand_pick) → 머리·가슴 정사각 자르기 → 768 확대 밑그림 + 얼굴 타원 좌표(cast face)."""
    os.makedirs(BUST_INIT, exist_ok=True)
    c = cast()
    for x in c['cast']:
        pk = x.get('stand_pick')
        if not pk:
            continue
        src = os.path.join(STAND, pk + '.png')
        cx, top, hh = head_box(Image.open(src))
        dy = x.get('face_dy', 0) * hh                   # 높은 모자·관 — 눈으로 본 만큼 얼굴 자리를 내린다(머리 키 단위)
        side = hh * 2.8
        box = (round(cx - side / 2), round(top + dy - hh * 0.25), round(cx + side / 2), round(top + dy - hh * 0.25 + side))
        im = Image.open(src).convert('RGB')
        cv = Image.new('RGB', (box[2] - box[0], box[3] - box[1]), BG)
        cv.paste(im.crop((max(0, box[0]), max(0, box[1]), min(W, box[2]), min(H, box[3]))), (max(0, -box[0]), max(0, -box[1])))
        cv = cv.resize((768, 768), Image.LANCZOS)
        p = os.path.join(BUST_INIT, x['id'] + '.png')
        cv.save(p)
        k = 768 / (box[2] - box[0])
        fx, fy = (cx - box[0]) * k, (top + hh * 0.78 + dy - box[1]) * k
        x['face'] = [round(fx), round(fy), round(hh * 0.74 * k), round(hh * 0.58 * k)]
        sl = json.load(open(os.path.join(STAND, pk + '.license.json'), encoding='utf-8'))
        json.dump({'model': sl.get('model'), 'model_license': sl.get('model_license'),
                   'base_inputs': [f'tools/ai-art/_out/k178_stand/{pk}.png (스탠딩 자르기 확대)']},
                  open(p[:-4] + '.license.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
        print('bust', x['id'], box)
    json.dump(c, open(CAST, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    items = [{'id': x['id'], 'subject': subj(x), 'subject_ko': x['role'] + ' 반신', 'view': 'front',
              'extra': 'upper body, portrait, face focus, looking at viewer, closed mouth, calm expression',
              'init_image': f"tools/ai-art/_out/k163_bust_init/{x['id']}.png", 'denoise': 0.42, 'width': 768, 'height': 768,
              'seed': 2026102150 + n * 7} for n, x in enumerate(c['cast']) if x.get('stand_pick')]
    write_in('k163_bust', items, 'character', 'K-0163 반신(평온) — 고른 스탠딩의 머리·가슴을 768 로 확대한 밑그림을 0.42 로 다듬기, 그림체 C', variants=2)


def masks():
    os.makedirs(MASKS, exist_ok=True)
    for x in rows():
        if not x.get('face'):
            continue
        fx, fy, fw, fh = x['face']
        m = Image.new('L', (768, 768), 0)
        ImageDraw.Draw(m).ellipse((fx - fw / 2, fy - fh / 2, fx + fw / 2, fy + fh / 2), fill=255)
        m = m.filter(ImageFilter.GaussianBlur(10)).point(lambda v: min(255, int(v * 1.6)))   # 가운데 완전 흰색, 둘레만 번짐
        m.save(os.path.join(MASKS, x['id'] + '.png'))
    print('masks ok')


def expr_batch():
    items = []
    for n, x in enumerate(rows()):
        pk = x.get('bust_pick')
        if not pk:
            continue
        for e, tag in EXPR_TAGS.items():
            items.append({'id': f"{x['id']}__{e}", 'subject': subj(x), 'subject_ko': f"{x['role']} 표정 {e}", 'view': 'front',
                          'extra': tag + ', upper body, portrait, face focus, looking at viewer',
                          'init_image': f'tools/ai-art/_out/k163_bust/{pk}.png', 'mask_image': f"tools/ai-art/_out/k163_masks/{x['id']}.png",
                          'denoise': 0.7, 'width': 768, 'height': 768, 'seed': 2026102170 + n * 13 + len(e)})
    write_in('k163_expr', items, 'character', 'K-0163 표정 셋(happy·angry·sad) — 반신(neutral)의 얼굴 타원 마스크 안만 인페인트 0.7(옷·머리색 안 흐트러지게), 그림체 C', variants=2)


def build_kit(name):
    """prompt_kit build 뒤 mask_image 를 이어 붙인다(키트는 init_image 만 옮긴다)."""
    subprocess.run([sys.executable, os.path.join(HERE, 'prompt_kit.py'), 'build', os.path.join(HERE, 'batches', '_in', name + '.json')], check=True)
    src = json.load(open(os.path.join(HERE, 'batches', '_in', name + '.json'), encoding='utf-8'))
    bp = os.path.join(HERE, 'batches', name + '.json')
    b = json.load(open(bp, encoding='utf-8'))
    mk = {i['id']: i['mask_image'] for i in src['items'] if i.get('mask_image')}
    for it in b['items']:
        if it['id'] in mk:
            it['mask_image'] = mk[it['id']]
    json.dump(b, open(bp, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print('batch', bp, len(b['items']))


# ---------------------------------------------------------------- 대조판
def flat(im, bg=(235, 235, 235)):
    im = im.convert('RGBA')
    b = Image.new('RGBA', im.size, bg + (255,)); b.alpha_composite(im)
    return b.convert('RGB')


def fit(im, w, h):
    im = im.copy(); im.thumbnail((w, h), Image.LANCZOS)
    c = Image.new('RGB', (w, h), (235, 235, 235)); c.paste(im, ((w - im.width) // 2, (h - im.height) // 2))
    return c


def sheet(stage, per=5):
    """stand: 기존 초상·참조 정면·¾·후보 4 / bust: + 고른 스탠딩·반신 후보 / expr: + 반신·표정 후보 / final: 배포물."""
    d = os.path.join(OUT, 'k163_sheet'); os.makedirs(d, exist_ok=True)
    rs = rows(); CH = 300
    for n0 in range(0, len(rs), per):
        lines = []
        for x in rs[n0:n0 + per]:
            iid = x['id']
            cells = [fit(Image.open(os.path.join(ROOT, 'saga-assets', 'portraits-hero', iid + '_c.webp')).convert('RGB'), 200, CH)]
            cand = []
            if stage == 'stand':
                cand = [(os.path.join(STAND, f'{iid}_v{k:02d}.png'), 200) for k in range(1, 5)]
            elif stage == 'bust':
                cand = [(os.path.join(STAND, (x.get('stand_pick') or '-') + '.png'), 200)] + [(os.path.join(BUST, f'{iid}_v{k:02d}.png'), CH) for k in range(1, 5)]
            elif stage == 'expr':
                cand = [(os.path.join(STAND, (x.get('stand_pick') or '-') + '.png'), 200), (os.path.join(BUST, (x.get('bust_pick') or '-') + '.png'), CH)]
                cand += [(os.path.join(EXPR, f'{iid}__{e}_v{k:02d}.png'), CH) for e in EXPR_TAGS for k in range(1, 5)]
            elif stage == 'final':
                fd = os.path.join(ROOT, 'saga-assets', 'illust', x['game'], iid)
                cand = [(os.path.join(fd, e + '.webp'), 200 if e == 'stand' else CH) for e in ('stand',) + EXPRS]
            for p, w in cand:
                if os.path.exists(p):
                    cells.append(fit(flat(Image.open(p)), w, CH))
            row = Image.new('RGB', (sum(c.width for c in cells) + 4 * len(cells), CH + 22), (255, 255, 255))
            dr = ImageDraw.Draw(row); xx = 0
            for c in cells:
                row.paste(c, (xx, 22)); xx += c.width + 4
            dr.text((4, 4), f"{iid} ({x['sex']})", fill=(0, 0, 0))
            lines.append(row)
        sh = Image.new('RGB', (max(r.width for r in lines), sum(r.height for r in lines)), (255, 255, 255))
        y = 0
        for r in lines:
            sh.paste(r, (0, y)); y += r.height
        p = os.path.join(d, f'{stage}_{n0 // per + 1}.jpg')
        sh.save(p, quality=85); print(p)


# ---------------------------------------------------------------- 포장
def cutout(im):
    """연회녹 바탕 제거 — 모서리 채우기 matte2 만 쓰면 바탕과 비슷한 흰·옅은 머리·옷(백발·연청 후드)이 먹힌다(10-21 시험)
    → u2net 물체 마스크(seg_mask, 로컬 도구 전용)와 matte2 의 합, 가장자리 살짝 조이고 defringe."""
    import numpy as np
    sys.path.insert(0, HERE)
    from matte_util import matte2, defringe
    from seg_mask import object_mask
    m = object_mask(im)
    a = np.asarray(matte2(im, tol=26))[..., 3] / 255.0
    al = np.clip((np.maximum(m, a * (m > 0.05)) - 0.12) / 0.88, 0, 1)
    out = im.convert('RGBA')
    out.putalpha(Image.fromarray((al * 255).astype('uint8')))
    return defringe(out)


def pack(check=False):
    dest = os.path.join(ROOT, 'saga-assets', 'illust')
    c = cast(); n = 0; miss = []
    for x in c['cast']:
        iid = x['id']
        ok = x.get('eye') == 'o' and x.get('stand_pick') and x.get('bust_pick') and all(x.get('expr_pick', {}).get(e) for e in EXPR_TAGS)
        if not ok:
            miss.append(iid); continue
        fix = lambda v, d: os.path.join(OUT, 'k163_fix', v[4:] + '.png') if v.startswith('fix/') else os.path.join(d, v + '.png')   # 눈 △ 다시(k163_fix)
        srcs = {'stand': fix(x['stand_pick'], STAND), 'neutral': fix(x.get('neutral_pick') or x['bust_pick'], BUST)}
        for e in EXPR_TAGS:
            srcs[e] = fix(x['expr_pick'][e], EXPR)
        if check:
            miss += [f'{iid}:{k}' for k, p in srcs.items() if not os.path.exists(p)]; continue
        od = os.path.join(dest, x['game'], iid); os.makedirs(od, exist_ok=True)
        if os.path.exists(os.path.join(od, iid + '.license.json')) and not FORCE:   # 이미 포장(다시 하려면 --force)
            n += 1; continue
        lic = {'id': iid, 'name': x['name'], 'ticket': 'K-0178', 'generator': 'tools/ai-art/k163_illust.py + gen.py (ComfyUI, Kaggle 원격)',
               'model': 'animagine-xl-4.0-opt', 'model_license': 'CreativeML OpenRAIL++-M', 'commercial_use': True, 'files': {}}
        for k, p in srcs.items():
            cut = cutout(Image.open(p).convert('RGB'))
            bb = bbox_alpha(cut, 8)
            if k == 'stand':
                cut = cut.crop((max(0, bb[0] - 12), max(0, bb[1] - 12), min(cut.width, bb[2] + 12), min(cut.height, bb[3] + 12)))
                s = 1024 / cut.height
                cut = cut.resize((round(cut.width * s), 1024), Image.LANCZOS)
            else:
                cut = cut.resize((512, 512), Image.LANCZOS)
            cut.save(os.path.join(od, k + '.webp'), 'WEBP', quality=88, method=6)
            sl = json.load(open(p[:-4] + '.license.json', encoding='utf-8'))
            f = {kk: sl.get(kk) for kk in ('model', 'model_license', 'seed', 'prompt', 'mode', 'denoise', 'base_body', 'base_license', 'date', 'remote') if sl.get(kk) is not None}
            f['from'] = os.path.relpath(p, ROOT).replace('\\', '/')
            lic['files'][k + '.webp'] = f
        lic['license'] = 'saga 자체 생성 — 상업 허용 모델(animagine-xl-4.0-opt, CreativeML OpenRAIL++-M) · txt2img(밑그림 없음, 초상 보고 적은 묘사)'
        lic['note'] = 'AI 생성 — 저작권 보호가 약하다. 표시 이름은 가명.'
        json.dump(lic, open(os.path.join(od, iid + '.license.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
        n += 1
    print('pack', n, '빠짐', len(miss), miss[:40])
    if not check:
        games = {}
        for x in c['cast']:
            if os.path.exists(os.path.join(dest, x['game'], x['id'], 'stand.webp')):
                games.setdefault(x['game'], []).append(x['id'])
        for g, ids in games.items():
            md = os.path.join(dest, g)   # 정본 — asset-place illust-<판> 이 saga-web/<판>/assets/illust 로 옮긴다
            txt = ('/* K-0163 tools/ai-art/k163_illust.py pack 이 쓴다 — 손으로 고치지 않는다. 인물 일러스트(stand 세로 1024 투명 · 표정 512 반신 투명). */\n'
                   '(function(g){g.SAGA=g.SAGA||{};g.SAGA.illust={"v":1,"base":"assets/illust/","files":["stand","neutral","happy","angry","sad"],"ids":'
                   + json.dumps(sorted(ids)) + '};})(typeof window!=="undefined"?window:globalThis);\n')
            open(os.path.join(md, 'manifest.js'), 'wb').write(txt.encode('utf-8'))
            print('manifest', g, len(ids))


if __name__ == '__main__':
    a = sys.argv[1:]
    cmd = a[0] if a else ''
    if cmd == 'refs':
        refs(a[1:])
    elif cmd == 'init':
        init()
    elif cmd == 'stand_batch':
        stand_batch(); build_kit('k162_illust30')
    elif cmd == 'stand_txt':
        stand_txt(); build_kit('k178_stand')
    elif cmd == 'bust':
        bust(); build_kit('k163_bust')
    elif cmd == 'masks':
        masks()
    elif cmd == 'expr_batch':
        expr_batch(); build_kit('k163_expr')
    elif cmd == 'sheet':
        sheet(a[1])
    elif cmd == 'pack':
        FORCE = '--force' in a
        pack('--check' in a)
    else:
        print(__doc__)
