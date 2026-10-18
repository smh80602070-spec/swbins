"""짐승 GLB 재질·결 밝기 고치기 — TRELLIS(K-0096) 결과가 게임에서 검은 덩어리로 보이던 두 원인을 GLB 제자리에서 고친다.
  py tools/glb-compress/creature_fix.py saga-assets/creatures3d            # 폴더 전부(멱등 — 이미 고친 것은 건너뜀)
  py tools/glb-compress/creature_fix.py <a.glb> [--out <폴더>] [--force] [--dry] [--area]

원인 ① 재질: glTF 는 metallicFactor 가 없으면 **1.0(금속)** — 털·가죽이 금속이면 확산광이 0 이라 환경 맵 없는 화면에선 검다.
        → metallicFactor 0 · roughnessFactor 0.85(무광).
원인 ② 결: TRELLIS 가 구운 baseColor 가 입력 그림보다 훨씬 어둡다(곰: 입력 전경 평균 92·95·110 → 결 32·32·36, 10-17 실측).
        → 입력 그림(.license.json `input_image`) 전경의 채널별 평균·표준편차에 결을 affine 으로 맞춘다(이득 상한 4배·대비 0.7~1.35배, 검은 여백 texel 제외).
        통계는 **메시가 실제로 쓰는 texel**(UV 삼각형을 래스터한 마스크)로 잰다 — TRELLIS 아틀라스의 안 쓰는 검은 여백이 평균을 끌어내려
        쓰는 texel 이 과하게 밝아지던 것(10-17 곰 렌더가 희게 나옴)을 막는다. UV 는 압축 전 원본(tools/ai-art/_out/remote3d/*/<이름>.glb ·
        tools/_out/creature_rig/k96/)에서 읽고, 없으면 밝기 마스크(검은 여백 제외)로.  입력 그림이 없으면 ①만.
④ `--area`(K-0143): texel 넓이 통계가 **몸 겉면 넓이**와 다르다 — TRELLIS 아틀라스는 다리·배 같은 어두운 조각에 texel 을 많이 줘
        평균이 어둡게 잡히고, 그걸 입력 평균까지 끌어올리면 넓은 몸통이 희게 날아간다(10-18 황소: 갈색 입력 → 흰분홍 몸).
        → 삼각형마다 (3D 넓이 / UV 넓이) 가중으로 평균을 재고, affine 대신 채널별 감마로 맞춰(흰 곳은 흰 채 — 날림 없음)
        **원본 결**(압축 전 raw GLB 의 그림 — 밝히기 전)에서 다시 맞춘다(이미 날아간 밝은 곳을 되살림). `--force --area` 로 대상만.
        TRELLIS 메시는 안쪽·밑면 넓이가 커서 겉면 평균도 보이는 쪽과 어긋난다 → 종마다 톤 배율 `data/k143_tone.json`({id: 배율},
        목표 평균 × 배율)을 렌더로 맞춘다(`creature_color_check.py` 의 렌더 밝기 차가 전 종 중앙값 = 조명 몫에 오도록, K-0143).
③ `asset.extras.saga_creature_fix = 1` 표시 → 다시 돌려도 건너뜀(--force 면 다시).  .license.json 에 `postfix` 줄을 덧붙인다.

GLB 는 다시 인코딩하지 않는다 — JSON 조각과 BIN 의 그림 bufferView 만 바꾸고(meshopt 압축 스트림은 바이트 그대로 자리만 옮김), 쓰기 전에
모든 비그림 영역의 바이트가 원본과 같은지 확인한다(다르면 그 파일은 안 쓴다). 그림은 webp 는 webp(q90)·png 는 png 로 다시 저장.
표준 라이브러리 + Pillow. Blender·엔진 필요 없음.
"""
import glob
import io
import json
import os
import struct
import sys

from PIL import Image, ImageStat

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
METALLIC, ROUGHNESS = 0.0, 0.85
GAIN_MAX, STD_MIN, STD_MAX = 4.0, 0.7, 1.35


def read_glb(b):
    assert b[:4] == b'glTF', 'GLB 아님'
    ln = struct.unpack_from('<I', b, 12)[0]
    js = json.loads(b[20:20 + ln].decode('utf-8'))
    off = 20 + ln
    bl, kind = struct.unpack_from('<II', b, off)
    assert kind == 0x004E4942, 'BIN 조각 아님'
    return js, bytearray(b[off + 8:off + 8 + bl])


