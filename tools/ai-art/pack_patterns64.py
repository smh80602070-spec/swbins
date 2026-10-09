"""K-0006 — 옷 무늬 64종을 이음매 없는 256px webp 타일로 포장하고 patterns.json 을 쓴다.

py tools/ai-art/pack_patterns64.py <기존32폴더> <새32폴더> <출력폴더> [--px 256]
  입력: 기존 32종 `pat_*.png`(Animagine, web_patterns_32) + 새 32종 `pat_*.png`(z-image-turbo, web_patterns_64)
  출력: <출력>/<id>.webp (각 ≤ 60KB, 이음매 처리) · patterns.json({id, era, name, file, model}) · 실패 목록은 stdout
  이음매: make_seamless.seamless() 의 오프셋 크로스페이드. 검사 = 가장자리 두 줄 차이 ÷ 안쪽 인접 줄 차이 ≤ 1.6(비율, 줄무늬 오탐 방지).

K-0088: 위 검사는 바깥 테두리만 봐서 오프셋 방식의 가운데 십자 이음매(밀린 그림의 이음매가 테두리 근처로 드러남)를 못 잡았다
  → `seam_ratio`(테두리·가운데 줄의 이웃 차이 ÷ 근처 16줄 중앙값) ≤ 3.0 을 함께 본다(체크·격자처럼 원래 줄이 강한 무늬가 2.5 안팎).
  다시 뽑기는 SDXL 순환 패딩(gen.py `tiling`)으로 원래부터 이어지게 만든다:
py tools/ai-art/pack_patterns64.py --replace <gen 출력폴더>   # pat_<id>_vNN.png 후보 중 seam_ratio 가장 낮은 것 → 정본 saga-assets/patterns 교체
py tools/ai-art/pack_patterns64.py --check [폴더]             # 정본(기본) 무늬 전부 seam_ratio ≤ 3.0 · edge_ratio ≤ 1.6 · ≤ 60KB
"""
import json
import os
import sys

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from make_seamless import seamless  # noqa: E402

KO_NEW = {
    'jade_peony_silk': '옥빛 모란 비단', 'indigo_ikat': '쪽빛 이캇', 'crimson_felt': '진홍 펠트', 'ochre_hemp': '황토 삼베',
    'houndstooth_grey': '회색 하운드투스', 'polka_navy': '남색 물방울', 'argyle_green': '초록 아가일', 'corduroy_brown': '갈색 코듀로이',
    'knit_cream': '크림 꽈배기 뜨개', 'sequin_black': '검은 스팽글', 'pinstripe_charcoal': '숯빛 세로줄', 'paisley_teal': '청록 페이즐리',
    'nano_scale_blue': '푸른 나노 비늘', 'hex_plate_white': '흰 육각 판', 'solar_panel_dark': '태양 전지판', 'neon_grid_pink': '분홍 네온 격자',
    'plasma_veins_violet': '보랏빛 플라즈마', 'liquid_metal_chrome': '액체 금속', 'fiber_optic_weave': '광섬유 직조', 'bio_mesh_green': '녹색 생체 그물',
    'hologram_scanlines': '홀로 주사선', 'ceramic_armor_white': '흰 도자 갑옷', 'aurora_gradient': '오로라 그라데이션', 'graphene_black': '검은 그래핀',
    'quantum_dots_gold': '금빛 양자점', 'smart_fabric_ripple': '은빛 물결 스마트 천', 'data_stream_blue': '푸른 데이터 흐름', 'ion_glow_orange': '주황 이온 줄기',
    'crest_crane_gold': '금 학 문장', 'crest_wave_blue': '푸른 물결 문장', 'crest_sun_red': '붉은 해 문장', 'crest_moon_silver': '은빛 달별 문장',
}


