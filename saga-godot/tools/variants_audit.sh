#!/usr/bin/env bash
# assets/generated/variants 참조 조사 — 코드가 안 부르는 파일의 목록·용량을 docs/variants_unused.txt 로 낸다. 지우지 않는다(삭제는 K-0010).
#   참조 집합 = .gd/.tscn/.tres/.json/.cfg/.sh/.mjs 안의 "variants/<이름>.glb" 리터럴 + `<glb>.import` 의 uid:// 가 코드에 쓰인 것.
#   (assets/generated/variants·docs·.godot·tools/_out 안은 세지 않는다. 경로를 동적으로 조립하는 코드는 지금 0 — 생기면 이 도구가 놓친다.)
#   A 안 부르는 glb · B 그 glb 의 png 묶음(<glb이름>_<N>.png) · C 부르는 glb 의 png 묶음(질감이 glb 안에 내장돼 코드 참조 0, 가부는 K-0010) · D 주인 없는 png.
# 사용: bash tools/variants_audit.sh   → docs/variants_unused.txt 생성, 종료 0(깨진 참조가 있으면 1)
set -u
cd "$(dirname "$0")/.." || exit 1
V=assets/generated/variants
OUT=docs/variants_unused.txt
[ -d "$V" ] || { echo "$V 없음" >&2; exit 2; }
INC=(--include=*.gd --include=*.tscn --include=*.tres --include=*.json --include=*.cfg --include=*.sh --include=*.mjs --include=project.godot)
EXC=(--exclude-dir=.godot --exclude-dir=docs --exclude-dir=_out --exclude-dir=variants)

declare -A used_name used_uid
while IFS= read -r n; do used_name["$n"]=1; done < <(grep -rIoh "${INC[@]}" "${EXC[@]}" "variants/[A-Za-z0-9_.-]*\.glb" . | sed 's#.*/##' | sort -u)
while IFS= read -r u; do used_uid["$u"]=1; done < <(grep -rIoh "${INC[@]}" "${EXC[@]}" "uid://[a-z0-9]*" . | sort -u)

size() { stat -c %s "$1" 2>/dev/null || echo 0; }
mb() { awk -v b="$1" 'BEGIN{printf "%.1f", b/1048576}'; }

A=(); Bn=0; Bb=0; Cn=0; Cb=0; An=0; Ab=0; Un=0; Ub=0
declare -A owned
Alist=""; Blist=""; Clist=""
for f in "$V"/*.glb; do
  name="$(basename "$f")"; stem="${name%.glb}"
  imp="$f.import"
  uid=""; [ -f "$imp" ] && uid="$(grep -o 'uid://[a-z0-9]*' "$imp" | head -1)"
  g=$(( $(size "$f") + $(size "$imp") ))
  # 이 glb 의 png 묶음
  pn=0; pb=0; plist=""
  for p in "$V/${stem}"_[0-9]*.png; do
    [ -f "$p" ] || continue
    owned["$p"]=1
    pb=$(( pb + $(size "$p") + $(size "$p.import") )); pn=$((pn + 1))
  done
  if [ -n "${used_name[$name]:-}" ] || { [ -n "$uid" ] && [ -n "${used_uid[$uid]:-}" ]; }; then
    Un=$((Un + 1)); Ub=$((Ub + g))
    Cn=$((Cn + pn)); Cb=$((Cb + pb))
    [ "$pn" -gt 0 ] && Clist+="$(printf '%10d  %s (png %d개)\n' "$pb" "$V/$stem" "$pn")"$'\n'
  else
    An=$((An + 1)); Ab=$((Ab + g))
    Bn=$((Bn + pn)); Bb=$((Bb + pb))
    Alist+="$(printf '%10d  %s.glb\n' "$g" "$V/$stem")"$'\n'
    [ "$pn" -gt 0 ] && Blist+="$(printf '%10d  %s_*.png (%d개)\n' "$pb" "$V/$stem" "$pn")"$'\n'
  fi
done
Dn=0; Db=0; Dlist=""
for p in "$V"/*.png; do
  [ -n "${owned[$p]:-}" ] && continue
  s=$(( $(size "$p") + $(size "$p.import") )); Dn=$((Dn + 1)); Db=$((Db + s))
  Dlist+="$(printf '%10d  %s\n' "$s" "$p")"$'\n'
done
# 깨진 참조: 코드는 부르는데 파일이 없다
broken=""
for n in "${!used_name[@]}"; do [ -f "$V/$n" ] || broken+="  $V/$n"$'\n'; done

total=$(du -cb "$V"/* 2>/dev/null | tail -1 | cut -f1)
{
  echo "참조됨   glb ${Un}개 + import  $((Un * 2))파일 · $(mb "$Ub")MB   (코드가 부르는 glb)"
  echo "안 됨    glb ${An}개 + png 묶음 ${Bn}개 + import · $(mb $((Ab + Bb)))MB   (A+B — 삭제 후보, 결정은 K-0010)"
  echo "참조 없는 png(C)  부르는 glb 의 png ${Cn}개 · $(mb "$Cb")MB   (glb 안에 질감이 내장돼 코드 참조 0 — 가부는 K-0010)"
  echo "주인 없는 png(D)  ${Dn}개 · $(mb "$Db")MB"
  echo "합계 확인  $(mb $((Ub + Ab + Bb + Cb + Db)))MB / 폴더 $(mb "$total")MB"
  echo "생성: tools/variants_audit.sh — 손으로 고치지 않는다(덮어쓴다). 삭제·이동은 하지 않았다."
  echo
  echo "## A 안 부르는 glb (바이트, glb+import)"; printf '%s' "$Alist"; echo
  echo "## B A 의 png 묶음 (바이트, png+import)"; printf '%s' "$Blist"; echo
  echo "## C 부르는 glb 의 png 묶음 (바이트)"; printf '%s' "$Clist"; echo
  echo "## D 주인 없는 png (바이트)"; printf '%s' "$Dlist"; echo
  echo "## 깨진 참조 (코드는 부르는데 파일 없음)"; if [ -n "$broken" ]; then printf '%s' "$broken"; else echo "  없음"; fi
} > "$OUT"
head -5 "$OUT"
[ -z "$broken" ]
