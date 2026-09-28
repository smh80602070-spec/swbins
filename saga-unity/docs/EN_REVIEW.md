# 영어 검수 목록 — saga-unity (자동 생성, 손으로 고치지 않는다)

`node tools/loc-review.mjs` 가 쓴다(PLAN.md 110 ⑥c). 사람이 채우는 곳은 `docs/en_review.tsv` 의 **검수** 칸뿐 — `OK` 또는 고칠 말을 적고 다시 돌리면 진척이 여기 반영된다. 고친 영어는 번역 표(`xxx_en.json`)·코드에 넣는다(키는 안 바꾼다).

- 짝 **3194** (표 3139 · 코드 55) — go 1350 · dungeon 515 · forest 258 · story 425 · realm 591
- 자동 오류 **0** · 경고 **0** · 용어 흔들림 **1** · 넘침 주의 **259**
- 사람 검수 **0/3194** — 순위1 0/265 · 순위2 0/2215 · 순위3 0/714

## 검수 순서

1. **순위 1** — 늘 보이는 UI(타이틀·일시정지·설정·HUD·단추·목표판·일과). 스토어 스크린숏에 찍히는 글.
2. **순위 2** — 놀면서 자주 보는 것(알림·전투·아이템·적·지역·기술 이름).
3. **순위 3** — 대사·사연·인물 한마디·문답·사건 본문.

볼 것: 뜻이 맞는지 · 어색한 직역 · 같은 것을 같은 말로 부르는지(아래 용어 흔들림) · 단추 글은 Title Case, 문장은 문장 끝 부호 · 가명(인물·지명)은 로마자 그대로 · 원작 게임 고유 용어를 쓰지 않는지.

## 자동 오류 — 0 이어야 한다 (0)

없음.

## 경고 — 의도면 두고, 아니면 고친다 (0)

없음.

## 용어 흔들림 — 같은 한국어, 다른 영어 (1)

- 「물결」 → **Tidal** (go:era.foe.pre_hydro, go:kit.word.hydro) · **Mulgyeol** (go:wq.short.researcher)

## 넘침 주의 — 순위 1·2 에서 영어가 한국어보다 1.6배 넘게 넓은 줄 (위 30 / 259)

배치 점검(`UiLayoutCheck`)은 첫 화면·패널·상태 38 만 잰다 — 그 밖에서 뜨는 긴 줄은 실기에서 한 번 본다.

| 폭 한→영 | 판 | 키 | 영어 |
|---|---|---|---|
| 21→44 | go | `wq.lighthouse.s1.l2` | There's nothing out there but the old lighthouse site. Will you come and take a look with me? |
| 11→29 | go | `wq.lighthouse.s2` | Go to the old lighthouse site at the far end of the east bank |
| 15→34 | go | `story.ch7.s9` | Watch the light across the water with the ferryman who came to the cape |
| 10→25 | go | `story.ch5.s2` | To the mouth of the old road on the western wood path |
| 16→33 | go | `story.ch6.s3.l3` | ……He's come. When he wraps himself in stormclouds, break it with fire! |
| 9→22 | forest | `visitor.dirs` | somewhere in the woods to the {0} of the village |
| 30→56 | go | `story.ch9.s9.l4` | Let's head down to the village. Granny Nuri will give me an earful — but let's spread our wings and go straight there. |
| 3→12 | go | `cook.recipe.honey_cake` | Honey Blossom Rice Cake |
| 10→22 | go | `story.ch5` | Chapter 5 · The Old Road over the Western Pass |
| 4→13 | dungeon | `item.wp_lm_cloud` | Cloud General's Gold Sword |
| 6→15 | dungeon | `landmark.cloud` | Golden Palace Above the Clouds |
| 35→63 | go | `wq.lighthouse.s1.l1` | Every night a light signal comes from the far end of the east bank. The pattern is an old beacon code… but the waveform is brand new. |
| 2→9 | forest | `finish.jangpan` | Oiled Paper Floor |
| 3→10 | go | `kit.sig.zhuge.skill` | Eight Trigrams Array |
| 3→10 | dungeon | `enemy.grunt` | Yellow Turban Bandit |
| 3→10 | story | `enemy.hwanggeon` | Yellow Turban Bandit |
| 5→14 | go | `cook.recipe.ash_pancake` | Ash Flower Mushroom Pancake |
| 7→16 | dungeon | `saga.heaven.title` | The Guardian Who Drew His Sword |
| 5→13 | story | `bp.sig.hwanggeon_chief` | Netherworld Talisman Array |
| 24→43 | go | `wq.idle.researcher` | Something like an old lighthouse beam flickers on the night water. I should write it down. |
| 5→13 | dungeon | `enemy.boss` | Yellow Turban Bandit Chief |
| 12→24 | go | `story.ch7` | Chapter 7 · The Fourth Altar on the Riverside Cape |
| 30→53 | go | `story.ch8.s9.l3` | That's none of your concern. I'll be waiting at the sixth seat above the storm clouds — we'll finish this there. |
| 4→11 | dungeon | `enemy.miniboss` | Yellow Turban Assassin |
| 5→13 | dungeon | `saga.snowfort.title` | Giant of the Mountain Fort |
| 3→9 | forest | `finish.ondol` | Ondol Heated Floor |
| 4→11 | dungeon | `item.wp_greatblade` | Black Iron Greatsword |
| 30→52 | go | `wq.lighthouse.s3.l1` | Identity confirmed. Hanbit, lighthouse keeper — a machine that guards this lighthouse in the distant future. |
| 4→11 | forest | `landmark.rocky` | Giant's Standing Stone |
| 27→47 | go | `story.ch5.s1.l3` | Head into the western wood path from the village and you'll reach the mouth of the old road. Hurry. |
