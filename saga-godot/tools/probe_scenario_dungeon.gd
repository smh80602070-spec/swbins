extends SceneTree

## G-0085 사가나락 이야기 1막(games/saga_dungeon/data/scenario.gd 표·규칙, world/scenario_runner.gd 엔진) 자동 점검 — 화면·세이브 파일 없이.
##   godot --headless --path saga-godot --script res://tools/probe_scenario_dungeon.gd
## ① 표: 장 셋 id 가 정본(a1_moru·a1_blackflag·a1_tomb) · 시대 섞기 셋 다 · talk 장면이 SCENES 에 있고 말한 이가 CAST 또는 me · 단계 종류가 엔진이 아는 것 · 금 보상 · 구출 방이 일곱 안
## ② 흐름 흉내: 새 판 → moru1 → 처치 5(4 로는 안 넘어감) → moru2 → 1층 출구 → moru3(1장 끝·금 300) → flag1 → 보스 1 → flag2(2장 끝) → tomb1 → 5층 → 구출 → tomb2(1막 끝), 끝낸 id 셋·금 합 2600
## ③ 옛 세이브: 빈 칸 → 1장 처음 · JSON 이 돌려준 실수(1.0) 칸도 그대로 읽힘 ④ 이미 지난 층: 방을 다 비운 세이브는 floor 단계가 바로 넘어감
## ⑤ 엔진 스크립트가 컴파일되고 objective·rescue·next_line 이 있음 · 목표판 글(처치 n/5·구출)
## 끝에 "PROBE scenario_dungeon OK" 또는 "PROBE scenario_dungeon FAIL n".

var fails := 0


func check(cond: bool, msg: String) -> void:
	if cond:
		print("  ok   ", msg)
	else:
		fails += 1
		print("  FAIL ", msg)


