#!/usr/bin/env bash
# PLAN.md 110 ④ 빌드 재현성 — git 밖 사실 몸 폴더(Assets/Art/CharactersRealistic, Mixamo 원본·
# 약관상 공개 재배포 금지)를 어느 PC 에서나 "같은 파일 그대로" 두는 도구.
#
#   bash tools/realistic-pack.sh verify          # 지금 폴더가 목록(manifest)과 같은지 — 다르면 exit 1
#   bash tools/realistic-pack.sh fetch [보관함]  # 새 PC: 보관함의 묶음을 풀어 넣고 verify (한 방)
#   bash tools/realistic-pack.sh manifest        # 몸을 더하거나 고친 뒤: 목록 다시 쓰기(커밋 대상)
#   bash tools/realistic-pack.sh pack [보관함]   # 그 다음: 목록에 맞는 묶음을 보관함에 쓰기
#   bash tools/realistic-pack.sh push [원격] [보관함]  # 보관함의 이 목록 묶음을 구글 드라이브로 + md5 대조
#   bash tools/realistic-pack.sh pull [원격] [보관함]  # 새 PC: 드라이브에서 보관함으로 받고 md5 대조 → fetch
#
# 원격 기본값 = $SAGA_ASSET_REMOTE, 없으면 gdrive:saga-assets (rclone, 2026-09-28 사용자 결정).
# PC 마다 한 번: winget install Rclone.Rclone → rclone config create gdrive drive scope=drive
# (브라우저 승인은 사람 몫). 드라이브 폴더도 **비공개** — 공유 링크 만들지 않는다.
#
# 목록 tools/realistic/manifest.sha256 = `sha256sum` 형식(해시 두 칸 경로), .meta 까지 전부.
# .meta 가 빠지면 GUID 가 새로 나 커밋된 씬의 참조가 끊기므로 Mixamo 에서 다시 받는 것으로는
# 같은 빌드가 안 된다 — 그래서 받은 결과 폴더를 통째로 나른다.
# 묶음 이름 = saga-unity-realistic-<목록 해시 12자>.tar.NN (1900MB 조각 — 파일 하나 2GB 제한 대비).
# 보관함 기본값 = $SAGA_ASSET_STORE, 없으면 ~/saga-assets — 동기화 안 되는 로컬 자리, 원본 보관은 구글 드라이브
# (2026-09-28 사용자 결정, 전엔 ~/OneDrive/saga-assets 였다 — 거기 두면 pull·pack 이 4GB 를 OneDrive 에 다시 올린다).
# **비공개** 자리만 — 공개 저장소·공개 링크 금지.
# 빌드는 Editor/SagaAssetGate.cs 가 같은 목록으로 한 번 더 막는다.
set -u
cd "$(dirname "$0")/.." || exit 1
ROOT="$PWD"
SRC="Assets/Art/CharactersRealistic"
MAN="$ROOT/tools/realistic/manifest.sha256"
STAGE="$ROOT/.utmp/realistic-incoming"
DEFAULT_STORE="${SAGA_ASSET_STORE:-$HOME/saga-assets}"   # .utmp/ 는 gitignore, Assets 밖이라 Unity 가 안 읽는다
DEFAULT_REMOTE="${SAGA_ASSET_REMOTE:-gdrive:saga-assets}"
SELF="$ROOT/tools/$(basename "$0")"

