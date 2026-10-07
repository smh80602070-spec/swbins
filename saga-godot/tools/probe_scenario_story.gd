extends SceneTree

## G-0087 사가종횡 이야기 1부(games/saga_story/data/scenario.gd·world/scenario_runner.gd) 자동 점검 — 세이브 파일 없이.
##   godot --headless --path saga-godot --script res://tools/probe_scenario_story.gd
## ① 표: 장 넷 id 정본(p1_sinya·p1_heodo·p1_field·p1_job) · 시대 섞기 셋 · 장면·말한 이 · 사명 key 가 고돗 QUESTS 에 있음 · 장면 키가 SCENE_KEYS 값 · 경험치·금
## ② 흐름 흉내(ctx 사전): 다른 장면에선 sinya1 안 뜸 → 신야성 → sinya1 → q_first → sinya2(1장 끝) → 허도 heodo1 → q_gear1 → heodo2 → 들판 field1 → q_field·q_boss1 → field2
##    → Lv9 에선 잠김("Lv 10 되면") → Lv10 허도 job1 → 1차 전직 → job2(1부 끝, 경험치 1230·금 4000)
## ③ legacy: 빈 칸 + Lv10 또는 1차 전직 → 1부 지나온 길(보상 없음) · 빈 칸 + Lv3 → 1장부터 · 칸이 있으면 legacy 안 함
## ④ 말한 이: mentor 는 넘긴 스승 이름(없으면 "스승") · 스승 이름이 도감 가명(mentor_of)에서 나옴
## ⑤ 엔진·장면 스크립트 컴파일(scenario_runner·story_field·story_town·goal_board_feed)
## 끝에 "PROBE scenario_story OK" 또는 "PROBE scenario_story FAIL n".

var fails := 0


func check(cond: bool, msg: String) -> void:
	if cond:
		print("  ok   ", msg)
	else:
		fails += 1
		print("  FAIL ", msg)


