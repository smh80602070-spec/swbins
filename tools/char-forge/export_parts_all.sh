#!/usr/bin/env bash
# 샘플 VRM 25벌 → _out/parts/<소문자 글자>/ (base.glb + 옷 조각). 이미 있으면 건너뜀. T 는 재배포 불가라 뺀다.
#   bash tools/char-forge/export_parts_all.sh [VRM폴더(기본 Downloads)]
cd "$(dirname "$0")/../.."
SRC="${1:-/c/Users/user/Downloads}"
B="${BLENDER:-/c/Program Files/Blender Foundation/Blender 5.2/blender.exe}"
OUT=tools/char-forge/_out/parts
for L in a b c d e f g h i j k l m n o p q r s u v w x y z; do
  U=$(echo $L | tr a-z A-Z)
  [ -e "$OUT/$L/parts.json" ] && continue
  F="$SRC/AvatarSample_$U.vrm"; [ -e "$F" ] || F="saga-godot/assets/characters_vroid/AvatarSample_$U.vrm"
  [ -e "$F" ] || { echo "$L: VRM 없음"; continue; }
  echo "== $L"
  "$B" -b --factory-startup -P tools/char-forge/export_vrm_parts.py -- "$F" "$OUT/$L" </dev/null >/dev/null 2>&1
  [ -e "$OUT/$L/parts.json" ] || echo "$L: 실패"
done
echo EXPORT_DONE
