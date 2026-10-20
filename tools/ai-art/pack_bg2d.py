"""K-0150 — 겹 배경(parallax2d 규격): 장소 그림 한 장을 깊이 추정으로 층을 갈라 saga-assets/web2d/bg2d/<장소>/ 층 그림 + layers.json.

  py tools/ai-art/pack_bg2d.py prep              # 원본 반쪽(1920 폭 = 원본+좌우 뒤집기 → 왼쪽 960)·깊이·문턱 마스크 4 → 인페인트 배치 batches/k150_inpaint_{anim,illu}.json
  (원격) push_batch.py 두 배치 → _out/k150_inpaint/<장소>__m<k>.png
  py tools/ai-art/pack_bg2d.py split [장소,…]   # 인페인트 결과로 층 다섯 → bg2d/<장소>/ (원본 saga-assets/web2d/bg/<장소>_far.webp)
  py tools/ai-art/pack_bg2d.py sheet             # 미리보기 _out/k150/sheet.jpg — 엔진(parallax2d.draw)과 같은 식으로 카메라 두 자리 + 층 분해
  py tools/ai-art/pack_bg2d.py check             # 규격 키·파일 검사 → BG2D_OK

층마다 따로 그리면(1차 10-20) 그림체 C 가 층을 스티커 물건·끝 보이는 블록으로 그리고 어두운 장소도 파스텔이 돼 버렸다 → 한 장면을 깊이로 가른다.
  2차(누적 층 + 원본 바탕)는 앞 층이 비키면 바탕의 같은 물체가 드러나 둘로 보였다 → 층 k 의 그림 = 원본에서 문턱 k+1 보다 가까운 것을
  지우고 다시 그린(인페인트, 원본과 같은 모델·프롬프트) 판, 알파 = 문턱 k 보다 가까운 곳. 맨 앞 층만 원본 픽셀.
  base = 인페인트(가까움 ≥ t1) 불투명 · l1 = 인페인트(≥ t2)·알파 ≥ t1 · … · l4 = 원본·알파 ≥ t4
모든 층은 같은 자리(top 0 · h 1), 빠르기(depth)만 다르다. 안개(fog)는 안 쓴다 — 엔진이 층 사각형 전체를 칠해 알파 층에 띠가 생긴다(수신함 웹 줄).
깊이 = Depth Anything V2 Small(Apache-2.0, ONNX, 도구 전용 · ~/.depth/dav2s.onnx — 저장소·게임엔 안 들어감), 실행기 onnxruntime(_out/_pylib).
"""
import json
import os
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
SRC = os.path.join(ROOT, 'saga-assets', 'web2d', 'bg')
CANON = os.path.join(ROOT, 'saga-assets', 'web2d', 'bg2d')
MODEL = os.environ.get('DEPTH_ONNX', os.path.join(os.path.expanduser('~'), '.depth', 'dav2s.onnx'))
PLACES = ['story_field_meadow', 'story_forest']   # 10-20 1차 ○ 둘 — dg_gobun·dg_jiokmun·story_sky_bridge 는 ✗(대칭 실내·복잡 장면, K-0150 메모)
# 이름, 깊이 문턱(가까움 분위수 — 이보다 가까운 픽셀만), 엔진 depth(빠르기)
LAYERS = [('base', None, 0.05), ('l1', 0.35, 0.25), ('l2', 0.55, 0.5), ('l3', 0.75, 0.8), ('l4', 0.90, 1.0)]
_sess = None


def depth(im):
    """0(멀다)~1(가깝다) — 원본 크기."""
    global _sess
    if _sess is None:
        sys.path.insert(0, os.path.join(HERE, '_out', '_pylib'))
        import onnxruntime as ort
        _sess = ort.InferenceSession(MODEL, providers=['CPUExecutionProvider'])
    w = 14 * round(im.width * 336 / im.height / 14)
    x = np.asarray(im.convert('RGB').resize((w, 336), Image.BICUBIC)).astype(np.float32) / 255
    x = ((x - [0.485, 0.456, 0.406]) / [0.229, 0.224, 0.225]).transpose(2, 0, 1)[None].astype(np.float32)
    d = _sess.run(None, {_sess.get_inputs()[0].name: x})[0][0]
    d = (d - d.min()) / (d.max() - d.min() + 1e-6)
    return np.asarray(Image.fromarray((d * 255).astype(np.uint8)).resize(im.size, Image.BICUBIC)).astype(np.float32) / 255


INP = os.path.join(HERE, '_out', 'k150_inpaint')
GW, GH = 1024, 576                       # 원본 생성 크기(license size)


