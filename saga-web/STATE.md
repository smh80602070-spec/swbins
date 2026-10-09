<!-- 생성: tools/status.mjs · 2026-10-09 09:23Z — 손으로 고치지 않는다(덮어쓴다) -->
# saga-web 상태

완성도 = 끝 ÷ 전체(끝 = 사람 몫 아님 D2+ · 사람 몫 human:true 는 D3+) · WIP = D0+D1(10 초과 시 `초과`) · 등급 규칙 SAGA-ARCH §3.1

| 판 | 기능 | D0 | D1 | D2 | 끝 | 완성도 | 사람 몫 | WIP | 초과 | 러너 n/m | 표시 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| saga-go | 27 | 0 | 2 | 21 | 24 | 88.9% | 5(미확인 1) | 2 | - | 874/874 | - |
| saga-dungeon | 33 | 0 | 0 | 30 | 32 | 97% | 4(미확인 1) | 0 | - | 478/478 | - |
| saga-forest | 29 | 0 | 0 | 26 | 29 | 100% | 3(미확인 0) | 0 | - | 420/420 | - |
| saga-story | 19 | 0 | 0 | 16 | 19 | 100% | 3(미확인 0) | 0 | - | 289/289 | - |
| saga-realm | 38 | 0 | 0 | 32 | 38 | 100% | 6(미확인 0) | 0 | - | 350/350 | - |

## 초과 판

없음

## js 1500줄 초과 (상위 10)

- 4946 — saga-web/saga-dungeon/js/dungeon.js
- 3434 — saga-web/saga-go/js/world3d.js
- 3281 — saga-web/saga-go/js/story.js
- 3202 — saga-web/saga-dungeon/js/dungeon3d.js
- 2800 — saga-web/saga-forest/js/village-view.js
- 2672 — saga-web/saga-dungeon/js/ui.js
- 2604 — saga-web/saga-forest/js/village.js
- 2528 — saga-web/saga-go/js/field-combat.js
- 2246 — saga-web/saga-story/js/side.js
- 2175 — saga-web/saga-forest/js/ui.js
- … 외 10개(`node tools/status.mjs --big`)
