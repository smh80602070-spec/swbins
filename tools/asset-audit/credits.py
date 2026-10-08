"""
크레딧·라이선스 모음 자동 생성(K-0038) — 손으로 쓰지 않는다. 읽기만 하고 saga-assets/ 에 두 파일을 쓴다.

    py tools/asset-audit/credits.py            # saga-assets/credits.json · CREDITS.md 를 다시 쓴다
    py tools/asset-audit/credits.py --check    # 쓰지 않고 검사만(종료 코드 1 = FAIL)

모으는 곳
  1. 산출마다 옆에 있는 `*.license.json`(git 추적분 + saga-assets/) — 도구·모델·라이선스로 묶는다
  2. `tools/char-forge/data/vroid_licenses.json` — VRoid 샘플 이용 조건(`creditNotation: required` 는 표기 필수)
  3. 판별 `ASSET_LICENSES.md` 다섯 + godot·unity `ASSET_GUIDE.md` — 절(##)마다 라이선스 낱말을 찾고,
     `> © **이름**, [CC-BY 3.0](…)` 꼴 표기 줄은 그대로 "필수 표기" 로 뽑는다. 낱말을 못 찾은 절은 숨기지 않고 "미상" 으로 올린다.

--check 가 FAIL 하는 것: 라이선스 칸이 비었거나 비상업(NC)·`commercial_use:false` 인 .license.json ·
  AI 모델(`model` 칸)로 만든 그림인데 라이선스가 "CC0 코드로 그림" · 표기 필수 출처(VRoid 샘플·CC-BY 표기 줄)가 있는데
  필수 표기가 하나도 안 뽑힘 · **저장된 credits.json 이 지금 계산과 어긋남**(묶음·필수 표기·VRoid 가 하나라도 빠짐 — K-0088,
  개수만 다르면 경고). 미상 절은 경고만(폐기·설명 절이 섞여 있다).
VRoid 는 표(`vroid_licenses.json`)가 아니라 **배치된 실제 VRM 메타**(`saga-assets/characters/vroid/*.glb`)로 표기 필수·개작 조건을 본다(K-0088).
게임 안 크레딧 화면은 각 갈래가 credits.json 을 읽어 그린다 — 여기선 데이터만.
"""
import glob
import json
import os
import re
import struct
import subprocess
import sys
from collections import OrderedDict

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
OUT_JSON = os.path.join(ROOT, 'saga-assets', 'credits.json')
OUT_MD = os.path.join(ROOT, 'saga-assets', 'CREDITS.md')
VROID = os.path.join(ROOT, 'tools', 'char-forge', 'data', 'vroid_licenses.json')
VROID_PLACED = os.path.join(ROOT, 'saga-assets', 'characters', 'vroid')
OWN_AUTHOR = re.compile(r'saga', re.I)      # 이 저장소에서 직접 만든 VRoid(작가 칸 saga-godot 등) — 표기 대상 아님
DOCS = ['saga-web/saga-%s/assets/ASSET_LICENSES.md' % g for g in ('go', 'dungeon', 'forest', 'story', 'realm')] + \
       ['saga-godot/docs/ASSET_GUIDE.md', 'saga-unity/docs/ASSET_GUIDE.md']

NC = re.compile(r'non-?commercial|\bBY-NC|비상업', re.I)
# 절 안에서 찾는 라이선스 낱말(앞 것이 먼저 맞는다)
LIC_WORDS = [('CC-BY-SA', r'CC[- ]?BY[- ]?SA'), ('CC-BY', r'CC[- ]?BY\b'), ('CC0', r'CC0|Poly Haven|ambientCG|Public Domain'),
             ('OFL', r'\bOFL\b|SIL Open Font'), ('MIT', r'\bMIT\b'), ('Apache-2.0', r'Apache[- ]2'), ('OpenRAIL', r'OpenRAIL'),
             ('Kenney(CC0)', r'Kenney'), ('Mixamo', r'Mixamo'), ('GPL', r'\bGPL')]
CREDIT = re.compile(r'©\s*([^,.;(<]{2,60}?)\s*[,.]\s*(CC[- ]?BY[- ]?[0-9.]*[0-9])(?:\s*<([^>]+)>)?', re.I)
ATTR_LINE = re.compile(r'^\s*>\s*(.*©.*)$')
LINK = re.compile(r'\[([^\]]+)\]\(([^)]+)\)')


