<!-- 생성: tools/status.mjs · 2026-10-11 07:24Z — 손으로 고치지 않는다(덮어쓴다) -->
# saga-web 상태

완성도 = 끝 ÷ 전체(끝 = 사람 몫 아님 D2+ · 사람 몫 human:true 는 D3+) · WIP = D0+D1(10 초과 시 `초과`) · 등급 규칙 SAGA-ARCH §3.1

| 판 | 기능 | D0 | D1 | D2 | 끝 | 완성도 | 사람 몫 | WIP | 초과 | 러너 n/m | 표시 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| saga-go | 36 | 0 | 2 | 30 | 33 | 91.7% | 5(미확인 1) | 2 | - | 899/899 | - |
| saga-dungeon | 42 | 0 | 0 | 39 | 41 | 97.6% | 4(미확인 1) | 0 | - | 499/499 | - |
| saga-forest | 36 | 0 | 0 | 33 | 36 | 100% | 3(미확인 0) | 0 | - | 432/432 | - |
| saga-story | 24 | 0 | 0 | 21 | 24 | 100% | 3(미확인 0) | 0 | - | 305/305 | - |
| saga-realm | 42 | 0 | 0 | 36 | 42 | 100% | 6(미확인 0) | 0 | - | 365/365 | - |

## 초과 판

없음

## js 1500줄 초과 (상위 10)

- 4946 — saga-web/saga-dungeon/js/dungeon.js
- 3434 — saga-web/saga-go/js/world3d.js
- 3281 — saga-web/saga-go/js/story.js
- 3202 — saga-web/saga-dungeon/js/dungeon3d.js
- 2799 — saga-web/saga-forest/js/village-view.js
- 2672 — saga-web/saga-dungeon/js/ui.js
- 2604 — saga-web/saga-forest/js/village.js
- 2528 — saga-web/saga-go/js/field-combat.js
- 2246 — saga-web/saga-story/js/side.js
- 2175 — saga-web/saga-forest/js/ui.js
- … 외 10개(`node tools/status.mjs --big`)