die() { echo "[realistic-pack] $*" >&2; exit 1; }
# winget 은 PATH 를 새 셸부터 고치므로, 없으면 winget 설치 자리를 직접 찾는다
find_rclone() {
  RCLONE=$(command -v rclone 2>/dev/null) \
    || RCLONE=$(ls "$HOME"/AppData/Local/Microsoft/WinGet/Packages/Rclone.Rclone_*/*/rclone.exe 2>/dev/null | head -1)
  [ -n "$RCLONE" ] || die "rclone 없음 — winget install Rclone.Rclone 뒤 rclone config create gdrive drive scope=drive"
}
# $1 → $2 를 이 목록 묶음만 크기·md5 로 대조(드라이브는 md5 를 준다)
check_pack() {
  "$RCLONE" check "$1" "$2" --one-way --include "saga-unity-realistic-$(pack_id).*" \
    || die "대조 실패: $1 → $2 (다시 돌리면 다른 것만 다시 옮긴다)"
}
# 목록은 .gitattributes 로 바이트 그대로 받지만, 그래도 CR 이 끼면 떼고 읽는다(id·대조가 PC 마다 같게)
man_lf() { tr -d '\r' < "$MAN"; }
pack_id() { man_lf | sha256sum | cut -c1-12; }

# $1 폴더를 목록과 대조. 빠짐·다름 = 실패, 목록에 없는 파일 = 경고(목록이 낡았다는 뜻).
verify_dir() {
  local dir="$1" bad extra
  [ -f "$MAN" ] || die "목록 없음: tools/realistic/manifest.sha256"
  [ -d "$dir" ] || { echo "[realistic-pack] FAIL 폴더 없음: $dir — fetch <보관함> 으로 받는다"; return 1; }
  bad=$(cd "$dir" && sha256sum -c --quiet <(man_lf) 2>&1 | grep -v "^sha256sum: WARNING")
  extra=$(cd "$dir" && comm -13 <(man_lf | cut -c67- | LC_ALL=C sort) <(find . -type f | sed 's|^\./||' | LC_ALL=C sort))
  if [ -n "$extra" ]; then
    echo "[realistic-pack] 경고: 목록에 없는 파일 $(echo "$extra" | wc -l)개 (빌드가 쓰면 SagaAssetGate 가 막는다 — manifest·pack 다시):"
    echo "$extra" | head -10 | sed 's/^/  + /'
  fi
  if [ -n "$bad" ]; then
    echo "[realistic-pack] FAIL 목록과 다른 파일 $(echo "$bad" | wc -l)개:"
    echo "$bad" | head -20 | sed 's/^/  /'
    return 1
  fi
  echo "[realistic-pack] OK $(wc -l < "$MAN")개 파일 일치 (묶음 id $(pack_id))"
}

cmd="${1:-}"; shift || true
case "$cmd" in
  manifest)
    [ -d "$SRC" ] || die "폴더 없음: $SRC"
    mkdir -p "$(dirname "$MAN")"
    (cd "$SRC" && find . -type f | sed 's|^\./||' | LC_ALL=C sort | tr '\n' '\0' | xargs -0 sha256sum) > "$MAN.tmp" \
      && mv "$MAN.tmp" "$MAN" || die "목록 쓰기 실패"
    echo "[realistic-pack] 목록 $(wc -l < "$MAN")개 · $(du -sh "$SRC" | cut -f1) · 묶음 id $(pack_id)"
    echo "  다음: pack <보관함> · 목록 커밋 · 빌드 씬이 쓰는 몸이 바뀌었으면 Unity 에서 Saga/Build/Write Asset Gate Deps"
    ;;
  verify)
    verify_dir "$SRC"
    ;;
  pack)
    store="${1:-$DEFAULT_STORE}"
    verify_dir "$SRC" || die "목록과 다른 폴더는 묶지 않는다 — 먼저 manifest"
    mkdir -p "$store" || die "보관함을 못 만듦: $store"
    id=$(pack_id); base="$store/saga-unity-realistic-$id.tar"
    if ls "$base".* >/dev/null 2>&1; then echo "[realistic-pack] 이미 있음: $base.* — 건너뜀"; exit 0; fi
    # 목록 순서 그대로 묶는다(같은 목록 = 같은 내용). 조각은 .part 로 쓰고 다 되면 이름을 바꾼다.
    (cd "$SRC" && man_lf | cut -c67- | tar -cf - --no-recursion -T -) \
      | split -d -a 2 -b 1900M - "$base.part" || die "묶기 실패"
    for p in "$base".part*; do mv "$p" "$base.${p##*.part}"; done
    cp "$MAN" "$store/saga-unity-realistic-$id.manifest.sha256"
    echo "[realistic-pack] 묶음 $(ls "$base".* | wc -l)조각 → $store (id $id)"
    ls -l "$base".* | awk '{printf "  %6.0f MB  %s\n", $5/1048576, $NF}'
    ;;
  fetch)
    store="${1:-$DEFAULT_STORE}"   # saga-unity-realistic-<id>.tar.NN 이 든 곳 (클라우드 동기화 폴더면 동기화가 끝난 뒤에)
    [ -f "$MAN" ] || die "목록 없음"
    id=$(pack_id); base="$store/saga-unity-realistic-$id.tar"
    ls "$base".[0-9][0-9] >/dev/null 2>&1 || {
      echo "[realistic-pack] 보관함에 이 목록의 묶음(id $id)이 없다. 있는 것:" >&2
      ls "$store"/saga-unity-realistic-*.tar.00 2>/dev/null | sed 's/^/  /' >&2
      die "목록(커밋)과 묶음이 다르다 — 묶음을 만든 PC 에서 manifest·pack·커밋을 같이 했는지 확인"; }
    if [ -d "$SRC" ] && verify_dir "$SRC" >/dev/null 2>&1; then echo "[realistic-pack] 이미 목록과 같다 — 할 일 없음"; exit 0; fi
    rm -rf "$STAGE"; mkdir -p "$STAGE" || die "임시 폴더 실패"
    echo "[realistic-pack] 푸는 중: $(ls "$base".[0-9][0-9] | wc -l)조각 → .utmp/"
    cat "$base".[0-9][0-9] | tar -xf - -C "$STAGE" || die "풀기 실패"
    verify_dir "$STAGE" || die "푼 내용이 목록과 다르다(묶음 손상?) — $STAGE 에 남겨 둠"
    # 빈 폴더(몸 없이 Unity 를 열면 추적 중인 폴더 .meta 때문에 생긴다)는 그냥 치운다
    [ -d "$SRC" ] && [ -z "$(ls -A "$SRC")" ] && rmdir "$SRC"
    if [ -d "$SRC" ]; then   # 든 게 있는 옛 폴더는 지우지 않고 옆으로 치운다
      old="$ROOT/.utmp/realistic-old-$(date +%Y%m%d-%H%M%S)"
      mv "$SRC" "$old" || die "옛 폴더를 못 치움(Unity 가 잡고 있나?)"
      echo "[realistic-pack] 옛 폴더 → ${old#$ROOT/} (확인 뒤 지워도 된다)"
    fi
    mv "$STAGE" "$SRC" || die "제자리로 옮기기 실패"
    echo "[realistic-pack] OK 받음 — Unity 를 열면 가져오기(첫 회 오래 걸린다) 뒤 빌드 가능"
    ;;
  push)
    remote="${1:-$DEFAULT_REMOTE}"; store="${2:-$DEFAULT_STORE}"
    find_rclone; id=$(pack_id)
    ls "$store/saga-unity-realistic-$id".tar.[0-9][0-9] >/dev/null 2>&1 \
      || die "보관함에 이 목록의 묶음(id $id)이 없다 — 먼저 pack"
    echo "[realistic-pack] 올리는 중: $store → $remote (id $id, 이미 같은 건 건너뜀)"
    "$RCLONE" copy "$store" "$remote" --include "saga-unity-realistic-$id.*" --stats 1m --stats-one-line -v \
      || die "올리기 실패 — 다시 돌리면 이어서 올린다"
    check_pack "$store" "$remote"
    echo "[realistic-pack] OK 올림 (id $id):"
    "$RCLONE" ls "$remote" --include "saga-unity-realistic-$id.*" | sed 's/^/  /'
    ;;
  pull)
    remote="${1:-$DEFAULT_REMOTE}"; store="${2:-$DEFAULT_STORE}"
    find_rclone; id=$(pack_id)
    mkdir -p "$store" || die "보관함을 못 만듦: $store"
    echo "[realistic-pack] 받는 중: $remote → $store (id $id)"
    "$RCLONE" copy "$remote" "$store" --include "saga-unity-realistic-$id.*" --stats 1m --stats-one-line -v \
      || die "받기 실패 — 드라이브에 id $id 묶음이 있는지: rclone ls $remote"
    check_pack "$remote" "$store"
    bash "$SELF" fetch "$store"
    ;;
  *)
    sed -n '2,20p' "$SELF" | sed 's/^# \{0,1\}//'
    exit 1
    ;;
esac
