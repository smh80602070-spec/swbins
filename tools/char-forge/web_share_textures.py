"""웹 경량 GLB 의 텍스처를 공용 폴더로 빼서 중복을 없앤다 — 화질은 비트 단위로 같고 용량만 준다(K-0024 용량 정책).

    py tools/char-forge/web_share_textures.py <출력 폴더> [--ids a,b] [--check]
    # <출력>/<id>.glb  (이미지는 uri 로 tex/<해시>.webp 를 가리킴)  +  <출력>/tex/<해시>.webp

왜: 299명은 25벌 샘플 조각의 조합이라 텍스처 5288장 중 서로 다른 것이 450장(92.7MB → 13.3MB). 같은 내용 파일 이름이 같으면
브라우저 캐시도 한 번만 받는다. 입력은 `_out/vroid/<id>/web/<id>.glb`(vroid_batch 3단계 산출, Meshopt·WebP) — 읽기만 한다.
Meshopt 압축 데이터·셰이더·재질은 그대로 두고, BIN 에서 이미지 뷰만 빼고 오프셋을 다시 매긴다. 외부 uri 는 GLTFLoader 가
GLB 옆 상대 경로로 읽는다(게임 쪽 코드 변경 없음, 폴더 구조만 `tex/` 를 같이 놓을 것).
--check: 쓴 GLB 를 다시 읽어 구조(뷰·접근자 범위, 이미지 uri 파일 존재)를 검증한다.
"""
import hashlib
import json
import os
import struct
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, '_out', 'vroid')


def read_glb(path):
    b = open(path, 'rb').read()
    assert b[:4] == b'glTF', path
    jl, jt = struct.unpack('<II', b[12:20])
    assert jt == 0x4E4F534A
    j = json.loads(b[20:20 + jl])
    o = 20 + jl
    bl, bt = struct.unpack('<II', b[o:o + 8])
    assert bt == 0x004E4942
    return j, b[o + 8:o + 8 + bl]


def write_glb(path, j, binb):
    js = json.dumps(j, separators=(',', ':')).encode('utf-8')
    js += b' ' * (-len(js) % 4)
    binb += b'\0' * (-len(binb) % 4)
    total = 12 + 8 + len(js) + 8 + len(binb)
    with open(path, 'wb') as f:
        f.write(struct.pack('<4sII', b'glTF', 2, total))
        f.write(struct.pack('<II', len(js), 0x4E4F534A) + js)
        f.write(struct.pack('<II', len(binb), 0x004E4942) + binb)


def share(gid, outdir):
    src = os.path.join(SRC, gid, 'web', gid + '.glb')
    j, binb = read_glb(src)
    views = j['bufferViews']
    imgs = j.get('images', [])
    img_views = {i['bufferView'] for i in imgs if 'bufferView' in i}
    texdir = os.path.join(outdir, 'tex')
    os.makedirs(texdir, exist_ok=True)
    for i in imgs:
        if 'bufferView' not in i:
            continue
        v = views[i['bufferView']]
        o = v.get('byteOffset', 0)
        d = binb[o:o + v['byteLength']]
        ext = {'image/webp': 'webp', 'image/png': 'png', 'image/jpeg': 'jpg'}[i['mimeType']]
        name = 'tex/%s.%s' % (hashlib.md5(d).hexdigest()[:16], ext)
        p = os.path.join(outdir, name)
        if not os.path.exists(p):
            open(p, 'wb').write(d)
        del i['bufferView']
        i['uri'] = name
    # BIN 다시 쌓기: 이미지 뷰는 빼고, 남는 뷰 번호를 다시 매긴다
    newbin = bytearray()
    remap = {}
    newviews = []
    for k, v in enumerate(views):
        if k in img_views:
            continue
        remap[k] = len(newviews)
        ext = v.get('extensions', {}).get('EXT_meshopt_compression')
        if ext is not None:                      # 압축 데이터는 ext 가 가리키는 buffer 0 에 있고, v 자체는 가짜(fallback) 버퍼
            o, n = ext['byteOffset'], ext['byteLength']
            newbin += b'\0' * (-len(newbin) % 4)
            ext['byteOffset'] = len(newbin)
            newbin += binb[o:o + n]
        elif v['buffer'] == 0:
            o, n = v.get('byteOffset', 0), v['byteLength']
            newbin += b'\0' * (-len(newbin) % 4)
            v['byteOffset'] = len(newbin)
            newbin += binb[o:o + n]
        newviews.append(v)
    j['bufferViews'] = newviews
    for a in j.get('accessors', []):
        if 'bufferView' in a:
            a['bufferView'] = remap[a['bufferView']]
        sp = a.get('sparse')
        if sp:
            sp['indices']['bufferView'] = remap[sp['indices']['bufferView']]
            sp['values']['bufferView'] = remap[sp['values']['bufferView']]
    j['buffers'][0]['byteLength'] = len(newbin) + (-len(newbin) % 4)
    dst = os.path.join(outdir, gid + '.glb')
    write_glb(dst, j, bytes(newbin))
    return os.path.getsize(src), os.path.getsize(dst)


def check(gid, outdir):
    j, binb = read_glb(os.path.join(outdir, gid + '.glb'))
    nb = len(j['bufferViews'])
    for v in j['bufferViews']:
        ext = v.get('extensions', {}).get('EXT_meshopt_compression')
        if ext is not None:
            assert ext['buffer'] == 0 and ext['byteOffset'] + ext['byteLength'] <= len(binb), 'meshopt 범위'
        elif v['buffer'] == 0:
            assert v.get('byteOffset', 0) + v['byteLength'] <= len(binb), '뷰 범위'
    for a in j['accessors']:
        assert 'bufferView' not in a or a['bufferView'] < nb, '접근자 뷰'
    for i in j.get('images', []):
        assert 'bufferView' not in i and os.path.exists(os.path.join(outdir, i['uri'])), '이미지 uri'
    return True


def main():
    a = [x for x in sys.argv[1:] if not x.startswith('--')]
    if not a:
        print(__doc__)
        return 2
    outdir = os.path.abspath(a[0])
    ids = None
    if '--ids' in sys.argv:
        ids = sys.argv[sys.argv.index('--ids') + 1].split(',')
        a = [x for x in a if x != ','.join(ids)]
    if ids is None:
        ids = sorted(d for d in os.listdir(SRC) if os.path.exists(os.path.join(SRC, d, 'web', d + '.glb')))
    os.makedirs(outdir, exist_ok=True)
    s0 = s1 = 0
    for gid in ids:
        x, y = share(gid, outdir)
        s0 += x
        s1 += y
        if '--check' in sys.argv:
            check(gid, outdir)
    tex = sum(os.path.getsize(os.path.join(outdir, 'tex', f)) for f in os.listdir(os.path.join(outdir, 'tex')))
    print('GLB %d개  원래 %.1fMB → GLB %.1fMB + tex %.1fMB = %.1fMB' % (len(ids), s0 / 1e6, s1 / 1e6, tex / 1e6, (s1 + tex) / 1e6))
    return 0


if __name__ == '__main__':
    sys.exit(main())
