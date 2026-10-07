# saga-unreal — 언리얼 5 실험 트랙 (사가만리 한 판 · PC 전용)

**상태: 실험(시간 상자). 정식 트랙 아님.** 사용자 2026-10-07 "언리얼 엔진 버전을 추가 해보려고 하는데 — 우선 계획이랑 프롬프트라도".
정식 트랙 승격은 §8 판정 뒤 사용자 결정(`SAGA-ARCH.md` §8-1 범위 결정·`tools/wip.json` 개정이 따라야 한다).

## 0. 위치 — 왜 "실험"으로만 여는가

- `saga-godot/PLAN.md` 66-1(09-11)은 "언리얼 수준 3D" 요구를 검토해 **엔진 교체 안 함**으로 닫았다: 화면 차이는 엔진이 아니라 에셋·조명에서 나고, 모바일 목표라 Nanite·Lumen 은 꺼야 한다.
- `SAGA-ARCH.md` §1.2·§3.4(09-30)는 "지시 하나가 15개 게임에 곱해진다"를 원인으로 짚고 플래그십 셋 + 열둘 동결을 결정했다. 트랙 하나를 더 열면 곱셈이 15 → 20 이 된다.
- 10-01 결정으로 3D 에셋은 세 트랙 동일, 유니티도 툰 노선이다. 그래서 **언리얼이 보여 줄 수 있는 차이는 "같은 에셋을 언리얼 조명·후처리·안티에일리어싱으로 올리면 얼마나 달라 보이나" 하나뿐**이다. 이 실험은 그 하나만 잰다.
- 자동화 궁합: 블루프린트는 바이너리라 Claude 가 읽고 고칠 수 없다. **C++ + JSON 데이터 구동만** 쓴다(§4). 그래야 precheck·헤드리스 게이트가 다른 트랙과 같은 꼴이 된다.

**이 폴더는 `saga-godot/`·`saga-unity/`·`saga-web/` 를 건드리지 않는다. 코드 공유 없음.** 데이터·에셋은 저장소 공용(`saga-assets/`·`scenario/`·웹 `data.js`)에서 **읽기만** 한다.

## 1. 실험 질문 하나 (이것만 답한다)

> 사가만리의 **같은 인물·같은 마을·같은 들판**을 언리얼 5.8 에서 툰 셰이딩으로 올리면, 사가고돗(`tools/shot_scene.gd` 컷)·사가유니티 화면보다 사용자 눈에 **확연히** 나은가?

답은 §7 확인 시트(○/×, 10줄 아래)로 사용자가 낸다. "조금 낫다"는 ×다 — 트랙 하나를 더 끌 값이 안 된다.

## 2. 범위 (시간 상자 = 티켓 넷, 각 1세션)

| 티켓 | 하는 일 | 끝 |
|---|---|---|
| E-0001 | 환경·빈 C++ 프로젝트·헤드리스 컴파일 게이트·`.gitignore` | `bash saga-unreal/tools/ue_build.sh` 가 Development Editor 컴파일 OK |
| E-0002 | 정본 데이터(JSON) 로더 · VRoid 인물 glb 299 + 공용 동작 glb 반입 | 인물 5벌이 레벨에 서서 idle·walk 동작 |
| E-0003 | 마을 지역 1곳(`saga-assets/regions/village`) 땅·소품·하늘 · 툰 조명·후처리 | 마을 전경 레벨 1 |
| E-0004 | 촬영 컷 셋(인물 클로즈업·마을 전경·들판 무리) 헤드리스 · 확인 시트 · 고돗·유니티 같은 컷과 나란히 | 시트 1장 → 사용자 판정 |

**넣지 않는 것**: 이동·전투·세이브·UI·시나리오·탈것·폰 빌드·다른 네 판. 판정이 ○ 라도 이 넷 밖은 승격 결정(§8) 뒤 새 PLAN 장으로.

## 3. 환경 (이 PC 기준 — 다른 PC 는 E-0001 메모에 적는다)

