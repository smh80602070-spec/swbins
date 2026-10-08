#!/usr/bin/env bash
# 참조 방향 게이트: 판끼리 서로 안 부르고, saga_core 는 판을 안 부른다.
#   games/saga_X 안에 res://games/saga_Y(Y≠X)가 있으면, saga_core 안에 res://games/ 가 있으면 파일:줄을 찍고 종료 1.
#   같은 줄에 `check_refs:allow` 주석이 있으면 봐준다(경로 문자열 판별용). (project.godot 의 autoload·메인 씬, 주석 안의 문자열도 .gd/.tscn/.tres 안이면 잡는다. 문서(docs)·tools 는 검사 밖.)
# 사용: bash tools/check_refs.sh   → 통과하면 출력 없음·종료 0
set -u
cd "$(dirname "$0")/.." || exit 1

bad=0
for dir in games/saga_*/; do
  x="$(basename "$dir")"
  # G-0118 — 줄 통째로 자기 판 경로를 빼면 같은 줄의 남의 판 경로도 빠졌다. 줄 안의 경로마다 판 이름을 본다.
  hits=$(grep -rIn --include=*.gd --include=*.tscn --include=*.tres "res://games/saga_" "$dir" | grep -v "check_refs:allow" | awk -v x="$x" '{ s = $0; bad = 0; while (match(s, "res:..games.saga_[a-z_]+/")) { if (substr(s, RSTART + 12, RLENGTH - 13) != x) bad = 1; s = substr(s, RSTART + RLENGTH) } if (bad) print substr($0, 1, 200) }')
  if [ -n "$hits" ]; then
    echo "$hits"
    bad=1
  fi
done
core=$(grep -rIn --include=*.gd --include=*.tscn --include=*.tres "res://games/" saga_core | grep -v "check_refs:allow" | cut -c1-200)
if [ -n "$core" ]; then
  echo "$core"
  bad=1
fi
exit $bad
