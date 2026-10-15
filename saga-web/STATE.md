<!-- 생성: tools/status.mjs · 2026-10-15 08:26Z — 손으로 고치지 않는다(덮어쓴다) -->
# saga-web 상태

완성도 = 끝 ÷ 전체(끝 = 사람 몫 아님 D2+ · 사람 몫 human:true 는 D3+) · WIP = D0+D1(10 초과 시 `초과`) · 등급 규칙 SAGA-ARCH §3.1

| 판 | 기능 | D0 | D1 | D2 | 끝 | 완성도 | 사람 몫 | WIP | 초과 | 러너 n/m | 표시 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| saga-go | 49 | 0 | 2 | 40 | 47 | 95.9% | 5(미확인 0) | 2 | - | 919/919 | - |
| saga-dungeon | 49 | 0 | 0 | 46 | 48 | 98% | 4(미확인 1) | 0 | - | 524/524 | - |
| saga-forest | 46 | 0 | 0 | 43 | 46 | 100% | 3(미확인 0) | 0 | - | 459/459 | - |
| saga-story | 30 | 0 | 1 | 26 | 29 | 96.7% | 3(미확인 0) | 1 | - | 326/326 | - |
| saga-realm | 45 | 0 | 0 | 39 | 45 | 100% | 6(미확인 0) | 0 | - | 383/383 | - |

## 초과 판

없음

## js 1500줄 초과 (상위 10)

- 4746 — saga-web/saga-dungeon/js/dungeon.js
- 2811 — saga-web/saga-dungeon/js/dungeon3d.js
- 2743 — saga-web/saga-go/js/world3d.js
- 2407 — saga-web/saga-go/js/field-combat.js
- 2260 — saga-web/saga-forest/js/village.js
- 2246 — saga-web/saga-story/js/side.js
- 2120 — saga-web/saga-dungeon/js/ui.js
- 1987 — saga-web/saga-forest/js/village-view3d.js
- 1921 — saga-web/saga-go/js/world.js
- 1887 — saga-web/saga-realm/js/realm3d.js
- … 외 4개(`node tools/status.mjs --big`)
