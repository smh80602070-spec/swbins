extends Node

## VERTICAL_SLICE_STORY.md 1절 완료 조건의 마지막 두 단계 — "저장한다 →
## 다시 켜서 이어진다"(GO save_state.gd·DUNGEON dungeon_save_state.gd·
## FOREST forest_save_state.gd와 같은 정신: 로컬 파일 하나, 버전 필드,
## 게임마다 완전히 분리된 세이브 파일 — DUNGEON이 세운 선례 그대로).
##
## project.godot [autoload]에 StorySaveState로 등록.
##
## 저장하는 것 — 위치 + 레벨/경험치 + 사명("첫 사냥") 진행도 정도만
## (GO/DUNGEON/FOREST와 같은 최소 범위, 1절 "제외" 목록에 없는 것은
## 애초에 저장할 상태 자체가 없다).

const StoryCombat := preload("res://games/saga_story/data/story_combat.gd")
const StoryLabyrinth := preload("res://games/saga_story/data/story_labyrinth.gd")
const Toast := preload("res://saga_core/ui/toast.gd")

const SAVE_PATH := "user://save_story.json"
const SafeFile := preload("res://saga_core/data/safe_file.gd")  # 임시 파일 → .bak → 바꿔치기(쓰는 도중 꺼져도 직전본이 남는다)
const SAVE_VERSION := 17  # 1→2: mats, 2→3: has_weapon, 3→4: equipped, 4→5: gold, 5→6: job(1차 전직), 6→7: skills(SP 투자), 7→8: scroll_bonus/scroll_left(주문서), 8→9: bosses/feat/achievements(업적), 9→10: quests_done(사명), 10→11: stage_kills(사냥터별 킬 수 사명), 11→12: visited_stages(q_explore1), 12→13: talks(q_talk1), 13→14: repeat_progress/daily_done_day(반복/일일 사명), 14→15: weekly_champion_week(관문 대장), 15→16: memory_fragments/memory_tier(비경), 16→17: mentor_bond(사제 유대, 51장 STORY "관계" 축 첫 걸음)

var level := 1
var exp := 0
var kills := 0  # data-quest.js q_first(kill 10)의 진행 카운트
var stage_kills: Dictionary = {}  # stage_key(String) -> int, data-quest.js q_field/q_forest/q_cave goal.stage 필터의 이 포트 버전
var visited_stages: Dictionary = {}  # stage_key(String) -> true, data-quest.js q_explore1(goal.type:'visit') 진행 집합 — quest.js onStage()의 이 포트 버전
var talks := 0  # data-quest.js q_talk1(goal.type:'talk') 진행 카운트 — quest.js onTalk() 그대로, 같은 NPC에게 반복해도 매번 는다(집합이 아니다)
var bosses := 0  # side.js s.bosses 그대로 — a_boss5 업적의 진행 카운트
var feat := 0  # core.js player.feat(공적) — 이 슬라이스엔 칭호가 없어 그냥 누적값만
var achievements: Dictionary = {}  # key(String) -> true, achieve.js st() 그대로(한 번 달성하면 안 없어짐)
var quests_done: Dictionary = {}  # key(String) -> true, quest.js 완료 기록의 이 포트 버전(전부 repeat:false 8개뿐이라 achievements와 같은 모양)
var repeat_progress: Dictionary = {}  # REPEAT_QUESTS key(String) -> float, 마지막 완수 시점의 _quest_value() 스냅샷(그 이후 늘어난 만큼만 다음 판 진행도로 본다)
var daily_done_day: Dictionary = {}  # REPEAT_QUESTS(daily:true) key(String) -> int(day index), 오늘 이미 완수했으면 다음 날까지 다시 안 된다
var _checking_quests := false  # check_quests()가 보상으로 add_gold()를 부르고, add_gold()가 다시 check_quests()를 부르는 되먹임을 막는 잠금
var mats: Dictionary = {}  # side.js s.mats[kind] 그대로 — 필드 채집(들꽃 등) 누적
var equipped: Dictionary = {}  # slot(String) -> gear key(String), StoryCombat.item_def() 참고(밑감·고유 둘 다)
var gold := 0  # side.js core.save.player.gold 그대로 — 상인(story_merchant.gd)이 쓴다
var job := "none"  # data-job.js JOBS key — StoryCombat.JOBS_TIER1 참고, 한 번 정하면 안 바뀐다(전직 트리 첫 걸음)

