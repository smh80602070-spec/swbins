"""K-0056 단계 3 / K-0054 — 웹 2D 움직이는 것(사람 8·짐승 6)을 AI 로 만드는 배치. 방식 A: 정면·옆·뒤 정지 그림 3장(웹 코드가 걸음·숨쉬기를 만든다). 그림체 B.
  py tools/ai-art/make_moving2d_batch.py [--only id,id]  → batches/moving2d.json (out moving2d), 항목 id = <캐릭터>_<front|side|back>
사람·짐승: txt2img, 같은 씨앗·같은 설명에 시점 낱말만 바꾼다(물고기는 옆 한 장). 사람을 3D 몸 풀 프레임(128px) 밑그림으로 img2img 하면 망토가 흩어지고 몸이 지워져 쓰지 않는다(USE_INIT=False, 10-03 시험). 프롬프트에 원작·작가·실존 이름 금지(gen.py BLOCK).
"""
import hashlib
import json
import os
import sys

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
STYLE = 'game sprite, soft painterly shading, thin dark outline, rich colors, detailed texture, simple background, white background, centered, single character, full body'
NEG_P = ('lowres, bad anatomy, bad hands, extra limbs, text, error, signature, watermark, username, blurry, cropped, worst quality, low quality, '
         'ground shadow, gradient background, background scenery, multiple views, border, frame, multiple people, grass, flowers, petals, leaves, debris, particles, ground, puddle, floating objects, color change')
NEG_B = ('lowres, bad anatomy, extra limbs, text, error, signature, watermark, username, blurry, cropped, worst quality, low quality, ground shadow, '
         'gradient background, background scenery, multiple views, border, frame, human, person, people, multiple animals, blue fur, muscular human-like body, standing upright, grass, flowers, debris, ground, puddle, color change')
VIEWS = {'front': ('front view, facing the viewer', 0), 'side': ('side view, facing right, profile', 1), 'back': ('back view, seen from behind', 2)}
PEOPLE = {   # id: (몸 풀 — 3D 밑그림을 쓸 때만, 설명). 10-03 시험: 128px 풀 프레임 밑그림은 망토가 흩어지고 몸이 지워져 실패 → 사람도 짐승처럼 txt2img(같은 씨앗·시점 낱말만 변경)
    # 2차(10-03): 방향마다 색이 달라져서(망토 베이지·올리브·초록) 옷·머리 색을 전부 명시한다
    'hero_m': ('pool_basem_human_107', '1boy, young adventurer hero, short brown hair, beige hooded cloak, brown leather vest, gray trousers, brown boots, solo'),
    'hero_f': ('pool_basef_human_115', '1girl, young adventurer heroine, long black hair in a high ponytail, white hooded cloak, dark vest, red trousers, black boots, solo'),
    'villager_a': ('pool_basem_elder_105', '1boy, old village man, white hair, white beard, beige long robe, wooden walking stick, no backpack, solo'),
    'villager_b': ('pool_f_teen_138', '1boy, village teenager, short black hair, brown short-sleeve shirt, blue trousers, brown shoes, solo'),
    'villager_c': ('pool_basef_child_116', '1girl, small village child, short brown bob hair, straw hat, cream dress with red trim, brown shoes, solo'),
    'companion_warrior': ('pool_d_human_123', '1boy, armored warrior, full blue steel plate armor with helmet, large blue shield, red cloth tabard, sword at the belt, solo'),
    'companion_archer': ('pool_f_human_139', '1girl, archer, dark green hooded cloak, brown leather outfit, longbow, quiver of arrows on the back, solo'),
    'companion_mage': ('pool_e_human_131', '1girl, mage, blue pointed wizard hat, long blue robe with gold trim, wooden staff, solo'),
}
USE_INIT = False
# 3차(10-03 화면 점검): 얼굴이 검게 비거나(후드·모자)·배경 얼룩·활이 몸을 가로지름·곰 뒷모습이 앞을 봄·토끼 발밑 선반 → 해당 캐릭터만 씨앗을 바꾸고 낱말을 더한다
SALT = {'hero_m': 'mv5:', 'villager_a': 'mv3:', 'companion_archer': 'mv5:', 'companion_mage': 'mv3:', 'beast_big_back': 'mv5:', 'beast_small': 'mv3:'}
EXTRA = {'hero_m': ', hood down, face visible, brown hair, anime face, cloak hanging straight down close to the body, no wind, full body from head to toe, wide shot, character occupies 60 percent of the image, empty space around', 'villager_a': ', plain background', 'companion_archer': ', holding a small shortbow in one hand, bow smaller than the body, face visible, simple standing pose, colored clothes, full body from head to toe, wide shot, character occupies 60 percent of the image, empty space around',
         'companion_mage': ', face visible under the hat, anime face', 'beast_big_back': ', rear view from directly behind, head facing away, tail visible, no face visible, walking away, full body from head to toe, wide shot, character occupies 60 percent of the image, empty space around'}