def write_glb(js, bin_):
    j = json.dumps(js, separators=(',', ':'), ensure_ascii=False).encode('utf-8')
    j += b' ' * (-len(j) % 4)
    bin_ = bytes(bin_) + b'\0' * (-len(bin_) % 4)
    total = 12 + 8 + len(j) + 8 + len(bin_)
    return b'glTF' + struct.pack('<II', 2, total) + struct.pack('<II', len(j), 0x4E4F534A) + j + struct.pack('<II', len(bin_), 0x004E4942) + bin_


def regions(js):
    """buffer 0 을 가리키는 모든 영역: (dict, 원 byteOffset, byteLength) — bufferView 자체와 meshopt 확장의 압축 원본."""
    out = []
    for bv in js['bufferViews']:
        if bv.get('buffer', 0) == 0 and 'byteLength' in bv:
            out.append((bv, bv.get('byteOffset', 0), bv['byteLength']))
        ext = bv.get('extensions', {}).get('EXT_meshopt_compression')
        if ext and ext.get('buffer', 0) == 0:
            out.append((ext, ext.get('byteOffset', 0), ext['byteLength']))
    return out


RAW_DIRS = [os.path.join(ROOT, 'tools', 'ai-art', '_out', 'remote3d'), os.path.join(ROOT, 'tools', '_out', 'creature_rig', 'k96')]
_CT = {5120: ('b', 1), 5121: ('B', 1), 5122: ('h', 2), 5123: ('H', 2), 5125: ('I', 4), 5126: ('f', 4)}
_NC = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4}


def _accessor(js, bin_, idx):
    a = js['accessors'][idx]
    bv = js['bufferViews'][a['bufferView']]
    if 'EXT_meshopt_compression' in bv.get('extensions', {}):
        raise ValueError('meshopt')
    fmt, sz = _CT[a['componentType']]
    nc = _NC[a['type']]
    stride = bv.get('byteStride') or sz * nc
    base = bv.get('byteOffset', 0) + a.get('byteOffset', 0)
    out = []
    for i in range(a['count']):
        vals = struct.unpack_from('<' + fmt * nc, bin_, base + i * stride)
        if a.get('normalized'):
            m = {'B': 255.0, 'H': 65535.0, 'b': 127.0, 'h': 32767.0}[fmt]
            vals = tuple(max(v / m, -1.0) for v in vals)
        out.append(vals)
    return out


def find_raw(name):
    """압축 전 같은 이름의 GLB(meshopt 없음) — 없으면 None."""
    cands = []
    for d in RAW_DIRS:
        cands += glob.glob(os.path.join(d, name + '.glb')) + glob.glob(os.path.join(d, '*', name + '.glb'))
    for c in sorted(cands):
        try:
            js, _ = read_glb(open(c, 'rb').read())
        except Exception:
            continue
        if 'EXT_meshopt_compression' not in js.get('extensionsUsed', []):
            return c
    return None


def uv_mask(raw_path, size):
    """메시가 쓰는 texel 마스크(L) — UV 삼각형을 채우고 가장자리 2px 여유."""
    from PIL import ImageDraw
    js, bin_ = read_glb(open(raw_path, 'rb').read())
    W, H = size
    m = Image.new('L', size, 0)
    d = ImageDraw.Draw(m)
    tris = 0
    for mesh in js.get('meshes', []):
        for prim in mesh.get('primitives', []):
            if 'TEXCOORD_0' not in prim['attributes']:
                continue
            uv = _accessor(js, bin_, prim['attributes']['TEXCOORD_0'])
            if 'indices' in prim:
                idx = [i[0] for i in _accessor(js, bin_, prim['indices'])]
            else:
                idx = list(range(len(uv)))
            for t in range(0, len(idx) - 2, 3):
                pts = [(uv[idx[t + k]][0] * W, uv[idx[t + k]][1] * H) for k in range(3)]
                d.polygon(pts, fill=255, outline=255)
                tris += 1
    if tris == 0:
        return None
    return m.filter(__import__('PIL.ImageFilter', fromlist=['MaxFilter']).MaxFilter(5))