## **2026-09-13 추가(같은 날 더 더, 주문서) — gear.js `it.atk/it.def/it.hp`
## (붙은 값)의 이 포트 버전. 물건 인스턴스(uid)가 없어 **슬롯 하나가
## 곧 그 물건**이다 — `equip_gear()`가 슬롯에 새 키를 물릴 때마다
## 0으로 리셋된다(원작에서 낡은 물건을 팔거나 바꿔 끼면 그 물건의 붙은
## 값도 같이 사라지는 것과 결과가 같다).
var scroll_bonus: Dictionary = {}  # slot(String) -> {atk,def,hp}

## gear.js `it.left`의 이 포트 버전 — 슬롯에 새 키가 물릴 때 그 물건의
## `up`(GEAR_ITEMS/UNIQUE_ITEMS)으로 초기화되고, 주문서를 쓸 때마다
## 성패와 무관하게 1씩 줄어든다. 0이면 그 슬롯엔 더 못 붓는다.
var scroll_left: Dictionary = {}  # slot(String) -> int

## **2026-09-13 추가(같은 날 더) — SP(무예 점수) 투자.** key(StoryCombat.
## SKILL_JOB) → 투자한 레벨(1~10). job.js `core.save.skills`와 같은 자리 —
## SP 자체는 담지 않는다(sp_total()-sp_spent()의 파생값, job.js 머리말과
## 같은 이유: 레벨이 오르면 저절로 는다).
var skills: Dictionary = {}

## **2026-09-13 추가 — 문(portal, 15절).** 씬을 넘나들 때 세이브 위치
## 대신 문이 정해 준 자리에 서게 하는 임시 값 — story_portal.gd가 넘어가기
## 직전에 세팅하고, 도착한 씬의 _ready()가 한 번 읽고 바로 끈다(세이브에는
## 안 담는다, 이 값은 "다음 씬 진입 한 번"만을 위한 신호다).
var pending_spawn_x := 0.0
var has_pending_spawn := false

## PLAN.md 101-4 표준 A·B(목표판·세션 카드) — GO PartyState.session_exp_gained()·
## FOREST ForestSaveState.session_gold_gained()와 같은 계약(세이브 필드가
## 아니다, 세션 시작 시점 스냅샷과의 차이만 잰다). kills·gold를 쓰는 이유는
## exp가 레벨업마다 0으로 되감겨(add_exp() 위) 델타가 안 맞기 때문.
var _session_start_kills := 0
var _session_start_gold := 0


func begin_session() -> void:
	_session_start_kills = kills
	_session_start_gold = gold


func session_kills_gained() -> int:
	return kills - _session_start_kills


func session_gold_gained() -> int:
	return gold - _session_start_gold


func set_pending_spawn(x_m: float) -> void:
	pending_spawn_x = x_m
	has_pending_spawn = true


## 호출 즉시 플래그를 끈다 — 씬이 한 번 읽고 나면 다음부터는 다시
## try_load()/기본 위치로 돌아가야 한다(문으로 안 들어온 재실행까지
## 이 값을 계속 쓰면 안 된다).
func consume_pending_spawn() -> float:
	has_pending_spawn = false
	return pending_spawn_x


## stage_key를 넘기면(사냥터 안 잡졸·보스) 그 사냥터의 킬 수도 같이 센다
## (q_field/q_forest/q_cave). 빈 문자열이면 원래대로 전체 킬만 센다.
func add_kill(stage_key: String = "") -> void:
	kills += 1
	if not stage_key.is_empty():
		stage_kills[stage_key] = int(stage_kills.get(stage_key, 0)) + 1
	check_achievements()
	check_quests()


func add_boss_kill() -> void:
	bosses += 1
	check_achievements()
	check_quests()


## PLAN 101-2 STORY ④후보(웹판 §5-4 "관문 대장") — stage_key(사냥터 넷)별로
## 그 주(week index)에 강화판을 이미 잡았는지. `daily_done_day`(위 SAVE_
## VERSION 13→14 머리말)의 day index와 같은 정신 — 달력 월요일 기준은
## 아니고 7일 단위 정수 몫이다, 헤드리스 진단은 이 값을 직접 넣고 뺀다.
var weekly_champion_week: Dictionary = {}


## PLAN 101-2 STORY ⑤(비경, 2026-09-18) — story_labyrinth.gd 헤더의 "기억
## 조각"(메타 재화). 회차(run) 자체는 세이브에 안 남지만(StoryLabyrinthState,
## 회차 한정) 조각과 그걸로 새긴 영구 단수는 여기 남는다 — StorySaveState가
## "저장이 이어지는 한 유지"되는 값들의 자리라는 기존 원칙 그대로.
var memory_fragments := 0
var memory_tier := 0  # 0~StoryLabyrinth.MEMORY_TIER_MAX, 단마다 최대 HP +2%


