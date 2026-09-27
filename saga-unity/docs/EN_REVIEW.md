# 영어 검수 목록 — saga-unity (자동 생성, 손으로 고치지 않는다)

`node tools/loc-review.mjs` 가 쓴다(PLAN.md 110 ⑥c). 사람이 채우는 곳은 `docs/en_review.tsv` 의 **검수** 칸뿐 — `OK` 또는 고칠 말을 적고 다시 돌리면 진척이 여기 반영된다. 고친 영어는 번역 표(`xxx_en.json`)·코드에 넣는다(키는 안 바꾼다).

- 짝 **2091** (표 2036 · 코드 55) — go 508 · dungeon 387 · forest 177 · story 385 · realm 579
- 자동 오류 **0** · 경고 **0** · 용어 흔들림 **0** · 넘침 주의 **98**
- 사람 검수 **0/2091** — 순위1 0/257 · 순위2 0/1144 · 순위3 0/690

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

## 넘침 주의 — 순위 1·2 에서 영어가 한국어보다 1.6배 넘게 넓은 줄 (위 30 / 98)

배치 점검(`UiLayoutCheck`)은 첫 화면·패널·상태 38 만 잰다 — 그 밖에서 뜨는 긴 줄은 실기에서 한 번 본다.

| 폭 한→영 | 판 | 키 | 영어 |
|---|---|---|---|
| 4→13 | dungeon | `item.wp_lm_cloud` | Cloud General's Gold Sword |
| 6→15 | dungeon | `landmark.cloud` | Golden Palace Above the Clouds |
| 2→9 | forest | `finish.jangpan` | Oiled Paper Floor |
| 3→10 | dungeon | `enemy.grunt` | Yellow Turban Bandit |
| 3→10 | story | `enemy.hwanggeon` | Yellow Turban Bandit |
| 5→13 | dungeon | `enemy.boss` | Yellow Turban Bandit Chief |
| 4→11 | dungeon | `enemy.miniboss` | Yellow Turban Assassin |
| 3→9 | forest | `finish.ondol` | Ondol Heated Floor |
| 4→11 | dungeon | `item.wp_greatblade` | Black Iron Greatsword |
| 4→11 | forest | `landmark.rocky` | Giant's Standing Stone |
| 8→16 | dungeon | `cut.floorboss_fallback_sub` | The master at the end of the floor |
| 4→11 | dungeon | `landmark.bandit` | Black Wind Stronghold |
| 6→14 | dungeon | `enemy.elite` | Fierce Yellow Turban Bandit |
| 3→8 | forest | `furniture.geomungo` | Geomungo (Zither) |
| 8→16 | dungeon | `horde.busy` | An Onslaught is already underway. |
| 13→24 | realm | `war.err_too_few_troops` | You need more than five hundred to call it an army. |
| 10→20 | dungeon | `region.map_outside` | Now — outside the regions (in the dungeon) |
| 3→8 | forest | `finish.hanji` | Hanji Paper Wall |
| 4→10 | realm | `officer.tm_gangseo.title` | Special Ops Captain |
| 14→25 | story | `npc.trainer_status_locked` | Class change available from Lv.{0} (currently Lv.{1}) |
| 4→10 | dungeon | `landmark.tomb.room1` | Grave-Goods Chamber |
| 4→10 | dungeon | `region.snowfort` | Northern Snow Peaks |
| 4→10 | story | `cut.story_boss_title` | Yellow Turban Chief |
| 4→10 | dungeon | `item.wp_lm_bandit` | Black Wind Twin Axe |
| 11→20 | dungeon | `quest.boss_defeated` | Defeated the Yellow Turban Bandit Chief |
| 4→9 | dungeon | `landmark.hellgate` | Gate of Karmic Fire |
| 6→12 | realm | `war.tactic_fire_ok` | 🔥 Fire attack succeeded — |
| 4→9 | forest | `museum.item.silver_bell` | Lily of the Valley |
| 6→11 | go | `wp.east` | Eastern Grove Waypoint |
| 10→18 | dungeon | `quest.miniboss_defeated` | Defeated the Yellow Turban Assassin |
