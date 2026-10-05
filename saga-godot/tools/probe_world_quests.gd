extends Node
## GO 세계 임무(106장 ㊴) 자동 점검 — 평소엔 안 붙는다. test_village.gd 가 SAGA_WQ_PROBE 가 있을 때만 단다.
##
##   SAGA_WQ_PROBE=1 "$GODOT" --headless --path saga-godot res://games/saga_go/world/TestVillage.tscn
##
## [0] 표(인물·단계 type·appear 칸) [1] 모험 등급 모자라면 "!" 없음·목록 "(모험 등급 3)" [2] 자리 여유(사건 원·나무 줄기·이야기 인물)
## [3] 묵호 → 맡음·따라감·목표 = 다래 [4] 다래 → 둥실이(코드 몸·가면 없음) 쫓기 [5] 따라잡기 → 둥실이가 선다 [6] 둥실이 → 둥지 셋
## [7] 따라가는 임무 바꾸기(이야기 ↔ 세계, 임무 적 다시 세움)·목록 단추 둘·세계 임무 중 이야기 인물과 대화하면 이야기로 [8] 둥지 → 묵호 → 끝·보상
## [9] 등대 — 물결 → 옛 등대 터 → 한빛 → 무리 → 봉수 → 물결 [10] 시간 틈 — 별이 → 괴물 → 별이 → 돌쇠 → 석등 달→해→별 → 지키기 → 돌쇠 → 별이
## [11] 다 끝남 — "!" 없음·목록 ✔ 셋·돌쇠·한빛 사라짐.
## 저장은 안 한다(메모리에서 바꾸고 끝에 되돌린다).

const WQ := preload("res://games/saga_go/data/world_quests.gd")
const Story := preload("res://games/saga_go/data/story.gd")
const FieldEnemy := preload("res://games/saga_go/combat/field_enemy.gd")
const TestMap := preload("res://games/saga_go/data/test_map.gd")
const Veg := preload("res://games/saga_go/world/vegetation_builder.gd")

var _p: CharacterBody3D
var _sq: Node
var _frame := 0
var _step := 0
var _fails := 0
var _v: Variant = null
var _saved := {}

func _ready() -> void:
	Weather.force("clear")
	_p = get_tree().get_first_node_in_group("player")

