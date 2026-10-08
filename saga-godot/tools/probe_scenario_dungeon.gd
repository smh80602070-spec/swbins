extends SceneTree

## G-0085 사가나락 이야기 1막(games/saga_dungeon/data/scenario.gd 표·규칙, world/scenario_runner.gd 엔진) 자동 점검 — 화면·세이브 파일 없이.
##   godot --headless --path saga-godot --script res://tools/probe_scenario_dungeon.gd
## ① 표: 장 셋 id 가 정본(a1_moru·a1_blackflag·a1_tomb) · 시대 섞기 셋 다 · talk 장면이 SCENES 에 있고 말한 이가 CAST 또는 me · 단계 종류가 엔진이 아는 것 · 금 보상 · 구출 방이 일곱 안
## ② 흐름 흉내: 새 판 → moru1 → 처치 5(4 로는 안 넘어감) → moru2 → 1층 출구 → moru3(1장 끝·금 300) → flag1 → 보스 1 → flag2(2장 끝) → tomb1 → 5층 → 구출 → tomb2(1막 끝), 끝낸 id 셋·금 합 2600
## ②-2 G-0089 2막: tomb2 → fac1 → 월드 보스 1 → fac2 → tide1 → 난입 파도 → tide2 → 7층 출구 → fort1 고르기(seal) → fort2_seal(2막 끝, 금 합 13600·choices.fort)
## ②-3 G-0093 3막: fort2 → rg1 → 정예 3(보통 처치로 안 됨) → rg2(장 보상 sigil 1) → sf1 → 부적 1단 → sf2 → bw1 → 부적 2단 → bw2 → pal1 → 부적 3단 → pal2(3막 끝, 금 합 52600)
## ②-4 G-0097 4막: car1 → 월드 보스 2(하나로 안 됨) → car2 → snow1 → 난입 파도 5(horde_wave) → snow2 → scr1 → 정예 5(넷으로 안 됨) → scr2 → hg1 → 부적 4단(3단 머묾) → hg2(4막 끝, 장 열넷·금 합 129600)
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
	check(ids == ["a1_moru", "a1_blackflag", "a1_tomb", "a2_factory", "a2_tideflat", "a2_watchtower", "a3_riftgate", "a3_sunfurnace", "a3_blackwind", "a3_palace",
		"a4_caravan", "a4_snowfort", "a4_scrap", "a4_hellgate"], "장 열넷 id 정본 %s" % [ids])
	var bad: Array = []
	var known := ["talk", "kill", "boss", "floor", "rescue", "wboss", "horde", "elite", "sigil"]
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
				var scenes: Array = [String(s.scene)]
				if s.has("by"):   # 고르기 답마다 장면 하나
					scenes = []
					for k in S.CHOICES:
						if String(S.CHOICES[k].id) == String(s.by):
							for o: Dictionary in S.CHOICES[k].options:
								scenes.append("%s_%s" % [s.scene, o.key])
					if scenes.is_empty():
						bad.append("고르기 없음 " + String(s.by))
				var lines: Array = []
				for sc in scenes:
					if (S.SCENES.get(sc, []) as Array).is_empty():
						bad.append("장면 없음 " + sc)
					lines += S.SCENES.get(sc, [])
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
	check(done_ids == ["a1_moru", "a1_blackflag", "a1_tomb"] and int(acc.gold) == 2600 and S.pending_scene(st) == "fac1",
		"1막 끝 — 끝낸 %s · 금 %d → 2막 fac1" % [done_ids, int(acc.gold)])

	# ②-2 2막
	take.call(S.finish_talk(st, rooms))
	check(String(S.step(st).t) == "wboss" and S.objective(st).contains("월드 보스"), "fac1 → 월드 보스 \"%s\"" % S.objective(st))
	st.boss_kills = int(st.boss_kills) + 3   # 보통 보스는 안 셈
	take.call(S.check(st, rooms))
	check(String(S.step(st).t) == "wboss", "보통 보스로는 안 넘어감")
	st.wbosses = 1
	take.call(S.check(st, rooms))
	check(S.pending_scene(st) == "fac2", "월드 보스 1 → fac2")
	take.call(S.finish_talk(st, rooms))
	check(int(acc.gold) == 5100 and S.pending_scene(st) == "tide1", "4장 끝(2500) → tide1")
	take.call(S.finish_talk(st, rooms))
	check(String(S.step(st).t) == "horde" and S.objective(st).contains("파도 %d" % S.HORDE_WAVE), "난입 단계 \"%s\"" % S.objective(st))
	st.hordes = 1
	take.call(S.check(st, rooms))
	take.call(S.finish_talk(st, rooms))   # tide2
	check(int(acc.gold) == 8600 and String(S.step(st).t) == "floor", "5장 끝(3500) → 7층 단계")
	rooms[6] = true
	take.call(S.check(st, rooms))
	check(S.pending_scene(st) == "fort1" and S.CHOICES.has("fort1"), "7층 출구 → fort1(고르기)")
	take.call(S.finish_talk(st, rooms, "seal"))
	check(S.pending_scene(st) == "fort2_seal" and String(st.choices.get("fort", "")) == "seal", "봉인 → fort2_seal")
	take.call(S.finish_talk(st, rooms))
	check((st.done as Array).size() == 6 and int(acc.gold) == 13600 and S.pending_scene(st) == "rg1", "2막 끝 — 금 합 %d → 3막 rg1" % int(acc.gold))

	# ②-3 3막
	take.call(S.finish_talk(st, rooms))
	check(String(S.step(st).t) == "elite" and S.objective(st).contains("정예 처치 0/3"), "rg1 → 정예 \"%s\"" % S.objective(st))
	st.kills = int(st.kills) + 10
	take.call(S.check(st, rooms))
	check(String(S.step(st).t) == "elite", "보통 처치로는 안 넘어감")
	st.elites = int(st.get("elites", 0)) + 3
	take.call(S.check(st, rooms))
	check(S.pending_scene(st) == "rg2", "정예 3 → rg2")
	var got_sigil := []
	for c in S.finish_talk(st, rooms):
		got_sigil.append(int(c.get("sigil", 0)))
		acc.gold = int(acc.gold) + int(c.gold)
		done_ids.append(String(c.id))
	check(got_sigil == [1] and S.pending_scene(st) == "sf1", "7장 끝 — 장 보상 부적 1단 → sf1")
	take.call(S.finish_talk(st, rooms))
	check(String(S.step(st).t) == "sigil" and S.objective(st).contains("부적 던전 1단"), "부적 1단 단계")
	st.sigil_best = 1
	take.call(S.check(st, rooms))
	take.call(S.finish_talk(st, rooms))   # sf2
	take.call(S.finish_talk(st, rooms))   # bw1
	check(String(S.step(st).t) == "sigil" and int(S.step(st).n) == 2, "흑풍 산채 = 부적 2단")
	take.call(S.check(st, rooms))
	check(String(S.step(st).t) == "sigil", "1단으로는 머묾")
	st.sigil_best = 3   # 한 번에 3단까지 깬 사람은 용궁 단계도 바로 넘어간다
	take.call(S.check(st, rooms))
	take.call(S.finish_talk(st, rooms))   # bw2
	take.call(S.finish_talk(st, rooms))   # pal1
	take.call(S.check(st, rooms))
	check(S.pending_scene(st) == "pal2", "부적 3단 → pal2")
	take.call(S.finish_talk(st, rooms))
	check((st.done as Array).size() == 10 and int(acc.gold) == 52600 and S.pending_scene(st) == "car1", "3막 끝 — 금 합 %d → 4막 car1" % int(acc.gold))

	# ②-4 4막
	take.call(S.finish_talk(st, rooms))
	check(String(S.step(st).t) == "wboss" and S.objective(st).contains("모래바다 폭군") and S.objective(st).contains("0/2"), "car1 → 월드 보스 둘 \"%s\"" % S.objective(st))
	st.wbosses = int(st.wbosses) + 1
	take.call(S.check(st, rooms))
	check(String(S.step(st).t) == "wboss", "월드 보스 하나로는 안 넘어감")
	st.wbosses = int(st.wbosses) + 1
	take.call(S.check(st, rooms))
	check(S.pending_scene(st) == "car2", "월드 보스 둘 → car2")
	take.call(S.finish_talk(st, rooms))
	check(int(acc.gold) == 67600 and S.pending_scene(st) == "snow1", "11장 끝(15000) → snow1")
	take.call(S.finish_talk(st, rooms))
	check(String(S.step(st).t) == "horde" and S.horde_wave(st) == 5 and S.objective(st).contains("파도 5"), "산성 거한 = 파도 5 \"%s\"" % S.objective(st))
	check(S.horde_wave(S.normalize({"ch": 4, "step": 1})) == S.HORDE_WAVE, "2막 난입은 그대로 파도 %d" % S.HORDE_WAVE)
	take.call(S.check(st, rooms))
	check(String(S.step(st).t) == "horde", "파도 3 셈 없이는 머묾")
	st.hordes = int(st.hordes) + 1   # 엔진은 파도 horde_wave 에 닿을 때만 센다
	take.call(S.check(st, rooms))
	check(S.pending_scene(st) == "snow2", "파도 5 → snow2")
	take.call(S.finish_talk(st, rooms))
	check(int(acc.gold) == 84600 and S.pending_scene(st) == "scr1", "12장 끝(17000) → scr1")
	take.call(S.finish_talk(st, rooms))
	check(String(S.step(st).t) == "elite" and S.objective(st).contains("정예 처치 0/5"), "scr1 → 정예 다섯 \"%s\"" % S.objective(st))
	st.elites = int(st.elites) + 4
	take.call(S.check(st, rooms))
	check(String(S.step(st).t) == "elite", "정예 넷으로는 머묾")
	st.elites = int(st.elites) + 1
	take.call(S.check(st, rooms))
	take.call(S.finish_talk(st, rooms))   # scr2
	check(int(acc.gold) == 104600 and S.pending_scene(st) == "hg1", "13장 끝(20000) → hg1")
	take.call(S.finish_talk(st, rooms))
	check(String(S.step(st).t) == "sigil" and S.objective(st).contains("부적 던전 4단"), "업화 대문 = 부적 4단")
	take.call(S.check(st, rooms))
	check(String(S.step(st).t) == "sigil", "부적 3단으로는 머묾")
	st.sigil_best = 4
	take.call(S.check(st, rooms))
	check(S.pending_scene(st) == "hg2", "부적 4단 → hg2")
	take.call(S.finish_talk(st, rooms))
	check(S.finished(st) and (st.done as Array).size() == 14 and int(acc.gold) == 129600 and S.objective(st) == "", "4막 끝 — 장 %d · 금 합 %d" % [(st.done as Array).size(), int(acc.gold)])
	var r2: Dictionary = S.normalize({"ch": 5, "step": 2, "done": [], "choices": {}})
	check(S.pending_scene(r2) == "fort2_restore", "답이 없으면 첫 갈래(restore)")

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
