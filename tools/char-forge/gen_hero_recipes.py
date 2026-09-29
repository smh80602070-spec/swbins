"""char-forge 단계 4 — 도감 인물 105 → 사실 몸 레시피 105(saga-unity GO 도감, README §7 단계 4).

    py tools/char-forge/gen_hero_recipes.py            # recipes/hero/hero_<id>.json 을 새로 쓴다(키 값은 calib_height.py 가 맞춘다)
    py tools/char-forge/gen_hero_recipes.py --check    # 쓴 레시피를 다시 읽어 실루엣 네 축 검사만

입력은 게임 표를 그대로 읽는다(손으로 옮기지 않는다): `saga-unity/Assets/Games/SagaGo/Data/GoHeroes.cs`(id·가명·시대·세력·희귀도·기질·무력)
+ `GoHeroLooks.cs` 의 여자 인물 목록. 역할(`ROLE`)만 여기서 손으로 박는다 — 이름 정책상 실명은 쓰지 않고 id 로만 가리킨다.

실루엣 네 축(README §7 단계 4 "키·체격·머리·옷 네 축 중 둘 이상"):
  키   = 맨몸 키 다섯 칸(`height_target_m`, 남 1.60~1.92 · 여 1.50~1.74) — 값은 calib_height.py 가 macro.height 로 맞춘다
  체격 = 마름·보통·근육·육중 네 칸(macro muscle·weight)
  머리 = MakeHuman 머리카락 열 · 민머리 · 껍데기 모자(관·투구·두건·터번·털모자·관띠)
  옷   = 껍데기 옷 틀 스물(`OUTFIT`) — 갑옷·도포·반소매·토가·양복·군복·치마…
모든 두 사람이 네 축 중 둘 이상 달라야 한다. 역할마다 선호 순서가 있고, 앞사람과 둘 이상 다르면서 선호·쏠림 벌점이 가장 작은 조합을 고른다.
색은 축에 넣지 않는다(사용자 기준 "색만 다른 건 다른 게 아니다") — 세력 색으로 입힐 뿐이다.
"""
import json, os, re, sys, itertools

ROOT = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(ROOT))
DATA = os.path.join(REPO, 'saga-unity', 'Assets', 'Games', 'SagaGo', 'Data')
OUT = os.path.join(ROOT, 'recipes', 'hero')


def fnv(s):
    h = 0x811c9dc5
    for b in s.encode('utf-8'):
        h = ((h ^ b) * 0x01000193) & 0xffffffff
    return h


def load_heroes():
    src = open(os.path.join(DATA, 'GoHeroes.cs'), encoding='utf-8').read()
    pat = re.compile(r'new Hero \{ Id = "([^"]+)", NameKo = "([^"]+)", Era = HeroEra\.(\w+), Faction = "([^"]+)", '
                     r'Rarity = (\d), Trait = HeroTrait\.(\w+), Might = (\d+), Wisdom = (\d+), Command = (\d+)')
    heroes = [dict(id=m[0], name=m[1], era=m[2], faction=m[3], rarity=int(m[4]), trait=m[5],
                   might=int(m[6]), wisdom=int(m[7]), command=int(m[8])) for m in pat.findall(src)]
    looks = open(os.path.join(DATA, 'GoHeroLooks.cs'), encoding='utf-8').read()
    block = re.search(r'FemaleIds = new HashSet<string>\s*\{([^}]*)\}', looks).group(1)
    female = set(re.findall(r'"([^"]+)"', block))
    for h in heroes:
        h['female'] = h['id'] in female
    # 이야기 인물(Era Story — 09-28 도감에 넷)은 GoHeroLooks 표 밖, 이야기 장면 몸(StoryField)을 쓴다
    return [h for h in heroes if h['era'] != 'Story']


# ---- 역할(손으로 박음 — id 로만) ----
ROLE = {
    'sg_guanyu': 'general', 'sg_zhangfei': 'warrior', 'sg_zhaoyun': 'warrior', 'sg_zhugeliang': 'strategist',
    'sg_liubei': 'king', 'sg_machao': 'warrior', 'sg_huangzhong': 'warrior', 'sg_caocao': 'king', 'sg_simayi': 'strategist',
    'sg_xiahoudun': 'general', 'sg_zhangliao': 'general', 'sg_xunyu': 'scholar', 'sg_sunquan': 'king', 'sg_zhouyu': 'strategist',
    'sg_luxun': 'strategist', 'sg_taishici': 'warrior', 'sg_ganning': 'warrior', 'sg_lubu': 'warrior', 'sg_diaochan': 'dancer',
    'sg_pangtong': 'strategist', 'sg_huatuo': 'healer', 'sg_menghuo': 'tribal',
    'kr_yisunsin': 'general', 'kr_euljimundeok': 'general', 'kr_ganggamchan': 'strategist', 'kr_kimyusin': 'warrior',
    'kr_gyebaek': 'warrior', 'kr_yeongaesomun': 'general', 'kr_gwanggaeto': 'king', 'kr_sejong': 'king',
    'kr_jangyeongsil': 'scholar', 'kr_choemuseon': 'scholar', 'kr_daejoyeong': 'general', 'kr_wanggeon': 'king',
    'kr_jeongyakyong': 'scholar', 'kr_heojun': 'healer', 'kr_sinsaimdang': 'lady', 'kr_ahnjunggeun': 'modern',
    'kr_yugwansun': 'student', 'kr_kimgu': 'modern', 'kr_wonhyo': 'monk', 'kr_kimjeongho': 'traveler',
    'kr_gwakjaeu': 'general', 'kr_nongae': 'dancer', 'kr_yihwang': 'scholar', 'kr_yii': 'scholar', 'kr_hwanghui': 'scholar',
    'kr_jeongmongju': 'scholar',
    'jp_himiko': 'queen', 'jp_taira': 'general', 'jp_yoritomo': 'king', 'jp_yoshitsune': 'samurai', 'jp_murasaki': 'court',
    'jp_seishonagon': 'court', 'jp_tomoegozen': 'warrior_f', 'jp_nobunaga': 'samurai', 'jp_hideyoshi': 'king',
    'jp_ieyasu': 'king', 'jp_shingen': 'samurai', 'jp_kenshin': 'samurai', 'jp_masamune': 'samurai', 'jp_yukimura': 'samurai',
    'jp_musashi': 'ronin', 'jp_hanzo': 'ninja', 'jp_mitsukuni': 'scholar', 'jp_naosuke': 'scholar', 'jp_saigo': 'officer',
    'jp_ryoma': 'modern',
    'eu_caesar': 'roman', 'eu_alexander': 'hoplite', 'eu_hannibal': 'general', 'eu_charlemagne': 'king', 'eu_joan': 'warrior_f',
    'eu_napoleon': 'officer', 'eu_davinci': 'artist', 'eu_augustus': 'roman', 'eu_scipio': 'hoplite', 'eu_leonidas': 'hoplite',
    'eu_aurelius': 'roman', 'eu_richard': 'warrior', 'eu_william': 'warrior', 'eu_harald': 'warrior', 'eu_frederick': 'officer',
    'eu_peter': 'officer', 'eu_elizabeth': 'queen', 'eu_nelson': 'officer', 'eu_machiavelli': 'scholar', 'eu_newton': 'scholar',
    'eu_michelangelo': 'artist', 'eu_eleanor': 'queen',
    'wd_ashoka': 'king', 'wd_akbar': 'sultan', 'wd_saladin': 'sultan', 'wd_suleiman': 'sultan', 'wd_ibnsina': 'healer',
    'wd_genghis': 'nomad', 'wd_khubilai': 'khan', 'wd_mansamusa': 'king', 'wd_shaka': 'tribal', 'wd_cleopatra': 'queen',
    'wd_pachacuti': 'king', 'wd_moctezuma': 'king', 'wd_ibnbattuta': 'traveler', 'wd_hammurabi': 'king', 'wd_attila': 'nomad',
}

