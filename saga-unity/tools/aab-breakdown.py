"""빌드에 실린 에셋 크기를 폴더별·확장자별로 집계한다 (tasks U-0011). 읽기만 한다 — 게임·설정은 안 건드린다.

  py tools/aab-breakdown.py [assets.txt] [--fail-over MB] [--top N]

assets.txt = `SagaPlayerBuild` 가 빌드 끝에 쓰는 `Build/Android/SAGA_assets.txt`(`<포장 크기 B>\\t<경로>` 줄). 기본값은 그 파일.
`Assets/Art/<둘째 폴더>` 단위로 합치되 공방(`CharactersForge`)은 Textures · Resources(ForgeHero) · 기타로 나눈다.
`--fail-over MB`: 전체 합이 그 값을 넘으면 종료 코드 1(예산 게이트). `Build/` 는 gitignore 라 빌드 전엔 파일이 없다 — 그땐 안내만 하고 종료 코드 2.
의존 없는 python 한 파일.
"""
import argparse, collections, os, re, sys

MB = 1024 * 1024


def group(path):
    parts = path.split("/")
    if path.startswith("Assets/Art/CharactersForge"):
        if path.startswith("Assets/Art/CharactersForge/Textures"):
            return "Assets/Art/CharactersForge/Textures"
        if path.startswith("Assets/Art/CharactersForge/Resources"):
            return "Assets/Art/CharactersForge/Resources (ForgeHero)"
        return "Assets/Art/CharactersForge (기타)"
    if path.startswith("Assets/Art/") and len(parts) > 3:
        return "/".join(parts[:3])
    if path.startswith("Packages/") and len(parts) > 1:
        return "Packages/" + parts[1]
    return "/".join(parts[:2]) if len(parts) > 2 else path


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    here = os.path.dirname(os.path.abspath(__file__))
    ap = argparse.ArgumentParser()
    ap.add_argument("assets", nargs="?", default=os.path.join(here, "..", "Build", "Android", "SAGA_assets.txt"))
    ap.add_argument("--fail-over", type=float, default=None, help="전체 합(MB)이 이보다 크면 종료 코드 1")
    ap.add_argument("--top", type=int, default=15)
    a = ap.parse_args()
    if not os.path.exists(a.assets):
        print(f"{a.assets} 가 없다 — 빌드를 먼저 돌려야 한다(`Saga/Build/Android App Bundle`, 배치는 tools/unity-batch.sh).")
        sys.exit(2)
    by, cnt, ext = collections.Counter(), collections.Counter(), collections.Counter()
    for line in open(a.assets, encoding="utf-8", errors="replace"):
        m = re.match(r"^(\d+)\t(.+?)\r?$", line)
        if not m:
            continue
        sz, p = int(m.group(1)), m.group(2)
        g = group(p)
        by[g] += sz; cnt[g] += 1
        ext[p.rsplit(".", 1)[-1].lower() if "." in p.rsplit("/", 1)[-1] else "(없음)"] += sz
    total = sum(by.values())
    n = sum(cnt.values())
    print(f"에셋 {n}개 · 합 {total / MB:,.0f} MB  ({a.assets})")
    print(f"{'MB':>8} {'개':>6} {'%':>5}  폴더")
    for k, v in by.most_common(a.top):
        print(f"{v / MB:8.1f} {cnt[k]:6d} {100 * v / total:5.1f}  {k}")
    rest = total - sum(v for _, v in by.most_common(a.top))
    if rest > 0:
        print(f"{rest / MB:8.1f} {'':6} {100 * rest / total:5.1f}  (그 밖 {len(by) - a.top}개 폴더)")
    print("확장자:", " · ".join(f"{e} {v / MB:,.0f}MB" for e, v in ext.most_common(6)))
    if a.fail_over is not None and total / MB > a.fail_over:
        print(f"예산 초과: {total / MB:,.0f} MB > {a.fail_over:g} MB")
        sys.exit(1)


if __name__ == "__main__":
    main()
