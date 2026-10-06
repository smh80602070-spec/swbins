#!/usr/bin/env bash
# 한 폴더(C:\swbins)를 여러 갈래 세션이 같이 쓸 때의 푸시·받기 (W-0075)
#   bash tools/push.sh          origin 에 아직 없는 내 커밋을 임시 트리(origin/main 위)로 옮겨 푸시 → 로컬 main 을 origin 에 맞춘다
#   bash tools/push.sh --pull   받기만(로컬 main 맞추기) — `git pull` 대신. 남의 작업 중 파일 때문에
#                               "would be overwritten by merge/checkout" 으로 멈추던 것을 피한다
# 규칙: 남의 미커밋 파일은 건드리지 않는다(겹치면 그 파일만 남기고 보고) · autostash·강제 푸시 없음
#       체리픽 충돌이 sw.js VERSION 줄뿐이면 origin 쪽 +1 로 풀고, 그 밖 충돌이면 멈추고 보고
set -u
cd "$(dirname "$0")/.." || exit 1
git config core.longpaths true
say() { echo "[push] $*"; }

bump() { # $1 = sw.js 경로 — VERSION 마지막 숫자 +1
  node -e '
    const fs = require("fs"), p = process.argv[1], s = fs.readFileSync(p, "utf8");
    const t = s.replace(/var VERSION = '"'"'([^'"'"']*?)(\d+)'"'"';/, (m, a, n) => "var VERSION = '"'"'" + a + (+n + 1) + "'"'"';");
    if (t === s) process.exit(1); fs.writeFileSync(p, t); console.log(/var VERSION = [^;]*/.exec(t)[0]);' "$1"
}