func _physics_process(_delta: float) -> void:
	_frame += 1
	if _sq == null:
		_sq = get_tree().get_first_node_in_group("go_story")
		_frame = 0
		return
	if _step > 0 and _frame % 2 == 0:
		_dismiss_prompts() # 레벨업 승급 3택 같은 창은 사람처럼 뜨는 대로 닫는다
	match _step:
		0: # 준비 + [0] 표
			if _frame == 1:
				_saved = {"wq": PartyState.world_quests.duplicate(true), "story": PartyState.story.duplicate(), "exp": PartyState.exp, "level": PartyState.level}
				PartyState.world_quests = {}
				PartyState.story = {"ch": Story.CHAPTERS.size(), "step": 0} # 이야기는 다 끝난 셈(이야기 인물 대화가 섞이지 않게)
				PartyState.exp = 100.0 # 모험 등급 2
				PartyState.level = 1
				_sq.call("_enter_step")
			if _frame == 3:
				var ok := WQ.ORDER.size() == 3
				for q in WQ.ORDER:
					var d: Dictionary = WQ.QUESTS[q]
					ok = ok and WQ.NPCS.has(String(d.giver)) and String(WQ.step_of(q, 0).get("npc", "")) == String(d.giver)
					for s in d.steps:
						match String(s.type):
							"talk": ok = ok and WQ.NPCS.has(String(s.npc)) and (s.lines as Array).size() > 0
							"go", "kill", "light", "seal", "defend": ok = ok and s.has("region") and s.has("cell")
							"chase": ok = ok and (s.path as Array).size() >= 2
							_: ok = false
				for id in WQ.NPCS:
					ok = ok and not Story.NPCS.has(id) and String(WQ.NPCS[id].get("era", "")) in ["과거", "현대", "미래"]
					for w in WQ.NPCS[id].get("appear", []):
						ok = ok and WQ.QUESTS.has(String(w.wq))
				## 퓨전 — 임무마다 세 시대 인물이 다 나온다
				for q in WQ.ORDER:
					var eras := {}
					for s in WQ.QUESTS[q].steps:
						if String(s.type) == "talk":
							eras[String(WQ.NPCS[String(s.npc)].era)] = true
					## 대화 상대가 아닌 시대는 이야기 속 인물(편지 도장·봉수 불씨 등)로 — 적어도 둘은 인물로
					ok = ok and eras.size() >= 2
				_check("table", ok, "quests=%d npcs=%d" % [WQ.ORDER.size(), WQ.NPCS.size()])
				_next()
		1: # [1] 모험 등급 2 — 아직 못 맡음
			if _frame == 70:
				_sq.call("toggle_journal")
				var wt: String = (_sq.get("_wq_label") as Label).text
				_sq.call("toggle_journal")
				var ok: bool = not _mark("postmaster") and not bool(_sq.call("wq_open", "wq_letters")) and wt.contains("(모험 등급 3)")
				_check("locked", ok, "mark=%s open=%s journal='%s'" % [_mark("postmaster"), _sq.call("wq_open", "wq_letters"), wt.replace("\n", " / ")])
				PartyState.exp = 1500.0 # 모험 등급 16 — 셋 다 열림
				PartyState.level = 15
				_next()
		2: # [2] 자리 여유
			if _frame == 70:
				var spots := _spots()
				var ev := _event_clear(spots)
				var tr := _trunk_clear(spots)
				var npc := _story_npc_clear(spots)
				var marks: bool = _mark("postmaster") and _mark("researcher") and _mark("wq_byeori") and not _mark("rider")
				_check("spots", float(ev[0]) > 2.0 and float(tr[0]) > 1.2 and float(npc[0]) > 6.0 and marks,
					"event=%.1f@%s trunk=%.1f@%s story_npc=%.1f@%s marks=%s" % [ev[0], ev[1], tr[0], tr[1], npc[0], npc[1], marks])
				_next()
		3: # [3] 묵호 → 맡음
			if _frame == 1:
				_near("postmaster")
			if _frame == 10:
				var opened: bool = _talk()
				_drain()
				var ok: bool = opened and _sq.call("track") == "wq_letters" and int(_sq.call("wq_step", "wq_letters")) == 1 \
					and (_sq.call("target_pos") as Vector3).is_equal_approx(_sq.call("npc_pos", "rider")) and bool(_sq.call("npc_visible", "rider")) \
					and String(_sq.call("tracker_text")).begins_with("◇ 바람에 흩어진 편지") and not _mark("postmaster")
				_check("letters_accept", ok, "opened=%s track=%s st=%d tracker='%s'" % [opened, _sq.call("track"), _sq.call("wq_step", "wq_letters"), String(_sq.call("tracker_text")).replace("\n", " / ")])
				_next()
		4: # [4] 다래 → 둥실이 쫓기(코드 몸)
			if _frame == 1:
				_near("rider")
			if _frame == 10:
				_talk()
				_drain()
			if _frame == 30:
				var th: Node3D = _sq.get("_thief")
				var ok: bool = int(_sq.call("wq_step", "wq_letters")) == 2 and th != null and th.find_children("Mask", "Node3D", true, false).is_empty() \
					and th.find_children("*", "Skeleton3D", true, false).is_empty() and bool((_sq.call("chase_state") as Dictionary).run)
				_check("letters_chase_start", ok, "st=%d thief=%s run=%s" % [_sq.call("wq_step", "wq_letters"), th != null, (_sq.call("chase_state") as Dictionary).run])
				_next()
		5: # [5] 따라잡기
			if _frame == 1:
				_put((_sq.call("chase_state") as Dictionary).pos + Vector3(0.0, 0.5, 1.0))
			if _frame == 10:
				var ok: bool = int(_sq.call("wq_step", "wq_letters")) == 3 and _sq.get("_thief") == null and bool(_sq.call("npc_visible", "dungsil")) \
					and (_sq.call("target_pos") as Vector3).is_equal_approx(_sq.call("npc_pos", "dungsil"))
				_check("letters_caught", ok, "st=%d dungsil=%s" % [_sq.call("wq_step", "wq_letters"), _sq.call("npc_visible", "dungsil")])
				_next()
		6: # [6] 둥실이 → 둥지 셋
			if _frame == 1:
				_near("dungsil")
			if _frame == 10:
				_talk()
				_drain()
			if _frame == 14:
				var es: Array = _sq.call("alive_quest_enemies")
				var ok: bool = int(_sq.call("wq_step", "wq_letters")) == 4 and es.size() == 3 and not bool(_sq.call("npc_visible", "dungsil")) and not bool(_sq.call("npc_visible", "rider"))
				_check("letters_nest", ok, "st=%d enemies=%d" % [_sq.call("wq_step", "wq_letters"), es.size()])
				_next()
		7: # [7] 따라가기 바꾸기 · 이야기 인물과 대화하면 이야기로
			if _frame == 1:
				_v = {}
				PartyState.story = {} # 이야기 1장 1단계(촌장 대화)
				_sq.call("set_track", "")
				_v.story_tracker = String(_sq.call("tracker_text")).begins_with("◆ 제1장")
				_v.enemies_gone = (_sq.call("alive_quest_enemies") as Array).is_empty()
				_v.story_target = (_sq.call("target_pos") as Vector3).is_equal_approx(_sq.call("npc_pos", "elder"))
				_sq.call("toggle_journal")
				_v.buttons = (_sq.get("_track_box") as Node).get_child_count()
				_sq.call("toggle_journal")
				_sq.call("set_track", "wq_letters")
				_v.back = (_sq.call("alive_quest_enemies") as Array).size() == 3 and String(_sq.call("tracker_text")).begins_with("◇")
				_near("elder")
			if _frame == 10:
				_talk() # 세계 임무를 따라가는 중에 이야기 인물 — 이야기로 넘어가 대화가 이어진다
				_drain()
				_v.story_talk = int(_sq.call("st")) == 1 and _sq.call("track") == "" and int(_sq.call("wq_step", "wq_letters")) == 4
				PartyState.story = {"ch": Story.CHAPTERS.size(), "step": 0}
				_sq.call("set_track", "wq_letters")
			if _frame == 16:
				var ok: bool = bool(_v.story_tracker) and bool(_v.enemies_gone) and bool(_v.story_target) and int(_v.buttons) == 2 and bool(_v.back) and bool(_v.story_talk) \
					and (_sq.call("alive_quest_enemies") as Array).size() == 3
				_check("track_switch", ok, "%s" % [_v])
				_next()
		8: # [8] 둥지 → 묵호 → 끝
			if _frame == 1:
				for e in _sq.call("alive_quest_enemies"):
					e.call("_die")
			if _frame == 8:
				_v = {"st": int(_sq.call("wq_step", "wq_letters")), "knots": PartyState.count("fate_knot"), "mora": PartyState.count("mora")}
				_near("postmaster")
			if _frame == 16:
				_talk()
				_drain()
			if _frame == 22:
				_dismiss_prompts()
				var ok: bool = int(_v.st) == 5 and bool(_sq.call("wq_done", "wq_letters")) and _sq.call("track") == "" and int(_sq.call("wq_step", "wq_letters")) == -1 \
					and PartyState.count("fate_knot") >= int(_v.knots) + 1 and PartyState.count("mora") >= int(_v.mora) + 12000 and not _mark("postmaster")
				_check("letters_done", ok, "st_before=%d done=%s knots %d→%d mora %d→%d" % [_v.st, _sq.call("wq_done", "wq_letters"), _v.knots, PartyState.count("fate_knot"), _v.mora, PartyState.count("mora")])
				_next()
		9: # [9] 세 시절의 등대
			var q := "wq_lighthouse"
			if _frame == 1:
				_near("researcher")
			if _frame == 10:
				_talk()
				_drain()
				_v = {"s1": int(_sq.call("wq_step", q)), "hanbit_before": bool(_sq.call("npc_visible", "hanbit"))}
				_put(_cell(WQ.step_of(q, 1)))
			if _frame == 20:
				_v.s2 = int(_sq.call("wq_step", q))
				_v.hanbit = bool(_sq.call("npc_visible", "hanbit"))
				_near("hanbit")
			if _frame == 30:
				_talk()
				_drain()
			if _frame == 36:
				var es: Array = _sq.call("alive_quest_enemies")
				_v.kill_n = es.size()
				for e in es:
					e.call("_die")
			if _frame == 44:
				_v.s4 = int(_sq.call("wq_step", q))
				var alt: Node3D = _sq.get("_altar")
				_v.altar = alt != null
				if alt:
					_sq.call("receive_element", alt.global_position, 1.0, "fire")
				## 불 켠 직후(0.8초 안) 이야기로 바꿔도 — 이야기도 이 임무도 저절로 넘어가면 안 된다
				_v.story_before = PartyState.story.duplicate()
				_sq.call("set_track", "")
			if _frame == 100:
				_v.guard = int(_sq.call("wq_step", q)) == 4 and PartyState.story == _v.story_before
				_sq.call("set_track", q) # 다시 따라가면 제단부터(불은 저장 안 함)
				var alt2: Node3D = _sq.get("_altar")
				if alt2:
					_sq.call("receive_element", alt2.global_position, 1.0, "fire")
			if _frame == 170:
				_v.s5 = int(_sq.call("wq_step", q))
				_near("researcher")
			if _frame == 180:
				_talk()
				_drain()
			if _frame == 186:
				_dismiss_prompts()
				var ok: bool = int(_v.s1) == 1 and not bool(_v.hanbit_before) and int(_v.s2) == 2 and bool(_v.hanbit) and int(_v.kill_n) == 3 and int(_v.s4) == 4 \
					and bool(_v.altar) and bool(_v.guard) and int(_v.s5) == 5 and bool(_sq.call("wq_done", q)) and not bool(_sq.call("npc_visible", "hanbit"))
				_check("lighthouse", ok, "%s done=%s" % [_v, _sq.call("wq_done", q)])
				_next()
		10: # [10] 폐허의 시간 틈
			var q := "wq_rift"
			if _frame == 1:
				_v = {}
				_near("wq_byeori")
			if _frame == 10:
				_talk()
				_drain()
				_v.kill_n = (_sq.call("alive_quest_enemies") as Array).size()
				for e in _sq.call("alive_quest_enemies"):
					e.call("_die")
			if _frame == 18:
				_v.s2 = int(_sq.call("wq_step", q))
				_near("wq_byeori")
			if _frame == 26:
				_talk()
				_drain()
				_v.dolsoe = bool(_sq.call("npc_visible", "dolsoe"))
				_near("dolsoe")
			if _frame == 34:
				_talk()
				_drain()
				_v.s4 = int(_sq.call("wq_step", q))
			if _frame == 40:
				_sq.call("receive_element", _sq.call("seal_lamp_pos", "sun"), 0.5, "fire") # 틀린 차례 — 다 꺼짐
				_v.wrong = int(_sq.call("seal_lit")) == 0
				for m in ["moon", "sun", "star"]:
					_sq.call("receive_element", _sq.call("seal_lamp_pos", m), 0.5, "fire")
			if _frame == 100:
				_v.s5 = int(_sq.call("wq_step", q))
				_put(_cell(WQ.step_of(q, 5)) + Vector3(3.0, 0.0, 0.0))
			if _frame > 110 and _frame < 400 and _frame % 10 == 0 and int(_sq.call("wq_step", q)) == 5:
				for e in _sq.call("alive_quest_enemies"):
					e.call("_die")
			if _frame == 400:
				_v.s6 = int(_sq.call("wq_step", q))
				_near("dolsoe")
			if _frame == 410:
				_talk()
				_drain()
				_near("wq_byeori")
			if _frame == 420:
				_talk()
				_drain()
			if _frame == 426:
				_dismiss_prompts()
				var ok: bool = int(_v.kill_n) == 3 and int(_v.s2) == 2 and bool(_v.dolsoe) and int(_v.s4) == 4 and bool(_v.wrong) and int(_v.s5) == 5 and int(_v.s6) == 6 \
					and bool(_sq.call("wq_done", q)) and not bool(_sq.call("npc_visible", "dolsoe"))
				_check("rift", ok, "%s done=%s" % [_v, _sq.call("wq_done", q)])
				_next()
		11: # [11] 다 끝남
			if _frame == 70:
				_sq.call("toggle_journal")
				var wt: String = (_sq.get("_wq_label") as Label).text
				_sq.call("toggle_journal")
				var ok: bool = not _mark("postmaster") and not _mark("researcher") and not _mark("wq_byeori") and wt.count("✔") == 3 and _sq.call("track") == ""
				_check("all_done", ok, "journal='%s'" % wt.replace("\n", " / "))
				_next()
		12:
			PartyState.world_quests = _saved.wq
			PartyState.story = _saved.story
			PartyState.exp = _saved.exp
			PartyState.level = _saved.level
			print("WQ_PROBE_DONE fails=%d" % _fails)
			get_tree().quit()

