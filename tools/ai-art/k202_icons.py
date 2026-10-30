"""K-0202 ④ UI 아이콘 — 이모지 대신 쓸 상위 60종 × 다섯 판(판마다 A 시안의 결)을 로컬 AI 로 만들어 정본에 놓는다.
  py tools/ai-art/k202_icons.py plan [--only a,b]           → batches/k202_icons.json (60×5 항목, 판·개념 줄일 수 있음 --games go,dungeon --concepts coin,sword)
  py tools/ai-art/gen.py batches/k202_icons.json --variants 2 --only <id,id…>   (ComfyUI 켠 뒤, 한 번에 12항목)
  bash tools/asset-audit/judge/judge.sh score tools/ai-art/_out/k202/icons --per-group 1       (묶음 = 판_개념 에서 1장)
  py tools/ai-art/k202_icons.py pack                        → saga-assets/icons/ui5/<판>/<개념>.png(128)·_64.png + index.json + license/
  py tools/ai-art/k202_icons.py sheet                       → tasks/sheets/k202_icons_<판>.jpg (눈 확인)
그림은 animagine-xl-4.0-opt(상업 허용, COMMERCIAL_SWAP_TODO.md) — 원작 아이콘·로고 안 가져옴, 문법(재료)만. 웹 배선(이모지 → 아이콘)은 웹 몫(수신함)."""
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))

# 이모지 → (개념 id, 영어 설명). 빈도순(emoji_count.py). ✕ ↔ ☰ ⚠ ⚙ 같은 기하 기호는 코드 아이콘(make_ui_icons.py)이 맡고, 동물·괴물은 도감 그림이라 뺀다.
CONCEPTS = [
    ('📋', 'clipboard', 'a clipboard with a checklist'), ('🪙', 'coin', 'a single round coin'), ('⚔', 'swords', 'two crossed swords'),
    ('📜', 'scroll', 'a rolled scroll'), ('🌾', 'wheat', 'a bundle of wheat ears'), ('📖', 'book', 'an open book'),
    ('🎯', 'target', 'an archery target with an arrow'), ('🔥', 'flame', 'a flame'), ('🐎', 'horse', 'a horse head'),
    ('✨', 'sparkle', 'sparkles and stars'), ('🪖', 'helmet', 'a soldier helmet'), ('🚩', 'flag', 'a flag on a pole'),
    ('🤖', 'golem', 'a small mechanical golem head'), ('🛡', 'shield', 'a shield'), ('🌿', 'herb', 'a leafy herb sprig'),
    ('🏹', 'bow', 'a bow with an arrow'), ('🗡', 'dagger', 'a dagger'), ('🗺', 'map', 'a folded map'),
    ('🌀', 'whirl', 'a swirling spiral'), ('🏯', 'castle', 'a fortress castle'), ('🧭', 'compass', 'a compass'),
    ('🌊', 'wave', 'ocean waves'), ('🐟', 'fish', 'a fish'), ('👤', 'person', 'a plain person bust silhouette'),
    ('🔮', 'orb', 'a crystal ball on a stand'), ('📦', 'crate', 'a wooden crate'), ('👑', 'crown', 'a crown'),
    ('🪨', 'rock', 'a rock'), ('🤝', 'handshake', 'two hands shaking'), ('💬', 'speech', 'a speech bubble'),
    ('💰', 'moneybag', 'a bag of money'), ('💀', 'skull', 'a skull'), ('💧', 'drop', 'a water drop'),
    ('🏆', 'trophy', 'a trophy cup'), ('🎁', 'gift', 'a wrapped gift box'), ('🧊', 'ice', 'an ice cube'),
    ('🐾', 'paw', 'an animal paw print'), ('❄', 'snow', 'a snowflake'), ('🏳', 'whiteflag', 'a plain flag of surrender'),
    ('🪧', 'signpost', 'a wooden signpost'), ('🕳', 'pit', 'a hole in the ground'), ('🎒', 'backpack', 'a backpack'),
    ('🧪', 'potion', 'a potion flask'), ('🏠', 'house', 'a small house'), ('🌙', 'moon', 'a crescent moon'),
    ('🪢', 'knot', 'a rope knot'), ('💎', 'gem', 'a cut gemstone'), ('🌸', 'blossom', 'a blossom flower'),
    ('🎖', 'medal', 'a military medal with ribbon'), ('🗿', 'idol', 'a stone idol statue'), ('⚡', 'bolt', 'a lightning bolt'),
    ('🔨', 'hammer', 'a hammer'), ('🧱', 'bricks', 'a brick wall piece'), ('⛰', 'mountain', 'a mountain'),
    ('🏮', 'lantern', 'a paper lantern'), ('🏛', 'hall', 'a columned hall building'), ('🏪', 'shop', 'a small market shop'),
    ('⛵', 'boat', 'a sailing boat'), ('★', 'star', 'a gold star'),
]
# 판마다 A 시안의 재료·결(K-0202 ② 2차 「a로」) — 같은 물건이 판마다 다른 재료로 보이게
STYLES = {
    'go': ('saga-go', 'topographic map badge icon, soft teal and cream pastel, thin contour lines, flat clean rounded shapes'),
    'dungeon': ('saga-dungeon', 'dark forged iron plate relief icon, engraved rune grooves, tiny rivets, faint amber glow, heavy metal'),
    'forest': ('saga-forest', 'embroidered cloth patch badge icon, the object stitched in colorful thread on a flat fabric patch, visible stitched border, pastel patchwork fabric'),
    'story': ('saga-story', 'bold comic book sticker icon, thick black ink outline, halftone dots, flat vivid colors'),
    'realm': ('saga-realm', 'woodblock print icon, carved black ink lines on aged paper, vermilion red seal accent, limited palette'),
}
PRE = 'masterpiece, high score, great score, absurdres'
NEG = 'text, letters, watermark, signature, frame, border, multiple objects, hands, human, face, ground shadow, cropped, blurry, lowres, worst quality'
OUT = os.path.join(HERE, '_out', 'k202', 'icons_b')
DEST = os.path.join(ROOT, 'saga-assets', 'icons', 'ui5')


