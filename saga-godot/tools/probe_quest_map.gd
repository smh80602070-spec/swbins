extends Node
## GO 지도 임무 표식(PLAN 106장 ㊶, story_quest.map_marks · ui/world_map.gd) 자동 점검 — 평소엔 안 붙는다.
## test_village.gd 가 SAGA_QMAP_PROBE 가 있을 때만 단다.
##
##   SAGA_QMAP_PROBE=1 "$GODOT" --headless --path saga-godot res://games/saga_go/world/TestVillage.tscn
##
## ① 맡을 수 있는 세계 임무 셋 = 맡길 사람 자리의 ! (이야기는 다 끝난 셈) ② 신상 안 켠 지역의 ! 는 지도에서 빠짐
## ③ 맡으면 따라가는 ◆, 둘째를 맡으면 첫째는 ◇(그 단계 자리) ④ 안 따라가는 쫓기 단계는 길 첫 점
## ⑤ 이야기 임무 — 세계 임무를 따라가면 금빛 ◇, 이야기로 바꾸면 금빛 ◆ ⑥ 지도에서 ◇ 고르기 → 따라가기
## ⑦ ! 고르기 → 따라가기 막힘 · 가까운 켠 지점으로 순간이동 ⑧ 지도 누르기(_pick_at)가 표식을 고름.
## 저장은 안 한다(세계 임무·이야기·등급·EventState 는 끝에 되돌린다).

const WQ := preload("res://games/saga_go/data/world_quests.gd")
const Story := preload("res://games/saga_go/data/story.gd")
const Waypoints := preload("res://games/saga_go/world/waypoints.gd")

var _p: CharacterBody3D
var _sq: Node
var _map: Node
var _frame := 0
var _step := 0
var _fails := 0
var _saved := {}
var _v: Variant = null

func _ready() -> void:
	Weather.force("clear")
	_p = get_tree().get_first_node_in_group("player")

