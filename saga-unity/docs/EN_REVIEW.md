# 영어 검수 목록 — saga-unity (자동 생성, 손으로 고치지 않는다)

`node tools/loc-review.mjs` 가 쓴다(PLAN.md 110 ⑥c). 사람이 채우는 곳은 `docs/en_review.tsv` 의 **검수** 칸뿐 — `OK` 또는 고칠 말을 적고 다시 돌리면 진척이 여기 반영된다. 고친 영어는 번역 표(`xxx_en.json`)·코드에 넣는다(키는 안 바꾼다).

- 짝 **2951** (표 2896 · 코드 55) — go 1107 · dungeon 515 · forest 258 · story 425 · realm 591
- 자동 오류 **0** · 경고 **0** · 용어 흔들림 **0** · 넘침 주의 **214**
- 사람 검수 **0/2951** — 순위1 0/265 · 순위2 0/1975 · 순위3 0/711

## 검수 순서

1. **순위 1** — 늘 보이는 UI(타이틀·일시정지·설정·HUD·단추·목표판·일과). 스토어 스크린숏에 찍히는 글.
2. **순위 2** — 놀면서 자주 보는 것(알림·전투·아이템·적·지역·기술 이름).
3. **순위 3** — 대사·사연·인물 한마디·문답·사건 본문.

볼 것: 뜻이 맞는지 · 어색한 직역 · 같은 것을 같은 말로 부르는지(아래 용어 흔들림) · 단추 글은 Title Case, 문장은 문장 끝 부호 · 가명(인물·지명)은 로마자 그대로 · 원작 게임 고유 용어를 쓰지 않는지.

## 자동 오류 — 0 이어야 한다 (0)

없음.

## 경고 — 의도면 두고, 아니면 고친다 (0)

없음.

## 용어 흔들림 — 같은 한국어, 다른 영어 (0)

없음.

## 넘침 주의 — 순위 1·2 에서 영어가 한국어보다 1.6배 넘게 넓은 줄 (위 30 / 214)

배치 점검(`UiLayoutCheck`)은 첫 화면·패널·상태 38 만 잰다 — 그 밖에서 뜨는 긴 줄은 실기에서 한 번 본다.

| 폭 한→영 | 판 | 키 | 영어 |
|---|---|---|---|
| 15→34 | go | `story.ch7.s9` | Watch the light across the water with the ferryman who came to the cape |
| 10→25 | go | `story.ch5.s2` | To the mouth of the old road on the western wood path |
| 16→33 | go | `story.ch6.s3.l3` | ……He's come. When he wraps himself in stormclouds, break it with fire! |
| 9→22 | forest | `visitor.dirs` | somewhere in the woods to the {0} of the village |
| 3→12 | go | `cook.recipe.honey_cake` | Honey Blossom Rice Cake |
| 10→22 | go | `story.ch5` | Chapter 5 · The Old Road over the Western Pass |
| 4→13 | dungeon | `item.wp_lm_cloud` | Cloud General's Gold Sword |
| 6→15 | dungeon | `landmark.cloud` | Golden Palace Above the Clouds |
| 2→9 | forest | `finish.jangpan` | Oiled Paper Floor |
| 3→10 | go | `kit.sig.zhuge.skill` | Eight Trigrams Array |
| 3→10 | dungeon | `enemy.grunt` | Yellow Turban Bandit |
| 3→10 | story | `enemy.hwanggeon` | Yellow Turban Bandit |
| 5→14 | go | `cook.recipe.ash_pancake` | Ash Flower Mushroom Pancake |
| 7→16 | dungeon | `saga.heaven.title` | The Guardian Who Drew His Sword |
| 5→13 | story | `bp.sig.hwanggeon_chief` | Netherworld Talisman Array |
| 5→13 | dungeon | `enemy.boss` | Yellow Turban Bandit Chief |
| 12→24 | go | `story.ch7` | Chapter 7 · The Fourth Altar on the Riverside Cape |
| 4→11 | dungeon | `enemy.miniboss` | Yellow Turban Assassin |
| 5→13 | dungeon | `saga.snowfort.title` | Giant of the Mountain Fort |
| 3→9 | forest | `finish.ondol` | Ondol Heated Floor |
| 4→11 | dungeon | `item.wp_greatblade` | Black Iron Greatsword |
| 4→11 | forest | `landmark.rocky` | Giant's Standing Stone |
| 27→47 | go | `story.ch5.s1.l3` | Head into the western wood path from the village and you'll reach the mouth of the old road. Hurry. |
| 17→31 | go | `story.ch1.s2` | To the old watchtower in the Southern Glade, where the wind howls |
| 8→16 | dungeon | `cut.floorboss_fallback_sub` | The master at the end of the floor |
| 7→15 | go | `story.ch5.s8.p.a` | The master of the stormclouds? |
| 6→13 | go | `domain.site.d_school` | Riverside Old Schoolhouse |
| 27→48 | go | `story.ch4.s7.l1` | A mask fragment? Let me see… this pattern is exactly the one carved at the bottom of the inscription! |
| 4→11 | dungeon | `landmark.bandit` | Black Wind Stronghold |
| 4→11 | story | `bp.boss.bandit_chief` | Mountain Bandit Chief |
