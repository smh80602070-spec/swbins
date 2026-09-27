# 스토어 제출 목록 — Google Play (PLAN.md 110 ⑥ 끝 조건)

상태만 적는다(덮어쓴다). 경위는 `docs/HISTORY.md`. **사람** = 사용자만 할 수 있는 칸(계정·키·판단).
정책 수치(대상 API·테스트 인원)는 해마다 바뀐다 — 올리기 직전 Play Console 안내로 한 번 더 확인한다.

## 빌드

| 항목 | 상태 | 어떻게 |
|---|---|---|
| 앱 번들(AAB) + Play Asset Delivery | 도구 완료(⑥d) · **실물 빌드는 사실 몸 묶음 있는 PC 에서** | `-executeMethod Saga.EditorTools.SagaPlayerBuild.BuildAndroidAab` → `Build/Android/SAGA.aab` + `SAGA_report.txt`(모듈별 크기·서명). 첫 씬(타이틀)+코드 = base, 나머지 데이터 = 설치 시점 에셋 팩(설치 때 같이 받음, 런타임 코드 없음). base 200MB·팩 1.5GB·설치 시점 4GB 를 넘으면 FAIL |
| 업로드 서명 키 | **사람** | 아래 "업로드 키" 절. 없으면 디버그 서명 = Play 가 안 받는다 |
| Play 앱 서명 | **사람** | 첫 업로드 때 "Google 이 관리하는 앱 서명 키" 선택(업로드 키를 잃어도 재설정 요청 가능) |
| 앱 id `io.github.smh8627jpg.saga` | 완료(⑥b) | 올리면 못 바꾼다 |
| 버전 | 완료(⑥a) | `PlayerSettings.bundleVersion` 한 곳, 버전 코드 = a·10000+b·100+c. **올릴 때마다 올린다** |
| 64비트·IL2CPP | 완료 | ARM64 만 |
| 대상 API | 시험 빌드 targetSdk **36** · minSdk 25(`PlaytestSagaAab` 가 매번 적는다) | Play 요구 수준보다 낮아지면 Unity Hub 에서 SDK 올리기 |
| 권한 | 시험 빌드 매니페스트: VIBRATE · INTERNET(Unity 라이브러리 기본, 일반 권한 — 게임 코드엔 네트워크 없음) · **FOREGROUND_SERVICE · FOREGROUND_SERVICE_DATA_SYNC**(Google `asset-delivery 2.1.0` 이 빠른 후속·주문형 팩 추출 서비스용으로 붙임 — 우리는 설치 시점 팩만 써서 실제론 안 돈다) | 올릴 때 Play Console 이 포그라운드 서비스 신고를 물으면 "데이터 동기화 — 에셋 팩 추출(라이브러리)"로 답한다. 신고가 막히면 매니페스트에서 둘과 추출 서비스를 빼는 안 — **폰 실기 시험 필요**(안 해 봄) |
| 크기(예상) | 시험 빌드(타이틀+국지): base 36.8MB(코드+타이틀) · 팩 22MB | 전체 빌드도 base 는 코드+타이틀이라 비슷, 나머지(APK 470MB 분)는 팩으로 — 묶음 있는 PC 에서 실측 |

## 스토어 등록 정보

| 항목 | 상태 |
|---|---|
| 앱 이름 "SAGA" · 짧은 설명(80자) · 전체 설명(4000자) — 한·영 | 초안 없음 |
| 아이콘 512×512 PNG | 임시 "史" 가 `Assets/Art/Icon/` 에 있음 — 512 로 내보내기 필요 · 진짜 그림은 **사람** |
| 기능 그래픽 1024×500 | 없음 |
| 스크린숏(폰 2장 이상, 가로) | 없음 — 실기 캡처(**사람**) |
| 카테고리 · 연락처 이메일 | **사람** |

## 정책 양식

| 항목 | 상태 |
|---|---|
| 개인정보처리방침 URL | 필요(모든 앱). 계정·서버·광고·분석 없음, 저장은 기기 안 → 짧은 방침 한 장을 공개 주소에 두면 된다. 문구·주소는 **사람** 결정 |
| 데이터 보안 양식 | 게임 코드는 수집·전송 없음(오류 기록 `error_log.txt` 는 기기 안, 복사는 사용자가 직접). **결정 필요**: Unity 하드웨어 통계 `submitAnalytics: 1` 이 켜져 있다 — 끄거나 양식에 반영 |
| 콘텐츠 등급(IARC 설문) | **사람** — 판타지 전투(피 없음)·도박 없음·사용자 간 소통 없음 |
| 대상 연령 · 광고 | 광고 없음 · 연령은 **사람** |
| 앱 액세스 | 로그인 없음 |
| 새 개인 개발자 계정 비공개 테스트 | **사람** — 프로덕션 전 비공개 테스트(인원·기간 요건) |

## 이미 된 것

크레딧·오픈소스 고지(⑥a, 타이틀 "크레딧") · 오류 기록(⑥a) · 앱 id·회사명·아이콘 자리(⑥b) · 영어 검수 도구(⑥c — 사람 검수 `docs/en_review.tsv` 남음) · 템플릿 잔재 패키지·파일 정리(⑥e, 고지 59KB) · 흐름·일시정지·자동 저장(②) · UI 세 화면비(⑤).

## 업로드 키 만들기(사람, 한 번)

```bat
"C:\Program Files\Unity\Hub\Editor\6000.3.23f1\Editor\Data\PlaybackEngines\AndroidPlayer\OpenJDK\bin\keytool.exe" -genkeypair -keystore saga-upload.jks -alias saga -keyalg RSA -keysize 2048 -validity 10000
```

- 파일은 **저장소 밖**에 두고 두 곳 이상 백업(저장소 `.gitignore` 가 `*.jks`·`*.keystore` 를 막지만 애초에 안 넣는다). 암호는 따로 적어 둔다.
- 빌드할 때만 환경 변수 넷: `SAGA_KEYSTORE`(경로) · `SAGA_KEYSTORE_PASS` · `SAGA_KEY_ALIAS` · `SAGA_KEY_PASS`(비우면 저장소 암호). 빌드 스크립트가 그 빌드 동안만 걸고 끝나면 설정에서 지운다.
