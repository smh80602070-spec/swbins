"""사가국지 장수 194 · 사가블로 미래·현대 인물 30 → 초상 배치(JSON). 이름은 프롬프트에 안 쓴다(세력 문화·자질·직업 묘사만), 씨앗 = id 해시.

  py tools/ai-art/make_extra_batches.py    # batches/web_realm_194.json · web_dungeon_30.json
사가국지 데이터는 saga-web/saga-realm/js/data.js + data-force.js 를 노드로 실행해 읽는다(브라우저 전역 IIFE).
"""
import json
import os
import subprocess

HERE = os.path.dirname(os.path.abspath(__file__))
WEB = os.path.join(HERE, '..', '..', 'saga-web')
PREFIX = 'masterpiece, high score, great score, absurdres'
NEG = ('lowres, bad anatomy, bad hands, text, error, missing finger, extra digits, fewer digits, cropped, worst quality, low quality, low score, bad score, '
       'average score, signature, watermark, username, blurry, mask, mouth mask, menpo, face covered, fangs, mouth guard')
FEMALE_CUES = '姬姫女妃后娘母嬪嬢媛妹姊娥'


def fnv(s):
    h = 2166136261
    for c in s.encode():
        h = ((h ^ c) * 16777619) & 0xFFFFFFFF
    return h


# 세력 접두 → (옷차림·분위기, 머리색 후보)
CULT = {
    'rf': ('ancient chinese three kingdoms era clothing, hanfu robe or lamellar armor', ['black hair', 'dark brown hair']),
    'kr2': ('ancient korean warrior clothing, layered robe and leather armor, topknot or braided hair', ['black hair', 'dark brown hair']),
    'jp': ('ancient japanese coastal warrior clothing, hemp robe and cord armor', ['black hair', 'dark brown hair']),
    'jiao': ('southern chinese and vietnamese style, light silk tunic, tropical colors, bronze drum motifs', ['black hair', 'dark brown hair']),
    'xiyu': ('central asian oasis city clothing, silk road turban and embroidered coat', ['black hair', 'brown hair']),
    'nz': ('southwestern tribal clothing, silver ornaments, feathers, colorful embroidery', ['black hair', 'dark brown hair']),
    'tz': ('ancient indian clothing, saffron cloth, gold jewelry, forehead mark', ['black hair', 'dark brown hair']),
    'mb': ('northern steppe nomad clothing, fur trim, leather armor, braided hair', ['black hair', 'dark brown hair']),
    'ly': ('ancient southeast asian kingdom clothing, gold ornaments, sarong style cloth', ['black hair', 'dark brown hair']),
    'fu': ('fantasy celestial rift warrior, glowing cracks of light on ornate armor, star motifs, otherworldly aura', ['silver hair', 'white hair', 'dark blue hair']),
    'ru': ('fantasy ruined kingdom knight, tattered cloak, moss covered rusted armor, haunted eyes, pale', ['grey hair', 'black hair', 'dark brown hair']),
    'tb': ('fantasy tomb guardian knight, bone white ceremonial armor, pale solemn face, faint blue glow', ['white hair', 'black hair']),
    'dj': ('ancient mediterranean island merchant sailor clothing, blue and white tunic, glass and amber beads', ['brown hair', 'dark brown hair', 'black hair']),
    'xb': ('xianbei steppe cavalry clothing, fur hat, felt coat, leather armor', ['black hair', 'dark brown hair']),
    'nh': ('southern sea trader clothing, pearls, lightweight silk, sun tanned', ['black hair', 'dark brown hair']),
    'sl': ('silk road caravan merchant clothing, layered scarves, embroidered vest, exotic jewelry', ['black hair', 'brown hair', 'dark brown hair']),
    'tm': ('modern person with subtle traveler details, jacket and scarf, city clothes, a hint of time travel', ['black hair', 'brown hair', 'dark brown hair']),
}
TRAIT = {
    'might': 'fierce muscular warrior, confident smirk',
    'wisdom': 'calm clever strategist, knowing smile',
    'command': 'disciplined commander, sharp gaze',
    'virtue': 'noble virtuous leader, gentle strong eyes',
    'charm': 'charismatic, warm smile',
}
EYES = ['dark brown eyes', 'brown eyes', 'amber eyes', 'black eyes', 'grey eyes', 'green eyes']

