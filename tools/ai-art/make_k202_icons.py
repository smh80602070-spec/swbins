"""K-0202 ④ — 판마다 결이 다른 UI 아이콘 배치(이모지 대체). 시범 = 1만리 60.

  py tools/ai-art/make_k202_icons.py go trial     # 앞 6개 × 후보 2 → batches/k202_icons_go_trial.json
  py tools/ai-art/make_k202_icons.py go           # 60개 × 후보 3 → batches/k202_icons_go.json
  py tools/ai-art/gen.py tools/ai-art/batches/k202_icons_go.json --judge     (24장 한도 — 여러 번 이어서)

목록 = 1만리 js 의 이모지 빈도 상위(saga-web/saga-go, `tasks` K-0202 메모) 중 UI 조작 기호(✕ ↔ ☰ ✦)를 뺀 60.
그림 결(1만리): 평면 벡터 아이콘 — 굵은 진청록 윤곽·납작한 색·청록·붉은 포인트, 흰 배경 한 물체(10-30 시험: 'map legend' 는 종이·책으로 끌어가서 뺌).
프롬프트에 원작·실존 이름 없음(gen.py BLOCK 이 막는다).
"""
import hashlib
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))

STYLE = {
    'go': 'flat vector icon, thick dark teal outline, flat colors, simple bold shapes, teal and warm red accents, sticker style',
}
TAIL = 'no humans, still life, object focus, game icon, simple background, white background, centered, single object'
NEG = ('1girl, 1boy, solo, human, lowres, bad anatomy, text, error, signature, watermark, username, blurry, frame, border, multiple objects, hands, person, character, '
       'ground shadow, gradient background, background scenery, cropped, worst quality, low quality, box, gift box, picture frame, '
       'paper, parchment, map, book, torn paper, grid, notebook, 3d render, isometric, perspective, shading')

# (파일 id, 이모지, 영문 태그)
LIST = {
    'go': [
        ('star', '★', 'five pointed star, gold star'), ('coin', '🪙', 'gold coin, round coin with square hole'),
        ('swords', '⚔', 'two crossed swords'), ('book', '📖', 'open book, pages'), ('sparkle', '✨', 'three sparkles, glitter stars'),
        ('robot', '🤖', 'small robot head, antenna, boxy'), ('herb', '🌿', 'green herb sprig, leaves'), ('scroll', '📜', 'rolled scroll, paper'),
        ('compass', '🧭', 'compass rose, round compass'), ('rope', '🪢', 'rope knot, coiled rope'), ('flame', '🔥', 'flame, campfire fire'),
        ('horse', '🐎', 'horse head, side view'), ('rock', '🪨', 'gray boulder, rock'), ('pawprint', '🐾', 'animal paw prints, two paws'),
        ('whirl', '🌀', 'whirlpool spiral, swirl'), ('meat', '🍖', 'roasted meat on bone'), ('crystal', '🔮', 'crystal ball, glass sphere'),
        ('castle', '🏯', 'small castle with towers'), ('gem_blue', '🔷', 'blue diamond gem'), ('shield', '🛡', 'round shield, metal rim'),
        ('lantern', '🏮', 'paper lantern, red lantern'), ('snow', '❄', 'snowflake crystal'), ('dagger', '🗡', 'dagger, short blade'),
        ('fish', '🐟', 'fish, side view'), ('bow', '🏹', 'bow and arrow'), ('clipboard', '📋', 'clipboard with paper list'),
        ('gear', '⚙', 'cog gear wheel'), ('speech', '💬', 'speech bubble, empty'), ('drop', '💧', 'water drop'),
        ('wind', '💨', 'wind swirl, gust lines'), ('tower', '🗼', 'tall lookout tower'), ('wave', '🌊', 'ocean wave'),
        ('handshake', '🤝', 'two hands shaking'), ('bolt', '⚡', 'lightning bolt'), ('person', '👤', 'person silhouette bust, plain head and shoulders'),
        ('backpack', '🎒', 'travel backpack'), ('moon', '🌙', 'crescent moon'), ('blossom', '🌸', 'cherry blossom flower'),
        ('map', '🗺', 'folded paper map'), ('flag_black', '🏴', 'black flag on pole'), ('cloud', '☁', 'fluffy cloud'),
        ('fishing', '🎣', 'fishing rod with hook'), ('dish', '📡', 'satellite dish antenna'), ('lock', '🔒', 'padlock'),
        ('warning', '⚠', 'warning triangle sign'), ('vase', '🏺', 'clay vase, ancient jar'), ('wheat', '🌾', 'wheat ears, grain'),
        ('torii', '⛩', 'torii gate'), ('medal', '🎖', 'medal with ribbon'), ('fish_trop', '🐠', 'tropical fish, striped'),
        ('target', '🎯', 'archery target, bullseye'), ('bell', '🔔', 'bronze bell'), ('mountain', '⛰', 'mountain peak'),
        ('dragon', '🐉', 'serpent dragon head'), ('snow_mtn', '🏔', 'snow capped mountain'), ('sailboat', '⛵', 'small sailboat'),
        ('statue', '🗿', 'stone head statue'), ('flag_white', '🏳', 'white flag on pole'), ('letter', '✉', 'sealed envelope letter'),
        ('ufo', '🛸', 'flying saucer'),
    ],
}


def build(game, trial):
    items = []
    n_var = 2 if trial else 3
    lst = LIST[game][:6] if trial else LIST[game]
    for fid, emo, tags in lst:
        seed = int(hashlib.md5(('k202i_' + game + '_' + fid).encode()).hexdigest()[:8], 16)
        items.append({'id': 'ic_%s_%s' % (game, fid), 'seed': seed, 'prompt': '%s, %s, %s' % (tags, STYLE[game], TAIL), 'negative': NEG,
                      'subject_ko': '%s 아이콘(%s)' % (game, emo)})
    batch = {'model': 'animagine-xl-4.0-opt', 'out': 'k202_icons_%s%s' % (game, '_trial' if trial else ''),
             'defaults': {'prompt_prefix': 'masterpiece, high score, great score, absurdres', 'width': 768, 'height': 768, 'steps': 28, 'cfg': 5.5,
                          'sampler': 'Euler a', 'negative': NEG, 'variants': n_var},
             'items': items}
    out = os.path.join(HERE, 'batches', batch['out'] + '.json')
    json.dump(batch, open(out, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print(len(items), '→', out)


if __name__ == '__main__':
    build(sys.argv[1] if len(sys.argv) > 1 else 'go', 'trial' in sys.argv)
