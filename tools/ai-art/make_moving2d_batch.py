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
         'ground shadow, gradient background, background scenery, multiple views, border, frame, multiple people')
NEG_B = ('lowres, bad anatomy, extra limbs, text, error, signature, watermark, username, blurry, cropped, worst quality, low quality, ground shadow, '
         'gradient background, background scenery, multiple views, border, frame, human, person, people, multiple animals')
VIEWS = {'front': ('front view, facing the viewer', 0), 'side': ('side view, facing right, profile', 1), 'back': ('back view, seen from behind', 2)}
PEOPLE = {   # id: (몸 풀 — 3D 밑그림을 쓸 때만, 설명). 10-03 시험: 128px 풀 프레임 밑그림은 망토가 흩어지고 몸이 지워져 실패 → 사람도 짐승처럼 txt2img(같은 씨앗·시점 낱말만 변경)
    'hero_m': ('pool_basem_human_107', '1boy, young adventurer hero, short brown hair, simple traveler cloak, leather vest, boots, solo'),
    'hero_f': ('pool_basef_human_115', '1girl, young adventurer heroine, ponytail hair, simple traveler cloak, leather vest, boots, solo'),
    'villager_a': ('pool_basem_elder_105', '1boy, old village man, white beard, plain robe, walking stick, solo'),
    'villager_b': ('pool_f_teen_138', '1boy, village teenager, short hair, plain tunic and trousers, solo'),
    'villager_c': ('pool_basef_child_116', '1girl, small village child, simple dress, cheerful, solo'),
    'companion_warrior': ('pool_d_human_123', '1boy, armored warrior, steel armor, shield, sword at the belt, solo'),
    'companion_archer': ('pool_f_human_139', '1girl, archer, green hood and cloak, bow and quiver on the back, solo'),
    'companion_mage': ('pool_e_human_131', '1girl, mage, long blue robe, pointed hat, wooden staff, solo'),
}
USE_INIT = False
BEASTS = {   # id: (설명, 시점 목록)
    'beast_dog': ('friendly medium dog, short brown fur, floppy ears, four legs', ['front', 'side', 'back']),
    'beast_wolf': ('gray wolf, thick fur, bushy tail, four legs, alert', ['front', 'side', 'back']),
    'beast_bird': ('small songbird, blue and white feathers, perched', ['front', 'side', 'back']),
    'beast_small': ('small wild rabbit, white fur, long ears', ['front', 'side', 'back']),
    'beast_fish': ('river fish, silver scales, orange fins, swimming', ['side']),
    'beast_big': ('large brown bear, heavy body, four legs', ['front', 'side', 'back']),
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
        seed = int(hashlib.md5(('mv:' + cid).encode()).hexdigest()[:8], 16)
        for v, (vt, row) in VIEWS.items():
            iid = f'{cid}_{v}'
            if only and iid not in only and cid not in only:
                continue
            it = {'id': iid, 'seed': seed, 'prompt': f'{desc}, {vt}, standing, {STYLE}', 'negative': NEG_P}
            if USE_INIT:
                ip = os.path.join(init_dir, iid + '.png')
                init_png(pool, row, ip)
                it.update({'init_image': ip, 'denoise': 0.68, 'meta': {'mode': 'img2img', 'init_image': f'{pool}/idle.webp 프레임0 행{row} (3D 몸 렌더)', 'denoise': 0.68, 'init_license': 'CC0 VRoid 몸 + 절차 생성 장비(자체)'}})
            items.append(it)
    for cid, (desc, views) in BEASTS.items():
        seed = int(hashlib.md5(('mv:' + cid).encode()).hexdigest()[:8], 16)
        for v in views:
            iid = f'{cid}_{v}'
            if only and iid not in only and cid not in only:
                continue
            items.append({'id': iid, 'seed': seed, 'prompt': f'{desc}, {VIEWS[v][0]}, no humans, {STYLE.replace("single character", "single animal")}', 'negative': NEG_B})
    batch = {'model': 'animagine-xl-4.0-opt', 'out': 'moving2d',
             'defaults': {'prompt_prefix': 'masterpiece, high score, great score, absurdres', 'width': 768, 'height': 768, 'steps': 28, 'cfg': 5.5, 'sampler': 'Euler a', 'negative': NEG_P},
             'items': items}
    out = os.path.join(HERE, 'batches', 'moving2d.json')
    json.dump(batch, open(out, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print(len(items), '→', out)


if __name__ == '__main__':
    main()