func _mark(id: String) -> bool:
	var m := ((_sq.get("_npcs") as Dictionary)[id] as Node3D).get_node_or_null("QuestMark") as Label3D
	return m != null and m.visible

func _cell(s: Dictionary) -> Vector3:
	var p := TestMap.world_pos(s.cell.x, s.cell.y, String(s.region))
	p.y = preload("res://games/saga_go/world/terrain_builder.gd").height_at(String(s.region), p) + 0.5
	return p

## 임무 인물 집 자리·단계 자리·석등·쫓기 길 점 전부 [이름 → 월드 좌표, 지역].
func _spots() -> Dictionary:
	var spots := {}
	for id in WQ.NPCS:
		var n: Dictionary = WQ.NPCS[id]
		spots["npc_" + id] = [TestMap.world_pos(n.cell.x, n.cell.y, String(n.region)), String(n.region)]
	for q in WQ.ORDER:
		var steps: Array = WQ.QUESTS[q].steps
		for i in steps.size():
			var s: Dictionary = steps[i]
			if s.has("cell"):
				var c := TestMap.world_pos(s.cell.x, s.cell.y, String(s.region))
				spots["%s_%d" % [q, i]] = [c, String(s.region)]
				if String(s.type) == "seal":
					for k in Story.SEAL_LAYOUT.size():
						var a := TAU * float(k) / float(Story.SEAL_LAYOUT.size())
						spots["%s_%d_lamp%d" % [q, i, k]] = [c + Vector3(sin(a), 0.0, -cos(a)) * Story.SEAL_RING, String(s.region)]
			if String(s.type) == "defend": # 물결이 나오는 둘레(story_quest _spawn_wave 와 같은 각)
				var c := TestMap.world_pos(s.cell.x, s.cell.y, String(s.region))
				for w in (s.waves as Array).size():
					var n: int = (s.waves[w] as Array).size()
					for k in n:
						var a := TAU * float(k) / float(n) + 0.9 * w
						spots["%s_%d_wave%d_%d" % [q, i, w, k]] = [c + Vector3(cos(a), 0.0, sin(a)) * Story.DEFEND_RING, String(s.region)]
			if s.has("path"):
				for k in (s.path as Array).size():
					spots["%s_%d_path%d" % [q, i, k]] = [TestMap.world_pos(s.path[k].x, s.path[k].y, String(s.region)), String(s.region)]
	return spots