align() {
  git fetch -q origin || { say "fetch 실패"; return 1; }
  local old new; old=$(git rev-parse HEAD); new=$(git rev-parse origin/main)
  if [ "$old" = "$new" ]; then say "로컬 main = origin — 맞출 것 없음"; return 0; fi
  local ahead; ahead=$(git cherry origin/main HEAD | grep -c '^+')
  if [ "$ahead" -gt 0 ] && [ "${1:-}" != "--trusted" ]; then say "origin 에 없는 내 커밋 ${ahead}개 — 먼저 'bash tools/push.sh' (맞추면 잃는다)"; return 1; fi
  declare -A dirty=() staged=()
  local e f
  while IFS= read -r -d '' e; do dirty["${e:3}"]=1; case "${e:0:1}" in R|C) IFS= read -r -d '' f; dirty["$f"]=1;; esac; done \
    < <(git status --porcelain=v1 -z --untracked-files=all)
  while IFS= read -r -d '' f; do staged["$f"]=1; done < <(git diff --cached --name-only -z)
  local changed=() kept=() clean=() gone=() n=0
  while IFS= read -r -d '' f; do changed+=("$f"); done < <(git diff --name-only --no-renames -z "$old" "$new")
  declare -A del=(); while IFS= read -r -d '' f; do del["$f"]=1; done < <(git diff --name-only --no-renames --diff-filter=D -z "$old" "$new")
  git reset -q --mixed "$new" || { say "reset 실패"; return 1; }
  # 바뀐 파일 중 남이 작업 중인 것: 작업본이 이미 origin 내용과 같으면(그 세션이 올린 것) 정리됨, 다르면 남긴다 — git 한두 번으로 일괄
  declare -A differ=()
  while IFS= read -r -d '' f; do differ["$f"]=1; done < <(git diff --name-only -z; git ls-files -o -z --exclude-standard)
  for f in "${changed[@]}"; do
    if [ -n "${dirty[$f]:-}" ]; then [ -n "${differ[$f]:-}" ] && kept+=("$f")
    elif [ -z "${del[$f]:-}" ]; then clean+=("$f")
    else gone+=("$f"); fi
  done
  [ ${#clean[@]} -gt 0 ] && printf '%s\0' "${clean[@]}" | git checkout-index -f -z --stdin
  [ ${#gone[@]} -gt 0 ] && printf '%s\0' "${gone[@]}" | xargs -0 rm -f --
  n=$(( ${#clean[@]} + ${#gone[@]} ))
  declare -A inch=(); for f in "${changed[@]}"; do inch["$f"]=1; done
  local re=() s; for s in "${!staged[@]}"; do [ -z "${inch[$s]:-}" ] && re+=("$s"); done
  [ ${#re[@]} -gt 0 ] && git add -A -- "${re[@]}" 2>/dev/null   # 남이 add 해 둔 것은 다시 add(reset 이 풀었으니)
  say "로컬 main → $(git log --oneline -1 HEAD | cut -c1-70)  (origin 쪽 파일 ${n}개 갱신)"
  if [ ${#kept[@]} -gt 0 ]; then
    say "작업 중 사본을 남긴 파일 ${#kept[@]}개(origin 도 바꿨다 — 그 세션이 커밋하거나 정리할 것):"
    printf '         %s\n' "${kept[@]}"
  fi
  return 0
}

[ "${1:-}" = "--pull" ] && { align; exit $?; }

git fetch -q origin || { say "fetch 실패"; exit 1; }
mapfile -t mine < <(git cherry origin/main HEAD | sed -n 's/^+ //p')
if [ ${#mine[@]} -eq 0 ]; then say "올릴 커밋 없음"; align; exit $?; fi

W="/c/swt-$$"
cleanup() { git worktree remove --force "$W" >/dev/null 2>&1; git worktree prune >/dev/null 2>&1; }
trap cleanup EXIT

attempt() {
  cleanup
  git fetch -q origin
  git worktree add -q --detach "$W" origin/main || { say "임시 트리 실패"; return 2; }
  local c u bad
  for c in "${mine[@]}"; do
    if ! git -C "$W" cherry-pick "$c" >/dev/null 2>&1; then
      u=$(git -C "$W" diff --name-only --diff-filter=U)
      bad=$(printf '%s\n' "$u" | grep -v '^saga-web/[^/]*/sw\.js$' || true)
      if [ -z "$u" ] && [ -z "$(git -C "$W" status --porcelain)" ]; then   # 이미 올라간 내용(손으로 옮기며 조금 달라진 커밋) — 건너뜀
        git -C "$W" cherry-pick --skip >/dev/null 2>&1; say "이미 origin 에 있음 — 건너뜀: $(git log --oneline -1 "$c" | cut -c1-60)"; continue
      fi
      if [ -n "$bad" ] || [ -z "$u" ]; then
        git -C "$W" cherry-pick --abort >/dev/null 2>&1
        say "충돌 — $(git log --oneline -1 "$c" | cut -c1-60):"; printf '         %s\n' $bad
        return 2
      fi
      for f in $u; do git -C "$W" checkout -q --ours -- "$f"; bump "$W/$f" >/dev/null; git -C "$W" add -- "$f"; done
      git -C "$W" -c core.editor=true cherry-pick --continue >/dev/null || { say "체리픽 마무리 실패"; return 2; }
      say "sw.js VERSION 겹침 → origin 쪽 +1 로 풂($u)"
    fi
  done
  # 내 js 는 바뀌었는데 sw.js 가 origin 과 같아졌으면(같은 날 남도 같은 수로 올림) 한 번 더 올린다
  local g fixed=()
  for g in saga-go saga-dungeon saga-forest saga-story saga-realm; do
    [ -f "$W/saga-web/$g/sw.js" ] || continue
    if ! git -C "$W" diff --quiet origin/main HEAD -- "saga-web/$g/js" "saga-web/$g/dist" \
       && git -C "$W" diff --quiet origin/main HEAD -- "saga-web/$g/sw.js"; then
      bump "$W/saga-web/$g/sw.js" >/dev/null && fixed+=("saga-web/$g/sw.js")
    fi
  done
  if [ ${#fixed[@]} -gt 0 ]; then
    git -C "$W" commit -q -m "[push.sh] sw VERSION +1 — 같은 날 다른 커밋과 버전이 겹쳐 옛 캐시에 묻히지 않게" -- "${fixed[@]}"
    say "sw.js VERSION +1: ${fixed[*]}"
  fi
  git -C "$W" push -q origin HEAD:main 2>/dev/null || return 1
  return 0
}

attempt; r=$?
[ $r -eq 1 ] && { say "푸시 거부 — origin 이 그새 바뀜, 한 번 더"; attempt; r=$?; }
[ $r -ne 0 ] && { say "푸시 못 함(위 사유). 로컬 커밋은 그대로 있다"; exit 1; }
say "푸시: $(git -C "$W" log --oneline -1 HEAD | cut -c1-70)"
cleanup
align --trusted   # 방금 내 커밋을 전부 올렸다(또는 이미 있어 건너뜀) — 그 커밋들 때문에 맞추기를 거절하지 않는다