func add_memory_fragments(n: int) -> void:
	if n <= 0:
		return
	memory_fragments += n
	Toast.show(self, "💠 기억 조각 +%d(보유 %d)" % [n, memory_fragments], 2.5)


func can_upgrade_memory() -> bool:
	if memory_tier >= StoryLabyrinth.MEMORY_TIER_MAX:
		return false
	return memory_fragments >= StoryLabyrinth.memory_upgrade_cost(memory_tier)


func upgrade_memory() -> bool:
	if not can_upgrade_memory():
		return false
	memory_fragments -= StoryLabyrinth.memory_upgrade_cost(memory_tier)
	memory_tier += 1
	return true


func memory_hp_mult() -> float:
	return 1.0 + StoryLabyrinth.MEMORY_HP_PCT_PER_TIER * memory_tier / 100.0


## §5-3 클리어 보상 "주문서" — 사명 보상(_grant_quest_scroll)과 같은 자리지만
## 대상(무기/방어구)을 정해 주지 않는다, 낄 수 있는 슬롯 중 아무 데나 랜덤
## 하나를 굴린다(story_labyrinth.gd 보스 처치 보상이 부른다).
func grant_labyrinth_scroll() -> void:
	var keys := StoryCombat.SCROLLS.keys()
	keys.shuffle()
	for k: String in keys:
		var sc: Dictionary = StoryCombat.SCROLLS[k]
		var target_slot: String = "weapon" if String(sc.get("for", "")) == "weapon" else _pick_scrollable_armor_slot()
		if target_slot.is_empty() or not can_scroll(target_slot):
			continue
		apply_scroll(target_slot, sc)
		return


func current_week() -> int:
	return int(Time.get_unix_time_from_system() / (86400.0 * 7.0))


func champion_available(stage_key: String) -> bool:
	return int(weekly_champion_week.get(stage_key, -1)) != current_week()


func claim_champion(stage_key: String) -> void:
	weekly_champion_week[stage_key] = current_week()


## quest.js onStage() 그대로 — 처음 밟는 사냥터만 집합에 넣는다(같은 곳을
## 몇 번 다시 밟아도 안 늘어난다). story_terrain_builder.gd가 그 씬의
## 지도 데이터에 stage_key()가 있을 때만(사냥터 넷, 마을은 없음) 부른다.
func visit_stage(stage_key: String) -> void:
	if stage_key.is_empty() or visited_stages.get(stage_key, false):
		return
	visited_stages[stage_key] = true
	check_quests()


## quest.js onTalk() 그대로 — story_talk_npc.gd가 story_interact로 말을
## 걸 때마다 부른다(방문과 달리 같은 NPC라도 매번 는다).
func add_talk() -> void:
	talks += 1
	check_quests()


func add_mat(kind: String, amount: int = 1) -> void:
	mats[kind] = int(mats.get(kind, 0)) + amount
	check_quests()


## data-quest.js q_gather1("약초 캐기", goal.type:'gather', n:15)의 진행도.
## 이 슬라이스는 채집물이 herb 하나뿐이지만, mats 전체 합으로 뽑아 둬야
## 다른 채집물이 늘어도 이 사명이 그대로 맞는다(원작도 kind를 안 가린다).
func gathered_total() -> int:
	var total := 0
	for v: Variant in mats.values():
		total += int(v)
	return total


func gather_quest_done() -> bool:
	return gathered_total() >= 15


func add_gold(n: int) -> void:
	if n == 0:
		return
	gold = maxi(0, gold + n)
	check_achievements()
	check_quests()


## 모자라면 아무것도 안 하고 false — DUNGEON DungeonGoldState.spend()와 같은 계약.
func spend_gold(n: int) -> bool:
	if n <= 0 or gold < n:
		return false
	gold -= n
	return true