func _initialize() -> void:
	await process_frame
	var S: GDScript = load("res://games/saga_story/data/scenario.gd")
	var C: GDScript = load("res://games/saga_story/data/story_combat.gd")
	check(S != null and C != null, "scenario.gd·story_combat.gd 를 불러옴")
	if S == null or C == null:
		_end()
		return

	# ① 표
	var ids: Array = S.CHAPTERS.map(func(c): return String(c.id))
	check(ids == ["p1_sinya", "p1_heodo", "p1_field", "p1_job"], "장 넷 id 정본 %s" % [ids])
	var bad: Array = []
	var keys: Array = S.SCENE_KEYS.values()
	for c: Dictionary in S.CHAPTERS:
		for era in ["past", "now", "future"]:
			if String((c.mix as Dictionary).get(era, "")) == "":
				bad.append("%s 시대 %s" % [c.id, era])
		if int(c.get("exp", 0)) <= 0 or int(c.get("gold", 0)) <= 0:
			bad.append("%s 보상" % c.id)
		for s: Dictionary in c.steps:
			match String(s.t):
				"talk":
					var lines: Array = S.SCENES.get(String(s.scene), [])
					if lines.is_empty():
						bad.append("장면 없음 " + String(s.scene))
					for l: Array in lines:
						if not (String(l[0]) in ["me", "mentor"]) and not S.CAST.has(String(l[0])):
							bad.append("%s 모르는 이 %s" % [s.scene, l[0]])
					if s.has("at") and not keys.has(String(s.at)):
						bad.append("at %s" % s.at)
				"stage":
					if not keys.has(String(s.stage)):
						bad.append("장면 키 %s" % s.stage)
				"mission":
					if not C.QUESTS.has(String(s.quest)):
						bad.append("사명 없음 %s" % s.quest)
				"job":
					pass
				_:
					bad.append("모르는 단계 %s" % s.t)
	check(bad.is_empty(), "표 규칙 %s" % [bad])

	# ② 흐름
	var st: Dictionary = S.fresh()
	var ctx := {"level": 1, "stage": "heodo", "quests": {}, "tier": 0}
	var log := {"exp": 0, "gold": 0, "ch": []}
	var take := func(arr: Array) -> void:
		for r: Dictionary in arr:
			if r.has("chapter"):
				log.exp = int(log.exp) + int(r.chapter.exp)
				log.gold = int(log.gold) + int(r.chapter.gold)
				(log.ch as Array).append(String(r.chapter.id))
	take.call(S.check(st, ctx))
	check(String(S.step(st).t) == "stage" and S.objective(st, ctx).contains("신야성"), "허도에선 신야성으로 \"%s\"" % S.objective(st, ctx))
	ctx.stage = "sinya"
	take.call(S.check(st, ctx))
	check(S.pending_scene(st, ctx) == "sinya1", "신야성 → sinya1")
	ctx.stage = "heodo"
	check(S.pending_scene(st, ctx) == "", "at 신야성 대화는 다른 장면에서 안 뜸")
	ctx.stage = "sinya"
	take.call(S.finish_talk(st, ctx))
	check(String(S.step(st).t) == "mission" and S.objective(st, ctx).contains("첫 사냥") == false, "q_first 단계(이름은 부르는 쪽이 넘김)")
	check(S.objective(st, ctx, {"q_first": "첫 사냥"}).contains("「첫 사냥」"), "목표판 사명 이름")
	ctx.quests = {"q_first": true}
	take.call(S.check(st, ctx))
	check(S.pending_scene(st, ctx) == "sinya2", "첫 사냥 → sinya2(어디서나)")
	take.call(S.finish_talk(st, ctx))
	check(log.ch == ["p1_sinya"] and String(S.step(st).t) == "stage", "1장 끝 → 허도로")
	ctx.stage = "heodo"
	take.call(S.check(st, ctx))
	take.call(S.finish_talk(st, ctx))   # heodo1
	ctx.quests["q_gear1"] = true
	take.call(S.check(st, ctx))
	take.call(S.finish_talk(st, ctx))   # heodo2
	check(log.ch == ["p1_sinya", "p1_heodo"], "2장 끝")
	ctx.stage = "field"
	take.call(S.check(st, ctx))
	check(S.pending_scene(st, ctx) == "field1", "들판 → field1")
	take.call(S.finish_talk(st, ctx))
	ctx.quests["q_field"] = true
	take.call(S.check(st, ctx))
	check(String(S.step(st).get("quest", "")) == "q_boss1", "들판을 비운다 → 두목의 목")
	ctx.quests["q_boss1"] = true
	take.call(S.check(st, ctx))
	take.call(S.finish_talk(st, ctx))   # field2
	check(log.ch.size() == 3, "3장 끝")
	ctx.stage = "heodo"
	ctx.level = 9
	take.call(S.check(st, ctx))
	check(S.pending_scene(st, ctx) == "" and S.objective(st, ctx).contains("Lv 10 되면"), "Lv9 — 4장 잠김 \"%s\"" % S.objective(st, ctx))
	ctx.level = 10
	check(S.pending_scene(st, ctx) == "job1", "Lv10 허도 → job1")
	take.call(S.finish_talk(st, ctx))
	check(S.objective(st, ctx).contains("1차 전직"), "전직 단계")
	ctx.tier = 1
	take.call(S.check(st, ctx))
	take.call(S.finish_talk(st, ctx))   # job2
	check(S.finished(st) and log.ch.size() == 4 and int(log.exp) == 1230 and int(log.gold) == 4000 and S.objective(st, ctx) == "",
		"1부 끝 — 경험치 %d · 금 %d" % [int(log.exp), int(log.gold)])

	# ③ legacy
	var a: Dictionary = S.normalize({})
	check(S.apply_legacy(a, true, 12, 0) and S.finished(a) and (a.done as Array).size() == 4, "빈 칸 + Lv12 → 1부 지나온 길")
	var b: Dictionary = S.normalize({})
	check(S.apply_legacy(b, true, 3, 1) and S.finished(b), "빈 칸 + 1차 전직 → 지나온 길")
	var c: Dictionary = S.normalize({})
	check(not S.apply_legacy(c, true, 3, 0) and S.pending_scene(c, {"level": 3, "stage": "sinya"}) == "", "빈 칸 + Lv3 → 1장부터(신야성 들어서기)")
	var d: Dictionary = S.normalize({"ch": 1, "step": 0, "done": ["p1_sinya"], "legacy": false})
	check(not S.apply_legacy(d, false, 20, 2) and int(d.ch) == 1, "칸이 있으면 legacy 안 함")

	# ④ 말한 이
	check(S.speaker("mentor", "") == "🥋 스승" and S.speaker("mentor", "가명") == "🥋 가명" and S.speaker("me", "") == "나 · 무명", "말한 이 표시")
	var m: Dictionary = C.mentor_of("warrior")
	check(String(m.get("name", "")) != "", "1차 무사 스승 이름 %s" % m.get("name", ""))

	# ⑤ 컴파일
	for p in ["res://games/saga_story/world/scenario_runner.gd", "res://games/saga_story/world/story_field.gd", "res://games/saga_story/world/story_town.gd", "res://games/saga_story/ui/goal_board_feed.gd"]:
		var g: GDScript = load(p)
		check(g != null and g.can_instantiate(), "컴파일 " + p.get_file())
	_end()


func _end() -> void:
	print("PROBE scenario_story %s" % ("OK" if fails == 0 else "FAIL %d" % fails))
	quit(0 if fails == 0 else 1)