DUNGEON = {
    'ft_airesearch': 'ai researcher wearing holographic glasses, clean white futuristic jacket',
    'ft_astronaut': 'astronaut in a white space suit without helmet, mission patches',
    'ft_bioeng': 'bioengineer in a lab coat with gloves, glowing vials',
    'ft_climateeng': 'climate engineer with a tablet, rugged weatherproof jacket',
    'ft_cyberdoc': 'cyber doctor with glowing implants and a medical visor',
    'ft_dronecmd': 'drone commander with holographic control gloves, sleek uniform',
    'ft_ewarfare': 'electronic warfare officer with a headset, dark tactical uniform',
    'ft_fusioneng': 'fusion reactor engineer in a protective suit, blue glow reflected on the face',
    'ft_hacker': 'hacker in a hoodie, neon screens reflected in the eyes',
    'ft_hologramartist': 'hologram artist with floating colorful light around',
    'ft_marspioneer': 'mars pioneer in a red dust jacket with goggles on the forehead',
    'ft_nanotech': 'nanotech scientist, silver particles floating around, sleek suit',
    'ft_orbitmech': 'orbital station mechanic with a tool belt and a zero gravity suit',
    'ft_quantumphy': 'quantum physicist with glowing equations behind',
    'ft_roboteng': 'robotics engineer with a mechanical arm, workshop background',
    'md_architect': 'architect with a rolled blueprint and a hard hat',
    'md_athlete': 'athlete in a sports jacket, determined, sweat',
    'md_ceo': 'company executive in a tailored suit, confident',
    'md_chef': 'chef in a white uniform and hat, proud smile',
    'md_developer': 'software developer with headphones, casual hoodie, laptop glow',
    'md_doctor': 'doctor in a white coat with a stethoscope, kind expression',
    'md_entrepreneur': 'young entrepreneur in a smart casual blazer, energetic',
    'md_explorer': 'field explorer with a backpack and compass, sun tanned',
    'md_firefighter': 'firefighter in uniform, soot on the cheek, brave',
    'md_journalist': 'journalist with a press badge and a camera',
    'md_lawyer': 'lawyer in a formal suit, serious',
    'md_musician': 'musician with a guitar, expressive',
    'md_photographer': 'photographer with a camera, focused',
    'md_pilot': 'airline pilot in uniform with epaulettes, calm',
    'md_scientist': 'scientist in a lab coat with safety goggles, curious',
}


def item(pid, gender_f, desc, hair, eyes, extra=''):
    who = '1girl, female focus, feminine' if gender_f else '1boy, male focus, masculine, strong jaw'
    prompt = ', '.join([who, 'solo', 'upper body portrait', hair, eyes, desc, extra, 'looking at viewer', 'soft dramatic lighting', 'simple painterly gradient background']).replace(', ,', ',')
    neg = NEG + ', ' + ('1boy, male focus, beard' if gender_f else '1girl, feminine, breasts, makeup')
    return {'id': pid, 'seed': fnv(pid), 'prompt': prompt, 'negative': neg}


def realm_items():
    js = r"""
const vm=require('vm'),fs=require('fs'),path=require('path');
const dir=process.argv[1];
const g={};g.window=g;g.DG={};const ctx=vm.createContext(g);
for (const f of ['data.js','data-force.js']) vm.runInContext(fs.readFileSync(path.join(dir,f),'utf8'),ctx,{filename:f});
const F=g.DG.forceData, out={};
for (const k of Object.keys(F)) { const v=F[k]; if (Array.isArray(v)) for (const o of v) if (o && o.id && o.name) out[o.id]={id:o.id,name:o.name,hanja:o.hanja||'',era:o.era,faction:o.faction,rarity:o.rarity,trait:o.trait}; }
console.log(JSON.stringify(Object.values(out)));
"""
    r = subprocess.run(['node', '-e', js, os.path.join(WEB, 'saga-realm', 'js')], capture_output=True, text=True, encoding='utf-8')
    if not r.stdout.strip():
        raise SystemExit('node 실패: ' + r.stderr[:400])
    rows = json.loads(r.stdout)
    have = {os.path.basename(f)[:-7] for f in __import__('glob').glob(os.path.join(WEB, 'saga-realm', 'assets', 'portraits', 'hero', '*_s.webp'))}
    dex = {os.path.basename(f)[5:-4] for f in __import__('glob').glob(os.path.join(HERE, '_out', 'web_heroes_105', 'hero_*.png'))}
    items = []
    for o in sorted(rows, key=lambda x: x['id']):
        pid = o['id']
        if pid not in have or pid in dex:
            continue
        pre = pid.split('_')[0]
        cult, hairs = CULT.get(pre, CULT['rf'])
        h = fnv(pid)
        female = any(c in o['hanja'] for c in FEMALE_CUES) or (h % 100) < 28
        desc = cult + ', ' + TRAIT.get(o['trait'], TRAIT['command'])
        if (o.get('rarity') or 3) >= 4:
            desc += ', highly detailed ornate outfit, striking presence'
        items.append(item(pid, female, desc, hairs[(h >> 4) % len(hairs)], EYES[(h >> 9) % len(EYES)]))
    return items, len(rows)


def main():
    items, n = realm_items()
    have = {os.path.basename(f)[:-7] for f in __import__('glob').glob(os.path.join(WEB, 'saga-realm', 'assets', 'portraits', 'hero', '*_s.webp'))}
    print('realm 데이터', n, '· 초상 파일 있고 도감 밖', len(items), '(파일 총', len(have), ')')
    b = {'model': 'animagine-xl-4.0-opt', 'out': 'web_realm_194', 'defaults': {'prompt_prefix': PREFIX, 'width': 768, 'height': 1024, 'steps': 28, 'cfg': 5.0, 'sampler': 'Euler a', 'negative': ''}, 'items': items}
    json.dump(b, open(os.path.join(HERE, 'batches', 'web_realm_194.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    di = []
    for pid, desc in sorted(DUNGEON.items()):
        h = fnv(pid)
        female = (h % 100) < 42
        hair = ['black hair', 'brown hair', 'dark brown hair', 'blonde hair', 'short silver hair'][(h >> 4) % 5]
        di.append(item(pid, female, desc, hair, EYES[(h >> 9) % len(EYES)]))
    b2 = {'model': 'animagine-xl-4.0-opt', 'out': 'web_dungeon_30', 'defaults': b['defaults'], 'items': di}
    json.dump(b2, open(os.path.join(HERE, 'batches', 'web_dungeon_30.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print('dungeon', len(di))
    for i in items[:2] + di[:1]:
        print(i['id'], '|', i['prompt'][:200])


if __name__ == '__main__':
    main()
