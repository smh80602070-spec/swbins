"""K-0027 — 도감 신규 인물 201(W-0116, data.js `late: true`) 초상 배치(k27_late201_i2i.json). 도감 299 와 같은 그림체(공방 몸 렌더 밑그림 img2img).

  py tools/ai-art/make_late_i2i_batch.py      → batches/k27_late201_i2i.json (201) + _out/k27_late201_pairs.json(인물 → 밑그림 몸·성별)
  py tools/ai-art/gen.py tools/ai-art/batches/k27_late201_i2i.json   (한 번에 24장 — 없는 것만, 다 찰 때까지 되풀이)
  py tools/ai-art/pack_web_portraits.py --src k27_late201_i2i --games saga-go,saga-dungeon,saga-forest,saga-story,saga-realm

도감 데이터엔 성별·외모가 없다(가상 인물) — 성별은 id 씨앗 해시(여 45%), 밑그림은 국지 194 반신 렌더(`_out/busts_realm`) 중 같은 성별을
해시 순서로 고르게 돌려 쓴다(겹침 최소). 머리색·눈색·나이는 그 몸 레시피에서 읽어(make_realm_i2i_batch 와 같은 방식) 글과 밑그림이 어긋나지 않게.
옷차림 = 세력(faction) 표 FACTION — 퓨전(과거·현대·미래·가상 나라). 성격(trait) = 표정.
K-0090 ⑤ 교훈: 밑그림의 파인 목선·눈 덮는 앞머리는 부정어로 안 고쳐진다 → 처음부터 `both eyes visible`·목깃·denoise 0.6.
원작·실존 이름 없음(gen.py BLOCK). 데이터 출처: saga-web/saga-go/js/data.js(다섯 벌 md5 같음).
"""
import hashlib
import json
import os
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
FORGE = os.path.join(HERE, '..', 'char-forge')
BUSTS = os.path.join(HERE, '_out', 'busts_realm')
sys.path.insert(0, HERE)
from make_hero_batch import hair_name, age_txt, EYE  # noqa: E402

