<!-- 생성: tools/status.mjs · 2026-10-03 11:46Z — 손으로 고치지 않는다(덮어쓴다) -->
# saga-web 상태

완성도 = D3+ ÷ 전체 · WIP = D0+D1(10 초과 시 `초과`) · 등급 규칙 SAGA-ARCH §3.1

| 판 | 기능 | D0 | D1 | D2 | D3+ | 완성도 | WIP | 초과 | 러너 n/m | 표시 |
|---|---|---|---|---|---|---|---|---|---|---|
| saga-go | 24 | 1 | 19 | 4 | 0 | 0% | 20 | 초과 | 855/855 | - |
| saga-dungeon | 31 | 0 | 25 | 6 | 0 | 0% | 25 | 초과 | 448/448 | - |
| saga-forest | 28 | 0 | 22 | 6 | 0 | 0% | 22 | 초과 | 404/404 | - |
| saga-story | 18 | 0 | 14 | 4 | 0 | 0% | 14 | 초과 | 270/271 | - |
| saga-realm | 31 | 0 | 25 | 6 | 0 | 0% | 25 | 초과 | 272/272 | - |

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
