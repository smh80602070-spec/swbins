extends RefCounted
class_name DungeonSkills

## PLAN.md 51장 "장비→빌드" — 11·12장(장비 8부위)이 끝난 뒤 남은 마지막
## 갈래. 웹판 `data-skill.js`는 직업 다섯 × 여덟 갈래 × 세 단 = 120개
## 무예를 갖고 있지만, 그중 실제로 **전투 코드가 없어도(투사체·소환·
## 범위 판정을 새로 안 짜도) 이 슬라이스에 바로 꽂히는 것은 `shape:
## 'passive'` 열넷뿐**이다 — `dungeon_run_state.gd::_sum_eff()`가 이미
## boons(은사)·장비·부대 세 갈래를 world eff 키(atkPct·hpPct·critPct·
## reachPct·atkSpdPct·drainPct·guardPct 등) 하나로 합산해 melee_attack.gd·
## player_health.gd가 그대로 소비하고 있다 — 여기에 "무예로 얻은 랭크"
## 라는 **네 번째 자리**만 얹으면 새 시스템(투사체·소환·쿨타임 UI 등)
## 없이도 실제 전투에 즉시 반영된다.
##
## **직업(cls) 표는 새로 안 만든다** — dungeon_items.gd의
## `class_key_for_weapon()`/`CLASS_NAMES`(무기 look → 직업)를 그대로
## 쓴다(원작도 같은 표를 두 파일이 나눠 쓴다, data-skill.js WEAPON_CLASS
## == data-item.js 없음, dungeon_items.gd가 이미 이 슬라이스의 유일한
## 소스). 이 파일은 SKILLS 표 하나만 갖는다.
##
## 궁장(archer)·무장(warrior)·도독(marshal)·방사(mystic)는 br=2 세 단
## (row 0~2)이 전부 passive라 그대로 옮겼다. 책사(scholar)만 br=2 row 0
## (`s_wave`, 기(氣) 결 bolt)이 passive가 아니었다.
## **2026-09-14, 같은 날 이어서 — 첫 활성 무예로 옮겼다**(`games/
## saga_dungeon/player/skill_bolt.gd` 참고). 진짜 투사체(속도 330, 최대
## 1.5초 생존) 대신 "가장 가까운 적 하나를 즉시 맞히는" 히트스캔으로
## 근사했다 — 우물이 원작 미니게임을 즉시 회복으로 근사한 것과 같은 결의
## 판단. `shape`·`cd`·`el` 세 필드를 이때 채워 넣었다(원작 값 그대로,
## 지어내지 않음). `s_focus`·`y_hex`가 쌓아 온 `skillPct`도 이걸로 처음
## 실제 소비된다(`DungeonRunState.skill_mul()`).
##
## **eff 키 중 반영되는 것**: critPct·reachPct·atkSpdPct·hpPct·atkPct·
## drainPct·guardPct — 전부 `dungeon_run_state.gd`가 이미 소비 중이다
## (위 헤더 참고). skillPct는 world eff 합산이 아니라 skill_bolt.gd가
## `DungeonRunState.skill_mul()`로 직접 소비한다(passive들과 다른 자리 —
## "무예 위력 배율"은 무예 데미지에만 곱해야지 은사/장비의 다른 수치에
## 섞이면 안 된다). **아직 반영 안 되는 것(시스템이 없다)**: mpRegen
## (기력 자체가 없다)·allResPct(원소 저항 합산 자리, `dungeon_equipment_
## state.gd elem_resist()`가 이미 있지만 "전체 결" 합산 채널은 없다).
## 데이터는 그대로 두고(다음에 채널이 생기면 그때 잇는다), 이 둘에 점을
## 넣어도 지금은 조용히 아무 효과가 없다 — dungeon_run_state.gd 헤더의
## "goldPct(경제 시스템 없음)"과 같은 결의 판단이다.
##
## **2026-09-14, 또 이어서 — 무장(warrior) br=0 row=0 `w_whirl`(회전참,
## shape:'swing') 추가**(`games/saga_dungeon/player/skill_whirl.gd` 참고).
## bolt(가장 가까운 적 하나)와 달리 swing은 자기 둘레 반경(`sk.r`×reach_
## mult()) 안의 적 **전부**를 때린다 — 새 반경 판정이지만 투사체·소환보다
## 훨씬 작은 몫이라 다음으로 골랐다. 원작의 넉백(`kb:30`)은 이 슬라이스에
## 넉백 자체가 없어(melee_attack.gd도 안 한다) 값만 보존하고 안 쓴다.
##
## **2026-09-15, 이어서 — 방사(mystic) br=5 row=0 `y_thunderdoom`(뇌쇄,
## shape:'nova') 추가**(`games/saga_dungeon/player/skill_nova.gd` 참고).
## 방사는 여태 br=2 세 단(passive)뿐이라 이걸로 첫 활성 무예를 얻는다
## (bolt→scholar, swing→warrior, 이제 nova→mystic). swing과 판정은 같지만
## (둘레 반경 안 전부) **reach_mult()를 안 곱한다** — 원작 dungeon.js
## `applyShapeSkill()`의 'nova'는 `sk.r`을 그대로 반경으로 쓰지 swing처럼
## `reachOf()`를 곱하지 않는다(코드 그대로). 다만 원작 `sk.r`(130)은
## `reachOf()`에 곱해질 걸 전제 안 한 **원시 픽셀** 값이라 swing의 `sk.r`
## (1.7~3.2, 이미 미터로 쓸 만한 크기)과 자릿수가 다르다 — 그대로 미터로
## 쓰면 방 절반(6m)의 곱절이 넘는다. swing 포팅이 "웹 `sk.r`를 그대로
## 미터로 쓴다"고 정한 선례를 지키려면 두 무예의 **원작 반경 비율**부터
## 맞춰야 한다: 웹에서 실제 반경은 swing이 `reachOf()×sk.r`(예: w_whirl
## 34×2.3=78.2px), nova는 `sk.r`(130px) 그대로 — 즉 nova의 원시 `sk.r`은
## `reachOf()`의 기준값 `BASE_REACH`(34px)만큼 "이미 스케일업"돼 있다.
## 그래서 여기서는 `sk.r`을 그 34로 나눠(130/34=3.82) swing과 같은
## 자릿수로 되돌린 값을 미터로 쓴다 — 결과 비율(3.82/2.3=1.66)이 웹의
## 실제 반경 비율(130/78.2=1.66)과 정확히 같다(같은 판단의 연장, 새
## 임의 상수 아님). **아직 반영 안 되는 것**: `el`(lit, 원소 저항은
## `melee_attack.gd`가 아니라 무예 자체가 직접 계산한다, skill_bolt.gd와
## 같은 경계).
##
## **2026-09-15, 또 이어서 — 궁장(archer) br=5 row=0 `a_dashshot`(질주사,
## shape:'dash') 추가**(`games/saga_dungeon/player/skill_dash.gd` 참고).
## 궁장은 여태 br=2 세 단(passive)뿐이라 넷째 직업이 첫 활성 무예를 얻는다.
## bolt·swing·nova는 "제자리에서 판정"이지만 dash는 **그 자리에서 짧게
## 돌진하며 지나는 적을 벤다** — 처음으로 플레이어 위치 자체를 옮기는
## 무예라 `player.gd`(GO와 공유)에 아주 작은 훅 둘(`dash_dir`·`dash_speed`)
## 을 추가했다: 0이 아니면 그 프레임 이동 입력을 무시하고 그 방향/속력으로
## `move_and_slide()`한다 — boon_speed_sync.gd가 `speed_mult`를 미는 것과
## 같은 결의 일방 통행(하위 호환: 기본값 0이라 GO는 아무 영향 없다).
## `player.gd`는 여전히 `DungeonRunState`를 모른다. **실측으로 고친 것** —
## 처음엔 `velocity`+`move_and_slide()`로 옮겼더니 적(CharacterBody3D)과
## 몸통이 부딪혀 옆으로 밀려났다(검증 스크립트가 사거리 밖 적까지 맞히는
## 걸로 드러남). 원작 dungeon.js 돌진도 `p.x`/`p.y`를 충돌 없이 직접
## 더할 뿐이라, `player.gd`의 돌진 분기는 `global_position`을 직접
## 옮기고 그 프레임 `move_and_slide()`(와 중력)를 건너뛴다.
##
## **2026-09-15, 또 이어서 — 도독(marshal) br=0 row=0 `m_rally`(사기,
## shape:'buff') 추가**(`games/saga_dungeon/player/skill_buff.gd` 참고).
## 이걸로 다섯 직업 전부 활성 무예를 하나씩 갖는다(bolt·swing·nova·dash·
## buff). buff는 처음으로 **한동안**(sec초) 효과가 붙는 무예라 —
## `dungeon_run_state.gd`에 `_temp_buffs`(잠깐짜리 world eff, 다섯 번째
## 합산 자리) 신규. 원작 dungeon.js `addBuff()`/`boonVal()` 그대로: 값과
## 만료 시각만 들고 있다가 `_sum_eff()`가 조회 시점에 안 끝났으면 더한다
## (틱 타이머로 안 지운다 — 굳이 지울 필요가 없다, 만료된 항목은 그냥
## 조용히 안 더해질 뿐이고 다음에 같은 eff로 다시 buff를 걸면 덮어 쓴다).
## 세이브에는 안 남는다(원작 주석 "잠깐짜리 무예·분신은 회차 안에서만
## 산다" 그대로).
##
## **2026-09-15, 또 이어서 — 책사(scholar) br=5 row=0 `s_restore`(축기회복,
## shape:'heal') 추가**(`games/saga_dungeon/player/skill_heal.gd` 참고).
## 다섯 직업 전부(bolt·swing·nova·dash·buff)가 첫 활성 무예를 이미 가진
## 뒤라 이번엔 **책사의 둘째 활성 무예**로 "heal" 모양을 채운다(원작 desc
## "책사의 첫 회복" 그대로 — 원작에서도 책사에게 heal은 이 자리가 처음).
## `player_health.gd`의 기존 `heal_by()`를 그대로 부른다 — buff처럼 대상도
## 방향도 없어 지금까지 중 가장 단순하다(새 상태·판정이 전혀 없다).
##
## **2026-09-15, 또 이어서 — 무장(warrior) br=5 row=0 `w_intimidate`(위해,
## shape:'curse') 추가**(`games/saga_dungeon/player/skill_curse.gd` 참고).
## 원작 desc "무장의 첫 저주" 그대로 — 무장의 둘째 활성 무예(첫째는
## w_whirl, swing). 반경은 nova와 같은 문제라 같은 요령으로 옮겼다(원작
## `sk.r`이 `reachOf()`를 안 곱하는 원시 픽셀 값 — `BASE_REACH`로 나눈
## 3.82m, w_intimidate의 원작 r도 130이라 y_thunderdoom과 정확히 같은
## 값이 나온다). 데미지가 없는 "상태만 거는" 무예라 처음으로
## `dungeon_enemy.gd`에 새 상태 하나(`_hex_v`/`_hex_time_left`,
## `apply_hex()`)를 추가했다 — "그동안 이 적이 받는 모든 피해가 v%만큼
## 는다"를 `take_damage()` 한 곳에서 계산해, 공격 스크립트마다 따로
## 체크할 필요가 없게 했다(원작 strike()가 물리·무예 안 가리고 한 곳에서
## 곱하는 것과 같은 효과). 느려짐은 기존 `apply_elem_slow()`(냉기와 같은
## 자리, mult=0.35 원작 그대로)를 그대로 재사용 — 새 감속 채널을 안
## 만든다. 원작 `sk.v`(위해의 위력, 30)는 hex 배율에, 슬로우는 원작처럼
## 랭크와 무관하게 항상 0.35다.
##
## **속도 환산** — dash는 "반경"이 아니라 "이동"이라 `BASE_REACH`가 아니라
## `BASE_SPD`(148px/s, 원작 이동속도 기준값)를 기준으로 삼는다. `player.gd`
## 의 `WALK_SPEED`(6.0m/s)가 그 Godot 쪽 짝이므로, 원작 돌진 속도(620px/s,
## dungeon.js 하드코딩값)를 `620×(6.0/148)≈25.14`m/s로 옮긴다. 지속시간은
## 원작 `0.2×(sk.far||1)`초 그대로(a_dashshot은 far 없음 → 0.2초) — 즉
## 한 번에 약 5m를 돌진한다. 지나는 적 판정 반경("de.r+P_R+6", 몬스터별
## 픽셀 반지름)은 이 슬라이스에 몬스터 개별 충돌 반지름을 안 두므로(swing·
## nova도 마찬가지) 새 상수를 안 만들고 `melee_attack.gd`의 `ATK_RANGE`
## (2.4m)를 그대로 재사용한다("스쳐 지나가며 벤다"는 접촉 판정이라 평타
## 사거리와 같은 성격). 원작의 무적(`p.invuln`)은 이 슬라이스에 회피·
## 무적 시스템 자체가 없어(`combat_dodge` 입력 액션도 아직 아무 데도
## 안 걸려 있다) 값만 흘리고 안 쓴다 — kb·mpRegen과 같은 결의 판단.
##
## **2026-09-15, 또 이어서 — 방사(mystic) br=0 row=0 `y_shade`(분신술,
## shape:'summon') 추가**(`games/saga_dungeon/player/skill_summon.gd`·
## `games/saga_dungeon/world/dungeon_minion.gd` 참고). 방사 자체가 원작
## `CLASSES` 설명부터 "분신을 세우고 적을 묶는다"라 y_shade가 그 직업의
## 가장 원래 모양이다(nova·curse처럼 다른 직업에서 "빌려 온" 게 아니다).
## 처음으로 **화면에 남는 새 개체**(분신)가 필요해 지금까지 중 가장 큰
## 걸음이다 — `dungeon_minion.gd` 신규: `CharacterBody3D`가 아니라 맨
## `Node3D`(물리 충돌 없음, `global_position`을 직접 옮긴다 — dash가
## 겪은 몸통 충돌 문제를 아예 피한다, 원작 분신도 2D 좌표만 있지 몸통
## 충돌이 없다) 하나가: 가장 가까운 적을 쫓다가 닿으면 멈춰 서서
## 주기적으로 때리고(`melee_attack.gd`의 `ATK_DAMAGE`를 `mul`(=0.5×
## `sk.str`, y_shade는 str 없음 → 0.5)만큼 줄여 쓴다 — crit·저항은
## 그대로 적용, 적이 없으면 플레이어 곁으로 돌아온다), `sec`초 뒤 스스로
## `queue_free()`한다. **적이 분신을 공격하지 않는다**(원작 그대로 — hp도
## 없다, 죽음·부활을 새로 안 만드는 선택).
##
## **속도 환산** — dash와 같은 이유로 "이동"이라 `BASE_SPD`(148px/s)
## 기준을 쓴다: 추격 110px/s→`110×(6.0/148)≈4.46`m/s, 복귀 90px/s→
## `≈3.65`m/s, 소환 위치 흩뿌림(±20px×±15px)→`≈±0.81m×±0.61m`. 공격
## 판정 거리("bd > best.r+14", 몬스터별 반지름 없음)는 curse·dash와 같은
## 이유로 `melee_attack.gd`의 `ATK_RANGE`(2.4m)를 재사용한다. 공격
## 쿨다운(0.7초)은 이미 초 단위라 그대로 옮긴다. **랭크가 하는 일** —
## 데미지가 아니라 **개체 수**(`round(value_at(rank))`)를 늘린다(원작
## `summon(Math.round(v), ...)` 그대로) — 다른 무예와 결이 다르다.
##
## **2026-09-15, 또 이어서 — 궁장(archer) br=3 row=0 `a_chain`(연환시,
## shape:'chain') 추가**(`games/saga_dungeon/player/skill_chain.gd` 참고).
## 이걸로 웹판의 아홉 모양(bolt·swing·nova·dash·buff·heal·curse·summon·
## chain) 전부가 이 슬라이스에 있다 — 궁장의 둘째 활성 무예(첫째는
## a_dashshot, dash). nova·curse처럼 "제자리 반경"이 아니라 원작
## `applyShapeSkill()`의 'chain' 그대로 **가장 가까운 적부터 시작해, 아직
## 안 맞은 적 중 가장 가까운 쪽으로 최대 hops(기본 3)번 옮겨 붙는다** —
## 튈 때마다 12%씩 약해진다(`v * skillMul() * (1 - hop*0.12)`, 원작 그대로).
## 탐색 반경(`sk.r`, 다음 표적을 찾는 거리)은 nova·curse와 같은 문제라
## 같은 요령으로 옮겼다 — a_chain은 원작에 `r` 필드가 없어(기본값 260px)
## `260 ÷ BASE_REACH(34) ≈ 7.65`m를 쓴다. hops는 원작에 없으면 3(data-
## skill.js `sk.hops || 3` 그대로), a_chain도 hops 필드가 없어 3.
##
## **2026-09-15, 또 이어서 — 도독(marshal) br=3 row=0 `m_chain`(연환기격,
## shape:'chain') 추가**(`games/saga_dungeon/player/skill_chain_marshal.gd`
## 참고). 도독은 여태 m_rally(buff) 하나뿐이라(다섯 직업 중 활성 무예가
## 가장 적었다) 이걸로 둘째를 얻는다. **'chain'이 처음으로 두 직업이
## 공유하는 모양이다** — a_chain과 판정·감쇠 계산이 완전히 같아(원작
## `applyShapeSkill()`은 shape 하나로 모든 chain 무예를 처리한다) 로직을
## 그대로 복사했다(기존 스크립트들이 "직업당 스크립트 하나" 결을 지켜온
## 선례를 따른 것 — skill_nova.gd/skill_curse.gd도 반경 판정이 거의
## 같지만 따로 파일이다). 다른 점은 SKILL_KEY·입력 액션·el 기본값(`el:
## 'chi'`, a_chain은 phys)뿐이다.
##
## **2026-09-15, 다섯 직업 모두 둘씩을 채운 뒤 — 셋째 활성 무예 다섯 개를
## 한 번에 이어간다("사가고돗 이어 해둬 묻지말고").** 웹판 데이터를
## 다시 훑어 **다음 조건 둘을 모두 만족하는 항목**만 골랐다: (1) `row: 0`
## (이 슬라이스는 진짜 트리가 아니라 br/row 여러 갈래에서 낱개로 옮겨
## 온 것이라 `prereq_of()`가 전 단을 못 찾으면 조용히 요구 안 함으로
## 넘어가긴 하지만, row 0을 고르면 애초에 그 불일치 자체가 안 생긴다),
## (2) 이미 옮겨진 아홉 모양(bolt·swing·nova·dash·buff·heal·curse·summon·
## chain) 중 하나라 새 판정 코드가 필요 없다. 그 결과:
## - 궁장(archer) `a_pierce`(관통사, br0row0, bolt, el 없음) — 궁장의
##   첫 bolt(지금까지 dash·chain뿐이었다).
## - 무장(warrior) `w_dash`(돌진, br1row0, dash, el 없음) — 무장의
##   첫 dash(swing·curse에 이어 셋째 모양).
## - 책사(scholar) `s_chainfire`(연쇄화염, br3row0, chain, el:'fire') —
##   chain이 세 번째로 공유하는 직업이 된다(a_chain·m_chain에 이어).
## - 도독(marshal) `m_smite`(기격, br1row0, swing, el:'chi', r=1.6) —
##   도독의 첫 swing.
## - 방사(mystic) `y_curse`(주박, br1row0, curse, r=130→3.82, sec=5,
##   v=30) — w_intimidate와 v·r·sec가 전부 같다(원작에서도 그렇다).
##
## 각각 skill_bolt.gd/skill_dash.gd/skill_chain.gd/skill_whirl.gd/
## skill_curse.gd를 그대로 복제해 SKILL_KEY·그룹·입력 액션만 바꿨다(직업당
## 스크립트 하나 결 유지 — chain이 두 벌 있던 선례를 셋째로 늘린 것뿐, 새
## 판정 로직은 전혀 안 늘었다). 입력 액션은 dungeon_skill_11~15(G·I·O·P·U
## 키) 신규 — 그 다섯 글자는 DUNGEON 안에서 여태 안 쓰인 키라 새로
## 배정했다(FOREST·STORY가 같은 글자를 쓰고 있지만 두 게임은 동시에 안 돈다).
##
## **2026-09-15, 또 이어서 — 넷째 활성 무예 다섯 개("사가고돗 이어해").**
## 셋째와 같은 방식으로 골랐다: `row: 0`이면서 이미 옮겨진 아홉 모양 중
## 하나. 이번엔 **다섯 직업 모두 br=4 row=0**이 조건에 맞았다(우연히
## 웹판이 그 갈래를 다섯 직업 다 "여태 이 직업이 안 써 본 모양"으로
## 채워 뒀다) — 그래서 이 배치가 끝나면 다섯 직업 전부 **서로 다른
## 모양 넷씩**을 갖는다:
## - 궁장 `a_flourish`(궁신무, swing, r=1.6) — 궁장의 첫 swing.
## - 무장 `w_throw`(투창, bolt, el 없음) — 무장의 첫 bolt.
## - 책사 `s_blink`(축지, dash, el:'lit') — 책사의 첫 dash.
## - 도독 `m_javelin`(표창, bolt, el:'chi') — 도독의 첫 bolt.
## - 방사 `y_soulbolt`(혼탄, bolt, el:'chi') — 방사의 첫 bolt(이걸로
##   bolt가 궁장·무장·도독·방사 넷이 공유하는 모양이 된다 — chain 다음
##   으로 널리 재사용되는 shape).
## 각각 skill_whirl.gd/skill_bolt.gd/skill_dash.gd를 복제해 SKILL_KEY·
## 그룹·입력 액션만 바꿨다(새 판정 로직 없음). 입력 액션은
## dungeon_skill_16~20(E·Q·T·X·Y 키) 신규.
##
## **2026-09-15, 또 이어서 — 다섯째 활성 무예 둘("사가고돗 이어해").**
## 넷째까지 끝나면 남는 row 0 항목은 대부분 이미 쓴 모양의 다른 원소
## 변형이라 셋째·넷째만큼 깔끔하지 않다고 적어 뒀는데, 그중 **chain**만은
## 예외다 — 무장(warrior)·방사(mystic)에게 chain을 채우면 다섯 직업
## 전부가 공유하는 첫 모양이 된다(지금까지 최대 넷 공유였던 bolt를 넘어선다).
## - 무장 `w_chain`(연환격, br3row0, el 없음) — 무장의 첫 chain.
## - 방사 `y_chain`(독쇄, br3row0, el:'pois') — 방사의 첫 chain(`pois`
##   원소는 `dungeon_enemy.gd`/`dungeon_items.gd`에 이미 있다 — 새 결 아님).
## skill_chain.gd/skill_chain_marshal.gd/skill_chain_scholar.gd와 판정·감쇠
## 계산이 완전히 같아(chain이 네 번째로 공유) 그대로 복제했다. 신규
## skill_chain_warrior.gd·skill_chain_mystic.gd, 입력 액션
## dungeon_skill_21~22(Z·5 키).
##
## **2026-09-15, 또 이어서 — 갈래(branch) 채우기로 방향 전환("이어해").**
## chain까지 옮긴 시점에서 세어 보니 **무장·방사는 이미 br 0·1·2·3·4·5
## 여섯 갈래 전부에 row 0이 있다**(무장: whirl·dash·passive·chain·throw·
## curse. 방사: summon·curse·passive·chain·bolt·nova). 반면 궁장은 br1이,
## 책사는 br0·br1 둘 다, 도독은 br5가 아직 비어 있다 — "다섯째 활성 무예"
## 보다 **"남은 갈래 채우기"**가 더 정확한 다음 걸음이다. 이번엔 그중
## 셋(궁장 br1, 책사 br0, 도독 br5)을 채운다 — 전부 이미 옮겨진 모양
## (bolt·swing)의 원소 변형이라 새 판정 코드가 없다:
## - 궁장 `a_fire`(화시, br1row0, bolt, el:'fire') — 궁장을 6/6으로.
## - 책사 `s_fire`(화탄, br0row0, bolt, el:'fire') — 책사는 아직 br1도
##   비어 있어(s_ice) 이번엔 5/6, 다음 걸음으로 남겨 둔다.
## - 도독 `m_flamesaber`(화도, br5row0, swing, el:'fire', r=1.7,
##   swing이므로 원작 r을 그대로 미터로 쓴다 — 위 헤더 참고) — 도독을
##   6/6으로. 도독은 swing이 이걸로 두 번째(m_smite br1에 이어) — 같은
##   클래스가 같은 모양을 두 갈래에 갖는 첫 사례라 스크립트 이름에
##   `2`를 붙인다(`skill_bolt_archer2.gd`·`skill_bolt_scholar2.gd`·
##   `skill_swing_marshal2.gd`).
## 입력 액션 dungeon_skill_23~25(6·7·8 키, STORY가 쓰는 숫자를 재사용 —
## 두 게임은 동시에 안 돈다, w_chain 때 Z를 그대로 썼던 것과 같은 판단).
##
## **2026-09-15, 또 이어서 — 책사의 마지막 빈 갈래("이어해").** br1
## (s_ice)만 채우면 **다섯 직업 전부 여섯 갈래(br0~5)에 row0을 갖는다**.
## 책사 `s_ice`(빙탄, br1row0, bolt, el:'cold') 추가 — 책사가 bolt를
## 세 갈래(br2 s_wave·br0 s_fire·br1 s_ice)에 갖는 첫 사례라 스크립트
## 이름은 `skill_bolt_scholar3.gd`. 입력 액션 dungeon_skill_26(9 키,
## STORY `story_job_skill4_3`이 쓰는 숫자 재사용 — 위와 같은 판단).
##
## **2026-09-15, 또 이어서 — row 1로 깊이 더하기, 첫 진짜 prereq 체인
## ("묻지 말고 순서대로 진행해줘").** 다섯 직업 모두 여섯 갈래에 row0을
## 가진 뒤라, 이번엔 다섯 직업 각각 row0이 있는 갈래 하나씩을 골라
## row1을 채운다 — **row0에 먼저 1점을 넣어야 row1을 배울 수 있는 진짜
## prereq_of() 체인이 이 슬라이스에서 처음 실제로 걸린다**(지금까진
## row0만 있어 prereq_of()가 항상 빈 딕셔너리를 돌려줬다). 다섯 다
## 새 판정 없이 기존 shape(bolt·swing·nova·buff)를 그대로 쓴다 — nova가
## 추가로 두 직업(책사·방사)에 처음 생긴다는 점만 새롭다:
## - 궁장 `a_ice`(빙시, br1row1, bolt, el:'cold') — prereq `a_fire`.
##   궁장의 세 번째 bolt(a_pierce·a_fire에 이어).
## - 무장 `w_cleave`(분쇄, br0row1, swing, r=1.7) — prereq `w_whirl`.
##   무장의 두 번째 swing.
## - 책사 `s_blaze`(염화, br0row1, nova, r=120→3.53, el:'fire') — prereq
##   `s_fire`. **책사의 첫 nova**.
## - 도독 `m_guard`(호신강기, br0row1, buff, sec=7, buff_eff:'guardPct')
##   — prereq `m_rally`. 도독의 두 번째 buff(m_rally와 같은 갈래 br0).
## - 방사 `y_wither`(고독, br1row1, nova, r=130→3.82, el:'pois') — prereq
##   `y_curse`. 방사의 두 번째 nova(y_thunderdoom br5에 이어).
## 스크립트는 같은 클래스 안에서 같은 shape가 몇 번째인지로 이름 붙인다
## (지금까지 관례 그대로): `skill_bolt_archer3.gd`(a_ice, 세 번째)·
## `skill_swing_warrior2.gd`(w_cleave, 두 번째)·`skill_nova_scholar.gd`
## (s_blaze, 첫 번째라 번호 없음)·`skill_buff_marshal2.gd`(m_guard, 두
## 번째)·`skill_nova_mystic2.gd`(y_wither, 두 번째). 입력 액션은
## dungeon_skill_27~31 — 이 시점에서 **A~Z 스물여섯 글자가 이동/공격/
## 무예 스물여섯 자리에 전부 차서**(움직임 4+공격1+무예21=26) 문자
## 키가 동났다. 숫자 0(dungeon_skill_27, 아직 안 쓴 마지막 숫자)에 이어
## 나머지 넷은 이 저장소에서 한 번도 안 쓴 구두점 키로 새로 연다:
## `,`·`.`·`;`·`/`(콤마·마침표·세미콜론·슬래시 — 프로젝트 전체에서
## grep해 확인, 어떤 판도 이 넷을 안 쓴다).
##
## **2026-09-15, 또 이어서 — row2로 네 갈래를 3/3까지 채운다("사가도곳
## 이어해줘 순서대로").** row1을 가진 갈래 중 넷을 골라 row2까지 채웠다 —
## 궁장 br0(a_pierce만 있음)은 row1(a_multi)이 "한 번에 셋을 쏜다"는
## 다중 표적 판정이 새로 필요해(shots/spread 필드, 지금 bolt는 가장
## 가까운 적 하나만 맞히는 히트스캔이라 그대로 못 옮긴다) 건너뛰고,
## 대신 이미 row1까지 있는 갈래 넷(궁장 br1·무장 br0·책사 br0·도독 br0)을
## 골랐다 — 전부 이미 옮겨진 shape(bolt·nova·buff)만 쓴다:
## - 궁장 `a_storm`(뇌시, br1row2, bolt, el:'lit') — prereq `a_ice`.
##   궁장 br1을 3/3(a_fire·a_ice·a_storm)으로.
## - 무장 `w_quake`(진각, br0row2, nova, r=150→4.41) — prereq `w_cleave`.
##   **무장의 첫 nova.** 무장 br0을 3/3(w_whirl·w_cleave·w_quake)으로.
## - 책사 `s_meteor`(유성, br0row2, nova, r=160→4.71, el:'fire') — prereq
##   `s_blaze`. 책사의 두 번째 nova. 책사 br0을 3/3(s_fire·s_blaze·
##   s_meteor)으로.
## - 도독 `m_banner`(독전, br0row2, buff, sec=8, buff_eff:'atkPct') —
##   prereq `m_guard`. 도독의 세 번째 buff. 도독 br0을 3/3(m_rally·
##   m_guard·m_banner)으로.
## 넷 다 기존 shape 스크립트(skill_bolt_archer3.gd·skill_nova_scholar.gd·
## skill_buff_marshal2.gd)를 복제 — 새 판정 로직 없음(무장의 첫 nova라는
## 점만 새롭다). 신규: skill_bolt_archer4.gd·skill_nova_warrior.gd·
## skill_nova_scholar2.gd·skill_buff_marshal3.gd(+버튼 4개). 입력 액션은
## dungeon_skill_32~35 — A~Z·0~9·`,.;/`까지 다 찬 뒤라(위 항목 참고)
## 이 저장소가 한 번도 안 쓴 나머지 ASCII 구두점 키로 연다: `[`·`\`·`]`·
## `` ` ``(대괄호 열고닫기·역슬래시·backtick — project.godot 전체 grep으로
## 확인, 어떤 판도 이 넷을 안 쓴다. 숫자패드 등 특수 키 영역은 정확한
## 물리 키코드를 확신할 수 없어 피했다).
##
## **2026-09-15, 또 이어서 — row1을 다섯 직업 한 번에("이어해줘 순서대로").**
## row2까지 3/3을 채운 네 갈래 다음으로, 아직 row1이 없는 갈래 중 다섯을
## 골랐다(궁장 br0은 a_multi가 다중 표적 판정이 새로 필요해 여전히
## 건너뛴다) — 전부 이미 옮겨진 shape(bolt·dash·nova·summon)만 쓴다:
## - 궁장 `a_venom`(독시, br3row1, bolt, el:'pois') — prereq `a_chain`.
##   궁장의 다섯 번째 bolt.
## - 무장 `w_leap`(도약, br1row1, dash, far=1.8) — prereq `w_dash`. 무장의
##   두 번째 dash — far가 처음으로 실제 돌진 시간(DASH_DURATION)에 반영된다
##   (0.2×1.8=0.36초, 위 dash 환산 기준 약 9m).
## - 책사 `s_frost`(한파, br1row1, nova, r=135→3.97, el:'cold') — prereq
##   `s_ice`. 책사의 세 번째 nova.
## - 도독 `m_ring`(기환, br1row1, nova, r=140→4.12, el:'chi') — prereq
##   `m_smite`. **도독의 첫 nova.**
## - 방사 `y_horde`(음병, br0row1, summon, str=1.5) — prereq `y_shade`.
##   방사의 두 번째 summon — `str`은 skill_summon.gd가 이미 `sk.get("str",
##   1.0)`으로 일반화해 둔 필드라 새 코드 없이 그대로 먹는다.
## 다섯 다 기존 shape 스크립트를 복제 — 새 판정 로직 없음(far가 실제
## 지속시간에 반영되는 것·도독의 첫 nova라는 점만 새롭다). 신규 10개:
## skill_bolt_archer5.gd/bolt_archer5_button.gd(🧪)·skill_dash_warrior2.gd/
## dash_warrior2_button.gd(🦘)·skill_nova_scholar3.gd/nova_scholar3_button.gd
## (🧊)·skill_nova_marshal.gd/nova_marshal_button.gd(⭕)·skill_summon_
## mystic2.gd/summon_mystic2_button.gd(💀). 입력 액션 dungeon_skill_36~40 —
## ASCII 키가 완전히 동나(A~Z·0~9·모든 구두점 키) `--headless --script`로
## `KEY_F1`~`KEY_F5` 실제 값을 조회해 확인 후 그 물리 키코드(4194332~
## 4194336)를 그대로 썼다(숫자패드는 지난 절에서 "확신 못 해 피했다"고
## 적었는데, 실제로 조회해 보니 짐작했던 값과 달랐다 — 짐작 대신 조회로
## 확정하는 쪽이 맞다는 걸 이번에 확인했다).
##
## **2026-09-15, 또 이어서 — row2로 다섯 갈래를 3/3까지 채운다("이어해줘
## 순서대로").** 직전 절에서 row1을 채운 다섯 갈래를 그대로 이어 row2까지
## 채웠다 — 전부 이미 옮겨진 shape(curse·buff·bolt·heal·summon)만 쓴다:
## - 궁장 `a_cripple`(파훼시, br3row2, curse, r=140→4.12) — prereq
##   `a_venom`. **궁장의 첫 curse.** 궁장 br3을 3/3으로.
## - 무장 `w_rage`(광분, br1row2, buff, sec=6, buff_eff:'atkSpdPct') —
##   prereq `w_leap`. **무장의 첫 buff.** 무장 br1을 3/3으로.
## - 책사 `s_bolt`(뇌격, br1row2, bolt, el:'lit') — prereq `s_frost`.
##   책사의 네 번째 bolt. 책사 br1을 3/3으로.
## - 도독 `m_heal`(치유, br1row2, heal) — prereq `m_ring`. **도독의 첫
##   heal.** 도독 br1을 3/3으로.
## - 방사 `y_golem`(토우, br0row2, summon, str=4, v=1·grow=0) — prereq
##   `y_horde`. 방사의 세 번째 summon(랭크 무관 늘 1개, "크고 오래 버티는
##   하나"). 원작 `big:true`는 분신 크기를 다르게 그리는 시스템이 없어
##   값만 보존하고 안 쓴다. 방사 br0을 3/3으로.
## 다섯 다 기존 shape 스크립트를 복제 — 새 판정 로직 없음(궁장의 첫
## curse·무장의 첫 buff·도독의 첫 heal이라는 점만 새롭다). 신규 10개:
## skill_curse_archer.gd/curse_archer_button.gd(💢)·skill_buff_warrior.gd/
## buff_warrior_button.gd(🔺)·skill_bolt_scholar4.gd/bolt_scholar4_button.gd
## (⚡)·skill_heal_marshal.gd/heal_marshal_button.gd(🌿)·skill_summon_
## mystic3.gd/summon_mystic3_button.gd(🗿). 입력 액션 dungeon_skill_41~45 —
## F1~F5(4194332~4194336) 다음이라 F6~F10(4194337~4194341)로 이어간다.
##
## **2026-09-15, 또 이어서 — 순서대로 다섯 갈래("이어해줘").** row2까지
## 채운 다섯 갈래(archer br1/3, warrior br0/1, scholar br0/1, marshal
## br0/1, mystic br0) 다음으로, 갈래 번호 오름차순으로 다음 빈 자리를
## 골랐다 — 방사는 br1이 이미 row0·row1(y_curse·y_wither)까지 있어 그
## row2부터, 나머지 넷은 아직 손 안 댄 br3(궁장만 br3도 이미 3/3이라
## 다음인 br4)의 row1부터. 전부 이미 옮겨진 shape(buff·dash·swing·curse)만
## 쓴다:
## - 궁장 `a_speedy`(속사태세, br4row1, buff, buff_eff:'atkSpdPct') —
##   prereq `a_flourish`. **궁장의 첫 buff.**
## - 무장 `w_blaze_dash`(화염돌진, br3row1, dash, el:'fire') — prereq
##   `w_chain`. 무장의 세 번째 dash.
## - 책사 `s_fan`(선풍, br3row1, swing, r=1.8, el:'cold') — prereq
##   `s_chainfire`. **책사의 첫 swing.**
## - 도독 `m_press`(위압, br3row1, curse, r=140→4.12) — prereq `m_chain`.
##   **도독의 첫 curse.**
## - 방사 `y_doom`(멸, br1row2, curse, r=160→4.71, sec=7) — prereq
##   `y_wither`. 방사의 두 번째 curse. 방사 br1을 3/3으로.
## 다섯 다 기존 shape 스크립트를 복제 — 새 판정 로직 없음(궁장의 첫
## buff·책사의 첫 swing·도독의 첫 curse라는 점만 새롭다). 신규 10개:
## skill_buff_archer.gd/buff_archer_button.gd(🏃)·skill_dash_warrior3.gd/
## dash_warrior3_button.gd(🔥)·skill_swing_scholar.gd/swing_scholar_button.gd
## (🎐)·skill_curse_marshal.gd/curse_marshal_button.gd(📛)·skill_curse_
## mystic2.gd/curse_mystic2_button.gd(☠️). 입력 액션 dungeon_skill_46~50 —
## F6~F10 다음이라 F11~F15로 이어간다(조회로 확인 후 배정).
##
## **2026-09-15, 새 세션에서 이어서 — 순서대로 다섯 갈래 더("새로운
## 세션에서 이어해").** 갈래 번호 오름차순으로 계속 — 궁장은 br0(a_multi,
## 여전히 새 메커니즘 필요)만 빼면 br5가 다음 빈 자리, 나머지 넷은 아직
## 손 안 댄 가장 낮은 갈래(br4, 방사만 br1까지 채워져 있어 br3)부터.
## 전부 이미 옮겨진 shape(heal·curse·summon·swing)만 쓴다:
## - 궁장 `a_firstaid`(응급처치, br5row1, heal) — prereq `a_dashshot`.
##   **궁장의 첫 heal.**
## - 무장 `w_regen`(회생, br4row1, heal) — prereq `w_throw`. **무장의
##   첫 heal.**
## - 책사 `s_hex`(저주, br4row1, curse, r=130→3.82) — prereq `s_blink`.
##   **책사의 첫 curse.**
## - 도독 `m_reserve`(원군소환, br4row1, summon) — prereq `m_javelin`.
##   **도독의 첫 summon**(str 필드 없음 → 기본 배율 1.0).
## - 방사 `y_ghoststrike`(음령타, br3row1, swing, r=1.8, el:'chi') —
##   prereq `y_chain`. **방사의 첫 swing.**
## 다섯 다 기존 shape 스크립트를 복제 — 새 판정 로직 없음(다섯 다 그
## 직업의 "첫 ○○"이라는 점만 새롭다 — 아홉 모양이 이제 어느 직업에나
## 최소 한 번씩은 다 옮겨졌다는 뜻이기도 하다). 신규 10개: skill_heal_
## archer.gd/heal_archer_button.gd(💗)·skill_heal_warrior.gd/heal_warrior_
## button.gd(💗)·skill_curse_scholar.gd/curse_scholar_button.gd(🕸️)·
## skill_summon_marshal.gd/summon_marshal_button.gd(🛡️)·skill_swing_
## mystic.gd/swing_mystic_button.gd(👻). 입력 액션 dungeon_skill_51~55 —
## F11~F15 다음이라 F16~F20으로 이어간다(조회로 확인 후 배정).
##
## **2026-09-15, 새 세션에서 또 이어서 — br3를 다섯 직업 3/3으로("사가고돗
## 이어 해줘").** 갈래 번호 오름차순 원칙 계속 — 궁장은 br3이 이미
## 3/3이라(a_chain·a_venom·a_cripple) 다음 미완성 갈래인 br4(row0·row1만
## 있음)의 row2, 나머지 넷은 br3(row0·row1만 있음)의 row2. 전부 이미
## 옮겨진 모양(summon·nova·dash·buff)만 쓴다 — 새 판정 로직 없음:
## - 궁장 `a_hawk`(응사소환, br4row2, summon, str 없음→배율 1.0) — prereq
##   `a_speedy`. **궁장의 첫 summon.**
## - 무장 `w_palm`(벽력장, br3row2, nova, r=150→4.41, el:'chi') — prereq
##   `w_blaze_dash`. 무장의 두 번째 nova(w_quake br0에 이어). 무장 br3을
##   3/3으로.
## - 책사 `s_spirit`(빙정소환, br3row2, summon, str 없음→배율 1.0) —
##   prereq `s_fan`. **책사의 첫 summon.** 책사 br3을 3/3으로.
## - 도독 `m_charge`(기신보, br3row2, dash, el:'chi') — prereq `m_press`.
##   **도독의 첫 dash.** 도독 br3을 3/3으로.
## - 방사 `y_possess`(귀합, br3row2, buff, sec=7, buff_eff:'atkPct') —
##   prereq `y_ghoststrike`. **방사의 첫 buff.** 방사 br3을 3/3으로.
## r=4.41(w_palm)은 w_quake와 원작 r이 똑같이 150이라 같은 환산값이
## 그대로 나온다(위 헤더의 nova 환산 참고). summon 둘(a_hawk·s_spirit)은
## 원작에 `str` 필드가 없어 skill_summon.gd의 `sk.get("str", 1.0)` 기본값
## 그대로 먹는다(y_shade·m_reserve와 같은 경계). dash(m_charge)도 `far`
## 필드가 없어 기본 지속시간 0.2초(w_dash·a_dashshot과 같음). 신규 10개:
## skill_summon_archer.gd/summon_archer_button.gd(🦅)·skill_nova_warrior2.gd/
## nova_warrior2_button.gd(👊)·skill_summon_scholar.gd/summon_scholar_
## button.gd(❄️)·skill_dash_marshal.gd/dash_marshal_button.gd(💨)·
## skill_buff_mystic.gd/buff_mystic_button.gd(🕯️). 입력 액션
## dungeon_skill_56~60 — F16~F20 다음이라 F21~F25(4194352~4194356,
## `--headless --script`로 조회해 확인 — 이전 다섯 번의 F 구간과 정확히
## 같은 등차 패턴)로 이어간다.
##
## **2026-09-15, 새 세션에서 또 이어서 — 남은 미완성 갈래 여섯을 한 번에
## ("사가고돗 이어 하자").** 직전 세션이 남긴 목록 그대로: 궁장 br5(row2만
## 빔)·무장 br4(row2만 빔)·책사 br4(row2만 빔)·도독 br4(row2만 빔)는
## prereq만 채우면 되는 row2, 방사는 br4·br5 둘 다 row1부터 비어 있었다.
## 전부 이미 옮겨진 모양(nova·summon·buff·dash·swing)만 쓴다 — 새 판정
## 로직 없음:
## - 궁장 `a_gale`(기환시, br5row2, nova, r=130→3.82, el:'chi') — prereq
##   `a_firstaid`. **궁장의 첫 nova.** 궁장을 br5 3/3으로.
## - 무장 `w_hound`(군견소환, br4row2, summon, str 없음→배율 1.0) —
##   prereq `w_regen`. **무장의 첫 summon.** 무장을 br4 3/3으로.
## - 책사 `s_insight`(심득, br4row2, buff, eff:'skillPct') — prereq
##   `s_hex`. **책사의 첫 buff.** 책사를 br4 3/3으로.
## - 도독 `m_precision`(필중, br4row2, buff, eff:'critPct') — prereq
##   `m_reserve`. 도독의 두 번째 buff(m_rally에 이어). 도독을 br4 3/3으로.
## - 방사 `y_specter`(귀보, br4row1, dash, el:'pois') — prereq
##   `y_soulbolt`. **방사의 첫 dash.**
## - 방사 `y_hellstrike`(화령타, br5row1, swing, r=1.7, kb=22, el:'fire') —
##   prereq `y_thunderdoom`. 방사의 두 번째 swing(y_ghoststrike에 이어).
## a_gale의 r=3.82는 y_thunderdoom과 원작 r이 똑같이 130이라 같은
## 환산값이 그대로 나온다(위 헤더 nova 환산 참고). w_hound는 원작에
## `str` 필드가 없어 skill_summon.gd 기본 배율(1.0) 그대로(y_shade·
## a_hawk 등과 같은 경계). y_hellstrike의 kb(넉백)는 이 슬라이스에
## 넉백이 없어 값만 보존하고 안 쓴다(w_palm과 같은 판단). 신규 12개:
## skill_nova_archer.gd/nova_archer_button.gd(🌀)·skill_summon_warrior.gd/
## summon_warrior_button.gd(🐕)·skill_buff_scholar.gd/buff_scholar_
## button.gd(🧠)·skill_buff_marshal4.gd/buff_marshal4_button.gd(🎯)·
## skill_dash_mystic.gd/dash_mystic_button.gd(👻)·skill_swing_mystic2.gd/
## swing_mystic2_button.gd(🔥). 입력 액션 dungeon_skill_61~66 — F21~F25
## 다음이라 F26~F31(4194357~4194362, `--headless --script`로 조회해
## 확인 — 이전 여섯 번의 F 구간과 정확히 같은 등차 패턴)로 이어간다.
##
## **2026-09-15, 새 세션에서 또 이어서("이어해줘").** 직전 세션이 웹판과
## 대조해 정확히 좁혀 둔 목록 그대로 — 무장·책사·도독 br5는 row0만 있어
## row1부터, 방사는 br4·br5 둘 다 row2만 비어 있었다. 궁장 br0(a_multi,
## 다중 표적 판정 필요)는 이번에도 보류. 전부 이미 옮겨진 모양(swing·
## nova·heal·chain)만 쓴다 — 새 판정 로직 없음:
## - 무장 `w_frostcleave`(빙인참, br5row1, swing, r=1.7, kb=30, el:'cold')
##   — prereq `w_intimidate`. 무장이 swing을 세 갈래(br0 w_whirl·w_cleave·
##   br5 w_frostcleave)에 갖는 첫 사례.
## - 책사 `s_plague`(역병, br5row1, nova, r=130→3.82, el:'pois') — prereq
##   `s_restore`. 책사의 네 번째 nova(s_blaze·s_meteor·s_frost에 이어).
## - 도독 `m_venomfield`(독진, br5row1, nova, r=140→4.12, el:'pois') —
##   prereq `m_flamesaber`. 도독의 두 번째 nova(m_ring에 이어).
## - 방사 `y_soulmend`(혼백치유, br4row2, heal, v=20, grow=7) — prereq
##   `y_specter`. **방사의 첫 heal.** 방사를 br4 3/3으로.
## - 방사 `y_frostchain`(빙쇄, br5row2, chain, el:'cold') — prereq
##   `y_hellstrike`. 방사의 두 번째 chain(y_chain에 이어). 방사를 br5
##   3/3으로.
## r=4.12(m_venomfield)는 m_ring과 원작 r이 똑같이 140이라 같은 환산값이
## 그대로 나온다. w_frostcleave의 kb(넉백 30)는 이 슬라이스에 넉백이
## 없어 값만 보존하고 안 쓴다(w_palm·y_hellstrike와 같은 판단).
## y_frostchain은 원작에 `r` 필드가 없어 skill_chain_mystic.gd의
## DEFAULT_RANGE(7.65) 그대로 먹는다(y_chain과 같은 경계). 신규 10개:
## skill_swing_warrior3.gd/swing_warrior3_button.gd(🧊)·skill_nova_
## scholar4.gd/nova_scholar4_button.gd(🦠)·skill_nova_marshal2.gd/
## nova_marshal2_button.gd(☠️)·skill_heal_mystic.gd/heal_mystic_
## button.gd(💗)·skill_chain_mystic2.gd/chain_mystic2_button.gd(🧊).
## 입력 액션 dungeon_skill_67~71 — F26~F31 다음인 F32~F35(4194363~
## 4194366, `--headless --script`로 조회해 확인)까지만 네 개고 Godot는
## KEY_F36이 없어(KeyList가 F35에서 끝난다, 조회로 확인) 다섯째는
## 처음으로 숫자패드(KP_0=4194438, 마찬가지로 조회해 확인)를 쓴다.
##
## **2026-09-15, 새 세션에서 또 이어서("이어해").** 직전 세션이 남긴
## 마지막 목록 중 아직 손 안 댄 row1까지만 있는 세 갈래(row2가 빈
## warrior br5·scholar br5·marshal br5)를 채운다 — 전부 이미 옮겨진
## 모양(bolt·dash)만 써서 새 판정 로직이 필요 없다: 무장 `w_thunderlance`
## (벽력창, br5row2, bolt, el:'lit') — prereq `w_frostcleave`. 무장의
## 두 번째 bolt(w_throw에 이어). 무장 br5를 3/3으로. 책사 `s_venombolt`
## (독무탄, br5row2, bolt, el:'pois') — prereq `s_plague`. 책사의 다섯
## 번째 bolt(s_wave·s_fire·s_ice·s_bolt에 이어). 책사 br5를 3/3으로.
## 도독 `m_frostcharge`(빙보, br5row2, dash, el:'cold') — prereq
## `m_venomfield`. 도독의 두 번째 dash(m_charge에 이어). 도독 br5를
## 3/3으로. 이걸로 **다섯 직업 여섯 갈래(br0~5) 전부 3/3인 것은 궁장을
## 뺀 나머지 넷**이고, 궁장만 br0의 a_multi(다중 표적, 새 메커니즘
## 필요)·a_rain이 막혀 5/6 상태로 남는다 — 이 나무에서 유일하게 남은
## 빈 자리다.
## 신규 6개: skill_bolt_warrior2.gd/bolt_warrior2_button.gd(⚡)·
## skill_bolt_scholar5.gd/bolt_scholar5_button.gd(☠️)·skill_dash_
## marshal2.gd/dash_marshal2_button.gd(🧊). 입력 액션 dungeon_skill_
## 72~74 — KP_0(직전 세션) 다음이라 이어서 숫자패드 KP_1~KP_3
## (4194439~4194441, 조회로 확인)를 쓴다.
##
## **2026-09-15, 새 세션에서 또 이어서("이어해") — 궁장 br0, 51장
## "장비→빌드" 마지막 빈 자리.** `a_multi`(연사, br0row1)가 이 슬라이스
## 전체에서 처음으로 `shots`·`spread` 필드를 쓰는 스킬이라 새 판정
## 로직이 실제로 필요했다. 원작 dungeon.js applyShapeSkill()의 'bolt'
## 분기는 `shots`개의 투사체를 `spread` 라디안 간격의 부채꼴로 조준
## 방향 기준 발사한다(각 투사체는 독립된 전체 위력 — 데미지를 나눠
## 갖지 않는다). 이 슬라이스의 bolt는 애초에 투사체가 없는 "최근접 적
## 즉시 명중" 히트스캔이라 조준 방향 자체가 없다 — **부채꼴 산개는
## 근사 대상에서 빼고, "각 슛이 독립된 전체 위력"이라는 성질만
## 보존해 "가장 가까운 적 최대 shots명에게 각각 전체 위력으로 명중"
## 으로 근사한다.** 대상이 shots보다 적으면 있는 만큼만 맞는다(원작도
## 사거리 안에 적이 없으면 그 투사체는 허공으로 날아가 아무 일도
## 안 일어난다 — 결과가 같다).
## - 궁장 `a_multi`(연사, br0row1, bolt, shots:3, spread:0.34) — prereq
##   `a_pierce`. 궁장의 여섯 번째 bolt(a_pierce·a_fire·a_ice·a_storm·
##   a_venom에 이어).
## - 궁장 `a_rain`(시우, br0row2, nova, r=130→3.82) — prereq `a_multi`.
##   궁장의 두 번째 nova(a_gale에 이어, 기존 모양 그대로 재사용 — 새
##   판정 로직 없음). **이걸로 궁장 br0가 3/3으로 차고, 다섯 직업
##   전부가 여섯 갈래(br0~5) 전부 3/3 — 51장 "장비→빌드" 축 완주.**
## 신규 4개: skill_bolt_archer6.gd/bolt_archer6_button.gd(🏹)·skill_nova_
## archer2.gd/nova_archer2_button.gd(🌧️). 입력 액션 dungeon_skill_
## 75~76 — KP_3(직전 세션) 다음이라 이어서 숫자패드 KP_4~KP_5
## (4194442~4194443, 조회로 확인)를 쓴다.

