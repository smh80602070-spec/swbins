"""Unity PBR 맵 .meta 고치기(K-0099) — 엔진이 만든 기본값(Default 텍스처·sRGB 켬)을 맵 종류에 맞춘다. 멱등.

  py tools/asset-place/patch_unity_pbr.py saga-unity/Assets/SagaCore/Resources/TexturesReal     # 아래 *.png.meta 전부

이름 끝으로 고른다: `*_n.png` = 법선(textureType 1 Normal map, sRGB 는 엔진이 끔) · `*_r.png`·`*_h.png` = 거칠기·높이(sRGBTexture 0, 선형)
· 나머지(바탕) 그대로(sRGB 켬). Repeat(wrap 0)·밉맵 켬은 엔진 기본값 그대로 — 바꾸지 않는다.
Android 압축은 자동(textureFormat -1, 프로젝트 기본 ASTC)을 둔다(형식 번호를 손으로 넣지 않음). 엔진이 새 .meta 를 만든 직후에 한 번 돌리고, 엔진을 한 번 더 불러 다시 임포트한다.
"""
import os
import re
import sys

root = os.path.abspath(sys.argv[1])
n = 0
for dp, _, fns in os.walk(root):
    for fn in fns:
        if not fn.endswith('.png.meta'):
            continue
        p = os.path.join(dp, fn)
        s = open(p, 'rb').read()
        t = s
        stem = fn[:-len('.png.meta')]
        if stem.endswith('_n'):
            t = re.sub(rb'(?m)^(  textureType: )\d+', rb'\g<1>1', t)
        elif stem.endswith('_r') or stem.endswith('_h'):
            t = re.sub(rb'(?m)^(    sRGBTexture: )\d', rb'\g<1>0', t)
        if t != s:
            open(p, 'wb').write(t)
            n += 1
print('고친 .meta', n)
