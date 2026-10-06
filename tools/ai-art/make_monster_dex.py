"""K-0032 — 몬스터 도감 초상: K-0043 몬스터 몸 32종(mon_* 20 + boss_* 12)의 3D 렌더를 밑그림으로 img2img 초상을 만든다.

  py tools/ai-art/make_monster_dex.py render   # 몸 GLB(saga-assets/world/toon) → 흰 배경 3/4 렌더 768 (_out/monster_init/<id>.png)  — Blender
  py tools/ai-art/make_monster_dex.py batch    # → batches/monster_dex.json (Animagine XL 4.0, 몸 하나당 후보 2, denoise 0.62)
  py tools/ai-art/make_monster_dex.py sheet    # 고르기 시트 8종씩 4장 → _out/monster_dex_pick_1~4.jpg
  py tools/ai-art/make_monster_dex.py pack [picks]   # 고른 후보 → <id>_s.webp(192 정사각)·<id>_c.webp(카드 300×344) (_out/monster_dex_final/), picks = _out/monster_dex_picks.json {"id":k}
  py tools/ai-art/make_monster_dex.py check    # 32 × 2 · .license.json 100%

10-06 다시(K-0043 새 몸): batch 대신 키트 — `batches/_in/monster_dex_C.json`(몸마다 주제 태그, 그림체 C, img2img 0.62) → prompt_kit build → regen_P.sh(후보 4 + 판정기)
→ 눈으로 고른 `_out/monster_dex_picks_C.json`({id: "monster_dex_C/<id>_v0N.png"}) → pack. 아래 FAM_TXT·batch 는 옛 몸(9-말) 기록.

도감 데이터(`MONSTERS`)는 웹 갈래가 아직 안 만들었다 — id 는 몸 파일 이름(`mon_quad_01`·`boss_03`)을 그대로 쓰고 표시 이름은 웹이 정한다(원작 몬스터 이름 금지).
초상 규격은 인물·펫 도감과 같다(정사각 192 + 카드 300×344). 글씨·원작 이름 없음(gen.py BLOCK).
"""
import colorsys
import glob
import json
import os
import subprocess
import sys

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
OUT = os.path.join(HERE, '_out')
INIT = os.path.join(OUT, 'monster_init')
FINAL = os.path.join(OUT, 'monster_dex_final')
BODIES = os.path.join(ROOT, 'saga-assets', 'world', 'toon')
BLENDER = os.environ.get('BLENDER', 'C:/Program Files/Blender Foundation/Blender 5.2/blender.exe')
IDS = [f'mon_{f}_{i:02d}' for f in ('quad', 'wing', 'serp', 'cons', 'spir') for i in range(1, 5)] + [f'boss_{i:02d}' for i in range(1, 13)]
FAM_TXT = {
    'quad': 'four-legged fantasy beast creature, stocky body, horns and spikes on its back, glowing eyes',
    'wing': 'fantasy winged creature, bird-like body with broad wings, sharp beak, glowing eyes',
    'serp': 'giant serpent monster, long coiled segmented body, fangs, small horns, glowing eyes',
    'cons': 'ancient stone-and-metal golem construct, boxy body, glowing core in the chest, antenna',
    'spir': 'floating spirit orb creature, round glowing body with flame-like tails, orbiting shards, glowing eyes',
}
BOSS = {1: 'quad', 2: 'quad', 3: 'quad', 4: 'wing', 5: 'wing', 6: 'serp', 7: 'serp', 8: 'cons', 9: 'cons', 10: 'spir', 11: 'spir', 12: 'quad'}
BOSS_DECO = {1: 'spiked armor plates', 2: 'a crown of black horns', 3: 'glowing rune stripes', 4: 'a crown of black horns', 5: 'spiked armor plates', 6: 'a crown of black horns',
             7: 'glowing rune stripes', 8: 'heavy armor plates', 9: 'glowing rune stripes', 10: 'a crown of black horns', 11: 'glowing rune stripes', 12: 'spiked armor plates'}
