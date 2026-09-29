"""도감 인물 105 → 초상 배치(JSON). 공방 레시피(지역·역할·성별·나이·머리색·눈 색)에서 프롬프트를 짠다.

  py tools/ai-art/make_hero_batch.py            # tools/ai-art/batches/web_heroes_105.json 을 쓴다

이름 정책: **인물 이름·실명은 프롬프트에 안 쓴다** — 문화·역할·외모 묘사만(id 접두 지역 + 역할 + 문화 표). gen.py 의 BLOCK 검사도 통과해야 한다.
씨앗 = id 해시(같은 인물은 언제나 같은 그림 — 재생성 가능).
"""
import glob
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
FORGE = os.path.join(HERE, '..', 'char-forge')
sys.path.insert(0, FORGE)
import gen_hero_recipes as G  # noqa: E402

# 문화 옷차림 — id(접두 제외) 세부가 필요한 세계 인물은 개별, 나머지는 지역 기본
CULTURE = {
    'kr': 'ancient korean inspired clothing, hanbok-inspired layered robe',
    'jp': 'ancient japanese inspired clothing, kimono and hakama',
    'sg': 'ancient chinese inspired clothing, hanfu-style robe with wide sleeves',
    'eu': 'medieval european inspired clothing, tunic and cloak',
}
WORLD = {
    'akbar': 'mughal court clothing, jeweled turban, long embroidered coat',
    'ashoka': 'ancient indian royal clothing, gold jewelry, saffron cloth',
    'attila': 'steppe nomad warrior, fur-trimmed leather coat, braided hair',
    'cleopatra': 'ancient egyptian queen, gold collar necklace, kohl eye makeup, headdress',
    'genghis': 'steppe khan, fur hat, layered silk deel robe',
    'hammurabi': 'ancient mesopotamian king, tiered fringed robe, curled beard',
    'ibnbattuta': 'arab traveler scholar, turban, long striped robe, satchel',
    'ibnsina': 'persian scholar physician, turban, dark robe, thoughtful',
    'khubilai': 'steppe emperor, ornate fur-trimmed silk robe, tall hat',
    'mansamusa': 'west african king, gold crown, gold embroidered robe, jewelry',
    'moctezuma': 'mesoamerican ruler, tall feather headdress, jade jewelry',
    'pachacuti': 'andean emperor, woven patterned tunic, gold ear ornaments',
    'saladin': 'arab sultan, white turban, chainmail under robe',
    'shaka': 'african warrior chief, feather headband, cowhide shield strap, leopard fur cloak',
    'suleiman': 'ottoman sultan, huge white turban, ornate fur robe',
}
ROLE_TXT = {
    'general': 'stern armored commander, commanding presence',
    'warrior': 'fierce warrior, confident grin, battle worn armor',
    'warrior_f': 'fierce female warrior, determined eyes, light armor',
    'samurai': 'proud samurai armor with ornate helmet, face fully visible',
    'ronin': 'wandering swordsman, calm eyes, worn clothes',
    'ninja': 'shadowy scout in a dark hood, sharp eyes, face fully visible',
    'hoplite': 'ancient shield bearer, plumed bronze helmet, face fully visible',
    'tribal': 'tribal warrior, face paint, feathers',
    'nomad': 'nomad rider, wind blown hair, fur collar',
    'khan': 'ruthless steppe ruler, fur collar',
    'officer': 'disciplined officer, neat uniform, sharp gaze',
    'king': 'crowned ruler, regal, wise expression',
    'sultan': 'regal ruler, jeweled turban, calm authority',
    'roman': 'ancient roman statesman, laurel wreath, toga',
    'strategist': 'cunning strategist holding a feather fan, knowing smile',
    'scholar': 'thoughtful scholar, holding a scroll',
    'healer': 'gentle healer, herb pouch, kind eyes',
    'monk': 'serene monk, prayer beads, shaved head',
    'artist': 'creative artist, paint stained fingers, curious eyes',
    'traveler': 'adventurous traveler, travel cloak, bright eyes',
    'modern': 'modern person, casual stylish clothes',
    'lady': 'elegant noble lady, hairpins, poised',
    'court': 'graceful court lady, refined makeup, layered robes',
    'queen': 'majestic queen, crown, jewels',
    'dancer': 'graceful dancer, flowing ribbons, cheerful',
    'student': 'earnest young student, neat clothes, bright smile',
}
EYE = {'brown': 'brown eyes', 'brownlight': 'light brown eyes', 'green': 'green eyes', 'bluegreen': 'teal eyes',
       'blue': 'blue eyes', 'grey': 'grey eyes', 'deepblue': 'deep blue eyes'}
