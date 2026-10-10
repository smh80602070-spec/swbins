"""명단 299명 조합표 — 인물마다 (몸 샘플, 상의·하의·신발 출처 샘플) 을 겹치지 않게 정한다(K-0024).

    py tools/char-forge/outfit_swap_plan.py            # data/outfit_swap_plan.json 을 쓴다
    py tools/char-forge/outfit_swap_plan.py --check    # 겹침·조각 존재·몸 원래 옷 그대로가 아닌지 검사만

- 조각 목록은 `_out/parts/<샘플>/parts.json`(export_parts_all.sh). 슬롯: top · bottom · shoes · cloth(원피스: 상·하의 대신).
- 성별은 명단에 없어 id 해시로 정한다(근거 없는 값). 풀은 unity_bodies_plan 과 같다.
- K-0078: `data/hero_traits.json` 에 성별이 있는 인물(도감 105)은 그 성별을 따른다. 해시 성별과 같으면 줄 그대로,
  다르면 그 사람만 맞는 풀에서 몸(덜 쓰인 것)·옷을 다시 고른다 — 나머지 줄은 안 바뀐다(다시 굽기를 바뀐 사람만).
- 같은 샘플 풀 안에서만 섞는다(남자 몸에 치마 원피스가 가지 않게). 시드 고정 → 다시 돌려도 같다.
- K-0028(명단 500): **저장된 줄은 고정**, 명단에 새로 든 사람만 덧붙인다(줄 순서·시드가 흔들려 기존 299명이 바뀌지 않게,
  `--check` 가 첫 299 줄 지문 K24_MD5 를 본다). 새 줄 — 성별 = 초상과 같은 해시(K-0027 make_late_i2i_batch 'k27g:'),
  몸 = 그 풀에서 가장 덜 쓰인 것, 옷 = 인물 씨앗, 무늬 = `saga-assets/patterns` 64종을 차례로 한 칸(원피스면 cloth, 아니면 top)에.
  새 샘플 a2·a3·a6~a10(VRoid 이용 조건 허용판, 여자 몸) — a7·a8·a10 은 상의 조각 하나가 드레스 전체라 원피스(cloth)로 다룬다.
"""
import json, os, sys, random, hashlib

HERE = os.path.dirname(os.path.abspath(__file__))
PARTS = os.path.join(HERE, '_out', 'parts')
FEMALE = list('abdefhijkmoqsuwy') + ['a2', 'a3', 'a6', 'a7', 'a8', 'a9', 'a10']   # K-0028 새 샘플(a1=e·a4=s·a5=h 와 조각이 같아 뺌)
DRESS_TOP = {'a7', 'a8', 'a10'}      # 하의 없는 드레스 — 상의 칸 대신 원피스 칸
MALE = list('cglnprvxz')              # t 는 재배포 불가라 뺀다
OUT = os.path.join(HERE, 'data', 'outfit_swap_plan.json')
TRAITS = os.path.join(HERE, 'data', 'hero_traits.json')
PATTERNS = os.path.join(HERE, '..', '..', 'saga-assets', 'patterns')
K24_N, K24_MD5 = 299, '2a12b23badc00813c0b67207d293075e'     # K-0024 299명 조합표 지문(이미 구운 몸 — 바뀌면 안 된다)


def h8(s):
    return int(hashlib.md5(s.encode()).hexdigest()[:8], 16)


def fingerprint(rows):
    return hashlib.md5(json.dumps(rows, sort_keys=True, ensure_ascii=False).encode()).hexdigest()


def patterns():
    return sorted(f[:-5] for f in os.listdir(PATTERNS) if f.endswith('.webp'))


def load_parts():
    d = {}
    for L in FEMALE + MALE:
        p = os.path.join(PARTS, L, 'parts.json')
        if not os.path.exists(p):
            continue
        pj = json.load(open(p, encoding='utf-8'))
        items = pj if isinstance(pj, list) else pj.get('parts', pj)
        slots = {}
        for it in items:
            if it.get('slot') in ('top', 'bottom', 'shoes', 'cloth'):
                slots.setdefault(it['slot'], []).append(it['file'])
        if L in DRESS_TOP and 'top' in slots:
            slots['cloth'] = slots.pop('top')     # outfit_swap 은 cloth 칸이면 그 샘플의 top·bottom·cloth 조각을 다 입힌다
        d[L] = slots
    return d