def edge_ratio(a):
    """가장자리(맞닿는 두 줄)의 평균 절대차 ÷ 안쪽 인접 줄들의 평균 절대차. 이음매가 안쪽 접합만큼 매끄러우면 1 안팎.
    줄무늬·격자처럼 안쪽 인접 줄끼리도 원래 크게 다른 무늬가 오탐되지 않게 절대값이 아니라 비율로 본다."""
    a = a.astype(np.float32)
    ex = float(np.abs(a[:, 0] - a[:, -1]).mean())
    ey = float(np.abs(a[0] - a[-1]).mean())
    ix = float(np.abs(a[:, 1:] - a[:, :-1]).mean())
    iy = float(np.abs(a[1:] - a[:-1]).mean())
    return max(ex / max(ix, 1.0), ey / max(iy, 1.0))


SEAM_MAX = 3.0
CANON = os.path.join(HERE, '..', '..', 'saga-assets', 'patterns')


def seam_ratio(a):
    """반복해 붙였을 때의 곧은 이음매 — 테두리(감싸기)와 가운데 줄의 이웃 차이 ÷ 근처 16줄 차이의 중앙값(가로·세로 중 큰 쪽)."""
    a = a.astype(np.float32)
    n = a.shape[0]
    worst = 0.0
    for ax in (0, 1):
        b = np.moveaxis(a, ax, 0)
        d = np.abs(np.roll(b, -1, 0) - b).mean(axis=tuple(range(1, b.ndim)))
        for L in (n - 1, n // 2 - 1):
            near = [d[(L + k) % n] for k in range(-8, 9) if k != 0]
            worst = max(worst, float(d[L] / max(np.median(near), 1.0)))
    return worst


def save_webp(t, p):
    q = 85
    while True:
        t.save(p, 'WEBP', quality=q, method=6)
        if os.path.getsize(p) <= 60 * 1024 or q <= 40:
            return os.path.getsize(p) / 1024
        q -= 10


def replace(gen_dir, px=256):
    """gen.py tiling 출력(pat_<id>_vNN.png)에서 이음매가 가장 낮은 후보를 골라 정본을 바꾼다."""
    groups = {}
    for f in sorted(os.listdir(gen_dir)):
        if f.startswith('pat_') and f.endswith('.png'):
            key = f[4:-4].rsplit('_v', 1)[0]
            groups.setdefault(key, []).append(f)
    pj = os.path.join(CANON, 'patterns.json')
    pv = os.path.join(CANON, '_provenance.json')
    table, prov = json.load(open(pj, encoding='utf-8')), json.load(open(pv, encoding='utf-8'))
    rows = {r['id']: r for r in table['patterns']}
    for key, fs in groups.items():
        if key not in rows:
            print('정본에 없는 id', key)
            continue
        best = None
        for f in fs:
            im = Image.open(os.path.join(gen_dir, f)).convert('RGB')
            c = min(im.size)
            t = im.crop((0, 0, c, c)).resize((px, px), Image.LANCZOS)   # 순환 패딩 그림은 통째로 이어진다 — 가운데를 잘라내면 안 된다
            r = seam_ratio(np.asarray(t))
            if best is None or r < best[0]:
                best = (r, f, t)
        r, f, t = best
        kb = save_webp(t, os.path.join(CANON, key + '.webp'))
        lic = json.load(open(os.path.join(gen_dir, f[:-4] + '.license.json'), encoding='utf-8'))
        rows[key].update({'model': lic.get('model'), 'seam': 'tiling', 'edge_ratio': round(edge_ratio(np.asarray(t)), 2),
                          'seam_ratio': round(r, 2), 'kb': round(kb)})
        prov['items'][key] = dict(prov['items'].get(key, {}), model=lic.get('model'), seed=lic.get('seed'), seam='tiling',
                                  prompt=lic.get('prompt'), redo='K-0088 이음매 다시(SDXL 순환 패딩)')
        print(f'{key:22s} ← {f}  seam {r:.2f}  {kb:.0f}KB')
    json.dump(table, open(pj, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    json.dump(prov, open(pv, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)


def check(d=CANON):
    bad = []
    fs = sorted(f for f in os.listdir(d) if f.endswith('.webp'))
    for f in fs:
        a = np.asarray(Image.open(os.path.join(d, f)).convert('RGB'))
        sr, er, kb = seam_ratio(a), edge_ratio(a), os.path.getsize(os.path.join(d, f)) / 1024
        if sr > SEAM_MAX or er > 1.6 or kb > 60:
            bad.append(f'{f[:-5]} seam {sr:.1f} edge {er:.1f} {kb:.0f}KB')
    print('무늬', len(fs), '· 기준 밖', len(bad))
    print('PATTERN_FAIL' if bad else 'PATTERN_OK')
    for b in bad:
        print(' -', b)
    return 1 if bad else 0


def mirror_tile(im, size):
    """거울 반복 — 가운데 정사각형을 절반 크기로 줄여 좌우·상하로 뒤집어 2×2. 어떤 무늬든 이음매가 완벽(대칭 무늬가 됨)."""
    im = im.convert('RGB')
    w, h = im.size
    c = min(w, h)
    q = im.crop(((w - c) // 2, (h - c) // 2, (w - c) // 2 + c, (h - c) // 2 + c)).resize((size // 2, size // 2), Image.LANCZOS)
    t = Image.new('RGB', (size, size))
    t.paste(q, (0, 0))
    t.paste(q.transpose(Image.FLIP_LEFT_RIGHT), (size // 2, 0))
    t.paste(q.transpose(Image.FLIP_TOP_BOTTOM), (0, size // 2))
    t.paste(q.transpose(Image.ROTATE_180), (size // 2, size // 2))
    return t


def main():
    if '--check' in sys.argv:
        rest = [x for x in sys.argv[1:] if not x.startswith('--')]
        return check(rest[0] if rest else CANON)
    if '--replace' in sys.argv:
        return replace(sys.argv[sys.argv.index('--replace') + 1])
    old_dir, new_dir, out_dir = sys.argv[1], sys.argv[2], sys.argv[3]
    px = int(sys.argv[sys.argv.index('--px') + 1]) if '--px' in sys.argv else 256
    era = json.load(open(os.path.join(HERE, 'batches', 'web_patterns_64_era.json'), encoding='utf-8'))
    os.makedirs(out_dir, exist_ok=True)
    table, bad = [], []
    for model, d in (('animagine-xl-4.0-opt', old_dir), ('z-image-turbo', new_dir)):
        for f in sorted(os.listdir(d)):
            if not (f.startswith('pat_') and f.endswith('.png')):
                continue
            pid = f[:-4]
            key = pid[4:]
            t = seamless(Image.open(os.path.join(d, f)), px)
            diff = edge_ratio(np.asarray(t))
            method = 'offset'
            if diff > 1.6:          # 구조가 강한 무늬는 오프셋 크로스페이드가 잔상을 만든다 → 거울 반복
                t = mirror_tile(Image.open(os.path.join(d, f)), px)
                diff = edge_ratio(np.asarray(t))
                method = 'mirror'
            q = 85
            while True:
                p = os.path.join(out_dir, key + '.webp')
                t.save(p, 'WEBP', quality=q, method=6)
                if os.path.getsize(p) <= 60 * 1024 or q <= 40:
                    break
                q -= 10
            kb = os.path.getsize(p) / 1024
            ok = diff <= 1.6 and kb <= 60 and seam_ratio(np.asarray(t)) <= SEAM_MAX
            if not ok:
                bad.append((key, round(diff, 1), round(kb)))
            name = KO_NEW.get(key)
            table.append({'id': key, 'era': era[pid], 'name': name or key, 'file': key + '.webp', 'model': model, 'seam': method,
                          'edge_ratio': round(diff, 2), 'kb': round(kb)})
    json.dump({'note': 'K-0006 옷 무늬 타일 64종. 표시 이름은 가명·일반명사. 기존 32종의 한국어 이름은 tools/char-forge/make_wardrobe_textures.py KO.',
               'count': len(table), 'patterns': table}, open(os.path.join(out_dir, 'patterns.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print('패턴', len(table), '· 기준 밖', bad)
    cnt = {}
    for r in table:
        cnt[r['era']] = cnt.get(r['era'], 0) + 1
    print('시대별', cnt, '· 합계 KB', sum(r['kb'] for r in table))


if __name__ == '__main__':
    sys.exit(main())
