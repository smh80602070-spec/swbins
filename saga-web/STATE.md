<!-- 생성: tools/status.mjs · 2026-10-01 07:28Z — 손으로 고치지 않는다(덮어쓴다) -->
# saga-web 상태

완성도 = D3+ ÷ 전체 · WIP = D0+D1(10 초과 시 `초과`) · 등급 규칙 SAGA-ARCH §3.1

| 판 | 기능 | D0 | D1 | D2 | D3+ | 완성도 | WIP | 초과 | 러너 n/m | 표시 |
|---|---|---|---|---|---|---|---|---|---|---|
| saga-go | 24 | 16 | 8 | 0 | 0 | 0% | 24 | 초과 | 839/839 | - |
| saga-dungeon | 31 | 28 | 3 | 0 | 0 | 0% | 31 | 초과 | 432/432 | - |
| saga-forest | 28 | 26 | 2 | 0 | 0 | 0% | 28 | 초과 | 391/392 | - |
| saga-story | 18 | 13 | 5 | 0 | 0 | 0% | 18 | 초과 | 258/259 | - |
| saga-realm | 31 | 30 | 1 | 0 | 0 | 0% | 31 | 초과 | 261/261 | - |

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
