<!-- 생성: tools/status.mjs · 2026-10-07 08:45Z — 손으로 고치지 않는다(덮어쓴다) -->
# saga-web 상태

완성도 = 끝 ÷ 전체(끝 = 사람 몫 아님 D2+ · 사람 몫 human:true 는 D3+) · WIP = D0+D1(10 초과 시 `초과`) · 등급 규칙 SAGA-ARCH §3.1

| 판 | 기능 | D0 | D1 | D2 | 끝 | 완성도 | 사람 몫 | WIP | 초과 | 러너 n/m | 표시 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| saga-go | 25 | 0 | 6 | 19 | 17 | 68% | 5(미확인 5) | 6 | - | 865/865 | - |
| saga-dungeon | 31 | 0 | 11 | 20 | 17 | 54.8% | 4(미확인 4) | 11 | 초과 | 469/469 | - |
| saga-forest | 28 | 0 | 6 | 22 | 21 | 75% | 3(미확인 3) | 6 | - | 413/413 | - |
| saga-story | 18 | 0 | 4 | 14 | 12 | 66.7% | 3(미확인 3) | 4 | - | 283/283 | - |
| saga-realm | 36 | 0 | 0 | 36 | 30 | 83.3% | 6(미확인 6) | 0 | - | 331/331 | - |

## 초과 판

saga-dungeon

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
