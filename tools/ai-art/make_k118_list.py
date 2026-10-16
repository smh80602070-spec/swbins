"""UI 아이콘 목록 (K-0118) — 판 데이터를 읽어 prompt_kit 입력 둘을 만든다(읽기만, 손으로 주제를 새로 짓지 않고 이모지·한자·효과에서 조립).

    py tools/ai-art/make_k118_list.py      → tools/ai-art/data/k118_ui_icons.json(전체 표) · batches/k118_ui_in.json(후보 4) · batches/k118_skill_in.json(후보 2)

키: ui_<lucide>(독·☰·도구줄 28) · job_dg_<직업>(2나락 5)·job_st_<직업>(4종횡 21) · map_<뜻>(5천하 지도 표식 5) · sk_dg_<스킬>(2나락 120)·sk_st_<스킬>(4종횡 104).
주제 = 이모지 모티프(EMOJI) + 한자 이름의 원소(ELEMENT) + 효과 모양(SHAPE) + 직업 무기(WEAPON). 실명·원작 이름은 안 쓴다(표시 이름은 기록용 subject_ko 에만).
"""
import json
import os
import re
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))

UI = {  # Lucide 28 — 자리 뜻(독·☰·도구줄) → 그림 주제
    'award': 'award rosette ribbon, gold medal center', 'backpack': 'leather backpack, buckles', 'book-open': 'open old book, pages',
    'bot': 'small round robot head, antenna', 'box': 'wooden crate, iron corners', 'circle-question-mark': 'question mark sign, round wooden plaque',
    'clipboard-list': 'clipboard with checklist paper', 'coins': 'stack of gold coins', 'compass': 'brass compass, needle',
    'ellipsis': 'three round golden beads in a row', 'flag': 'small red flag on pole', 'footprints': 'pair of footprints in sand',
    'ham': 'roasted meat on bone', 'hammer': 'blacksmith hammer', 'mail': 'sealed envelope, red wax seal', 'map': 'folded paper map, red route line',
    'medal': 'medal with ribbon', 'palette': 'painter palette, brush', 'rotate-ccw': 'curved circular arrow symbol',
    'satellite-dish': 'satellite dish antenna', 'scroll': 'rolled paper scroll, wooden rods', 'scroll-text': 'open paper scroll with writing',
    'sparkles': 'sparkling stars, glitter', 'store': 'small market stall, striped awning', 'swords': 'two crossed swords',
    'user': 'hooded cloak on wooden mannequin bust', 'wrench': 'iron wrench', 'x': 'red cross mark x symbol',
}
MAP = {'battle': 'two crossed swords, battle marker', 'port': 'iron anchor, rope', 'camp': 'canvas army tent, small flag',
       'guard': 'round shield, fortress emblem', 'flag': 'red war banner on spear pole'}