def half(pid):
    im = Image.open(os.path.join(SRC, pid + '_far.webp')).convert('RGB')
    return im.crop((0, 0, im.width // 2, im.height))        # 원본 + 좌우 뒤집기 → 왼쪽이 원본


def cuts(d):
    return np.quantile(d, [t for _n, t, _s in LAYERS if t is not None])


def prep():
    os.makedirs(INP, exist_ok=True)
    B = {}
    for pid in PLACES:
        h = half(pid)
        d = depth(h)
        np.save(os.path.join(INP, pid + '__depth.npy'), d)
        q = cuts(d)
        h.resize((GW, GH), Image.LANCZOS).save(os.path.join(INP, pid + '__src.png'))
        lic = json.load(open(os.path.join(SRC, pid + '_far.license.json'), encoding='utf-8'))
        model = lic.get('model', 'animagine-xl-4.0-opt')
        for k, t in enumerate(q, 1):
            m = Image.fromarray(((d >= t) * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(9)).filter(ImageFilter.GaussianBlur(3))
            mp = os.path.join(INP, f'{pid}__mask{k}.png')
            m.resize((GW, GH), Image.LANCZOS).save(mp)
            B.setdefault(model, []).append({'id': f'{pid}__m{k}', 'prompt': lic['prompt'], 'negative': lic.get('negative_prompt', '') + ', object, pillar, post, statue',
                                            'seed': int(lic.get('seed', 1)) + k, 'init_image': os.path.relpath(os.path.join(INP, pid + '__src.png'), ROOT).replace(os.sep, '/'),
                                            'mask_image': os.path.relpath(mp, ROOT).replace(os.sep, '/'), 'denoise': 1.0})
    for model, items in B.items():
        tag = 'anim' if 'animagine' in model else 'illu'
        b = {'model': model, 'out': 'k150_inpaint', 'note': 'K-0150 겹 배경 — 깊이 문턱보다 가까운 것을 지운 뒤판(원본과 같은 프롬프트, 마스크 안만 다시 그림)',
             'defaults': {'prompt_prefix': '', 'width': GW, 'height': GH, 'steps': 28, 'cfg': 5.5, 'sampler': 'Euler a', 'negative': '', 'variants': 1}, 'items': items}
        p = os.path.join(HERE, 'batches', f'k150_inpaint_{tag}.json')
        json.dump(b, open(p, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
        print('BATCH', p, len(items))


def mirror2(im):
    """반쪽(원본) → 원본 + 좌우 뒤집기(옛 _far 와 같은 1920 이음)."""
    w, h = im.size
    out = Image.new(im.mode, (w * 2, h))
    out.paste(im, (0, 0))
    out.paste(im.transpose(Image.FLIP_LEFT_RIGHT), (w, 0))
    return out


def split(ids=None):
    for pid in ids or PLACES:
        src = os.path.join(SRC, pid + '_far.webp')
        h = half(pid)
        d = np.load(os.path.join(INP, pid + '__depth.npy'))
        q = cuts(d)
        out = os.path.join(CANON, pid)
        os.makedirs(out, exist_ok=True)
        lic0 = json.load(open(src[:-5] + '.license.json', encoding='utf-8'))
        meta = {'layers': []}
        for i, (name, t, spd) in enumerate(LAYERS):
            if i < len(q):                                                   # 그림 = 다음 문턱보다 가까운 것을 지운 뒤판
                ip = os.path.join(INP, f'{pid}__m{i + 1}_v01.png')
                if not os.path.exists(ip):
                    ip = os.path.join(INP, f'{pid}__m{i + 1}.png')
                pic = Image.open(ip).convert('RGB').resize(h.size, Image.LANCZOS)
            else:
                pic = h.copy()
            if t is not None:
                m = Image.fromarray(((d >= q[i - 1]) * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(3)).filter(ImageFilter.GaussianBlur(1.2))
                pic = pic.convert('RGBA')
                pic.putalpha(m)
            lay = mirror2(pic)
            lay.save(os.path.join(out, name + '.webp'), 'WEBP', quality=86, method=6)
            lic = dict(lic0)
            lic.update({'id': f'{pid}_{name}', 'size': list(lay.size), 'source_image': os.path.relpath(src, ROOT).replace(os.sep, '/'),
                        'packed_by': 'K-0150 tools/ai-art/pack_bg2d.py — 깊이 추정 Depth Anything V2 Small(Apache-2.0, 도구 전용)으로 층 가름'
                                     + (f' · 가까움 분위수 {LAYERS[i + 1][1]} 이상을 지운 인페인트(원본 모델·프롬프트, denoise 1.0)' if i < len(q) else ' · 원본 픽셀')
                                     + ('' if t is None else f' · 알파 = 분위수 {t} 이상'),
                        'mode': 'inpaint' if i < len(q) else 'original'})
            json.dump(lic, open(os.path.join(out, name + '.license.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
            meta['layers'].append({'img': name + '.webp', 'depth': spd, 'top': 0, 'h': 1})
        json.dump(meta, open(os.path.join(out, 'layers.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
        print('SPLIT', pid, [round(float(v), 2) for v in q])
    print('BG2D_SPLIT', len(ids or PLACES))


def compose(pid, W=960, H=270, camX=0.0):
    """parallax2d.draw 와 같은 자리 계산 — dw = 그림 폭 × (층 높이 / 그림 높이), 홀수 칸 좌우 뒤집기."""
    d = os.path.join(CANON, pid)
    meta = json.load(open(os.path.join(d, 'layers.json'), encoding='utf-8'))
    can = Image.new('RGBA', (W, H), (0, 0, 0, 255))
    for L in meta['layers']:
        im = Image.open(os.path.join(d, L['img'])).convert('RGBA')
        dh = round(L['h'] * H)
        dw = round(im.width * dh / im.height)
        im = im.resize((dw, dh), Image.LANCZOS)
        y = round(L['top'] * H) if 'top' in L else round(L['bottom'] * H) - dh
        sx = camX * L['depth']
        n, off = int(sx // dw), int(sx % dw)
        k = 0
        while k * dw - off < W:
            t = im if (n + k) % 2 == 0 else im.transpose(Image.FLIP_LEFT_RIGHT)
            can.paste(t, (k * dw - off, y), t)
            k += 1
    return can.convert('RGB')


def sheet():
    W, H = 960, 270
    out = Image.new('RGB', (W * 2 + 8, (H * 2 + 30) * len(PLACES)), (30, 30, 30))
    dr = ImageDraw.Draw(out)
    for r, pid in enumerate(PLACES):
        y = r * (H * 2 + 30)
        dr.text((4, y), f'{pid} — 카메라 0 · 600 (앞 층이 더 많이 움직여야)', fill=(255, 255, 0))
        out.paste(compose(pid, W, H, 0), (0, y + 14))
        out.paste(compose(pid, W, H, 600), (W + 8, y + 14))
        for i, (name, *_r) in enumerate(LAYERS):
            im = Image.open(os.path.join(CANON, pid, name + '.webp')).convert('RGBA').resize((W * 2 // 5 - 8, H // 2 + 20))
            bg = Image.new('RGBA', im.size, (255, 0, 255, 255))
            bg.alpha_composite(im)
            out.paste(bg.convert('RGB'), (i * (W * 2 // 5), y + 14 + H + 4))
    os.makedirs(os.path.join(HERE, '_out', 'k150'), exist_ok=True)
    p = os.path.join(HERE, '_out', 'k150', 'sheet.jpg')
    out.save(p, quality=86)
    print('SHEET', p)


def check():
    bad = []
    keys = {'img', 'depth', 'top', 'bottom', 'h', 'fog', 'front', 'alpha'}
    for pid in PLACES:
        d = os.path.join(CANON, pid)
        try:
            m = json.load(open(os.path.join(d, 'layers.json'), encoding='utf-8'))
        except Exception as e:  # noqa: BLE001
            bad.append(f'{pid} layers.json {e}')
            continue
        if set(m) - {'fog', 'layers', 'light'}:
            bad.append(f'{pid} 모르는 키 {set(m) - {"fog", "layers", "light"}}')
        if not 5 <= len(m.get('layers', [])) <= 7:
            bad.append(f'{pid} 층 수 {len(m.get("layers", []))}')
        for L in m.get('layers', []):
            if set(L) - keys:
                bad.append(f'{pid} 층 모르는 키 {set(L) - keys}')
            for f in (L['img'], os.path.splitext(L['img'])[0] + '.license.json'):
                if not os.path.exists(os.path.join(d, f)):
                    bad.append(f'{pid} 없음 {f}')
    print('BG2D_FAIL' if bad else 'BG2D_OK', len(PLACES))
    for b in bad[:20]:
        print(' -', b)
    return 1 if bad else 0


if __name__ == '__main__':
    cmd = sys.argv[1] if len(sys.argv) > 1 else ''
    if cmd == 'prep':
        prep()
    elif cmd == 'split':
        split(sys.argv[2].split(',') if len(sys.argv) > 2 else None)
    elif cmd == 'sheet':
        sheet()
    elif cmd == 'check':
        sys.exit(check())
    else:
        print(__doc__)