## 선택 창을 띄우는 사건 원(신수·역사 인물·봉수대·사건·도적·사당·포구·폐허 사건)과의 여유 [m, 어디].
func _event_clear(spots: Dictionary) -> Array:
	var best := 1e9
	var where := ""
	var scripts := ["pet_encounter.gd", "hero_encounter.gd", "beacon_tower.gd", "simple_event.gd", "bandit_encounter.gd", "shrine_trial.gd"]
	for n in get_tree().current_scene.find_children("*", "Node3D", true, false):
		var sc: Script = n.get_script()
		if sc == null or not scripts.any(func(x: String) -> bool: return sc.resource_path.ends_with(x)):
			continue
		var r := float(n.get("TRIGGER_RADIUS")) if n.get("TRIGGER_RADIUS") != null else 10.0
		for k in spots:
			var m := _flat((n as Node3D).global_position, spots[k][0]) - r - 3.0
			if m < best:
				best = m
				where = "%s~%s" % [k, n.name]
	const Coast := preload("res://games/saga_go/world/region2_coast.gd")
	const Ruins := preload("res://games/saga_go/world/region3_ruins.gd")
	var evs := {"fisher": ["coast", Coast.FISHER_GRID, Coast.FISHER_TALK_RADIUS], "driftwood": ["coast", Coast.DRIFTWOOD_GRID, Coast.DRIFTWOOD_TRIGGER_RADIUS],
		"boat": ["coast", Coast.BOAT_GRID, Coast.BOAT_TRIGGER_RADIUS], "relic": ["ruins", Ruins.RELIC_GRID, Ruins.RELIC_TRIGGER_RADIUS]}
	for e in evs:
		var g: Vector2i = evs[e][1]
		var ep := TestMap.world_pos(g.x, g.y, String(evs[e][0]))
		for k in spots:
			var m := _flat(ep, spots[k][0]) - float(evs[e][2]) - 3.0
			if m < best:
				best = m
				where = "%s~%s" % [k, e]
	return [best, where]

