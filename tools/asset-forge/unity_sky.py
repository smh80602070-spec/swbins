"""K-0064 Unity 용 하늘·구름·날씨 입자 — 정본 saga-assets/sky(webp) 를 Unity 가 읽는 jpg·png 로 바꿔 saga-assets/sky-unity 에 쓴다.
Unity 는 WebP 를 기본으로 못 읽는다. 하늘 12 → 2048×1024 jpg(Skybox/Panoramic) · 구름 3 → png(알파) · 입자 3·표식 json 은 그대로. 1k 경량본은 웹용이라 건너뜀.

  py tools/asset-forge/unity_sky.py
"""
import glob
import json
import os
import shutil

from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
SRC = os.path.join(ROOT, 'saga-assets', 'sky')
DST = os.path.join(ROOT, 'saga-assets', 'sky-unity')


def lic_copy(base, note):
    s = os.path.join(SRC, base + '.license.json')
    lic = json.load(open(s, encoding='utf-8')) if os.path.exists(s) else {}
    lic.update({'converted_for': 'unity', 'converted_by': 'tools/asset-forge/unity_sky.py', 'unity_note': note})
    json.dump(lic, open(os.path.join(DST, base + '.license.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)


def main():
    os.makedirs(DST, exist_ok=True)
    n = {'sky': 0, 'cloud': 0, 'fx': 0}
    for p in sorted(glob.glob(os.path.join(SRC, 'sky_*.webp'))):
        base = os.path.splitext(os.path.basename(p))[0]
        if base.endswith('_1k'):
            continue
        Image.open(p).convert('RGB').save(os.path.join(DST, base + '.jpg'), 'JPEG', quality=92, optimize=True)
        lic_copy(base, 'equirect 2:1 · Skybox/Panoramic · Texture 2D sRGB · Wrap Clamp')
        n['sky'] += 1
    for p in sorted(glob.glob(os.path.join(SRC, 'cloud_layer_*.webp'))):
        base = os.path.splitext(os.path.basename(p))[0]
        Image.open(p).convert('RGBA').save(os.path.join(DST, base + '.png'), 'PNG', optimize=True)
        lic_copy(base, '알파 포함 · Alpha Is Transparency · 좌우 이음매 · Wrap Repeat')
        n['cloud'] += 1
    for p in sorted(glob.glob(os.path.join(SRC, 'fx_*.png'))):
        base = os.path.splitext(os.path.basename(p))[0]
        shutil.copyfile(p, os.path.join(DST, base + '.png'))
        lic_copy(base, '알파 포함 · Alpha Is Transparency')
        n['fx'] += 1
    shutil.copyfile(os.path.join(SRC, 'sky_markers.json'), os.path.join(DST, 'sky_markers.json'))
    tot = sum(os.path.getsize(f) for f in glob.glob(os.path.join(DST, '*')) if not f.endswith('.license.json'))
    print('하늘', n['sky'], '구름', n['cloud'], '입자', n['fx'], f'· {tot / 2**20:.2f}MB')


if __name__ == '__main__':
    main()
