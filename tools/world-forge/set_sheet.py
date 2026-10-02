"""world-forge 판별 세트 판정 시트 (K-0017 단계 4) — 산출 42개를 한 장 그림 + 표로 만든다.

  py tools/world-forge/set_sheet.py <산출 폴더(toon·web·sprite 가 들어 있는 곳)> [시트 md 경로]
  산출: <폴더>/contact_sheet.png (스프라이트 한 장, 이름 표기) + 시트 md(기본 tasks/sheets/world-forge-<날짜>.md)
표 칸: id · 종류 · 쓰이는 판 · 시대 · 삼각형 · 툰 KB · 웹 KB · ○/×. 사용자가 그림을 보고 ○/× 만 적으면 통과분이 K-0019 로 간다.
"""
import json
import os
import sys
import time

from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, '..', '..'))
KIND_KO = {'building': '건물', 'prop': '지물', 'terrain': '지형', 'vehicle': '탈것'}


def disp(p):
    p = os.path.abspath(p)
    return (os.path.relpath(p, ROOT) if p.startswith(ROOT) else p).replace(os.sep, '/')


def main():
    out = os.path.abspath(sys.argv[1])
    sheet_md = sys.argv[2] if len(sys.argv) > 2 else os.path.join(ROOT, 'tasks', 'sheets', f'world-forge-{time.strftime("%Y%m%d")}.md')
    plan = json.load(open(os.path.join(HERE, 'data', 'set_plan.json'), encoding='utf-8'))
    info = {}
    for g, spec in plan['games'].items():
        for kind in KIND_KO:
            for it in spec[kind]:
                e = info.setdefault(it['id'], {'kind': kind, 'era': it.get('era', ''), 'games': [], 'hint': it.get('hint', '')})
                e['games'].append(g)
    ids = sorted(info, key=lambda i: (list(KIND_KO).index(info[i]['kind']), i))
    # 그림 한 장
    cols, cell = 7, 256
    rows = (len(ids) + cols - 1) // cols
    img = Image.new('RGB', (cols * cell, rows * (cell + 16)), (150, 170, 150))
    d = ImageDraw.Draw(img)
    for k, i in enumerate(ids):
        sp = Image.open(os.path.join(out, 'sprite', i + '.webp')).convert('RGBA')
        x, y = (k % cols) * cell, (k // cols) * (cell + 16)
        img.paste(sp, (x, y + 16), sp)
        d.text((x + 4, y + 2), f'{k + 1} {i}', fill=(10, 10, 10))
    img.save(os.path.join(out, 'contact_sheet.png'))
    # 표
    lines = ['# 판별 세트 판정 시트 — world-forge 42개 (K-0017)',
             f'{time.strftime("%Y-%m-%d")} · 그림 한 장: `{disp(os.path.join(out, "contact_sheet.png"))}` (번호 = 표 번호) · 툰 GLB `{disp(os.path.join(out, "toon"))}` · 웹 압축본 `web` · 웹 2D `sprite`',
             '○/× 만 적어 주세요. ○ 인 것만 K-0019(에셋 배치)로 넘깁니다. × 는 메모에 이유 한 줄(예: 너무 어둡다·모양 이상).',
             '', '| n | id | 종류 | 쓰이는 판 | 시대 | 삼각형 | 툰 KB | 웹 KB | ○/× | 메모 |', '|---|---|---|---|---|---|---|---|---|---|']
    for k, i in enumerate(ids):
        e = info[i]
        lic = json.load(open(os.path.join(out, 'toon', i + '.license.json'), encoding='utf-8'))
        tk = os.path.getsize(os.path.join(out, 'toon', i + '.glb')) // 1024
        wk = os.path.getsize(os.path.join(out, 'web', i + '.glb')) // 1024
        lines.append(f'| {k + 1} | {i} | {KIND_KO[e["kind"]]} | {"·".join(e["games"])} | {e["era"] or "-"} | {lic.get("tris", "")} | {tk} | {wk} | | |')
    os.makedirs(os.path.dirname(sheet_md), exist_ok=True)
    with open(sheet_md, 'w', encoding='utf-8', newline='\n') as f:
        f.write('\n'.join(lines) + '\n')
    print(f'SHEET {len(ids)}개 · {sheet_md} · {os.path.join(out, "contact_sheet.png")}')


if __name__ == '__main__':
    main()
