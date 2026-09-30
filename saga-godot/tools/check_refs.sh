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
  hits=$(grep -rIn --include=*.gd --include=*.tscn --include=*.tres "res://games/saga_" "$dir" | grep -v "res://games/$x/" | grep -v "check_refs:allow" | cut -c1-200)
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
