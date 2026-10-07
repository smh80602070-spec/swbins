"""명단 299명 조합표 — 인물마다 (몸 샘플, 상의·하의·신발 출처 샘플) 을 겹치지 않게 정한다(K-0024).

    py tools/char-forge/outfit_swap_plan.py            # data/outfit_swap_plan.json 을 쓴다
    py tools/char-forge/outfit_swap_plan.py --check    # 겹침·조각 존재·몸 원래 옷 그대로가 아닌지 검사만

- 조각 목록은 `_out/parts/<샘플>/parts.json`(export_parts_all.sh). 슬롯: top · bottom · shoes · cloth(원피스: 상·하의 대신).
- 성별은 명단에 없어 id 해시로 정한다(근거 없는 값). 풀은 unity_bodies_plan 과 같다.
- K-0078: `data/hero_traits.json` 에 성별이 있는 인물(도감 105)은 그 성별을 따른다. 해시 성별과 같으면 줄 그대로,
  다르면 그 사람만 맞는 풀에서 몸(덜 쓰인 것)·옷을 다시 고른다 — 나머지 줄은 안 바뀐다(다시 굽기를 바뀐 사람만).
- 같은 샘플 풀 안에서만 섞는다(남자 몸에 치마 원피스가 가지 않게). 시드 고정 → 다시 돌려도 같다.
"""
import json, os, sys, random, hashlib

HERE = os.path.dirname(os.path.abspath(__file__))
PARTS = os.path.join(HERE, '_out', 'parts')
FEMALE = list('abdefhijkmoqsuwy')
MALE = list('cglnprvxz')              # t 는 재배포 불가라 뺀다
OUT = os.path.join(HERE, 'data', 'outfit_swap_plan.json')
TRAITS = os.path.join(HERE, 'data', 'hero_traits.json')


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
        d[L] = slots
    return d


def build():
    parts = load_parts()
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
        for _ in range(500):
            dress = [L for L in pool if 'cloth' in parts[L]]
            if dress and rng.random() < 0.3 and g == 'F':
                src = rng.choice(dress)
                kit = {'cloth': src, 'shoes': rng.choice([L for L in pool if 'shoes' in parts[L]])}
            else:
                kit = {'top': rng.choice([L for L in pool if 'top' in parts[L]]),
                       'bottom': rng.choice([L for L in pool if 'bottom' in parts[L]]),
                       'shoes': rng.choice([L for L in pool if 'shoes' in parts[L]])}
            key = (body, tuple(sorted(kit.items())))
            if key in used:
                continue
            if all(v == body for v in kit.values()):     # 몸 원래 옷 그대로면 다시
                continue
            if 'cloth' not in kit and sum(v == body for v in kit.values()) > 1:
                continue                                  # 세 칸 중 둘 이상이 원래 옷이면 너무 같다
            used.add(key)
            break
        else:
            raise SystemExit('조합을 못 찾음: ' + h['id'])
        rows.append({'id': h['id'], 'gender': g, 'body': body, 'kit': kit})
    return rows, parts


def pick_kit(rng, g, pool, parts, body, used):
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
    return errs


if __name__ == '__main__':
    rows, parts = build()
    changed = apply_traits(rows, parts)
    if changed:
        print('성별 표로 바뀐 인물', len(changed), ':', ','.join(changed))
    errs = check(rows, parts)
    bodies = {}
    for r in rows:
        bodies[r['body']] = bodies.get(r['body'], 0) + 1
    print('인물', len(rows), '· 몸 사용', dict(sorted(bodies.items())), '· 오류', len(errs))
    for e in errs[:10]:
        print(' ', e)
    if '--check' not in sys.argv and not errs:
        json.dump({'note': '생성: py tools/char-forge/outfit_swap_plan.py — 손으로 고치지 않는다(K-0024)', 'entries': rows},
                  open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
        print('쓰기', OUT)
    sys.exit(1 if errs else 0)
