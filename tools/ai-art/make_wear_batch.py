"""사가의숲 옷·머리 11개 후보 뽑기(K-0035 재뽑기) — 키마다 3장(_a·_b·_c), 눈으로 골라 icons_all/<키>.png 로 바꾼다.
  py tools/ai-art/make_wear_batch.py  → batches/icons_wear11.json (out icons_wear11)
"""
import hashlib
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
TEMPLATE = '{tags}, no humans, still life, object focus, game icon, simple background, white background, centered, single object, hand-painted'
NEG = ('1girl, 1boy, solo, human, lowres, bad anatomy, text, error, signature, watermark, username, blurry, frame, border, multiple objects, hands, person, character, '
       'ground shadow, gradient background, background scenery, cropped, worst quality, low quality, box, gift box, case, package, picture frame, cube, book, medal, badge, coin')
TAGS = {
    'wear_leather': 'tunic, brown leather jerkin, laced front, short sleeves, clothing laid flat, torso garment',
    'wear_robe': 'hanbok, long white robe, blue collar, wide sleeves, clothing laid flat, garment',
    'wear_coat': 'long overcoat, hanbok durumagi, teal coat, ribbon ties, wide sleeves, clothing laid flat',
    'wear_plate': 'armor, steel breastplate, shoulder pauldrons, torso armor, chest plate, no head',
    'wear_spacesuit': 'spacesuit, astronaut suit, white jumpsuit, orange accents, sci-fi clothing laid flat',
    'wear_topknot': 'hairpin, binyeo, gold hairpin, long ornamental hair stick, hair ornament',
    'wear_braid': 'hair ribbon, red ribbon, daenggi, long ribbon tied in a bow, hair accessory',
    'wear_scholar': 'black hat, scholar hat, square cloth cap, headwear, ribbon strings',
    'wear_gat': 'gat, black horsehair hat, wide brim, tall crown, tied chin cord, headwear',
    'wear_hairpin': 'bridal crown, jeweled coronet, headdress, beads and tassels, headwear',
    'wear_helmet': 'felt war hat, military hat, red plume, officer hat, headwear',
}
items = []
for k, tags in TAGS.items():
    for s in 'abc':
        iid = '%s_%s' % (k, s)
        items.append({'id': iid, 'seed': int(hashlib.md5(iid.encode()).hexdigest()[:8], 16), 'prompt': TEMPLATE.format(tags=tags), 'negative': NEG})
batch = {'model': 'animagine-xl-4.0-opt', 'out': 'icons_wear11',
         'defaults': {'prompt_prefix': 'masterpiece, high score, great score, absurdres', 'width': 768, 'height': 768, 'steps': 28, 'cfg': 5.5, 'sampler': 'Euler a', 'negative': NEG},
         'items': items}
out = os.path.join(HERE, 'batches', 'icons_wear11.json')
json.dump(batch, open(out, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(len(items), '→', out)