def git_files(pat):
    r = subprocess.run(['git', 'ls-files', pat], cwd=ROOT, capture_output=True, text=True, encoding='utf-8')
    return [x for x in r.stdout.split('\n') if x]


def license_jsons():
    fs = set(git_files('*.license.json'))
    for dp, _, fns in os.walk(os.path.join(ROOT, 'saga-assets')):
        for f in fns:
            if f.endswith('.license.json'):
                fs.add(os.path.relpath(os.path.join(dp, f), ROOT).replace('\\', '/'))
    return sorted(fs)


def collect_json():
    groups = OrderedDict()
    problems = []
    for rel in license_jsons():
        try:
            d = json.load(open(os.path.join(ROOT, rel), encoding='utf-8'))
        except Exception as e:  # noqa: BLE001
            problems.append((rel, '읽기 실패: %s' % e))
            continue
        lic = str(d.get('license') or d.get('model_license') or '').strip()
        tool = str(d.get('generator') or d.get('tool') or '미상')
        tool = os.path.basename(tool) if '/' in tool else tool
        model = str(d.get('model') or '')
        if not lic:
            problems.append((rel, '라이선스 칸 비어 있음'))
            continue
        if NC.search(lic) or d.get('commercial_use') is False:
            problems.append((rel, '비상업 라이선스: %s' % lic[:60]))
        if model not in ('', 'none', '-') and re.search(r'CC0', lic) and re.search(r'코드', lic):
            problems.append((rel, 'AI 모델(%s) 그림인데 라이선스가 "CC0 코드로 그림"' % model[:30]))
        key = (tool, model, lic)
        g = groups.setdefault(key, {'tool': tool, 'model': model, 'license': lic, 'count': 0, 'where': set()})
        g['count'] += 1
        g['where'].add(rel.rsplit('/', 1)[0])
    out = []
    for g in groups.values():
        g['where'] = sorted(g['where'])[:6]
        out.append(g)
    return out, problems


def collect_vroid():
    if not os.path.exists(VROID):
        return None
    ms = json.load(open(VROID, encoding='utf-8')).get('models', {})
    used, req = [], []
    for k, v in ms.items():
        m = v.get('meta', {})
        if m.get('modification') == 'allowModificationRedistribution' and m.get('allowRedistribution') is True \
                and m.get('commercialUsage') in ('personalProfit', 'corporation'):
            used.append(k)
            if m.get('creditNotation') == 'required':
                req.append({'model': m.get('name') or k, 'authors': m.get('authors')})
    restricted = []
    for p in sorted(glob.glob(os.path.join(VROID_PLACED, '*.glb'))):
        m = vrm_meta(p)
        if not m:
            continue
        name = m.get('name') or os.path.splitext(os.path.basename(p))[0]
        authors = m.get('authors') or ([m['author']] if m.get('author') else [])
        if any(OWN_AUTHOR.search(a or '') for a in authors):
            continue
        if m.get('creditNotation') == 'required' and not any(r['model'] == name for r in req):
            req.append({'model': name, 'authors': authors})
        if m.get('modification') != 'allowModificationRedistribution':
            restricted.append({'model': name, 'file': os.path.basename(p), 'modification': m.get('modification')})
    return {'models': sorted(used), 'credit_required': req, 'restricted': restricted,
            'note': 'VRM 이용 조건상 상업·개작본 재배포 허용인 샘플(대부분 pixiv VRoid Project). 직접 만든 모델은 표에 있어도 만든 이 본인 것. '
                    'restricted = 배치된 VRM 메타가 개작본 재배포를 허용하지 않음 — 원본 그대로만 쓴다(조합·변주 재료 금지).'}


def vrm_meta(path):
    """GLB 머리 JSON 만 읽어 VRM 메타(1.0 VRMC_vrm.meta 또는 0.x VRM.meta)."""
    try:
        with open(path, 'rb') as f:
            h = f.read(20)
            n = struct.unpack('<I', h[12:16])[0]
            j = json.loads(f.read(n))
    except Exception:  # noqa: BLE001
        return None
    e = j.get('extensions', {})
    return (e.get('VRMC_vrm') or {}).get('meta') or (e.get('VRM') or {}).get('meta')


