"""옷 조각 질감 × AI 무늬 타일 → 옷 변형(외형 아이템) 질감을 대량으로 만든다.

    py tools/char-forge/make_wardrobe_textures.py [--patterns 32] [--max-size 1024]

입력  · `_out/vrm_parts/<vrm>/tex/<조각>.png` (vrm_piece_tex.py — 옷 조각의 바탕색 질감 펼침도)
      · `tools/ai-art/_out/web_patterns_32/pat_*.png` (make_pattern_batch.py → gen.py 로 만든 천 무늬 타일)
출력  · `_out/wardrobe/<vrm>/<조각>/<무늬>.webp` — 조각 GLB 의 바탕색 질감만 바꿔 끼우면 옷이 달라진다(메시는 그대로 → 변형마다 GLB 를 새로 안 낸다)
      · `_out/wardrobe/items.json` — 아이템 표(id·슬롯·조각·질감·표시 이름·희귀도·종류 gear/cash)

합성: 패널(마스크 = 알파, 알파가 없으면 밝기) 안에서 `무늬 × 원래 질감의 명암`. 원래 질감의 접힘·그림자는 남고 색·무늬만 바뀐다. 패널 밖(검은 바탕)은 그대로.
표시 이름은 가명·일반명사(무늬 이름 + 슬롯). 무늬 타일은 AI 생성(Animagine XL 4.0 Opt, OpenRAIL++-M, 상업 허용) — 출처는 `.license.json` 이 타일마다 있다.
"""
import glob
import json
import os
import sys

import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.abspath(__file__))
PARTS = os.path.join(ROOT, '_out', 'vrm_parts')
PATS = os.path.join(ROOT, '..', 'ai-art', '_out', 'web_patterns_32')
OUT = os.path.join(ROOT, '_out', 'wardrobe')
MAX = int(sys.argv[sys.argv.index('--max-size') + 1]) if '--max-size' in sys.argv else 1024

KO = {
    'floral_blue': '푸른 꽃무늬', 'silk_red_gold': '금수 붉은 비단', 'leather_studs': '징 박은 검은 가죽', 'tartan_green': '초록 격자',
    'brocade_gold': '금빛 비단무늬', 'batik_indigo': '쪽빛 염색', 'linen_stripes': '푸른 줄 마', 'velvet_purple': '보라 벨벳',
    'camo_green': '녹색 얼룩무늬', 'denim_worn': '낡은 청', 'circuit_neon': '빛나는 회로', 'holo_iridescent': '무지갯빛 홀로',
    'carbon_weave': '탄소 직조', 'sakura_pink': '벚꽃', 'damask_crimson': '진홍 다마스크', 'checker_bw': '흑백 체크',
    'ethnic_geo': '민속 기하무늬', 'scale_silver': '은빛 비늘', 'waves_teal': '청록 물결', 'leather_brown': '낡은 갈색 가죽',
    'sunflower': '해바라기', 'starry_night': '별밤', 'herringbone_camel': '낙타색 헤링본', 'lace_white': '흰 레이스',
    'buffalo_plaid': '붉은 체크 플란넬', 'bamboo_green': '대나무 비단', 'tweed_grey': '회색 트위드', 'cyber_gradient': '사이버 그라데이션',
    'canvas_beige': '베이지 캔버스', 'heraldic_blue_gold': '푸른 금문장', 'coins_maroon': '엽전무늬', 'stripes_pastel': '파스텔 줄무늬',
}
SLOT_KO = {'top': '상의', 'bottom': '하의', 'shoes': '신발'}


def fnv(s):
    h = 2166136261
    for c in s.encode():
        h = ((h ^ c) * 16777619) & 0xFFFFFFFF
    return h


def compose(tex, pat):
    """tex RGBA(H,W) uint8, pat RGB tile → RGBA."""
    a = np.asarray(tex.convert('RGBA')).astype(np.float32) / 255.0
    h, w = a.shape[:2]
    rgb, al = a[..., :3], a[..., 3]
    mask = al > 0.5 if al.min() < 0.99 else rgb.max(axis=2) > 0.05
    lum = rgb @ np.array([0.299, 0.587, 0.114], dtype=np.float32)
    ref = np.percentile(lum[mask], 70) if mask.any() else 1.0
    shade = np.clip(lum / max(ref, 0.03), 0.35, 1.35)
    shade = 0.35 + 0.65 * shade / 1.35 * 1.0 + 0.0          # 명암은 살리되 무늬가 죽지 않게 눌러 준다
    tile = np.asarray(pat.convert('RGB').resize((max(256, w // 3), max(256, h // 3)), Image.LANCZOS)).astype(np.float32) / 255.0
    reps = (h // tile.shape[0] + 1, w // tile.shape[1] + 1, 1)
    big = np.tile(tile, reps)[:h, :w]
    out = np.where(mask[..., None], np.clip(big * shade[..., None] * 1.15, 0, 1), rgb)
    res = np.concatenate([out, al[..., None]], axis=2)
    return Image.fromarray((res * 255).astype(np.uint8), 'RGBA')


def main():
    pats = sorted(glob.glob(os.path.join(PATS, 'pat_*.png')))
    if not pats:
        sys.exit('무늬 타일이 없다 — make_pattern_batch.py 와 gen.py(run_chain.sh) 를 먼저')
    items = []
    for vdir in sorted(glob.glob(os.path.join(PARTS, '*', 'tex'))):
        vrm = os.path.basename(os.path.dirname(vdir))
        for tp in sorted(glob.glob(os.path.join(vdir, '*__*.png'))):
            piece = os.path.splitext(os.path.basename(tp))[0]
            slot = piece.split('__')[0]
            if slot not in SLOT_KO:
                continue
            tex = Image.open(tp)
            if max(tex.size) > MAX:
                s = MAX / max(tex.size)
                tex = tex.resize((round(tex.size[0] * s), round(tex.size[1] * s)), Image.LANCZOS)
            od = os.path.join(OUT, vrm, piece)
            os.makedirs(od, exist_ok=True)
            for pp in pats:
                pid = os.path.basename(pp)[4:-4]
                res = compose(tex, Image.open(pp))
                fn = pid + '.webp'
                res.save(os.path.join(od, fn), 'WEBP', quality=86, method=6)
                iid = f'cos_{vrm}_{slot}_{pid}'
                h = fnv(iid)
                items.append({'id': iid, 'name': f'{KO.get(pid, pid)} {SLOT_KO[slot]}', 'slot': slot, 'base': vrm,
                              'piece': f'{vrm}/{piece}.glb', 'texture': f'{vrm}/{piece}/{fn}', 'rarity': 1 + h % 5,
                              'kind': 'cash' if h % 3 == 0 else 'gear', 'pattern': pid})
    json.dump({'note': '옷 변형(외형) 아이템 표 — 조각 GLB 의 바탕색 질감만 texture 로 바꿔 끼운다. 능력치는 게임이 rarity·slot 으로 정한다(cash 는 능력치 없음).',
               'items': items}, open(os.path.join(OUT, 'items.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print('WARDROBE', len(items), 'items ·', len(pats), 'patterns')


if __name__ == '__main__':
    main()