FACTION = {
    '아크 해저도시': 'futuristic undersea city citizen, sleek teal bodysuit with glowing seams, high collar',
    '심해 탐사대': 'deep sea explorer, padded pressure suit jacket, high collar, shoulder lamp',
    '사하 성읍': 'desert oasis townsperson, layered sand-colored linen robes, head wrap scarf',
    '모래 대상': 'desert caravan merchant, long striped coat, wide sash, turban scarf',
    '북원 부족': 'northern steppe tribe warrior, thick fur coat, bone bead necklace, braided leather',
    '설원 기마': 'snowfield cavalry rider, fur-lined lamellar armor, fur hat',
    '철로 상회': '1920s railway company manager, three-piece suit, waistcoat, pocket watch chain',
    '기관사 조합': 'steam train engineer, denim overalls, engineer cap, red neckerchief',
    '대곡': 'highland valley clan member, woven patterned tunic, wool shawl',
    '계곡 수호대': 'valley guard, studded leather armor, green hooded cloak lowered',
    '하늘섬': 'floating sky island noble, futuristic white robes with gold trim, wind ribbons',
    '구름 정원': 'cloud garden keeper, futuristic pastel smock, flower pin',
    '금마성': 'golden fortress knight, gilded lamellar armor, horse crest',
    '광산 조합': 'mining guild worker, heavy canvas work jacket, soot smudges, goggles around neck',
    '녹화 연합': 'eco engineer, green field jacket, leaf emblem, utility pockets',
    '씨앗 은행': 'seed vault scientist, white lab coat, seed pouches on belt',
    '하늘 비행단': 'aviator pilot, leather flight jacket, white scarf, wings badge',
    '관제탑': 'air traffic controller, navy uniform, headset around neck',
    '화림 궁': 'flower forest palace courtier, layered silk robes with floral embroidery, ornate hairpin',
    '화림 서원': 'academy scholar, plain scholar robe, ink brush, hair tied up',
    '해궁': 'undersea palace royal, ornate flowing robes, pearl strands, coral hairpin',
    '진주 선단': 'pearl fleet sea captain, long captain coat, pearl earring, tricorn hat',
    '진성 방송국': 'modern news anchor, tailored blazer, press badge',
    '현장 취재반': 'field reporter, khaki utility vest, camera strap over shoulder',
    '청람 공대': 'engineering university student, zip-up hoodie, lanyard id card',
    '로봇 동아리': 'robotics club member, team jacket, tool belt, robot arm patch',
    '전설': 'legendary mythic hero, ornate ancient armor with faintly glowing runes, flowing cape',
    '무하 의료단': 'hospital doctor, white coat, stethoscope around neck',
    '응급 구조대': 'paramedic, rescue uniform with reflective stripes',
    '화성 개척단': 'mars colonist, rust orange environment suit, high collar, mission patch',
    '붉은 사막 기지': 'mars base engineer, dusty red jumpsuit, utility harness',
    '네온시 순찰대': 'cyberpunk city patrol officer, armored jacket with neon trim',
    '네온 상가': 'neon market merchant, glossy jacket, holographic accessories',
    '신경망 도시': 'neural city hacker, dark coat with glowing circuit lines',
    '접속자 연합': 'virtual reality netrunner, long tech coat, visor hanging around neck',
    '궤도 정거장': 'space station crew member, fitted crew uniform, mission patches',
    '우주 정비단': 'space mechanic, padded jumpsuit, tool harness',
    '질주 리그': 'racing driver, racing suit with sponsor patches, high collar',
    '정비 팀': 'pit crew mechanic, team uniform, work gloves',
    '석남': 'southern jungle kingdom noble, gold armlets, colorful layered sash',
    '밀림 촌락': 'jungle village hunter, leaf patterned wrap tunic, bead necklace',
    '시간 관측소': 'time observatory scholar, long dark coat, clockwork brooch',
    '시계지기': 'clockmaker, leather apron, brass gears, magnifier loupe on chain',
    '운령 관문': 'mountain pass guard, lamellar armor, red tassel helmet held at side',
    '고원 유목': 'highland nomad, felt coat, sheepskin collar',
}
# 10-10 201장 눈 판정에서 뺀 26장 — 밑그림 몸의 앞머리가 한 눈을 덮거나(대부분)·천이 얼굴을 가림·맨가슴·옷 뭉개짐.
# 그 몸들은 빼고 같은 성별 다른 몸(씨앗 'k27b:')·두 눈·목깃·denoise 0.62·새 씨앗으로 다시 뽑는다(K-0090 ⑤ 와 같은 처방)
REDO = set('''aq_sanghwa bw_bitnae bw_gomnae ac_simyeon aq_cheongok bw_seolgu cs_gyeongjeok gr_iseul hb_bisang hq_jamsu js_dalli js_jomyeong kd_seorim
kd_silheom mr_bakwi mr_bingha mr_jeoksa mr_sumteo nc_ullim ns_gieok ns_hakseup ob_tongsin rg_gyeolseung sn_deonggul tw_hoegwi yk_amsu'''.split())
REDO_NEG = ', bare chest, shirtless, topless, eyepatch, bandage on face, scarf over face, face paint'
MOOD = {'might': 'fierce determined expression', 'wisdom': 'calm clever gaze', 'virtue': 'gentle kind smile'}
NEG_BASE = ('lowres, bad anatomy, bad hands, text, error, missing finger, extra digits, fewer digits, cropped, worst quality, low quality, '
            'low score, bad score, average score, signature, watermark, username, blurry, mask, mouth mask, menpo, face covered, fangs, mouth guard, '
            'hair over eyes, hair over face, covered face, faceless')
NEG = {'F': NEG_BASE + ', 1boy, male focus, beard, cleavage, revealing clothes, open clothes, bare chest, collarbone, large breasts, skin tight',
       'M': NEG_BASE + ', 1girl, feminine, breasts, makeup'}


def late_heroes():
    js = ("const vm=require('vm'),fs=require('fs');const w={};w.window=w;w.DG={};vm.createContext(w);"
          "vm.runInContext(fs.readFileSync(process.argv[1],'utf8'),w);"
          "process.stdout.write(JSON.stringify(w.DG.data.heroes.filter(h=>h.late).map(h=>({id:h.id,era:h.era,faction:h.faction,trait:h.trait}))))")
    out = subprocess.run(['node', '-e', js, os.path.join(ROOT, 'saga-web', 'saga-go', 'js', 'data.js')], capture_output=True, check=True)
    return json.loads(out.stdout.decode('utf-8'))


