"""K-0193 — 3D 땅 섞음 결: 자체 PBR 바탕색 두셋(K-0093 정본 textures_real)을 감싼(이음매 없는) 잡음 가면으로 섞어
「갈색 한 장」 땅을 흙·자갈·풀이 얼룩진 바탕색으로. GPU·SD 안 씀 — 파생물이라 출처 = 재료 license 들.

  py tools/ai-art/ground_mix.py [mud_gravel,path_grass,field_mix]
      → tools/ai-art/_out/k93_pbr/<이름>_v01.png + .license.json (1024, 감싼 이음)
  그다음 `py tools/ai-art/pbr_from_albedo.py --sets <이름>` 이 법선·거칠기·높이 + 정본·고돗 자리를 만든다(SETS·k93_picks 에 이름 있음).

가면 = 정수 진동수만 남긴 저주파 잡음(FFT 로 거른 흰 잡음 → 1024 주기로 감김) — 문턱·부드러움으로 얼룩 크기와 경계 폭을 정한다.
섞는 재료는 이미 이음매 처리된 고돗 `tiles_real/<세트>_hi.webp` 를 1024 로 감싸 늘려 쓴다(경계 자르기 세트는 ≈910).
"""
import json
import os
import sys

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
TILES = os.path.join(ROOT, 'saga-godot', 'assets', 'generated', 'tiles_real')
CANON = os.path.join(ROOT, 'saga-assets', 'textures_real')
OUT = os.path.join(HERE, '_out', 'k93_pbr')
N = 1024

# 이름 → 바탕 재료 + [(덮는 재료, 얼룩 크기(진동수 상한), 문턱 0~1(클수록 덜 덮음), 경계 부드러움, 씨앗)]
MIXES = {
    'mud_gravel': ('dirt', [('gravel', 6, 0.58, 0.10, 11), ('rock', 7, 0.86, 0.06, 12)]),                  # 2나락 마을 땅(큰 바위 얼룩 하나는 반복이 보여 잘게)
    'path_grass': ('dirt', [('grass', 4, 0.52, 0.12, 21), ('gravel', 9, 0.78, 0.05, 22)]),                  # 3마을 광장 흙길·풀
    'field_mix': ('grass', [('dirt', 5, 0.62, 0.14, 31), ('sand', 7, 0.84, 0.10, 32)]),                     # 5천하 들판 풀·흙·마른 밭
}


def tile(name):
    im = Image.open(os.path.join(TILES, name + '_hi.webp')).convert('RGB')
    return np.asarray(im.resize((N, N), Image.LANCZOS), dtype=np.float32) / 255.0


def mask(freq, thr, soft, seed):
    """감싼 저주파 잡음 0~1 → 문턱 부드러운 계단. 정수 진동수만이라 N 주기로 정확히 이어진다."""
    rng = np.random.default_rng(seed)
    f = np.fft.fft2(rng.standard_normal((N, N)))
    ky = np.fft.fftfreq(N) * N
    kx = np.fft.fftfreq(N) * N
    r = np.sqrt(ky[:, None] ** 2 + kx[None, :] ** 2)
    f *= np.exp(-(r / freq) ** 2)                       # 가우스 저역 — 얼룩 크기
    # 잔 결: 높은 진동수 약간(경계가 매끈한 곡선이 아니라 바스러지게)
    g = np.fft.fft2(rng.standard_normal((N, N))) * np.exp(-(r / (freq * 8)) ** 2)
    n = np.real(np.fft.ifft2(f))
    n2 = np.real(np.fft.ifft2(g))
    n = (n - n.mean()) / (n.std() + 1e-6) + 0.25 * (n2 - n2.mean()) / (n2.std() + 1e-6)
    n = 0.5 + 0.5 * np.tanh(n * 0.8)                    # 0~1
    return np.clip((n - thr) / soft * 0.5 + 0.5, 0, 1)


def build(name):
    base, layers = MIXES[name]
    img = tile(base)
    lum0 = img.mean()
    srcs = [base]
    for mat, freq, thr, soft, seed in layers:
        top = tile(mat)
        top = top * (lum0 / max(top.mean(), 1e-3)) ** 0.35     # 밝기 차를 조금 줄여 얼룩이 튀지 않게
        m = mask(freq, thr, soft, seed)[..., None]
        img = img * (1 - m) + top * m
        srcs.append(mat)
    os.makedirs(OUT, exist_ok=True)
    out = os.path.join(OUT, f'{name}_v01.png')
    Image.fromarray(np.clip(img * 255 + 0.5, 0, 255).astype(np.uint8)).save(out)
    lic = {'id': name, 'ticket': 'K-0193', 'generator': 'tools/ai-art/ground_mix.py (코드 섞기 — GPU·SD 안 씀)',
           'license': '파생물 — 재료 자체 PBR 바탕색(K-0093, 로컬 AI 상업 허용 모델)의 license 를 따른다',
           'inputs': {s: json.load(open(os.path.join(CANON, s, s + '.license.json'), encoding='utf-8')).get('model') for s in srcs},
           'mix': {'base': base, 'layers': [dict(zip(('mat', 'freq', 'thr', 'soft', 'seed'), l)) for l in layers]}}
    json.dump(lic, open(os.path.splitext(out)[0] + '.license.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    # 이음 확인: 맞닿은 가장자리 차 / 안쪽 이웃 차
    a = img
    seam = np.abs(a[:, 0] - a[:, -1]).mean() + np.abs(a[0] - a[-1]).mean()
    inner = np.abs(a[:, 1] - a[:, 0]).mean() + np.abs(a[1] - a[0]).mean()
    print('MIX', name, out, 'seam_ratio %.2f' % (seam / max(inner, 1e-6)))


if __name__ == '__main__':
    names = sys.argv[1].split(',') if len(sys.argv) > 1 else list(MIXES)
    for n in names:
        build(n)
