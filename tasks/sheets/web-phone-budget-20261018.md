# 웹 다섯 판 폰 예산 — W-0302 (2026-10-18, 오퍼스 측정)

재는 법: `node saga-web/tools/playcheck/pw-phone-budget.mjs --gpu --runs=3` — 헤드리스 크롬이 **실제 GPU**(이 PC Radeon Pro 570X, D3D11)로 그리고, 폰 흉내 = 390×844 · 화소비 2 · 터치 · **CPU 4배 감속** · 품질은 판의 "자동" 그대로(손잡이 안 건드림). 용량 = 계정 만든 뒤 다시 불러와 첫 장면까지 받은 바이트(캐시 끔). FPS = 장면 8초 뒤 3초 rAF. 상한: 첫 화면 25MB · FPS 30 · 그리기 300.

CPU 4배 감속은 이 PC(옛 데스크톱 CPU) 기준이라 중급 폰보다 비관적일 수 있다 — 감속 없이는 1만리 HIGH 들판 41fps·걷기 58fps. 아래 "남은 거리"는 이 흉내 기준이다. 실폰 숫자는 아니다.

## 표 (3회 평균)

| 판 | 첫 화면 MB | 장면 1 | 장면 2 | 자동 단계 | 바꾸기 전(1회) |
| --- | --- | --- | --- | --- | --- |
| 1만리 | 11.7 | 들판 9.4fps · 그리기 139 | 걷기 7.1fps · 130 | LOW | 들판 6.5 · 걷기 7.1 |
| 2나락 | 8.1 | 마을 8.5fps · 153 | 던전 8.8fps · 107 | LOW | 마을 7.8 · 던전 11.6 |
| 3마을 | 16.1 | 마을 **17.5**fps · 47 | 걷기 **12.8**fps · 52 | HIGH → **LOW** | 마을 7.2 · 걷기 8.0 (HIGH 에 갇힘) |
| 4종횡 | 14.4 | 사냥터 17.6fps · 86 | 자동 사냥 8.0fps · 141 | LOW | 사냥터 14.5 · 자동 13.4 |
| 5천하 | 4.0 | 지도(2D) 60fps | 성 12.4fps · 그리기 286 · 삼각 35만 | 지도 HIGH | 성 10.3 |

- **용량**: 다섯 판 모두 상한(25MB) 안. 가장 큰 3마을 16MB.
- **그리기 수**: 다섯 판 모두 300 안(가장 많은 5천하 성 286).
- **FPS**: 다섯 판 모두 30 아래 — 넘음(아래 원인·남은 거리).

## 이번에 고친 것

1. **뼈대 나누기**(공용 anim-own `skel` — 다섯 판): GLTFLoader·SkeletonUtils 가 스킨 메시마다 Skeleton 을 새로 만들어, 1만리 장면에서 스킨 메시 152 · 뼈대 152 · 실제 다른 뼈 묶음 8 — 매 프레임 뼈 27,561개(프로파일 CPU 18%, three `Skeleton.update`). 같은 뼈·같은 역바인드면 SkinnedMesh.bind 가 처음 뼈대를 다시 쓴다(외곽선 껍질이 제 몸 부위와 나눔) → 뼈대 73~106·뼈 12,855~17,206. A/B: 1만리 들판 6.5→6.9 · 걷기 6.0→7.6fps. 몸 부위끼리는 역바인드가 실제로 달라(최대 1.4) 못 나눈다. 손잡이 `anim3d.shareSkel`.
2. **자동 품질 FPS 내리기**(공용 `autoq.js` — 3마을·5천하): 두 판은 "켤 때 한 번 기기 점수"로만 골라 폰 흉내에서도 HIGH(코어·메모리 점수가 높으면 폰도 HIGH). 이제 '자동'이면 3초 평균 FPS 가 26 아래일 때 한 단계씩 내린다(다시 올리지 않음, 사람이 고른 품질은 그대로). 3마을 7.2→17.5fps.
3. **5천하 성 그림 칸 30fps 상한**(`city3d.fps`, 느리면 autoq 로 15·10fps·픽셀비 1): 천천히 도는 장식 칸이 60fps 로 돌던 것. 이 측정의 FPS 는 안 바뀌었다(병목이 그리기 한 번의 무게) — 발열·배터리 몫.

