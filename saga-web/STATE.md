<!-- 생성: tools/status.mjs · 2026-10-05 06:26Z — 손으로 고치지 않는다(덮어쓴다) -->
# saga-web 상태

완성도 = 끝 ÷ 전체(끝 = 사람 몫 아님 D2+ · 사람 몫 human:true 는 D3+) · WIP = D0+D1(10 초과 시 `초과`) · 등급 규칙 SAGA-ARCH §3.1

| 판 | 기능 | D0 | D1 | D2 | 끝 | 완성도 | 사람 몫 | WIP | 초과 | 러너 n/m | 표시 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| saga-go | 24 | 1 | 19 | 4 | 3 | 12.5% | 5(미확인 5) | 20 | 초과 | 858/858 | - |
| saga-dungeon | 31 | 0 | 25 | 6 | 3 | 9.7% | 4(미확인 4) | 25 | 초과 | 461/461 | - |
| saga-forest | 28 | 0 | 22 | 6 | 5 | 17.9% | 3(미확인 3) | 22 | 초과 | 410/410 | - |
| saga-story | 18 | 0 | 14 | 4 | 2 | 11.1% | 3(미확인 3) | 14 | 초과 | 281/281 | - |
| saga-realm | 35 | 0 | 25 | 10 | 7 | 20% | 6(미확인 6) | 25 | 초과 | 322/322 | - |

## 초과 판

saga-go · saga-dungeon · saga-forest · saga-story · saga-realm

## js 1500줄 초과 (상위 10)

- 4946 — saga-web/saga-dungeon/js/dungeon.js
- 3503 — saga-web/saga-go/js/world3d.js
- 3281 — saga-web/saga-go/js/story.js
- 3202 — saga-web/saga-dungeon/js/dungeon3d.js
- 2800 — saga-web/saga-forest/js/village-view.js
- 2672 — saga-web/saga-dungeon/js/ui.js
- 2604 — saga-web/saga-forest/js/village.js
- 2528 — saga-web/saga-go/js/field-combat.js
- 2461 — saga-web/saga-realm/js/ui-rtk.js
- 2246 — saga-web/saga-story/js/side.js
- … 외 12개(`node tools/status.mjs --big`)