def area_weights(raw_path, size):
    """texel 가중 지도(numpy float, size) — 삼각형마다 3D 넓이 / UV 넓이(px²) 를 그 삼각형 texel 에 채운다(겹치면 나중 것)."""
    import numpy as np
    from PIL import ImageDraw
    js, bin_ = read_glb(open(raw_path, 'rb').read())
    W, H = size
    m = Image.new('F', size, 0.0)
    d = ImageDraw.Draw(m)
    tris = 0
    for mesh in js.get('meshes', []):
        for prim in mesh.get('primitives', []):
            at = prim['attributes']
            if 'TEXCOORD_0' not in at or 'POSITION' not in at:
                continue
            uv = _accessor(js, bin_, at['TEXCOORD_0'])
            ps = _accessor(js, bin_, at['POSITION'])
            idx = [i[0] for i in _accessor(js, bin_, prim['indices'])] if 'indices' in prim else list(range(len(uv)))
            for t in range(0, len(idx) - 2, 3):
                a, b, c = (idx[t + k] for k in range(3))
                pa, pb, pc = ps[a], ps[b], ps[c]
                u = [pb[i] - pa[i] for i in range(3)]
                v = [pc[i] - pa[i] for i in range(3)]
                cx = (u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0])
                a3 = 0.5 * (cx[0] ** 2 + cx[1] ** 2 + cx[2] ** 2) ** 0.5
                q = [(uv[k][0] * W, uv[k][1] * H) for k in (a, b, c)]
                a2 = 0.5 * abs((q[1][0] - q[0][0]) * (q[2][1] - q[0][1]) - (q[2][0] - q[0][0]) * (q[1][1] - q[0][1]))
                if a3 <= 0:
                    continue
                d.polygon(q, fill=float(a3 / max(a2, 0.5)), outline=float(a3 / max(a2, 0.5)))
                tris += 1
    if tris == 0:
        return None
    return np.asarray(m, dtype=np.float64)


def wstats(im, w):
    """가중 평균·표준편차(RGB) — w = area_weights."""
    import numpy as np
    a = np.asarray(im.convert('RGB'), dtype=np.float64)
    ws = w.sum()
    mean = [(a[..., c] * w).sum() / ws for c in range(3)]
    std = [max(1.0, (((a[..., c] - mean[c]) ** 2 * w).sum() / ws) ** 0.5) for c in range(3)]
    return mean, std


def match_area(im, target, w):
    """--area: 채널마다 감마 곡선 v' = 255·(v/255)^g 로 겉면 넓이 가중 평균을 입력 전경 평균(× 종 톤 배율)에 맞춘다(g 0.2~4).
    affine 은 밝은 몸통을 255 로 날리지만 감마는 어두운 곳을 주로 올리고 흰 곳은 흰 채로 둔다(날림 0)."""
    import numpy as np
    tm, _ = wstats(im, w)
    im_ = target[0]
    a = np.asarray(im.convert('RGB'), dtype=np.float64) / 255.0
    ws = w.sum()
    bands = im.convert('RGBA').split()
    out = []
    for c in range(3):
        goal = min(im_[c], tm[c] * GAIN_MAX) / 255.0
        lo, hi = 0.2, 4.0
        for _ in range(40):
            g = (lo + hi) / 2
            if (w * a[..., c] ** g).sum() / ws > goal:
                lo = g
            else:
                hi = g
        g = (lo + hi) / 2
        lut = [int(min(255, max(0, round(255.0 * (v / 255.0) ** g)))) for v in range(256)]
        out.append(bands[c].point(lut))
    out.append(bands[3])
    return Image.merge('RGBA', out), tm


TONE = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data', 'k143_tone.json')


def tone_of(cid):
    try:
        return float(json.load(open(TONE, encoding='utf-8')).get(cid, 1.0))
    except (OSError, ValueError):
        return 1.0


def raw_image(raw_path):
    js, bin_ = read_glb(open(raw_path, 'rb').read())
    for img in js.get('images', []):
        if 'bufferView' in img:
            bv = js['bufferViews'][img['bufferView']]
            o, l = bv.get('byteOffset', 0), bv['byteLength']
            return Image.open(io.BytesIO(bytes(bin_[o:o + l])))
    return None