def collect_docs():
    attrs, sections, unknown, review = OrderedDict(), [], [], OrderedDict()
    for rel in DOCS:
        p = os.path.join(ROOT, rel)
        if not os.path.exists(p):
            continue
        lines = open(p, encoding='utf-8').read().split('\n')
        head, body = None, []

        def flush():
            if head is None:
                return
            txt = '\n'.join(body)
            found = [name for name, rx in LIC_WORDS if re.search(rx, txt, re.I)]
            row = {'doc': rel, 'section': head, 'licenses': found}
            sections.append(row)
            if not found:
                unknown.append(row)
        for ln in lines:
            if re.match(r'^#{2,3} ', ln):
                flush()
                head, body = ln.lstrip('#').strip(), []
            else:
                body.append(ln)
            if ln.startswith('|'):
                cells = [c.replace('**', '').replace('`', '').strip() for c in ln.strip().strip('|').split('|')]
                for ci, c in enumerate(cells):
                    lm = re.match(r'(CC[- ]?BY[- ]?[0-9.]*[0-9]?)', c, re.I)
                    if lm and ci >= 1 and not NC.search(c) and not re.match(r'CC[- ]?BY[- ]?SA', c, re.I):
                        author = cells[ci - 1]
                        if re.match(r'(poly\.pizza|https?:)', author) and ci >= 2:
                            author = cells[ci - 2]
                        lic = re.sub(r'^CC[- ]?BY[- ]?', 'CC-BY ', lm.group(1).upper()).strip()
                        if '/' in author or '.glb' in author or author in ('라이선스', '만든 이') or author == cells[0] or \
                                any('라이선스' in x for x in cells[:ci]):
                            review.setdefault(ln.strip()[:140], set()).add(rel)
                            break
                        at = attrs.setdefault((author, lic), {'author': author, 'license': lic, 'url': '', 'titles': set(), 'where': set()})
                        at['titles'].add(cells[0])
                        at['where'].add(rel)
                        break
            m = ATTR_LINE.match(ln)
            if m and re.search(r'CC[- ]?BY|licenses/by', m.group(1), re.I):
                t = LINK.sub(lambda x: '%s <%s>' % (x.group(1), x.group(2)), m.group(1)).replace('**', '').strip()
                mm = CREDIT.search(t)
                if mm:
                    title = t[:t.index('©')].strip(' —-:')
                    key = (mm.group(1).strip(), mm.group(2).strip())
                    a = attrs.setdefault(key, {'author': key[0], 'license': key[1], 'url': mm.group(3) or '', 'titles': set(), 'where': set()})
                    if title:
                        a['titles'].add(title)
                    a['where'].add(rel)
                else:
                    review.setdefault(t[:140], set()).add(rel)
        flush()
    out = [{'author': a['author'], 'license': a['license'], 'url': a['url'], 'titles': sorted(a['titles']), 'where': sorted(a['where'])}
           for a in attrs.values()]
    return out, [{'text': t, 'where': sorted(w)} for t, w in review.items()], sections, unknown


def build():
    groups, problems = collect_json()
    vroid = collect_vroid()
    attrs, review, sections, unknown = collect_docs()
    cc = {}
    for s in sections:
        for l in s['licenses']:
            cc[l] = cc.get(l, 0) + 1
    data = OrderedDict([
        ('note', 'tools/asset-audit/credits.py 가 자동 생성 — 손으로 고치지 않는다. 게임 크레딧 화면은 attributions(필수 표기)·groups 를 읽는다.'),
        ('attributions', attrs),
        ('attributions_review', review),
        ('vroid', vroid),
        ('groups', groups),
        ('doc_sections', {'total': len(sections), 'by_license': cc, 'unknown': unknown}),
    ])
    fails = ['%s — %s' % p for p in problems]
    needs = bool(vroid and vroid['credit_required']) or any('CC-BY' in s['licenses'] for s in sections)
    if needs and not attrs and not (vroid and vroid['credit_required']):
        fails.append('CC-BY 절이 있는데 필수 표기 줄이 하나도 안 뽑힘')
    return data, fails