## 원인·남은 거리(못 맞춘 것)

- **공통**: 감속 4배에서 CPU 대부분이 그리기 경로(three 행렬 갱신·버퍼 바인딩·뼈 텍스처 올리기)와 브라우저 자체(프로파일 "(program)" 35~50%). 30fps 까지 1만리·2나락·4종횡 자동 사냥은 약 3.5배, 3마을·4종횡 사냥터는 약 1.7배 남았다.
- **다음 손(새 티켓 후보)**: ① 정적 물체 `matrixAutoUpdate=false`(건물·땅·소품 — 행렬 갱신 몫) ② 먼 배우 뼈·믹서를 격 프레임으로(1만리 LOW 도 스킨 메시 100+) ③ 같은 재질 소품 메시 합치기(그리기 수) ④ 5천하 성 칸 정적 건물 한 덩이로 굽기(삼각 35만). 측정 틀은 이 시트의 명령과 `pw-cpu-profile.mjs <판> --wait=25`(함수별 자기 시간).
- 실폰 확인: 이 흉내가 비관적인지 한 번 실폰(중급 안드로이드) FPS 를 재 보면 상한 판단이 선다.

## CPU 상위 — 기준선(W-0315, 10-18 · 폰 흉내 390×844@2 · 실제 GPU d3d11 · CPU 4배 · 첫 장면 3초 × 3회 평균)

`node tools/qc.mjs --game <판>` 의 "CPU 상위" 줄이 이 기준선과 견준다(새 함수 10% 이상 · 있던 함수 +5%p 이상 → WARN). 기준선은 `pw-cpu-profile.mjs <판> --accept-baseline` 으로만 바뀐다. (program)·(idle) 등 괄호 항목은 뺐다.

| 판 | 1 | 2 | 3 | 4 | 5 |
|---|---|---|---|---|---|
| 1만리 | update `three.iife.js` 11.2% | updateMatrixWorld `three.iife.js` 2.2% | rl `three.iife.js` 1.9% | multiplyMatrices `three.iife.js` 1.3% | getBoundingClientRect `` 1.2% |
| 2나락 | multiplyMatrices `three.iife.js` 3.9% | X `town.js` 2.7% | updateMatrixWorld `three.iife.js` 2.1% | texSubImage2D `` 2.1% | s `three.iife.js` 1.8% |
| 3마을 | updateMatrixWorld `three.iife.js` 7.3% | rl `three.iife.js` 4.4% | multiplyMatrices `three.iife.js` 2.6% | Nn `village-view3d.js` 1.6% | O `data-village.js` 1.1% |
| 4종횡 | multiplyMatrices `three.iife.js` 3.6% | rl `three.iife.js` 3.4% | updateMatrixWorld `three.iife.js` 3.1% | texSubImage2D `` 2.7% | compose `three.iife.js` 2.1% |
| 5천하 | desired `core.js` 0% | querySelector `` 0% | C `hud.js` 0% | A `hud.js` 0% | - |

- 시험(10-18): 1만리 번들에 매 프레임 계산 함수(2백만 번 sqrt)를 임시로 넣자 `CPU 상위 · 1만리 — 오름 w0315Regress 새 11.5%` WARN → 빼자 PASS. 대기 루프(performance.now 돌기)는 자기 시간이 1.5% 로만 잡혀 못 잡음 — 함수 자체가 계산할 때만 잡힌다.
- 번들 vendor(three.js)에 표시가 없어 앞 파일(starchart.js·voice.js)로 잡히던 것 고침(`shared/build/bundle.mjs` vendor 앞 `/*@ 경로*/`).