# 역할 → (옷 선호, 머리 선호, 키 칸 선호, 체격 칸 선호, 나이 범위, 무예 동작?)
ROLES = {
    'warrior':    (['lamellar', 'leather', 'robe_armored', 'tunic'], ['helmet', 'short02', 'ponytail01', 'band', 'short04', 'cap'], [3, 4, 2], [2, 3, 1], (0.45, 0.58), True),
    'general':    (['robe_armored', 'lamellar', 'leather'], ['helmet', 'cap', 'short01', 'ponytail01', 'band'], [3, 2, 4], [3, 2, 1], (0.5, 0.62), True),
    'samurai':    (['samurai', 'lamellar', 'robe_armored'], ['helmet', 'ponytail01', 'short03', 'band', 'cap'], [2, 1, 3], [2, 1, 3], (0.45, 0.6), True),
    'ronin':      (['robe_short', 'tunic', 'leather'], ['ponytail01', 'long01', 'short04', 'band'], [3, 2, 4], [2, 0, 1], (0.45, 0.55), True),
    'hoplite':    (['hoplite', 'lamellar', 'toga'], ['helmet', 'short02', 'short04', 'short03'], [3, 2, 4], [2, 3, 1], (0.45, 0.55), True),
    'tribal':     (['tribal', 'leather'], ['short04', 'afro01', 'band', 'bald', 'short02'], [4, 3, 2], [3, 2, 1], (0.45, 0.55), True),
    'nomad':      (['nomad', 'leather', 'lamellar'], ['furhat', 'helmet', 'braid01', 'ponytail01'], [2, 3, 1], [3, 2, 1], (0.5, 0.62), True),
    'officer':    (['uniform', 'tunic', 'leather', 'worksuit'], ['short02', 'short03', 'short01', 'bald', 'long01'], [1, 2, 3], [1, 3, 0], (0.5, 0.62), True),
    'ninja':      (['ninja'], ['hood'], [2, 1, 3], [0, 2, 1], (0.45, 0.55), True),
    'warrior_f':  (['lamellar', 'samurai', 'leather'], ['ponytail01', 'helmet', 'bob02', 'long01'], [3, 4, 2], [2, 1, 0], (0.42, 0.5), True),
    'king':       (['royal', 'robe_wide', 'robe_armored', 'robe_long'], ['crown', 'cap', 'short01', 'long01', 'short03'], [2, 3, 1], [3, 1, 2], (0.55, 0.72), False),
    'sultan':     (['royal', 'robe_wide', 'robe_armored'], ['turban', 'crown', 'cap'], [2, 3, 1], [3, 1, 2], (0.55, 0.7), False),
    'khan':       (['royal', 'nomad', 'robe_wide'], ['furhat', 'crown', 'cap'], [2, 1, 3], [3, 1, 2], (0.6, 0.72), False),
    'roman':      (['toga', 'hoplite', 'tunic'], ['short03', 'short01', 'crown', 'band'], [2, 1, 3], [1, 0, 3], (0.55, 0.7), False),
    'strategist': (['robe_wide', 'robe_long', 'tunic'], ['cap', 'long01', 'ponytail01', 'short01'], [2, 3, 1], [0, 1, 2], (0.5, 0.65), False),
    'scholar':    (['robe_long', 'robe_wide', 'tunic', 'robe_short'], ['cap', 'short01', 'short03', 'bald', 'long01'], [1, 2, 0], [0, 1, 3], (0.55, 0.82), False),
    'healer':     (['robe_long', 'robe_short', 'tunic'], ['cap', 'short03', 'bald', 'turban'], [1, 0, 2], [0, 1], (0.62, 0.82), False),
    'monk':       (['monk', 'robe_long'], ['bald', 'cap'], [1, 2], [0, 1], (0.55, 0.65), False),
    'artist':     (['tunic', 'robe_short', 'robe_long'], ['long01', 'short04', 'cap', 'short03'], [1, 2, 0], [0, 1, 3], (0.55, 0.78), False),
    'traveler':   (['nomad', 'tunic', 'robe_short'], ['turban', 'cap', 'short02', 'furhat'], [2, 1, 3], [0, 1, 2], (0.5, 0.62), False),
    'modern':     (['suit', 'worksuit', 'casualsuit', 'uniform'], ['short01', 'short03', 'short02', 'bald'], [2, 1, 3], [1, 0, 2], (0.5, 0.62), False),
    'lady':       (['dress', 'court', 'skirt'], ['braid01', 'long01', 'bob01', 'ponytail01'], [1, 2, 0], [0, 1], (0.45, 0.55), False),
    'court':      (['court', 'dress'], ['long01', 'braid01', 'bob02', 'ponytail01'], [1, 0, 2], [0, 1], (0.44, 0.52), False),
    'queen':      (['royal_f', 'court', 'dress'], ['crown_long', 'long01', 'bob02', 'hood'], [2, 3, 1], [1, 0, 3], (0.48, 0.6), False),
    'dancer':     (['dancer', 'dress', 'skirt'], ['bob01', 'ponytail01', 'long01', 'braid01'], [2, 3, 1], [0, 1], (0.42, 0.48), False),
    'student':    (['skirt', 'dress'], ['braid01', 'bob01'], [0, 1], [0, 1], (0.42, 0.42), False),
}

HEIGHT_M = {False: [1.60, 1.68, 1.76, 1.84, 1.92], True: [1.50, 1.56, 1.62, 1.68, 1.74]}
BUILD = [(0.3, 0.35), (0.5, 0.5), (0.8, 0.55), (0.6, 0.85)]  # 마름·보통·근육·육중 (muscle, weight)
BUILD_NAME = ['마름', '보통', '근육', '육중']