## 부위는 StoryCombat.item_def(key).slot에서 뽑는다 — 호출 쪽이 슬롯을
## 따로 안 넘겨도 된다(story_enemy.gd가 드롭 풀을 고를 때 이미 이 표를
## 훑으므로 중복 데이터가 안 생긴다).
##
## **2026-09-13 추가(같은 날 더, tier2~4) — 요구 레벨 게이트.** gear.js
## `equip()` 그대로: `level`이 그 물건의 `need`에 못 미치면 거절(레벨은
## 내려가지 않으니, 한 번 낀 물건이 나중에 다시 거절되는 web의 "승급 전
## 세이브" 예외는 이 포트에선 안 생긴다 — bonus 쪽에 그 검사를 안 옮긴 이유).
##
## **2026-09-13 추가(같은 날 더 더, 고유) — GEAR_ITEMS 대신 item_def()로
## 조회한다.** 고유(UNIQUE_ITEMS) key도 이 함수 하나로 낄 수 있어야
## story_enemy.gd/story_gear_pickup.gd가 밑감과 고유를 구분 없이 넘길 수 있다.
## **2026-09-13 추가(같은 날 더 더, 주문서) — 슬롯에 새 물건을 물릴 때마다
## 그 슬롯의 주문서 상태를 초기화한다.** scroll_bonus는 비우고, scroll_left는
## 새 물건의 `up`으로 새로 채운다 — 이전 물건에 붙었던 값·남은 업횟은
## 사라진다(물건 인스턴스가 없는 이 포트에서 "낡은 물건을 버린다"의 결과).
func equip_gear(key: String) -> bool:
	var it: Dictionary = StoryCombat.item_def(key)
	if it.is_empty():
		return false
	if level < int(it.get("need", 1)):
		return false
	var slot := String(it.slot)
	equipped[slot] = key
	scroll_bonus.erase(slot)
	scroll_left[slot] = int(it.get("up", 0))
	check_achievements()
	check_quests()
	return true


## StoryCombat.gear_totals()(밑감·고유 값) + scroll_bonus(주문서로 붙은 값) 합.
func gear_totals() -> Dictionary:
	var totals := StoryCombat.gear_totals(equipped.values())
	for slot: String in scroll_bonus:
		var b: Dictionary = scroll_bonus[slot]
		totals.atk = float(totals.atk) + float(b.get("atk", 0.0))
		totals.def = float(totals.def) + float(b.get("def", 0.0))
		totals.hp = float(totals.hp) + float(b.get("hp", 0.0))
	return totals


## gear.js `it.left <= 0` 그대로 — 그 슬롯이 비었거나 업횟이 다 닳았으면 false.
func can_scroll(slot: String) -> bool:
	return equipped.has(slot) and int(scroll_left.get(slot, 0)) > 0


## gear.js `apply(uid, scrollKey)` 그대로: 업횟은 성패 불문 1 닳고, 성공하면
## (rate 확률) 그 값만큼 scroll_bonus에 쌓인다. 호출 전에 can_scroll(slot)로
## 먼저 확인하는 게 계약 — 여기선 다시 안 본다(story_merchant.gd가 이미
## 확인하고 대상 슬롯을 고른 뒤 부른다).
func apply_scroll(slot: String, scroll: Dictionary) -> bool:
	scroll_left[slot] = maxi(0, int(scroll_left.get(slot, 0)) - 1)
	var hit := randf() < float(scroll.get("rate", 0.0))
	if hit:
		var b: Dictionary = scroll_bonus.get(slot, {"atk": 0.0, "def": 0.0, "hp": 0.0})
		b.atk = float(b.get("atk", 0.0)) + float(scroll.get("atk", 0.0))
		b.def = float(b.get("def", 0.0)) + float(scroll.get("def", 0.0))
		b.hp = float(b.get("hp", 0.0)) + float(scroll.get("hp", 0.0))
		scroll_bonus[slot] = b
	return hit


func quest_done() -> bool:
	return kills >= 10


## **2026-09-13 추가 — 전직 트리 첫 걸음.** core.js gainExp() 그대로:
## 랜덤 없이 결정적으로 exp_need(level)만큼씩 소비하며 오른다(한 번에
## 여러 레벨도 오를 수 있다 — while 루프, 원문과 같다).
func add_exp(amount: int) -> void:
	if amount <= 0:
		return
	exp += amount
	var need := StoryCombat.exp_need(level)
	while exp >= need:
		exp -= need
		level += 1
		need = StoryCombat.exp_need(level)
	check_achievements()


## achieve.js checkAll() 그대로 — 이미 달성한 건 다시 안 재고, 새로 문턱을
## 넘은 것만 한 번 터뜨린다(feat 지급 + 토스트). ACHIEVES에 없는 둘
## (a_dex20·a_quest10)은 story_combat.gd 머리말 참고 — 값 자체가 없어
## 애초에 표에서 뺐다.
func check_achievements() -> void:
	for key: String in StoryCombat.ACHIEVES:
		if achievements.get(key, false):
			continue
		var d: Dictionary = StoryCombat.ACHIEVES[key]
		if _achieve_value(key) >= float(d.need):
			achievements[key] = true
			feat += int(d.feat)
			Toast.show(self, "%s 업적 · %s" % [String(d.emoji), String(d.name)], 3.0)