# 머리색 이름 — 헥스와 가장 가까운 것
HAIRS = {'black hair': (0x1a, 0x15, 0x12), 'dark brown hair': (0x3a, 0x2a, 0x1e), 'brown hair': (0x6a, 0x44, 0x28), 'auburn hair': (0x7a, 0x3a, 0x22),
         'blonde hair': (0xb8, 0x98, 0x68), 'grey hair': (0x9a, 0x96, 0x8e), 'white hair': (0xb8, 0xb4, 0xac)}


def hair_name(hexcol, female, reg):
    if not hexcol:
        return 'black hair' if reg in ('kr', 'jp', 'sg') else 'brown hair'
    h = hexcol.lstrip('=#')
    c = tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))
    return min(HAIRS, key=lambda k: sum((a - b) ** 2 for a, b in zip(c, HAIRS[k])))


def age_txt(age, female):
    if age < 0.48:
        return 'young adult'
    if age < 0.6:
        return 'adult'
    if age < 0.72:
        return 'mature adult'
    return 'elderly, wrinkles, ' + ('gray hair' if female else 'gray beard')


def fnv(s):
    h = 2166136261
    for c in s.encode():
        h = ((h ^ c) * 16777619) & 0xFFFFFFFF
    return h


def main():
    items = []
    for f in sorted(glob.glob(os.path.join(FORGE, 'recipes', 'hero', '*.json'))):
        r = json.load(open(f, encoding='utf-8'))
        hid = r['id'][len('hero_'):]
        reg, key = hid[:2], hid[3:]
        role = G.ROLE.get(hid, 'traveler')
        female = r['macro']['gender'] < 0.5
        culture = WORLD.get(key, 'world traveler clothing') if reg == 'wd' else CULTURE[reg]
        if role == 'roman':
            culture = 'ancient roman clothing, toga and laurel'
        hair = hair_name(r.get('tints', {}).get('hair'), female, reg)
        who = '1girl, female focus, feminine' if female else '1boy, male focus, masculine, strong jaw'
        prompt = ', '.join([who, 'solo', 'upper body portrait', age_txt(r['macro']['age'], female), hair, EYE.get(r.get('eye_color', 'brown'), 'brown eyes'),
                            culture, ROLE_TXT.get(role, 'confident'), 'looking at viewer', 'soft dramatic lighting', 'simple painterly gradient background'])
        neg = 'lowres, bad anatomy, bad hands, text, error, missing finger, extra digits, fewer digits, cropped, worst quality, low quality, low score, bad score, average score, signature, watermark, username, blurry, mask, mouth mask, menpo, face covered, fangs, mouth guard, ' + \
            ('1boy, male focus, beard' if female else '1girl, feminine, breasts, makeup')
        items.append({'id': 'hero_' + hid, 'seed': fnv(hid), 'prompt': prompt, 'negative': neg})
    b = {'model': 'animagine-xl-4.0-opt', 'out': 'web_heroes_105',
         'defaults': {'prompt_prefix': 'masterpiece, high score, great score, absurdres', 'width': 768, 'height': 1024, 'steps': 28, 'cfg': 5.0, 'sampler': 'Euler a',
                      'negative': ''},
         'items': items}
    out = os.path.join(HERE, 'batches', 'web_heroes_105.json')
    json.dump(b, open(out, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print(len(items), '->', out)
    for i in items[:3] + items[-2:]:
        print(i['id'], '|', i['prompt'][:230])


if __name__ == '__main__':
    main()
