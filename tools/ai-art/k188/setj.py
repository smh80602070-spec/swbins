"""K-0188 ③ 관절 손질 — 자동 관절(joints.json) 위에 JSON 조각을 덮어쓴다(N 은 칸끼리 합침). 정본 k188/<id>.joints.json 에도 같이 씀.
  py tools/ai-art/k188/setj.py <id> '<json>'      예: '{"N":{"el":[378,470]},"skirt":700,"chest_poly":[[[..]]]}'
값이 null 이면 그 칸을 지운다.
"""
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
P = os.path.join(HERE, '..', '_out', 'k188', 'p')


def main():
    i, patch = sys.argv[1], json.loads(sys.argv[2])
    p = os.path.join(P, i, 'joints.json')
    j = json.load(open(p))
    for k, v in patch.items():
        if v is None:
            j.pop(k, None)
        elif k in ('N', 'w') and isinstance(v, dict):
            j.setdefault(k, {}).update(v)
        else:
            j[k] = v
    json.dump(j, open(p, 'w'))
    json.dump(j, open(os.path.join(HERE, i + '.joints.json'), 'w'))
    print('SETJ', i, sorted(patch))


if __name__ == '__main__':
    main()
