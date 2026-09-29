"""동물 도감(펫 105) 초상 배치(JSON). 이름은 프롬프트에 쓰지 않고 종·생김새 묘사만 쓴다, 씨앗 = id 해시.

  py tools/ai-art/make_pet_batch.py    # batches/web_pets_105.json
데이터는 saga-web/saga-go/js/data.js 를 노드로 실행해 읽는다(도감은 다섯 판 공통 복사본이라 한 곳이면 된다).
그림은 768x896(카드 300x344 와 같은 비율) — pack_web_pet_portraits.py 가 카드는 통째로, 정사각은 가운데를 잘라 굽는다.
"""
import json
import os
import subprocess

HERE = os.path.dirname(os.path.abspath(__file__))
WEB = os.path.join(HERE, '..', '..', 'saga-web')
PREFIX = 'masterpiece, high score, great score, absurdres'
NEG = ('lowres, bad anatomy, bad hands, text, error, cropped, worst quality, low quality, low score, bad score, average score, signature, watermark, '
       'username, blurry, human, 1girl, 1boy, multiple views, cut off, out of frame')
STYLE = 'no humans, animal focus, solo, full body, centered, looking at viewer, soft dramatic lighting, simple painterly gradient background, fantasy illustration'
SIDE = 'no humans, animal focus, solo, full body, side view, centered, soft dramatic lighting, underwater, simple painterly blue gradient background, fantasy illustration'


def fnv(s):
    h = 2166136261
    for c in s.encode():
        h = ((h ^ c) * 16777619) & 0xFFFFFFFF
    return h


