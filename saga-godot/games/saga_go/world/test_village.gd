extends Node3D

const ChoicePrompt := preload("res://games/saga_go/ui/choice_prompt.gd")
const Perks := preload("res://games/saga_go/data/perks.gd")
const CompanionFollow := preload("res://saga_core/world/companion_follow.gd")

## VERTICAL_SLICE.md 12단계 루프의 마지막 단계 "다시 켜서 이어진다" —
## 씬이 다 만들어진 뒤(자식들의 _ready가 먼저 도는 Godot 기본 순서 그대로
## 이용) 저장 파일이 있으면 부대·플레이어 위치를 덮어쓴다. 없으면(첫
## 실행) 아무것도 안 하고 씬에 이미 놓인 스폰 위치 그대로 시작한다.
##
## 2026-09-11㉑ — "이미 끝낸 사건은 되살아나지 않는다"(EventState.gd)를
## 처음엔 각 사건 스크립트의 _ready()에서 `EventState.is_resolved(name)`
## 로 막으려 했는데, **실제로 확인해 보니 순서가 안 맞았다.** 위 주석대로
## "자식이 부모보다 먼저"는 맞지만, 그 말은 BanditEncounter 등 사건
## 노드들의 _ready()가 이 TestVillage._ready()(SaveState.try_load()를
## 부르는 자리)보다 **먼저** 끝난다는 뜻이었다 — 즉 사건 노드가 스스로를
## 확인하는 시점엔 EventState가 아직 텅 비어 있어(로드 전) 그 확인은
## 항상 무의미했다(임시로 두 _ready()에 순서 출력을 넣어 헤드리스로 직접
## 찍어 확인 — 추측 아님). 그래서 각 스크립트의 자체 확인은 지우고,
## 로드가 끝난 **뒤에** 여기서 한 번에 정리한다 — 사건 노드는 일단
## 평소대로 다 지어지고, 이미 끝난 것만 이 시점에 치운다.

## 점검(SAGA_*_PROBE)은 실제 세이브를 불러온 채 돌고 명단을 members 로 바꿔 끼운다 — 편성(㉝)으로 줄여 둔 자리 수가 점검을 흔들지 않게.
const PROBES := ["ADVENTURE", "ARTIFACT", "TREASURE", "FIELD_BOSS", "SHARD", "MAP", "COOK", "STORY", "DOMAIN", "WEEKLY", "COMMISSION", "GROWTH",
	"TALENT", "SIGHT", "TRAVERSAL", "COMBAT", "PERF", "KIT", "ELEMENT", "WEAPON", "LAYOUT", "ARCHERY", "QMAP", "FISH", "ACHIEVE", "DISPATCH", "FROST", "STORY2"]

static func _any_probe() -> bool:
	for p in PROBES:
		if OS.get_environment("SAGA_%s_PROBE" % p) != "":
			return true
	return false

