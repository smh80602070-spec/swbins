"""K-0195 웹 2D 정적 지물 여덟 — 3D 툰 렌더(tools/world-forge/_out/k195_sprite)를 흰 768 에 올려 img2img(그림체 C, K-0181 k181_static 과 같은 꼴).
  py tools/ai-art/k195_static.py          → batches/k195_static.json (out k195_static, 밑그림 _out/k195_static_init)
  (밭 작물 셋 wheat_* 는 saga-assets/world/toon 3D 를 같은 렌더로 — 3마을 밭 칸 2D)
  py tools/ai-art/gen.py batches/k195_static.json → py tools/ai-art/pack_static2d.py _out/k195_static _out/k195_static_pack
"""
import hashlib
import json
import os

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
SPR = os.path.join(ROOT, 'tools', 'world-forge', '_out', 'k195_sprite')
INIT = os.path.join(HERE, '_out', 'k195_static_init')
TAIL = ('from above, three-quarter view, no humans, game sprite, full body, single object, centered, simple background, plain pastel gray-green background, '
        'no cast shadow, soft rounded shapes, no hard outline, soft watercolor shading, gentle gradients, warm pastel palette, cream highlights, warm afternoon light')
NEG = ('text, signature, watermark, cropped, blurry, lowres, worst quality, low quality, ground shadow, multiple objects, frame, border, bad anatomy, '
       'harsh outline, dark palette, gritty, photorealistic, neon')
SUBJ = {
    'puzzle_stone_01': '(flat mossy field stone:1.15), lichen and moss on top, tufts of grass around the base',
    'puzzle_stone_01_open': '(flat mossy stone rolled aside:1.15), small dug hole in the soil with three glowing golden seeds, tufts of grass',
    'flower_ring_01': '(small fairy ring of five blooming flowers:1.15), red yellow white blue orange flowers in a circle on a ring of grass',
    'flower_ring_01_wilt': '(small ring of five wilted flowers:1.15), drooping faded brown stems in a circle on a ring of grass',
    'pinwheel_01_full': '(toy pinwheel on a wooden stick:1.15), four folded vanes red yellow blue white, stick pushed into the ground',
    'chest_cursed_01': '(cursed dark wooden treasure chest:1.15), wrapped in iron chains, big padlock, faint purple glow leaking from the lid seam',
    'chest_bounty_01': '(dark wooden treasure chest with gold trim:1.15), gold corner caps, a wanted poster paper pinned on the front, gold lock',
    'grain_pile_01': '(heap of golden grain:1.15), two tied burlap sacks beside it',
    'wheat_sprout_01': '(small square farm plot with tiny green wheat sprouts in rows:1.15), dark tilled soil',
    'wheat_growing_01': '(small square farm plot of half-grown green wheat:1.15), leafy stalks in rows, tilled soil',
    'wheat_ripe_01': '(small square farm plot of ripe golden wheat:1.15), heavy wheat ears, tilled soil',
}


def main():
    os.makedirs(INIT, exist_ok=True)
    items = []
    for iid, subj in SUBJ.items():
        sp = Image.open(os.path.join(SPR, iid + '.png')).convert('RGBA')
        sp = sp.crop(sp.getchannel('A').point(lambda v: 255 if v > 24 else 0).getbbox())
        k = 600 / max(sp.size)
        sp = sp.resize((max(1, round(sp.width * k)), max(1, round(sp.height * k))), Image.LANCZOS)
        cv = Image.new('RGB', (768, 768), (255, 255, 255))
        cv.paste(sp, ((768 - sp.width) // 2, (768 - sp.height) // 2 + 20), sp)
        ip = os.path.join(INIT, iid + '.png')
        cv.save(ip)
        items.append({'id': iid, 'seed': int(hashlib.md5(('k195:' + iid).encode()).hexdigest()[:8], 16), 'prompt': f'{subj}, {TAIL}', 'negative': NEG,
                      'init_image': os.path.relpath(ip, ROOT).replace('\\', '/'), 'denoise': 0.6})
    batch = {'model': 'animagine-xl-4.0-opt', 'out': 'k195_static', 'kit': {'spec': 'sprite', 'style': 'C'},
             'defaults': {'prompt_prefix': 'masterpiece, high score, great score, absurdres', 'width': 768, 'height': 768, 'steps': 28, 'cfg': 5.5,
                          'sampler': 'Euler a', 'negative': NEG, 'variants': 4},
             'items': items}
    out = os.path.join(HERE, 'batches', 'k195_static.json')
    json.dump(batch, open(out, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print(len(items), '→', out)


if __name__ == '__main__':
    main()
