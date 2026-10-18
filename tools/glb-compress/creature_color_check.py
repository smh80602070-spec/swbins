"""짐승 몸 색 전수 비교 (K-0143) — 입력 그림 전경 vs 결(메시가 쓰는 texel) vs 렌더 전경, Lab ΔE.
  py tools/glb-compress/creature_color_check.py <렌더 폴더> [--glb-dir saga-assets/creatures3d] [--out tools/_out/k143/before] [--top 24]
렌더 폴더 = `_render_dir.sh` 가 구운 <id>.png(투명 바탕). 결과 <out>.json(종마다 평균색·ΔE) + <out>_sheet.jpg(ΔE 큰 순: 입력 | 렌더).
읽기만 한다. ΔE 는 CIE76(평균색 둘 사이) — 조명이 들어간 렌더 ΔE 는 순위용, 결 ΔE 가 고침 기준이다.
"""
import io
import json
import os
import sys

from PIL import Image, ImageDraw, ImageStat

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import creature_fix as CF  # noqa: E402

ROOT = CF.ROOT


def arg(k, d=None):
    return sys.argv[sys.argv.index(k) + 1] if k in sys.argv else d


def lab(rgb):
    def lin(c):
        c /= 255.0
        return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
    r, g, b = (lin(float(v)) for v in rgb)
    x = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047
    y = 0.2126 * r + 0.7152 * g + 0.0722 * b
    z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883
    f = lambda t: t ** (1 / 3) if t > 0.008856 else 7.787 * t + 16 / 116
    fx, fy, fz = f(x), f(y), f(z)
    return 116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)


def de(a, b):
    return sum((p - q) ** 2 for p, q in zip(lab(a), lab(b))) ** 0.5


def render_mean(p):
    im = Image.open(p).convert('RGBA')
    a = im.split()[3].point(lambda v: 255 if v >= 200 else 0)
    if not a.getbbox():
        return None
    return ImageStat.Stat(im.convert('RGB'), mask=a).mean


def tex_mean(glb):
    js, bin_ = CF.read_glb(open(glb, 'rb').read())
    for img in js.get('images', []):
        if 'bufferView' not in img:
            continue
        bv = js['bufferViews'][img['bufferView']]
        o, l = bv.get('byteOffset', 0), bv['byteLength']
        im = Image.open(io.BytesIO(bytes(bin_[o:o + l])))
        raw = CF.find_raw(os.path.splitext(os.path.basename(glb))[0])
        m = None
        if raw:
            try:
                m = CF.uv_mask(raw, im.size)
            except Exception:
                m = None
        return CF.tex_stats(im, m)[0][:3]
    return None


def main():
    rdir = sys.argv[1]
    gdir = os.path.join(ROOT, arg('--glb-dir', 'saga-assets/creatures3d'))
    out = os.path.join(ROOT, arg('--out', 'tools/_out/k143/before'))
    rows = []
    for f in sorted(os.listdir(gdir)):
        if not f.endswith('.glb'):
            continue
        cid = f[:-4]
        lic = os.path.join(gdir, cid + '.license.json')
        lic = json.load(open(lic, encoding='utf-8')) if os.path.exists(lic) else {}
        inp = lic.get('input_image')
        inp = os.path.join(ROOT, inp) if inp else None
        st = CF.fg_stats(inp) if inp and os.path.exists(inp) else None
        rp = os.path.join(rdir, cid + '.png')
        rm = render_mean(rp) if os.path.exists(rp) else None
        tm = tex_mean(os.path.join(gdir, f))
        r = {'id': cid, 'input': os.path.relpath(inp, ROOT).replace('\\', '/') if st else None,
             'in_mean': [round(v) for v in st[0]] if st else None,
             'tex_mean': [round(v) for v in tm] if tm else None, 'render_mean': [round(v) for v in rm] if rm else None}
        if st and tm:
            r['de_tex'] = round(de(st[0], tm), 1)
            r['dL_tex'] = round(lab(tm)[0] - lab(st[0])[0], 1)
            r['dC_tex'] = round((lab(tm)[1] ** 2 + lab(tm)[2] ** 2) ** 0.5 - (lab(st[0])[1] ** 2 + lab(st[0])[2] ** 2) ** 0.5, 1)
        if st and rm:
            r['de_render'] = round(de(st[0], rm), 1)
        rows.append(r)
    rows.sort(key=lambda r: -r.get('de_tex', -1))
    os.makedirs(os.path.dirname(out), exist_ok=True)
    json.dump(rows, open(out + '.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    has = [r for r in rows if 'de_tex' in r]
    print('종 %d · 입력 있음 %d · ΔE(결) 평균 %.1f · 15 넘음 %d' % (len(rows), len(has), sum(r['de_tex'] for r in has) / max(1, len(has)),
                                                         sum(1 for r in has if r['de_tex'] > 15)))
    for r in has[:12]:
        print('  %-18s ΔE결 %5.1f  ΔL %+5.1f  ΔC %+5.1f  ΔE렌더 %s  입력 %s 결 %s' % (r['id'], r['de_tex'], r['dL_tex'], r['dC_tex'], r.get('de_render'), r['in_mean'], r['tex_mean']))
    top = int(arg('--top', '24'))
    cw = 128
    sh = Image.new('RGB', (cw * 2 * 4, (cw + 16) * ((min(top, len(has)) + 3) // 4)), (205, 208, 212))
    d = ImageDraw.Draw(sh)
    for k, r in enumerate(has[:top]):
        x, y = (k % 4) * cw * 2, (k // 4) * (cw + 16)
        a = Image.open(os.path.join(ROOT, r['input'])).convert('RGB'); a.thumbnail((cw, cw))
        sh.paste(a, (x, y))
        rp = os.path.join(rdir, r['id'] + '.png')
        if os.path.exists(rp):
            b = Image.open(rp).convert('RGBA'); b.thumbnail((cw, cw))
            sh.paste(b, (x + cw, y), b)
        d.text((x + 2, y + cw + 2), '%s dE%.0f' % (r['id'], r['de_tex']), fill=(0, 0, 0))
    sh.save(out + '_sheet.jpg', quality=88)


if __name__ == '__main__':
    main()
