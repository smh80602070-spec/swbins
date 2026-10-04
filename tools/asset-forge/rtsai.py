"""K-0061 사가국지 RTS 화면 에셋 — AI 로 그리는 것: 지형 바닥 타일 · 건물·거점·적 기지 · 유닛 3종 × 아군/적 (K-0056 그림체 B).

  py tools/asset-forge/rtsai.py batches        # tools/ai-art/batches/rts_tiles.json · rts_bld.json · rts_units.json 을 쓴다(gen.py 로 생성)
  py tools/asset-forge/rtsai.py pack-tiles     # 생성 타일(_out/rts_tiles) → 이음새 없는 64px webp (_out/rts/rts_<이름>.webp)
  py tools/asset-forge/rtsai.py pack-bld       # 건물(_out/rts_bld) → pack_static2d 로 256px 알파 (_out/rts/rts_<이름>.webp)
  py tools/asset-forge/rtsai.py pack-units     # 유닛(_out/rts_units) → pack_moving2d 로 정면·옆·뒤 (_out/rts_units_pack/<이름>/)
  py tools/asset-forge/rtsai.py transitions    # 땅 경계 전환 조각(풀↔숲·물·언덕 각 12) — 고른 타일로 코드 생성 (_out/rts/rts_tr_*.webp)

글씨·한글은 그리지 않는다. 건물 밑그림 = `tools/world-forge/build_rts.py` 3D 렌더(`_out/rts/sprite`, `SIZE=512 EL=40 _render_dir.sh`), 유닛은 K-0056 방식 txt2img(같은 씨앗·시점 낱말만 변경).
"""
import hashlib
import json
import os
import sys

import numpy as np
from PIL import Image, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
AI = os.path.join(ROOT, 'tools', 'ai-art')
OUT = os.path.join(HERE, '_out', 'rts')
sys.path.insert(0, AI)

TILES = {  # id: 설명(SDXL base 타일 문체 뒤에 붙음)
    'rts_forest_floor_1': 'forest floor, dark brown soil with fallen leaves and green moss, scattered pine needles, even lighting',
    'rts_forest_floor_2': 'forest floor, damp soil with dry leaves, small ferns and roots, even lighting',
    'rts_hill_1': 'rocky highland ground, gray and brown stones with sparse dry grass between them, even lighting',
    'rts_hill_2': 'rocky hillside soil, cracked gray rock with tufts of yellow-green grass, even lighting',
    'rts_grass_flower_1': 'lush green meadow grass with tiny white and yellow wildflowers, even lighting',
    'rts_grass_flower_2': 'short green grass with small pink and white clover flowers, even lighting',
}
BLD_SUBJ = {
    'rts_workshop_01': 'village craftsman workshop, wooden hall with red tiled roof, chimney, anvil and stacked firewood in front',
    'rts_field_01': 'fenced farm field with rows of golden wheat and green crops, wooden fence',
    'rts_wall_corner_01': 'stone fortress wall corner with round tower and battlements',
    'rts_fortress_01': 'stone castle keep, four corner towers with red roofs, central hall, wooden gate, no flags',
    'rts_enemy_base_a': 'dark black stone fortress, four spiked towers with black pointed roofs, red glowing braziers at the gate, menacing, no flags',
    'rts_enemy_base_b': 'dark black stone fortress, cracked walls, one broken tower, rubble and holes, damaged, no flags',
    'rts_enemy_base_c': 'ruined burning black stone fortress, collapsed walls, orange fire and flames, smoke, no flags',
}
TEAMS = {'ally': 'blue and white clothing, blue cloth', 'enemy': 'dark crimson and black clothing, crimson cloth'}
UNITS = {
    'inf': '1boy, foot soldier, round iron helmet, spear, round wooden shield, leather armor, {team}, standing, solo',
    'arc': '1boy, archer, hooded, longbow, quiver of arrows on the back, light leather armor, {team}, standing, solo',
    'cav': '1boy, cavalry rider sitting on a brown horse, steel helmet, long lance, {team} horse cloth, full horse and rider visible, solo',
}
STYLE = 'game sprite, soft painterly shading, thin dark outline, rich colors, detailed texture, simple background, white background, centered, single character, full body'
NEG_U = ('lowres, bad anatomy, bad hands, extra limbs, text, error, signature, watermark, username, blurry, cropped, worst quality, low quality, ground shadow, gradient background, '
         'background scenery, multiple views, border, frame, multiple people, grass, flowers, ground, flag, banner')
VIEWS = {'front': 'front view, facing the viewer', 'side': 'side view, facing right, profile', 'back': 'back view, seen from behind'}
BSTYLE = 'game sprite, soft painterly shading, thin dark outline, rich colors, detailed texture, simple background, white background, centered, single object'
BNEG = ('lowres, bad anatomy, text, error, signature, watermark, username, blurry, cropped, worst quality, low quality, ground shadow, gradient background, background scenery, '
        'multiple views, border, frame, human, person, people, flag, banner')