# id(접두 pt_ 뺀 것) → (모양 묘사, 'fish' 이면 옆모습·물속 배경)
D = {
    # 신수
    'samjogo': 'a majestic black crow with three legs and a glowing golden sun disc behind it, spread wings',
    'haetae': 'a mythical stone guardian lion-like beast with a single horn, scaled armored body, flame mane, ornate',
    'cheongryong': 'an eastern azure dragon with a long serpentine body, antlers, flowing whiskers, blue scales, among clouds',
    'baekho': 'a white tiger with dark stripes, majestic, glowing pale blue eyes, snowy mist',
    'jujak': 'a vermilion phoenix bird with long fiery tail feathers, wings of flame',
    'hyeonmu': 'a giant black tortoise with a large domed shell carrying a snake coiled around it, ancient shell with glowing patterns, turtle body and legs clearly visible',
    'gumiho': 'a nine tailed fox with white and gold fur, elegant, glowing blue fox fire',
    'dokkaebi': 'a friendly mischievous horned goblin creature holding a magic club, tiger skin loincloth, one horn, no human face',
    'bulgasari': 'a mythical iron eating beast with a bear body, rhino nose, elephant trunk, tiger paws, metallic armored skin',
    'jeoktoma': 'a legendary crimson red horse with a flowing flame mane, powerful and swift',
    'jeolyeong': 'a swift pale silver horse galloping, wind lines, noble',
    # 동물
    'jindo': 'a golden fawn jindo dog, loyal expression, fluffy',
    'sapsal': 'a shaggy long haired sapsal dog with fur covering its eyes, fluffy grey and white',
    'tiger': 'a large siberian tiger in a snowy mountain, majestic',
    'bear': 'an asiatic black bear with a white crescent mark on its chest',
    'magpie': 'a magpie bird with black white and blue iridescent feathers',
    'crane': 'a red crowned crane with white feathers and black tail, elegant pose',
    'toad': 'a plump warty toad, golden eyes, sitting on a lotus leaf',
    'carp': 'a golden carp jumping up a waterfall',
    'panda': 'a giant panda sitting and eating bamboo',
    'monkey': 'a clever macaque monkey with an alert expression',
    'deer': 'a sika deer with white spots and small antlers, forest',
    'boar': 'a wild boar with tusks and bristly fur, charging',
    'owl': 'a large eagle owl with big amber eyes, moonlit night',
    'cat': 'a calico cat sitting elegantly',
    'fox': 'a red fox with a bushy tail, alert',
    'dolphin@f': 'a bottlenose dolphin leaping through sea water',
    'shark@f': 'a great white shark',
    'whale@f': 'a huge blue whale with a small calf',
    'manta_ray@f': 'a giant manta ray gliding with wide wings',
    'fish_1@f': 'a colorful tropical reef fish',
    'fish_2@f': 'a silvery striped sea fish',
    'fish_3@f': 'a small shimmering blue freshwater fish',
    'stag': 'a majestic red deer stag with huge branching antlers',
    'white_horse': 'a graceful white horse with a long mane',
    'horse': 'a chestnut brown horse standing proudly',
    'llama': 'a fluffy cream llama with a curious face',
    'pig': 'a plump pink pig, cheerful',
    'pug': 'a small pug dog with a wrinkled face, cute',
    'sheep': 'a fluffy white sheep with curly wool',
    'horse_farm': 'a sturdy farm draft horse with feathered hooves',
    'cow_farm': 'a black and white dairy cow, gentle eyes',
    'zebra': 'a zebra with bold black and white stripes on savanna',
    'cow': 'a brown highland cow with long horns and shaggy fur',
    'donkey': 'a grey donkey with big ears, gentle',
    'alpaca': 'a fluffy alpaca with a shaggy fringe, cute',
    'bull': 'a powerful bull with large horns, snorting',
    'anglerfish@f': 'a deep sea anglerfish with a glowing lure, sharp teeth, dark abyss',
    'apatosaurus': 'a giant long necked sauropod dinosaur in a prehistoric swamp',
    'armored_catfish@f': 'an armored plated catfish with bony scutes on river bed',
    'betta@f': 'a betta fish with long flowing fins, red and blue',
    'black_lion_fish@f': 'a black lionfish with long venomous spines',
    'blobfish@f': 'a pink blobfish, droopy face, deep sea',
    'blue_goldfish@f': 'a blue fancy goldfish with a flowing tail',
    'blue_tang@f': 'a bright blue tang reef fish with a black pattern',
    'butterfly_fish@f': 'a yellow and white butterflyfish with a black eye stripe',
    'cardinal_fish@f': 'a small silver cardinalfish with dark stripes',
    'clownfish@f': 'an orange clownfish with white stripes in a sea anemone',
    'coral_grouper@f': 'a spotted coral grouper among coral',
    'cowfish@f': 'a boxy yellow cowfish with tiny horns and white spots',
    'flatfish@f': 'a flat brown flounder lying on the sand',
    'flower_horn@f': 'a flowerhorn cichlid fish with a big forehead hump, colorful',
    'goblin_shark@f': 'a pink goblin shark with a long snout, deep sea',
    'goldfish@f': 'a round orange goldfish with flowing fins',
    'humphead@f': 'a huge humphead wrasse with a bulging forehead, teal-blue',
    'koi_2@f': 'a red and white koi carp in a pond',
    'lionfish@f': 'a red striped lionfish with fan-like fins',
    'mandarin_fish@f': 'a psychedelic mandarin dragonet fish with swirling blue orange patterns',
    'moorish_idol@f': 'a moorish idol with a tall dorsal fin, black white yellow bands',
    'parasaurolophus': 'a parasaurolophus dinosaur with a long curved head crest, prehistoric forest',
    'parrot_fish@f': 'a colorful parrotfish with a beak-like mouth, teal and pink',
    'piranha@f': 'a piranha with sharp teeth, silver and red belly',
    'puffer@f': 'a round pufferfish, puffed up, spotted',
    'red_snapper@f': 'a red snapper fish, shiny scales',
    'royal_gramma@f': 'a royal gramma fish, purple front and yellow back',
    'shark_2@f': 'a hammerhead shark',
    'stegosaurus': 'a stegosaurus with plates on its back and a spiked tail, prehistoric',
    'sunfish@f': 'a giant ocean sunfish, round flat body',
    'swordfish@f': 'a swordfish with a long bill, leaping through waves',
    't_rex': 'a tyrannosaurus rex roaring, prehistoric',
    'tang@f': 'a blue and yellow surgeonfish',
    'tetra@f': 'a neon tetra school with glowing blue stripe',
    'triceratops': 'a triceratops with three horns and a bony frill, prehistoric',
    'tuna@f': 'a large bluefin tuna, sleek and metallic',
    'turbot@f': 'a camouflaged turbot flatfish on the seabed',
    'velociraptor': 'a feathered velociraptor with sharp claws, prehistoric',
    'worm': 'a cute pink earthworm coming out of soil, small flowers, garden',
    'yellow_tang@f': 'a bright yellow tang reef fish',
    'zebra_clown_fish@f': 'an orange clownfish with three white stripes',
    # 창작 짐승 — 이름·원작 대신 모양만
    'pk_bulbasaur': 'a small quadruped creature with a giant green conical sedge hat on its back like a mushroom cap, leaf-like ears, gentle eyes, forest after rain',
    'pk_charmander': 'a small lizard-like creature with one horn on its forehead, orange scales, a flame at the tail tip, rocky ground',
    'pk_squirtle': 'a small blue octopus-squid creature with long tentacle arms, standing on rocks on the coast, cute',
    'pk_magikarp': 'a small round blue bag-shaped creature with tiny wings, floating gently, night dew drops',
    'pk_pikachu': 'a white moon rabbit holding a wooden mallet for pounding rice cake, long ears, moonlight',
    'pk_eevee': 'a relaxed brown monkey with moss growing on its back, sleepy smile, forest',
    'pk_slowbro': 'a soft round jelly-like translucent blob creature, pale purple, bouncy, wrapping around a small stone',
    'pk_gengar': 'a shadowy dark purple ghost creature with two horns holding a paper lantern, mischievous grin, night path',
    'pk_snorlax': 'a huge round white furry snow creature sitting on a mountain ridge, big cheerful laugh, blizzard',
    'pk_lapras': 'two soft floating bag-shaped creatures fused into one body, wings, drifting over distant mountains',
    'pk_alakazam': 'a small wise fox-like creature wearing a tall pointed hood, reciting stars, holding a star chart, night sky',
    'pk_dragonite': 'a plump yellow dragon-chick creature wearing a rough hood, flying low over fields, small wings',
    'pk_charizard': 'a fiery orange dragon with big wings glowing like embers in the sunset, scales shining like fire',
    'pk_gyarados': 'a huge blue serpent water dragon-like creature without legs, whiskers, rising from a deep river pool, waiting to become a dragon',
    'pk_mewtwo': 'a mysterious tall pale lavender creature with a long tail looking up at a meteor shower, cosmic aura, no clothes',
    'pk_mew': 'a lucky white cat with a raised paw sitting at a gate doorway, gold coin charm, gentle smile',
}


