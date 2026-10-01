"""PLAN.md 를 쪼개 긴 본문을 docs/spec/ 으로 **원문 그대로** 옮긴다 (tasks U-0008). 내용은 지우지 않는다.

  py tools/plan-split.py [--plan PATH] chapter <시작정규식> <끝정규식|-> <spec이름>
        시작 줄(제목)부터 끝 줄 앞까지를 spec 으로 옮기고, PLAN 엔 시작 제목 한 줄 + 포인터 한 줄만 남긴다.
        끝정규식 `-` 는 파일 끝. spec 이 28000B 를 넘으면 줄 경계에서 `<이름>-1.md`, `-2.md` … 로 쪼갠다.
  py tools/plan-split.py [--plan PATH] cell <표 줄 정규식> <spec접두> [--marker "다음 ="]
        표 한 줄의 마지막 칸을 ` · ` 경계에서 ≤28000B 로 쪼개 `<접두>-1..n.md` 에 통째로(이어 붙이면 원래 칸) 옮기고,
        PLAN 칸에는 앞머리 굵은 글씨(상태 머리말)·포인터·`marker` 가 든 맨 끝 굵은 문장만 남긴다.
  py tools/plan-split.py [--plan PATH] verify <BASE rev>
        BASE 의 PLAN 줄이 모두 (PLAN + docs/spec/*.md 본문)에 원문 그대로 있는지 본다(표 칸 쪼갠 줄은 조각을 이어 붙여 비교).

spec 첫 줄은 `<!-- 옮김: … -->`(제목 아님) + 빈 줄. 게임 코드·HISTORY 는 건드리지 않는다. 의존 없는 python 한 파일.
"""
import argparse, glob, os, re, subprocess, sys

LIMIT = 28000  # spec 본문 상한(B) — precheck 상한 30720 에서 머리 주석 여유


def read_plan(path):
    raw = open(path, "rb").read().decode("utf-8")
    eol = "\r\n" if "\r\n" in raw else "\n"
    return raw.replace("\r\n", "\n").split("\n"), eol


def write_plan(path, lines, eol):
    open(path, "wb").write(eol.join(lines).encode("utf-8"))


def blen(s):
    return len(s.encode("utf-8"))


def spec_dir(plan):
    d = os.path.join(os.path.dirname(os.path.abspath(plan)), "docs", "spec")
    os.makedirs(d, exist_ok=True)
    return d


def head_hash(plan):
    try:
        return subprocess.check_output(["git", "-C", os.path.dirname(os.path.abspath(plan)), "rev-parse", "--short", "HEAD"], text=True).strip()
    except Exception:
        return "?"


def write_spec(path, header, body):
    assert blen(body) < 30720 - 400, f"{path} 본문 {blen(body)}B 가 상한을 넘는다"
    open(path, "wb").write((f"<!-- {header} -->\n\n" + body + "\n").encode("utf-8"))


def cmd_chapter(a):
    lines, eol = read_plan(a.plan)
    s = next((i for i, l in enumerate(lines) if re.search(a.start, l)), None)
    if s is None:
        sys.exit(f"시작 줄 없음: {a.start}")
    e = len(lines)
    if a.end != "-":
        e = next((i for i in range(s + 1, len(lines)) if re.search(a.end, lines[i])), None)
        if e is None:
            sys.exit(f"끝 줄 없음: {a.end}")
    block = lines[s:e]
    while block and block[-1] == "":
        block.pop()
    heads = [l for l in block if re.match(r"#{1,3} ", l)]
    # 줄 경계에서 LIMIT 이하로 쪼갠다
    chunks, cur, size = [], [], 0
    for l in block:
        n = blen(l) + 1
        if cur and size + n > LIMIT:
            chunks.append(cur); cur, size = [], 0
        if n > LIMIT:
            sys.exit(f"한 줄이 {n}B — cell 명령으로 먼저 쪼갤 것: {l[:60]}")
        cur.append(l); size += n
    chunks.append(cur)
    names = [a.name] if len(chunks) == 1 else [f"{a.name}-{i + 1}" for i in range(len(chunks))]
    sd = spec_dir(a.plan)
    h = head_hash(a.plan)
    for nm, ch in zip(names, chunks):
        write_spec(os.path.join(sd, nm + ".md"), f"옮김: PLAN.md `{lines[s][:60]}` · BASE {h}", "\n".join(ch))
    files = " · ".join(f"`docs/spec/{n}.md`" for n in names)
    span = f"제목 {len(heads)}개 `{heads[0][:40]}` … `{heads[-1][:40]}`" if len(heads) > 1 else "본문"
    pointer = f"> → {files} (원문 그대로 옮김 — {span}, tasks U-0008)"
    new = lines[:s + 1] + ["", pointer, ""] + lines[e:]
    write_plan(a.plan, new, eol)
    print(f"chapter: {len(block)}줄 {sum(blen(l) + 1 for l in block)}B → {len(names)}개 spec")


def cell_split(line):
    """표 줄 → (앞부분(마지막 ' | ' 까지 포함), 마지막 칸, 끝맺음)."""
    assert line.rstrip().endswith("|"), "표 줄이 아님"
    body = line.rstrip()[:-1].rstrip()          # 끝 '|' 제거
    i = body.rfind(" | ")
    return body[:i + 3], body[i + 3:], " |"


