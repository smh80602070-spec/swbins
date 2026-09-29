# 영어 검수 목록 — saga-unity (자동 생성, 손으로 고치지 않는다)

`node tools/loc-review.mjs` 가 쓴다(PLAN.md 110 ⑥c). 사람이 채우는 곳은 `docs/en_review.tsv` 의 **검수** 칸뿐 — `OK` 또는 고칠 말을 적고 다시 돌리면 진척이 여기 반영된다. 고친 영어는 번역 표(`xxx_en.json`)·코드에 넣는다(키는 안 바꾼다).

- 짝 **4994** (표 4939 · 코드 55) — go 3078 · dungeon 532 · forest 272 · story 441 · realm 616
- 자동 오류 **0** · 경고 **1** · 용어 흔들림 **16** · 넘침 주의 **552**
- 사람 검수 **0/4994** — 순위1 0/266 · 순위2 0/3996 · 순위3 0/732

## 검수 순서

1. **순위 1** — 늘 보이는 UI(타이틀·일시정지·설정·HUD·단추·목표판·일과). 스토어 스크린숏에 찍히는 글.
2. **순위 2** — 놀면서 자주 보는 것(알림·전투·아이템·적·지역·기술 이름).
3. **순위 3** — 대사·사연·인물 한마디·문답·사건 본문.

볼 것: 뜻이 맞는지 · 어색한 직역 · 같은 것을 같은 말로 부르는지(아래 용어 흔들림) · 단추 글은 Title Case, 문장은 문장 끝 부호 · 가명(인물·지명)은 로마자 그대로 · 원작 게임 고유 용어를 쓰지 않는지.

## 자동 오류 — 0 이어야 한다 (0)

없음.

## 경고 — 의도면 두고, 아니면 고친다 (1)

- `go` `map.mark_legend` — 문장부호 앞 띄움

## 용어 흔들림 — 같은 한국어, 다른 영어 (16)

- 「물결」 → **Tidal** (go:era.foe.pre_hydro, go:kit.word.hydro) · **Mulgyeol** (go:wq.short.researcher)
- 「회오리」 → **Whirl** (go:field.re.swirl) · **swirls** (go:ach.unit.swirl)
- 「깨뜨림」 → **Shatter** (go:field.re.shatter) · **shatters** (go:ach.unit.shatter)
- 「강화석 +{0}」 → **Ore +{0}** (go:weapon.ore_plus) · **Enhancement Ore +{0}** (go:fish.got_ore)
- 「바꾸기」 → **Switch** (go:weapon.btn_swap, go:artifact.btn_swap) · **Trade** (go:fish.swap)
- 「요리」 → **Cooking** (go:cook.button, go:cook.title) · **dishes cooked** (go:ach.unit.cook)
- 「방패」 → **Shield Wall** (go:kit.noun.shield) · **Shield** (go:domain.hud_echo_shield)
- 「끝」 → **Complete** (go:story.state_done, go:wq.state_done) · **Done** (go:ach.end)
- 「청하 촌장에게 알리기」 → **Report to the Elder of Cheongha** (go:story.ch1.s8, go:story.ch2.s4, go:story.ch3.s9 외 4) · **Report to the elder of Cheongha** (go:story.ch8.s12, go:story.ch9.s12) · **Report to the Village Elder of Cheongha** (go:story.ch29.s9)
- 「……」 → **……** (go:story.idle.wanderer, go:story.idle.haesol) · **…** (go:story.idle.gamyeon, go:story.idle.king)
- 「가 볼게요.」 → **I'll go.** (go:wq.lighthouse.s1.p.a) · **I'll go take a look.** (go:story.ch10.s1.p.a)
- 「채집」 → **gathered** (go:ach.unit.gather) · **Foraging** (dungeon:room.forage)
- 「서리봉 고원」 → **Frostpeak Plateau** (go:region.frost) · **Frost Peak Plateau** (go:night.spot.frost)
- 「올라가 볼게요.」 → **I'll climb it.** (go:story.ch16.s5.p.a) · **I'll go up and see.** (go:story.ch25.s1.p.a)
- 「여기서 끝내자.」 → **End it here.** (go:story.ch20.s9.p.b) · **Let's end this here.** (go:story.ch29.s4.p.b)
- 「마루」 → **Maru** (go:story.short.maru) · **Wood Floor** (forest:finish.wood)

