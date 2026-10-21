"""K-0158 2D 에셋 공장 — 한 명령: 계획 JSON → Blender 굽기(기존 도구) → 그림체 통일(style_pass) → 자동 판정(sheet_judge) → 정본·판별 배포.

  py tools/char-forge/factory.py <계획.json> [--only id1,id2] [--dry] [--stage bake,style,judge,place] [--force-style]

계획(본보기 recipes/factory/k158_trial.json):
  px·ndir·dirs(5방향 0 정면·1 앞대각·2 옆·3 뒤대각·4 뒤, 반대쪽은 웹이 뒤집음)·clips{역할:{frames,fps,loop}}·foot·style
  human{bodies, anim_extra, act{역할: 동작}} — 사람 풀은 bake_sprite_batch.py(→ gear_sprites.py)를 그대로 부른다
  creature{act{역할: 몸 동작 이름}} — 짐승 풀은 creature_sprites.py(DIR_STEP=45)를 부른다. 몸에 없는 동작은 manifest missing
  pools[{id, type:human|creature, ...}] · canon(정본 saga-assets/…) · deploy(판 assets/sprites2d_sheets)

산출(git 밖): tools/char-forge/_out/factory/{raw,styled}/<풀>/<역할>.webp · judge.json · compare_<풀>.png · throughput.json
정본(git): <canon>/<풀>/{<역할>.webp, manifest.json, license.json} → <deploy>/<풀>/ 복사 + <deploy>/index.json 의 factory 목록.
이어하기: 역할 webp 가 있으면 그 굽기·그림체를 건너뛴다(manifest 만 보고 건너뛰지 않는다 — K-0083 무한 반복 함정).
판정 FAIL 풀은 배포하지 않는다. Blender 는 낮은 우선순위로 하나씩만 돈다(RAM).
"""
import json
import os
import shutil
import subprocess
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
OUT = os.path.join(HERE, '_out', 'factory')
BLENDER = os.environ.get('BLENDER', r'C:\Program Files\Blender Foundation\Blender 5.2\blender.exe')
BELOW_NORMAL = 0x00004000
sys.path.insert(0, HERE)


def P(*a):
    return os.path.join(ROOT, *a)


def log(*a):
    print(time.strftime('%H:%M:%S'), *a, flush=True)


