# 앱 크기 — AAB 분포·한도·절감안 (tasks U-0011)

숫자는 `Build/Android/SAGA_report.txt`·`SAGA_assets.txt`(2026-09-29 빌드, 이 PC·공방 몸 묶음 있음) 기준. 다시 재려면 빌드 뒤 `py tools/aab-breakdown.py`.

## 지금 상태

| 항목 | 값 | 한도 |
|---|---|---|
| 앱 번들(AAB) | 790.1 MB | — |
| base 모듈 | 38.2 MB | 200 MB |
| 설치 시점 에셋 팩(`UnityDataAssetPack`) | 751.2 MB | 1,536 MB |
| 빌드 크기(압축 전) | 2,856.7 MB | — |

Play Asset Delivery 분할(`splitApplicationBinary`, 첫 씬 밖 데이터 → 설치 시점 에셋 팩)은 이미 되어 있다 — `SagaPlayerBuild.BuildAndroidAab` + `PlaytestSagaAab`. 텍스처 상한 2048 도 이미 적용(`CharactersForge/Textures` PNG 525개 전부 `maxTextureSize 2048`, Android 오버라이드 2048, 압축 Normal).

## 무엇이 큰가 (포장 크기 합 1,208 MB · 4,583개)

| 폴더 | MB | 개 | % |
|---|---|---|---|
| `Assets/Art/CharactersForge/Textures` | 622.0 | 292 | 51.5 |
| `Assets/Art/CharactersRealistic`(Mixamo 몸 60) | 324.6 | 440 | 26.9 |
| `Assets/Art/CharactersForge`(기타 — FBX·재질) | 123.8 | 1,122 | 10.2 |
| `Assets/Art/Props`(Poly Haven 등) | 86.2 | 157 | 7.1 |
| 그 밖(오디오 12.5 · 글꼴 11.0 · 환경 10.8 · …) | 약 50 | | 4 |

공방 몸 105벌(`CharactersForge/Resources/ForgeHero`, 로컬 전용 `.gitignore`)은 Resources 라 전부 실린다 — 게임은 `PartyBodies.ForgeHero` 가 한 벌씩 읽는다. 참조된 것만 실리므로 "씬이 안 쓰는 몸 제외"는 사실상 이미 성립. **공방 몸이 없는 PC 의 빌드는 이보다 훨씬 작다**(이 표는 공방 몸이 있는 빌드).

## 더 줄이려면 — 사용자 결정 필요 (미적용)

화질 규칙(PLAN 110·SAGA-DESIGN §6.1-B "화질은 안 낮춘다")과 부딪혀 임의로 안 한다.

| 안 | 내용 | 추정 절감 | 대가 |
|---|---|---|---|
| (a) ASTC 블록 키우기 | 공방 텍스처 importer `textureCompression` Normal(6×6) → Low(8×8) | 약 -40% ≈ -250 MB(추정) | 2K 옷감 무늬가 폰에서 조금 뭉개짐(눈으로 확인 필요) |
| (b) 조연 1K | 도감 인물 중 조연 몸 텍스처 2048 → 1024 | 그 텍스처의 약 -75% | 조연 근접 화질 |
| (c) on-demand 팩 | `ForgeHero` 105벌을 설치 후 내려받는 에셋 팩으로(Addressables) | 설치 용량에서 ≈ -700 MB | 구조 변경·내려받기 대기·오프라인 첫 실행 처리 |

참고: base 200 MB·설치 시점 팩 1,536 MB 한도는 지금 넉넉하다 — 크기를 줄이는 이유는 한도가 아니라 **내려받는 용량**이다.