## 넘침 주의 — 순위 1·2 에서 영어가 한국어보다 1.6배 넘게 넓은 줄 (위 30 / 552)

배치 점검(`UiLayoutCheck`)은 첫 화면·패널·상태 38 만 잰다 — 그 밖에서 뜨는 긴 줄은 실기에서 한 번 본다.

| 폭 한→영 | 판 | 키 | 영어 |
|---|---|---|---|
| 51→93 | go | `story.ch33.s2.l1` | Captain! You came at the right time. Something odd has been showing on the weather radar these past days — not a flock of birds, but things going back and forth in a line beyond the eastern cliffs. |
| 21→44 | go | `wq.lighthouse.s1.l2` | There's nothing out there but the old lighthouse site. Will you come and take a look with me? |
| 11→29 | go | `wq.lighthouse.s2` | Go to the old lighthouse site at the far end of the east bank |
| 15→34 | go | `story.ch7.s9` | Watch the light across the water with the ferryman who came to the cape |
| 18→38 | go | `story.ch37.s2` | Switch off the lattice stake at the end of the post road with an elemental skill |
| 17→36 | go | `story.ch37.s5` | Switch off the lattice stake at the end of the rails with an elemental skill |
| 10→25 | go | `story.ch5.s2` | To the mouth of the old road on the western wood path |
| 16→33 | go | `story.ch6.s3.l3` | ……He's come. When he wraps himself in stormclouds, break it with fire! |
| 9→22 | forest | `visitor.dirs` | somewhere in the woods to the {0} of the village |
| 9→22 | go | `story.ch18` | Chapter 18 · The Last Train at Galaxy Station |
| 30→56 | go | `story.ch9.s9.l4` | Let's head down to the village. Granny Nuri will give me an earful — but let's spread our wings and go straight there. |
| 37→67 | go | `story.ch16.s1.l1` | Beep — after the star-ship lifted off, I followed the direction the rift was closing. It's beyond the farmland at the village's southern end. |
| 10→23 | go | `domain.loot.echo` | Thunder Drake Scale · Secret Scrolls · ★5 Relics |
| 16→33 | go | `story.ch40.s2` | Go to the compass altar below the star ship on the Frost Peak plateau |
| 26→48 | go | `story.ch28.s9.l2` | That mask pattern… the one at the very bottom of the inscription, the first mask. So you are the king. |
| 19→37 | go | `story.ch34.s5` | Switch off the west power pylon in front of the vault with an elemental skill |
| 19→37 | go | `story.ch34.s6` | Switch off the east power pylon in front of the vault with an elemental skill |
| 3→12 | go | `cook.recipe.honey_cake` | Honey Blossom Rice Cake |
| 10→22 | go | `story.ch5` | Chapter 5 · The Old Road over the Western Pass |
| 4→13 | dungeon | `item.wp_lm_cloud` | Cloud General's Gold Sword |
| 11→23 | go | `story.ch23.s1.p.b` | The last word of the erased entry — 'lighthouse'… |
| 6→15 | dungeon | `landmark.cloud` | Golden Palace Above the Clouds |
| 7→17 | go | `mount.need_ground` | Mount while standing on the ground |
| 7→17 | dungeon | `mount.need_ground` | Mount while standing on the ground |
| 35→63 | go | `wq.lighthouse.s1.l1` | Every night a light signal comes from the far end of the east bank. The pattern is an old beacon code… but the waveform is brand new. |
| 38→67 | go | `story.ch18.s10.l2` | Beep — star-ship, bell and last train: all three signals confirmed. The coordinates the captain left open — the first station beyond the rift. |
| 44→76 | go | `story.ch36.arrive` | Amber light swallows you — when you open your eyes you stand before the gate of an unfamiliar town. The wind, the sound, even the cracks in the sky have stopped |
| 17→33 | go | `story.ch16.s2` | Go through the Rift Pass at the village's southern end to Galaxy Port |
| 8→18 | go | `story.ch16.s9.p.a` | The captain went to the temple ruins? |
| 2→9 | forest | `finish.jangpan` | Oiled Paper Floor |