def build():
    """저장된 조합표 줄은 그대로 두고 명단에 새로 든 사람만 덧붙인다(K-0028). 조합표가 없으면 처음부터(K-0024 방식)."""
    parts = load_parts()
    if not os.path.exists(OUT):
        return build_k24(parts)
    roster = json.load(open(os.path.join(HERE, 'data', 'roster.json'), encoding='utf-8'))['heroes']
    rows = json.load(open(OUT, encoding='utf-8'))['entries']
    have = {r['id'] for r in rows}
    used = {(r['body'], tuple(sorted(r['kit'].items()))) for r in rows}
    n = {}
    for r in rows:
        n[r['body']] = n.get(r['body'], 0) + 1
    pats = patterns()
    k = sum(1 for r in rows if 'pattern' in r)
    for h in roster:
        if h['id'] in have:
            continue
        g = 'F' if h8('k27g:' + h['id']) % 100 < 45 else 'M'      # 초상(K-0027)과 같은 성별
        pool = [L for L in (MALE if g == 'M' else FEMALE) if L in parts]
        rng = random.Random(h8('k28:' + h['id']))
        body = min(pool, key=lambda L: (n.get(L, 0), rng.random()))
        kit = pick_kit(rng, g, pool, parts, body, used)
        if kit is None:
            raise SystemExit('조합을 못 찾음: ' + h['id'])
        used.add((body, tuple(sorted(kit.items()))))
        n[body] = n.get(body, 0) + 1
        rows.append({'id': h['id'], 'gender': g, 'body': body, 'kit': kit,
                     'pattern': {'slot': 'cloth' if 'cloth' in kit else 'top', 'name': pats[k % len(pats)]}})
        k += 1
    return rows, parts


def build_k24(parts):
    roster = json.load(open(os.path.join(HERE, 'data', 'roster.json'), encoding='utf-8'))['heroes']
    rng = random.Random(20261002)
    used = set()
    rows = []
    cnt = {'F': 0, 'M': 0}
    for h in roster:
        g = 'M' if int(hashlib.md5(h['id'].encode()).hexdigest(), 16) % 100 < 55 else 'F'
        pool = [L for L in (MALE if g == 'M' else FEMALE) if L in parts]
        cnt[g] += 1
        body = pool[(cnt[g] * 7) % len(pool)]            # 몸이 고르게 쓰이도록 순환
        kit = pick_kit(rng, g, pool, parts, body, used)
        if kit is None:
            raise SystemExit('조합을 못 찾음: ' + h['id'])
        used.add((body, tuple(sorted(kit.items()))))
        rows.append({'id': h['id'], 'gender': g, 'body': body, 'kit': kit})
    return rows, parts


def pick_kit(rng, g, pool, parts, body, used):
    """옷 고르기 규칙 한 곳 — 겹치는 조합·몸 원래 옷 그대로·세 칸 중 둘 이상이 원래 옷이면 다시(500번까지). 못 찾으면 None."""
    for _ in range(500):
        dress = [L for L in pool if 'cloth' in parts[L]]
        if dress and rng.random() < 0.3 and g == 'F':
            kit = {'cloth': rng.choice(dress), 'shoes': rng.choice([L for L in pool if 'shoes' in parts[L]])}
        else:
            kit = {'top': rng.choice([L for L in pool if 'top' in parts[L]]),
                   'bottom': rng.choice([L for L in pool if 'bottom' in parts[L]]),
                   'shoes': rng.choice([L for L in pool if 'shoes' in parts[L]])}
        key = (body, tuple(sorted(kit.items())))
        if key in used or all(v == body for v in kit.values()):
            continue
        if 'cloth' not in kit and sum(v == body for v in kit.values()) > 1:
            continue
        return kit
    return None