## achieve.js valueOf() 그대로 — 업적마다 다른 칸을 본다.
func _achieve_value(key: String) -> float:
	match key:
		"a_kill100", "a_kill500":
			return float(kills)
		"a_boss5":
			return float(bosses)
		"a_lv10", "a_lv30":
			return float(level)
		"a_gold5000":
			return float(gold)
		"a_gear7":
			return float(equipped.size())
		"a_quest10":
			return float(quests_done.size())
		_:
			return 0.0


## quest.js turnIn() 판정 그대로 — need(레벨)를 넘고 goal.n을 채운 사명을
## 한 번씩 자동으로 바친다. **재해석** — 원작은 "받기"(take)를 먼저 눌러야
## 진행이 세어지지만, 이 여덟 개는 전부 이미 세이브에 있는 누적값(achieve.js
## valueOf()와 같은 결)을 보는 거라 "받기" 단계 없이 achieve.js checkAll()
## 처럼 문턱을 넘는 순간 바로 완수한다 — 물목 화면·업적과 달리 이 여덟
## 개는 목록 UI가 없다(story_combat.gd QUESTS 머리말 참고).
func check_quests() -> void:
	if _checking_quests:
		return
	_checking_quests = true
	for key: String in StoryCombat.QUESTS:
		if quests_done.get(key, false):
			continue
		var q: Dictionary = StoryCombat.QUESTS[key]
		if level < int(q.need):
			continue
		if _quest_value(q) < float(q.n):
			continue
		quests_done[key] = true
		var exp_reward := int(q.get("exp", 0))
		if exp_reward > 0:
			add_exp(exp_reward)
		var gold_reward := int(q.get("gold", 0))
		if gold_reward > 0:
			add_gold(gold_reward)
		var scroll_key := String(q.get("scroll", ""))
		if not scroll_key.is_empty():
			_grant_quest_scroll(scroll_key)
		Toast.show(self, "📜 사명 완수 · %s" % String(q.name), 3.0)
	_check_repeat_quests()
	_checking_quests = false


## story_combat.gd REPEAT_QUESTS 머리말 참고 — "지난 완수 이후로 그 값이
## n만큼 늘 때마다" 자동으로 다시 완수하는 반복 문턱. check_quests()
## 안에서만 불린다(같은 _checking_quests 잠금 아래 — 보상으로 부르는
## add_exp()/add_gold()가 다시 check_quests()를 불러도 잠금에 막힌다).
func _check_repeat_quests() -> void:
	var today := int(Time.get_unix_time_from_system() / 86400.0)
	for key: String in StoryCombat.REPEAT_QUESTS:
		var q: Dictionary = StoryCombat.REPEAT_QUESTS[key]
		if level < int(q.need):
			continue
		if bool(q.get("daily", false)) and int(daily_done_day.get(key, -1)) == today:
			continue
		var baseline := float(repeat_progress.get(key, 0.0))
		var current := _quest_value(q)
		if current - baseline < float(q.n):
			continue
		repeat_progress[key] = current
		if bool(q.get("daily", false)):
			daily_done_day[key] = today
		var exp_reward := int(q.get("exp", 0))
		if exp_reward > 0:
			add_exp(exp_reward)
		var gold_reward := int(q.get("gold", 0))
		if gold_reward > 0:
			add_gold(gold_reward)
		var scroll_key := String(q.get("scroll", ""))
		if not scroll_key.is_empty():
			_grant_quest_scroll(scroll_key)
		Toast.show(self, "📜 %s 완수(다시 쌓이면 또)" % String(q.name), 3.0)


## quest.js look()의 이 포트 버전 — goal.type마다 다른 누적값을 본다.
## achieve.js valueOf()와 겹치는 칸(kills/bosses/equipped.size())이
## 있지만, 사명 쪽은 goal_type 이름이 원작 그대로라 따로 둔다.
##
## **2026-09-13 추가 — 사냥터별 킬 수.** goal_type이 'kill'이고 `stage`가
## 있으면(q_field 등) 전체 kills 대신 stage_kills[stage]를 본다 —
## data-quest.js onKill()의 `g.stage && g.stage !== info.stage` 필터와
## 같은 결.
func _quest_value(q: Dictionary) -> float:
	var goal_type := String(q.goal_type)
	match goal_type:
		"kill":
			var stage := String(q.get("stage", ""))
			if stage.is_empty():
				return float(kills)
			return float(stage_kills.get(stage, 0))
		"gather":
			return float(gathered_total())
		"gear":
			return float(equipped.size())
		"boss":
			return float(bosses)
		"skill":
			return float(sp_spent())
		"gold":
			return float(gold)
		"visit":
			return float(visited_stages.size())
		"talk":
			return float(talks)
		_:
			return 0.0