func _ready() -> void:
	SaveState.try_load()
	if _any_probe():
		PartyState.party_size = PartyState.PARTY_MAX
	## PLAN 106장 ㊺ — 넷째 지역 서리봉 고원(마을 북쪽 고개 너머). 지형이 다른 것보다 먼저 서게 맨 앞에.
	var frost := preload("res://games/saga_go/world/region4_frost.gd").new()
	frost.name = "Region4Frost"
	add_child(frost)
	## PLAN 106장 ㊼ 이야기 3부 — 날개 조각이 떨어진 시대 명소(포구 녹슨 조선소 …).
	## PLAN 106장 ㊽ — 다섯째 지역 은하 나루(마을 서쪽 틈 고개 너머, 15장 뒤 열림).
	var skyport := preload("res://games/saga_go/world/region5_skyport.gd").new()
	skyport.name = "Region5Skyport"
	add_child(skyport)
	## PLAN 106장 ㊾ — 여섯째 지역 틈새 갈림길(은하 나루 남쪽, 은하역 선로 너머 — 4부 뒤 열림).
	var crossing := preload("res://games/saga_go/world/region6_crossing.gd").new()
	crossing.name = "Region6Crossing"
	add_child(crossing)
	## PLAN 106장 ㊿ — 일곱째 지역 잠긴 도읍(포구 남쪽 바다, 5부 뒤 해무가 걷힘).
	var sunken := preload("res://games/saga_go/world/region7_sunken.gd").new()
	sunken.name = "Region7Sunken"
	add_child(sunken)
	var era := preload("res://games/saga_go/world/era_sites.gd").new()
	era.name = "EraSites"
	add_child(era)
	_remove_resolved_events()
	if OS.get_environment("SAGA_DENSITY_REPORT") != "":
		_print_density_report()
	## PLAN 106장 ㉒ — 모험 등급 보상·세계 등급(들판 적 무리가 세계 등급을 읽으므로 그 앞, 로드 뒤).
	var adventure := preload("res://games/saga_go/world/adventure_rank.gd").new()
	adventure.name = "AdventureRank"
	add_child(adventure)
	if OS.get_environment("SAGA_ADVENTURE_PROBE") != "":
		add_child(load("res://tools/probe_adventure.gd").new())
	## PLAN 106장 ③ — 들판 적 무리.
	var spawner := preload("res://games/saga_go/combat/field_spawner.gd").new()
	spawner.name = "FieldSpawner"
	add_child(spawner)
	## PLAN 106장 ㉓ — 들판 보스 셋 + 보상 꽃(의뢰가 field_enemy 무리에 붙으므로 Commissions 앞).
	var field_bosses := preload("res://games/saga_go/world/field_bosses.gd").new()
	field_bosses.name = "FieldBosses"
	add_child(field_bosses)
	if OS.get_environment("SAGA_FIELD_BOSS_PROBE") != "":
		add_child(load("res://tools/probe_field_bosses.gd").new())
	## PLAN 106장 ⑥ — 보물 상자(무리 잠금이 적의 home 을 보므로 FieldSpawner 뒤).
	var chests := preload("res://games/saga_go/world/treasure_spawner.gd").new()
	chests.name = "TreasureSpawner"
	add_child(chests)
	## PLAN 106장 ⑨ — 순간이동 지점·신상 + 원신식 지도(미니맵·지도 화면 M·지역 이름).
	var waypoints := preload("res://games/saga_go/world/waypoints.gd").new()
	waypoints.name = "Waypoints"
	add_child(waypoints)
	var world_map := preload("res://games/saga_go/ui/world_map.gd").new()
	world_map.name = "WorldMap"
	add_child(world_map)
	world_map.bind_waypoints(waypoints)
	## PLAN 106장 ⑪ — 별조각(수집 구슬) + 신상 봉헌 → 스태미나 상한.
	var shards := preload("res://games/saga_go/world/star_shards.gd").new()
	shards.name = "StarShards"
	add_child(shards)
	if OS.get_environment("SAGA_SHARD_PROBE") != "":
		add_child(load("res://tools/probe_star_shards.gd").new())
	if OS.get_environment("SAGA_MAP_PROBE") != "":
		add_child(load("res://tools/probe_world_map.gd").new())
	## PLAN 106장 ⑩ — 인물 화면(레벨·돌파·가방, C/B).
	var chars := preload("res://games/saga_go/ui/character_screen.gd").new()
	chars.name = "CharacterScreen"
	add_child(chars)
	## PLAN 106장 ⑱ — 채집(재료·특산물) + 냄비·요리 + 요리·음식 화면(G, 냄비 곁 F).
	var gathering := preload("res://games/saga_go/world/gathering.gd").new()
	gathering.name = "Gathering"
	add_child(gathering)
	var kitchen := preload("res://games/saga_go/world/kitchen.gd").new()
	kitchen.name = "Kitchen"
	add_child(kitchen)
	var cooking := preload("res://games/saga_go/ui/cooking_screen.gd").new()
	cooking.name = "CookingScreen"
	add_child(cooking)
	if OS.get_environment("SAGA_COOK_PROBE") != "":
		add_child(load("res://tools/probe_cooking.gd").new())
	## PLAN 106장 ㊷ — 낚시터 넷 + 포구 낚시 조합.
	var fishing := preload("res://games/saga_go/world/fishing.gd").new()
	fishing.name = "Fishing"
	add_child(fishing)
	if OS.get_environment("SAGA_FISH_PROBE") != "":
		add_child(load("res://tools/probe_fishing.gd").new())
	## PLAN 106장 ⑲ — 일일 의뢰 넷(U) + 마을 역참 옆 게시판(채집·요리·들판 적 신호에 붙으므로 그 뒤).
	var commissions := preload("res://games/saga_go/world/commissions.gd").new()
	commissions.name = "Commissions"
	add_child(commissions)
	commissions.changed.connect(_refresh_goal_board)
	## PLAN 106장 ⑳ — 비경 셋(입구 F·세상 밖 원판·보상 나무·원기).
	var domains := preload("res://games/saga_go/world/domains.gd").new()
	domains.name = "Domains"
	add_child(domains)
	## PLAN 106장 ㉕ — 이야기 임무(들판 보스·비경 신호에 붙으므로 그 뒤).
	## PLAN 106장 ㊳ — 9장 구름섬·바람 기둥(북쪽 봉우리 옆 하늘).
	var sky_isle := preload("res://games/saga_go/world/sky_isle.gd").new()
	sky_isle.name = "SkyIsle"
	add_child(sky_isle)
	## PLAN 106장 ㊾-3 — 20장 갈림길 끝(틈새 갈림길 첫 정거장 동남쪽 하늘에 뜬 섬·바람 기둥).
	var rift_end := preload("res://games/saga_go/world/rift_end.gd").new()
	rift_end.name = "RiftEnd"
	add_child(rift_end)
	var story := preload("res://games/saga_go/world/story_quest.gd").new()
	story.name = "StoryQuest"
	add_child(story)
	if OS.get_environment("SAGA_STORY_PROBE") != "":
		add_child(load("res://tools/probe_story.gd").new())
	if OS.get_environment("SAGA_WQ_PROBE") != "":
		add_child(load("res://tools/probe_world_quests.gd").new())
	if OS.get_environment("SAGA_QMAP_PROBE") != "": # 106장 ㊶ 지도 임무 표식
		add_child(load("res://tools/probe_quest_map.gd").new())
	if OS.get_environment("SAGA_DOMAIN_PROBE") != "":
		add_child(load("res://tools/probe_domains.gd").new())
	if OS.get_environment("SAGA_WEEKLY_PROBE") != "":
		add_child(load("res://tools/probe_weekly_boss.gd").new())
	if OS.get_environment("SAGA_COMMISSION_PROBE") != "":
		add_child(load("res://tools/probe_commissions.gd").new())
	if OS.get_environment("SAGA_GROWTH_PROBE") != "":
		add_child(load("res://tools/probe_growth.gd").new())
	if OS.get_environment("SAGA_TALENT_PROBE") != "":
		add_child(load("res://tools/probe_talent.gd").new())
	## PLAN 106장 ⑬ — 원소 시야(휠 누르기·V 누르고 있기).
	var sight := preload("res://games/saga_go/world/elemental_sight.gd").new()
	sight.name = "ElementalSight"
	add_child(sight)
	if OS.get_environment("SAGA_SIGHT_PROBE") != "":
		add_child(load("res://tools/probe_elemental_sight.gd").new())
	## 원신식 이동(go_player.gd) 자동 점검 — 측정할 때만 붙인다.
	if OS.get_environment("SAGA_TRAVERSAL_PROBE") != "":
		add_child(load("res://tools/probe_traversal.gd").new())
	if OS.get_environment("SAGA_COMBAT_PROBE") != "":
		add_child(load("res://tools/probe_field_combat.gd").new())
	if OS.get_environment("SAGA_PERF_PROBE") != "":
		add_child(load("res://tools/probe_perf.gd").new())
	if OS.get_environment("SAGA_SHOT_PROBE") != "":
		add_child(load("res://tools/probe_shots.gd").new())
	if OS.get_environment("SAGA_KIT_PROBE") != "":
		add_child(load("res://tools/probe_kits.gd").new())
	if OS.get_environment("SAGA_ELEMENT_PROBE") != "":
		add_child(load("res://tools/probe_elements.gd").new())
	if OS.get_environment("SAGA_WEAPON_PROBE") != "":
		add_child(load("res://tools/probe_weapons.gd").new())
	if OS.get_environment("SAGA_ARTIFACT_PROBE") != "":
		add_child(load("res://tools/probe_artifacts.gd").new())
	if OS.get_environment("SAGA_TREASURE_PROBE") != "":
		add_child(load("res://tools/probe_treasure.gd").new())
	if OS.get_environment("SAGA_ARCHERY_PROBE") != "": # 106장 ㊵ 활 조준·과녁
		add_child(load("res://tools/probe_archery.gd").new())

	## PLAN 106장 ㊹ — 탐사 파견(마을 역참 곁 게시판).
	var dispatch := preload("res://games/saga_go/world/dispatch.gd").new()
	dispatch.name = "Dispatch"
	add_child(dispatch)
	if OS.get_environment("SAGA_DISPATCH_PROBE") != "":
		add_child(load("res://tools/probe_dispatch.gd").new())
	if OS.get_environment("SAGA_FROST_PROBE") != "": # 106장 ㊺ 서리봉 고원
		add_child(load("res://tools/probe_frost.gd").new())
	if OS.get_environment("SAGA_STORY2_PROBE") != "": # 106장 ㊺ 이야기 2부(10장~)
		add_child(load("res://tools/probe_story2.gd").new())
	if OS.get_environment("SAGA_STORY3_PROBE") != "": # 106장 ㊼ 이야기 3부(13장~)
		add_child(load("res://tools/probe_story3.gd").new())
	if OS.get_environment("SAGA_STORY4_PROBE") != "": # 106장 ㊽ 이야기 4부(16장~)
		add_child(load("res://tools/probe_story4.gd").new())
	if OS.get_environment("SAGA_STORY5_PROBE") != "": # 106장 ㊾ 이야기 5부(19장~)
		add_child(load("res://tools/probe_story5.gd").new())
	if OS.get_environment("SAGA_SKYPORT_PROBE") != "": # 106장 ㊽ 다섯째 지역 은하 나루
		add_child(load("res://tools/probe_skyport.gd").new())
	if OS.get_environment("SAGA_CROSSING_PROBE") != "": # 106장 ㊾ 여섯째 지역 틈새 갈림길
		add_child(load("res://tools/probe_crossing.gd").new())
	if OS.get_environment("SAGA_STORY6_PROBE") != "": # 106장 ㊿-2~ 이야기 6부
		add_child(load("res://tools/probe_story6.gd").new())
	if OS.get_environment("SAGA_SUNKEN_PROBE") != "": # 106장 ㊿ 일곱째 지역 잠긴 도읍
		add_child(load("res://tools/probe_sunken.gd").new())

	## PLAN 106장 ㊸ — 업적(다른 노드 신호에 붙으므로 맨 뒤).
	var achievements := preload("res://games/saga_go/world/achievements.gd").new()
	achievements.name = "Achievements"
	add_child(achievements)
	if OS.get_environment("SAGA_ACHIEVE_PROBE") != "":
		add_child(load("res://tools/probe_achievements.gd").new())

	## 그리기 부담 — 다 지은 뒤 지도 전체 MultiMesh 를 칸으로 쪼개고 카메라 far 를 안개에 맞춘다(보이는 것은 그대로, render_budget.gd).
	(func() -> void: preload("res://games/saga_go/world/render_budget.gd").apply(self)).call_deferred()

	## PLAN.md 101-4 GO ①후보 "일과판" — 로드가 끝난 뒤(위와 같은 이유,
	## 세션 델타의 기준점이 로드 전 값이면 안 된다) 세션을 연다.
	PartyState.begin_session()
	CodexState.begin_session()
	QuestState.quest_changed.connect(_refresh_goal_board)
	CodexState.codex_changed.connect(_refresh_goal_board)
	PartyState.power_changed.connect(func(_atk: float, _def: float) -> void: _refresh_goal_board())
	PartyState.level_up.connect(_on_party_level_up)
	_refresh_goal_board()

	## 101-3 G "동행 실루엣" — 등용 인원 수만큼 Player 뒤를 따르는 실루엣.
	var companions := CompanionFollow.new()
	add_child(companions)
	companions.setup(get_tree().get_first_node_in_group("player"))
	companions.set_count(PartyState.members.size())
	PartyState.power_changed.connect(func(_atk: float, _def: float) -> void: companions.set_count(PartyState.members.size()))


