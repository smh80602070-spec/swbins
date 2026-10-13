<!-- 생성: tools/status.mjs · 2026-10-13 12:09Z — 손으로 고치지 않는다(덮어쓴다) -->
# saga-web 상태

완성도 = 끝 ÷ 전체(끝 = 사람 몫 아님 D2+ · 사람 몫 human:true 는 D3+) · WIP = D0+D1(10 초과 시 `초과`) · 등급 규칙 SAGA-ARCH §3.1

| 판 | 기능 | D0 | D1 | D2 | 끝 | 완성도 | 사람 몫 | WIP | 초과 | 러너 n/m | 표시 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| saga-go | 39 | 0 | 2 | 30 | 37 | 94.9% | 5(미확인 0) | 2 | - | 908/908 | - |
| saga-dungeon | 45 | 0 | 0 | 42 | 44 | 97.8% | 4(미확인 1) | 0 | - | 510/510 | - |
| saga-forest | 41 | 0 | 0 | 38 | 41 | 100% | 3(미확인 0) | 0 | - | 446/446 | - |
| saga-story | 28 | 0 | 1 | 24 | 27 | 96.4% | 3(미확인 0) | 1 | - | 318/318 | - |
| saga-realm | 44 | 0 | 0 | 38 | 44 | 100% | 6(미확인 0) | 0 | - | 375/375 | - |

## 초과 판

없음

## js 1500줄 초과 (상위 10)

- 4946 — saga-web/saga-dungeon/js/dungeon.js
- 3434 — saga-web/saga-go/js/world3d.js
- 3281 — saga-web/saga-go/js/story.js
- 3202 — saga-web/saga-dungeon/js/dungeon3d.js
- 2672 — saga-web/saga-dungeon/js/ui.js
- 2528 — saga-web/saga-go/js/field-combat.js
- 2521 — saga-web/saga-forest/js/village-view.js
- 2454 — saga-web/saga-forest/js/village.js
- 2246 — saga-web/saga-story/js/side.js
- 2115 — saga-web/saga-dungeon/js/dungeon-view.js
- … 외 7개(`node tools/status.mjs --big`)