## 사명 보상 주문서 — story_merchant.gd `_on_scroll_picked()`와 같은
## "사는 즉시 적용" 재해석(가방이 없어 원작처럼 물건으로 안 준다). 적용할
## 슬롯이 없으면(무기라면 애초에 안 껴서, 방어구라면 낀 것 중 업횟 남은
## 곳이 하나도 없어서) 조용히 건너뛴다 — 대체 보상을 상상하지 않는다.
func _grant_quest_scroll(scroll_key: String) -> void:
	var sc: Dictionary = StoryCombat.SCROLLS.get(scroll_key, {})
	if sc.is_empty():
		return
	var target_slot: String = "weapon" if String(sc.get("for", "")) == "weapon" else _pick_scrollable_armor_slot()
	if target_slot.is_empty() or not can_scroll(target_slot):
		return
	apply_scroll(target_slot, sc)


func _pick_scrollable_armor_slot() -> String:
	var candidates: Array[String] = []
	for slot: String in StoryCombat.ARMOR_SLOTS:
		if can_scroll(slot):
			candidates.append(slot)
	if candidates.is_empty():
		return ""
	return candidates[randi() % candidates.size()]


## **2026-09-23 추가 — PLAN 51장 STORY "관계" 축 첫 걸음(웹판에 참고할
## 설계가 없어 새로 지음).** `StoryCombat.mentor_of(job)`가 (갈래,tier)
## 마다 결정적으로 골라 주는 스승은 지금까지 전직 순간의 대사 한 줄뿐인
## 순수 장식이었다 — 진급마다 스승이 바뀌므로(시드에 tier가 들어간다)
## "평생 가는 한 사람"이 아니라 "매 단계 만나는 스승"으로 두고, 그 스승
## 밑에서 사냥하며 쌓는 정을 잡졸/보스 처치로 채운다. 진급하면(스승이
## 바뀌면) 0으로 되돌아간다 — 새 스승과 새로 쌓기 시작.
## **101-2 STORY ③(직업 정체성)의 "수치 보정 없음" 결정은 그대로 지킨다**
## (조작·데미지엔 안 붙는다) — 대신 정이 무르익으면(마지막 문턱) 사례금
## 한 번만 준다, FOREST 관계 하트의 "10♥ 기념 사례금"과 같은 결.
var mentor_bond := 0
const MENTOR_BOND_THRESHOLDS := [20, 50, 100]
const MENTOR_BOND_MAX_GOLD := 200


func add_mentor_bond(amount: int) -> void:
	if amount <= 0 or job == "none":
		return
	var before := mentor_bond
	mentor_bond += amount
	for t in MENTOR_BOND_THRESHOLDS:
		if before < t and mentor_bond >= t:
			_on_mentor_bond_milestone(t)


func _on_mentor_bond_milestone(threshold: int) -> void:
	var mentor: Dictionary = StoryCombat.mentor_of(job)
	if threshold == MENTOR_BOND_THRESHOLDS[-1]:
		add_gold(MENTOR_BOND_MAX_GOLD)
		Toast.show(self, "🎓 %s와의 사제 정이 무르익었다 — \"%s\"\n(사례금 +%d)" % [
			String(mentor.name), String(mentor.quote), MENTOR_BOND_MAX_GOLD,
		], 3.5)
	else:
		Toast.show(self, "👤 %s와의 사제 정이 깊어진다." % String(mentor.name), 2.5)


func can_change_job() -> bool:
	return job == "none" and level >= StoryCombat.JOB_CHANGE_LEVEL


## data-job.js "되돌릴 수 없다" 그대로 — 이미 정했으면 무시.
func choose_job(key: String) -> bool:
	if not can_change_job() or not StoryCombat.JOBS_TIER1.has(key):
		return false
	job = key
	mentor_bond = 0
	return true


## **2026-09-13 추가 — 2~4차 전직.** job.js canJoin() 그대로: key가 지금
## job의 바로 다음 자리여야 하고(사슬, StoryCombat.job_prereq), 레벨
## 문턱을 넘어야 하고, 지금 job의 무예 중 하나가 그 tier의 레벨 문턱
## (JOB_SKILL_LEVEL_GATE) 이상이어야 한다. 이 슬라이스는 tier2+ 무예가
## 아직 없어(JOB_SKILL_KEYS에 항목 없음) 그 목록이 비고, 따라서 tier3+
## 진급은 자연히 못 연다(거짓으로 막은 게 아니라 채울 무예가 아직 없다).
func can_advance_job(key: String) -> bool:
	if StoryCombat.job_prereq(key) != job:
		return false
	if level < StoryCombat.job_level_need(key):
		return false
	var gate := StoryCombat.job_advance_skill_gate(key)
	for k: String in StoryCombat.JOB_SKILL_KEYS.get(job, []):
		if skill_level(String(k)) >= gate:
			return true
	return false


