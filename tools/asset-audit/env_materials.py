"""K-0152 — 환경 GLB 재질 감사: 묶음(world/web·toon·real)별 재질 종류 + 쓰임 수 → 사실 재질(법선·거칠기) 입힐 순서.

  py tools/asset-audit/env_materials.py [--top 30]     → tools/asset-audit/out/env_materials.json + 상위 표 + 끝 줄 ENV_MAT n/top (맵 있는 상위 개수)

재질 종류: unlit · tex(색 그림) · col(단색) · nrm(법선 맵) · mr(거칠기·금속 맵) · metal(금속값 > 0.5).
쓰임 = 지물 id(파일 이름)가 단어로 나오는 횟수 — 웹 다섯 판 js(dist·assets3d-ids 빼고)·공용 js · 고돗 gd·tscn(assets 빼고) · 유니티 SagaCore cs·json.
"""
import json
import os
import re
import struct
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
SETS = {'web': 'saga-assets/world/web', 'toon': 'saga-assets/world/toon', 'real': 'saga-assets/world/real'}


def glb_json(p):
    b = open(p, 'rb').read(20 + 4 * 1024 * 1024)
    n = struct.unpack('<I', b[12:16])[0]
    return json.loads(b[20:20 + n])


def kinds(j):
    out = []
    for m in j.get('materials', []):
        p = m.get('pbrMetallicRoughness', {})
        out.append({'name': m.get('name', ''), 'unlit': 'KHR_materials_unlit' in (m.get('extensions') or {}), 'tex': 'baseColorTexture' in p,
                    'nrm': 'normalTexture' in m, 'mr': 'metallicRoughnessTexture' in p, 'metal': p.get('metallicFactor', 1) > 0.5})
    return out


def sources():
    files = []
    for base, exts, skip in (('saga-web', ('.js',), ('/dist/', 'assets3d-ids', '/vendor/', '/tools/', '/assets/')),
                             ('saga-godot', ('.gd', '.tscn'), ('/assets/', '/.godot/', '/addons/')),
                             ('saga-unity/Assets/SagaCore', ('.cs', '.json'), ())):
        for dp, _dn, fn in os.walk(os.path.join(ROOT, base)):
            d = dp.replace('\\', '/') + '/'
            if any(s in d for s in skip):
                continue
            files += [os.path.join(dp, f) for f in fn if f.endswith(exts)]
    text = []
    for f in files:
        try:
            text.append(open(f, encoding='utf-8', errors='ignore').read())
        except OSError:
            pass
    return '\n'.join(text)


def main():
    top = int(sys.argv[sys.argv.index('--top') + 1]) if '--top' in sys.argv else 30
    src = sources()
    words = {}
    for w in re.findall(r'[A-Za-z0-9_]+', src):
        words[w] = words.get(w, 0) + 1
    rows = []
    for sk, d in SETS.items():
        dd = os.path.join(ROOT, d)
        for f in sorted(os.listdir(dd)):
            if not f.endswith('.glb'):
                continue
            j = glb_json(os.path.join(dd, f))
            ks = kinds(j)
            gid = f[:-4]
            rows.append({'set': sk, 'id': gid, 'uses': words.get(gid, 0), 'bytes': os.path.getsize(os.path.join(dd, f)), 'mats': len(ks),
                         'tex': sum(k['tex'] for k in ks), 'col': sum(not k['tex'] for k in ks), 'nrm': sum(k['nrm'] for k in ks),
                         'mr': sum(k['mr'] for k in ks), 'unlit': sum(k['unlit'] for k in ks), 'images': len(j.get('images', []))})
    tot = {}
    for r in rows:
        t = tot.setdefault(r['set'], {'glb': 0, 'mats': 0, 'tex': 0, 'col': 0, 'nrm': 0, 'mr': 0, 'unlit': 0})
        for k in ('mats', 'tex', 'col', 'nrm', 'mr', 'unlit'):
            t[k] += r[k]
        t['glb'] += 1
    ids = {}
    for r in rows:
        ids[r['id']] = max(ids.get(r['id'], 0), r['uses'])
    pick = [i for i, u in sorted(ids.items(), key=lambda x: -x[1]) if u > 0 and not i.startswith(('boss_', 'pk_', 'pet_', 'mon_', 'acc_'))][:top]   # 환경만(괴물·펫·장신구 빼고)
    done = sum(1 for i in pick if all(r['nrm'] >= r['tex'] and r['tex'] > 0 or r['mr'] >= r['mats'] for r in rows if r['id'] == i))
    os.makedirs(os.path.join(ROOT, 'tools', 'asset-audit', 'out'), exist_ok=True)
    json.dump({'totals': tot, 'top': pick, 'rows': rows}, open(os.path.join(ROOT, 'tools', 'asset-audit', 'out', 'env_materials.json'), 'w', encoding='utf-8'),
              ensure_ascii=False, indent=1)
    sys.stdout.reconfigure(encoding='utf-8')
    for s, t in tot.items():
        print(f'{s:5} GLB {t["glb"]:4} 재질 {t["mats"]:5} · 색그림 {t["tex"]} · 단색 {t["col"]} · 법선 {t["nrm"]} · 거칠기 {t["mr"]} · unlit {t["unlit"]}')
    print('상위', top, ':', ', '.join(f'{i}({ids[i]})' for i in pick))
    print(f'ENV_MAT {done}/{len(pick)}')


if __name__ == '__main__':
    main()