- PC: Ryzen 5 5600 · RX 7600(8GB) · RAM 32GB · **C: 여유 77GB** — 언리얼 5.8 약 40GB + Visual Studio Build Tools C++ 약 10GB + DDC 수 GB. **설치 전 20GB 이상 비우거나 다른 드라이브에 설치**(E-0001 단계 0).
- 엔진: **Unreal Engine 5.8**(Epic Games Launcher 설치). 런처 로그인·설치 클릭은 사람 몫. 설치 경로는 `saga-unreal/tools/ue_env.sh` 의 `UE_ROOT` 한 줄로 PC 마다 다르게 둔다(저장소엔 기본값만, 개인 경로 커밋 금지).
- 컴파일: Visual Studio **Build Tools 2022**(C++ 데스크톱 워크로드 + Windows SDK + .NET 8 SDK). IDE 는 필요 없다. UBT 는 `Engine/Build/BatchFiles/Build.bat` 로 부른다.
- 폰: **안 한다**(Android Studio 2026.1.1·NDK 29·SDK 34~36 이 더 필요 — 실험 밖).
- 언리얼은 다른 세션이 동시에 열지 않는다(Unity·Godot 와 같은 규칙, `feedback_shared_engine_sessions`).

## 4. 아키텍처 — 블루프린트 0

```
saga-unreal/
  SagaUnreal.uproject          모듈 둘: SagaCore(데이터·로더·툰 셰이딩 설정) · SagaGo(사가만리 장면)
  Source/SagaCore/  Source/SagaGo/      C++ 만. 클래스는 UCLASS 로 두되 **블루프린트 파생 금지**
  Content/Data/heroes.json      생성물(웹 data.js → JSON, tools/gen_data.mjs). 손 편집 금지
  Content/Chars/  Content/World/   Interchange 로 들인 .uasset(기계 생성물 — 다시 들이면 같다)
  Content/Toon/   머티리얼·후처리 .uasset — 유일하게 손이 가는 바이너리. 파라미터는 전부 C++ 쪽 UDataAsset 에 두고 머티리얼은 그 값을 읽기만
  tools/ue_env.sh · ue_build.sh · ue_import.py · ue_shot.sh   게이트·반입·촬영
  docs/PROJECT_STATE.md(≤15KB 덮어쓰기) · docs/playcheck/   결과 파일
```

- **게이트(precheck 추가분, E-0001)**: `Content/**/*.uasset` 중 블루프린트(`/Script/Engine.Blueprint` 헤더) 0 · `Source/` 1500줄 넘김 금지(공통 규칙) · `Binaries/ Intermediate/ DerivedDataCache/ Saved/ .vs/` 커밋 금지.
- 데이터는 ARCH §4.1 과 같은 방향: 정본 `data/heroes.json` 이 생기면 그걸 읽고, 그 전엔 `saga-web/saga-go/js/data.js` 의 `HEROES` 를 node 로 뽑아 쓴다(이름 정책·id 불변은 저절로 따라온다).
- 툰 셰이딩: Lumen·Nanite **끔**(모바일 노선과 같은 조건), Forward 가 아니라 Deferred 유지 + 후처리 머티리얼 한 장(법선·깊이 외곽선 + 2단 램프) — 유니티 셀 셰이더·고돗 `toon` 재질과 **같은 단수·같은 외곽선 두께**로 맞춘다(비교 공정성). 값은 `Content/Toon/ToonParams`(UDataAsset) 하나.

## 5. 에셋 반입 (전부 저장소 공용 — 새 에셋 0)

| 무엇 | 원본 | 형식 | 방법 |
|---|---|---|---|
| 인물 299 | `saga-assets/characters/web3d/<id>.glb` (추적됨, 650KB 안팎, J_Bip 뼈, 동작·모프 없음) | glb | Interchange glTF → SkeletalMesh. 스켈레톤은 첫 벌에서 만들고 나머지는 그 스켈레톤에 붙인다 |
| 공용 동작 22종 | `tools/char-forge/_out/vroid/dj_doseo/dj_doseo_anims.glb` 또는 유니티 로컬 `saga-unity/Assets/Art/CharactersDex/anims/crowd_anims.glb`(둘 다 로컬 전용, 없으면 `vroid_batch.sh --only dj_doseo`) | glb | 같은 J_Bip 이름이라 스켈레톤 공유. glTF 동작 반입이 깨지면 **Blender 로 FBX 변환**(`tools/char-forge/_blender`)이 대안 — 티켓 E-0002 메모에 어느 길이었는지 남긴다 |
| 마을 땅·소품 | `saga-assets/regions/village/layout.json` + `regions/pieces/*.glb`(58) + `world/toon/*.glb`(730) | glb·json | StaticMesh 반입 뒤 layout.json 을 C++ 로 읽어 배치(고돗·유니티와 같은 자리) |
| 하늘 | `saga-assets/regions/village/sky_village_2k.jpg` | jpg | 스카이돔 머티리얼 |
| 출처 | 각 `.license.json` | — | `saga-assets/credits.json` 그대로. 언리얼 쪽 새 출처 0 (Fab·Megascans 안 씀) |