# ---- 세력 → 얼굴 비율·옷 색 ----
EAST = {'asian': 0.85, 'caucasian': 0.1, 'african': 0.05}
REGION = {
    **{f: EAST for f in ('촉', '위', '오', '군웅', '재야', '조선', '고구려', '고려', '신라', '백제', '발해', '대한제국', '일제강점기',
                         '야마타이', '다이라가', '가마쿠라막부', '겐지가', '헤이안', '오다가', '도요토미가', '도쿠가와막부', '다케다가',
                         '우에스기가', '다테가', '사나다가', '낭인', '이가', '메이지유신', '몽골제국', '원')},
    '남만': {'asian': 0.6, 'african': 0.3, 'caucasian': 0.1},
    '훈제국': {'asian': 0.6, 'caucasian': 0.35, 'african': 0.05},
    **{f: {'caucasian': 0.9, 'asian': 0.05, 'african': 0.05} for f in ('로마', '마케도니아', '프랑크', '프랑스', '이탈리아', '스파르타',
                                                                      '잉글랜드', '노르만', '노르웨이', '프로이센', '러시아')},
    **{f: {'caucasian': 0.6, 'african': 0.25, 'asian': 0.15} for f in ('카르타고', '프톨레마이오스', '아이유브', '오스만', '페르시아', '바빌로니아', '여행자')},
    **{f: {'caucasian': 0.45, 'asian': 0.35, 'african': 0.2} for f in ('마우리아', '무굴')},
    **{f: {'african': 0.9, 'caucasian': 0.05, 'asian': 0.05} for f in ('말리제국', '줄루왕국')},
    **{f: {'asian': 0.6, 'caucasian': 0.25, 'african': 0.15} for f in ('잉카제국', '아즈텍')},
}
FACTION_COLOR = {
    '촉': '#3f6b3a', '위': '#2f4a7a', '오': '#8a2f2a', '군웅': '#5a3a5a', '재야': '#6b5a48', '남만': '#7a5a2a',
    '조선': '#e8e2d0', '고구려': '#7a2a24', '고려': '#2f6a6a', '신라': '#9a7a2a', '백제': '#4a3a6a', '발해': '#4a5a6a',
    '대한제국': '#2a2a30', '일제강점기': '#3a3a3a', '야마타이': '#e8e2d0', '다이라가': '#8a2a2a', '가마쿠라막부': '#3a4a3a',
    '겐지가': '#e0dccc', '헤이안': '#6a3a6a', '오다가': '#2a2a2a', '도요토미가': '#9a7a2a', '도쿠가와막부': '#2a3a5a',
    '다케다가': '#8a2a24', '우에스기가': '#2f4a6a', '다테가': '#1f2a3a', '사나다가': '#9a2a24', '낭인': '#4a4038',
    '이가': '#1e1e24', '메이지유신': '#2a2a30', '로마': '#e6e0d0', '마케도니아': '#6a2a3a', '카르타고': '#5a2a5a',
    '프랑크': '#3a4a7a', '프랑스': '#2a3a7a', '이탈리아': '#6a3a2a', '스파르타': '#8a2a24', '잉글랜드': '#8a2a2a',
    '노르만': '#5a4a3a', '노르웨이': '#4a5a6a', '프로이센': '#2a3450', '러시아': '#2f5a3a', '마우리아': '#c07a2a',
    '무굴': '#2a6a4a', '아이유브': '#e6e0d0', '오스만': '#8a2a2a', '페르시아': '#3a4a8a', '몽골제국': '#3a5a8a',
    '원': '#6a4a2a', '말리제국': '#c09a2a', '줄루왕국': '#6a4a2a', '프톨레마이오스': '#e6e0d0', '잉카제국': '#9a4a2a',
    '아즈텍': '#2a7a6a', '여행자': '#b0986a', '바빌로니아': '#3a4a7a', '훈제국': '#5a4a3a',
}
LIGHT = ['#ece5d3', '#d8d0bc', '#e0d6c4', '#cfc6b0']
DARK = ['#2a2522', '#1f2226', '#302a24', '#26262e']
LEATHER = ['#3a2a1e', '#4a3526', '#2e2218', '#5a4030']
STEEL, GOLD, BRONZE = '#9ba3ab', '#c9a64a', '#a87a43'
FUR = ['#6a5238', '#8a7458', '#4a3a2a']


def pick(lst, h, k=0):
    return lst[(h >> (k * 3)) % len(lst)]


def sh(slot, color, groups, off, thick, rough=0.85, **kw):
    d = {'part': 'shell', 'slot': slot, 'color': color, 'rough': rough, 'offset': off, 'thick': thick, 'groups': groups}
    d.update(kw)
    return d


def robe(color, top, flare, hem=None, length=None, rough=0.85):
    d = {'part': 'robe', 'color': color, 'top': top, 'flare': flare, 'jag': 0.0, 'weights': 'skin', 'rough': rough}
    if length is not None:
        d['length'] = length
    else:
        d['hem'] = hem if hem is not None else 0.035
    return d


BODY = ['pelvis', 'spine_0*', 'clavicle_*', 'upperarm_*', 'lowerarm_*', 'thigh_*', 'calf_*', 'neck_01']
TORSO_ARMS = ['spine_0*', 'clavicle_*', 'upperarm_*', 'lowerarm_*']
HANDS = ['hand_*', 'index_*', 'middle_*', 'ring_*', 'pinky_*', 'thumb_*']
FEET = ['foot_*', 'ball_*']
LEGS = ['pelvis', 'thigh_*', 'calf_*']


def boots(lt, top=0.17, off=0.012):
    return sh('leather', lt, FEET + ['calf_*'], off, 0.005, 0.7, z=[0.0, top], minw=0.3)


def shoes(lt):
    return sh('leather', lt, FEET, 0.007, 0.004, 0.7, minw=0.4)