def batches():
    plan = json.load(open(os.path.join(AI, 'data', 'web2d_plan.json'), encoding='utf-8'))
    ts = plan['tile_style']
    items = []
    for i, (tid, desc) in enumerate(TILES.items()):
        items.append({'id': tid, 'seed': 20271004 + 37 * i, 'prompt': desc, 'negative': ts['negative'] + ', ' + ts['negative_nogrid']})
    json.dump({'model': plan['models']['tile'], 'out': 'rts_tiles',
               'defaults': {'prompt_prefix': ts['prefix'], 'width': 640, 'height': 640, 'steps': ts['steps'], 'cfg': ts['cfg'], 'sampler': ts['sampler'], 'negative': ts['negative']},
               'items': items}, open(os.path.join(AI, 'batches', 'rts_tiles.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    # 건물 — 3D 렌더 밑그림 img2img(K-0056 방식)
    init_dir = os.path.join(AI, '_out', 'rts_bld_init')
    os.makedirs(init_dir, exist_ok=True)
    bitems = []
    for bid, subj in BLD_SUBJ.items():
        src = os.path.join(ROOT, 'tools', 'world-forge', '_out', 'rts', 'sprite', bid + '.png')
        if not os.path.exists(src):
            print('밑그림 없음', bid)
            continue
        sp = Image.open(src).convert('RGBA')
        bb = sp.getchannel('A').point(lambda v: 255 if v > 24 else 0).getbbox()
        sp = sp.crop(bb)
        k = 640 / max(sp.size)
        sp = sp.resize((max(1, round(sp.width * k)), max(1, round(sp.height * k))), Image.LANCZOS)
        cv = Image.new('RGB', (768, 768), (255, 255, 255))
        cv.paste(sp, ((768 - sp.width) // 2, (768 - sp.height) // 2 + 20), sp)
        ip = os.path.join(init_dir, bid + '.png')
        cv.save(ip)
        bitems.append({'id': bid, 'seed': int(hashlib.md5(('rts:' + bid).encode()).hexdigest()[:8], 16), 'prompt': f'{subj}, three-quarter view from above, {BSTYLE}', 'negative': BNEG,
                       'init_image': ip, 'denoise': 0.65, 'meta': {'mode': 'img2img', 'init_image': bid + '.png (3D 밑그림, tools/world-forge/build_rts.py)', 'denoise': 0.65, 'init_license': 'CC0-1.0 (코드 형태 + Poly Haven CC0 재질)'}})
    json.dump({'model': 'animagine-xl-4.0-opt', 'out': 'rts_bld',
               'defaults': {'prompt_prefix': 'masterpiece, high score, great score, absurdres', 'width': 768, 'height': 768, 'steps': 28, 'cfg': 5.5, 'sampler': 'Euler a', 'negative': BNEG},
               'items': bitems}, open(os.path.join(AI, 'batches', 'rts_bld.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    uitems = []
    for ukey, tmpl in UNITS.items():
        for team, tdesc in TEAMS.items():
            cid = f'rts_{ukey}_{team}'
            seed = int(hashlib.md5(('rtsu:' + cid).encode()).hexdigest()[:8], 16)
            for v, vt in VIEWS.items():
                uitems.append({'id': f'{cid}_{v}', 'seed': seed, 'prompt': f'{tmpl.format(team=tdesc)}, {vt}, {STYLE}', 'negative': NEG_U})
    json.dump({'model': 'animagine-xl-4.0-opt', 'out': 'rts_units',
               'defaults': {'prompt_prefix': 'masterpiece, high score, great score, absurdres', 'width': 768, 'height': 768, 'steps': 28, 'cfg': 5.5, 'sampler': 'Euler a', 'negative': NEG_U},
               'items': uitems}, open(os.path.join(AI, 'batches', 'rts_units.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print('BATCH rts_tiles', len(items), '· rts_bld', len(bitems), '· rts_units', len(uitems))


def pack_tiles():
    import make_seamless as MS
    os.makedirs(OUT, exist_ok=True)
    src = os.path.join(AI, '_out', 'rts_tiles')
    n = 0
    for tid in TILES:
        p = os.path.join(src, tid + '.png')
        if not os.path.exists(p):
            print('없음', tid)
            continue
        im = MS.seamless(Image.open(p).convert('RGB'), 256).resize((64, 64), Image.LANCZOS)
        dst = os.path.join(OUT, tid + '.webp')
        im.save(dst, 'WEBP', quality=90, method=6)
        lp = os.path.join(src, tid + '.license.json')
        lic = json.load(open(lp, encoding='utf-8')) if os.path.exists(lp) else {}
        lic.update({'id': tid, 'size': [64, 64], 'seamless': 'make_seamless', 'packed_by': 'tools/asset-forge/rtsai.py pack-tiles'})
        json.dump(lic, open(os.path.splitext(dst)[0] + '.license.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
        n += 1
    print('지형 타일', n)


def pack_bld():
    import subprocess
    out = os.path.join(AI, '_out', 'rts_bld_pack')
    subprocess.run([sys.executable, os.path.join(AI, 'pack_static2d.py'), os.path.join(AI, '_out', 'rts_bld'), out], check=True)
    os.makedirs(OUT, exist_ok=True)
    import shutil
    for bid in BLD_SUBJ:
        for ext in ('.webp', '.license.json'):
            p = os.path.join(out, bid + ext)
            if os.path.exists(p):
                shutil.copyfile(p, os.path.join(OUT, bid + ext))
    print('건물', len(BLD_SUBJ))


def pack_units():
    import subprocess
    subprocess.run([sys.executable, os.path.join(AI, 'pack_moving2d.py'), os.path.join(AI, '_out', 'rts_units'), os.path.join(AI, '_out', 'rts_units_pack')], check=True)


# ---------------------------------------------------------------- 경계 전환 조각 (고른 타일로 코드 생성)
def edge_mask(kind, T=64):
    """B(위에 얹는 땅) 가 차지하는 알파 마스크. kind: N·E·S·W(변) · oNE·oSE·oSW·oNW(바깥 모서리) · iNE·iSE·iSW·iNW(안쪽 모서리).
    경계선은 타일 가장자리에서 주기 파동(양쪽 타일과 이어짐). 변 = B 가 그 쪽 반(≈40%)을 덮는다."""
    yy, xx = np.mgrid[0:T, 0:T].astype(np.float32)

    def wob(v, ph):
        return 3.2 * np.sin(2 * np.pi * 2 * v / T + ph) + 1.8 * np.sin(2 * np.pi * 5 * v / T + ph * 2.1)

    depth = 26.0
    if kind in ('N', 'S', 'E', 'W'):
        if kind == 'N':
            d = yy - (depth + wob(xx, 0.4))
            m = d < 0
        elif kind == 'S':
            d = (T - 1 - yy) - (depth + wob(xx, 1.1))
            m = d < 0
        elif kind == 'W':
            d = xx - (depth + wob(yy, 2.0))
            m = d < 0
        else:
            d = (T - 1 - xx) - (depth + wob(yy, 2.7))
            m = d < 0
        a = np.clip(-d / 2.5, 0, 1)
        return a
    cx = {'NE': T - 1, 'SE': T - 1, 'SW': 0, 'NW': 0}
    cy = {'NE': 0, 'SE': T - 1, 'SW': T - 1, 'NW': 0}
    c = kind[1:]
    r = np.sqrt((xx - cx[c]) ** 2 + (yy - cy[c]) ** 2)
    ang = np.arctan2(yy - cy[c], xx - cx[c])
    rr = depth + 2.5 * np.sin(ang * 6 + 0.7) + 1.5 * np.sin(ang * 13)
    if kind.startswith('o'):                                                  # 바깥 모서리: B 가 모서리 한 귀퉁이만 덮는다
        return np.clip((rr - r) / 2.5, 0, 1)
    return np.clip((r - rr) / 2.5, 0, 1)                                      # 안쪽 모서리: B 가 모서리 귀퉁이만 빼고 덮는다


EDGE_KINDS = ['N', 'E', 'S', 'W', 'oNE', 'oSE', 'oSW', 'oNW', 'iNE', 'iSE', 'iSW', 'iNW']
PAIRS = {'grass_forest': 'rts_forest_floor_1', 'grass_water': 'rts_water_1', 'grass_hill': 'rts_hill_1'}


def transitions():
    os.makedirs(OUT, exist_ok=True)
    n = 0
    for pair, bname in PAIRS.items():
        bp = os.path.join(OUT, bname + '.webp')
        if not os.path.exists(bp):
            print('없음', bname)
            continue
        B = np.asarray(Image.open(bp).convert('RGB').resize((64, 64))).astype(np.float32)
        for kind in EDGE_KINDS:
            a = edge_mask(kind)
            rgb = B.copy()
            rim = np.clip(1 - np.abs(a - 0.5) * 2, 0, 1)[..., None]                # 경계 띠 살짝 어둡게(물가·숲 가장자리 그늘)
            rgb *= 1 - 0.18 * rim
            im = Image.fromarray(np.dstack([np.clip(rgb, 0, 255), a * 255]).astype(np.uint8), 'RGBA')
            dst = os.path.join(OUT, f'rts_tr_{pair}_{kind}.webp')
            im.save(dst, 'WEBP', quality=90, method=6)
            json.dump({'id': f'rts_tr_{pair}_{kind}', 'generator': 'tools/asset-forge/rtsai.py transitions', 'license': 'CC0-1.0 (코드 생성 + 고른 AI 타일 ' + bname + ')', 'pair': pair,
                       'kind': kind, 'size': [64, 64], 'draw': '아래 땅(풀) 위에 이 조각(위 땅 B)을 얹는다. 변 N·E·S·W = 그 쪽에 B, o* = 바깥 모서리(B 가 귀퉁이), i* = 안쪽 모서리(B 가 귀퉁이만 빼고)'},
                      open(os.path.splitext(dst)[0] + '.license.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
            n += 1
    print('전환 조각', n)


if __name__ == '__main__':
    cmd = sys.argv[1] if len(sys.argv) > 1 else ''
    {'batches': batches, 'pack-tiles': pack_tiles, 'pack-bld': pack_bld, 'pack-units': pack_units, 'transitions': transitions}.get(cmd, lambda: print(__doc__))()