def tp_save(tp):
    json.dump(tp, open(os.path.join(OUT, 'throughput.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)


def geo(plan, pool):
    """K-0159: 풀마다 칸·배율을 바꿀 수 있다(긴 무기 풀은 칸을 키워 px/m 를 같게). 발 기준은 늘 plan foot."""
    px = pool.get('px', plan['px'])
    ortho = pool.get('ortho', plan['ortho'] * px / plan['px'])
    return px, ortho, round(ortho * (plan['foot'] - 0.5), 4)


def roles_of(plan, pool):
    """그 풀이 만들 수 있는 역할(계획 순서) · 빠진 역할."""
    act = plan['human']['act'] if pool['type'] == 'human' else plan['creature']['act']
    act = dict(act, **pool.get('act', {}))
    have = [r for r in plan['clips'] if act.get(r)]
    return have, [r for r in plan['clips'] if r not in have], act


def bake_human(plan, pool, raw):
    have, _, act = roles_of(plan, pool)
    px, ortho, cam_z = geo(plan, pool)
    sub = {'px': px, 'frames': 8, 'ortho': ortho, 'cam_z': cam_z, 'ndir': plan['ndir'], 'dirs': plan['dirs'],
           'out': os.path.relpath(raw, ROOT).replace('\\', '/'), 'bodies': plan['human']['bodies'], 'anim_extra': plan['human'].get('anim_extra'),
           'roles16': {r: [act[r], plan['clips'][r]['frames']] for r in have}, 'fps16': {r: plan['clips'][r]['fps'] for r in have},
           'entries': [dict({'id': pool['id'], 'body': pool['body'], 'kind': pool['kind']},
                            **{k: pool[k] for k in ('weapon', 'weapon_kind', 'two_hand_clips') if pool.get(k)})]}
    if pool.get('weapon'):
        sub['combat_roles'] = pool.get('combat_roles', ['idle', 'attack', 'attack2'])
    sp = os.path.join(OUT, 'plan_' + pool['id'] + '.json')
    json.dump(sub, open(sp, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    env = dict(os.environ, CENTER_CLIPS=','.join(dict.fromkeys(act[r] for r in ('death', 'sit') + tuple(pool.get('center_roles', ())) if r in have)),   # K-0159 center_roles: 창 찌르기처럼 칸 옆으로 나가는 동작도
                 # 누운 몸이 칸 밖으로 — gear_sprites 가 그 줄만 카메라를 민다
               KIND_JSON=json.dumps(plan['human'].get('kinds', {})))       # K-0159 still 과 같은 사람 — 머리색·옷 조각 색·망토·갑주(gear_sprites KIND_JSON)
    r = subprocess.run([sys.executable, os.path.join(HERE, 'bake_sprite_batch.py'), sp], stdin=subprocess.DEVNULL, env=env)
    return r.returncode == 0 and all(os.path.exists(os.path.join(raw, pool['id'], x + '.webp')) for x in have)   # 그 도구는 실패해도 0 으로 끝난다


def bake_creature(plan, pool, raw):
    from bake_sprite_batch import sheet_from_frames
    have, _, act = roles_of(plan, pool)
    odir = os.path.join(raw, pool['id'])
    todo = have          # 한 동작만 다시 찍으면 칸 배율(서 있기·걷기로 정함)이 달라진다 — 짐승은 늘 전 동작을 함께(1분 남짓)
    fr = os.path.join(OUT, 'frames', pool['id'])
    env = dict(os.environ, SPRITE_PX=str(plan['px']), NFR='8', DIR_STEP=str(360 / plan['ndir']), DIR_LIST=','.join(map(str, plan['dirs'])),
               CLIPS=','.join(f'{r}={act[r]}' for r in todo), NFR_MAP=','.join(f'{r}={plan["clips"][r]["frames"]}' for r in todo))
    os.makedirs(odir, exist_ok=True)
    with open(os.path.join(odir, 'bake.log'), 'wb') as lf:
        rc = subprocess.run([BLENDER, '-b', '--factory-startup', '-P', os.path.join(HERE, 'creature_sprites.py'), '--', P(pool['glb']), fr],
                            env=env, stdin=subprocess.DEVNULL, stdout=lf, stderr=subprocess.STDOUT,
                            creationflags=BELOW_NORMAL if os.name == 'nt' else 0).returncode
    if rc != 0 or not os.path.exists(os.path.join(fr, 'meta.json')):
        return False
    meta = json.load(open(os.path.join(fr, 'meta.json'), encoding='utf-8'))
    for r in meta['clips']:
        sheet_from_frames(os.path.join(fr, r), plan['dirs'], meta['nfr'][r], os.path.join(odir, r + '.webp'), plan['px'])
    m = {'ortho_m': meta['ortho_m'], 'cam_z': meta['cam_z'], 'foot': round(meta['anchor_feet_y_px'] / meta['px'], 4), 'missing_body': meta['missing']}
    json.dump(m, open(os.path.join(odir, 'creature_meta.json'), 'w', encoding='utf-8'), indent=1)
    shutil.rmtree(fr, ignore_errors=True)
    return True


def shifted_anchor(plan, raw_dir, act, have, pool=None):
    """gear_sprites CENTER 줄(누운 몸이 칸 밖으로 → 카메라를 옆으로 민 방향) → {역할: {방향: 발 x px}} — 없으면 칸 가운데(px/2)."""
    res, lg = {}, os.path.join(raw_dir, 'bake.log')
    if not os.path.exists(lg):
        return res
    back = {act[r]: r for r in have}
    for ln in open(lg, encoding='utf-8', errors='replace'):
        if ln.startswith('CENTER '):
            _, cn, d, s = ln.split()[:4]
            if float(s) and cn in back:
                px, ortho, _ = geo(plan, pool or {})
                res.setdefault(back[cn], {})[d] = round(px / 2 - float(s) * px / ortho, 1)
    return res


def manifest(plan, pool, raw_dir):
    have, missing, act = roles_of(plan, pool)
    have = [r for r in have if os.path.exists(os.path.join(raw_dir, r + '.webp'))]
    missing = [r for r in plan['clips'] if r not in have]
    m = {'id': pool['id'], 'px': geo(plan, pool)[0], 'dirs': plan['dirs'], 'dir_names': plan.get('dir_names'), 'ndir': plan['ndir'], 'mirror': True,
         'side_faces': 'right', 'layout': '가로 = 프레임, 세로 = 방향(dirs 순서)',
         'clips': {r: dict(plan['clips'][r], file=r + '.webp') for r in have}, 'missing': missing,
         'foot': plan['foot'], 'style': plan['style'], 'kind': pool['type']}
    if pool['type'] == 'human':
        px, ortho, _ = geo(plan, pool)
        m.update({'ortho_m': round(ortho, 4), 'px_per_m': round(px / ortho, 2), 'body': pool['body'], 'gear': pool['kind'],
                  'act': {r: act[r] for r in have},
                  'source': 'tools/char-forge/factory.py → bake_sprite_batch.py/gear_sprites.py (Blender) → style_pass.py',
                  'anchor_x_px': shifted_anchor(plan, raw_dir, act, have, pool),
                  'license': pool.get('license', plan['human']['license']) + ' — 상업 사용 가능'})
    else:
        cm = json.load(open(os.path.join(raw_dir, 'creature_meta.json'), encoding='utf-8'))
        lic = json.load(open(P(pool['license_json']), encoding='utf-8')) if pool.get('license_json') else {}
        m.update({'ortho_m': cm['ortho_m'], 'px_per_m': round(m['px'] / cm['ortho_m'], 2), 'foot': cm['foot'], 'body': pool['glb'],
                  'act': {r: act[r] for r in have},
                  'source': 'tools/char-forge/factory.py → creature_sprites.py (Blender) → style_pass.py',
                  'license': f'자체 3D 몸({pool["glb"]}, {lic.get("generator", "")} · 모델 {lic.get("model_license", "")}) + 자체 뼈대·키프레임 동작 — 상업 사용 {"가능" if lic.get("commercial_use") else "확인 필요"}'})
    if pool.get('from'):
        m['from_pool'] = pool['from']
    if pool.get('weapon_kind'):
        m['weapon'] = pool['weapon_kind']
    if pool.get('still_match'):
        m['still_match'] = pool['still_match']
    return m


def main():
    a = sys.argv[1:]
    plan_path = a[0]
    plan = json.load(open(plan_path, encoding='utf-8'))
    only = a[a.index('--only') + 1].split(',') if '--only' in a else None
    stages = a[a.index('--stage') + 1].split(',') if '--stage' in a else ['bake', 'style', 'judge', 'place']
    pools = [p for p in plan['pools'] if not only or p['id'] in only]
    n_fr = sum(c['frames'] for c in plan['clips'].values())
    log(f'풀 {len(pools)} × 동작 {len(plan["clips"])} × 방향 {len(plan["dirs"])} · {plan["px"]}px · 풀당 최대 {n_fr * len(plan["dirs"])}칸 · 단계 {stages}')
    for p in pools:
        have, missing, _ = roles_of(plan, p)
        log(f'  {p["id"]} ({p["type"]}) 동작 {len(have)} · 빠짐 {missing or "-"}')
    if '--dry' in a:
        return 0
    os.makedirs(OUT, exist_ok=True)
    raw, styled = os.path.join(OUT, 'raw'), os.path.join(OUT, 'styled')
    tpp = os.path.join(OUT, 'throughput.json')
    tp = json.load(open(tpp, encoding='utf-8')) if os.path.exists(tpp) else {}

    if 'bake' in stages:
        for p in pools:
            have, _, _ = roles_of(plan, p)
            todo = [r for r in have if not os.path.exists(os.path.join(raw, p['id'], r + '.webp'))]
            if p['type'] == 'creature' and not os.path.exists(os.path.join(raw, p['id'], 'creature_meta.json')):
                todo = todo or have
            if not todo:
                log('굽기 건너뜀(역할 webp 있음):', p['id'])
                continue
            log('굽기:', p['id'], todo)
            t0 = time.time()
            ok = (bake_human if p['type'] == 'human' else bake_creature)(plan, p, raw)
            sec = round(time.time() - t0)
            frames = sum(plan['clips'][r]['frames'] for r in todo) * len(plan['dirs'])
            tp[p['id']] = {'type': p['type'], 'bake_sec': sec, 'frames': frames, 'sec_per_frame': round(sec / max(1, frames), 2),
                           'device': 'CPU+GPU(Blender EEVEE, 낮은 우선순위)', 'roles': todo, 'date': time.strftime('%Y-%m-%d')}
            tp_save(tp)
            log(f'  {"ok" if ok else "실패"} {p["id"]} {sec}s ({frames}칸)')
            if not ok:
                return 2

    if 'style' in stages:
        import style_pass
        pal = style_pass.load_palette(plan)
        force = '--force-style' in a
        for p in pools:
            rd, sd = os.path.join(raw, p['id']), os.path.join(styled, p['id'])
            os.makedirs(sd, exist_ok=True)
            t0 = time.time()
            n = 0
            for r in plan['clips']:
                src, dst = os.path.join(rd, r + '.webp'), os.path.join(sd, r + '.webp')
                if os.path.exists(src) and (force or not os.path.exists(dst)):
                    foot = plan['foot']
                    if p['type'] == 'creature':
                        foot = json.load(open(os.path.join(rd, 'creature_meta.json'), encoding='utf-8'))['foot']
                    style_pass.style_sheet(src, dst, pal, geo(plan, p)[0], r, foot)
                    n += 1
            m = manifest(plan, p, rd)
            json.dump(m, open(os.path.join(sd, 'manifest.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
            style_pass.compare_board(rd, sd, dict(plan, px=geo(plan, p)[0], still_game=p.get('still_game', plan.get('game'))), os.path.join(OUT, f'compare_{p["id"]}.png'))
            tp.setdefault(p['id'], {})['style_sec'] = round(time.time() - t0, 1)
            log(f'그림체: {p["id"]} {n}장 · 대조판 compare_{p["id"]}.png')
        tp_save(tp)

    res = {}
    if 'judge' in stages:
        import sheet_judge
        res = sheet_judge.judge_all(styled, [p['id'] for p in pools], {p['id']: p.get('still_game', plan.get('game')) for p in pools})
        for k, v in res.items():
            log('판정:', k, 'PASS' if v['pass'] else 'FAIL', {c: x['ok'] for c, x in v['checks'].items()})

    if 'place' in stages:
        if not res:
            jp = os.path.join(OUT, 'judge.json')
            res = json.load(open(jp, encoding='utf-8')) if os.path.exists(jp) else {}
        canon = P(plan['canon'])
        deps = plan['deploy'] if isinstance(plan['deploy'], dict) else {plan['deploy']: None}   # K-0159 {판 sprites2d_sheets: [풀…]}
        placed = []
        for p in pools:
            if not res.get(p['id'], {}).get('pass'):
                log('배포 안 함(판정 FAIL·없음):', p['id'])
                continue
            sd = os.path.join(styled, p['id'])
            m = json.load(open(os.path.join(sd, 'manifest.json'), encoding='utf-8'))
            files = [c['file'] for c in m['clips'].values()] + ['manifest.json']
            for root in [os.path.join(canon, p['id'])] + [os.path.join(P(d), p['id']) for d, only_ in deps.items() if only_ is None or p['id'] in only_]:
                os.makedirs(root, exist_ok=True)
                for f in files:
                    shutil.copyfile(os.path.join(sd, f), os.path.join(root, f))
            lic = {'id': p['id'], 'generator': 'factory.py (K-0158 2D 공장, Blender + style_pass)', 'model': '-', 'pipeline': m['source'],
                   'license': 'VRoid 샘플 이용 조건(상업·개작 허용)·CC0 동작 — 자체 렌더' if p['type'] == 'human' else 'MIT(TRELLIS)·자체 뼈대 동작 — 자체 렌더',
                   'license_detail': m['license'], 'commercial_use': True, 'style': m['style'],
                   'tools': ['tools/char-forge/factory.py', 'tools/char-forge/style_pass.py', 'tools/char-forge/sheet_judge.py'],
                   'date': time.strftime('%Y-%m-%d'), 'ticket': plan.get('ticket', 'K-0158'), 'judge': {c: x['ok'] for c, x in res[p['id']]['checks'].items()}}
            if p.get('license_json') or p.get('source_license'):
                lic['source_license'] = p.get('license_json') or p.get('source_license')
            json.dump(lic, open(os.path.join(canon, p['id'] + '.license.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
            placed.append(p['id'])
        for d, only_ in deps.items():
            mine = [x for x in placed if only_ is None or x in only_]
            if not mine:
                continue
            ip = os.path.join(P(d), 'index.json')
            idx = json.load(open(ip, encoding='utf-8')) if os.path.exists(ip) else {'sheets': []}
            idx['factory'] = [x for x in idx.get('factory', []) if x not in mine] + mine
            idx['factory_spec'] = (f'K-0158 공장 규격: {plan["px"]}px(긴 무기 풀은 manifest px 가 더 큼 — px_per_m 같음) · 방향 {len(plan["dirs"])}(0 정면·1 앞대각·2 옆·3 뒤대각·4 뒤, 반대쪽은 뒤집기) · '
                                   f'동작 {"/".join(plan["clips"])}(없는 것은 manifest missing) · 8프레임(death·hit 6) · 발 = 위에서 {plan["foot"]} · 그림체 {plan["style"]}')
            open(ip, 'w', encoding='utf-8').write(json.dumps(idx, ensure_ascii=False, indent=1) + '\n')
        log('배포:', placed, '→', list(deps))
        tp_save(tp)
    bad = [k for k, v in res.items() if not v['pass']]
    return 1 if bad else 0


if __name__ == '__main__':
    sys.exit(main())
