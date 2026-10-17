"""K-0130 유니티 Art/Environment/PBR 의 옛 사진 재질 7 → 자체 PBR(K-0093·K-0113 세트)로 **같은 이름·같은 크기·같은 채널 규약**으로 다시 굽는다.
  py tools/world-forge/k130_unity_pbr.py           # saga-assets/unity-pbr/ 에 쓴다(+ 쌍 시트 tools/world-forge/_out/k130/pairs.jpg)
그 뒤 `py tools/asset-place/place.py --write --item unity-pbr` 가 유니티 폴더를 덮는다(.meta guid 그대로 → .mat 연결 변경 0).

짝: data/k130_unity_pbr.json(세트·돌림). 입력 = tools/world-forge/_src/self/_png/<세트>/<세트>_hi{,_n,_r,_h}.png (make_self_src.py 가 만든다).
바탕색 = 세트 그림 × gain(옛 바탕색 평균 ÷ 세트 평균 — 장면 색이 그대로 가게) · 노멀 = 세트 것(OpenGL Y+, 옛 nor_gl 과 같은 규약) ·
거칠기 = 세트 것 · AO = 높이(_h)를 흐리게 해 오목한 곳만 어둡게(0.55~1) · metallicsmoothness = R·G·B 0(비금속), A = 255 − 거칠기(옛 파일과 같은 규약).
나무껍질·바위(diff 만, 셰이더가 회색 디테일로 곱함)는 바탕색만. 남의 사진 0 — 옛 파일은 크기·평균색을 재는 데만 읽는다.
"""
import json
import os

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageStat

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
UNITY = os.path.join(ROOT, 'saga-unity', 'Assets', 'Art', 'Environment', 'PBR')
OUT = os.path.join(ROOT, 'saga-assets', 'unity-pbr')
SRC = os.path.join(HERE, '_src', 'self', '_png')
TABLE = json.load(open(os.path.join(HERE, 'data', 'k130_unity_pbr.json'), encoding='utf-8'))


def load_set(name, rot):
    def rd(sfx, mode):
        p = os.path.join(SRC, name, '%s_hi%s.png' % (name, sfx))
        im = Image.open(p).convert(mode)
        return im.rotate(90, expand=True) if rot else im
    n = rd('_n', 'RGB')
    if rot:   # 그림을 90° 돌리면 법선의 x·y 도 돌려야 한다(빛 방향이 안 틀어지게)
        a = np.asarray(n, np.float32) - 128.0
        a = np.stack([-a[..., 1], a[..., 0], a[..., 2]], -1) + 128.0
        n = Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))
    return rd('', 'RGB'), n, rd('_r', 'L'), rd('_h', 'L')


def main():
    os.makedirs(os.path.join(HERE, '_out', 'k130'), exist_ok=True)
    pairs = []
    rows = {}
    for folder, spec in TABLE['items'].items():
        key = spec['key']
        src = os.path.join(UNITY, folder)
        dst = os.path.join(OUT, folder)
        os.makedirs(dst, exist_ok=True)
        old_diff = os.path.join(src, key + '_diff_1k.jpg')
        size = Image.open(old_diff).size
        ims = load_set(spec['set'], spec.get('rot', False))
        k = int(spec.get('squeeze_x', 1))
        if k > 1:   # 가로로 1/k 눌러 k 번 이어 붙임 — 결이 세로로 길어지고 이음매는 그대로(법선 x 는 k 배 가팔라짐 → 그대로 둠, 세기는 세트 것)
            def sq(im):
                w, h = im.size
                small = im.resize((w // k, h), Image.LANCZOS)
                out = Image.new(im.mode, (w // k * k, h))
                for j in range(k):
                    out.paste(small, (j * (w // k), 0))
                return out
            ims = tuple(sq(im) for im in ims)
        base, nor, rough, hgt = (im.resize(size, Image.LANCZOS) for im in ims)
        om = np.array(ImageStat.Stat(Image.open(old_diff).convert('RGB')).mean)
        sm = np.array(ImageStat.Stat(base).mean)
        gain = om / np.maximum(sm, 1)
        diff = Image.fromarray(np.clip(np.asarray(base, np.float32) * gain, 0, 255).astype(np.uint8))
        made = {}
        diff.save(os.path.join(dst, key + '_diff_1k.jpg'), quality=92)
        made['diff'] = key + '_diff_1k.jpg'
        if os.path.exists(os.path.join(src, key + '_nor_gl_1k.jpg')):
            nor.save(os.path.join(dst, key + '_nor_gl_1k.jpg'), quality=95)
            rough.save(os.path.join(dst, key + '_rough_1k.jpg'), quality=92)
            h = np.asarray(hgt.filter(ImageFilter.GaussianBlur(3)), np.float32) / 255.0
            ao = np.clip(0.55 + 0.45 * (h - h.min()) / max(1e-6, h.max() - h.min()) ** 1.0, 0, 1)
            Image.fromarray((ao * 255).astype(np.uint8)).save(os.path.join(dst, key + '_ao_1k.jpg'), quality=92)
            r = np.asarray(rough, np.uint8)
            ms = np.zeros(r.shape + (4,), np.uint8)
            ms[..., 3] = 255 - r
            Image.fromarray(ms, 'RGBA').save(os.path.join(dst, key + '_metallicsmoothness_1k.png'))
            made.update(nor=key + '_nor_gl_1k.jpg', rough=key + '_rough_1k.jpg', ao=key + '_ao_1k.jpg', ms=key + '_metallicsmoothness_1k.png')
        json.dump({'id': folder, 'ticket': 'K-0130', 'generator': 'tools/world-forge/k130_unity_pbr.py',
                   'license': 'self-pbr: ' + spec['set'] + ' (자체 생성 PBR — Z-Image-Turbo Apache-2.0 견본 → pbr_from_albedo.py, 남의 사진 0)',
                   'set': spec['set'], 'rot90': bool(spec.get('rot')), 'squeeze_x': int(spec.get('squeeze_x', 1)), 'gain': [round(float(x), 3) for x in gain], 'files': made},
                  open(os.path.join(dst, 'self.license.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
        rows[folder] = (round(float(om.mean())), round(float(np.asarray(diff, np.float32).mean())))
        pairs.append((folder, Image.open(old_diff).convert('RGB'), diff))
    lic = ('자체 PBR(K-0130, 2026-10-17) — 이 폴더의 텍스처는 전부 saga-assets/unity-pbr 정본을 asset-place 가 놓은 것.\n'
           '바탕 = 자체 생성 견본(Z-Image-Turbo, Apache-2.0) → tools/ai-art/pbr_from_albedo.py 로 법선·거칠기·높이(K-0093·K-0113).\n'
           '파일 이름은 옛 것(.meta guid·.mat 연결 유지)을 그대로 둔다. 남의 사진 0. 짝 표: tools/world-forge/data/k130_unity_pbr.json\n')
    open(os.path.join(OUT, 'LICENSE.txt'), 'w', encoding='utf-8').write(lic)
    S = 220
    sheet = Image.new('RGB', (S * 2 + 10, (S + 16) * len(pairs)), 'white')
    d = ImageDraw.Draw(sheet)
    for i, (f, a, b) in enumerate(pairs):
        y = i * (S + 16)
        d.text((4, y + 2), f + '  옛 → 새', fill='black')
        sheet.paste(a.resize((S, S)), (0, y + 16))
        sheet.paste(b.resize((S, S)), (S + 10, y + 16))
    sheet.save(os.path.join(HERE, '_out', 'k130', 'pairs.jpg'), quality=88)
    print('K130', len(pairs), rows)


if __name__ == '__main__':
    main()
