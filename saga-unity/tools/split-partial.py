"""큰 `public [static] class` 를 partial 파일로 쪼갠다 (tasks U-0010). 본문은 한 글자도 안 바꾸고 멤버 단위로 옮긴다.

  py tools/split-partial.py <원본.cs> <새파일.cs> <첫멤버>[..<끝멤버>]

첫~끝 멤버(메서드, 앞의 `///` 주석·`[특성]` 줄 포함, 포함 범위)를 잘라 새 파일로 옮긴다. 새 파일은 원본과 같은 `using`·`namespace`·
`public static partial class X` 머리를 갖고, 원본 클래스 선언은 `partial` 로 바뀐다. 멤버는 이름으로 지정(중복 이름이면 중단).
멤버 끝은 8칸 들여쓴 `}` 줄(문자열 속 중괄호에 안 속게) 또는 `=>` 한 줄 식. 파일 인코딩(BOM)·줄바꿈(CRLF/LF)은 원본을 따른다.
의존 없는 python 한 파일.
"""
import re, sys

MEMBER = r"^        (?:\[.*\]\s*)?(?:public |private |internal |protected )?(?:static )?(?:readonly )?[\w<>\[\],.?()]+(?: [\w<>\[\],.?()]+)* {name}\("


def find_member(lines, name):
    pat = re.compile(MEMBER.format(name=re.escape(name)))
    hits = [i for i, l in enumerate(lines) if pat.match(l) and not l.strip().startswith(("if", "for", "while", "return", "else", "var ", "foreach", "//"))]
    if len(hits) != 1:
        sys.exit(f"멤버 {name} 이(가) {len(hits)}곳 — 1곳이어야 한다")
    i = hits[0]
    s = i
    while s > 0 and (lines[s - 1].strip().startswith("///") or re.match(r"^        \[.*\]\s*$", lines[s - 1])):
        s -= 1
    if lines[i].rstrip().endswith(";") and "=>" in lines[i]:
        return s, i
    j = i + 1
    while j < len(lines) and lines[j] != "        }":
        j += 1
    if j >= len(lines):
        sys.exit(f"멤버 {name} 의 끝 `        }}` 를 못 찾음")
    return s, j


def main():
    if len(sys.argv) != 4:
        sys.exit(__doc__)
    orig, new, spec = sys.argv[1:]
    first, _, last = spec.partition("..")
    last = last or first
    raw = open(orig, "rb").read()
    bom = raw.startswith(b"\xef\xbb\xbf")
    text = raw.decode("utf-8-sig")
    eol = "\r\n" if "\r\n" in text else "\n"
    lines = text.replace("\r\n", "\n").split("\n")

    CLS = r"^    public (static )?(?:partial )?class (\w+)"
    cls = next((i for i, l in enumerate(lines) if re.match(CLS, l)), None)
    if cls is None:
        sys.exit("`    public [static] class X` 를 못 찾음")
    cm = re.match(CLS, lines[cls])
    cname = cm.group(2)
    kw = "public static" if cm.group(1) else "public"  # 비정적 클래스(MonoBehaviour 등)도 쪼갠다
    ns = next(i for i, l in enumerate(lines) if l.startswith("namespace "))
    # 머리 = namespace 줄과 그 `{` 까지(using 포함)
    head_end = ns + 1 if lines[ns + 1].strip() == "{" else ns
    head = lines[:head_end + 1]

    s1, e1 = find_member(lines, first)
    s2, e2 = find_member(lines, last)
    if s2 < s1:
        sys.exit("끝 멤버가 첫 멤버보다 앞에 있다")
    s, e = s1, e2
    block = lines[s:e + 1]
    # 앞쪽 빈 줄 하나를 같이 빼서 원본에 이중 빈 줄이 안 남게
    cut_s = s - 1 if s > 0 and lines[s - 1] == "" else s
    before = sum(1 for l in lines if re.match(MEMBER.format(name=r"\w+"), l))

    rest = lines[:cut_s] + lines[e + 1:]
    rest[cls] = rest[cls].replace(f"{kw} class", f"{kw} partial class", 1)
    newlines = head + [f"    /// <summary>`{cname}` 의 일부(partial) — tasks U-0010 분할.</summary>", f"    {kw} partial class {cname}", "    {"] + block + ["    }", "}", ""]
    enc = (lambda t: ("﻿" if bom else "") + t)
    open(orig, "wb").write(enc(eol.join(rest)).encode("utf-8"))
    open(new, "wb").write(enc(eol.join(newlines)).encode("utf-8"))
    print(f"{orig}: {len(lines)}줄 → {len(rest)}줄 · {new}: {len(newlines)}줄 · 멤버 {before}개 중 {sum(1 for l in block if re.match(MEMBER.format(name=r'\\w+'), l))}개 이동")


if __name__ == "__main__":
    main()
