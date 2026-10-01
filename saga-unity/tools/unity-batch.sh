#!/usr/bin/env bash
# Unity 배치 모드 실행 → 동적 글꼴 아틀라스 오염 원복을 한 줄로 (PLAN.md 104-1 ①, tasks U-0012)
# 프로젝트는 설치판(6000.3.24f1)과 같은 버전이라 ProjectVersion·manifest 는 더 이상 안 고쳐 써진다 — 원복하는 건 Playtest 가
# TMP 동적 아틀라스에 글자를 써 넣어 부풀리는 폰트 SDF 에셋 셋뿐이다(Regular 만 +4만 줄). 이 셋은 커밋하지 않는다.
# 사용: bash tools/unity-batch.sh -- -batchmode -nographics -quit -projectPath <경로> -logFile <경로> [...]
set -u
cd "$(dirname "$0")/.." || exit 1

if [ "${1:-}" = "--" ]; then shift; fi
if [ $# -eq 0 ]; then
  echo "사용: bash tools/unity-batch.sh -- <Unity.exe 인자...>" >&2
  exit 1
fi

"$@"
status=$?

git checkout -- \
  "Assets/Art/Fonts/NotoEmoji/NotoEmoji SDF.asset" \
  "Assets/Art/Fonts/NotoSansKR/NotoSansKR-Bold SDF.asset" \
  "Assets/Art/Fonts/NotoSansKR/NotoSansKR-Regular SDF.asset" 2>/dev/null

echo "== git status (폰트 SDF 3개 원복 후, saga-unity/ 안만)"
git status --porcelain .

exit $status