STYLE = 'game monster portrait, soft painterly shading, thin dark outline, rich colors, detailed texture, simple background, white background, centered, single creature, full body'
NEG = ('lowres, bad anatomy, bad hands, extra limbs, text, error, signature, watermark, username, blurry, cropped, worst quality, low quality, ground shadow, gradient background, '
       'background scenery, multiple views, border, frame, human, person, people, multiple creatures, flag, banner')


def color_word(path):
    im = Image.open(path).convert('RGBA')
    px = [p for p in im.resize((96, 96)).getdata() if p[3] > 200]
    if not px:
        return 'gray'
    r, g, b = [sum(p[i] for p in px) / len(px) / 255 for i in range(3)]
    h, s, v = colorsys.rgb_to_hsv(r, g, b)
    if v < 0.28:
        return 'dark charcoal'
    if s < 0.18:
        return 'pale gray' if v > 0.6 else 'slate gray'
    deg = h * 360
    for lim, name in ((20, 'reddish brown'), (45, 'tan brown'), (70, 'olive green'), (170, 'mossy green'), (260, 'blue gray'), (320, 'purple'), (361, 'reddish brown')):
        if deg < lim:
            return name
    return 'brown'


def desc(pid):
    if pid.startswith('boss_'):
        n = int(pid.split('_')[1])
        return 'colossal boss monster, ' + FAM_TXT[BOSS[n]] + ', ' + BOSS_DECO[n] + ', menacing, huge'
    return FAM_TXT[pid.split('_')[1]]


def render():
    os.makedirs(INIT, exist_ok=True)
    ids = [i for i in IDS if os.path.exists(os.path.join(BODIES, i + '.glb'))]
    tmp = os.path.join(INIT, '_glb')
    os.makedirs(tmp, exist_ok=True)
    import shutil
    for i in ids:
        shutil.copyfile(os.path.join(BODIES, i + '.glb'), os.path.join(tmp, i + '.glb'))
    subprocess.run([BLENDER, '-b', '--factory-startup', '-P', os.path.join(HERE, 'render_monster_init.py'), '--', tmp, INIT], stdin=subprocess.DEVNULL, check=True,
                   stdout=subprocess.DEVNULL)
    for i in ids:
        rgba = Image.open(os.path.join(INIT, i + '_rgba.png'))
        bg = Image.new('RGB', rgba.size, (255, 255, 255))
        bg.paste(rgba, mask=rgba.getchannel('A'))
        bg.save(os.path.join(INIT, i + '.png'))
    print('RENDER', len(ids))


