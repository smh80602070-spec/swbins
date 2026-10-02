"""명단 299명 조합표 — 인물마다 (몸 샘플, 상의·하의·신발 출처 샘플) 을 겹치지 않게 정한다(K-0024).

    py tools/char-forge/outfit_swap_plan.py            # data/outfit_swap_plan.json 을 쓴다
    py tools/char-forge/outfit_swap_plan.py --check    # 겹침·조각 존재·몸 원래 옷 그대로가 아닌지 검사만

- 조각 목록은 `_out/parts/<샘플>/parts.json`(export_parts_all.sh). 슬롯: top · bottom · shoes · cloth(원피스: 상·하의 대신).
- 성별은 명단에 없어 id 해시로 정한다(근거 없는 값 — 바꾸려면 plan 의 gender 만 고치고 다시 굽는다). 풀은 unity_bodies_plan 과 같다.
- 같은 샘플 풀 안에서만 섞는다(남자 몸에 치마 원피스가 가지 않게). 시드 고정 → 다시 돌려도 같다.
"""
import json, os, sys, random, hashlib

HERE = os.path.dirname(os.path.abspath(__file__))
PARTS = os.path.join(HERE, '_out', 'parts')
FEMALE = list('abdefhijkmoqsuwy')
MALE = list('cglnprvxz')              # t 는 재배포 불가라 뺀다
OUT = os.path.join(HERE, 'data', 'outfit_swap_plan.json')


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