def opt(f, d=None):
    return sys.argv[sys.argv.index(f) + 1] if f in sys.argv else d


def plan():
    games = opt('--games', ','.join(STYLES)).split(','); only = opt('--concepts')
    only = only.split(',') if only else None
    items = []
    for gi, g in enumerate(games):
        for ci, (emo, cid, desc) in enumerate(CONCEPTS):
            if only and cid not in only:
                continue
            human = '' if cid in ('person', 'handshake') else 'no humans, '
            items.append({'id': f'{g}_{cid}', 'seed': 2026113000 + gi * 1000 + ci * 7,
                          'prompt': f'{PRE}, {human}(({desc}):1.4), {STYLES[g][1]}, single object, centered, simple plain light gray background, game item icon',
                          'negative': NEG, 'width': 1024, 'height': 1024})
    d = {'model': 'animagine-xl-4.0-opt', 'out': 'k202/icons_b', 'note': 'K-0202 ④ UI 아이콘 상위 60 × 다섯 판(A 시안 재료)',
         'kit': {'spec': 'icon', 'style': 'C', 'style_name': '판별 재료'},
         'defaults': {'prompt_prefix': '', 'width': 1024, 'height': 1024, 'steps': 28, 'cfg': 6.0, 'sampler': 'Euler a', 'negative': NEG, 'variants': 2}, 'items': items}
    json.dump(d, open(os.path.join(HERE, 'batches', 'k202_icons.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print('K202_PLAN', len(items), '항목')


PICKS = os.path.join(HERE, '_out', 'k202', 'icon_picks.json')   # 항목 id → 고른 변주 'v01'(기본)·'v02'…


def picks():
    return json.load(open(PICKS, encoding='utf-8')) if os.path.exists(PICKS) else {}


def png_of(iid):  # 아래 c 목록: 고른 변주 'rN' 은 <id>_rN.png
    """고른 변주(icon_picks.json) > 변주 하나로 만든 <id>.png > 시험 변주 <id>_v01.png"""
    c = [os.path.join(OUT, f'{iid}_{picks()[iid]}.png')] if iid in picks() else []
    c += [os.path.join(OUT, f'{iid}.png'), os.path.join(OUT, f'{iid}_v01.png')]
    return next((x for x in c if os.path.exists(x)), c[-1])


def all_ids():
    d = json.load(open(os.path.join(HERE, 'batches', 'k202_icons.json'), encoding='utf-8'))
    return [i['id'] for i in d['items']]


def pack():
    """고른 그림 → 배경 제거(u2net·matte) → 알맹이 자르기 → 정사각 → 128·64 → 정본 saga-assets/icons/ui5/<판>/ + license + index.json"""
    sys.path.insert(0, HERE)
    from k163_illust import cutout
    from PIL import Image
    emo = {cid: (e, d) for e, cid, d in CONCEPTS}
    idx = {'size': 128, 'note': 'K-0202 ④ 이모지 대신 쓸 UI 아이콘(판마다 A 시안 재료) — 웹 배선은 웹 몫', 'games': {}, 'concepts': {}}
    n = 0
    for iid in all_ids():
        src = png_of(iid)
        if not os.path.exists(src):
            continue
        g, cid = iid.split('_', 1)
        im = cutout(Image.open(src).convert('RGB'))
        box = im.getchannel('A').point(lambda v: 255 if v > 40 else 0).getbbox()
        if not box:
            print('빈 그림', iid); continue
        im = im.crop(box); s = max(im.size); pad = int(s * 0.06)
        sq = Image.new('RGBA', (s + pad * 2, s + pad * 2), (0, 0, 0, 0)); sq.paste(im, (pad + (s - im.width) // 2, pad + (s - im.height) // 2))
        d = os.path.join(DEST, g); os.makedirs(os.path.join(d, 'license'), exist_ok=True)
        sq.resize((128, 128), Image.LANCZOS).save(os.path.join(d, cid + '.png'))
        sq.resize((64, 64), Image.LANCZOS).save(os.path.join(d, cid + '_64.png'))
        lp = src[:-4] + '.license.json'
        lic = json.load(open(lp, encoding='utf-8')) if os.path.exists(lp) else {}
        lic.update({'id': f'ui5_{g}_{cid}', 'ticket': 'K-0202', 'packed_by': 'tools/ai-art/k202_icons.py pack(배경 제거·알맹이 자르기·128/64)', 'from': os.path.relpath(src, ROOT).replace(os.sep, '/')})
        json.dump(lic, open(os.path.join(d, 'license', cid + '.license.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
        idx['games'].setdefault(g, []).append(cid); n += 1
    for cid, (e, desc) in emo.items():
        idx['concepts'][cid] = {'emoji': e, 'desc': desc}
    json.dump(idx, open(os.path.join(DEST, 'index.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print('K202_PACK', n)


def sheet():
    """판마다 한 장(10열) — 눈 확인. 128 정본이 있으면 그것, 없으면 원본(작게)."""
    from PIL import Image, ImageDraw
    cell = 112
    for g in STYLES:
        ids = [i for i in all_ids() if i.startswith(g + '_') and os.path.exists(png_of(i))]
        if not ids:
            continue
        cols = 10; rows = (len(ids) + cols - 1) // cols
        sh = Image.new('RGB', (cell * cols, (cell + 12) * rows), '#2b2f2c'); dr = ImageDraw.Draw(sh)
        for k, iid in enumerate(ids):
            cid = iid.split('_', 1)[1]; f = os.path.join(DEST, g, cid + '.png')
            im = Image.open(f).convert('RGBA') if os.path.exists(f) else Image.open(png_of(iid)).convert('RGBA')
            im = im.resize((cell - 8, cell - 8), Image.LANCZOS); x, y = (k % cols) * cell, (k // cols) * (cell + 12)
            sh.paste(im, (x + 4, y + 12), im); dr.text((x + 3, y), cid, fill='white')
        out = os.path.join(HERE, '_out', 'k202', f'sheet_{g}.jpg'); sh.save(out, quality=82); print('SHEET', g, len(ids), out)


def multi():
    """한 물건이어야 하는데 여러 개(격자·세트)로 나온 항목 찾기 — 정본 128 알파의 연결 덩어리 중 가장 큰 것의 25% 넘는 것이 3개 이상이거나, 알맹이가 칸을 거의 못 채운 것.
    → _out/k202/icon_reroll.txt (id 줄바꿈). 그 뒤 `reroll` 로 다른 시드·강한 네거티브로 다시 만든다."""
    import numpy as np
    from PIL import Image
    from scipy import ndimage
    bad = []
    for iid in all_ids():
        g, cid = iid.split('_', 1)
        f = os.path.join(DEST, g, cid + '.png')
        if not os.path.exists(f):
            continue
        a = np.asarray(Image.open(f).convert('RGBA'))[..., 3] > 60
        lab, k = ndimage.label(ndimage.binary_closing(a, iterations=2))
        if k < 1:
            bad.append(iid); continue
        area = np.array(ndimage.sum(a, lab, range(1, k + 1)))
        big = int((area > area.max() * 0.25).sum())
        if big >= 3 or a.mean() < 0.12:
            bad.append(iid)
    open(os.path.join(HERE, '_out', 'k202', 'icon_reroll.txt'), 'w').write(chr(10).join(bad))
    print('K202_MULTI', len(bad), '/', len(all_ids()), ' '.join(bad)[:900])


def reroll():
    """icon_reroll.txt 의 항목을 다른 시드(+9000·번호)와 「여러 개·세트·격자」를 막는 네거티브로 다시 만들어 <id>_r<N>.png 로 두고 icon_picks.json 이 그것을 가리키게 한다."""
    import subprocess
    ids = [x for x in open(os.path.join(HERE, '_out', 'k202', 'icon_reroll.txt')).read().split() if x]
    rd = int(opt('--round', 1))
    d = json.load(open(os.path.join(HERE, 'batches', 'k202_icons.json'), encoding='utf-8'))
    by = {i['id']: i for i in d['items']}
    items = []
    for iid in ids:
        it = json.loads(json.dumps(by[iid])); it['id'] = f'{iid}_r{rd}'; it['seed'] += 9000 * rd
        it['negative'] += ', set, collection, grid, group, multiple items, many, several, pattern of repeated, duplicates, two, three, pair'
        it['prompt'] = it['prompt'].replace('single object, centered,', 'one single object only, large, filling the frame, centered,')
        items.append(it)
    d2 = dict(d, items=items); d2['out'] = 'k202/icons_b'
    bp = os.path.join(HERE, 'batches', 'k202_icons_reroll.json'); json.dump(d2, open(bp, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    for k in range(0, len(items), 24):
        grp = ','.join(i['id'] for i in items[k:k + 24])
        subprocess.call([sys.executable, os.path.join(HERE, 'gen.py'), bp, '--only', grp, '--variants', '1'])
    pk = picks()
    for iid in ids:
        if os.path.exists(os.path.join(OUT, f'{iid}_r{rd}.png')):
            pk[iid] = f'r{rd}'
    json.dump(pk, open(PICKS, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print('K202_REROLL', len(ids))


def main():
    cmd = sys.argv[1] if len(sys.argv) > 1 else 'plan'
    if cmd == 'plan':
        plan()
    elif cmd == 'pack':
        pack()
    elif cmd == 'sheet':
        sheet()
    elif cmd == 'multi':
        multi()
    elif cmd == 'reroll':
        reroll()
    else:
        print('아직 없음:', cmd)


if __name__ == '__main__':
    main()