def main():
    raw = subprocess.check_output(['node', '-e', (
        "global.window=global;var fs=require('fs');"
        "(new Function('window','self','globalThis',fs.readFileSync(process.argv[1],'utf8')))(global,global,global);"
        "console.log(JSON.stringify(global.DG.data.pets.map(function(p){return {id:p.id,kind:p.kind,rarity:p.rarity}})))"),
        os.path.join(WEB, 'saga-go', 'js', 'data.js')])
    pets = json.loads(raw)
    dd = {k.split('@')[0]: (v, k.endswith('@f')) for k, v in D.items()}
    items, miss = [], []
    for p in pets:
        key = p['id'][3:] if p['id'].startswith('pt_') else p['id']
        if key not in dd:
            miss.append(p['id'])
            continue
        desc, fish = dd[key]
        extra = ''
        if p['kind'] == 'divine':
            extra = ', divine aura, glowing, mythical, majestic'
        elif p['rarity'] >= 4:
            extra = ', rare, sparkling aura'
        items.append({'id': p['id'], 'seed': fnv(p['id']),
                      'prompt': '%s, %s%s' % ((SIDE if fish else STYLE), desc, extra), 'negative': NEG})
    if miss:
        raise SystemExit('묘사 없는 펫: ' + ', '.join(miss))
    batch = {'model': 'animagine-xl-4.0-opt', 'out': 'web_pets_105',
             'defaults': {'prompt_prefix': PREFIX, 'width': 768, 'height': 896, 'steps': 28, 'cfg': 5.0, 'sampler': 'Euler a', 'negative': ''},
             'items': items}
    out = os.path.join(HERE, 'batches', 'web_pets_105.json')
    json.dump(batch, open(out, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print('wrote', out, len(items))


if __name__ == '__main__':
    main()
