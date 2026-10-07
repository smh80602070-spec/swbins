#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
GLB 텍스처 다시 칠하기(retex) — 재질 이름으로 골라 baseColor 텍스처의 **밝기 결만 남기고 색을 새로 입힌다**.

2026-09-23, 사가천하 동양풍 탑(`city_t2_asian`·`city_t3_asian`)에서 만들었다. `palette.py snap-glb` 로
물들인 결과가 기둥은 회색, 판재는 검은 바탕에 빨간 줄, 지붕은 민 회색으로 나왔고, 원본 사이버 팩의
광고판 아틀라스(`CyberAd`, 커피잔·PLAY 글자)가 탑에 그대로 붙어 있었다(헤드리스 스크린샷·텍스처 추출로 확인).

    python retex_glb.py <입력.glb> <출력.glb> --map 재질=규칙 [--map ...]

규칙
    grad:R,G,B:R,G,B   밝기(2~98 백분위로 늘인 뒤)를 어두운 색 → 밝은 색 사이로 옮긴다(0~1 실수). 알파는 그대로
    hide               알파를 0 으로(재질이 OPAQUE 면 MASK 로 바꾼다) — 그 부품이 안 보인다

같은 이미지를 두 재질이 나눠 쓰면 먼저 나온 규칙이 이긴다. 다른 청크·확장·노멀 맵은 손대지 않는다.
의존: numpy·Pillow(표준 GLB 파서는 직접 짰다 — pygltflib 불필요).
"""

import argparse
import io
import json
import struct
import sys

import numpy as np
from PIL import Image


def read_glb(path):
    b = open(path, 'rb').read()
    magic, ver, total = struct.unpack_from('<III', b, 0)
    if magic != 0x46546C67:
        sys.exit('GLB 가 아니다: ' + path)
    off, js, binc = 12, None, b''
    while off < total:
        ln, typ = struct.unpack_from('<II', b, off)
        chunk = b[off + 8: off + 8 + ln]
        if typ == 0x4E4F534A:
            js = json.loads(chunk.decode('utf-8'))
        elif typ == 0x004E4942:
            binc = chunk
        off += 8 + ln
    return js, binc


def write_glb(path, js, views):
    """views: bufferView 순서대로의 바이트. 4바이트 정렬로 다시 이어 붙이고 offset·길이를 고친다"""
    out = bytearray()
    for i, data in enumerate(views):
        while len(out) % 4:
            out.append(0)
        js['bufferViews'][i]['byteOffset'] = len(out)
        js['bufferViews'][i]['byteLength'] = len(data)
        js['bufferViews'][i]['buffer'] = 0
        out += data
    while len(out) % 4:
        out.append(0)
    js['buffers'] = [{'byteLength': len(out)}]
    jb = json.dumps(js, ensure_ascii=False, separators=(',', ':')).encode('utf-8')
    while len(jb) % 4:
        jb += b' '
    total = 12 + 8 + len(jb) + 8 + len(out)
    with open(path, 'wb') as f:
        f.write(struct.pack('<III', 0x46546C67, 2, total))
        f.write(struct.pack('<II', len(jb), 0x4E4F534A) + jb)
        f.write(struct.pack('<II', len(out), 0x004E4942) + bytes(out))


def parse_rule(s):
    if s == 'hide':
        return ('hide',)
    p = s.split(':')
    if len(p) == 3 and p[0] == 'grad':
        lo = [float(x) for x in p[1].split(',')]
        hi = [float(x) for x in p[2].split(',')]
        if len(lo) == 3 and len(hi) == 3:
            return ('grad', np.array(lo), np.array(hi))
    sys.exit('규칙을 못 읽었다: ' + s)


def apply_rule(png, rule):
    im = Image.open(io.BytesIO(png)).convert('RGBA')
    a = np.asarray(im).astype(np.float64) / 255.0
    if rule[0] == 'hide':
        a[..., 3] = 0.0
    else:
        lum = a[..., 0] * 0.299 + a[..., 1] * 0.587 + a[..., 2] * 0.114
        lo, hi = np.percentile(lum, 2), np.percentile(lum, 98)
        t = np.clip((lum - lo) / (hi - lo), 0, 1) if hi - lo > 1e-4 else np.full_like(lum, 0.5)
        for c in range(3):
            a[..., c] = rule[1][c] + (rule[2][c] - rule[1][c]) * t
    out = io.BytesIO()
    Image.fromarray((np.clip(a, 0, 1) * 255 + 0.5).astype(np.uint8), 'RGBA').save(out, 'PNG', optimize=True)
    return out.getvalue()


def main():
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[1])
    ap.add_argument('src')
    ap.add_argument('dst')
    ap.add_argument('--map', action='append', default=[], help='재질=규칙')
    o = ap.parse_args()
    js, binc = read_glb(o.src)
    views = []
    for bv in js['bufferViews']:
        s = bv.get('byteOffset', 0)
        views.append(binc[s: s + bv['byteLength']])
    rules = {}
    for m in o.map:
        k, _, v = m.partition('=')
        rules[k] = parse_rule(v)
    done = set()
    for mat in js.get('materials', []):
        rule = rules.get(mat.get('name'))
        if not rule:
            continue
        tex = mat.get('pbrMetallicRoughness', {}).get('baseColorTexture')
        if tex is None:
            print('  건너뜀(베이스 텍스처 없음):', mat.get('name'))
            continue
        img = js['textures'][tex['index']]['source']
        if img in done:
            continue
        bvi = js['images'][img]['bufferView']
        views[bvi] = apply_rule(views[bvi], rule)
        js['images'][img]['mimeType'] = 'image/png'
        if rule[0] == 'hide' and mat.get('alphaMode', 'OPAQUE') == 'OPAQUE':
            mat['alphaMode'] = 'MASK'
        done.add(img)
        print('  ', mat.get('name'), '→', rule[0])
    missing = [k for k in rules if k not in [m.get('name') for m in js.get('materials', [])]]
    if missing:
        print('  (이 GLB 에 없는 재질:', ', '.join(missing) + ')')
    write_glb(o.dst, js, views)
    print('wrote', o.dst)


if __name__ == '__main__':
    main()