EXTRA_NEG = {'hero_m': ', faceless, hidden face, black face, shadowed face, billowing cloak, wind, flowing cape, cropped, close-up, zoomed, out of frame', 'villager_a': ', sunburst, rays, beige panel, background panel, wall, floor',
             'companion_archer': ', giant bow, long bow across the body, huge bow, arrows floating, flying arrows, orange swirl, magic effects, ring, circle, fire, black silhouette, silhouette, cropped, close-up', 'companion_mage': ', faceless, black face, hidden face, shadowed face',
             'beast_big_back': ', face, facing the viewer, close-up, cropped, zoomed', 'beast_small': ', wooden plank, floor, platform, shelf, table, stand'}
BEASTS = {   # id: (설명, 시점 목록)
    'beast_dog': ('friendly medium dog, short brown fur, floppy ears, four legs', ['front', 'side', 'back']),
    'beast_wolf': ('gray wolf, gray and white fur, bushy gray tail, standing on four legs, natural colors, alert', ['front', 'side', 'back']),
    'beast_bird': ('small songbird, blue and white feathers, perched', ['front', 'side', 'back']),
    'beast_small': ('small wild rabbit, white fur with gray patches, long ears, sitting', ['front', 'side', 'back']),
    'beast_fish': ('river fish, silver scales, orange fins, swimming', ['side']),
    'beast_big': ('large brown bear, brown fur, standing on all fours, four legs on the ground, natural bear anatomy', ['front', 'side', 'back']),
}


def init_png(pool, row, out):
    sh = Image.open(os.path.join(ROOT, 'saga-assets', 'sprites2d', pool, 'idle.webp')).convert('RGBA')
    fr = sh.crop((0, row * 128, 128, row * 128 + 128))
    bb = fr.getchannel('A').point(lambda v: 255 if v > 24 else 0).getbbox()
    fr = fr.crop(bb)
    k = 640 / fr.height
    fr = fr.resize((max(1, round(fr.width * k)), 640), Image.LANCZOS)
    cv = Image.new('RGB', (768, 768), (255, 255, 255))
    cv.paste(fr, ((768 - fr.width) // 2, 64), fr)
    cv.save(out)


def main():
    only = sys.argv[sys.argv.index('--only') + 1].split(',') if '--only' in sys.argv else None
    init_dir = os.path.join(HERE, '_out', 'moving2d_init')
    os.makedirs(init_dir, exist_ok=True)
    items = []
    for cid, (pool, desc) in PEOPLE.items():
        seed = int(hashlib.md5((SALT.get(cid, 'mv2:') + cid).encode()).hexdigest()[:8], 16)
        for v, (vt, row) in VIEWS.items():
            iid = f'{cid}_{v}'
            if only and iid not in only and cid not in only:
                continue
            it = {'id': iid, 'seed': seed, 'prompt': f'{desc}{EXTRA.get(cid, "")}, {vt}, standing, {STYLE}', 'negative': NEG_P + EXTRA_NEG.get(cid, '')}
            if USE_INIT:
                ip = os.path.join(init_dir, iid + '.png')
                init_png(pool, row, ip)
                it.update({'init_image': ip, 'denoise': 0.68, 'meta': {'mode': 'img2img', 'init_image': f'{pool}/idle.webp 프레임0 행{row} (3D 몸 렌더)', 'denoise': 0.68, 'init_license': 'CC0 VRoid 몸 + 절차 생성 장비(자체)'}})
            items.append(it)
    for cid, (desc, views) in BEASTS.items():
        for v in views:
            iid = f'{cid}_{v}'
            seed = int(hashlib.md5((SALT.get(iid, SALT.get(cid, 'mv2:')) + cid).encode()).hexdigest()[:8], 16)
            if only and iid not in only and cid not in only:
                continue
            items.append({'id': iid, 'seed': seed, 'prompt': f'{desc}{EXTRA.get(iid, EXTRA.get(cid, ""))}, {VIEWS[v][0]}, no humans, {STYLE.replace("single character", "single animal")}', 'negative': NEG_B + EXTRA_NEG.get(iid, EXTRA_NEG.get(cid, ''))})
    batch = {'model': 'animagine-xl-4.0-opt', 'out': 'moving2d',
             'defaults': {'prompt_prefix': 'masterpiece, high score, great score, absurdres', 'width': 768, 'height': 768, 'steps': 28, 'cfg': 5.5, 'sampler': 'Euler a', 'negative': NEG_P},
             'items': items}
    out = os.path.join(HERE, 'batches', 'moving2d.json')
    json.dump(batch, open(out, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print(len(items), '→', out)


if __name__ == '__main__':
    main()