func advance_job(key: String) -> bool:
	if not can_advance_job(key):
		return false
	job = key
	mentor_bond = 0
	return true


## 사슬 전체(현재 job + 그 위 모든 tier)의 grow(hp/atk/mp) 합 — job이
## 'none'이면 전부 0(빈 사슬).
func job_grow() -> Dictionary:
	return StoryCombat.job_grow_chain(job)


## job.js spTotal()/spSpent()/spLeft() 그대로 — 총점은 (레벨-1)×SP_PER_LEVEL,
## 남은 점수는 총점에서 이미 찍은 레벨의 합을 뺀 파생값(세이브에 안 담는다).
func sp_total() -> int:
	return maxi(0, (level - 1) * StoryCombat.SP_PER_LEVEL)


func sp_spent() -> int:
	var sum := 0
	for v: Variant in skills.values():
		sum += int(v)
	return sum


func sp_left() -> int:
	return maxi(0, sp_total() - sp_spent())


func skill_level(key: String) -> int:
	return int(skills.get(key, 0))


## job.js canRaise() 그대로 — 이 무예가 지금 job의 사슬 안(자기 job이거나
## 그 아래 tier)에 있는지·아직 만렙이 아닌지·남은 점수가 있는지 본다.
## **2026-09-13 추가 — 2~4차 전직**: 전에는 `job` 하나와 정확히 같은지만
## 봤는데(그때는 사슬이 tier1 하나뿐이라 같은 결과), 이제 진급해도 하위
## 무예(예: 장군이 된 뒤에도 무사 무예)에 계속 투자할 수 있어야 하므로
## 사슬 소속 여부로 바꿨다(원작 skillsOf()의 chain-walk과 같은 정신).
## **2026-09-13 추가(같은 날 더 더) — tier2 무예 열둘.** 원문 `need`(한
## 무예를 올리려면 그 앞 무예가 lv5 이상이어야 한다, data-job.js SKILLS
## need 필드)를 이제 실제로 확인한다 — tier1은 need가 없어 이 검사 자체가
## 전에는 없었다(story_combat.gd SKILL_NEED 머리말 참고).
func can_raise_skill(key: String) -> bool:
	var skill_job := String(StoryCombat.SKILL_JOB.get(key, ""))
	if skill_job == "" or not StoryCombat.job_chain(job).has(skill_job):
		return false
	if skill_level(key) >= StoryCombat.SKILL_MAX_LEVEL:
		return false
	if StoryCombat.SKILL_NEED.has(key):
		var need: Dictionary = StoryCombat.SKILL_NEED[key]
		if skill_level(String(need.key)) < int(need.lv):
			return false
	return sp_left() > 0


func raise_skill(key: String) -> bool:
	if not can_raise_skill(key):
		return false
	skills[key] = skill_level(key) + 1
	check_quests()
	return true


func save() -> bool:
	var player := _find_player()
	if player == null:
		return false
	var data := {
		"version": SAVE_VERSION,
		"player_pos": [player.global_position.x, player.global_position.y, player.global_position.z],
		"level": level,
		"exp": exp,
		"kills": kills,
		"stage_kills": stage_kills,
		"visited_stages": visited_stages,
		"talks": talks,
		"bosses": bosses,
		"feat": feat,
		"achievements": achievements,
		"quests_done": quests_done,
		"repeat_progress": repeat_progress,
		"daily_done_day": daily_done_day,
		"weekly_champion_week": weekly_champion_week,
		"memory_fragments": memory_fragments,
		"memory_tier": memory_tier,
		"mats": mats,
		"equipped": equipped,
		"gold": gold,
		"job": job,
		"mentor_bond": mentor_bond,
		"skills": skills,
		"scroll_bonus": scroll_bonus,
		"scroll_left": scroll_left,
	}
	return SafeFile.write_text(SAVE_PATH, JSON.stringify(data))


