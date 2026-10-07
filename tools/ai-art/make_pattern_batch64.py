"""K-0006 — 옷 무늬 타일 +32종 (기존 32종과 합쳐 64종: 과거 20 · 현대 20 · 미래 20 · 문장 4).

py tools/ai-art/make_pattern_batch64.py   →  batches/web_patterns_new32.json (모델 z-image-turbo, 출력 폴더 web_patterns_64)
기존 32종은 make_pattern_batch.py(Animagine) 그대로. ERA 표는 64종 전체의 시대 분류(patterns.json 의 era 가 된다).
이름·원작·작가 없이 천·무늬 묘사만. 애니풍 모델은 바닥/무늬에 사람 몸을 그리는 일이 있어 SDXL 기본 모델 + 사람 금지어.
"""
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))

# 기존 32종의 시대 분류
ERA_OLD = {
    'past': ['silk_red_gold', 'brocade_gold', 'batik_indigo', 'linen_stripes', 'velvet_purple', 'damask_crimson', 'bamboo_green',
             'heraldic_blue_gold', 'coins_maroon', 'tartan_green', 'leather_brown', 'lace_white', 'sakura_pink', 'herringbone_camel',
             'canvas_beige', 'scale_silver'],
    'modern': ['floral_blue', 'denim_worn', 'camo_green', 'checker_bw', 'buffalo_plaid', 'tweed_grey', 'stripes_pastel', 'sunflower',
               'leather_studs', 'ethnic_geo', 'waves_teal', 'starry_night'],
    'future': ['circuit_neon', 'holo_iridescent', 'carbon_weave', 'cyber_gradient'],
}

NEW = {
    'past': {   # +4
        'jade_peony_silk': 'jade green silk with subtle woven peony flower pattern',
        'indigo_ikat': 'indigo ikat woven fabric with feathered edge geometric patterns',
        'crimson_felt': 'thick crimson felt wool with fine visible fibers',
        'ochre_hemp': 'ochre hemp cloth with coarse weave and irregular slubs',
    },
    'modern': {   # +8
        'houndstooth_grey': 'grey and black houndstooth wool fabric',
        'polka_navy': 'navy cotton fabric with small white polka dots',
        'argyle_green': 'green and cream argyle diamond knit pattern',
        'corduroy_brown': 'brown corduroy fabric with vertical ribs',
        'knit_cream': 'chunky cream cable knit wool texture',
        'sequin_black': 'black fabric covered in tiny shiny sequins',
        'pinstripe_charcoal': 'charcoal suiting fabric with thin white pinstripes',
        'paisley_teal': 'teal and gold paisley printed cotton',
    },
    'future': {   # +16
        'nano_scale_blue': 'blue nanoscale armor plating pattern with tiny overlapping scales',
        'hex_plate_white': 'white hexagonal ceramic plate pattern with thin gray seams',
        'solar_panel_dark': 'dark blue solar panel cells grid with silver lines',
        'neon_grid_pink': 'black fabric with thin glowing pink grid lines',
        'plasma_veins_violet': 'dark fabric with glowing violet plasma veins',
        'liquid_metal_chrome': 'liquid chrome metal surface with soft ripples',
        'fiber_optic_weave': 'woven fiber optic strands with glowing cyan tips',
        'bio_mesh_green': 'organic green bio mesh lattice with soft glow',
        'hologram_scanlines': 'translucent teal hologram fabric with fine scanlines',
        'ceramic_armor_white': 'white ceramic armor panels with gold trim lines',
        'aurora_gradient': 'smooth aurora gradient fabric in green and violet',
        'graphene_black': 'black graphene carbon fabric with subtle hexagon sheen',
        'quantum_dots_gold': 'dark fabric scattered with tiny glowing gold dots',
        'smart_fabric_ripple': 'silver smart fabric with concentric ripple pattern',
        'data_stream_blue': 'dark blue fabric with flowing columns of tiny glowing characters',
        'ion_glow_orange': 'charcoal fabric with soft glowing orange ion streaks',
    },
    'crest': {   # +4 문장
        'crest_crane_gold': 'repeating abstract crane silhouette emblem in gold on dark green, flat textile design',
        'crest_wave_blue': 'repeating stylized wave emblem in white on deep blue, flat textile design',
        'crest_sun_red': 'repeating stylized sun burst emblem in gold on crimson, flat textile design',
        'crest_moon_silver': 'repeating crescent moon and star emblem in silver on indigo, flat textile design',
    },
}

NEG = ('person, people, human, body, skin, hands, feet, face, nude, naked, character, anime, girl, boy, animal, text, watermark, signature, border, '
       'frame, vignette, perspective, folds, wrinkles, shadow, 3d render, blurry, lowres, worst quality')

items, era_table = [], {}
for era, d in NEW.items():
    for k, v in d.items():
        h = 2166136261
        for c in k.encode():
            h = ((h ^ c) * 16777619) & 0xFFFFFFFF
        items.append({'id': 'pat_' + k, 'seed': h,
                      'prompt': f'flat lay, seamless tileable textile pattern, top-down close up, {v}, even lighting, high detail fabric texture'})
        era_table['pat_' + k] = era
for era, ks in ERA_OLD.items():
    for k in ks:
        era_table['pat_' + k] = era
assert len(era_table) == 64, len(era_table)
cnt = {}
for e in era_table.values():
    cnt[e] = cnt.get(e, 0) + 1
assert cnt == {'past': 20, 'modern': 20, 'future': 20, 'crest': 4}, cnt

b = {'model': 'z-image-turbo', 'out': 'web_patterns_64',
     'defaults': {'prompt_prefix': 'seamless tileable fabric swatch', 'width': 640, 'height': 640, 'steps': 30, 'cfg': 6.5, 'sampler': 'Euler a', 'negative': NEG},
     'items': items}
json.dump(b, open(os.path.join(HERE, 'batches', 'web_patterns_new32.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
json.dump(era_table, open(os.path.join(HERE, 'batches', 'web_patterns_64_era.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(len(items), cnt)