EMOJI = {  # 이모지 → 그림 모티프(영어 태그)
    '🎯': 'bullseye target pierced', '🏹': 'bow and arrow', '🌧️': 'rain of arrows from sky', '🔥': 'flames', '❄️': 'snowflake ice crystal',
    '⚡': 'lightning bolt', '👁️': 'hawk eye glowing', '📏': 'long bow', '💨': 'gust of wind trail', '🌀': 'whirlwind spiral',
    '🔨': 'heavy war hammer', '💥': 'explosion burst', '🦘': 'leaping motion arc', '🔺': 'red rage aura', '🛡️': 'shield', '⚔️': 'crossed swords',
    '🩸': 'blood drop', '🌋': 'volcano eruption', '☄️': 'falling meteor', '🧊': 'ice block shards', '🌊': 'water wave', '🧠': 'glowing crystal mind orb',
    '🚩': 'red war flag', '🎌': 'crossed war banners', '✊': 'armored gauntlet fist', '⭕': 'glowing energy ring', '🌿': 'healing herb leaves',
    '☯️': 'yin yang symbol', '☯': 'yin yang symbol', '🧱': 'stone brick wall', '👑': 'golden crown', '👥': 'two shadow silhouettes, mirror image',
    '💀': 'skull', '🗿': 'clay golem statue', '🕸️': 'spider web binding', '🐛': 'poison caterpillar', '☠️': 'skull and crossbones poison',
    '🔮': 'crystal ball', '✨': 'sparkles', '🔗': 'chain links', '🧪': 'poison vial', '💢': 'cracked impact mark', '👊': 'gauntlet punch',
    '🪭': 'folding fan', '👻': 'ghost wisp', '🕯️': 'candle flame', '🥋': 'staff spin', '🏃': 'winged boots', '🦅': 'hawk', '🐕': 'war hound',
    '💗': 'glowing heart', '💚': 'green glowing heart', '📛': 'roaring tiger emblem', '🦠': 'plague spores', '🟣': 'violet energy orb',
    '🛰️': 'satellite', '🕳️': 'black hole vortex', '📡': 'antenna signal waves', '⚰️': 'coffin', '⛈️': 'thunder storm cloud', '➶': 'arrow',
    '🌌': 'starry galaxy', '🌑': 'dark moon', '🌞': 'blazing sun', '🌠': 'shooting star', '🌩️': 'lightning cloud', '🌪️': 'tornado',
    '🌫️': 'mist fog', '🌱': 'sprout', '🌸': 'cherry blossoms', '🌺': 'red flower', '🎆': 'fireworks', '🎇': 'sparkler burst', '🎏': 'carp streamer',
    '🎴': 'flower playing card', '🏵️': 'rosette emblem', '🐎': 'galloping horse', '👣': 'footprints', '💠': 'diamond crystal', '💫': 'dizzy stars',
    '📣': 'war horn', '📿': 'prayer beads', '🔪': 'throwing knife', '🔭': 'telescope', '🔵': 'blue energy orb', '🕶️': 'shadow mask',
    '🗡️': 'dagger', '🚪': 'spirit gate door', '🦵': 'spinning kick motion arc', '🧧': 'red paper talisman', '🧿': 'evil eye amulet',
    '🫥': 'fading dotted outline', '🚶': 'walking staff, straw sandals', '🥷': 'shadow mask, kunai', '🎖️': 'military medal', '🧙': 'wizard hat, staff',
    '🔱': 'trident', '🌈': 'rainbow arc', '🪐': 'ringed planet', '🔆': 'bright light',
}
ELEMENT = [  # 한자 → 원소 꼬리표(앞 것이 먼저)
    (r'電子|粒子|量子|衛星|特異|次元|電磁|光速|幽靈信號|幻影', 'futuristic violet neon energy, sci-fi'),
    (r'[火炎焰爆]', 'fire, burning'), (r'[氷冰寒霜]', 'ice, frost'), (r'[雷霹]', 'lightning, electric sparks'),
    (r'[毒蠱疫]', 'green poison mist'), (r'[魂靈鬼陰幽冥]', 'ghostly blue spirit flame'), (r'[氣]', 'golden qi aura'),
    (r'[風旋扇]', 'swirling wind'), (r'[星天日月光]', 'radiant starlight'),
]
SHAPE = {  # 효과 → 구도
    'bolt': 'flying projectile, motion streak', 'arrow': 'flying projectile, motion streak', 'volley': 'several projectiles spread',
    'nova': 'radial burst ring, shockwave', 'aoe': 'radial burst ring, shockwave', 'rain': 'falling from above, many streaks',
    'swing': 'crescent slash arc', 'melee': 'crescent slash arc', 'chain': 'energy arcs jumping between points',
    'dash': 'speed lines, forward dash trail', 'summon': 'summoning circle glowing', 'curse': 'dark binding sigil',
    'heal': 'soft healing light, sparkles', 'buff': 'rising aura, upward glow', 'passive': 'round emblem medallion',
}
DG_WEAPON = {'a': 'arrow', 'w': 'sword', 's': 'paper talisman', 'm': 'spear', 'y': 'paper talisman'}
ST_LINE = {  # 4종횡 직업 → 무기
    'none': 'sword', 'warrior': 'sword', 'general': 'sword', 'marshal': 'spear', 'warlord': 'halberd', 'godwar': 'halberd',
    'archer': 'arrow', 'sniper': 'arrow', 'flier': 'arrow', 'falcon': 'arrow', 'skybow': 'arrow',
    'rogue': 'throwing knife', 'assassin': 'throwing knife', 'wraith': 'throwing knife', 'reaper': 'throwing knife', 'noshadow': 'throwing knife',
    'mage': 'paper talisman', 'sage': 'paper talisman', 'immortal': 'paper talisman', 'ascendant': 'paper talisman', 'voidsage': 'paper talisman',
}


def load():
    js = r"""
global.window=global; global.DG={}; require('./saga-web/saga-dungeon/js/data-skill.js'); require('./saga-web/saga-story/js/data-job.js');
const sd=DG.skillData, jd=DG.jobData, arr=x=>Array.isArray(x)?x:Object.values(x);
console.log(JSON.stringify({dg_skills:sd.SKILLS.map(s=>({id:s.key,name:s.name,emoji:s.emoji,shape:s.shape})),
 dg_classes:sd.CLASSES.map(c=>({id:c.key,name:c.name,emoji:c.emoji})),
 st_jobs:arr(jd.JOBS).map(j=>({id:j.key,name:j.name,emoji:j.emoji})),
 st_skills:arr(jd.SKILLS).map(s=>({id:s.key,job:s.job,name:s.name,emoji:s.emoji,shape:s.effect}))}));"""
    return json.loads(subprocess.run(['node', '-e', js], cwd=ROOT, capture_output=True, check=True).stdout.decode('utf-8'))


