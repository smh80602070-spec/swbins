"""번역 표에 빠진 키 훑기 (PLAN.md 67~69 Localization).

코드에 `XxxLocalization.T("키", "한국어")` 로만 있고 `Games/SagaXxx/Resources/Localization/xxx_{ko,en}.json`
에 없는 키를 판별로 센다. 에디터 빌더가 넘기는 `"키", "한국어"` 짝과 표 데이터의 `NameKey = "..", NameKo = ".."`
짝도 잡는다. 키가 뒤에 오거나(버튼 빌더) 따로 선언된 폴백(`string key = ...`)은 못 잡는다 — 손으로 본다.

사용: py tools/loc-missing.py [빠진키.json]   (saga-unity 폴더에서)
"""
import glob
import json
import os
import re
import sys

root = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'Assets')
games = {'Go': 'go', 'Dungeon': 'dungeon', 'Forest': 'forest', 'Story': 'story', 'Realm': 'realm'}
lit = r'"((?:[^"\\]|\\.)*)"'
KEY = re.compile(r'^[a-z][a-z0-9_]*(\.[a-z0-9_]+)+$')
HANGUL = re.compile(r'[가-힣]')


def unesc(s):
    return s.replace('\\n', '\n').replace('\\"', '"').replace('\\\\', '\\')


def game_of(path):
    rel = os.path.relpath(path, root)
    for g in games:
        if rel.startswith(os.path.join('Games', 'Saga' + g)):
            return g
    base = os.path.basename(path)
    for g in games:
        if g in base:
            return g
    for mark, g in (('TestVillageForest', 'Forest'), ('TestVillage', 'Go'), ('TestField', 'Story'), ('TestCity', 'Realm')):
        if mark in base:
            return g
    return None


def main():
    files = glob.glob(os.path.join(root, '**', '*.cs'), recursive=True)
    pair = re.compile(lit + r'\s*,\s*' + lit)
    kv = re.compile(r'(\w*)Key\s*=\s*' + lit + r'\s*,\s*\1Ko\s*=\s*' + lit)
    found = {g: {} for g in games}
    for f in files:
        s = open(f, encoding='utf-8-sig').read()
        for g in games:
            for m in re.finditer(g + r'Localization\.T\(\s*' + lit + r'\s*,\s*' + lit + r'\s*\)', s):
                found[g].setdefault(m.group(1), unesc(m.group(2)))
        g0 = game_of(f)
        if g0 is None:
            continue
        for m in pair.finditer(s):
            if s[max(0, m.start() - 5):m.start()] == 'Pick(':
                continue   # GoStory.Pick("k", a, b) 는 k.a·k.b 를 읽는다(U-0210 오탐)
            if KEY.match(m.group(1)) and HANGUL.search(m.group(2)):
                found[g0].setdefault(m.group(1), unesc(m.group(2)))
        for m in kv.finditer(s):
            if KEY.match(m.group(2)):   # Key = "normal" 같은 한 낱말 id 는 앞붙이("mode."+Key)로 읽는다(U-0210 오탐)
                found[g0].setdefault(m.group(2), unesc(m.group(3)))

    out, total = {}, 0
    for g, name in games.items():
        tbl = {}
        for lang in ('ko', 'en'):
            p = os.path.join(root, 'Games', 'Saga' + g, 'Resources', 'Localization', f'{name}_{lang}.json')
            tbl[lang] = {e['key'] for e in json.load(open(p, encoding='utf-8-sig'))['entries']}
        miss = {k: v for k, v in found[g].items() if k not in tbl['ko'] or k not in tbl['en']}
        out[name] = miss
        total += len(miss)
        print(f'{name}: 빠진 키 {len(miss)}')
    if len(sys.argv) > 1:
        json.dump(out, open(sys.argv[1], 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    return 1 if total else 0


if __name__ == '__main__':
    sys.exit(main())
