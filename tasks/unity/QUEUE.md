# 유니티 갈래 큐 — "사가유니티 이어해"

경로: `saga-unity/`. 배치 실행은 항상 `bash tools/unity-batch.sh -- …`(설정 4파일 원복). 사실 몸 묶음 없는 PC 면 `realistic-pack.sh verify` 먼저, 없으면 `SagaRebuildScenes` 금지.

| 순서 | 티켓 | 종류 | 상태 |
|---|---|---|---|
| 1 | [U-0001](U-0001.md) `Editor/PlaytestKit.cs` — 세이브 격리·Check·오류 카운트, DUNGEON 에 적용 | 닫기 | 완료 |
| 2 | [U-0002](U-0002.md) asmdef 셋(SagaStory·SagaRealm·SagaTitle) | 통합 | 진행중 |
| 3 | [U-0003](U-0003.md) 5곳 동일 복제 → SagaCore(`PlatformVolumeProfile`·`DebugHud`) | 통합 | 작성됨 |
| 4 | [U-0004](U-0004.md) `docs/STATE.md`(생성) + `features.json` + CLAUDE.md 95KB 정정 | 측정 | 작성됨 |
| 5 | [U-0005](U-0005.md) `ISaveState` + 공통 마이그레이션, REALM 도 옮긴다 | 통합 | 초안 |
| 6 | [U-0006](U-0006.md) 나머지 복제 6개 → SagaCore(NpcIdle·VirtualJoystick·HitSpark·DamagePopup·LocalizedButtonLabel·GroundDecal) | 통합 | 초안 |
| 7 | [U-0007](U-0007.md) `MountField`×4 → `Saga.Core.MountRig` + `MountConfig` | 통합 | 초안 |
| 8 | [U-0008](U-0008.md) PLAN 372KB → `PLAN.md`(≤100KB) + `docs/spec/` | 통합 | 초안 |
| 9 | [U-0009](U-0009.md) 시나리오 표 → `Resources/scenario_<판>.json` + 로더 | 통합 | 초안 |
| 10 | [U-0010](U-0010.md) Playtest 3,000줄 초과 셋 분할 | 통합 | 초안 |
| 11 | [U-0011](U-0011.md) AAB 790MB — 안 쓰는 몸 제외·텍스처 2K 상한·PAD 실측(배치) | 닫기 | 초안 |
| 12 | [U-0012](U-0012.md) 프로젝트 6000.3.24f1 승격 커밋(원복 우회 종료) | 통합 | 초안 |
| 13 | [U-0013](U-0013.md) 첫 10분 사명(DUNGEON·GO) | 새기능(P0) | 초안 |
| 14 | [U-0014](U-0014.md) 배경음 `Saga.Core.Bgm`(곡은 K-0004) | 새기능(P0) | 초안 |