def fg_stats(path):
    """입력 그림 전경(모서리 배경색과 다른 픽셀)의 채널별 평균·표준편차."""
    im = Image.open(path).convert('RGBA')
    w, h = im.size
    bg = [im.getpixel(p)[:3] for p in ((1, 1), (w - 2, 1), (1, h - 2), (w - 2, h - 2))]
    bg = tuple(sum(c[i] for c in bg) // 4 for i in range(3))
    px = im.load()
    acc = [[0, 0] for _ in range(3)]
    n = 0
    for y in range(0, h, 2):
        for x in range(0, w, 2):
            r, g, b, a = px[x, y]
            if a < 128 or abs(r - bg[0]) + abs(g - bg[1]) + abs(b - bg[2]) < 40:
                continue
            n += 1
            for i, v in enumerate((r, g, b)):
                acc[i][0] += v
                acc[i][1] += v * v
    if n < 500:
        return None
    mean = [a[0] / n for a in acc]
    std = [max(1.0, (a[1] / n - m * m) ** 0.5) for a, m in zip(acc, mean)]
    return mean, std


def tex_stats(im, mask=None):
    """결 texel 중 검은 여백(밝기 < 8)을 뺀 채널별 평균·표준편차. mask 를 주면 그 마스크로(고친 뒤 같은 texel 로 다시 재기)."""
    rgb = im.convert('RGB')
    if mask is None:
        mask = rgb.convert('L').point(lambda v: 255 if v >= 8 else 0)
    st = ImageStat.Stat(rgb, mask=mask)
    return st.mean, [max(1.0, s) for s in st.stddev], mask


def match_texture(im, target, mask=None):
    tm, ts, mask = tex_stats(im, mask)
    im_, is_ = target
    bands = im.convert('RGBA').split()
    out = []
    for c in range(3):
        k = min(max(is_[c] / ts[c], STD_MIN), STD_MAX)
        # 평균 이득 상한: 결 평균 × GAIN_MAX 를 넘기지 않는다
        shift = min(im_[c], tm[c] * GAIN_MAX) - tm[c] * k
        lut = [int(min(255, max(0, round(v * k + shift)))) for v in range(256)]
        out.append(bands[c].point(lut))
    out.append(bands[3])
    return Image.merge('RGBA', out), tm, mask


def fix_one(path, out_dir=None, force=False, dry=False, area=False):
    b = open(path, 'rb').read()
    js, bin_ = read_glb(b)
    extras = js.setdefault('asset', {}).setdefault('extras', {})
    if extras.get('saga_creature_fix') and not force:
        return 'skip(이미 고침)'
    notes = []
    for m in js.get('materials', []):
        p = m.setdefault('pbrMetallicRoughness', {})
        p['metallicFactor'] = METALLIC
        p['roughnessFactor'] = ROUGHNESS
        p.pop('metallicRoughnessTexture', None)
    notes.append('metallic 0 · roughness %.2f' % ROUGHNESS)
    # 입력 그림
    lic_path = os.path.splitext(path)[0] + '.license.json'
    lic = json.load(open(lic_path, encoding='utf-8')) if os.path.exists(lic_path) else {}
    inp = lic.get('input_image')
    inp = os.path.join(ROOT, inp) if inp and not os.path.isabs(inp) else inp
    target = fg_stats(inp) if inp and os.path.exists(inp) else None
    new_images = {}
    raw = find_raw(os.path.splitext(os.path.basename(path))[0]) if target else None
    if target and js.get('images'):
        for idx, img in enumerate(js['images']):
            if 'bufferView' not in img:
                continue
            bv = js['bufferViews'][img['bufferView']]
            o, l = bv.get('byteOffset', 0), bv['byteLength']
            im = Image.open(io.BytesIO(bytes(bin_[o:o + l])))
            if area and raw:
                src = raw_image(raw)
                w = area_weights(raw, im.size)
                if src is not None and w is not None:
                    if src.size != im.size:
                        src = src.resize(im.size, Image.LANCZOS)
                    if src.mode in ('RGBA', 'LA') and im.mode not in ('RGBA', 'LA'):
                        src = src.convert('RGB')
                    tone = tone_of(os.path.splitext(os.path.basename(path))[0])
                    tgt = ([min(250.0, v * tone) for v in target[0]], target[1])
                    fixed, tm = match_area(src, tgt, w)
                    if tone != 1.0:
                        notes.append('톤 배율 %.3f(data/k143_tone.json)' % tone)
                    notes.append('--area: 원본 결(%s)에서 · 겉면 넓이 가중 감마' % os.path.relpath(raw, ROOT).replace(os.sep, '/'))
                    buf = io.BytesIO()
                    if img.get('mimeType') == 'image/webp':
                        fixed.save(buf, 'WEBP', quality=90, method=6)
                    else:
                        fixed.save(buf, 'PNG', optimize=True)
                    new_images[img['bufferView']] = buf.getvalue()
                    nm = wstats(fixed, w)[0]
                    notes.append('겉면 평균 %s → %s (입력 전경 %s)' % ([round(x) for x in tm], [round(x) for x in nm], [round(x) for x in target[0]]))
                    continue
            umask = None
            if raw:
                try:
                    umask = uv_mask(raw, im.size)
                except Exception as e:   # 양자화·압축 등 못 읽으면 밝기 마스크로
                    umask = None
            fixed, tm, mask = match_texture(im, target, umask)
            notes.append('texel 마스크 = ' + ('UV(%s)' % os.path.relpath(raw, ROOT) if umask is not None else '밝기'))
            buf = io.BytesIO()
            if img.get('mimeType') == 'image/webp':
                fixed.save(buf, 'WEBP', quality=90, method=6)
            else:
                fixed.save(buf, 'PNG', optimize=True)
            new_images[img['bufferView']] = buf.getvalue()
            nm = tex_stats(fixed, mask)[0]
            notes.append('결 평균(여백 제외) %s → %s (입력 전경 %s)' % ([round(x) for x in tm], [round(x) for x in nm], [round(x) for x in target[0]]))
    elif js.get('images'):
        notes.append('입력 그림 없음 → 결은 그대로')
    # buffer 0 다시 놓기
    regs = regions(js)
    order = sorted(range(len(regs)), key=lambda i: regs[i][1])
    old_bytes = {i: bytes(bin_[regs[i][1]:regs[i][1] + regs[i][2]]) for i in range(len(regs))}
    bv_index = {id(bv): i for i, bv in enumerate(js['bufferViews'])}
    new_bin = bytearray()
    for i in order:
        d, o, l = regs[i]
        data = new_images.get(bv_index.get(id(d), -1), old_bytes[i])
        new_bin += b'\0' * (-len(new_bin) % 4)
        d['byteOffset'] = len(new_bin)
        d['byteLength'] = len(data)
        new_bin += data
    js['buffers'][0]['byteLength'] = len(new_bin)
    extras['saga_creature_fix'] = 1
    out = write_glb(js, new_bin)
    # 검증: 비그림 영역 바이트 동일
    js2, bin2 = read_glb(out)
    regs2 = regions(js2)
    for i, (d, o, l) in enumerate(regs2):
        if bv_index.get(id(regs[i][0]), -1) in new_images:
            continue
        if bytes(bin2[o:o + l]) != old_bytes[i]:
            return 'FAIL(영역 %d 바이트 다름 — 안 씀)' % i
    if dry:
        return 'dry · ' + ' · '.join(notes)
    dst = os.path.join(out_dir, os.path.basename(path)) if out_dir else path
    os.makedirs(os.path.dirname(os.path.abspath(dst)), exist_ok=True)
    open(dst, 'wb').write(out)
    if lic:
        lic['postfix'] = 'tools/glb-compress/creature_fix.py — ' + ' · '.join(notes)
        json.dump(lic, open(os.path.join(os.path.dirname(dst), os.path.basename(lic_path)), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    return '%dKB→%dKB · %s' % (len(b) // 1024, len(out) // 1024, ' · '.join(notes))


def main():
    argv = sys.argv[1:]
    if '--out' in argv:
        argv.pop(argv.index('--out') + 1)
    a = [x for x in argv if not x.startswith('--')]
    if not a:
        print(__doc__)
        return 2
    out_dir = sys.argv[sys.argv.index('--out') + 1] if '--out' in sys.argv else None
    paths = sorted(glob.glob(os.path.join(a[0], '*.glb'))) if os.path.isdir(a[0]) else a
    n_fix = n_skip = n_fail = 0
    for p in paths:
        r = fix_one(p, out_dir, '--force' in sys.argv, '--dry' in sys.argv, '--area' in sys.argv)
        print(os.path.basename(p), r)
        n_fail += r.startswith('FAIL')
        n_skip += r.startswith('skip')
        n_fix += not (r.startswith('FAIL') or r.startswith('skip'))
    print('CREATURE_FIX 고침 %d · 건너뜀 %d · 실패 %d' % (n_fix, n_skip, n_fail))
    return 1 if n_fail else 0


if __name__ == '__main__':
    sys.exit(main())
