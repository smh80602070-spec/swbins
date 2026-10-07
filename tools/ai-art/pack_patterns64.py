"""K-0006 — 옷 무늬 64종을 이음매 없는 256px webp 타일로 포장하고 patterns.json 을 쓴다.

py tools/ai-art/pack_patterns64.py <기존32폴더> <새32폴더> <출력폴더> [--px 256]
  입력: 기존 32종 `pat_*.png`(Animagine, web_patterns_32) + 새 32종 `pat_*.png`(z-image-turbo, web_patterns_64)
  출력: <출력>/<id>.webp (각 ≤ 60KB, 이음매 처리) · patterns.json({id, era, name, file, model}) · 실패 목록은 stdout
  이음매: make_seamless.seamless() 의 오프셋 크로스페이드. 검사 = 가장자리 두 줄 차이 ÷ 안쪽 인접 줄 차이 ≤ 1.6(비율, 줄무늬 오탐 방지).
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
            ok = diff <= 1.6 and kb <= 60
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
    main()