## 마을 숲 나무 줄기(vegetation_builder 해시)와의 거리 [m, 어디] — 인물·석등이 줄기에 묻히지 않게.
func _trunk_clear(spots: Dictionary) -> Array:
	var best := 1e9
	var where := ""
	for region in ["village", "ruins"]:
		var rows := TestMap.rows_of(region)
		for y in rows.size():
			for x in String(rows[y]).length():
				if String(rows[y])[x] != "T":
					continue
				for i in Veg.TREES_PER_FOREST_TILE:
					var jx := (Veg._hash(x, y, i * 2) - 0.5) * TestMap.TILE_SIZE * 0.8
					var jz := (Veg._hash(x, y, i * 2 + 1) - 0.5) * TestMap.TILE_SIZE * 0.8
					var tp := TestMap.world_pos(x, y, region) + Vector3(jx, 0.0, jz)
					for k in spots:
						if String(spots[k][1]) != region:
							continue
						var d := _flat(tp, spots[k][0])
						if d < best:
							best = d
							where = k
	return [best, where]

## 이야기 인물(집 자리·옮겨 서는 칸)과의 거리 — 3m 대화 거리가 겹치지 않게.
func _story_npc_clear(spots: Dictionary) -> Array:
	var best := 1e9
	var where := ""
	var pts := {}
	for id in Story.NPCS:
		var n: Dictionary = Story.NPCS[id]
		pts[id] = TestMap.world_pos(n.cell.x, n.cell.y, String(n.region))
		for w in Story.windows(n.get("appear")) + Story.windows(Story.STATIONS.get(id)):
			if (w as Dictionary).has("cell") and not bool(w.get("sky", false)):
				pts["%s@%d_%d" % [id, w.ch, w.from]] = TestMap.world_pos(w.cell.x, w.cell.y, String(w.region))
	for a in pts:
		for k in spots:
			if not String(k).begins_with("npc_"):
				continue
			var d := _flat(pts[a], spots[k][0])
			if d < best:
				best = d
				where = "%s~%s" % [k, a]
	return [best, where]