def outfit_parts(key, c1, c2, c3, lt, mt, gold):
    """옷 틀 → (kitbash 부품, MakeHuman 옷). 칸 이름(slot)은 색마다 달리한다 — 같은 칸은 첫 색으로 합친다."""
    if key == 'lamellar':
        return [sh('cloth', c1, BODY, 0.004, 0.004, 0.9, minw=0.5), sh('leather', lt, HANDS, 0.006, 0.004, 0.7, minw=0.3), boots(lt),
                sh('metal', mt, ['spine_01', 'spine_02', 'spine_03'], 0.018, 0.006, 0.35, z=[0.52, 0.8]),
                sh('metal', mt, ['upperarm_*', 'clavicle_*'], 0.024, 0.006, 0.35, z=[0.74, 0.86], minw=0.4),
                sh('metal', mt, ['lowerarm_*'], 0.014, 0.005, 0.35, minw=0.7),
                sh('metal', mt, ['calf_*'], 0.018, 0.005, 0.35, z=[0.17, 0.27], minw=0.7),
                sh('metal', mt, ['thigh_*'], 0.02, 0.005, 0.35, z=[0.40, 0.49], minw=0.6)], []
    if key == 'robe_armored':
        return [sh('cloth', c1, TORSO_ARMS + ['neck_01'], 0.004, 0.004, 0.9, minw=0.5), sh('leather', lt, HANDS, 0.006, 0.004, 0.7, minw=0.3),
                sh('metal', mt, ['spine_01', 'spine_02', 'spine_03'], 0.018, 0.006, 0.35, z=[0.55, 0.8]),
                sh('metal', mt, ['upperarm_*', 'clavicle_*'], 0.026, 0.007, 0.35, z=[0.72, 0.86], minw=0.4),
                robe(c2, 0.30, 0.5), boots(lt)], []
    if key == 'leather':
        return [sh('cloth', c1, BODY, 0.004, 0.004, 0.9, minw=0.5), sh('leather', lt, HANDS, 0.006, 0.004, 0.7, minw=0.3),
                sh('leather_vest', c3, ['spine_0*', 'pelvis'], 0.012, 0.006, 0.75, z=[0.5, 0.8]),
                sh('leather_vest', c3, ['lowerarm_*'], 0.012, 0.005, 0.75, minw=0.7), boots(lt, 0.22)], []
    if key == 'robe_long':
        return [sh('cloth', c2, TORSO_ARMS, 0.004, 0.004, 0.85, minw=0.5), shoes(lt), robe(c1, 0.12, 0.5)], []
    if key == 'robe_wide':
        return [sh('cloth', c1, TORSO_ARMS, 0.004, 0.004, 0.85, minw=0.5), shoes(lt), robe(c2, 0.08, 0.9, hem=0.015)], []
    if key == 'robe_short':
        return [sh('cloth', c2, TORSO_ARMS, 0.004, 0.004, 0.85, minw=0.5), sh('cloth_pants', c3, ['thigh_*', 'calf_*'], 0.004, 0.004, 0.85, minw=0.5),
                shoes(lt), robe(c1, 0.12, 0.35, length=0.6)], []
    if key == 'tunic':
        return [sh('cloth', c1, TORSO_ARMS, 0.004, 0.004, 0.85, minw=0.5), sh('cloth_pants', c3, ['thigh_*', 'calf_*'], 0.004, 0.004, 0.85, minw=0.5),
                boots(lt, 0.25), robe(c1, 0.14, 0.3, length=0.45)], []
    if key == 'toga':
        return [shoes(lt), robe(c1, 0.10, 0.45, hem=0.03),
                sh('cloth_sash', c2, ['spine_03', 'clavicle_l', 'upperarm_l'], 0.02, 0.006, 0.85, z=[0.7, 0.84], minw=0.4)], []
    if key == 'hoplite':
        return [sh('metal', mt, ['spine_01', 'spine_02', 'spine_03', 'pelvis'], 0.016, 0.006, 0.4, z=[0.5, 0.8]),
                sh('metal', mt, ['calf_*'], 0.012, 0.005, 0.4, z=[0.06, 0.27], minw=0.6),
                sh('leather', lt, ['lowerarm_*'], 0.01, 0.004, 0.7, minw=0.7), shoes(lt),
                {'part': 'loincloth', 'color': c1, 'length': 0.45}], []
    if key == 'samurai':
        return [sh('cloth', c1, BODY, 0.004, 0.004, 0.9, minw=0.5), sh('leather', lt, HANDS, 0.006, 0.004, 0.7, minw=0.3), boots(lt),
                sh('leather_lacquer', c2, ['spine_01', 'spine_02', 'spine_03'], 0.02, 0.006, 0.4, z=[0.52, 0.8]),
                sh('leather_lacquer', c2, ['upperarm_*', 'clavicle_*'], 0.036, 0.008, 0.4, z=[0.70, 0.84], minw=0.4),
                sh('leather_lacquer', c2, ['calf_*'], 0.016, 0.005, 0.4, z=[0.12, 0.27], minw=0.7),
                {'part': 'loincloth', 'color': c2, 'length': 0.55}], []
    if key == 'royal':
        return [sh('cloth', c2, TORSO_ARMS, 0.004, 0.004, 0.85, minw=0.5), shoes(lt), robe(c1, 0.1, 0.75, hem=0.015),
                sh('metal_gold', gold, ['clavicle_*', 'upperarm_*', 'spine_03'], 0.02, 0.006, 0.3, z=[0.79, 0.85], minw=0.4)], []
    if key == 'royal_f':
        return [sh('cloth', c2, TORSO_ARMS, 0.004, 0.004, 0.85, minw=0.5), shoes(lt), robe(c1, 0.1, 0.85, hem=0.0),
                sh('metal_gold', gold, ['clavicle_*', 'spine_03'], 0.012, 0.005, 0.3, z=[0.78, 0.83], minw=0.4)], []
    if key == 'nomad':
        return [sh('cloth', c1, TORSO_ARMS, 0.004, 0.004, 0.85, minw=0.5), sh('cloth_pants', c3, ['thigh_*', 'calf_*'], 0.004, 0.004, 0.85, minw=0.5),
                boots(lt, 0.3), robe(c1, 0.12, 0.35, length=0.8),
                sh('cloth_fur', c2, ['clavicle_*', 'upperarm_*', 'spine_03'], 0.03, 0.015, 0.95, z=[0.74, 0.85], minw=0.4)], []
    if key == 'tribal':
        return [{'part': 'loincloth', 'color': lt, 'length': 0.5},
                sh('leather', lt, ['lowerarm_*'], 0.01, 0.004, 0.7, minw=0.7),
                sh('leather', lt, ['calf_*'], 0.01, 0.004, 0.7, z=[0.1, 0.2], minw=0.7),
                sh('cloth_fur', c2, ['clavicle_*', 'spine_03'], 0.02, 0.01, 0.95, z=[0.76, 0.83], minw=0.4)], []
    if key == 'uniform':
        return [sh('cloth', c1, BODY, 0.004, 0.004, 0.85, minw=0.5), sh('leather_glove', c3, HANDS, 0.006, 0.004, 0.8, minw=0.3),
                boots('#141414', 0.27), robe(c1, 0.14, 0.3, length=0.5),
                sh('metal_gold', gold, ['clavicle_*', 'upperarm_*'], 0.018, 0.008, 0.3, z=[0.8, 0.845], minw=0.4)], []
    if key == 'monk':
        return [sh('cloth', c1, ['spine_0*', 'clavicle_*', 'upperarm_*'], 0.004, 0.004, 0.9, minw=0.5), shoes(lt), robe(c1, 0.12, 0.35, hem=0.04)], []
    if key == 'ninja':
        return [sh('cloth', c1, BODY, 0.004, 0.004, 0.9, minw=0.5), sh('leather', lt, HANDS + FEET, 0.006, 0.004, 0.7, minw=0.3)], []
    if key == 'dress':
        return [sh('cloth', c2, TORSO_ARMS, 0.004, 0.004, 0.85, minw=0.5), shoes(lt), robe(c1, 0.12, 0.6, hem=0.03)], []
    if key == 'court':
        return [sh('cloth', c1, TORSO_ARMS, 0.004, 0.004, 0.85, minw=0.5), shoes(lt), robe(c2, 0.08, 1.0, hem=0.0)], []
    if key == 'skirt':
        return [sh('cloth', c2, TORSO_ARMS, 0.004, 0.004, 0.85, minw=0.5), shoes(lt), robe(c1, 0.2, 0.45, length=0.8)], []
    if key == 'dancer':
        return [sh('cloth', c2, ['spine_02', 'spine_03', 'clavicle_*'], 0.004, 0.004, 0.8, z=[0.62, 0.82], minw=0.5), shoes(lt),
                robe(c1, 0.3, 0.8, hem=0.02)], []
    if key in ('suit', 'worksuit', 'casualsuit'):
        return [], None  # 성별 따라 MakeHuman 옷(아래 make)
    raise KeyError(key)


