# W-0019 `toon3d.js` 뼈대를 shared 로 — 1단계(글자까지 같은 네 함수), 나머지 갈래는 설계만 (번호가 새 큐 티켓과 겹쳐 파일 이름을 바꿈 — 커밋 메시지의 해당 번호는 이 파일)
종류: 통합(R-4) · 웹 다섯      상태: **1단계 끝**(2026-10-01) — 2단계는 화면 확인이 필요해 보류

**목표(한 줄)**: 다섯 판 `toon3d.js` 에 복제된 코드 중 **글자까지 똑같은 것만** `shared/js/toon3d-core.js` 하나로 뺀다. 렌더 결과·손잡이(`world3d.toon`·`world3d.rim`) 불변.

**조사(함수 본문을 주석·공백 뺀 md5 로 비교)**
| 함수 | 같은 판 |
|---|---|
| `ramp`·`TOON_ON`·`RIM_ON`·`applyRimLight` | **다섯 판 전부 같다** → 1단계로 뺐다 |
| `cloneMat` | 사가의숲만 없고 넷이 같다 |
| `toonify` | 사가고·사가블로 한 벌 / 사가의숲·사가국지·사가스토리 한 벌 |
| `lambertLike` | 사가의숲·사가국지·사가스토리 같다(사가고·사가블로엔 없음) |
| `SKY_ON`·`skyBackground` | 사가국지·사가스토리 같다 |
| `outlineMaterial`·`outline`·`smoothOutlineNormals`·`OUTLINE_ON` | **판마다 다르다**(사가의숲은 `addOutline`·부품 거르기, 사가국지는 시야 거리 폭, 사가스토리는 등급 색) |
| 톤매핑(`toneRenderer`·`lightGain`)·`gradeTint`·`jobLook`·`recolorOutlines` | 한 판 전용 |

**1단계(이 티켓)**: `shared/js/toon3d-core.js`(`DG.toon3dCore` = `ramp·TOON_ON·RIM_ON·applyRimLight`). 각 `toon3d.js` 는 그 네 함수를 걷고 `var K = DG.toon3dCore; var ramp = K.ramp, …` 별칭만 둔다(공개 객체 `DG.toon3d` 의 모양 불변). `shared/js/toon3d.js`(사가고·사가블로 정본)도 같은 변환. `manifest`·`index`·`_test`·`sw.js` 목록(+VERSION ×5)·`sync-shared.mjs`(다섯 판 전부).

**2단계(보류 — 설계 결정이 먼저)**: `toonify`·`cloneMat`·`lambertLike`·`SKY_*` 처럼 "한 판만 다른" 것을 core 에 올릴지, 판별 `toon3d.js` 에 둘지. 올리면 짧아지지만 `toonify` 두 변종은 화면 비교(툰 재질이 바뀜)가 필요해 실기 확인 몫. 외곽선 네 갈래는 렌더가 달라 **합치지 않는 것이 기본**(사용자가 한 모양으로 통일하자고 정할 때만).

**검증**
```
node tools/sync-shared.mjs --check     → OK 48개 사본
node tools/gen-index.mjs --check       → OK 5판
node tools/test-web.mjs all            → 전과 같은 값(사가고 844·사가블로 437·사가국지 266 전부 통과, 사가의숲 392/393·사가스토리 259/260 기존 실패 이름 같음)
bash tools/precheck.sh                 → PRECHECK OK
```

**불변 규칙 확인**: 외곽선·톤매핑 등 렌더 코드 손대지 않음 · 세이브 키 불변 · 이름·시각 변경 0.

**메모(체크포인트)**:
- 한 번 `span()` 의 주석 탐색 실수로 함수 몇 개가 과하게 잘려 `node -c` 가 걸렸다 — 되돌리고 "바로 앞 한 덩어리 주석만" 으로 고쳐 다시 했다. 정본이 `shared/js/toon3d.js` 라 판 사본(go·dungeon)만 고치면 `sync-shared` 가 덮어쓴다.
- 사가스토리는 `toon3d.js` 가 `<script>` 묶음 맨 앞이라 `gen-index --add` 가 안 먹어 manifest 에 직접 끼우고 `gen-index` 로 html 을 만들었다.
