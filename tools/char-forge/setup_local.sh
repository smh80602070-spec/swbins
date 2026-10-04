#!/usr/bin/env bash
# 이 PC 에 없는 "저장소 밖" 인물 에셋을 한 번에 만든다 — git pull 뒤 이 한 줄이면 된다(두 번째 실행은 아무것도 안 한다).
#   bash tools/char-forge/setup_local.sh            # 엔진 프로젝트가 있는 트랙(saga-godot·saga-unity)만 인물 299 변환본을 설치
#   bash tools/char-forge/setup_local.sh --bg       # 같은 일을 백그라운드로(로그 tools/char-forge/_out/setup_local.log)
#   bash tools/char-forge/setup_local.sh --check    # 뭐가 빠졌는지만 본다(아무것도 안 만듦)
# 하는 일: ① tools/glb-compress/node_modules 없으면 npm install ② 트랙마다 assets/characters_dex(고돗)·Assets/Art/CharactersDex(유니티)가
#   299 벌(<id>.gltf)이 아니면 engine_characters.sh --install <트랙>. 웹은 정본 GLB 를 그대로 읽어 할 일이 없다.
# 안 하는 일: 인물 동작(_out/vroid/<id>/<id>_anims.glb)은 Blender 로 굽는다(오래 걸림) — 필요하면 `bash tools/char-forge/vroid_batch.sh` 를 따로.
# 엔진(Godot·Unity)이 다른 세션에서 열려 있으면 .import/.meta 는 그 에디터가 새로 만든다 — 이 스크립트는 파일만 놓는다.
set -u
cd "$(dirname "$0")/../.."
MODE="run"
for a in "$@"; do case "$a" in --bg) MODE="bg";; --check) MODE="check";; esac; done
if [ "$MODE" = "bg" ]; then
  mkdir -p tools/char-forge/_out
  nohup bash "$0" > tools/char-forge/_out/setup_local.log 2>&1 </dev/null &
  echo "백그라운드로 시작 — 로그 tools/char-forge/_out/setup_local.log"
  exit 0
fi

want=299
count() { ls "$1"/*.gltf 2>/dev/null | wc -l; }
need=""
[ -d saga-godot ] && [ "$(count saga-godot/assets/characters_dex)" -lt "$want" ] && need="$need godot"
[ -d saga-unity ] && [ "$(count saga-unity/Assets/Art/CharactersDex)" -lt "$want" ] && need="$need unity"
if [ -z "$need" ]; then echo "SETUP_OK 인물 변환본 이미 있음(또는 엔진 프로젝트 없음)"; exit 0; fi
echo "빠진 트랙:$need"
[ "$MODE" = "check" ] && { echo "SETUP_MISSING$need"; exit 1; }

command -v node >/dev/null 2>&1 || { echo "SETUP_FAIL node 가 없다 — Node.js 설치 뒤 다시"; exit 2; }
if [ ! -d tools/glb-compress/node_modules ]; then
  echo "== npm install (tools/glb-compress)"
  (cd tools/glb-compress && npm install --no-audit --no-fund) || { echo "SETUP_FAIL npm install"; exit 3; }
fi
for t in $need; do
  echo "== 인물 변환본 설치: $t"
  bash tools/char-forge/engine_characters.sh --install "$t" || { echo "SETUP_FAIL $t"; exit 4; }
done
echo "SETUP_DONE$need — 엔진을 한 번 열어 .import/.meta 를 만든다"