MH_CLOTHES = {('suit', False): ['male_elegantsuit01', 'shoes02'], ('worksuit', False): ['male_worksuit01', 'shoes05'],
              ('casualsuit', False): ['male_casualsuit03', 'shoes01'], ('suit', True): ['female_elegantsuit01', 'shoes03'],
              ('worksuit', True): ['female_casualsuit01', 'shoes03'], ('casualsuit', True): ['female_casualsuit02', 'shoes01']}
HAIRS = ['short01', 'short02', 'short03', 'short04', 'long01', 'ponytail01', 'braid01', 'bob01', 'bob02', 'afro01']


def head_parts(key, c3, mt, gold, fur):
    """머리 → (머리카락 에셋 또는 None, kitbash 부품)."""
    if key in HAIRS:
        return key, []
    if key == 'bald':
        return None, []
    if key == 'cap':        # 관·복건 — 이마 위 정수리까지
        return None, [sh('cloth_cap', c3, ['head'], 0.012, 0.006, 0.8, z_eye=[0.035, 0.3], minw=0.5)]
    if key == 'helmet':
        return None, [sh('metal', mt, ['head'], 0.012, 0.006, 0.35, open_face=True, minw=0.5)]
    if key == 'hood':
        return None, [sh('cloth_hood', c3, ['head', 'neck_01'], 0.01, 0.005, 0.9, open_face=True, minw=0.5)]
    if key == 'turban':
        return None, [sh('cloth_turban', '#e6e0d0', ['head'], 0.035, 0.03, 0.9, z_eye=[0.02, 0.3], minw=0.5)]
    if key == 'furhat':
        return None, [sh('cloth_fur', fur, ['head'], 0.03, 0.02, 0.95, z_eye=[0.03, 0.3], minw=0.5)]
    if key == 'band':       # 짧은 머리 위 머리띠
        return 'short04', [sh('cloth_band', c3, ['head'], 0.02, 0.006, 0.8, z_eye=[0.035, 0.085], minw=0.5)]
    if key == 'crown':      # 짧은 머리 위 금관 띠
        return 'short01', [sh('metal_gold', gold, ['head'], 0.024, 0.012, 0.3, z_eye=[0.04, 0.1], minw=0.5)]
    if key == 'crown_long':
        return 'long01', [sh('metal_gold', gold, ['head'], 0.024, 0.01, 0.3, z_eye=[0.04, 0.09], minw=0.5)]
    raise KeyError(key)


# ---- 진짜 옷(README §7 단계 4 ③) — 공방이 지은 옷(garments.py, 세력 색 변형)과 CC0 MakeHuman 옷 ----
# 맞는 옷이 없는 틀은 None → 껍데기(outfit_parts) 그대로. 옷 틀(축)은 바꾸지 않는다 — 입히는 재료만 바꾼다.
EAST_REG = ('kr', 'sg', 'jp')
CLOTH_SHOES, BOOTS = 'toigo_mj_cloth_shoes', 'rehmanpolanski_viking_boots'


def lum(c):
    r, g, b = (int(c.lstrip('#')[i:i + 2], 16) / 255 for i in (0, 2, 4))
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def mix(a, b, f):
    pa, pb = ([int(c.lstrip('#')[i:i + 2], 16) for i in (0, 2, 4)] for c in (a, b))
    return '#' + ''.join(f'{round(x * (1 - f) + y * f):02x}' for x, y in zip(pa, pb))


TRIM = ['#5a2a6a', '#8a2a24', '#2a3a7a', '#2f5a3a', '#9a7a2a', '#3a2a1e']


STRONG_ROLES = ('warrior', 'general', 'samurai', 'ronin', 'hoplite', 'tribal', 'nomad', 'khan', 'warrior_f', 'officer')


# 예쁜 쪽으로 기운 기본 얼굴(MakeHuman 얼굴 모프) — 사람마다 다른 건 아래 안전한 축의 작은 변주가 만든다.
FACE_BASE = {'eye-scale-incr': 0.3, 'eye-height2-incr': 0.12, 'eye-bag-decr': 0.4,
             'nose-hump-decr': 0.35, 'nose-scale-horiz-decr': 0.25, 'nose-flaring-decr': 0.2, 'nose-volume-decr': 0.15,
             'cheek-bones-incr': 0.15, 'cheek-volume-decr': 0.15, 'ear-scale-decr': 0.2, 'mouth-angles-up': 0.15,
             'eyebrows-angle-up': 0.12}
FACE_BASE_F = {'mouth-lowerlip-volume-incr': 0.3, 'chin-width-decr': 0.25, 'chin-prominent-decr': 0.15, 'eye-corner1-up': 0.2}
FACE_BASE_M = {'chin-width-incr': 0.1, 'eye-corner1-up': 0.1}
FACE_BASE_STRONG = {'chin-width-incr': 0.25, 'cheek-bones-incr': 0.2}
# 변주 축 — 어느 쪽으로 밀어도 흉하지 않은 것만(코 혹·콧방울·눈 밑 주머니·귀·턱 내밀기·볼살은 뺐다, 눈썹 각·눈꼬리는 내려가면 화나 보여 뺐다)
FACE_VARY = [('nose-scale-vert-decr', 'nose-scale-vert-incr'), ('nose-point-down', 'nose-point-up'),
             ('mouth-scale-horiz-decr', 'mouth-scale-horiz-incr'), ('mouth-upperlip-height-decr', 'mouth-upperlip-height-incr'),
             ('chin-height-decr', 'chin-height-incr'), ('eye-trans-down', 'eye-trans-up'),
             ('eyebrows-trans-down', 'eyebrows-trans-up'),
             ('forehead-scale-vert-decr', 'forehead-scale-vert-incr')]
HEAD_SHAPES_FINE = ['head-oval', 'head-oval', 'head-round', 'head-diamond', 'head-invertedtriangular']


def _fadd(t, n, v):
    """반대 방향이 이미 있으면 상쇄해 한쪽만 남긴다(같은 축 incr·decr 를 함께 걸지 않는다)."""
    opp = n.replace('incr', 'decr') if 'incr' in n else n.replace('decr', 'incr')
    cur = t.pop(opp, 0.0) * -1 if opp in t else 0.0
    net = t.get(n, 0.0) + v + cur
    if net >= 0:
        t[n] = round(min(net, 0.7), 3)
    else:
        t[opp] = round(min(-net, 0.7), 3)