const MAX_RANK := 5

const SKILLS: Array[Dictionary] = [
	## 궁장(弓將) br=2 — data-skill.js 그대로.
	{ "key": "a_eye", "cls": "archer", "br": 2, "row": 0, "name": "매의 눈(鷹眼)",
		"eff": "critPct", "v": 4.0, "grow": 3.0, "desc": "치명타 확률이 오른다." },
	{ "key": "a_reach", "cls": "archer", "br": 2, "row": 1, "name": "장궁(長弓)",
		"eff": "reachPct", "v": 8.0, "grow": 6.0, "desc": "닿는 거리가 길어진다." },
	{ "key": "a_swift", "cls": "archer", "br": 2, "row": 2, "name": "질보(疾步)",
		"eff": "atkSpdPct", "v": 6.0, "grow": 4.0, "desc": "손이 빨라진다." },
	## 궁장(弓將) br=5 row 0 — data-skill.js 그대로(cost=18은 기력이 없어
	## 안 씀). el 없음(물리) — 위 헤더의 dash 환산 참고.
	{ "key": "a_dashshot", "cls": "archer", "br": 5, "row": 0, "name": "질주사(疾走射)",
		"shape": "dash", "cd": 6.0,
		"eff": "", "v": 1.3, "grow": 0.3, "desc": "몸을 날려 스치며 벤다." },
	## 궁장(弓將) br=3 row 0 — data-skill.js 그대로(cost=22는 기력이 없어
	## 안 씀). r=7.65는 위 헤더의 chain 환산(260÷34) 참고. hops·el 없음(원작도
	## 없음 → hops 기본 3, el 기본 phys).
	{ "key": "a_chain", "cls": "archer", "br": 3, "row": 0, "name": "연환시(連環矢)",
		"shape": "chain", "cd": 9.0, "r": 7.65,
		"eff": "", "v": 1.7, "grow": 0.4, "desc": "가까운 적을 꿰고 다음 적으로 튄다." },
	## 궁장(弓將) br=0 row 0 — data-skill.js 그대로(cost=14는 기력이 없어
	## 안 씀). el 없음(물리) — 궁장의 첫 bolt.
	{ "key": "a_pierce", "cls": "archer", "br": 0, "row": 0, "name": "관통사(貫通射)",
		"shape": "bolt", "cd": 3.0,
		"eff": "", "v": 1.6, "grow": 0.35, "desc": "꿰뚫는 화살. 뒤의 적까지 닿는다." },
	## 궁장(弓將) br=4 row 0 — data-skill.js 그대로(cost=20은 기력이 없어
	## 안 씀). r=1.6은 m_smite와 같은 자릿수(swing은 원작 r을 그대로
	## 미터로 쓴다 — 위 헤더 참고). 궁장의 첫 swing.
	{ "key": "a_flourish", "cls": "archer", "br": 4, "row": 0, "name": "궁신무(弓身舞)",
		"shape": "swing", "cd": 5.0, "r": 1.6,
		"eff": "", "v": 1.5, "grow": 0.35, "desc": "활대로 후려친다. 가까이 붙은 적에게 쓴다." },
	## 궁장(弓將) br=1 row 0 — data-skill.js 그대로(cost=18은 기력이 없어
	## 안 씀). el:'fire' — 궁장을 여섯 갈래(0·1·2·3·4·5) 전부 채운다.
	{ "key": "a_fire", "cls": "archer", "br": 1, "row": 0, "name": "화시(火矢)",
		"shape": "bolt", "cd": 4.0, "el": "fire",
		"eff": "", "v": 1.5, "grow": 0.4, "desc": "불붙은 화살." },
	## 궁장(弓將) br=1 row 1 — data-skill.js 그대로(cost=22는 기력이 없어
	## 안 씀). prereq: a_fire(같은 br row0). 궁장의 세 번째 bolt.
	{ "key": "a_ice", "cls": "archer", "br": 1, "row": 1, "name": "빙시(氷矢)",
		"shape": "bolt", "cd": 5.0, "el": "cold",
		"eff": "", "v": 1.4, "grow": 0.35, "desc": "언 화살. 맞은 적이 굼떠진다." },
	## 무장(武將) br=0 row 0 — data-skill.js 그대로. shape/cd는 원작 값
	## 그대로(cost=22는 기력이 없어 안 씀, kb=30은 넉백이 없어 안 씀).
	{ "key": "w_whirl", "cls": "warrior", "br": 0, "row": 0, "name": "회전참(回轉斬)",
		"shape": "swing", "cd": 5.0, "r": 2.3,
		"eff": "", "v": 1.7, "grow": 0.35, "desc": "둘레의 모든 적을 벤다." },
	## 무장(武將) br=0 row 1 — data-skill.js 그대로(cost=28은 기력이 없어
	## 안 씀, kb=46은 넉백 없음). prereq: w_whirl(같은 br row0). 무장의
	## 두 번째 swing.
	{ "key": "w_cleave", "cls": "warrior", "br": 0, "row": 1, "name": "분쇄(粉碎)",
		"shape": "swing", "cd": 7.0, "r": 1.7,
		"eff": "", "v": 2.6, "grow": 0.5, "desc": "한 번에 크게 벤다." },
	## 무장(武將) br=2 — data-skill.js 그대로.
	{ "key": "w_tough", "cls": "warrior", "br": 2, "row": 0, "name": "단련(鍛鍊)",
		"eff": "hpPct", "v": 8.0, "grow": 5.0, "desc": "부대 체력이 오른다." },
	{ "key": "w_mastery", "cls": "warrior", "br": 2, "row": 1, "name": "병기술(兵器術)",
		"eff": "atkPct", "v": 7.0, "grow": 5.0, "desc": "부대 공격력이 오른다." },
	{ "key": "w_second", "cls": "warrior", "br": 2, "row": 2, "name": "이혼대법(離魂)",
		"eff": "drainPct", "v": 2.0, "grow": 1.0, "desc": "적을 잡으면 체력이 조금 돌아온다." },
	## 무장(武將) br=5 row 0 — data-skill.js 그대로(cost=24는 기력이 없어
	## 안 씀). r=3.82는 y_thunderdoom과 같은 환산(위 헤더 참고, 원작 r도
	## 130으로 같다). sec(지속초)은 랭크 무관 고정.
	{ "key": "w_intimidate", "cls": "warrior", "br": 5, "row": 0, "name": "위해(威嚇)",
		"shape": "curse", "cd": 9.0, "r": 3.82, "sec": 5.0,
		"eff": "", "v": 30.0, "grow": 8.0, "desc": "노호로 적을 굼뜨고 약하게 만든다." },
	## 무장(武將) br=1 row 0 — data-skill.js 그대로(cost=18은 기력이 없어
	## 안 씀). el 없음(물리) — 무장의 첫 dash(skill_dash.gd 그대로 복제).
	{ "key": "w_dash", "cls": "warrior", "br": 1, "row": 0, "name": "돌진(突進)",
		"shape": "dash", "cd": 6.0,
		"eff": "", "v": 1.2, "grow": 0.3, "desc": "앞으로 파고들며 벤다." },
	## 무장(武將) br=4 row 0 — data-skill.js 그대로(cost=16은 기력이 없어
	## 안 씀). el 없음(물리) — 무장의 첫 bolt.
	{ "key": "w_throw", "cls": "warrior", "br": 4, "row": 0, "name": "투창(投槍)",
		"shape": "bolt", "cd": 4.0,
		"eff": "", "v": 1.6, "grow": 0.4, "desc": "창을 던진다. 곧게 나간다." },
	## 무장(武將) br=3 row 0 — data-skill.js 그대로(cost=24는 기력이 없어
	## 안 씀). r=7.65는 a_chain 등과 같은 환산(위 헤더 참고, 원작 r 필드
	## 없음 → 기본 260px). el 없음(물리) — 무장의 첫 chain.
	{ "key": "w_chain", "cls": "warrior", "br": 3, "row": 0, "name": "연환격(連環擊)",
		"shape": "chain", "cd": 9.0, "r": 7.65,
		"eff": "", "v": 1.8, "grow": 0.4, "desc": "가까운 적을 치고 다음 적으로 옮겨 붙는다." },
	## 책사(策士) br=2 — row 0(s_wave)만 passive가 아니다(위 헤더 참고).
	## shape/cd/el은 data-skill.js 그대로(cost=30은 기력이 없어 안 씀).
	{ "key": "s_wave", "cls": "scholar", "br": 2, "row": 0, "name": "기공파(氣功波)",
		"shape": "bolt", "cd": 8.0, "el": "chi",
		"eff": "", "v": 2.2, "grow": 0.5, "desc": "꿰뚫는 기를 쏜다." },
	{ "key": "s_wit", "cls": "scholar", "br": 2, "row": 1, "name": "명민(明敏)",
		"eff": "mpRegen", "v": 2.0, "grow": 1.4, "desc": "기력이 빨리 찬다.(아직 기력 없음)" },
	{ "key": "s_focus", "cls": "scholar", "br": 2, "row": 2, "name": "집중(集中)",
		"eff": "skillPct", "v": 10.0, "grow": 7.0, "desc": "무예의 위력이 오른다." },
	## 책사(策士) br=5 row 0 — data-skill.js 그대로(cost=30은 기력이 없어
	## 안 씀). v는 "최대 체력의 %"(player_health.gd::heal_by()가 그대로
	## 받는다) — eff/world_eff_sum과는 무관해 비워 둘 필요조차 없지만
	## 다른 shape 무예와 통일한다.
	{ "key": "s_restore", "cls": "scholar", "br": 5, "row": 0, "name": "축기회복(蓄氣回復)",
		"shape": "heal", "cd": 16.0,
		"eff": "", "v": 16.0, "grow": 6.0, "desc": "기를 모아 상처를 아문다." },
	## 책사(策士) br=3 row 0 — data-skill.js 그대로(cost=26은 기력이 없어
	## 안 씀). r=7.65는 a_chain·m_chain과 같은 환산(원작 r 필드 없음 →
	## 기본 260px). el:'fire'만 다르다 — chain이 세 번째로 공유하는 직업.
	{ "key": "s_chainfire", "cls": "scholar", "br": 3, "row": 0, "name": "연쇄화염(連鎖火焰)",
		"shape": "chain", "cd": 9.0, "r": 7.65, "el": "fire",
		"eff": "", "v": 1.9, "grow": 0.45, "desc": "불덩이가 적 사이를 옮겨 붙는다." },
	## 책사(策士) br=4 row 0 — data-skill.js 그대로(cost=20은 기력이 없어
	## 안 씀). el:'lit' — 책사의 첫 dash.
	{ "key": "s_blink", "cls": "scholar", "br": 4, "row": 0, "name": "축지(縮地)",
		"shape": "dash", "cd": 7.0, "el": "lit",
		"eff": "", "v": 1.3, "grow": 0.3, "desc": "번개처럼 파고든다." },
	## 책사(策士) br=0 row 0 — data-skill.js 그대로(cost=16은 기력이 없어
	## 안 씀). el:'fire' — 책사는 이걸로 5/6(br1만 남는다).
	{ "key": "s_fire", "cls": "scholar", "br": 0, "row": 0, "name": "화탄(火彈)",
		"shape": "bolt", "cd": 3.0, "el": "fire",
		"eff": "", "v": 1.8, "grow": 0.45, "desc": "불덩이를 던진다." },
	## 책사(策士) br=0 row 1 — data-skill.js 그대로(cost=30은 기력이 없어
	## 안 씀). r=3.53은 원작 120px÷BASE_REACH(34, 위 헤더 nova 환산 참고).
	## prereq: s_fire(같은 br row0). 책사의 첫 nova.
	{ "key": "s_blaze", "cls": "scholar", "br": 0, "row": 1, "name": "염화(炎火)",
		"shape": "nova", "cd": 8.0, "r": 3.53, "el": "fire",
		"eff": "", "v": 2.4, "grow": 0.55, "desc": "둘레가 불바다가 된다." },
	## 책사(策士) br=1 row 0 — data-skill.js 그대로(cost=16은 기력이 없어
	## 안 씀). el:'cold' — 책사를 여섯 갈래 전부 채운다(다섯 직업 전부
	## 6/6 완성). bolt가 책사의 세 번째 갈래(br2 s_wave·br0 s_fire에 이어).
	{ "key": "s_ice", "cls": "scholar", "br": 1, "row": 0, "name": "빙탄(氷彈)",
		"shape": "bolt", "cd": 3.0, "el": "cold",
		"eff": "", "v": 1.5, "grow": 0.4, "desc": "언 덩이를 던진다." },
	## 도독(都督) br=0 row 0 — data-skill.js 그대로(cost=34는 기력이 없어
	## 안 씀). sec(지속초)은 랭크와 무관하게 고정(원작 그대로) — v(위력)만
	## value_at()으로 랭크에 따라 는다. **`eff`를 비워 둔 이유** — 다른
	## shape 무예(bolt·swing·nova·dash)와 같은 이유다: `eff`를 채우면
	## `dungeon_skill_state.gd::world_eff_sum()`이 "랭크만 있으면 늘
	## 더하는 패시브"로 착각해 버프가 안 걸려 있어도 영구히 atkSpdPct가
	## 오른다. 실제로 버프할 자리는 `buff_eff`라는 별도 필드에 둔다
	## (skill_buff.gd가 캐스팅 순간에만 이 값을 읽어 `DungeonRunState.
	## add_temp_buff()`로 넘긴다 — 랭크 합산과 완전히 분리된 경로).
	{ "key": "m_rally", "cls": "marshal", "br": 0, "row": 0, "name": "사기(士氣)",
		"shape": "buff", "cd": 16.0, "sec": 6.0, "buff_eff": "atkSpdPct",
		"eff": "", "v": 30.0, "grow": 8.0, "desc": "한동안 손과 발이 빨라진다." },
	## 도독(都督) br=0 row 1 — data-skill.js 그대로(cost=30은 기력이 없어
	## 안 씀). eff는 m_rally와 같은 이유로 비워 두고 buff_eff에 담는다
	## (dungeon_skills.gd 헤더 참고). prereq: m_rally(같은 br row0).
	## 도독의 두 번째 buff.
	{ "key": "m_guard", "cls": "marshal", "br": 0, "row": 1, "name": "호신강기(護身)",
		"shape": "buff", "cd": 14.0, "sec": 7.0, "buff_eff": "guardPct",
		"eff": "", "v": 35.0, "grow": 8.0, "desc": "한동안 받는 피해가 준다." },
	## 도독(都督) br=2 — data-skill.js 그대로.
	{ "key": "m_res", "cls": "marshal", "br": 2, "row": 0, "name": "기수련(氣修)",
		"eff": "allResPct", "v": 5.0, "grow": 4.0, "desc": "모든 결의 저항이 오른다.(아직 합산 채널 없음)" },
	{ "key": "m_wall", "cls": "marshal", "br": 2, "row": 1, "name": "철벽(鐵壁)",
		"eff": "guardPct", "v": 4.0, "grow": 3.0, "desc": "받는 피해가 늘 조금 준다." },
	{ "key": "m_lead", "cls": "marshal", "br": 2, "row": 2, "name": "통솔(統率)",
		"eff": "hpPct", "v": 6.0, "grow": 4.0, "desc": "부대 체력이 오른다." },
	## 도독(都督) br=3 row 0 — data-skill.js 그대로(cost=24는 기력이 없어
	## 안 씀). r=7.65는 a_chain과 같은 환산(위 헤더 참고, 원작 r 필드 없음 →
	## 기본 260px). el:'chi'만 a_chain(phys)과 다르다.
	{ "key": "m_chain", "cls": "marshal", "br": 3, "row": 0, "name": "연환기격(連環氣擊)",
		"shape": "chain", "cd": 9.0, "r": 7.65, "el": "chi",
		"eff": "", "v": 1.9, "grow": 0.4, "desc": "기를 실어 가까운 적을 연달아 친다." },
	## 도독(都督) br=1 row 0 — data-skill.js 그대로(cost=20은 기력이 없어
	## 안 씀). r=1.6은 w_whirl(2.3)과 같은 자릿수(swing은 이미 미터로 쓸
	## 만한 원작 r을 그대로 쓴다 — 위 헤더 참고). 도독의 첫 swing.
	{ "key": "m_smite", "cls": "marshal", "br": 1, "row": 0, "name": "기격(氣擊)",
		"shape": "swing", "cd": 4.0, "r": 1.6, "el": "chi",
		"eff": "", "v": 1.9, "grow": 0.4, "desc": "기를 실어 둘레를 친다." },
	## 도독(都督) br=4 row 0 — data-skill.js 그대로(cost=16은 기력이 없어
	## 안 씀). el:'chi' — 도독의 첫 bolt.
	{ "key": "m_javelin", "cls": "marshal", "br": 4, "row": 0, "name": "표창(標槍)",
		"shape": "bolt", "cd": 4.0, "el": "chi",
		"eff": "", "v": 1.5, "grow": 0.35, "desc": "기를 실은 창을 던진다." },
	## 도독(都督) br=5 row 0 — data-skill.js 그대로(cost=24는 기력이 없어
	## 안 씀). r=1.7은 swing 원작 값 그대로 미터로(m_smite와 같은 요령).
	## el:'fire' — 도독을 여섯 갈래 전부 채운다. swing이 도독의 두 번째
	## (m_smite br1에 이어) — 같은 클래스가 같은 모양을 두 갈래에 갖는
	## 첫 사례.
	{ "key": "m_flamesaber", "cls": "marshal", "br": 5, "row": 0, "name": "화도(火刀)",
		"shape": "swing", "cd": 6.0, "r": 1.7, "el": "fire",
		"eff": "", "v": 1.9, "grow": 0.4, "desc": "불을 두른 칼로 둘레를 벤다." },
	## 방사(方士) br=0 row 0 — data-skill.js 그대로(cost=26은 기력이 없어
	## 안 씀). v/grow는 데미지가 아니라 분신 "개체 수"(round(value_at))다
	## — 위 헤더 참고. sec(지속초)은 랭크 무관 고정.
	{ "key": "y_shade", "cls": "mystic", "br": 0, "row": 0, "name": "분신술(分身)",
		"shape": "summon", "cd": 12.0, "sec": 12.0,
		"eff": "", "v": 1.0, "grow": 1.0, "desc": "분신을 세운다. 대신 싸운다." },
	## 방사(方士) br=2 — data-skill.js 그대로.
	{ "key": "y_leech", "cls": "mystic", "br": 2, "row": 0, "name": "흡정(吸精)",
		"eff": "drainPct", "v": 2.0, "grow": 1.5, "desc": "적을 잡으면 체력이 돌아온다." },
	{ "key": "y_hex", "cls": "mystic", "br": 2, "row": 1, "name": "주술(呪術)",
		"eff": "skillPct", "v": 8.0, "grow": 6.0, "desc": "무예의 위력이 오른다." },
	{ "key": "y_spirit", "cls": "mystic", "br": 2, "row": 2, "name": "정신(精神)",
		"eff": "mpRegen", "v": 2.0, "grow": 1.2, "desc": "기력이 빨리 찬다.(아직 기력 없음)" },
	## 방사(方士) br=5 row 0 — data-skill.js 그대로(cost=30은 기력이 없어
	## 안 씀). r=3.82는 원작 130px÷BASE_REACH(34px) — 위 헤더 참고.
	{ "key": "y_thunderdoom", "cls": "mystic", "br": 5, "row": 0, "name": "뇌쇄(雷殺)",
		"shape": "nova", "cd": 9.0, "r": 3.82, "el": "lit",
		"eff": "", "v": 2.2, "grow": 0.5, "desc": "벼락이 둘레에 떨어진다." },
	## 방사(方士) br=1 row 0 — data-skill.js 그대로(cost=20은 기력이 없어
	## 안 씀). r=3.82·sec=5.0·v=30.0은 w_intimidate와 전부 같다(원작에서도
	## 그렇다, r 130도 동일). 방사의 첫 curse.
	{ "key": "y_curse", "cls": "mystic", "br": 1, "row": 0, "name": "주박(呪縛)",
		"shape": "curse", "cd": 8.0, "r": 3.82, "sec": 5.0,
		"eff": "", "v": 30.0, "grow": 8.0, "desc": "둘레의 적이 굼떠지고 더 아파한다." },
	## 방사(方士) br=1 row 1 — data-skill.js 그대로(cost=28은 기력이 없어
	## 안 씀). r=3.82는 원작 130px÷BASE_REACH(34)와 같은 값(w_intimidate·
	## y_curse와 동일 자릿수). prereq: y_curse(같은 br row0). 방사의
	## 두 번째 nova(y_thunderdoom br5에 이어).
	{ "key": "y_wither", "cls": "mystic", "br": 1, "row": 1, "name": "고독(蠱毒)",
		"shape": "nova", "cd": 9.0, "r": 3.82, "el": "pois",
		"eff": "", "v": 2.2, "grow": 0.5, "desc": "독기가 둘레에 퍼진다." },
	## 방사(方士) br=4 row 0 — data-skill.js 그대로(cost=16은 기력이 없어
	## 안 씀). el:'chi' — 방사의 첫 bolt. 이걸로 bolt를 가진 직업이
	## 궁장·무장·도독·방사 넷으로 는다(위 헤더 참고, 책사는 이미 별개로
	## s_wave가 있어 다섯 다 bolt를 갖는다).
	{ "key": "y_soulbolt", "cls": "mystic", "br": 4, "row": 0, "name": "혼탄(魂彈)",
		"shape": "bolt", "cd": 3.0, "el": "chi",
		"eff": "", "v": 1.6, "grow": 0.4, "desc": "넋을 실은 기를 쏜다." },
	## 방사(方士) br=3 row 0 — data-skill.js 그대로(cost=22는 기력이 없어
	## 안 씀). r=7.65는 w_chain 등과 같은 환산(원작 r 필드 없음 → 기본
	## 260px). el:'pois' — 방사의 첫 chain. 이걸로 chain이 다섯 직업 전부가
	## 공유하는 첫 모양이 된다(위 헤더 참고).
	{ "key": "y_chain", "cls": "mystic", "br": 3, "row": 0, "name": "독쇄(毒鎖)",
		"shape": "chain", "cd": 9.0, "r": 7.65, "el": "pois",
		"eff": "", "v": 1.8, "grow": 0.4, "desc": "독한 기운이 적 사이를 옮겨 붙는다." },
	## 궁장(弓將) br=1 row 2 — data-skill.js 그대로(cost=30은 기력이 없어
	## 안 씀). el:'lit' — prereq a_ice(같은 br row1). 궁장을 br1 3/3으로.
	{ "key": "a_storm", "cls": "archer", "br": 1, "row": 2, "name": "뇌시(雷矢)",
		"shape": "bolt", "cd": 8.0, "el": "lit",
		"eff": "", "v": 2.0, "grow": 0.55, "desc": "벼락을 실은 화살. 편차가 크다." },
	## 무장(武將) br=0 row 2 — data-skill.js 그대로(cost=36은 기력이 없어
	## 안 씀, kb=60은 넉백 없음). r=4.41은 위 헤더의 nova 환산(150÷34) 참고.
	## prereq w_cleave(같은 br row1). 무장의 첫 nova. 무장을 br0 3/3으로.
	{ "key": "w_quake", "cls": "warrior", "br": 0, "row": 2, "name": "진각(震脚)",
		"shape": "nova", "cd": 11.0, "r": 4.41,
		"eff": "", "v": 3.0, "grow": 0.6, "desc": "땅을 굴러 둘레를 뒤흔든다." },
	## 책사(策士) br=0 row 2 — data-skill.js 그대로(cost=42는 기력이 없어
	## 안 씀). r=4.71은 위 헤더의 nova 환산(160÷34) 참고. prereq s_blaze
	## (같은 br row1). 책사의 두 번째 nova. 책사를 br0 3/3으로.
	{ "key": "s_meteor", "cls": "scholar", "br": 0, "row": 2, "name": "유성(流星)",
		"shape": "nova", "cd": 14.0, "r": 4.71, "el": "fire",
		"eff": "", "v": 4.0, "grow": 0.9, "desc": "별이 떨어진다." },
	## 도독(都督) br=0 row 2 — data-skill.js 그대로(cost=40은 기력이 없어
	## 안 씀). eff는 m_rally·m_guard와 같은 이유로 비워 두고 buff_eff에
	## 담는다(dungeon_skills.gd 헤더 참고). prereq m_guard(같은 br row1).
	## 도독의 세 번째 buff. 도독을 br0 3/3으로.
	{ "key": "m_banner", "cls": "marshal", "br": 0, "row": 2, "name": "독전(督戰)",
		"shape": "buff", "cd": 20.0, "sec": 8.0, "buff_eff": "atkPct",
		"eff": "", "v": 40.0, "grow": 10.0, "desc": "한동안 부대의 공격이 세진다." },
	## 궁장(弓將) br=3 row 1 — data-skill.js 그대로(cost=18은 기력이 없어
	## 안 씀). el:'pois'. prereq a_chain(같은 br row0). 궁장의 다섯 번째 bolt.
	{ "key": "a_venom", "cls": "archer", "br": 3, "row": 1, "name": "독시(毒矢)",
		"shape": "bolt", "cd": 4.0, "el": "pois",
		"eff": "", "v": 1.4, "grow": 0.35, "desc": "독을 바른 화살. 스민 독이 계속 아프게 한다." },
	## 무장(武將) br=1 row 1 — data-skill.js 그대로(cost=26은 기력이 없어
	## 안 씀). far=1.8은 위 헤더의 dash 환산(DASH_DURATION=0.2*far) 참고.
	## prereq w_dash(같은 br row0). 무장의 두 번째 dash.
	{ "key": "w_leap", "cls": "warrior", "br": 1, "row": 1, "name": "도약(跳躍)",
		"shape": "dash", "cd": 9.0,
		"eff": "", "v": 2.0, "grow": 0.45, "desc": "더 멀리 뛴다. 지나는 것을 다 벤다." },
	## 책사(策士) br=1 row 1 — data-skill.js 그대로(cost=28은 기력이 없어
	## 안 씀). r=3.97은 위 헤더의 nova 환산(135÷34) 참고. prereq s_ice(같은
	## br row0). 책사의 세 번째 nova.
	{ "key": "s_frost", "cls": "scholar", "br": 1, "row": 1, "name": "한파(寒波)",
		"shape": "nova", "cd": 9.0, "r": 3.97, "el": "cold",
		"eff": "", "v": 2.0, "grow": 0.5, "desc": "둘레가 얼어붙는다." },
	## 도독(都督) br=1 row 1 — data-skill.js 그대로(cost=30은 기력이 없어
	## 안 씀). r=4.12는 위 헤더의 nova 환산(140÷34) 참고. prereq m_smite
	## (같은 br row0). 도독의 첫 nova.
	{ "key": "m_ring", "cls": "marshal", "br": 1, "row": 1, "name": "기환(氣環)",
		"shape": "nova", "cd": 9.0, "r": 4.12, "el": "chi",
		"eff": "", "v": 2.3, "grow": 0.55, "desc": "기의 고리가 퍼진다." },
	## 방사(方士) br=0 row 1 — data-skill.js 그대로(cost=36은 기력이 없어
	## 안 씀). str=1.5는 skill_summon.gd가 이미 일반화해 둔 필드(위 헤더
	## 참고). prereq y_shade(같은 br row0). 방사의 두 번째 summon.
	{ "key": "y_horde", "cls": "mystic", "br": 0, "row": 1, "name": "음병(陰兵)",
		"shape": "summon", "cd": 16.0, "sec": 14.0, "str": 1.5,
		"eff": "", "v": 2.0, "grow": 1.0, "desc": "더 많이, 더 세게 세운다." },
	## 궁장(弓將) br=3 row 2 — data-skill.js 그대로(cost=28은 기력이 없어
	## 안 씀). r=4.12는 위 헤더의 nova/curse 환산(140÷34) 참고. prereq
	## a_venom(같은 br row1). 궁장의 첫 curse. 궁장을 br3 3/3으로.
	{ "key": "a_cripple", "cls": "archer", "br": 3, "row": 2, "name": "파훼시(破毀矢)",
		"shape": "curse", "cd": 10.0, "r": 4.12, "sec": 6.0,
		"eff": "", "v": 36.0, "grow": 9.0, "desc": "급소를 노려 적을 굼뜨고 약하게 만든다." },
	## 무장(武將) br=1 row 2 — data-skill.js 그대로(cost=34는 기력이 없어
	## 안 씀). eff는 m_rally 등과 같은 이유로 비워 두고 buff_eff에 담는다.
	## prereq w_leap(같은 br row1). 무장의 첫 buff. 무장을 br1 3/3으로.
	{ "key": "w_rage", "cls": "warrior", "br": 1, "row": 2, "name": "광분(狂奮)",
		"shape": "buff", "cd": 18.0, "sec": 6.0, "buff_eff": "atkSpdPct",
		"eff": "", "v": 40.0, "grow": 10.0, "desc": "한동안 손이 훨씬 빨라진다." },
	## 책사(策士) br=1 row 2 — data-skill.js 그대로(cost=32는 기력이 없어
	## 안 씀). el:'lit'. prereq s_frost(같은 br row1). 책사의 네 번째 bolt.
	## 책사를 br1 3/3으로.
	{ "key": "s_bolt", "cls": "scholar", "br": 1, "row": 2, "name": "뇌격(雷擊)",
		"shape": "bolt", "cd": 7.0, "el": "lit",
		"eff": "", "v": 2.6, "grow": 0.7, "desc": "벼락을 곧게 내리꽂는다. 편차가 크다." },
	## 도독(都督) br=1 row 2 — data-skill.js 그대로(cost=38은 기력이 없어
	## 안 씀). prereq m_ring(같은 br row1). 도독의 첫 heal. 도독을 br1
	## 3/3으로.
	{ "key": "m_heal", "cls": "marshal", "br": 1, "row": 2, "name": "치유(治癒)",
		"shape": "heal", "cd": 22.0,
		"eff": "", "v": 18.0, "grow": 6.0, "desc": "그 자리에서 체력을 되찾는다." },
	## 방사(方士) br=0 row 2 — data-skill.js 그대로(cost=44는 기력이 없어
	## 안 씀). str=4.0은 skill_summon.gd가 이미 일반화해 둔 필드. big:true는
	## 분신 크기 표현이 없어 값만 보존하고 안 쓴다. prereq y_horde(같은 br
	## row1). 방사의 세 번째 summon(v=1·grow=0, 랭크 무관 늘 1개). 방사를
	## br0 3/3으로.
	{ "key": "y_golem", "cls": "mystic", "br": 0, "row": 2, "name": "토우(土偶)",
		"shape": "summon", "cd": 24.0, "sec": 20.0, "str": 4.0,
		"eff": "", "v": 1.0, "grow": 0.0, "desc": "흙으로 빚은 큰 것 하나. 오래 버틴다." },
	## 궁장(弓將) br=4 row 1 — data-skill.js 그대로(cost=28은 기력이 없어
	## 안 씀). prereq a_flourish(같은 br row0). 궁장의 첫 buff.
	{ "key": "a_speedy", "cls": "archer", "br": 4, "row": 1, "name": "속사태세(速射態勢)",
		"shape": "buff", "cd": 14.0, "sec": 6.0, "buff_eff": "atkSpdPct",
		"eff": "", "v": 32.0, "grow": 8.0, "desc": "한동안 손이 훨씬 빨라진다." },
	## 무장(武將) br=3 row 1 — data-skill.js 그대로(cost=22는 기력이 없어
	## 안 씀). el:'fire', far 없음(w_dash와 같은 0.2초). prereq w_chain
	## (같은 br row0). 무장의 세 번째 dash.
	{ "key": "w_blaze_dash", "cls": "warrior", "br": 3, "row": 1, "name": "화염돌진(火焰突進)",
		"shape": "dash", "cd": 8.0, "el": "fire",
		"eff": "", "v": 1.4, "grow": 0.35, "desc": "불을 두르고 파고든다." },
	## 책사(策士) br=3 row 1 — data-skill.js 그대로(cost=20은 기력이 없어
	## 안 씀, kb=24는 넉백 없음). r=1.8은 swing 원작 값 그대로 미터로.
	## prereq s_chainfire(같은 br row0). 책사의 첫 swing.
	{ "key": "s_fan", "cls": "scholar", "br": 3, "row": 1, "name": "선풍(扇風)",
		"shape": "swing", "cd": 5.0, "r": 1.8, "el": "cold",
		"eff": "", "v": 1.6, "grow": 0.35, "desc": "부채를 크게 휘둘러 둘레를 벤다." },
	## 도독(都督) br=3 row 1 — data-skill.js 그대로(cost=26은 기력이 없어
	## 안 씀). r=4.12는 위 헤더의 nova/curse 환산(140÷34) 참고. prereq
	## m_chain(같은 br row0). 도독의 첫 curse.
	{ "key": "m_press", "cls": "marshal", "br": 3, "row": 1, "name": "위압(威壓)",
		"shape": "curse", "cd": 10.0, "r": 4.12, "sec": 6.0,
		"eff": "", "v": 32.0, "grow": 8.0, "desc": "위세로 적을 굼뜨고 약하게 만든다." },
	## 방사(方士) br=1 row 2 — data-skill.js 그대로(cost=40은 기력이 없어
	## 안 씀). r=4.71은 위 헤더의 nova/curse 환산(160÷34) 참고. prereq
	## y_wither(같은 br row1). 방사의 두 번째 curse. 방사를 br1 3/3으로.
	{ "key": "y_doom", "cls": "mystic", "br": 1, "row": 2, "name": "멸(滅)",
		"shape": "curse", "cd": 18.0, "r": 4.71, "sec": 7.0,
		"eff": "", "v": 55.0, "grow": 10.0, "desc": "둘레의 적이 크게 약해진다." },
	## 궁장(弓將) br=5 row 1 — data-skill.js 그대로(cost=26은 기력이 없어
	## 안 씀). prereq a_dashshot(같은 br row0). 궁장의 첫 heal.
	{ "key": "a_firstaid", "cls": "archer", "br": 5, "row": 1, "name": "응급처치(應急處置)",
		"shape": "heal", "cd": 14.0,
		"eff": "", "v": 14.0, "grow": 5.0, "desc": "상처를 싸매 체력을 되찾는다." },
	## 무장(武將) br=4 row 1 — data-skill.js 그대로(cost=30은 기력이 없어
	## 안 씀). prereq w_throw(같은 br row0). 무장의 첫 heal.
	{ "key": "w_regen", "cls": "warrior", "br": 4, "row": 1, "name": "회생(回生)",
		"shape": "heal", "cd": 16.0,
		"eff": "", "v": 16.0, "grow": 6.0, "desc": "상처를 다잡아 체력을 되찾는다." },
	## 책사(策士) br=4 row 1 — data-skill.js 그대로(cost=24는 기력이 없어
	## 안 씀). r=3.82는 위 헤더의 nova/curse 환산(130÷34) 참고. prereq
	## s_blink(같은 br row0). 책사의 첫 curse.
	{ "key": "s_hex", "cls": "scholar", "br": 4, "row": 1, "name": "저주(咀呪)",
		"shape": "curse", "cd": 9.0, "r": 3.82, "sec": 5.0,
		"eff": "", "v": 30.0, "grow": 8.0, "desc": "적을 굼뜨고 약하게 만든다." },
	## 도독(都督) br=4 row 1 — data-skill.js 그대로(cost=36은 기력이 없어
	## 안 씀). str 필드 없음 → 기본 배율 1.0. prereq m_javelin(같은 br
	## row0). 도독의 첫 summon.
	{ "key": "m_reserve", "cls": "marshal", "br": 4, "row": 1, "name": "원군소환(援軍召喚)",
		"shape": "summon", "cd": 16.0, "sec": 14.0,
		"eff": "", "v": 1.0, "grow": 1.0, "desc": "원군을 불러 대신 싸우게 한다." },
	## 방사(方士) br=3 row 1 — data-skill.js 그대로(cost=22는 기력이 없어
	## 안 씀, kb=20은 넉백 없음). r=1.8은 swing 원작 값 그대로 미터로.
	## el:'chi'. prereq y_chain(같은 br row0). 방사의 첫 swing.
	{ "key": "y_ghoststrike", "cls": "mystic", "br": 3, "row": 1, "name": "음령타(陰靈打)",
		"shape": "swing", "cd": 6.0, "r": 1.8, "el": "chi",
		"eff": "", "v": 1.7, "grow": 0.35, "desc": "음기를 둘러 손이 닿는 대로 친다." },
	## 궁장(弓將) br=4 row 2 — data-skill.js 그대로(cost=36은 기력이 없어
	## 안 씀). str 필드 없음 → skill_summon.gd 기본 배율 1.0. prereq
	## a_speedy(같은 br row1). 궁장의 첫 summon. 궁장을 br4 3/3으로.
	{ "key": "a_hawk", "cls": "archer", "br": 4, "row": 2, "name": "응사소환(鷹使召喚)",
		"shape": "summon", "cd": 16.0, "sec": 14.0,
		"eff": "", "v": 1.0, "grow": 1.0, "desc": "매를 불러 대신 싸우게 한다." },
	## 무장(武將) br=3 row 2 — data-skill.js 그대로(cost=40은 기력이 없어
	## 안 씀, kb=150은 넉백 없음). r=4.41은 w_quake와 같은 환산(원작 r도
	## 150으로 같다 — 위 헤더 nova 환산 참고). prereq w_blaze_dash(같은 br
	## row1). 무장의 두 번째 nova. 무장을 br3 3/3으로.
	{ "key": "w_palm", "cls": "warrior", "br": 3, "row": 2, "name": "벽력장(霹靂掌)",
		"shape": "nova", "cd": 13.0, "r": 4.41, "el": "chi",
		"eff": "", "v": 3.2, "grow": 0.65, "desc": "기를 뻗어 둘레를 크게 친다." },
	## 책사(策士) br=3 row 2 — data-skill.js 그대로(cost=34는 기력이 없어
	## 안 씀). str 필드 없음 → skill_summon.gd 기본 배율 1.0. prereq
	## s_fan(같은 br row1). 책사의 첫 summon. 책사를 br3 3/3으로.
	{ "key": "s_spirit", "cls": "scholar", "br": 3, "row": 2, "name": "빙정소환(氷精召喚)",
		"shape": "summon", "cd": 15.0, "sec": 13.0,
		"eff": "", "v": 1.0, "grow": 1.0, "desc": "얼음 정령을 불러 대신 싸우게 한다." },
	## 도독(都督) br=3 row 2 — data-skill.js 그대로(cost=20은 기력이 없어
	## 안 씀). far 필드 없음 → 기본 지속시간 0.2초(w_dash와 같음). prereq
	## m_press(같은 br row1). 도독의 첫 dash. 도독을 br3 3/3으로.
	{ "key": "m_charge", "cls": "marshal", "br": 3, "row": 2, "name": "기신보(氣身步)",
		"shape": "dash", "cd": 7.0, "el": "chi",
		"eff": "", "v": 1.5, "grow": 0.35, "desc": "기를 두르고 파고든다." },
	## 방사(方士) br=3 row 2 — data-skill.js 그대로(cost=32는 기력이 없어
	## 안 씀). eff는 m_rally 등과 같은 이유로 비워 두고 buff_eff에 담는다.
	## prereq y_ghoststrike(같은 br row1). 방사의 첫 buff. 방사를 br3
	## 3/3으로.
	{ "key": "y_possess", "cls": "mystic", "br": 3, "row": 2, "name": "귀합(鬼合)",
		"shape": "buff", "cd": 16.0, "sec": 7.0, "buff_eff": "atkPct",
		"eff": "", "v": 35.0, "grow": 9.0, "desc": "한동안 음병의 기운이 몸에 실려 공격이 세진다." },
	## 궁장(弓將) br=5 row 2 — data-skill.js 그대로(cost=30은 기력이 없어
	## 안 씀). r=3.82는 y_thunderdoom과 같은 환산(원작 r도 130으로 같다 —
	## 위 헤더 nova 환산 참고). prereq a_firstaid(같은 br row1). 궁장의
	## 첫 nova. 궁장을 br5 3/3으로.
	{ "key": "a_gale", "cls": "archer", "br": 5, "row": 2, "name": "기환시(氣環矢)",
		"shape": "nova", "cd": 9.0, "r": 3.82, "el": "chi",
		"eff": "", "v": 2.1, "grow": 0.5, "desc": "기를 실은 화살비. 시우(矢雨)와 달리 기 결이다." },
	## 무장(武將) br=4 row 2 — data-skill.js 그대로(cost=34는 기력이 없어
	## 안 씀). str 필드 없음 → skill_summon.gd 기본 배율 1.0. prereq
	## w_regen(같은 br row1). 무장의 첫 summon. 무장을 br4 3/3으로.
	{ "key": "w_hound", "cls": "warrior", "br": 4, "row": 2, "name": "군견소환(軍犬召喚)",
		"shape": "summon", "cd": 15.0, "sec": 13.0,
		"eff": "", "v": 1.0, "grow": 1.0, "desc": "군견을 풀어 대신 싸우게 한다." },
	## 책사(策士) br=4 row 2 — data-skill.js 그대로(cost=32는 기력이 없어
	## 안 씀). eff는 m_rally 등과 같은 이유로 비워 두고 buff_eff에 담는다.
	## prereq s_hex(같은 br row1). 책사의 첫 buff. 책사를 br4 3/3으로.
	{ "key": "s_insight", "cls": "scholar", "br": 4, "row": 2, "name": "심득(心得)",
		"shape": "buff", "cd": 15.0, "sec": 7.0, "buff_eff": "skillPct",
		"eff": "", "v": 38.0, "grow": 9.0, "desc": "한동안 무예의 위력이 크게 오른다." },
	## 도독(都督) br=4 row 2 — data-skill.js 그대로(cost=30은 기력이 없어
	## 안 씀). prereq m_reserve(같은 br row1). 도독의 두 번째 buff
	## (m_rally에 이어). 도독을 br4 3/3으로.
	{ "key": "m_precision", "cls": "marshal", "br": 4, "row": 2, "name": "필중(必中)",
		"shape": "buff", "cd": 15.0, "sec": 6.0, "buff_eff": "critPct",
		"eff": "", "v": 12.0, "grow": 4.0, "desc": "한동안 급소를 정확히 노린다." },
	## 방사(方士) br=4 row 1 — data-skill.js 그대로(cost=20은 기력이 없어
	## 안 씀). far 필드 없음 → 기본 지속시간 0.2초(w_dash·m_charge와
	## 같음). prereq y_soulbolt(같은 br row0). 방사의 첫 dash.
	{ "key": "y_specter", "cls": "mystic", "br": 4, "row": 1, "name": "귀보(鬼步)",
		"shape": "dash", "cd": 7.0, "el": "pois",
		"eff": "", "v": 1.3, "grow": 0.3, "desc": "혼백처럼 스며들어 파고든다." },
	## 방사(方士) br=5 row 1 — data-skill.js 그대로(cost=24는 기력이 없어
	## 안 씀, kb=22는 넉백 없음 — w_palm과 같은 판단). prereq
	## y_thunderdoom(같은 br row0). 방사의 두 번째 swing(y_ghoststrike에
	## 이어).
	{ "key": "y_hellstrike", "cls": "mystic", "br": 5, "row": 1, "name": "화령타(火靈打)",
		"shape": "swing", "cd": 6.0, "r": 1.7, "el": "fire",
		"eff": "", "v": 1.8, "grow": 0.4, "desc": "귀화(鬼火)를 둘러 손이 닿는 대로 친다." },
	## 무장(武將) br=5 row 1 — data-skill.js 그대로(cost=24는 기력이 없어
	## 안 씀, kb=30은 넉백 없음). prereq w_intimidate(같은 br row0). 무장이
	## swing을 세 갈래에 갖는 첫 사례(br0 w_whirl·w_cleave, br5
	## w_frostcleave).
	{ "key": "w_frostcleave", "cls": "warrior", "br": 5, "row": 1, "name": "빙인참(氷刃斬)",
		"shape": "swing", "cd": 6.0, "r": 1.7, "el": "cold",
		"eff": "", "v": 1.8, "grow": 0.4, "desc": "날을 얼려 벤다. 맞은 적이 굼떠진다." },
	## 책사(策士) br=5 row 1 — data-skill.js 그대로(cost=32는 기력이 없어
	## 안 씀). r=3.82는 y_thunderdoom·a_gale과 같은 환산(원작 r도 130으로
	## 같다). prereq s_restore(같은 br row0). 책사의 네 번째 nova
	## (s_blaze·s_meteor·s_frost에 이어).
	{ "key": "s_plague", "cls": "scholar", "br": 5, "row": 1, "name": "역병(疫病)",
		"shape": "nova", "cd": 10.0, "r": 3.82, "el": "pois",
		"eff": "", "v": 2.1, "grow": 0.5, "desc": "둘레에 역병을 퍼뜨린다." },
	## 도독(都督) br=5 row 1 — data-skill.js 그대로(cost=32는 기력이 없어
	## 안 씀). r=4.12는 m_ring과 원작 r이 똑같이 140이라 같은 환산값이
	## 그대로 나온다. prereq m_flamesaber(같은 br row0). 도독의 두 번째
	## nova(m_ring에 이어).
	{ "key": "m_venomfield", "cls": "marshal", "br": 5, "row": 1, "name": "독진(毒陣)",
		"shape": "nova", "cd": 10.0, "r": 4.12, "el": "pois",
		"eff": "", "v": 2.2, "grow": 0.5, "desc": "둘레에 독 기운을 퍼뜨린다." },
	## 방사(方士) br=4 row 2 — data-skill.js 그대로(cost=34는 기력이 없어
	## 안 씀). heal은 max_hp×value_at/100(skill_heal_warrior.gd와 같은
	## 경계). prereq y_specter(같은 br row1). 방사의 첫 heal. 방사를 br4
	## 3/3으로.
	{ "key": "y_soulmend", "cls": "mystic", "br": 4, "row": 2, "name": "혼백치유(魂魄治癒)",
		"shape": "heal", "cd": 18.0,
		"eff": "", "v": 20.0, "grow": 7.0, "desc": "떠도는 기운을 모아 상처를 아문다." },
	## 방사(方士) br=5 row 2 — data-skill.js 그대로(cost=24는 기력이 없어
	## 안 씀). r 필드 없음 → skill_chain_mystic.gd DEFAULT_RANGE(7.65)
	## 그대로(y_chain과 같은 경계). prereq y_hellstrike(같은 br row1).
	## 방사의 두 번째 chain(y_chain에 이어). 방사를 br5 3/3으로.
	{ "key": "y_frostchain", "cls": "mystic", "br": 5, "row": 2, "name": "빙쇄(氷鎖)",
		"shape": "chain", "cd": 9.0, "el": "cold",
		"eff": "", "v": 1.8, "grow": 0.4, "desc": "언 기운이 적 사이를 옮겨 붙는다." },
	## 무장(武將) br=5 row 2 — data-skill.js 그대로(cost=22는 기력이 없어
	## 안 씀). prereq w_frostcleave(같은 br row1). 무장의 두 번째 bolt
	## (w_throw에 이어). 무장 br5를 3/3으로.
	{ "key": "w_thunderlance", "cls": "warrior", "br": 5, "row": 2, "name": "벽력창(霹靂槍)",
		"shape": "bolt", "cd": 6.0, "el": "lit",
		"eff": "", "v": 1.8, "grow": 0.45, "desc": "벼락을 실어 던진다." },
	## 책사(策士) br=5 row 2 — data-skill.js 그대로(cost=18은 기력이 없어
	## 안 씀). prereq s_plague(같은 br row1). 책사의 다섯 번째 bolt
	## (s_wave·s_fire·s_ice·s_bolt에 이어). 책사 br5를 3/3으로.
	{ "key": "s_venombolt", "cls": "scholar", "br": 5, "row": 2, "name": "독무탄(毒霧彈)",
		"shape": "bolt", "cd": 4.0, "el": "pois",
		"eff": "", "v": 1.5, "grow": 0.4, "desc": "독무를 뭉쳐 던진다." },
	## 도독(都督) br=5 row 2 — data-skill.js 그대로(cost=20은 기력이 없어
	## 안 씀). far 필드 없음 → 기본 지속시간 0.2초(w_dash·m_charge와
	## 같음). prereq m_venomfield(같은 br row1). 도독의 두 번째 dash
	## (m_charge에 이어). 도독 br5를 3/3으로.
	{ "key": "m_frostcharge", "cls": "marshal", "br": 5, "row": 2, "name": "빙보(氷步)",
		"shape": "dash", "cd": 7.0, "el": "cold",
		"eff": "", "v": 1.4, "grow": 0.35, "desc": "얼음을 두르고 파고든다." },
	## 궁장(弓將) br=0 row 1 — data-skill.js 그대로(cost=24는 기력이 없어
	## 안 씀). shots·spread는 이 슬라이스에선 skill_bolt_archer6.gd가
	## "최근접 적 최대 shots명 동시 명중"으로 근사할 때만 shots를 읽고,
	## spread(부채꼴 산개)는 조준 방향이 없어 안 쓴다(위 헤더 참고).
	## prereq a_pierce(같은 br row0). 궁장의 여섯 번째 bolt.
	{ "key": "a_multi", "cls": "archer", "br": 0, "row": 1, "name": "연사(連射)",
		"shape": "bolt", "cd": 6.0, "shots": 3, "spread": 0.34,
		"eff": "", "v": 1.3, "grow": 0.3, "desc": "한 번에 셋을 쏜다." },
	## 궁장(弓將) br=0 row 2 — data-skill.js 그대로(cost=34는 기력이 없어
	## 안 씀). r=3.82는 y_thunderdoom·a_gale과 같은 환산(원작 r도 130으로
	## 같다). prereq a_multi(같은 br row1). 궁장의 두 번째 nova(a_gale에
	## 이어). 궁장 br0를 3/3으로 — 다섯 직업 전부 여섯 갈래 3/3 완주.
	{ "key": "a_rain", "cls": "archer", "br": 0, "row": 2, "name": "시우(矢雨)",
		"shape": "nova", "cd": 10.0, "r": 3.82,
		"eff": "", "v": 2.4, "grow": 0.5, "desc": "화살비가 둘레에 쏟아진다." },
]


static func skill_by_key(k: String) -> Dictionary:
	for s: Dictionary in SKILLS:
		if s.key == k:
			return s
	return {}


static func skills_of(cls_key: String) -> Array[Dictionary]:
	var out: Array[Dictionary] = []
	for s: Dictionary in SKILLS:
		if s.cls == cls_key:
			out.append(s)
	return out


## data-skill.js valueAt() 그대로 — 0단이면 0, 그 뒤론 v + grow*(rank-1).
static func value_at(sk: Dictionary, rank: int) -> float:
	if rank <= 0:
		return 0.0
	return float(sk.v) + float(sk.grow) * float(rank - 1)


## data-skill.js prereqOf() 그대로 — row 0은 조건 없음(null). row>0은
## 같은 갈래(cls+br)의 바로 앞 단(row-1)에 1점이 있어야 한다.
static func prereq_of(sk: Dictionary) -> Dictionary:
	if int(sk.row) == 0:
		return {}
	for s: Dictionary in skills_of(str(sk.cls)):
		if int(s.br) == int(sk.br) and int(s.row) == int(sk.row) - 1:
			return s
	return {}