func try_load() -> bool:
	var parsed: Variant = SafeFile.read_json(SAVE_PATH)
	if parsed == null:
		return false
	var migrated: Variant = _migrate(parsed)
	if migrated == null:
		return false
	var data: Dictionary = migrated

	level = int(data.get("level", 1))
	exp = int(data.get("exp", 0))
	kills = int(data.get("kills", 0))
	var loaded_stage_kills: Variant = data.get("stage_kills", {})
	stage_kills = loaded_stage_kills if typeof(loaded_stage_kills) == TYPE_DICTIONARY else {}
	var loaded_visited_stages: Variant = data.get("visited_stages", {})
	visited_stages = loaded_visited_stages if typeof(loaded_visited_stages) == TYPE_DICTIONARY else {}
	talks = int(data.get("talks", 0))
	bosses = int(data.get("bosses", 0))
	feat = int(data.get("feat", 0))
	var loaded_achievements: Variant = data.get("achievements", {})
	achievements = loaded_achievements if typeof(loaded_achievements) == TYPE_DICTIONARY else {}
	var loaded_quests_done: Variant = data.get("quests_done", {})
	quests_done = loaded_quests_done if typeof(loaded_quests_done) == TYPE_DICTIONARY else {}
	var loaded_repeat_progress: Variant = data.get("repeat_progress", {})
	repeat_progress = loaded_repeat_progress if typeof(loaded_repeat_progress) == TYPE_DICTIONARY else {}
	var loaded_daily_done_day: Variant = data.get("daily_done_day", {})
	daily_done_day = loaded_daily_done_day if typeof(loaded_daily_done_day) == TYPE_DICTIONARY else {}
	var loaded_weekly_champion_week: Variant = data.get("weekly_champion_week", {})
	weekly_champion_week = loaded_weekly_champion_week if typeof(loaded_weekly_champion_week) == TYPE_DICTIONARY else {}
	memory_fragments = int(data.get("memory_fragments", 0))
	memory_tier = clampi(int(data.get("memory_tier", 0)), 0, StoryLabyrinth.MEMORY_TIER_MAX)
	var loaded_mats: Variant = data.get("mats", {})
	mats = loaded_mats if typeof(loaded_mats) == TYPE_DICTIONARY else {}
	var loaded_equipped: Variant = data.get("equipped", {})
	equipped = loaded_equipped if typeof(loaded_equipped) == TYPE_DICTIONARY else {}
	gold = int(data.get("gold", 0))
	job = String(data.get("job", "none"))
	mentor_bond = int(data.get("mentor_bond", 0))
	var loaded_skills: Variant = data.get("skills", {})
	skills = loaded_skills if typeof(loaded_skills) == TYPE_DICTIONARY else {}
	var loaded_scroll_bonus: Variant = data.get("scroll_bonus", {})
	scroll_bonus = loaded_scroll_bonus if typeof(loaded_scroll_bonus) == TYPE_DICTIONARY else {}
	var loaded_scroll_left: Variant = data.get("scroll_left", {})
	scroll_left = loaded_scroll_left if typeof(loaded_scroll_left) == TYPE_DICTIONARY else {}

	var pos: Array = data.get("player_pos", [])
	if pos.size() != 3:
		return false
	var player := _find_player()
	if player != null:
		player.global_position = Vector3(float(pos[0]), float(pos[1]), float(pos[2]))
		## mp와 달리 equipped는 세이브에 있으므로, 로드 직후 hp를 새
		## max_hp(장비 hp 보너스 포함)로 채운다 — 안 그러면 "재입장 시
		## 가득 찬 채 시작"이 이전 세션 장비 보너스 반영 전 기본치로
		## 잠깐 어긋난다(player.gd 머리말 참고).
		if player.has_method("take_damage"):
			player.hp = player.max_hp
	return true


func _find_player() -> Node3D:
	var found := get_tree().get_nodes_in_group("player")
	return found[0] if found.size() > 0 else null


## GO의 save_state.gd::_migrate()와 같은 계약. 지금까지 SAVE_VERSION을
## 올린 1~14단계는 필드 추가뿐이고 try_load()가 전부 .get(key, 기본값)으로
## 읽으므로, 여기 단계들은 실제 변환 없이 버전 숫자만 올려 통과시킨다
## (필드 이름을 바꾸거나 옮기는 변경이 생기면 그 단계에 변환을 추가한다).
func _migrate(data: Dictionary) -> Variant:
	var version := int(data.get("version", 0))
	while version < SAVE_VERSION:
		var stepped: Variant = _migrate_step(version, data)
		if stepped == null:
			return null
		data = stepped
		version = int(data.get("version", version + 1))
	if version > SAVE_VERSION:
		return null
	return data


func _migrate_step(from_version: int, data: Dictionary) -> Variant:
	if from_version < 1 or from_version >= SAVE_VERSION:
		return null
	data["version"] = from_version + 1
	return data