def apply_traits(rows, parts):
    """hero_traits.json 성별과 다른 줄만 다시 고른다(K-0078). 바뀐 id 목록을 돌려준다."""
    if not os.path.exists(TRAITS):
        return []
    tr = json.load(open(TRAITS, encoding='utf-8'))['heroes']
    used = {(r['body'], tuple(sorted(r['kit'].items()))) for r in rows}
    changed = []
    for r in rows:
        g = tr.get(r['id'], {}).get('gender')
        if g not in ('M', 'F') or g == r['gender']:
            continue
        pool = [L for L in (MALE if g == 'M' else FEMALE) if L in parts]
        rng = random.Random(int(hashlib.md5(('k78' + r['id']).encode()).hexdigest(), 16))
        n = {L: 0 for L in pool}
        for q in rows:
            if q['body'] in n:
                n[q['body']] += 1
        body = min(pool, key=lambda L: (n[L], rng.random()))
        used.discard((r['body'], tuple(sorted(r['kit'].items()))))
        kit = pick_kit(rng, g, pool, parts, body, used)
        if kit is None:
            raise SystemExit('조합을 못 찾음(성별 표): ' + r['id'])
        used.add((body, tuple(sorted(kit.items()))))
        r.update(gender=g, body=body, kit=kit)
        changed.append(r['id'])
    return changed


def check(rows, parts):
    errs = []
    seen = set()
    for r in rows:
        key = (r['body'], tuple(sorted(r['kit'].items())))
        if key in seen:
            errs.append('겹침 ' + r['id'])
        seen.add(key)
        for slot, src in r['kit'].items():
            if slot not in parts.get(src, {}):
                errs.append('%s: %s 에 %s 조각 없음' % (r['id'], src, slot))
        if all(v == r['body'] for v in r['kit'].values()):
            errs.append('몸 원래 옷 ' + r['id'])
        pt = r.get('pattern')
        if pt and (pt['slot'] not in r['kit'] or not os.path.exists(os.path.join(PATTERNS, pt['name'] + '.webp'))):
            errs.append('무늬 %s: %s' % (r['id'], pt))
    if len(rows) >= K24_N and fingerprint(rows[:K24_N]) != K24_MD5:
        errs.append('K-0024 299명 조합이 바뀜(지문 다름) — 이미 구운 몸과 어긋난다')
    return errs


if __name__ == '__main__':
    rows, parts = build()
    if '--check' in sys.argv and os.path.exists(OUT):   # 새로 뽑은 것이 아니라 저장된 계획표를 검사한다(K-0088)
        rows = json.load(open(OUT, encoding='utf-8'))['entries']
        print('검사 대상:', os.path.relpath(OUT))
    changed = apply_traits(rows, parts)
    if changed:
        print('성별 표로 바뀐 인물', len(changed), ':', ','.join(changed))
        print('  → 처음 바뀐 때(이미 다시 구웠으면 무시) 굽기 산출은 옛 몸이다: _out/vroid/<id>/<id>.glb·anims_k29.ok·web/·_out/sprites/<id>·_out/sprites8/<id> 를 지우고 '
              'outfit_swap.py --plan 으로 _in/vroid/<id>.glb 를 다시 만든 뒤 vroid_batch.sh --only <목록>(굽기는 산출이 있으면 건너뛴다)')
    errs = check(rows, parts)
    bodies = {}
    for r in rows:
        bodies[r['body']] = bodies.get(r['body'], 0) + 1
    pats = {r['pattern']['name'] for r in rows if 'pattern' in r}
    print('인물', len(rows), '· 몸 사용', dict(sorted(bodies.items())), '· 무늬', len(pats), '종 · 오류', len(errs))
    for e in errs[:10]:
        print(' ', e)
    if '--check' not in sys.argv and not errs:
        json.dump({'note': '생성: py tools/char-forge/outfit_swap_plan.py — 손으로 고치지 않는다(K-0024)', 'entries': rows},
                  open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
        print('쓰기', OUT)
    sys.exit(1 if errs else 0)