def face_targets(hid, role, female):
    """인물마다 얼굴 — 예쁜 쪽 기본값(눈 크게·코 곱게·턱 갸름·눈 밑 주머니 없음)에 안전한 변주 축 다섯을 해시로 ±0.12~0.35.
    무장은 턱·광대를 굵게. 머리형은 계란·둥근·다이아·역삼각(무장 남자는 네모도)."""
    import hashlib
    b = hashlib.sha256(('face:' + hid).encode()).digest()
    t = {}
    for n, v in FACE_BASE.items():
        _fadd(t, n, v)
    for n, v in (FACE_BASE_F if female else FACE_BASE_M).items():
        _fadd(t, n, v)
    strong = role in STRONG_ROLES and not female
    if strong:
        for n, v in FACE_BASE_STRONG.items():
            _fadd(t, n, v)
    used = set()
    for i in range(5):
        k = b[i] % len(FACE_VARY)
        while k in used:
            k = (k + 1) % len(FACE_VARY)
        used.add(k)
        v = 0.12 + 0.23 * b[9 + i] / 255
        _fadd(t, FACE_VARY[k][b[18 + i] & 1], v)
    shapes = HEAD_SHAPES_FINE + (['head-square'] if strong else [])
    t[shapes[b[27] % len(shapes)]] = round(0.25 + 0.3 * b[28] / 255, 3)
    return t


# 긴 머리 열한 명이 한 모양(long01)이었다(09-28) — CC0 커뮤니티 머리(mh_hair01, 항목마다 CC0 확인)로 흩는다
LONG_ALT = ['long01', 'o4saken_long01', 'elvs_french_braid_variation', 'elvs_reverse_french_braid_bun', 'rehmanpolanski_hair_bun_brown']
EYE_EAST = ['brown', 'brownlight', 'brown']
EYE_WEST = ['brownlight', 'brown', 'green', 'bluegreen', 'blue', 'grey', 'brownlight']
HAIR_EAST = ['#1a1512', '#211812', '#2a1f18']
HAIR_WEST = ['#2a1f18', '#4a3322', '#6a4428', '#7a3a22', '=#b89868', '=#8a6a48']


def hair_tint(reg, age, hs):
    """머리 색 — 동쪽 세 나라 검정~짙은 밤색, 서쪽·세계 밤색·적갈·금발, 나이 들면 희끗(염색 = 무늬는 두고 색만)."""
    if age >= 0.72:
        return '=#9a968e' if (hs >> 13) & 1 else '=#b8b4ac'
    return pick(HAIR_EAST if reg in EAST_REG else HAIR_WEST, hs, 6)


def vary(c, h):
    """같은 세력 사람이 같은 한 색으로 서지 않게(09-28 인물 105 렌더 — 토가 셋·관복 넷이 머리만 달랐다) — 해시로 밝기 ±18%·색상 ±10°."""
    import colorsys
    r, g, b = (int(c.lstrip('#')[i:i + 2], 16) / 255 for i in (0, 2, 4))
    hh, ll, ss = colorsys.rgb_to_hls(r, g, b)
    hh = (hh + ((h >> 5) % 21 - 10) / 360) % 1.0
    ll = min(0.95, max(0.05, ll * (0.82 + 0.36 * ((h >> 11) % 100) / 99)))
    r, g, b = colorsys.hls_to_rgb(hh, ll, ss)
    return '#' + ''.join(f'{round(x * 255):02x}' for x in (r, g, b))


def vivid(c):
    """끈·술처럼 옻칠·검은 바탕 위에 보여야 하는 색 — 너무 어두우면 밝힌다."""
    return c if lum(c) > 0.2 else mix(c, '#b8a47a', 0.55)


def cf(gid, *cols):
    """공방 옷 이름과 garments.py 에 줄 인자 — 색을 주면 변형(cf_<id>_<헥스>…)."""
    cs = [c.lstrip('#').lower() for c in cols]
    return 'cf_' + gid + ''.join('_' + c for c in cs), gid + ('@' + ','.join(cs) if cs else '')


def real_outfit(reg, role, key, female, c1, c2, c3, hs=0):
    """옷 틀 → (옷 이름들, garments.py 인자들) 또는 None."""
    east = reg in EAST_REG
    light = lum(c1) > 0.6
    if east:
        if key == 'samurai':
            o = [cf('gusoku', vivid(c1), c3)]
        elif key == 'lamellar':
            o = [cf('chalgap', c1 if not light else '#7a2a24')]
        elif key == 'robe_armored':
            o = [cf('samguk_armor', c1 if not light else '#2f4a7a')]
        elif key == 'robe_long':
            o = [cf('dallyeong', c1 if not light else '#8a2a2a', c3 if lum(c3) < 0.3 and not light else '#2a3a6a')]
        elif key == 'robe_wide':
            o = [cf('dopo', c1, c3) if light else cf('dopo', c2 if lum(c2) > 0.6 else '#e9e4d6', c1)]
        elif key == 'royal':
            o = [cf('dallyeong', c1, c1)] if reg == 'jp' else [cf('gonryongpo', c1 if not light else '#a8282a')]
        elif key in ('court', 'dress', 'dancer', 'royal_f', 'skirt'):
            if reg == 'jp':
                o = [cf('kimono', c1 if not light else '#7a2a4a', '#e2b85a' if key in ('royal_f', 'court') else c2)]
            elif role == 'student':
                o = [cf('hanbok_f', '#1a1a1c', '#f4f1e8')]
            else:
                o = [cf('hanbok_f', c1 if not light else '#a8323a', '#efd98c' if key in ('royal_f', 'dancer') else c2 if lum(c2) > 0.5 else '#e9e4d6')]
        elif key == 'robe_short' and reg == 'jp':
            o = [cf('hakama', '#e6dfcc', c1 if not light else '#2a3450')]
        elif key == 'robe_short':
            o = [cf('baji_jeogori', '#e6dfcc', c1 if lum(c1) < 0.45 else '#6b5a48')]
        elif key == 'uniform':
            o = [cf('officer_coat', c1 if not light else '#2a3450')]
        elif key == 'leather':
            o = [cf('warrior_robe', c1 if not light else '#8a2f2a')]
        elif key == 'ninja':
            o = [cf('shinobi', c1 if lum(c1) < 0.15 else '#1e1e24')]
        elif key == 'tunic' and reg == 'kr':   # robe_short(바지저고리)와 가르는 덧옷
            o = [cf('baeja', c1 if not light else '#3a4a6a')]
        elif key == 'tunic' and reg == 'jp':
            o = [cf('kamishimo', c1 if not light else '#2a3450')]
        elif key == 'monk':
            return ['donitz_monk_robe', CLOTH_SHOES], []
        else:
            return None
        names, specs = [n for n, _ in o], [s for _, s in o]
        armored = key in ('samurai', 'lamellar', 'robe_armored', 'leather')
        return names + [BOOTS if armored else CLOTH_SHOES], specs
    o, shoes = None, CLOTH_SHOES
    if key == 'toga':
        o, shoes = cf('toga', c1 if light else pick(LIGHT, hs, 2), pick(TRIM, hs, 3) if light else c1), 'shoes01'
    elif key == 'hoplite':
        o, shoes = cf('chiton_armor', c1 if not light else '#8a2a24'), 'shoes01'
    elif key == 'nomad':
        o, shoes = cf('deel', c1 if not light else '#3a5a8a', '#c9a64a', '#b0282a'), BOOTS
    elif key == 'uniform':
        o, shoes = cf('officer_coat', c1 if not light else '#2a3450'), BOOTS
    elif key in ('royal_f', 'court', 'dress'):
        o, shoes = cf('gown', c1 if not light else '#6a2a3a', '#e2c070'), 'toigo_ballet_flats'
    elif key in ('lamellar', 'robe_armored'):
        o, shoes = cf('hauberk', c1 if light else '#e8e2d0', c1 if not light else '#2a3a7a'), BOOTS
    elif key == 'robe_short':
        o, shoes = (cf('qaba', c1 if not light else '#3a5a6a'), 'shoes02') if reg == 'wd' else (cf('doublet', c1 if not light else '#5a3a2a'), BOOTS)
    elif key in ('robe_wide', 'robe_long', 'royal'):
        o, shoes = cf('kaftan', c1 if not light else '#2a6a4a', '#c9a64a' if key == 'royal' else '#d8d0bc'), 'shoes02'
    if o:
        return [o[0], shoes], [o[1]]
    if key == 'leather':
        return ['rehmanpolanski_viking_tunic', 'rehmanpolanski_viking_pants', BOOTS], []
    if key == 'tunic':
        return ['wdg_mycenaean_tunic', BOOTS], []
    if key == 'monk':
        return ['donitz_monk_robe', CLOTH_SHOES], []
    return None


