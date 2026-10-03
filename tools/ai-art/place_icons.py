"""아이템 아이콘을 정본 폴더 saga-assets/icons/ 에 놓는다(K-0035 ⑤) — 그림·출처(.license.json)·map.json.
  py tools/ai-art/place_icons.py [--out saga-assets/icons]
읽는 것: data/icon_plan.json · _out/icons_pack_all/(icon_pack.py 결과) · _out/icons_all/<키>.license.json(gen.py 출력)
놓는 것(멱등 — 다시 돌려도 같은 파일):
  icon128/<키>_g<등급>.png  등급 틀까지 합친 합성본(웹이 쓴다)   icon64/…  줄인 것
  content/<키>.png           알맹이만(투명) — 등급이 바뀌는 곳(무기 희귀도)에서 틀을 따로 얹을 때
  frames/grade0~4.png        등급 틀 128px
  license/<키>.license.json  항목마다 출처(AI = gen.py 기록, 코드 생성 = icon_pack.py CC0)
  map.json                   "<판>:<종류>:<id>" → {key, grade, mode, name} (판·종류 이름은 인벤토리와 같다 — 사가고 특산물·성유물처럼 id 가 겹쳐서 종류까지 넣는다)
이름 정책: 표시 글자(name)는 각 판 데이터의 가명 그대로 읽어 온다 — 여기서 새로 짓지 않는다.
"""
import datetime
import json
import os
import shutil
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
out = os.path.join(ROOT, 'saga-assets', 'icons')
if '--out' in sys.argv:
    out = os.path.abspath(sys.argv[sys.argv.index('--out') + 1])
PACK = os.path.join(HERE, '_out', 'icons_pack_all')
GEN = os.path.join(HERE, '_out', 'icons_all')
plan = json.load(open(os.path.join(HERE, 'data', 'icon_plan.json'), encoding='utf-8'))
report = json.load(open(os.path.join(PACK, 'report.json'), encoding='utf-8'))
today = datetime.date.today().isoformat()

for d in ('icon128', 'icon64', 'content', 'frames', 'license'):
    os.makedirs(os.path.join(out, d), exist_ok=True)

# 코드로 만든 것(룬 글리프·염색 견본)의 등급은 계획표 entries 에 있다
grade_of, mode_of = {}, {}
for it in plan['items']:
    grade_of[it['id']] = it['grade']
    mode_of[it['id']] = 'ai'
for e in plan['entries']:
    if e['mode'] in ('glyph', 'color'):
        grade_of[e['key']] = e.get('grade', 0)
        mode_of[e['key']] = e['mode']

missing = []
for key, g in sorted(grade_of.items()):
    if not report.get(key, {}).get('ok', False):
        # 검사 실패도 놓는다(사용자 판정 때 확인) — 목록만 남긴다
        pass
    for src, dst in (('icon', 'icon128'), ('icon64', 'icon64')):
        s = os.path.join(PACK, src, '%s_g%d.png' % (key, g))
        if not os.path.exists(s):
            missing.append(s)
            continue
        shutil.copyfile(s, os.path.join(out, dst, '%s_g%d.png' % (key, g)))
    s = os.path.join(PACK, 'content', key + '.png')
    if os.path.exists(s):
        shutil.copyfile(s, os.path.join(out, 'content', key + '.png'))
    else:
        missing.append(s)
    if mode_of[key] == 'ai':
        lic = json.load(open(os.path.join(GEN, key + '.license.json'), encoding='utf-8'))
        lic['id'] = key
        lic['placed_by'] = 'tools/ai-art/place_icons.py'
    else:
        lic = {'id': key, 'generator': 'tools/ai-art/icon_pack.py', 'model': 'none',
               'license': 'CC0-1.0 (코드 생성 — 글꼴 글리프·색 견본, 외부 그림 없음)', 'date': today,
               'note': '룬은 한자 글자(Batang)를 돌 조각에 얹은 것, 염색은 게임 데이터 색(#rrggbb)으로 그린 천 견본.'}
    json.dump(lic, open(os.path.join(out, 'license', key + '.license.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
for g in range(5):
    shutil.copyfile(os.path.join(PACK, 'frames', 'grade%d.png' % g), os.path.join(out, 'frames', 'grade%d.png' % g))

# 고돗·유니티 무기 열여섯의 표시 이름(인벤토리는 개수만 읽는다) — saga-godot data/weapons.gd 와 같다
WN = {'w_sword_0': '수련용 목검', 'w_claymore_0': '수련용 목도', 'w_polearm_0': '수련용 장대', 'w_catalyst_0': '수련용 서첩', 'w_bow_0': '수련용 단궁',
      'w_sword_3': '청동 환도', 'w_claymore_3': '나무꾼 큰도끼', 'w_polearm_3': '대나무 창', 'w_catalyst_3': '해진 서책', 'w_bow_3': '사냥꾼 활',
      'w_sword_4': '청하 보검', 'w_claymore_4': '파도 참마도', 'w_polearm_4': '봉수 월도', 'w_catalyst_4': '별자리 두루마리', 'w_bow_4': '갯바람 각궁',
      'w_polearm_catch': '갯바람 작살'}
mp = {}
for e in plan['entries']:
    if not e['name']:
        e['name'] = WN.get(e['id'], e['id'])
    k = '%s:%s:%s' % (e['game'], e['kind'], e['id'])
    while k in mp:      # 같은 종류 안에서도 id 가 겹치는 것(사가의숲 옷 'none' 둘 — 머리·염색)은 #2 를 붙인다
        k += '#2'
    if e['mode'] == 'skip':
        mp[k] = {'mode': 'skip', 'name': e['name']}
        continue
    key = e['key']
    mp[k] = {'key': key, 'grade': grade_of[key], 'mode': e['mode'], 'name': e['name']}
doc = {'note': 'tools/ai-art/place_icons.py 가 만든 표 — 손으로 고치지 않는다. K-0035. 키 = 그림 한 장(같은 물건은 한 키를 함께 쓴다), skip = 상태 값이라 그림 없음.',
       'date': today, 'size': {'icon128': 128, 'icon64': 64}, 'grades': {'0': '보통', '1': '마법', '2': '희귀', '3': '세트', '4': '유니크'},
       'counts': {'entries': len(mp), 'keys': len(grade_of), 'skip': sum(1 for v in mp.values() if v['mode'] == 'skip')},
       'entries': mp}
json.dump(doc, open(os.path.join(out, 'map.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
bad = sorted(k for k, v in report.items() if not v['ok'])
print('놓음 %d키 · 항목 %d · 빠진 파일 %d · 점검 실패(놓긴 함) %s' % (len(grade_of), len(mp), len(missing), bad))
sys.exit(1 if missing else 0)
