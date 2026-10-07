"""
G-0058 — `assets/world/*.glb` 중 코드·씬 어디서도 안 쓰이는 것을 센다. 읽기만 한다(에셋·코드 무변경).

    python saga-godot/tools/unused_world_glb.py      # → saga-godot/docs/unused_world_glb.md 덮어쓰기, 끝 줄 UNUSED_GLB total=… used=… unused=…

쓰임 판정(본보기 tools/asset-audit/reflect.py 의 "느슨" 기준을 고돗 한 폴더로 좁힘)
  직접  games/·saga_core/ 의 .gd·.tscn·.tres·.json 에 이름(확장자 뺀 줄기)이 글자 그대로(앞뒤가 영숫자·밑줄이 아닌 자리) 나온다.
  조립  이름을 뒤에서부터 "_" 로 잘라 낸 접두어(예: mon_wolf_alpha → mon_wolf_ · mon_)가 따옴표나 경로 끝에 붙어
        조립 꼴로 나온다 — `"mon_" + id` · `"mon_%s"` · `"res://assets/world/mon_" + id` · `"%swpn_%s_%s.glb"`(앞이 %s) (접두어 바로 뒤가 따옴표·%·{ 일 때).
  안 씀 둘 다 아님.
묶음 = 이름의 첫 마디 + "_"(eq_·acc_·wpn_·mon_·boss_·cave_·int_ …). 표의 합계는 늘 glb 파일 수와 같다.
파이썬은 이 PC 엔 블렌더에 딸린 것("C:/Program Files/Blender Foundation/Blender 5.2/5.2/python/bin/python.exe")으로 돌렸다.
"""
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
PROJ = os.path.dirname(HERE)
WORLD = os.path.join(PROJ, "assets", "world")
CODE_DIRS = [os.path.join(PROJ, "games"), os.path.join(PROJ, "saga_core")]
CODE_EXT = (".gd", ".tscn", ".tres", ".json")
OUT = os.path.join(PROJ, "docs", "unused_world_glb.md")
ORDER = ["mon_", "boss_", "eq_", "acc_", "wpn_", "cave_", "int_"]


def corpus() -> str:
    parts = []
    for d in CODE_DIRS:
        for root, _dirs, files in os.walk(d):
            for f in sorted(files):
                if f.endswith(CODE_EXT):
                    with open(os.path.join(root, f), "rb") as fh:
                        parts.append(fh.read().decode("utf-8", "replace"))
    return "\n".join(parts)


def prefixes(stem: str) -> list:
    segs = stem.split("_")
    return ["_".join(segs[:i]) + "_" for i in range(len(segs) - 1, 0, -1)]


def main() -> int:
    text = corpus()
    stems = sorted(f[:-4] for f in os.listdir(WORLD) if f.lower().endswith(".glb"))
    rows = {}
    for s in stems:
        if re.search(r"(?<![A-Za-z0-9_])" + re.escape(s) + r"(?![A-Za-z0-9_])", text):
            kind = "direct"
        elif any(re.search(r"(?:[\"'/]|%s)" + re.escape(p) + r"(?=[\"'%{])", text) for p in prefixes(s)):
            kind = "assembled"
        else:
            kind = "unused"
        g = s.split("_")[0] + "_" if "_" in s else "(밑줄 없음)"
        rows.setdefault(g, []).append((s, kind))

    groups = [g for g in ORDER if g in rows] + sorted(g for g in rows if g not in ORDER)
    lines = [
        "# assets/world 안 쓰이는 GLB (생성물 — 손으로 고치지 않는다)",
        "",
        "`python saga-godot/tools/unused_world_glb.py` 가 덮어쓴다(G-0058). 직접 = 이름이 코드·씬에 그대로 · 조립 = 접두어 조립 꼴(`\"mon_\" + id` 등) · 안 씀 = 둘 다 아님.",
        "",
        "| 묶음 | 전체 | 직접 | 조립 | 안 씀 |",
        "|---|---|---|---|---|",
    ]
    tot = {"all": 0, "direct": 0, "assembled": 0, "unused": 0}
    small = {"all": 0, "direct": 0, "assembled": 0, "unused": 0}
    for g in groups:
        r = rows[g]
        c = {k: sum(1 for _s, kk in r if kk == k) for k in ("direct", "assembled", "unused")}
        for k in c:
            tot[k] += c[k]
        tot["all"] += len(r)
        if g in ORDER or len(r) >= 5:
            lines.append("| `%s` | %d | %d | %d | %d |" % (g, len(r), c["direct"], c["assembled"], c["unused"]))
        else:
            small["all"] += len(r)
            for k in c:
                small[k] += c[k]
    lines.append("| 그 밖(4개 이하 묶음) | %d | %d | %d | %d |" % (small["all"], small["direct"], small["assembled"], small["unused"]))
    lines.append("| **합계** | **%d** | **%d** | **%d** | **%d** |" % (tot["all"], tot["direct"], tot["assembled"], tot["unused"]))
    lines += ["", "## 안 쓰는 이름", ""]
    for g in groups:
        un = [s for s, k in rows[g] if k == "unused"]
        if un:
            lines.append("- `%s` %d — %s" % (g, len(un), " · ".join(un)))
    lines.append("")
    with open(OUT, "wb") as fh:
        fh.write("\n".join(lines).encode("utf-8"))
    print("UNUSED_GLB total=%d used=%d unused=%d glb_files=%d" % (tot["all"], tot["direct"] + tot["assembled"], tot["unused"], len(stems)))
    return 0 if tot["all"] == len(stems) else 1


if __name__ == "__main__":
    sys.exit(main())