MODERN = ('suit', 'worksuit', 'casualsuit', 'uniform')


def real_head(reg, role, key, c1, outfit=None, female=False, age=0.5):
    """머리 → (머리카락 또는 None, 옷 이름들, garments.py 인자들) 또는 None.
    동쪽 옛 남자의 짧은 머리(short01~04)는 머리카락 메시 대신 빗어 올린 머리 + 상투(한국 망건·삼국 속발·일본 존마게) — 근대 옷·부족은 그대로."""
    if reg not in EAST_REG:
        if key == 'helmet':
            return None, ['grinsegold_corinthian_helmet' if role == 'hoplite' else 'javherre_casco_caballero_templario_templar_knight_helmet'], []
        if key == 'turban':
            o = cf('turban')
            return None, [o[0]], [o[1]]
        return None
    if key == 'helmet':
        o = {'kr': cf('helmet_east'), 'sg': cf('helmet_general'), 'jp': cf('kabuto', vivid(c1))}[reg]
    elif key == 'cap':
        if reg == 'kr':
            o = cf('gat') if role in ('scholar', 'healer', 'strategist', 'traveler', 'artist', 'monk') else cf('samo')
        else:
            o = {'sg': cf('boktu'), 'jp': cf('eboshi')}[reg]
    elif key == 'crown':
        o = {'kr': cf('ikseongwan'), 'sg': cf('myeollyugwan'), 'jp': cf('eboshi')}[reg]
    elif key.startswith('short') and not female and outfit not in MODERN and outfit != 'tribal':
        gid = {'kr': 'sangtu', 'sg': 'sangtu_bun', 'jp': 'chonmage'}[reg]
        o = cf(gid, '#77736c') if age >= 0.75 else cf(gid)   # 늙은이는 센머리
    else:
        return None
    return None, [o[0]], [o[1]]


def skin_of(race, age, female):
    eth = max(race, key=race.get)
    band = 'young' if age < 0.62 else 'middleage' if age < 0.76 else 'old'   # 젊은 피부는 주름이 없다(09-29 입가 주름이 "못생겼다"의 한몫)
    name = f"{band}_{eth}_{'female' if female else 'male'}"
    return f'{name}/{name}.mhmat'


def axes_of(r):
    a = r['axes']
    return (a['height'], a['build'], a['head'], a['outfit'])


def shape_diff(a, b):
    return sum(x != y for x, y in zip(a, b))


def assign(heroes):
    chosen, used_o, used_h, used_k, used_b = [], {}, {}, {}, {}
    for h in heroes:
        role = ROLE[h['id']]
        outs, heads, ks, bs, _age, _arms = ROLES[role]
        if h['era'] != 'World':  # 터번·털 두루마기 길손은 서역 몫 — 동쪽 세 시대 길손은 도포·관
            heads = [x for x in heads if x != 'turban']
            if role == 'traveler':
                outs = ['robe_short', 'tunic', 'nomad']
        if h['might'] >= 92 and role not in ('king', 'sultan', 'khan'):
            bs = [2, 3] + [b for b in bs if b not in (2, 3)]
        best = None
        for (io, o), (ih, hd), (ik, k), (ib, b) in itertools.product(enumerate(outs), enumerate(heads), enumerate(ks), enumerate(bs)):
            ax = (k, b, hd, o)
            if any(shape_diff(ax, c) < 2 for c in chosen):
                continue
            cost = io * 3 + ih * 2 + ik * 1.2 + ib * 1.5 + used_o.get(o, 0) / 5 + used_h.get(hd, 0) / 5 \
                + used_k.get(k, 0) / 25 + used_b.get(b, 0) / 25 + ((fnv(h['id'] + o + hd) % 97) / 1000)
            if best is None or cost < best[0]:
                best = (cost, ax)
        if best is None:
            sys.exit(f"{h['id']}: 네 축 중 둘 이상 다른 조합이 없다 — 역할 {role} 선호를 늘릴 것")
        ax = best[1]
        chosen.append(ax)
        for d, v in zip((used_k, used_b, used_h, used_o), ax):
            d[v] = d.get(v, 0) + 1
        h['axes'] = {'height': ax[0], 'build': ax[1], 'head': ax[2], 'outfit': ax[3]}
    return heroes


