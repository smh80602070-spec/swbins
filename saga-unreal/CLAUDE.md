# saga-unreal

사가만리 한 판을 **언리얼 5.8 로 올려 보는 실험 트랙**(PC 전용, 시간 상자 티켓 넷). 정본은 이 폴더 `PLAN.md`(≤20KB, 통째 읽기 가능).
`saga-web/*`·`saga-godot/`·`saga-unity/` 는 건드리지 않는다. 코드 공유 없음. 공용 에셋(`saga-assets/`)·정본 데이터는 **읽기만**.

- 다음 일 = `tasks/unreal/QUEUE.md` 맨 위 티켓(E-). 절차는 `tasks/README.md` 그대로. 상태는 `docs/PROJECT_STATE.md`(덮어쓰기). 세션 기록은 티켓 메모·커밋 메시지뿐.
- **블루프린트 금지.** C++ + `Content/Data/*.json`(생성물) 로만 만든다. 바이너리 `.uasset` 은 Interchange 반입 결과와 `Content/Toon/` 머티리얼·후처리뿐이고, 그 값은 C++ `UDataAsset` 에서 읽는다.
- 승격 전엔 PLAN 9장 이후(이동·전투·세이브·시나리오·폰)를 만들지 않는다. 새 기능은 티켓 없이 만들지 않는다.

## 엔진 — PC 마다 다르다

```bash
source saga-unreal/tools/ue_env.sh   # UE_ROOT(기본 C:/Program Files/Epic Games/UE_5.8) · 없으면 "엔진 없음" 으로 모든 도구가 건너뛴다
ls "$UE_ROOT/Engine/Build/BatchFiles"
```

- 설치(런처 로그인·설치 클릭)·Visual Studio Build Tools 2022 C++ 워크로드·.NET 8 SDK 는 사람 몫. 끝나면 사용자가 `ue_env.sh` 의 경로만 알려 준다. 개인 경로·PC 이름은 커밋하지 않는다(기본값만).
- 디스크: 엔진 40GB + Build Tools 10GB + DDC. 이 PC 는 C: 여유 77GB 라 설치 전 20GB 이상 비운다.
- 언리얼 에디터·`UnrealEditor-Cmd` 는 **한 세션만** 띄운다. 띄우기 전 `tasklist | grep -i unreal` 로 확인. 끝나면 그 PID 만 `taskkill //F //T //PID`.

## 검증 (헤드리스)

```
bash saga-unreal/tools/ue_build.sh                      컴파일(UBT) 오류 0
bash saga-unreal/tools/ue_import.sh                     반입 .uasset 수 = 원본 수
bash saga-unreal/tools/ue_test.sh                       -ExecCmds="Automation RunTests Saga" 실패 0
bash saga-unreal/tools/ue_shot.sh go_village_wide       docs/playcheck/shots/<컷>.png (사용자 판정용 컷만)
```

- 첫 실행은 셰이더 컴파일로 10분 넘는다 → 백그라운드 + `</dev/null`. 대기 루프에 `pgrep` 금지(없다).
- 에디터가 `Config/*.ini`·`.uproject` 를 조용히 고쳐 쓴다. 커밋 전 `git diff -- saga-unreal/Config saga-unreal/SagaUnreal.uproject` 를 훑고 의도 밖 변경은 되돌린다.
- 커밋 금지: `Binaries/ Intermediate/ DerivedDataCache/ Saved/ .vs/ *.sln`(`.gitignore`). 반입 `.uasset` 은 커밋한다(다시 들이면 같은 결과, 수백 MB 넘으면 티켓 메모에 적고 멈춘다).
- 스크린샷은 확인 시트 컷(PLAN §6 셋)만. 작업 중 촬영 금지(루트 규칙).

## 하지 말 것

- 블루프린트·레벨 블루프린트·머티리얼 외 `.uasset` 손 편집 · Fab/Megascans 에셋(내 것 정책) · Lumen·Nanite 켜기(모바일 노선과 조건 맞춤) · 폰 빌드 · 다른 네 판 · 실명 표시.