## saga_core/ui/goal_board.gd는 QuestState·CodexState·PartyState를 모른다
## (saga_core가 GO만의 싱글턴을 알면 안 된다) — 그래서 이 셋을 다 아는
## 이 판의 월드 스크립트가 3줄을 조립해 넣어 준다. 셋째 줄("이번 주" 자리)은
## 106장 ⑲ 일일 의뢰가 채운다(의뢰 노드가 없으면 "—").
func _refresh_goal_board() -> void:
	var board := get_tree().get_first_node_in_group("goal_board")
	if board == null:
		return
	var now: String
	if QuestState.active_id != "" and not QuestState.done:
		now = "사명: " + QuestState.active_name
	else:
		now = "도감 채우기 (%d/%d)" % [CodexState.count(), CodexState.total()]
	var session := "경험치 +%.0f · 발견 +%d" % [PartyState.session_exp_gained(), CodexState.session_discovered()]
	## 셋째 줄 — 106장 ⑲ 일일 의뢰(전엔 "—").
	var week := "—"
	var cm := get_tree().get_first_node_in_group("go_commissions")
	if cm:
		week = "의뢰 %d/4" % int(cm.call("done_count"))
		if cm.call("all_done") and not cm.call("bonus_claimed"):
			week += " · 게시판 보상"
	board.set_goals(now, session, week)

