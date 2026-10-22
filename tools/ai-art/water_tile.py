"""K-0165 — 2D 물 바탕 타일(256px, 이음매 없음)을 코드로 그린다(GPU·SD 안 씀, 외부 입력 없음).

  py tools/ai-art/water_tile.py [forest_water,realm_water] [--out <폴더>]
      → <out>/<이름>.webp + .license.json (기본 out = saga-assets/web2d/tile — 그 판 지금 물 바탕 자리 그대로)

K-0162 눈 판정: 3마을(forest_water)·5천하(realm_water) 의 SD 물 타일이 풀빛 비늘·나뭇결이라 물로 안 읽혔다.
그림체 C(부드러운 동화풍 — 파스텔·둥근 결·옅은 빛) 에 맞춰: 깊이 얼룩(낮은 진동수) · 휘인 잔물결 띠 · 물결 마루 밝은 선 · 반짝임.
모든 무늬가 정수 진동수 사인 합 → x·y 모두 256 주기라 이음매가 없다.
"""
import json
import os
import sys

import numpy as np
from PIL import Image, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
sys.path.insert(0, HERE)
from edge_tiles import periodic_noise2  # noqa: E402

N = 256
# 이름: (깊은 색, 얕은 색, 마루 색, 잔물결 진동수, 씨앗, 설명)
SPEC = {
    'forest_water': ((74, 150, 196), (138, 206, 226), (236, 250, 252), 9, 16501, '3마을 연못 — 맑은 청록 파스텔'),
    'realm_water': ((58, 112, 176), (112, 170, 214), (226, 240, 250), 7, 16502, '5천하 지도 강 — 조금 깊은 푸른 물'),
    'go_water': ((44, 112, 112), (92, 170, 150), (224, 246, 234), 8, 17901, '1만리 물 — 초록빛 도는 청록 물(옛 타일 색, K-0179)'),
}


def make(name):
    deep, shallow, crest, k, seed, _d = SPEC[name]
    rng = np.random.default_rng(seed)
    yy, xx = np.indices((N, N)).astype(np.float32) / N * 2 * np.pi
    depth = periodic_noise2(seed, terms=((1, 1.0), (2, 0.7), (3, 0.4)))            # 깊이 얼룩
    depth = (depth - depth.min()) / (depth.max() - depth.min())
    warp = periodic_noise2(seed + 1, terms=((2, 1.0), (3, 0.7), (4, 0.4))) * 2.2      # 물결 휘기
    rip = np.zeros((N, N), np.float32)
    for fx, fy, amp in ((k, 1, 1.0), (k - 2, -2, 0.6), (k + 3, 2, 0.35)):            # 거의 가로 띠(위에서 본 잔물결)
        rip += amp * np.sin(fy * xx + fx * yy + warp * (1.0 + 0.3 * amp) + rng.uniform(0, 2 * np.pi))
    rip /= 1.95
    base = np.array(deep, np.float32) * (1 - depth[..., None]) + np.array(shallow, np.float32) * depth[..., None]
    base *= (1 + 0.06 * rip)[..., None]                                              # 물결 골·마루 명암
    cr = np.clip((rip - 0.45) / 0.3, 0, 1) ** 1.3                                    # 마루 밝은 선
    brk = np.clip(0.55 + periodic_noise2(seed + 2, terms=((5, 1.0), (8, 0.7), (13, 0.5))) * 1.6, 0, 1)   # 선이 군데군데 끊김
    cr *= brk
    rgb = base * (1 - 0.6 * cr[..., None]) + np.array(crest, np.float32) * 0.6 * cr[..., None]
    sp = periodic_noise2(seed + 3, terms=((19, 1.0), (27, 0.8), (37, 0.6)))         # 반짝임
    sp = np.clip((sp - 0.80) / 0.10, 0, 1) * np.clip((depth - 0.3) / 0.3, 0, 1)
    rgb = rgb * (1 - 0.4 * sp[..., None]) + 255 * 0.4 * sp[..., None]
    im = Image.fromarray(np.clip(rgb, 0, 255).astype(np.uint8), 'RGB')
    big = Image.new('RGB', (N * 3, N * 3))                                           # 감싸서 흐림 → 이음 유지
    for i in range(3):
        for j in range(3):
            big.paste(im, (i * N, j * N))
    return big.filter(ImageFilter.GaussianBlur(0.9)).crop((N, N, 2 * N, 2 * N))


def seam(im):
    a = np.asarray(im).astype(np.float32)
    s = (np.abs(a[:, -1] - a[:, 0]).mean() + np.abs(a[-1] - a[0]).mean()) / 2
    inner = (np.abs(np.diff(a, axis=1)).mean() + np.abs(np.diff(a, axis=0)).mean()) / 2
    return float(s - inner)


def main(argv):
    out = os.path.join(ROOT, 'saga-assets', 'web2d', 'tile')
    if '--out' in argv:
        i = argv.index('--out')
        out = argv[i + 1]
        argv = argv[:i] + argv[i + 2:]
    names = argv[0].split(',') if argv else list(SPEC)
    os.makedirs(out, exist_ok=True)
    for n in names:
        im = make(n)
        p = os.path.join(out, n + '.webp')
        im.save(p, 'WEBP', quality=90, method=6)
        e = seam(Image.open(p).convert('RGB'))
        lic = {'id': n, 'generator': 'tools/ai-art/water_tile.py', 'model': '', 'license': 'CC0-1.0 (코드로 그린 그림 — 외부 입력 없음)',
               'derived': '주기 사인 합(깊이 얼룩·휘인 잔물결·마루 선·반짝임) — 256 주기 이음매 없음, 그림체 C 파스텔 물빛',
               'note': SPEC[n][5] + ' · K-0162 SD 물 타일(풀빛 비늘)을 바꿈', 'px': N, 'date': '2026-10-21', 'ticket': 'K-0165'}
        json.dump(lic, open(os.path.join(out, n + '.license.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
        print('WATER', n, 'seam_excess=%.2f' % e, os.path.getsize(p) // 1024, 'KB')


if __name__ == '__main__':
    main(sys.argv[1:])