## 6. 검증 (헤드리스만 — 에디터 GUI 는 사용자 판정 때만)

```
컴파일   bash saga-unreal/tools/ue_build.sh            → UBT SagaUnrealEditor Win64 Development, 오류 0
반입     bash saga-unreal/tools/ue_import.sh            → UnrealEditor-Cmd -run=pythonscript -script=tools/ue_import.py, 생성 .uasset 수 = 원본 수
자동화   UnrealEditor-Cmd <proj> -ExecCmds="Automation RunTests Saga" -unattended -nopause -NullRHI -log  → 테스트 0 실패
촬영     bash saga-unreal/tools/ue_shot.sh <컷>         → -game -RenderOffscreen -ExecCmds="HighResShot 1600x900" 로 docs/playcheck/shots/<컷>.png
```

- 촬영 컷 이름은 고돗 `tools/shot_scene.gd` 와 맞춘다: `go_char_close`·`go_village_wide`·`go_field_crowd`. 고돗·유니티 같은 컷을 같은 크기로 옆에 둔다(확인 시트가 셋을 나란히).
- 모든 명령은 그 PC 의 `ue_env.sh` 를 읽고 엔진이 없으면 "엔진 없음" 한 줄로 **건너뛴다**(precheck 를 막지 않는다 — 엔진 없는 PC 에서 다른 갈래 커밋이 막히면 안 된다).

## 7. 확인 시트 (E-0004 산출, `tasks/sheets/unreal-<날짜>.md`, 10줄 아래)

| n | 보는 것 | 비교 | ○ 기준 |
|---|---|---|---|
| 1 | 인물 클로즈업(얼굴·머리·옷) | 고돗·유니티·언리얼 셋 나란히 | 언리얼이 "확연히" 낫다 |
| 2 | 마을 전경(땅·소품·하늘·그림자) | 셋 | 같음 |
| 3 | 들판 무리 20명 걷기 | 셋 | 같음 + 끊김 없음 |
| 4 | 같은 PC 프레임(1600×900) | 셋 수치 | 언리얼이 고돗의 70% 이상 |
| 5 | 빌드 크기(Win64 Shipping) | 셋 수치 | 참고만 |

## 8. 판정 → 다음

- **× 가 하나라도(1~3 중)**: 폐기. 폴더는 `archive/unreal/` 로 옮기고 PLAN 머리에 "폐기·이유" 두 줄. 엔진 설치는 사용자가 지울지 정한다.
- **1~3 전부 ○**: 사용자에게 승격 여부를 묻는다. 승격이면 ① `SAGA-ARCH.md` §8-1 범위 결정에 "언리얼 사가만리" 추가 ② `tools/wip.json` flagship ③ `tasks/QUEUE.md` 갈래 다섯째(E-) ④ 이 PLAN 에 9장부터(이동·전투 → 세이브 → 시나리오 1장 → 폰 검토). **승격 전엔 9장을 쓰지 않는다.**

## 9. 함정 (미리 아는 것)

- Interchange glTF 스켈레탈 반입은 FBX 보다 덜 다져졌다(5.5 에서 모프 오프셋 버그 보고). 인물 glb 는 모프가 없어 괜찮지만 **동작 glb 는 깨질 수 있다** → §5 FBX 대안.
- `UnrealEditor-Cmd` 첫 실행은 셰이더 컴파일로 10분 넘게 걸린다. 백그라운드로 돌리고 `</dev/null` 을 붙인다(고돗 헤드리스 stdin 함정과 같다). 대기 루프에 `pgrep` 없음.
- 에디터가 `DefaultEngine.ini`·`.uproject` 를 조용히 고쳐 쓴다(유니티 배치 모드와 같다). 커밋 전 `git diff -- saga-unreal/Config saga-unreal/*.uproject` 를 훑는다.
- DDC(`DerivedDataCache/`)가 수 GB 로 자란다. 커밋 금지·디스크 감시.
- 실명 금지·에셋 출처 규칙은 그대로(루트 `CLAUDE.md`). Fab 무료 에셋은 "내 것" 정책(09-27)에 어긋나므로 안 쓴다.
- 언리얼 EULA: 매출 100만 달러 넘는 분부터 5% 로열티. 상용화 판단 때 유니티(좌석 요금 없음, 매출 기준) 와 나란히 적는다.