## PLAN.md 104-5 — 지역 3(마을·포구·폐허) 발견 밀도(§3-E). 평소엔 안
## 돌린다(로그에 매번 섞이면 회귀 md5 가 흔들린다) — 측정할 때만
## `SAGA_DENSITY_REPORT=1` 로 켠다. "codex_discoverable" 그룹은
## landmarks_builder.gd·region2_coast.gd·region3_ruins.gd 의
## `_add_discovery_area()` 가 채운다.
func _print_density_report() -> void:
	var test_map := load("res://games/saga_go/data/test_map.gd")
	var density := load("res://saga_core/world/density_report.gd")
	var terrain := load("res://games/saga_go/world/terrain_builder.gd")
	for region_id in ["village", "coast", "ruins", "frost", "skyport", "crossing", "sunken"]:
		var origin: Vector3 = test_map.origin_of(region_id)
		var size: Vector2i = test_map.size(region_id)
		var tile: float = test_map.tile_size_of(region_id)
		var half_w := size.x * 0.5 * tile
		var half_h := size.y * 0.5 * tile
		var points: Array = []
		for node in get_tree().get_nodes_in_group("codex_discoverable"):
			var local: Vector3 = (node as Node3D).global_position - origin
			if abs(local.x) <= half_w and abs(local.z) <= half_h:
				points.append(Vector2(local.x / tile + size.x * 0.5, local.z / tile + size.y * 0.5))
		## 2026-09-18 고침 — "^"(산)만 걸러내던 예전 식은 강("~")도 걸어
		## 들어갈 수 있는 칸처럼 셌다. terrain_builder.gd LEGEND가 이미
		## 칸마다 walkable 진위를 들고 있으니(강은 false) 그걸 그대로
		## 쓴다 — 포구는 격자 절반이 바다라 이 한 줄로 분모가 크게
		## 줄어든다(PLAN 101-1 E, HISTORY 09-18 재측정 참고).
		var walkable := func(x: int, y: int) -> bool:
			return terrain.LEGEND[test_map.tile_at(x, y, region_id)].walkable
		var report: Dictionary = density.report(size, tile, points, 60.0, walkable)
		print("DENSITY %s total=%d empty=%d empty_pct=%.1f" % [region_id, report.total, report.empty, report.empty_pct])