def cmd_cell(a):
    lines, eol = read_plan(a.plan)
    idx = [i for i, l in enumerate(lines) if re.search(a.line, l)]
    if len(idx) != 1:
        sys.exit(f"표 줄이 {len(idx)}개 맞음(1개여야 함): {a.line}")
    i = idx[0]
    head, cell, tail = cell_split(lines[i])
    # 쪼개기 — ' · ' 경계(구분자 포함해서 앞 조각에 둔다), 이어 붙이면 cell 과 정확히 같다
    parts, pos = [], 0
    while pos < len(cell):
        rest = cell[pos:]
        if blen(rest) <= LIMIT:
            parts.append(rest); break
        cut = len(rest)
        while blen(rest[:cut]) > LIMIT:
            cut -= 1
        k = rest.rfind(" · ", 0, cut)
        k = (k + 3) if k > 0 else cut
        parts.append(rest[:k]); pos += k
    assert "".join(parts) == cell
    sd = spec_dir(a.plan)
    h = head_hash(a.plan)
    names = [f"{a.prefix}-{n + 1}" for n in range(len(parts))]
    for nm, p in zip(names, parts):
        write_spec(os.path.join(sd, nm + ".md"), f"옮김: PLAN.md 표 칸 `{head[:50].strip()}…` {names.index(nm) + 1}/{len(parts)} · 이어 붙이면 원래 칸 · BASE {h}", p)
    # PLAN 칸에 남길 것 — 앞머리 굵은 글씨, 마지막 marker 문장(굵은 글씨 단위)
    mh = re.match(r"\*\*.+?\*\*", cell)
    headline = mh.group(0) if mh else ""
    keep_tail = ""
    k = cell.rfind(a.marker)
    if k >= 0:
        if cell[:k].count("**") % 2 == 1:          # 굵은 글씨 안 — 그 열린 `**` 부터(짝이 맞게)
            o = cell.rfind("**", 0, k)
        else:                                      # 굵은 글씨 밖 — 마지막 문장 머리부터
            o = max(cell.rfind(" · ", 0, k) + 3, cell.rfind(". ", 0, k) + 2, 0)
        if blen(cell[o:]) > 600:
            o = k
        if not mh or o >= len(mh.group(0)):
            keep_tail = cell[o:]
    files = " · ".join(f"`docs/spec/{n}.md`" for n in names)
    newcell = " ".join(x for x in [headline, f"→ {files} (원문 그대로 — 이어 붙이면 원래 칸, tasks U-0008)", keep_tail] if x)
    lines[i] = head + newcell + tail
    write_plan(a.plan, lines, eol)
    print(f"cell: {blen(cell)}B → {len(parts)}개 spec, PLAN 줄 {blen(lines[i])}B")


def cmd_verify(a):
    plan_dir = os.path.dirname(os.path.abspath(a.plan))
    base = subprocess.check_output(["git", "-C", plan_dir, "show", f"{a.base}:./{os.path.basename(a.plan)}"]).decode("utf-8").replace("\r\n", "\n").split("\n")
    cur, _ = read_plan(a.plan)
    corpus = set(cur)
    specs = {}
    for f in sorted(glob.glob(os.path.join(plan_dir, "docs", "spec", "*.md"))):
        t = open(f, "rb").read().decode("utf-8").replace("\r\n", "\n")
        body = t.split("\n", 2)[2] if t.startswith("<!--") else t
        body = body[:-1] if body.endswith("\n") else body
        specs[os.path.basename(f)] = body
        corpus.update(body.split("\n"))
    cur_cells = [l for l in cur if "docs/spec/" in l and l.rstrip().endswith("|")]
    bad = 0
    for b in base:
        if b in corpus:
            continue
        ok = False
        if b.rstrip().endswith("|"):
            hb, cb, _ = cell_split(b)
            for n in cur_cells:
                hn, cn, _ = cell_split(n)
                if hn != hb:
                    continue
                m = re.search(r"docs/spec/([\w.\-]+?)-1\.md", cn)
                if not m:
                    continue
                pre, j, joined = m.group(1), 1, ""
                while f"{pre}-{j}.md" in specs:
                    joined += specs[f"{pre}-{j}.md"]; j += 1
                if joined == cb:
                    ok = True
                    break
        if not ok:
            bad += 1
            print("없어짐:", b[:100])
    size = os.path.getsize(a.plan)
    big = [n for n, t in specs.items() if blen(t) + 100 >= 30720]
    print(f"BASE 줄 {len(base)}개 중 없어짐 {bad} · PLAN {size}B · spec {len(specs)}개" + (f" · 상한 근접 {big}" if big else ""))
    sys.exit(1 if bad else 0)


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    ap = argparse.ArgumentParser()
    ap.add_argument("--plan", default="PLAN.md")
    sub = ap.add_subparsers(dest="cmd", required=True)
    c = sub.add_parser("chapter"); c.add_argument("start"); c.add_argument("end"); c.add_argument("name")
    d = sub.add_parser("cell"); d.add_argument("line"); d.add_argument("prefix"); d.add_argument("--marker", default="다음 =")
    v = sub.add_parser("verify"); v.add_argument("base")
    a = ap.parse_args()
    {"chapter": cmd_chapter, "cell": cmd_cell, "verify": cmd_verify}[a.cmd](a)


if __name__ == "__main__":
    main()
