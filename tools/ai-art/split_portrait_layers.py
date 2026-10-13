"""K-0049 — 움직이는 대화 초상: 표정 키 프레임(render_live_frames.py) → 바탕 한 장 + 부위 패치(알파, 잘린 상자) + live.json.

  py tools/ai-art/split_portrait_layers.py [--plan data/live_portrait_plan.json] [--ids a,b] [--sheet <png>] [--check]
    프레임   tools/ai-art/_out/live_frames/<id>__<프레임>.png
    정본     saga-assets/portraits-live/<id>/  base.webp · <프레임>.webp(blink_half·blink·mouth_half·mouth_a·mouth_o) · live.json · <id>.license.json
    --sheet  미리보기(사람마다 정지컷 다섯: 평소·눈 감음·입 벌림·숨 들이쉼·고개 기울임)
    --check  쓰지 않고 합성 차이·용량만 잰다

부위 = 그 부위 프레임들과 base 의 픽셀 차이(> 24/765)를 넓히고(15px) 흐린(4px) 알파. 입 모양 키는 눈썹도 조금 움직여서
입 부위는 눈 부위(조금 더 넓힌 것)를 뺀 차이만 쓴다. 검증: 바탕 + 패치 = 원 프레임(부위 상자 안 평균 차 ≤ 2%) · 사람마다 ≤ 0.6MB
— 통과한 사람만 쓴다. 몸 출처(web3d license)가 없으면 멈춘다.
재생(각 갈래): live.json 의 parts[부위].box 자리에 frames 의 그림을 얹는다. 깜빡임 = blink.seq 를 frame_ms 씩, every_s 범위
무작위 간격(게임 씨앗) · 말하기 = talk.seq 를 frame_ms 씩 되풀이(말 끝나면 base) · 숨쉬기 = 그림 전체를 아래 끝 기준 세로
1+amp 배로 period_s 주기 · 고개 = 목(pivot_y) 기준 ±deg 기울임 period_s 주기. 앞머리 흔들림 층은 아직 없다(단계 3 판정 뒤).
"""
import io
import json
import os
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
FR = os.path.join(HERE, '_out', 'live_frames')
DEST = os.path.join(ROOT, 'saga-assets', 'portraits-live')
GROUPS = {'eye': ['blink_half', 'blink'], 'mouth': ['mouth_half', 'mouth_a', 'mouth_o']}
MOTION = {'blink': {'seq': ['blink_half', 'blink', 'blink_half'], 'frame_ms': 60, 'every_s': [3, 6]},
          'talk': {'seq': ['mouth_half', 'mouth_a', 'mouth_half', 'mouth_o'], 'frame_ms': 110},
          'breath': {'amp': 0.006, 'period_s': 3.6},
          'sway': {'deg': 1.2, 'period_s': 5.0, 'pivot_y': 0.78}}
LIMIT = 600 * 1024


def frame(hid, f):
    return Image.open(os.path.join(FR, '%s__%s.png' % (hid, f))).convert('RGB')


