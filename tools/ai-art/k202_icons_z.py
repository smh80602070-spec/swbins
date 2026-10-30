"""K-0202 ④ — 판마다 결이 다른 UI 아이콘(이모지 대체) Z-Image-Turbo 배치. 1만리 시범(make_k202_icons.py·zimg_full)이 맞아 나머지 판도 같은 길.

  py tools/ai-art/k202_icons_z.py <판> trial     # 그 판 이모지 빈도 상위 6개 → batches/k202_icons_<판>_zt.json (결 시험)
  py tools/ai-art/k202_icons_z.py <판> full      # 상위 60개 → batches/k202_icons_<판>_z1·z2·z3.json (각 20, gen.py 한 번에 24장 한도)
  판 = go · dungeon · forest · story · realm
이어서: py tools/ai-art/gen.py tools/ai-art/batches/k202_icons_<판>_z1.json → … → py tools/ai-art/k202_icon_pack.py <판> <_out 폴더들>

목록 = saga-web/<판> js·html 의 이모지 빈도에서 조작 기호(data/k202_icon_concepts.json `skip`)를 빼고 사전(`map`)에 있는 것(같은 개념은 한 번만).
프롬프트는 문장형(Z-Image) — 그림 결은 STYLE(판마다). 원작·실존 이름 없음.
"""
import collections
import glob
import hashlib
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
FOLDER = {'go': 'saga-go', 'dungeon': 'saga-dungeon', 'forest': 'saga-forest', 'story': 'saga-story', 'realm': 'saga-realm'}
LEAD = 'A flat vector game icon of {obj}. '
TAIL = ' One single object centered, plain white background, no text, no shadow, sticker style.'
STYLE = {
    'go': 'Thick dark teal outline, flat solid colors with teal and warm red accents, simple bold shapes.',
    'dungeon': 'Thick near-black outline, dark steel gray and charcoal fills with glowing red-orange accents, worn iron look, simple bold shapes.',
    'forest': 'Soft felt and fabric appliqué look with a dashed stitched border detail, warm cream, coral, sage green and mustard colors, cute rounded simple shapes.',
    'story': 'Bold comic book sticker look, very thick black outline, flat bright yellow, magenta and cyan colors, simple bold shapes.',
    'realm': 'Woodblock print look, bold carved black outlines, flat vermilion red, black and ochre colors only, simple bold shapes.',
}


def top_emojis(game, n=140):
    folder = FOLDER[game]
    files = [f for f in glob.glob(os.path.join(ROOT, 'saga-web', folder, 'js', '**', '*.js'), recursive=True)
             + glob.glob(os.path.join(ROOT, 'saga-web', folder, 'src', '**', '*.js'), recursive=True)
             + glob.glob(os.path.join(ROOT, 'saga-web', folder, '*.html')) if '/dist/' not in f.replace('\\', '/')]
    pat = re.compile('[\U0001F300-\U0001FAFF☀-➿⭐⬆↔-↪⌀-⏿]')
    cnt = collections.Counter()
    for f in files:
        t = open(f, encoding='utf-8', errors='ignore').read()
        cnt.update(pat.findall(t))
    return cnt.most_common(n)


def pick(game, n):
    conc = json.load(open(os.path.join(HERE, 'data', 'k202_icon_concepts.json'), encoding='utf-8'))
    skip, mp = set(conc['skip']), conc['map']
    seen, out, unmapped = set(), [], []
    for emo, c in top_emojis(game):
        if emo in skip:
            continue
        if emo not in mp:
            unmapped.append(emo)
            continue
        fid, obj = mp[emo]
        if fid in seen:
            continue
        seen.add(fid)
        out.append((fid, emo, obj, c))
        if len(out) >= n:
            break
    return out, unmapped


def write(game, name, items):
    batch = {'model': 'z-image-turbo', 'out': name, 'defaults': {'width': 768, 'height': 768, 'variants': 1}, 'items': items}
    p = os.path.join(HERE, 'batches', name + '.json')
    json.dump(batch, open(p, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print(len(items), '→', p)


def main(game, mode):
    n = 6 if mode == 'trial' else 60
    lst, unmapped = pick(game, n)
    items = []
    for fid, emo, obj, c in lst:
        seed = int(hashlib.md5(('k202z_%s_%s' % (game, fid)).encode()).hexdigest()[:8], 16)
        items.append({'id': 'ic_%s_%s' % (game, fid), 'seed': seed, 'prompt': LEAD.format(obj=obj) + STYLE[game] + TAIL, 'subject_ko': '%s 아이콘(%s·%d)' % (game, emo, c)})
    print(game, '목록:', ' '.join('%s%d' % (e, c) for _, e, _, c in lst))
    if unmapped:
        print('사전에 없어 뺀 것:', ' '.join(unmapped[:20]))
    if mode == 'trial':
        write(game, 'k202_icons_%s_zt' % game, items)
    else:
        for i in range(3):
            write(game, 'k202_icons_%s_z%d' % (game, i + 1), items[i * 20:(i + 1) * 20])


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else 'trial')
