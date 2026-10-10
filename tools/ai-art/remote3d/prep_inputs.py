"""K-0096 — 판정기 1등(또는 눈으로 바꾼 후보)을 TRELLIS 입력 폴더로 모은다: <id>.png + <id>.license.json.

  py tools/ai-art/remote3d/prep_inputs.py <report.json> --dest <폴더> [--pick panda=v03,owl=v02] [--targets k96_targets.json] [--only bear,boar] [--write]

대상 표에 있는 id 만 고른다. --pick 은 판정기 1등 대신 쓸 후보(눈 판정). 입력은 txt2img 만 — license 에 init_image 가 있으면 멈춘다.
--only 면 그 id 만(이미 올린 것의 입력을 안 건드리게). --write 면 대상 표의 input·status 를 새 그림으로 고친다(없으면 세기만).
"""
import json
import os
import shutil
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))


def main():
    sys.stdout.reconfigure(encoding='utf-8')
    a = sys.argv[1:]
    opt = lambda k, d=None: a[a.index(k) + 1] if k in a else d
    rep = json.load(open(a[0], encoding='utf-8'))
    dest = os.path.abspath(opt('--dest'))
    tj = opt('--targets', os.path.join(HERE, 'k96_targets.json'))
    T = json.load(open(tj, encoding='utf-8'))
    only = set(opt('--only', '').split(',')) - {''}
    over = dict(kv.split('=') for kv in opt('--pick', '').split(',') if kv)
    rows = {}
    for r in rep['rows']:
        rows.setdefault(r.get('group'), []).append(r)
    write = '--write' in a
    got, miss = [], []
    for t in T['items']:
        i = t['id']
        if only and i not in only:
            continue
        rs = rows.get(i)
        if not rs:
            miss.append(i)
            continue
        if i in over:
            r = next(r for r in rs if os.path.splitext(os.path.basename(r['path']))[0] == '%s_%s' % (i, over[i]))
        else:
            acc = [r for r in rs if r['decision'] == 'accept']
            if not acc:
                miss.append(i + '(판정 통과 0)')
                continue
            r = acc[0]
        lic_src = os.path.splitext(r['path'])[0] + '.license.json'
        lic = json.load(open(lic_src, encoding='utf-8')) if os.path.exists(lic_src) else {}
        if lic.get('init_image') or lic.get('mode') == 'img2img':
            sys.exit('img2img 입력 금지: %s' % r['path'])
        got.append((i, r, lic))
    print('고름 %d · 없음 %d%s' % (len(got), len(miss), (' — ' + ','.join(miss)) if miss else ''))
    for i, r, lic in got:
        print('  %-12s %s  점수 %.0f' % (i, os.path.basename(r['path']), r.get('score', 0)))
    if not write:
        return
    os.makedirs(dest, exist_ok=True)
    for i, r, lic in got:
        shutil.copy2(r['path'], os.path.join(dest, i + '.png'))
        lic = dict(lic, k96_pick=os.path.basename(r['path']), judge_score=r.get('score'))
        json.dump(lic, open(os.path.join(dest, i + '.license.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
        t = next(t for t in T['items'] if t['id'] == i)
        t['input'] = os.path.relpath(os.path.join(dest, i + '.png'), ROOT).replace('\\', '/')
        t['status'] = '있음(txt2img)'
    json.dump(T, open(tj, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print('PREP_OK %d → %s' % (len(got), dest))


if __name__ == '__main__':
    main()