def split(hid):
    """프레임 → (쓸 그림들, live.json, 부위 상자 안 합성 차이 %, 용량). 쓰지는 않는다 — 검사를 지난 것만 main 이 쓴다."""
    base = frame(hid, 'base')
    B = np.asarray(base).astype(np.int16)
    files = {'base.webp': base}
    meta = {'id': hid, 'size': list(base.size), 'base': 'base.webp', 'parts': {}, 'motion': MOTION}
    diffs, taken = {}, np.zeros(B.shape[:2], bool)
    for g, frames in GROUPS.items():          # eye 먼저 — 입 모양 키가 눈썹도 움직이면 그 자리는 이미 eye 몫
        ims = {f: frame(hid, f) for f in frames}
        m = np.zeros(B.shape[:2], bool)
        for im in ims.values():
            m |= np.abs(np.asarray(im).astype(np.int16) - B).sum(2) > 24
        m &= ~taken
        if not m.any():
            raise SystemExit('부위 차이 없음: %s %s' % (hid, g))
        grown = Image.fromarray((m * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(15))
        taken |= np.asarray(grown.filter(ImageFilter.MaxFilter(11))) > 0
        mk = grown.filter(ImageFilter.GaussianBlur(4))
        ys, xs = np.nonzero(np.asarray(mk) > 0)
        box = [int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1]
        meta['parts'][g] = {'box': box, 'frames': {}}
        for f, im in ims.items():
            rgba = im.copy()
            rgba.putalpha(mk)
            patch = rgba.crop(box)
            name = f + '.webp'
            files[name] = patch
            meta['parts'][g]['frames'][f] = name
            comp = base.copy()
            comp.paste(patch, box[:2], patch)
            a = np.asarray(comp.crop(box)).astype(np.int16)
            b = np.asarray(im.crop(box)).astype(np.int16)
            diffs[f] = float(np.abs(a - b).mean() / 255 * 100)   # 부위 상자 안에서 — 전체 평균이면 틀린 패치도 묻힌다
    size = 0
    for name, im in files.items():
        buf = io.BytesIO()
        im.save(buf, 'WEBP', quality=88 if name == 'base.webp' else 90, method=6)
        files[name] = buf.getvalue()
        size += len(files[name])
    return files, meta, diffs, size


def write(hid, files, meta):
    src = os.path.join(ROOT, 'saga-assets', 'characters', 'web3d', hid + '.license.json')
    if not os.path.exists(src):
        raise SystemExit('몸 출처 없음(먼저 web3d 정본): %s' % src)
    out = os.path.join(DEST, hid)
    os.makedirs(out, exist_ok=True)
    for name, data in files.items():
        open(os.path.join(out, name), 'wb').write(data)
    json.dump(meta, open(os.path.join(out, 'live.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    lic = json.load(open(src, encoding='utf-8'))
    lic.update({'id': hid + '_live', 'derived': 'tools/ai-art/render_live_frames.py(VRoid 표정 키 반신 렌더) → split_portrait_layers.py (K-0049)',
                'base_glb': 'saga-assets/characters/web3d/%s.glb' % hid})
    json.dump(lic, open(os.path.join(out, hid + '.license.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)


def sheet(rows, dst):
    w, h = 192, 256
    s = Image.new('RGB', (w * 5, (h + 18) * len(rows)), (30, 30, 30))
    d = ImageDraw.Draw(s)
    for r, (hid, meta) in enumerate(rows):
        base = Image.open(os.path.join(DEST, hid, 'base.webp')).convert('RGB')

        def put(img, g, f):
            p = Image.open(os.path.join(DEST, hid, meta['parts'][g]['frames'][f])).convert('RGBA')
            img.paste(p, meta['parts'][g]['box'][:2], p)
            return img
        W, H = base.size
        breath = base.resize((W, int(H * (1 + MOTION['breath']['amp'] * 4))), Image.LANCZOS).crop((0, int(H * MOTION['breath']['amp'] * 4), W, int(H * (1 + MOTION['breath']['amp'] * 4))))
        sway = base.rotate(MOTION['sway']['deg'] * 3, resample=Image.BICUBIC, center=(W / 2, H * MOTION['sway']['pivot_y']), fillcolor=(158, 168, 184))
        cuts = [('base', base), ('blink', put(base.copy(), 'eye', 'blink')), ('talk a', put(base.copy(), 'mouth', 'mouth_a')),
                ('breath x4', breath), ('sway x3', sway)]   # 이름표는 영문(PIL 기본 글꼴에 한글 없음)
        for c, (label, im) in enumerate(cuts):
            s.paste(im.crop((134, 230, 634, 897)).resize((w, h)), (c * w, r * (h + 18) + 18))
            d.text((c * w + 3, r * (h + 18) + 3), '%s  %s' % (hid, label) if c == 0 else label, fill=(255, 255, 255))
    s.save(dst, quality=88)


def main():
    a = sys.argv[1:]
    sys.stdout.reconfigure(encoding='utf-8')
    plan = json.load(open(os.path.join(HERE, a[a.index('--plan') + 1]) if '--plan' in a else os.path.join(HERE, 'data', 'live_portrait_plan.json'), encoding='utf-8'))
    ids = a[a.index('--ids') + 1].split(',') if '--ids' in a else [c['id'] for c in plan['cast']]
    do_write = '--check' not in a
    rows, bad = [], []
    for hid in ids:
        files, meta, diffs, size = split(hid)
        worst = max(diffs.values())
        ok = worst <= 2.0 and size <= LIMIT
        if ok and do_write:
            write(hid, files, meta)
        print('LIVE_SPLIT %-16s 차이 최대 %.3f%% · %dKB %s' % (hid, worst, size // 1024, 'OK' if ok else 'FAIL'))
        (rows if ok else bad).append((hid, meta))
    if '--sheet' in a and do_write:
        sheet(rows, a[a.index('--sheet') + 1])
    print('LIVE_SPLIT 끝 %d/%d' % (len(rows), len(ids)))
    sys.exit(1 if bad else 0)


if __name__ == '__main__':
    main()