def stale(data):
    """저장된 credits.json 과 지금 계산 비교 — 빠진 것은 FAIL, 개수만 다르면 경고."""
    if not os.path.exists(OUT_JSON):
        return ['credits.json 없음'], []
    old = json.load(open(OUT_JSON, encoding='utf-8'))
    fails, warns = [], []
    og = {(g['tool'], g['model'], g['license']): g['count'] for g in old.get('groups', [])}
    for g in data['groups']:
        k = (g['tool'], g['model'], g['license'])
        if k not in og:
            fails.append('credits.json 에 묶음 없음: %s · %s · %s (%d개)' % (k[0], k[1] or '-', k[2][:50], g['count']))
        elif og[k] != g['count']:
            warns.append('개수 다름 %s %s: %d → %d' % (k[0], k[1] or '-', og[k], g['count']))
    oa = {(a['author'], a['license']) for a in old.get('attributions', [])}
    for a in data['attributions']:
        if (a['author'], a['license']) not in oa:
            fails.append('credits.json 에 필수 표기 없음: © %s, %s' % (a['author'], a['license']))
    ov = {r['model'] for r in (old.get('vroid') or {}).get('credit_required', [])}
    for r in (data['vroid'] or {}).get('credit_required', []):
        if r['model'] not in ov:
            fails.append('credits.json 에 VRoid 표기 없음: %s' % r['model'])
    if fails:
        fails.append('→ py tools/asset-audit/credits.py 로 다시 만든다')
    return fails, warns


def to_md(d):
    L = ['# 크레딧·라이선스', '', '> `tools/asset-audit/credits.py` 가 자동 생성한다. 손으로 고치지 않는다.', '']
    L += ['## 필수 표기 (저작자 표시)', '']
    if d['vroid'] and d['vroid']['credit_required']:
        for r in d['vroid']['credit_required']:
            L.append('- %s — %s (VRM `creditNotation: required`)' % (r['model'], ', '.join(r['authors'] or [])))
    for a in d['attributions']:
        L.append('- © %s, %s%s%s' % (a['author'], a['license'], ' <%s>' % a['url'] if a['url'] else '',
                                     ' — ' + ', '.join(a['titles']) if a['titles'] else ''))
    if len(L) == 6:
        L.append('- (없음)')
    if d['attributions_review']:
        L += ['', '### 사람이 확인할 표기 줄(자동으로 이름·라이선스를 못 가름)', '']
        L += ['- %s' % r['text'] for r in d['attributions_review']]
    L += ['', '## 만든 방식·모델별 묶음', '', '| 도구 | 모델 | 라이선스 | 개수 |', '|---|---|---|---|']
    for g in d['groups']:
        L.append('| %s | %s | %s | %d |' % (g['tool'], g['model'] or '-', g['license'].replace('|', '/')[:90], g['count']))
    if d['vroid']:
        L += ['', '## VRoid 샘플', '', '%d벌 사용(개작본 재배포 허용·상업 허용). %s' % (len(d['vroid']['models']), d['vroid']['note'])]
        for r in d['vroid'].get('restricted', []):
            L.append('- 원본 그대로만: %s (`%s`, modification `%s`)' % (r['model'], r['file'], r['modification']))
    s = d['doc_sections']
    L += ['', '## 출처 문서(ASSET_LICENSES·ASSET_GUIDE) 요약', '', '절 %d개 — 라이선스 낱말별: %s' % (
        s['total'], ', '.join('%s %d' % kv for kv in sorted(s['by_license'].items(), key=lambda x: -x[1]))),
        '낱말을 못 찾은 절(미상) %d개 — `credits.json` 의 `doc_sections.unknown` 참고.' % len(s['unknown']), '']
    return '\n'.join(L)


def main():
    data, fails = build()
    check = '--check' in sys.argv
    if not check:
        os.makedirs(os.path.dirname(OUT_JSON), exist_ok=True)
        with open(OUT_JSON, 'w', encoding='utf-8', newline='\n') as f:
            json.dump(data, f, ensure_ascii=False, indent=1)
            f.write('\n')
        with open(OUT_MD, 'w', encoding='utf-8', newline='\n') as f:
            f.write(to_md(data) + '\n')
    s = data['doc_sections']
    print('필수 표기 %d줄 · 묶음 %d · VRoid %s벌 · 문서 절 %d(미상 %d)' % (
        len(data['attributions']), len(data['groups']), len(data['vroid']['models']) if data['vroid'] else '-', s['total'], len(s['unknown'])))
    if check:
        sf, sw = stale(data)
        fails += sf
        if sw:
            print('경고 credits.json 개수 다름 %d묶음(다시 만들면 맞음) — 예: %s' % (len(sw), sw[0]))
    for x in fails:
        print('FAIL', x)
    if check and not fails:
        print('credits OK')
    return 1 if fails else 0


if __name__ == '__main__':
    sys.exit(main())