## PLAN.md 101-2 GO ②"승급 3택" — 부대가 레벨업할 때마다(웹판의 인물별
## rank up 대신 이 판 유일한 성장 지점인 부대 레벨을 쓴다) 공/수/보
## 축에서 하나씩 카드 3장 + 거절을 보여준다. npc_builder.gd
## `_show_offer_prompt()`와 같은 `layer_box` 관용구(ChoicePrompt 클로저
## 버그, PLAN.md 104-4 참고) — `opt`는 for 루프 변수라 별개(스냅샷 캡처가
## 매 반복 제 값을 찍는다는 걸 test_loop_closure.gd로 직접 확인했다).
func _on_party_level_up(new_level: int) -> void:
	var options: Array = Perks.roll_three(PartyState.perks)
	if options.is_empty():
		return # 풀 12를 이미 다 가졌다 — 더 줄 특성이 없다.
	var layer_box := {}
	var choices: Array = []
	for opt in options:
		var label := "%s [%s] +%d%%" % [opt.name, Perks.AXIS_LABEL[opt.axis], int(opt.mul * 100.0)]
		choices.append({"label": label, "cb": func() -> void:
			PartyState.add_perk(opt.id)
			(layer_box["layer"] as CanvasLayer).queue_free()})
	choices.append({"label": "거절한다 (경험치 +%d)" % int(PartyState.REJECT_EXP), "cb": func() -> void:
		PartyState.add_exp(PartyState.REJECT_EXP)
		(layer_box["layer"] as CanvasLayer).queue_free()})
	layer_box["layer"] = ChoicePrompt.build(self, "Lv.%d — 특성을 하나 고른다" % new_level, choices)


## TestVillage 바로 아래 자식 중 이름이 EventState.resolved에 있는
## 것들을 치운다. 사건 노드는 전부 이 씬의 직계 자식(BanditEncounter·
## HeroEncounter 등)이라 한 단계만 훑으면 된다 — 자식의 자식(패널·트리거
## Area3D 등)까지는 볼 필요 없다.
func _remove_resolved_events() -> void:
	for child in get_children():
		if EventState.is_resolved(child.name):
			child.queue_free()