def make(h):
    role = ROLE[h['id']]
    _o, _hd, _k, _b, (a0, a1), arms = ROLES[role]
    hs = fnv(h['id'])
    age = round(a0 + (a1 - a0) * ((hs % 1000) / 999), 3)
    if 0.5 < age < 0.66:  # 사실 얼굴은 서른 넘으면 금세 늙어 보인다(09-29 "못생겼다") — 중년 언저리는 25~32세 쪽으로 당긴다, 노인 역할은 그대로
        age = round(0.5 + (age - 0.5) * 0.55, 3)
    if h['id'] == 'sg_huangzhong':  # 늙은 명궁 — 무장이지만 노인
        age = 0.78
    female = h['female']
    race = REGION[h['faction']]
    muscle, weight = BUILD[h['axes']['build']]
    if female:
        muscle = round(muscle * 0.75, 3)
    c1 = vary(FACTION_COLOR.get(h['faction'], pick(DARK, hs)), hs)
    c2 = pick(LIGHT, hs, 1) if role in ('king', 'sultan', 'khan', 'queen', 'lady', 'court', 'dancer', 'student', 'roman') else pick(DARK, hs, 1)
    if c1 in LIGHT or c1.lower() in ('#e8e2d0', '#e6e0d0', '#e0dccc'):
        c2 = pick(DARK, hs, 1)
    c3 = pick(DARK, hs, 2)
    lt = pick(LEATHER, hs, 3)
    mt = BRONZE if h['era'] == 'World' and role in ('hoplite', 'roman', 'tribal') else STEEL
    gold = GOLD
    fur = pick(FUR, hs, 4)
    parts, mh = outfit_parts(h['axes']['outfit'], c1, c2, c3, lt, mt, gold)
    if mh is None:
        mh = MH_CLOTHES[(h['axes']['outfit'], female)]
    else:
        mh = []
    hair, hparts = head_parts(h['axes']['head'], c3, mt, gold, fur)
    reg, specs = h['id'][:2], []
    ro = real_outfit(reg, role, h['axes']['outfit'], female, c1, c2, c3, hs)
    if ro:                     # 진짜 옷이 있는 틀 — 껍데기 옷을 빼고 옷 메시로
        parts, mh = [], list(ro[0])
        specs += ro[1]
    rh = real_head(reg, role, h['axes']['head'], c1, h['axes']['outfit'], female, age)
    if rh:
        hair, hparts = rh[0], []
        mh = mh + rh[1]
        specs += rh[2]
    r = {
        'id': 'hero_' + h['id'],
        '_note': f"단계 4 도감 인물 몸 — saga-unity GO 도감 id {h['id']}(가명 {h['name']}) 자리 후보. 역할 {role}·{h['faction']}·★{h['rarity']}. "
                 f"gen_hero_recipes.py 가 쓴다(손으로 고치지 말 것 — 생성기를 고친다). 게임 몸 교체는 사용자 판정 뒤.",
        'axes': h['axes'],
        'height_target_m': HEIGHT_M[female][h['axes']['height']],
        'macro': {'gender': 0.0 if female else 1.0, 'age': age, 'muscle': muscle, 'weight': weight, 'height': 0.5,
                  'proportions': 0.8 if female else 0.7, 'race': race},
        'skin': skin_of(race, age, female),
        'eyes': 'high-poly/high-poly.mhclo',
        'eye_color': pick(EYE_EAST if reg in EAST_REG else EYE_WEST, hs, 4),
        'mouth_close': 0.003,   # 자체 셰이프키 — 벌어진 기본 입을 다문다(build_real.mouth_close)
        'makeup': ({'lip': 0.75, 'blush': 0.7, 'lid': 0.4} if female else {'lip': 0.3, 'blush': 0.15, 'lid': 0.15}),
        'eyebrows': f"eyebrow{(hs >> 5) % 12 + 1:03d}/eyebrow{(hs >> 5) % 12 + 1:03d}.mhclo",
        'eyelashes': ('eyelashes02/eyelashes02.mhclo' if (hs >> 9) & 1 else 'eyelashes04/eyelashes04.mhclo') if female
        else ('eyelashes01/eyelashes01.mhclo' if (hs >> 9) & 1 else 'eyelashes03/eyelashes03.mhclo'),
        'teeth': 'teeth_base/teeth_base.mhclo',
        'targets': face_targets(h['id'], role, female),
    }
    if hair:
        if hair == 'long01':
            hair = LONG_ALT[__import__('hashlib').sha256(('hair:' + h['id']).encode()).digest()[0] % len(LONG_ALT)]   # fnv 비트는 다섯 칸에 몰렸다
        r['hair'] = f'{hair}/{hair}.mhclo'
        r.setdefault('tints', {})['hair'] = hair_tint(reg, age, hs)
    if specs:
        r['_garments'] = specs   # garments.py 로 먼저 지을 공방 옷(--garments 가 모아 준다)
    if mh:
        r['clothes'] = [f'{c}/{c}.mhclo' for c in mh]
    kb = parts + hparts
    if kb:
        r['kitbash'] = kb
    # 진짜 옷(긴 옷자락·갑옷 치마)은 Sword_Idle 의 넓은 다리를 따라 부푼다 — 발을 모은 자체 대기(keyframes.py)
    r['anims'] = {'idle': ('CF_Guard_Idle_Loop' if ro else 'Sword_Idle') if arms else 'Idle_Loop', 'walk': 'Walk_Loop', 'run': 'Jog_Fwd_Loop',
                  'attack': 'Sword_Attack' if arms else 'Spell_Simple_Shoot', 'hit': 'Hit_Chest', 'death': 'Death01',
                  'kneel': 'CF_Kneel_Loop'}
    return r


def check(recipes):
    bad = 0
    for i, a in enumerate(recipes):
        for b in recipes[:i]:
            if shape_diff(axes_of(a), axes_of(b)) < 2:
                print('SAME', a['id'], b['id'], axes_of(a))
                bad += 1
    cnt = lambda k: len({r['axes'][k] for r in recipes})
    print(f"HERO_RECIPES {len(recipes)} · 두 축 미만 쌍 {bad} · 키 {cnt('height')}칸 · 체격 {cnt('build')}칸 · 머리 {cnt('head')}가지 · 옷 {cnt('outfit')}가지")
    return bad == 0


def main():
    if '--garments' in sys.argv:   # 105 레시피가 쓰는 공방 옷 인자 — garments.py -- $(…) 로 넘긴다
        heroes = assign(load_heroes())
        print(' '.join(sorted({g for h in heroes for g in make(h).get('_garments', [])})))
        return
    if '--check' in sys.argv:
        rs = [json.load(open(os.path.join(OUT, f), encoding='utf-8')) for f in sorted(os.listdir(OUT)) if f.endswith('.json')]
        sys.exit(0 if check(rs) else 1)
    heroes = load_heroes()
    missing = [h['id'] for h in heroes if h['id'] not in ROLE]
    if missing or len(heroes) != 105:
        sys.exit(f'도감 {len(heroes)}명 · 역할 없음 {missing}')
    assign(heroes)
    os.makedirs(OUT, exist_ok=True)
    rs = []
    for h in heroes:
        r = make(h)
        p = os.path.join(OUT, r['id'] + '.json')
        if os.path.exists(p):  # 보정한 키 값은 이어 받는다(같은 목표 키일 때만)
            old = json.load(open(p, encoding='utf-8'))
            if old.get('height_target_m') == r['height_target_m'] and old.get('macro', {}).get('age') == r['macro']['age'] \
                    and old['macro'].get('muscle') == r['macro']['muscle'] and old['macro'].get('weight') == r['macro']['weight']:
                r['macro']['height'] = old['macro'].get('height', 0.5)
        txt = json.dumps(r, ensure_ascii=False, indent=1) + '\n'
        with open(p, 'w', encoding='utf-8', newline='\n') as f:
            f.write(txt)
        rs.append(r)
    for r in rs:
        a = r['axes']
        print(f"{r['id']:<24} 키{a['height']} {BUILD_NAME[a['build']]:<2} {a['head']:<11} {a['outfit']}")
    sys.exit(0 if check(rs) else 1)


if __name__ == '__main__':
    main()