func _dismiss_prompts() -> void:
	for n in get_tree().get_nodes_in_group("ui_modal"):
		## 같은 창이 다시 뜰 수 있다(레벨업 승급 3택) — 보일 때마다 누른다.
		if n == _sq or n.get("visible") == false:
			continue
		var btns := (n as Node).find_children("*", "Button", true, false)
		if not btns.is_empty():
			(btns[0] as Button).pressed.emit()

func _drain() -> int:
	var choices := 0
	var guard := 0
	while _sq.call("is_dialogue_open") and guard < 50:
		guard += 1
		if _sq.get("_dlg_waiting_choice"):
			_sq.call("choose", 0)
			choices += 1
		else:
			_sq.call("next_line")
	return choices

## 창(승급 3택 등)을 닫고 말 걸기.
func _talk() -> bool:
	_dismiss_prompts()
	return bool(_sq.call("interact"))

func _flat(a: Vector3, b: Vector3) -> float:
	return Vector2(a.x - b.x, a.z - b.z).length()

func _near(id: String) -> void:
	_dismiss_prompts()
	_put(_sq.call("npc_pos", id) + Vector3(0.0, 0.3, 1.5))

func _put(pos: Vector3) -> void:
	_p.global_position = pos + Vector3(0.0, 0.3, 0.0)
	_p.velocity = Vector3.ZERO

func _check(name: String, ok: bool, detail: String) -> void:
	if not ok:
		_fails += 1
	print("WQ_PROBE %s %s %s" % [name, "ok" if ok else "FAIL", detail])

func _next() -> void:
	_step += 1
	_frame = 0