func _physics_process(_delta: float) -> void:
	_frame += 1
	if _sq == null or _map == null:
		_sq = get_tree().get_first_node_in_group("go_story")
		_map = get_tree().get_first_node_in_group("go_world_map")
		_frame = 0
		return
	match _step:
		0: # 준비
			if _frame == 1:
				_saved = {"wq": PartyState.world_quests.duplicate(true), "story": PartyState.story.duplicate(), "exp": PartyState.exp,
					"level": PartyState.level, "resolved": EventState.resolved.duplicate()}
				PartyState.world_quests = {}
				PartyState.story = {"ch": Story.CHAPTERS.size(), "step": 0}
				PartyState.exp = 12.0 * PartyState.EXP_PER_LEVEL + 1.0 # 모험 등급 13 — 세계 임무 셋 다 열림(레벨은 경험에서 다시 셈)
				PartyState.level = 12
				for id in ["v_statue", "c_dock", "r_statue"]:
					EventState.mark_resolved("wp_" + id)
				_sq.call("_enter_step")
			if _frame == 5:
				_next()
		1: # ① ! 셋
			var marks: Array = _sq.call("map_marks")
			var bad: Array = []
			for q in WQ.ORDER:
				var m := _find(marks, "wq_open", q)
				var giver := String(WQ.QUESTS[q].giver)
				if m.is_empty() or (m.pos as Vector3).distance_to(_sq.call("npc_pos", giver)) > 0.01:
					bad.append(q)
			_check("open_marks", marks.size() == 3 and bad.is_empty() and (_map.call("quest_marks") as Array).size() == 3, "n=%d bad=%s" % [marks.size(), bad])
			_next()
		2: # ② 구름 — 포구 신상을 끄면 등대 ! 가 지도에서 빠진다(목록 칸 map_marks 엔 그대로)
			EventState.resolved.erase("wp_c_dock")
			var qm: Array = _map.call("quest_marks")
			var hidden := _find(qm, "wq_open", "wq_lighthouse").is_empty() and not _find(qm, "wq_open", "wq_letters").is_empty()
			var raw := not _find(_sq.call("map_marks"), "wq_open", "wq_lighthouse").is_empty()
			EventState.mark_resolved("wp_c_dock")
			_check("fog_hides_open", hidden and raw, "hidden=%s raw=%s" % [hidden, raw])
			_next()
		3: # ③ 맡기 — 편지 ◆ → 등대를 맡으면 편지 ◇
			if _frame == 1:
				_sq.call("_wq_begin", "wq_letters")
			if _frame == 3:
				var m := _find(_sq.call("map_marks"), "wq_track", "wq_letters")
				_v = not m.is_empty() and (m.pos as Vector3).distance_to(_sq.call("npc_pos", "postmaster")) < 0.01
				_sq.call("_wq_begin", "wq_lighthouse")
			if _frame == 5:
				var marks: Array = _sq.call("map_marks")
				var idle := _find(marks, "wq_idle", "wq_letters")
				var tr := _find(marks, "wq_track", "wq_lighthouse")
				_check("track_and_idle", bool(_v) and not idle.is_empty() and not tr.is_empty() and not _find(marks, "wq_open", "wq_rift").is_empty() \
					and String(idle.text) == String(WQ.step_of("wq_letters", 0).text), "first=%s idle=%s track=%s" % [_v, not idle.is_empty(), not tr.is_empty()])
				_next()
		4: # ④ 안 따라가는 쫓기 — 길 첫 점
			PartyState.world_quests["steps"]["wq_letters"] = 2
			var s := WQ.step_of("wq_letters", 2)
			var want: Vector3 = _sq.call("_cell_pos", String(s.region), (s.path as Array)[0])
			var m := _find(_sq.call("map_marks"), "wq_idle", "wq_letters")
			_check("idle_chase_pos", not m.is_empty() and (m.pos as Vector3).distance_to(want) < 0.01, "m=%s" % [m.get("pos", "-")])
			_next()
		5: # ⑤ 이야기 — 세계 임무를 따라가는 동안 금빛 ◇, 바꾸면 ◆
			if _frame == 1:
				PartyState.story = {"ch": 0, "step": 0}
				_sq.call("_enter_step")
			if _frame == 3:
				var idle := _find(_sq.call("map_marks"), "story_idle", "")
				_v = not idle.is_empty() and String(idle.name) == String(Story.chapter(0).name)
				_sq.call("set_track", "")
			if _frame == 5:
				var marks: Array = _sq.call("map_marks")
				var st := _find(marks, "story", "")
				var ok: bool = bool(_v) and not st.is_empty() and (st.pos as Vector3).distance_to(_sq.call("target_pos")) < 0.01 \
					and not _find(marks, "wq_idle", "wq_lighthouse").is_empty() and _find(marks, "wq_track", "wq_lighthouse").is_empty()
				_check("story_marks", ok, "idle=%s story=%s" % [_v, not st.is_empty()])
				_next()
		6: # ⑥ 지도 화면에서 ◇ 고르기 → 따라가기
			if _frame == 1:
				_map.call("open_map")
			if _frame == 3:
				var picked: bool = _map.call("select_mark", "wq_idle", "wq_lighthouse")
				var btn: Button = _map.get("_track_button")
				var on := btn.visible and not btn.disabled
				var tracked: bool = _map.call("track_selected")
				var sel: Dictionary = _map.get("_selected_mark")
				_check("map_track", picked and on and tracked and String(_sq.call("track")) == "wq_lighthouse" and String(sel.get("kind", "")) == "wq_track" \
					and btn.disabled and bool(_map.get("is_open")), "picked=%s on=%s tracked=%s track=%s sel=%s dis=%s" % [picked, on, tracked, _sq.call("track"), sel.get("kind", "-"), btn.disabled])
				_next()
		7: # ⑦ ! 고르기 — 따라가기 막힘·가까운 지점으로 순간이동
			if _frame == 1:
				var picked: bool = _map.call("select_mark", "wq_open", "wq_rift")
				var btn: Button = _map.get("_track_button")
				var near: String = _map.call("nearest_active_point", _sq.call("npc_pos", "wq_byeori"))
				_v = near
				var warp: Button = _map.get("_warp_button")
				var ok: bool = picked and btn.disabled and not _map.call("track_selected") and near != "" and not warp.disabled
				var warped: bool = _map.call("warp_selected")
				var wp: Vector3 = get_tree().get_first_node_in_group("go_waypoints").call("world_pos_of", near)
				_check("open_warp", ok and warped and not bool(_map.get("is_open")) and _flat(_p.global_position, wp) < 4.0,
					"picked=%s near=%s warped=%s d=%.1f" % [picked, near, warped, _flat(_p.global_position, wp)])
				_next()
		8: # ⑧ 지도 누르기가 표식을 고른다
			if _frame == 1:
				_map.call("open_map")
			if _frame == 3:
				var m := _find(_sq.call("map_marks"), "wq_open", "wq_rift")
				_map.call("_pick_at", _map.call("world_to_px", m.pos))
				var sel: Dictionary = _map.get("_selected_mark")
				var label: Label = _map.get("_select_label")
				_check("pick_mark", String(sel.get("quest", "")) == "wq_rift" and String(_map.get("_selected")) == "" and label.text.contains(String(WQ.QUESTS.wq_rift.name)),
					"sel=%s label=%s" % [sel.get("quest", "-"), label.text.replace("\n", " / ")])
				_map.call("close_map")
				_next()
		9:
			PartyState.world_quests = _saved.wq
			PartyState.story = _saved.story
			PartyState.exp = _saved.exp
			PartyState.level = _saved.level
			EventState.resolved.assign(_saved.resolved)
			_sq.call("_enter_step")
			print("QMAP_PROBE_DONE fails=%d" % _fails)
			get_tree().quit()

func _find(marks: Array, kind: String, quest: String) -> Dictionary:
	for m in marks:
		if String(m.kind) == kind and String(m.quest) == quest:
			return m
	return {}

func _flat(a: Vector3, b: Vector3) -> float:
	return Vector2(a.x - b.x, a.z - b.z).length()

func _check(name: String, ok: bool, detail: String) -> void:
	if not ok:
		_fails += 1
	print("QMAP_PROBE %s %s %s" % ["ok  " if ok else "FAIL", name, detail])

func _next() -> void:
	_step += 1
	_frame = 0