def motif(e, miss):
    if e not in EMOJI:
        miss.add(e)
    return EMOJI.get(e, 'glowing emblem')


def element(name):
    h = re.search(r'\(([^)]*)\)', name or '')
    h = h.group(1) if h else (name or '')
    for pat, tag in ELEMENT:
        if re.search(pat, h):
            return tag
    return ''


def skill_subject(m, shape, weapon, el):
    """모티프 먼저(첫 태그 가중), 그다음 무기·원소·모양 — 무기가 모티프와 같은 말이면 뺀다"""
    parts = [m]
    if weapon and weapon.split()[-1] not in m and shape not in ('passive', 'buff', 'heal', 'summon', 'curse'):
        parts.append(weapon)
    if el:
        parts.append(el)
    parts.append(SHAPE.get(shape, 'glowing emblem'))
    return ', '.join(parts) + ', magic skill icon'


def main():
    d = load()
    miss = set()
    ui, sk = [], []
    for k, v in UI.items():
        ui.append({'id': 'ui_' + k.replace('-', '_'), 'subject': v, 'extra': 'simple bold shape, minimal detail, readable at small size',
                   'subject_ko': f'Lucide {k} 자리', 'group': 'ui', 'game': 'shared', 'kind': 'ui', 'src': k, 'name': k})
    for k, v in MAP.items():
        ui.append({'id': 'map_' + k, 'subject': v, 'extra': 'simple bold shape, minimal detail', 'subject_ko': f'5천하 지도 표식 {k}', 'group': 'mapmark', 'game': 'saga-realm', 'kind': 'mapmark', 'src': k, 'name': k})
    for c in d['dg_classes']:
        ui.append({'id': 'job_dg_' + c['id'], 'subject': motif(c['emoji'], miss) + ', class emblem, ornate badge', 'subject_ko': f"2나락 직업 {c['name']}", 'group': 'job', 'game': 'saga-dungeon', 'kind': 'job', 'src': c['id'], 'name': c['name']})
    for j in d['st_jobs']:
        ui.append({'id': 'job_st_' + j['id'], 'subject': motif(j['emoji'], miss) + ', class emblem, ornate badge', 'subject_ko': f"4종횡 직업 {j['name']}", 'group': 'job', 'game': 'saga-story', 'kind': 'job', 'src': j['id'], 'name': j['name']})
    for s in d['dg_skills']:
        w = DG_WEAPON.get(s['id'].split('_')[0], '')
        sk.append({'id': 'sk_dg_' + s['id'], 'subject': skill_subject(motif(s['emoji'], miss), s['shape'], w, element(s['name'])),
                   'subject_ko': f"2나락 스킬 {s['name']}", 'group': 'skill', 'game': 'saga-dungeon', 'kind': 'skill', 'src': s['id'], 'name': s['name']})
    for s in d['st_skills']:
        w = ST_LINE.get(s['job'], '')
        sk.append({'id': 'sk_st_' + s['id'], 'subject': skill_subject(motif(s['emoji'], miss), s['shape'], w, element(s['name'])),
                   'subject_ko': f"4종횡 스킬 {s['name']}", 'group': 'skill', 'game': 'saga-story', 'kind': 'skill', 'src': s['id'], 'name': s['name']})
    ids = [x['id'] for x in ui + sk]
    assert len(ids) == len(set(ids)), 'id 겹침'
    json.dump({'note': 'K-0118 UI 아이콘 목록 — make_k118_list.py 가 판 데이터에서 만든다(손으로 고치지 않음)', 'count': len(ids),
               'items': ui + sk}, open(os.path.join(HERE, 'data', 'k118_ui_icons.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    for name, items, nv in (('k118_ui', ui, 4), ('k118_skill', sk, 2)):
        json.dump({'name': name, 'out': name, 'spec': 'icon', 'style': 'C', 'model': 'animagine-xl-4.0-opt', 'variants': nv,
                   'items': [{k: v for k, v in it.items() if k not in ('group', 'game', 'kind', 'src', 'name')} for it in items]},
                  open(os.path.join(HERE, 'batches', name + '_in.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print(f'K-0118 목록 {len(ids)} (ui·지도·직업 {len(ui)} · 스킬 {len(sk)}) · 모르는 이모지 {len(miss)}: {" ".join(sorted(miss))}')


if __name__ == '__main__':
    main()
