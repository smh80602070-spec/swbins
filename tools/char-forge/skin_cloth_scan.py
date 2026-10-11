"""K-0097 단계 1 — 살색 옷 조각 전수 조사. 샘플(_out/parts/<글자>)의 옷 조각(top·bottom·cloth) 바탕색 그림에서
불투명 픽셀 중 '피부색 영역'(Lab 밝기 55~95 · 채도 10~45 · 색상각 20~70°, 복숭아·연어·살구빛)에 드는 비율을 재서
기준(기본 10%) 넘는 조각을 고른다 — 웹 3D 무광에서 피부와 한 덩어리로 보이는 옷(K-0097: 샘플 L 윗옷 CLOTH_02).

  py tools/char-forge/skin_cloth_scan.py [--ratio 0.10] [--sheet <png>] [--json <out.json>]

샘플 피부와 '같은 색'(ΔE)으로 재면 흰·크림 셔츠가 다 걸리고(밝은 피부와 밝기만 비슷) 몸 질감은 속옷·빈 칸이 섞여
피부값이 틀어진다(10-11 시험) → 색상·채도 영역으로 잰다. 흰·회색(채도 < 10)·크림(색상 > 70°)은 안 걸린다.
입은 인물 = 조합표(data/outfit_swap_plan.json) 에서 그 샘플을 그 칸에 입고 그 칸에 무늬(pattern)가 없는 인물.
원피스(cloth) 칸은 그 샘플의 top·bottom 조각까지 함께 입는다(outfit_swap.py 와 같음). GLB 는 Blender 없이 직접 읽는다.
"""
import io
import json
import os
import struct
import sys

import numpy as np
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
PARTS = os.path.join(HERE, '_out', 'parts')
PLAN = os.path.join(HERE, 'data', 'outfit_swap_plan.json')
GAMUT = dict(L=(55, 95), C=(10, 45), h=(20, 70))


def glb_images(path):
    """GLB 의 재질 이름 → 바탕색 그림(RGBA PIL)."""
    f = open(path, 'rb').read()
    n = struct.unpack('<I', f[12:16])[0]
    j = json.loads(f[20:20 + n])
    off = 20 + n
    bin_ = f[off + 8:off + 8 + struct.unpack('<I', f[off:off + 4])[0]]
    out = {}
    for m in j.get('materials', []):
        t = m.get('pbrMetallicRoughness', {}).get('baseColorTexture')
        if t is None:
            continue
        img = j['images'][j['textures'][t['index']]['source']]
        bv = j['bufferViews'][img['bufferView']]
        data = bin_[bv.get('byteOffset', 0):bv.get('byteOffset', 0) + bv['byteLength']]
        out[m.get('name', '?')] = Image.open(io.BytesIO(data)).convert('RGBA')
    return out


def lab(rgb):
    """sRGB 0..255 (…,3) → CIE Lab (D65)."""
    c = rgb.astype(np.float64) / 255.0
    c = np.where(c > 0.04045, ((c + 0.055) / 1.055) ** 2.4, c / 12.92)
    M = np.array([[0.4124, 0.3576, 0.1805], [0.2126, 0.7152, 0.0722], [0.0193, 0.1192, 0.9505]])
    xyz = c @ M.T / np.array([0.95047, 1.0, 1.08883])
    f = np.where(xyz > 0.008856, np.cbrt(xyz), 7.787 * xyz + 16 / 116)
    return np.stack([116 * f[..., 1] - 16, 500 * (f[..., 0] - f[..., 1]), 200 * (f[..., 1] - f[..., 2])], -1)


def skin_ratio(px):
    """불투명 픽셀(N,3) 중 피부색 영역 비율."""
    L = lab(px)
    C = np.hypot(L[:, 1], L[:, 2])
    h = np.degrees(np.arctan2(L[:, 2], L[:, 1])) % 360
    g = GAMUT
    m = (L[:, 0] > g['L'][0]) & (L[:, 0] < g['L'][1]) & (C > g['C'][0]) & (C < g['C'][1]) & (h > g['h'][0]) & (h < g['h'][1])
    return float(m.mean())


def opaque(img, cap=512):
    im = img.copy()
    im.thumbnail((cap, cap))
    a = np.asarray(im)
    return a[..., :3][a[..., 3] > 128]


def wearers(plan, sample, slot):
    out = []
    for e in plan:
        for k, src in e.get('kit', {}).items():
            if src != sample or not (k == slot or (k == 'cloth' and slot in ('top', 'bottom'))):
                continue
            pt = e.get('pattern')
            if pt and pt.get('slot') == k:
                continue
            out.append(e['id'])
    return sorted(set(out))


def main():
    a = sys.argv[1:]
    opt = lambda k, d=None: a[a.index(k) + 1] if k in a else d
    thr = float(opt('--ratio', '0.10'))
    plan = json.load(open(PLAN, encoding='utf-8'))['entries']
    rows = []
    for s in sorted(os.listdir(PARTS)):
        pj = os.path.join(PARTS, s, 'parts.json')
        if not os.path.exists(pj) or s.startswith('hero_'):
            continue
        for p in json.load(open(pj, encoding='utf-8'))['parts']:
            if p['slot'] not in ('top', 'bottom', 'cloth'):
                continue
            for mname, img in glb_images(os.path.join(PARTS, s, p['file'])).items():
                px = opaque(img)
                if len(px):
                    rows.append(dict(sample=s, slot=p['slot'], file=p['file'], material=mname, ratio=round(skin_ratio(px), 3),
                                     wear=wearers(plan, s, p['slot']), _img=img))
    bad = sorted((r for r in rows if r['ratio'] >= thr), key=lambda r: -r['ratio'])
    print('조각 %d · 피부색 영역 %d%% 넘음 %d' % (len(rows), round(thr * 100), len(bad)))
    for r in bad:
        print('  %-4s %-6s %-48s 피부색 %4.0f%% · 입은 무늬 없는 인물 %d' % (r['sample'], r['slot'], r['file'], r['ratio'] * 100, len(r['wear'])))
    if opt('--json'):
        json.dump([{k: v for k, v in r.items() if k != '_img'} for r in bad], open(opt('--json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    if opt('--sheet') and bad:
        S, cols = 320, min(4, len(bad))
        sh = Image.new('RGB', (S * cols, (S + 30) * ((len(bad) + cols - 1) // cols)), (60, 60, 64))
        dr = ImageDraw.Draw(sh)
        for k, r in enumerate(bad):
            x, y = (k % cols) * S, (k // cols) * (S + 30)
            t = r['_img'].copy()
            t.thumbnail((S, S))
            bg = Image.new('RGB', t.size, (60, 60, 64))
            bg.paste(t, (0, 0), t)
            sh.paste(bg, (x, y + 30))
            dr.text((x + 3, y + 2), '%s %s %d%% n%d' % (r['sample'], r['slot'], r['ratio'] * 100, len(r['wear'])), fill=(255, 255, 255))
            dr.text((x + 3, y + 15), r['file'][:44], fill=(200, 200, 200))
        sh.save(opt('--sheet'))
    print('SCAN_OK')


if __name__ == '__main__':
    main()
