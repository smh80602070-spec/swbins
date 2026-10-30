"""K-0202 ④ — 다섯 판 웹 코드에서 쓰는 이모지·기호를 빈도순으로 센다(아이콘 묶음 범위 정하기).
  py tools/ai-art/emoji_count.py [--top 70]   → tools/ai-art/_out/emoji_top.txt (글자 \t 개수 \t 쓰는 판들)
dist(조립본)는 뺀다 — js/·src/ 원본과 html 만."""
import collections
import glob
import os
import re
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
RX = re.compile('[\U0001F300-\U0001FAFF☀-➿⭐⬆⬇⬅➡↔-↪⏩-⏺]')


def main():
    top = int(sys.argv[sys.argv.index('--top') + 1]) if '--top' in sys.argv else 70
    cnt = collections.Counter(); where = collections.defaultdict(set)
    for g in ('saga-go', 'saga-dungeon', 'saga-forest', 'saga-story', 'saga-realm', 'shared'):
        base = os.path.join(ROOT, 'saga-web', g)
        fs = glob.glob(base + '/js/**/*.js', recursive=True) + glob.glob(base + '/src/**/*.js', recursive=True) + glob.glob(base + '/*.html')
        for f in fs:
            if os.sep + 'dist' + os.sep in f:
                continue
            s = open(f, encoding='utf-8', errors='ignore').read()
            for m in RX.finditer(s):
                cnt[m.group(0)] += 1; where[m.group(0)].add(g.replace('saga-', ''))
    rows = cnt.most_common(top)
    out = os.path.join(ROOT, 'tools', 'ai-art', '_out'); os.makedirs(out, exist_ok=True)
    open(os.path.join(out, 'emoji_top.txt'), 'w', encoding='utf-8').write('\n'.join(f'{c}\t{n}\t{",".join(sorted(where[c]))}' for c, n in rows))
    print(len(cnt), '종류 ·', ' '.join(f'{c}{n}' for c, n in rows))


if __name__ == '__main__':
    main()
