#!/usr/bin/env bash
# 커밋 전 자동 점검 (SAGA-DESIGN.md §8-5·§9) — Git Bash 에서 `bash tools/precheck.sh [폴더...]`
#   1) 웹 다섯 판 js 구문 (node -c, vendor 제외)
#   2) 바뀐 에셋 🔴 점검(tools/asset-audit --quick)
#   3) 문서 크기 상한 (CLAUDE.md 6KB · PLAN 70KB(사가블로 90KB) · PROJECT_STATE 15KB)
# 서버·브라우저는 띄우지 않는다. _test.html 진단은 사용자가 실기 확인할 때 따로 돈다.
set -u
cd "$(dirname "$0")/.." || exit 1
fail=0

echo "== js 구문"
targets=(); for a in "$@"; do [ "$a" = "--full" ] || targets+=("$a"); done; [ ${#targets[@]} -eq 0 ] && targets=(saga-web/saga-go saga-web/saga-dungeon saga-web/saga-forest saga-web/saga-story saga-web/saga-realm)
# node 한 번으로 전부 파싱하고 걸린 파일만 node --check 로 재판정(파일마다 띄우면 5분 → 수 초)
jsdirs=(); for d in "${targets[@]}"; do [ -d "$d/js" ] && jsdirs+=("$d/js"); done
[ ${#jsdirs[@]} -gt 0 ] && { node tools/hooks/syntax-check.js "${jsdirs[@]}" || fail=1; }

echo "== 도감 data.js 다섯 벌 md5 (루트 CLAUDE.md: 도감은 다섯 벌 함께 고치고 md5 로 확인)"
sums=""; for g in saga-go saga-dungeon saga-forest saga-story saga-realm; do
  p="saga-web/$g/js/data.js"; [ -f "$p" ] || continue
  s=$(md5sum "$p" | cut -c1-8); echo "$s $g"; sums="$sums $s"
done
distinct=$(echo "$sums" | tr ' ' '\n' | sed '/^$/d' | sort -u | wc -l)
if [ "$distinct" -gt 1 ]; then
  if git status --porcelain -- 'saga-web/*/js/data.js' | grep -q .; then
    echo "MISMATCH data.js 가 다섯 벌 다르고 지금 data.js 를 고치는 중이다 — 다섯 벌 함께 맞춘 뒤 커밋"; fail=1
  else
    echo "WARN data.js 다섯 벌이 이미 다르다(기존 어긋남, 이번 커밋과 무관). 도감을 손댈 때 함께 맞출 것"
  fi
fi

echo "== sw.js 캐시 버전 (판별 PLAN §7 함정: js/ 고치고 VERSION 안 올리면 옛 캐시를 계속 본다)"
for d in "${targets[@]}"; do
  [ -f "$d/sw.js" ] || continue
  if git status --porcelain -- "$d/js" 2>/dev/null | grep -q . && ! git status --porcelain -- "$d/sw.js" 2>/dev/null | grep -q .; then
    echo "WARN $d/js 를 고쳤는데 $d/sw.js VERSION 은 그대로다 — 서비스워커 옛 캐시로 남을 수 있다"
  fi
done

echo "== 에셋 빠른 점검 (tools/asset-audit --quick: 바뀐 에셋만 — 공개 저장소 유출·압축 GLB 디코더 누락·GitHub 100MB)"
PY=""; for c in "py -3" python3 python; do $c -c "import sys" >/dev/null 2>&1 && { PY=$c; break; }; done
if [ -n "$PY" ]; then
  PYTHONIOENCODING=utf-8 $PY tools/asset-audit/audit.py --quick || fail=1
else
  echo "WARN 파이썬이 없어 에셋 빠른 점검을 건너뛴다"
fi

echo "== 문서 크기"
limit() { # 파일 상한(바이트)
  local f=$1 max=$2; [ -f "$f" ] || return 0
  local n; n=$(wc -c <"$f")
  if [ "$n" -gt "$max" ]; then echo "OVER $f ${n}B > ${max}B"; fail=1; else echo "ok   $f ${n}B"; fi
}
limit CLAUDE.md 6144
for f in saga-web/*/CLAUDE.md saga-godot/CLAUDE.md saga-unity/CLAUDE.md; do limit "$f" 6144; done
limit SAGA-DESIGN.md 40960
for g in saga-go saga-forest saga-story saga-realm; do limit "saga-web/$g/PLAN.md" 71680; done
limit saga-web/saga-dungeon/PLAN.md 92160
limit saga-godot/docs/PROJECT_STATE.md 15360
limit saga-unity/docs/PROJECT_STATE.md 15360

echo "== � �� (--full | L�: tools/test-web.mjs all)"
for a in "$@"; do [ "$a" = "--full" ] && { node tools/test-web.mjs all || fail=1; break; }; done

[ $fail -eq 0 ] && echo "PRECHECK OK" || { echo "PRECHECK FAIL"; exit 1; }