def batch():
    items = []
    for n, pid in enumerate(IDS):
        ip = os.path.join(INIT, pid + '.png')
        if not os.path.exists(ip):
            raise SystemExit('밑그림 없음 — render 먼저: ' + pid)
        cw = color_word(os.path.join(INIT, pid + '_rgba.png'))
        for k in (1, 2):
            items.append({'id': f'{pid}_{k}', 'seed': 20271005 + 97 * n + 13 * k, 'prompt': f'{desc(pid)}, {cw} skin, {STYLE}', 'negative': NEG, 'init_image': ip, 'denoise': 0.62,
                          'meta': {'mode': 'img2img', 'init_image': pid + '.png (K-0043 몬스터 몸 렌더, tools/world-forge/build_monster.py)', 'denoise': 0.62,
                                   'init_license': 'CC0-1.0 (코드 형태 + Poly Haven CC0 재질)'}})
    b = {'model': 'animagine-xl-4.0-opt', 'out': 'monster_dex',
         'defaults': {'prompt_prefix': 'masterpiece, high score, great score, absurdres', 'width': 768, 'height': 768, 'steps': 28, 'cfg': 5.5, 'sampler': 'Euler a', 'negative': NEG}, 'items': items}
    json.dump(b, open(os.path.join(HERE, 'batches', 'monster_dex.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print('BATCH monster_dex', len(items))


def sheet():
    """고르기 시트 — 8종씩 네 장(_out/monster_dex_pick_1~4.jpg): 밑그림 | 후보 1 | 후보 2."""
    from PIL import ImageDraw
    w = 200
    for part in range(4):
        ids = IDS[part * 8:(part + 1) * 8]
        s = Image.new('RGB', (w * 3, (w + 12) * len(ids)), (60, 66, 72))
        d = ImageDraw.Draw(s)
        for r, pid in enumerate(ids):
            for c, p in enumerate([os.path.join(INIT, pid + '.png')] + [os.path.join(OUT, 'monster_dex', f'{pid}_{k}.png') for k in (1, 2)]):
                if os.path.exists(p):
                    s.paste(Image.open(p).convert('RGB').resize((w, w)), (c * w, r * (w + 12) + 12))
                d.text((c * w + 3, r * (w + 12)), pid + (' base' if c == 0 else f' #{c}'), fill='yellow')
        s.save(os.path.join(OUT, f'monster_dex_pick_{part + 1}.jpg'), quality=78)
    print('SHEET 4')


def pack(picks_path=None):
    picks_path = picks_path or os.path.join(OUT, 'monster_dex_picks.json')
    picks = json.load(open(picks_path, encoding='utf-8')) if os.path.exists(picks_path) else {}
    os.makedirs(FINAL, exist_ok=True)
    for pid in IDS:
        k = picks.get(pid, 1)
        src = os.path.join(OUT, k) if isinstance(k, str) else os.path.join(OUT, 'monster_dex', f'{pid}_{k}.png')   # 10-06: 값이 문자열이면 _out 기준 경로(키트 배치 monster_dex_C/<id>_v0N.png)
        im = Image.open(src).convert('RGB')
        im.crop((0, 0, 768, 768)).resize((192, 192), Image.LANCZOS).save(os.path.join(FINAL, pid + '_s.webp'), 'WEBP', quality=88, method=6)
        im.crop((0, 0, 768, 768)).resize((300, 300), Image.LANCZOS).convert('RGB')
        card = Image.new('RGB', (300, 344), (255, 255, 255))
        card.paste(im.resize((300, 300), Image.LANCZOS), (0, 22))
        card.save(os.path.join(FINAL, pid + '_c.webp'), 'WEBP', quality=86, method=6)
        lp = src[:-4] + '.license.json'
        lic = json.load(open(lp, encoding='utf-8')) if os.path.exists(lp) else {}
        lic.update({'id': pid, 'picked_candidate': k, 'sizes': {'s': [192, 192], 'c': [300, 344]}, 'packed_by': 'tools/ai-art/make_monster_dex.py pack'})
        json.dump(lic, open(os.path.join(FINAL, pid + '.license.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print('PACK', len(IDS))


def check():
    bad = []
    for pid in IDS:
        for suf, size in (('_s', (192, 192)), ('_c', (300, 344))):
            p = os.path.join(FINAL, pid + suf + '.webp')
            if not os.path.exists(p):
                bad.append('없음 ' + pid + suf)
            elif Image.open(p).size != size:
                bad.append('크기 ' + pid + suf)
        if not os.path.exists(os.path.join(FINAL, pid + '.license.json')):
            bad.append('license ' + pid)
    tot = sum(os.path.getsize(f) for f in glob.glob(os.path.join(FINAL, '*.webp'))) / 1024
    print(f'몬스터 {len(IDS)} · {tot:.0f}KB')
    print('MONDEX_FAIL' if bad else 'MONDEX_OK', bad if bad else '')
    return 1 if bad else 0


if __name__ == '__main__':
    cmd = sys.argv[1] if len(sys.argv) > 1 else ''
    if cmd == 'render':
        render()
    elif cmd == 'batch':
        batch()
    elif cmd == 'sheet':
        sheet()
    elif cmd == 'pack':
        pack(sys.argv[2] if len(sys.argv) > 2 else None)
    elif cmd == 'check':
        sys.exit(check())
    else:
        print(__doc__)
