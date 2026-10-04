#!/usr/bin/env bash
# 웹 인물 3D(299, 저장소에 있음)를 Godot·Unity 용 일반 glTF 로 바꿔 들인다 — 웹과 같은 몸 한 벌을 세 트랙이 쓴다(사용자 10-04 "웹 버전으로 써도 되지 않나").
#   bash tools/char-forge/engine_characters.sh              # 변환만 → tools/char-forge/_out/engine_characters/ (git 밖, 이미 된 건 건너뜀)
#   bash tools/char-forge/engine_characters.sh --install godot|unity|all   # 변환 뒤 엔진 프로젝트 폴더로 복사(둘 다 .gitignore — 저장소에 안 올린다)
# 변환 = tools/glb-compress/decode.mjs: Meshopt·양자화 해제, WebP → JPEG/PNG. 출력은 <id>.gltf + <id>.bin + 공용 tex/ (몸마다 텍스처를 품지 않는다).
# 용량: 몸당 bin ≈1.7MB(float 지오메트리) × 299 ≈ 510MB + tex ≈ 35MB — 저장소 팩(1.9GB)을 더 키우지 않으려고 로컬 산출물로만 둔다. 웹 GLB 가 정본이라 어느 PC 에서든 다시 만든다.
# 엔진 쪽 몫: Godot = 동작 라이브러리(vroid_intake.sh / ual_lib_build.gd)·얼굴 데칼·셰이더, Unity = 프리팹·머티리얼. 임포트가 300개라 오래 걸리니 다른 세션이 안 쓸 때 설치한다.
# 동작은 tools/char-forge/_out/vroid/<id>/<id>_anims.glb(vroid_batch.sh, 18종) — 같은 J_Bip 뼈 이름이라 그대로 붙는다.
set -euo pipefail
cd "$(dirname "$0")/../.."
OUT=tools/char-forge/_out/engine_characters
node tools/glb-compress/decode.mjs saga-web/shared/assets/characters3d "$OUT"
if [ "${1:-}" = "--install" ]; then
  case "${2:-all}" in godot|all) mkdir -p saga-godot/assets/characters_dex && cp -r "$OUT"/. saga-godot/assets/characters_dex/ && echo "Godot 설치: saga-godot/assets/characters_dex";; esac
  case "${2:-all}" in unity|all) mkdir -p saga-unity/Assets/Art/CharactersDex && cp -r "$OUT"/. saga-unity/Assets/Art/CharactersDex/ && echo "Unity 설치: saga-unity/Assets/Art/CharactersDex";; esac
  # Unity 는 공용 동작 한 벌(dj_doseo 의 _anims.glb, 22종 — K-0066 으로 kneel·heal·taunt·blocked 포함)을 anims/crowd_anims.glb 로 쓴다.
  # 동작은 Blender 로 굽는 로컬 산출이라 없는 PC 는 `bash tools/char-forge/vroid_batch.sh --only dj_doseo`(몸 하나 약 3분, 입력 _in/vroid/dj_doseo.glb 필요) 뒤 다시.
  case "${2:-all}" in unity|all)
    if [ -e tools/char-forge/_out/vroid/dj_doseo/dj_doseo_anims.glb ]; then
      mkdir -p saga-unity/Assets/Art/CharactersDex/anims && cp tools/char-forge/_out/vroid/dj_doseo/dj_doseo_anims.glb saga-unity/Assets/Art/CharactersDex/anims/crowd_anims.glb && echo "Unity 공용 동작: anims/crowd_anims.glb"
    else echo "Unity 공용 동작 없음 — dj_doseo_anims.glb 를 먼저 굽는다(위 안내)"; fi;; esac
fi