func _initialize() -> void:
	await process_frame   # 던전 autoload 가 올라온 뒤(엔진 스크립트가 DungeonSaveState 를 부른다)
	var S: GDScript = load("res://games/saga_dungeon/data/scenario.gd")
	check(S != null, "scenario.gd 를 불러옴")
	if S == null:
		_end()
		return

	# ① 표
	var ids: Array = S.CHAPTERS.map(func(c): return String(c.id))
	check(ids == ["a1_moru", "a1_blackflag", "a1_tomb"], "장 셋 id 정본 %s" % [ids])
	var bad: Array = []
	var known := ["talk", "kill", "boss", "floor", "rescue"]
	for c: Dictionary in S.CHAPTERS:
		for era in ["past", "now", "future"]:
			if String((c.mix as Dictionary).get(era, "")) == "":
				bad.append("%s 시대 %s 없음" % [c.id, era])
		if int(c.get("gold", 0)) <= 0:
			bad.append("%s 금 없음" % c.id)
		for s: Dictionary in c.steps:
			if not known.has(String(s.t)):
				bad.append("%s 모르는 단계 %s" % [c.id, s.t])
			if s.t == "talk":
				var lines: Array = S.SCENES.get(String(s.scene), [])
				if lines.is_empty():
					bad.append("장면 없음 " + String(s.scene))
				for l: Array in lines:
					if String(l[0]) != "me" and not S.CAST.has(String(l[0])):
						bad.append("%s 모르는 이 %s" % [s.scene, l[0]])
					if String(l[1]).strip_edges() == "":
						bad.append("%s 빈 줄" % s.scene)
			if s.t == "rescue" and (int(s.room) < 0 or int(s.room) >= 7):
				bad.append("구출 방 %d" % int(s.room))
	check(bad.is_empty(), "표 규칙 %s" % [bad])

	# ② 흐름
	var st: Dictionary = S.fresh()
	var rooms: Array = [false, false, false, false, false, false, false]
	var done_ids: Array = []
	var acc := {"gold": 0}   # 람다는 int 를 값으로 잡으므로 사전에
	var take := func(arr: Array) -> void:
		for c in arr:
			done_ids.append(String(c.id))
			acc.gold = int(acc.gold) + int(c.gold)
	check(S.pending_scene(st) == "moru1", "새 판 첫 단계 = moru1 대화")
	take.call(S.finish_talk(st, rooms))
	check(String(S.step(st).t) == "kill" and S.objective(st).contains("적 처치 0/5"), "moru1 뒤 처치 단계 · 목표판 \"%s\"" % S.objective(st))
	st.kills = 4
	take.call(S.check(st, rooms))
	check(String(S.step(st).t) == "kill", "처치 4 로는 안 넘어감")
	st.kills = 5
	take.call(S.check(st, rooms))
	check(S.pending_scene(st) == "moru2", "처치 5 → moru2")
	take.call(S.finish_talk(st, rooms))
	check(String(S.step(st).t) == "floor", "moru2 뒤 1층 단계")
	take.call(S.check(st, rooms))
	check(String(S.step(st).t) == "floor", "1층 출구 전에는 머묾")
	rooms[0] = true
	take.call(S.check(st, rooms))
	check(S.pending_scene(st) == "moru3", "1층 출구 → moru3")
	take.call(S.finish_talk(st, rooms))
	check(done_ids == ["a1_moru"] and int(acc.gold) == 300 and S.pending_scene(st) == "flag1", "1장 끝(금 300) → 2장 flag1")
	take.call(S.finish_talk(st, rooms))
	st.kills = 9
	take.call(S.check(st, rooms))
	check(String(S.step(st).t) == "boss", "보스 단계는 잡졸 처치로 안 넘어감")
	st.boss_kills = 1
	take.call(S.check(st, rooms))
	check(S.pending_scene(st) == "flag2", "보스 1 → flag2")
	take.call(S.finish_talk(st, rooms))
	check(done_ids == ["a1_moru", "a1_blackflag"] and S.pending_scene(st) == "tomb1", "2장 끝 → 3장 tomb1")
	take.call(S.finish_talk(st, rooms))
	rooms[4] = true
	take.call(S.check(st, rooms))
	check(String(S.step(st).t) == "rescue" and S.objective(st).contains("6층"), "5층 출구 → 6층 구출 단계 · \"%s\"" % S.objective(st))
	st.rescues = 1
	take.call(S.check(st, rooms))
	check(S.pending_scene(st) == "tomb2", "구출 → tomb2")
	take.call(S.finish_talk(st, rooms))
	check(S.finished(st) and done_ids == ["a1_moru", "a1_blackflag", "a1_tomb"] and int(acc.gold) == 2600 and (st.done as Array).size() == 3 and S.objective(st) == "",
		"1막 끝 — 끝낸 %s · 금 %d" % [done_ids, int(acc.gold)])

	# ③ 옛 세이브·JSON 실수
	var old: Dictionary = S.normalize({})
	check(S.pending_scene(old) == "moru1" and old == S.fresh(), "scenario 칸 없는 세이브 → 1장 처음")
	var js: Dictionary = S.normalize(JSON.parse_string(JSON.stringify({"ch": 1, "step": 1, "base": 0, "kills": 7, "boss_kills": 0, "rescues": 0, "done": ["a1_moru"]})))
	check(String(S.step(js).t) == "boss" and String(S.chapter(js).id) == "a1_blackflag", "JSON 왕복(실수 칸) 세이브를 그대로 읽음")

	# ④ 이미 지난 층
	var past: Dictionary = S.fresh()
	past.ch = 0
	past.step = 3
	S.check(past, [true, true, true, true, true, true, true])
	check(S.pending_scene(past) == "moru3", "방을 다 비운 세이브는 1층 단계가 바로 넘어감")

	# ⑤ 엔진
	var R: GDScript = load("res://games/saga_dungeon/world/scenario_runner.gd")
	var r_ok: bool = R != null and R.can_instantiate()
	if r_ok:
		var r: Node = R.new()
		r_ok = r.has_method("objective") and r.has_method("rescue") and r.has_method("next_line") and r.has_method("open_talk")
		r.free()
	check(r_ok, "scenario_runner.gd 컴파일·공개 함수")
	var room: GDScript = load("res://games/saga_dungeon/world/test_room.gd")
	check(room != null and room.can_instantiate(), "test_room.gd 컴파일(엔진 배선)")
	_end()


func _end() -> void:
	print("PROBE scenario_dungeon %s" % ("OK" if fails == 0 else "FAIL %d" % fails))
	quit(0 if fails == 0 else 1)