def h8(s):
    return int(hashlib.md5(s.encode()).hexdigest()[:8], 16)


def main():
    heroes = late_heroes()
    realm = json.load(open(os.path.join(HERE, 'batches', 'web_realm_194_i2i.json'), encoding='utf-8'))
    pool = {'M': [], 'F': []}
    for it in realm['items']:
        if os.path.exists(os.path.join(BUSTS, 'hero_%s.png' % it['id'])):
            pool['F' if it['prompt'].lstrip().startswith('1girl') else 'M'].append(it['id'])
    for g in pool:
        pool[g].sort(key=lambda b: h8('k27pool:' + b))
    used = {'M': 0, 'F': 0}
    items, pairs, miss = [], {}, []
    order = sorted(heroes, key=lambda x: h8('k27:' + x['id']))
    first = {}   # 처음 돌림 몸(REDO 아닌 장은 그대로 — 이미 뽑힌 그림과 맞는다)
    for h in order:
        g = 'F' if h8('k27g:' + h['id']) % 100 < 45 else 'M'
        first[h['id']] = (g, pool[g][used[g] % len(pool[g])])
        used[g] += 1
    bad = {first[i][1] for i in REDO if i in first}
    for h in order:
        g, body = first[h['id']]
        redo = h['id'] in REDO
        if redo:
            alt = [b for b in pool[g] if b not in bad]
            body = alt[h8('k27b:' + h['id']) % len(alt)]
        r = json.load(open(os.path.join(FORGE, 'recipes', 'realm', 'hero_' + body + '.json'), encoding='utf-8'))
        female = g == 'F'
        outfit = FACTION.get(h['faction'])
        if not outfit:
            miss.append(h['faction'])
            continue
        head = '1girl, female focus, feminine, solo' if female else '1boy, male focus, masculine, strong jaw, solo'
        prompt = ', '.join([head, 'upper body portrait, both eyes visible' + (', forehead visible, high collar, closed jacket, fully clothed' if redo else ''), age_txt(r['macro']['age'], female),
                            hair_name(r.get('tints', {}).get('hair'), female, h['id']), EYE.get(r.get('eye_color', 'brown'), 'brown eyes'),
                            outfit, MOOD.get(h['trait'], 'calm expression'), 'looking at viewer, soft dramatic lighting, simple painterly gradient background'])
        row = {'id': h['id'], 'seed': h8(('k27s2:' if redo else 'k27s:') + h['id']) % 2_000_000_000, 'prompt': prompt,
               'negative': NEG[g] + (REDO_NEG if redo else ''), 'init_image': os.path.join(BUSTS, 'hero_%s.png' % body), 'body': body}
        if redo:
            row['denoise'] = 0.62
        items.append(row)
        pairs[h['id']] = dict({'gender': g, 'body': body, 'faction': h['faction']}, **({'redo': True} if redo else {}))
    if miss:
        sys.exit('옷차림 표에 없는 세력: %s' % sorted(set(miss)))
    items.sort(key=lambda x: x['id'])
    out = {'model': 'animagine-xl-4.0-opt', 'out': 'k27_late201_i2i',
           'note': 'K-0027 도감 신규 인물 %d — 국지 194 공방 몸 반신 렌더 밑그림 img2img(성별 해시·몸 고르게 돌림), 세력 옷차림 표 · denoise 0.6' % len(items),
           'defaults': {'prompt_prefix': 'masterpiece, high score, great score, absurdres', 'width': 768, 'height': 1024, 'steps': 28, 'cfg': 5.0,
                        'sampler': 'Euler a', 'negative': '', 'denoise': 0.6}, 'items': items}
    json.dump(out, open(os.path.join(HERE, 'batches', 'k27_late201_i2i.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    json.dump(pairs, open(os.path.join(HERE, '_out', 'k27_late201_pairs.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print('BATCH', len(items), '여', sum(1 for p in pairs.values() if p['gender'] == 'F'), '· 몸 풀 M%d F%d' % (len(pool['M']), len(pool['F'])))


if __name__ == '__main__':
    main()
