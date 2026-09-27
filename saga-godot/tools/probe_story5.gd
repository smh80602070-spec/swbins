extends Node
## GO 이야기 5부(PLAN 106장 ㊾, 19장~) 자동 점검 — 평소엔 안 붙는다. 4부 probe_story4.
## test_village.gd 가 SAGA_STORY5_PROBE 가 있을 때만 단다.
##
##   SAGA_STORY5_PROBE=1 "$GODOT" --headless --path saga-godot res://games/saga_go/world/TestVillage.tscn
##
## 19장 "틈 너머 첫 정거장"(㊾-2): [1] 표·자리(선장 모자·선장은 7단계 전엔 안 보임·시계 멈춤·오르기 above = 윗면 + 2·반디 은하역·
## 대결 둘레 평탄·파수꾼 풍·암이 방패를 깸·자리가 명소에 안 묻힘) [2] 도담 → 막차 [3] 막차 타기(첫 정거장에 내림)
## [4] 반디(첫 정거장) → 갈림목 [5] 무리 넷 [6] 시계탑 옆면을 실제로 타고 올라 꼭대기 → 바늘이 돈다 [7] 반디(시계탑 발치) → 섬돌
## [8] 섬돌 꼭대기(선장이 꼭대기 높이에 섬) [9] 선장 → 대결 [10] 파수꾼(고리 예고) [11] 선장 → 19장 끝·보상·✔ 제19장 ·
## 선장은 첫 정거장 곁·반디는 은하 나루 착륙판 곁(ch_to 자리).
## 20장 "갈림길 끝"(㊾-3, world/rift_end.gd 떠 있는 섬): [12] 표·자리(섬 높이·단계 칸이 섬 안·섬 위 자리가 닻·난간에 안 묻힘·틈 열림·
## 바람 기둥·별까마귀 빙·불이 방패를 깸·동료 한별 풍·활) [13] 선장 → 막차 [14] 막차 타기(섬 위에 내림) [15] 반디(섬 위) → 한가운데
## [16] 무리 다섯이 섬 위에 [17] 선장(섬 위) → 매듭 [18] 매듭 석등이 섬 높이에·차례(틀리면 꺼짐) → 닻이 켜지고 틈이 오므라듦
## [19] 선장 → 지키기 [20] 매듭 제단 지키기(물결 셋이 섬 위에서) [21] 선장 → 대결 [22] 별까마귀(섬 위, 고리 예고)
## [23] 선장 → 20장 끝·✔ 제20장·동료 한별·틈 닫힘(고요한 별빛)·선장은 은하 나루 별배 곁(㊿-2 21장 처음 자리) [24] 바람 기둥 — 공중이면 솟아 섬 윗면 위로.
## 이야기 상태·부대 경험·가방은 끝에 되돌린다. 저장은 안 한다.

const Story := preload("res://games/saga_go/data/story.gd")
const TestMap := preload("res://games/saga_go/data/test_map.gd")
const TerrainBuilder := preload("res://games/saga_go/world/terrain_builder.gd")
const Crossing := preload("res://games/saga_go/world/region6_crossing.gd")
const FieldEnemy := preload("res://games/saga_go/combat/field_enemy.gd")
const Elements := preload("res://games/saga_go/combat/elements.gd")
const RiftEnd := preload("res://games/saga_go/world/rift_end.gd")
const Kits := preload("res://games/saga_go/data/kits.gd")

const CH19 := 18 # 19장(0부터)
const CH20 := 19
const R := "crossing"

var _p: CharacterBody3D
var _sq: Node
var _frame := 0
var _step := 0
var _fails := 0
var _v: Variant = null
var _saved := {}

func _ready() -> void:
	Weather.force("clear")
	_p = get_tree().get_first_node_in_group("player") as CharacterBody3D

func _physics_process(_delta: float) -> void:
	_frame += 1
	if _sq == null:
		_sq = get_tree().get_first_node_in_group("go_story")
		_frame = 0
		return
	if _frame < 3 and _step == 0:
		return
	match _step:
		0: # 준비 — 19장 처음, 모험 등급 45
			_saved = {"story": PartyState.story.duplicate(true), "members": PartyState.members.duplicate(), "exp": PartyState.exp, "level": PartyState.level,
				"bag": PartyState.bag.duplicate(true), "ar_paid": PartyState.ar_paid, "resolved": EventState.resolved.duplicate(), "pos": _p.global_position, "wq": PartyState.world_quests.duplicate(true)}
			PartyState.exp = maxf(PartyState.exp, 45.0 * PartyState.EXP_PER_LEVEL)
			PartyState.level = maxi(PartyState.level, 45)
			PartyState.ar_paid = maxi(PartyState.ar_paid, PartyState.level + 1)
			PartyState.story = {"ch": CH19, "step": 0}
			_sq.call("set_track", "")
			_sq.call("_enter_step")
			_next()
		1: # [1] 표·자리
			if _frame < 70: # 문·시계는 1초마다 본다
				return
			var c := Story.chapter(CH19)
			var bad: Array = []
			if String(c.get("id", "")) != "ch19" or int(c.ar) <= int(Story.chapter(CH19 - 1).ar) or int(_sq.call("ch")) != CH19 or bool(_sq.call("locked")):
				bad.append("chapter ch=%d locked=%s" % [_sq.call("ch"), _sq.call("locked")])
			var info: Dictionary = Story.NPCS.hanbyeol
			if String(info.region) != R or String(info.get("era", "")) != "미래" or not bool(info.get("captain_hat", false)):
				bad.append("hanbyeol info")
			var hb := _sq.find_child("StoryNpc_hanbyeol", true, false)
			if hb == null or hb.find_child("Hat", true, false) == null or bool(_sq.call("npc_visible", "hanbyeol")):
				bad.append("hanbyeol body/visible")
			for s in c.steps:
				if s.has("cell") and ["~", "^"].has(TestMap.tile_at(roundi(s.cell.x), roundi(s.cell.y), String(s.region))):
					bad.append("step on %s" % TestMap.tile_at(roundi(s.cell.x), roundi(s.cell.y), String(s.region)))
			## 오르기 — 시계탑·섬돌 윗면 + CLIMB_SLACK - 0.5, 칸이 그 명소 자리.
			var steps: Array = c.steps
			var clock: Dictionary = steps[4]
			var stones: Dictionary = steps[6]
			if String(clock.type) != "climb" or absf(float(clock.above) - (Crossing.CLOCK_H + Story.CLIMB_SLACK - 0.5)) > 0.01 \
				or _flat(_cell3(clock.cell), Crossing.clock_top()) > 0.5:
				bad.append("clock climb")
			if String(stones.type) != "climb" or absf(float(stones.above) - (Crossing.TOP_H + 0.3 + Story.CLIMB_SLACK - 0.5)) > 0.01 \
				or _flat(_cell3(stones.cell), Crossing.stones_top()) > 0.5:
				bad.append("stones climb")
			## 막차 내리는 자리·반디·도담·선장 자리가 명소에 안 묻힘.
			var sail: Dictionary = steps[1]
			var spots: Array = [_cell3(sail.to.cell)]
			for w in Story.windows(Story.STATIONS.bandi).filter(func(w: Dictionary) -> bool: return int(w.ch) >= CH19) + Story.windows(Story.STATIONS.dodam) + Story.windows(info.appear):
				if not w.has("lift"):
					spots.append(_cell_any(String(w.region), w.cell))
			for sp in spots:
				if not _hits(sp).is_empty():
					bad.append("buried %s %s" % [sp, _hits(sp)])
			var bw: Array = Story.windows(Story.STATIONS.bandi).filter(func(w: Dictionary) -> bool: return int(w.ch) == CH19)
			if bw.is_empty() or String(bw[0].region) != "skyport" or _flat(_sq.call("npc_pos", "bandi"), _cell_any("skyport", bw[0].cell)) > 1.0:
				bad.append("bandi at station")
			## 대결 둘레 8m 가 가운데와 1.5m 안.
			var duel: Dictionary = steps[8]
			var dc := _cell3(duel.cell)
			for k in 8:
				var q := dc + Vector3(cos(TAU * k / 8.0), 0.0, sin(TAU * k / 8.0)) * 8.0
				if absf(TerrainBuilder.height_at(R, q) - dc.y) > 1.5:
					bad.append("duel edge %d" % k)
			if String(duel.kind) != "time_warden" or String(FieldEnemy.KINDS.time_warden.element) != "wind" or Elements.shield_mul("wind", "rock") <= 1.0:
				bad.append("duel kind")
			var cr := get_tree().get_first_node_in_group("go_crossing_region")
			if not bool(cr.call("is_gate_open")) or bool(cr.call("is_clock_running")):
				bad.append("gate=%s clock=%s" % [cr.call("is_gate_open"), cr.call("is_clock_running")])
			_check("ch19_table", bad.is_empty(), str(bad))
			_next()
		2: # [2] 도담 → 막차
			_talk("dodam", 1, "ch19_dodam", Vector2.INF)
		3: # [3] 막차 타기 — 도담에게 F → 첫 정거장
			if _frame == 1:
				_near_npc("dodam")
			if _frame == 10:
				_sq.call("interact")
				_drain()
			if _frame == 20:
				var here := TestMap.region_at(_p.global_position)
				var ok: bool = int(_sq.call("st")) == 2 and here == R and _flat(_p.global_position, _cell3(Vector2(4.8, 2.0))) < 1.5
				_check("ch19_sail", ok, "st=%d region=%s pos=%s" % [_sq.call("st"), here, _p.global_position])
				_next()
		4: # [4] 반디(첫 정거장) → 갈림목
			if _frame == 1:
				_v = _flat(_sq.call("npc_pos", "bandi"), _cell3(Vector2(4.75, 2.4)))
			_talk("bandi", 3, "ch19_bandi", Vector2(5.0, 4.5), "bandi_at_stop=%.1f" % float(_v), float(_v) < 1.0, 1)
		5: # [5] 무리 넷
			if _frame == 1:
				_put(_target() + Vector3(0, 0, 6))
			if _frame == 10:
				var es: Array = _sq.call("alive_quest_enemies")
				var here := es.filter(func(e: Node) -> bool: return TestMap.region_at((e as Node3D).global_position) == R).size()
				_v = {"n": es.size(), "here": here}
				for e in es:
					e.call("_die")
			if _frame == 16:
				_check("ch19_kill", int(_v.n) == 4 and int(_v.here) == 4 and int(_sq.call("st")) == 4, "n=%d here=%d st=%d" % [_v.n, _v.here, _sq.call("st")])
				_next()
		6: # [6] 시계탑 — 땅에선 안 넘어가고, 동쪽 옆면을 실제로 타고 올라 꼭대기에 서면 넘어간다 → 바늘이 돈다
			var c := Crossing.cell_pos(Crossing.CLOCK_CELL)
			if _frame == 1:
				_put(c + Vector3(5.0, 0.0, 2.0))
			if _frame == 12:
				_v = {"ground_st": int(_sq.call("st")), "grab": false}
				_p.set("stamina", 999.0)
				_put(c + Vector3(2.0 + 1.5, 0.0, 0.0))
			if _frame >= 12:
				var rig := get_tree().get_first_node_in_group("camera_rig") as Node3D
				if rig:
					rig.global_rotation = Vector3(rig.global_rotation.x, 0.0, 0.0)
			if _frame == 30:
				Input.action_press("move_left")
			if _frame > 30 and not bool(_v.grab) and _p.mode == _p.Mode.CLIMB:
				_v.grab = true
				Input.action_release("move_left")
				Input.action_press("move_forward")
			if _frame > 30 and int(_sq.call("st")) == 5 and not _v.has("at"):
				_v.at = _frame
			var settled: bool = _v is Dictionary and _v.has("at") and ((_p.mode == _p.Mode.GROUND and _p.is_on_floor()) or _frame > int(_v.at) + 240)
			if _frame > 30 and (settled or _frame > 1500):
				Input.action_release("move_forward")
				if not _v.has("stood"):
					_v.stood = {"y": _p.global_position.y, "mode": _p.mode, "st": int(_sq.call("st"))}
					_v.stood_at = _frame
					_v.a0 = float(get_tree().get_first_node_in_group("go_crossing_region").call("minute_angle"))
				if _frame < int(_v.stood_at) + 90: # 시계는 1초마다 본다
					return
				var cr := get_tree().get_first_node_in_group("go_crossing_region")
				var st: Dictionary = _v.stood
				var turned := absf(float(cr.call("minute_angle")) - float(_v.a0))
				var ok: bool = int(_v.ground_st) == 4 and bool(_v.grab) and int(st.st) == 5 and float(st.y) >= c.y + Crossing.CLOCK_H - 0.6 and int(st.mode) == _p.Mode.GROUND \
					and bool(cr.call("is_clock_running")) and turned > 0.05
				_check("ch19_clock", ok, "ground_st=%d grab=%s st=%d y=%.1f top=%.1f mode=%d running=%s turned=%.2f" % [_v.ground_st, _v.grab, st.st, st.y, c.y + Crossing.CLOCK_H, st.mode,
					cr.call("is_clock_running"), turned])
				_next()
		7: # [7] 반디(시계탑 발치) → 섬돌
			if _frame == 1:
				_v = _flat(_sq.call("npc_pos", "bandi"), _cell3(Vector2(6.2, 6.35)))
			_talk("bandi", 6, "ch19_bandi2", Vector2(2.5, 7.0), "bandi_at_clock=%.1f" % float(_v), float(_v) < 1.0, 1)
		8: # [8] 섬돌 꼭대기 — 땅에선 안 넘어가고 꼭대기 판에 서면 넘어간다, 선장이 꼭대기 높이에
			var top := Crossing.stones_top()
			if _frame == 1:
				_put(Crossing.cell_pos(Crossing.STONES_CELL) + Vector3(9.0, 0.0, 0.0))
			if _frame == 12:
				_v = {"ground_st": int(_sq.call("st"))}
				_put(top + Vector3(-1.5, 0.0, 1.5))
			if _frame == 40:
				var hp: Vector3 = _sq.call("npc_pos", "hanbyeol")
				var ok: bool = int(_v.ground_st) == 6 and int(_sq.call("st")) == 7 and bool(_sq.call("npc_visible", "hanbyeol")) and absf(hp.y - (top.y - 0.3 + 0.3)) < 0.5 \
					and _flat(hp, top) < 3.0
				_check("ch19_stones", ok, "ground_st=%d st=%d visible=%s cap_y=%.1f top=%.1f" % [_v.ground_st, _sq.call("st"), _sq.call("npc_visible", "hanbyeol"), hp.y, top.y])
				_next()
		9: # [9] 선장(섬돌 꼭대기) → 대결
			_talk("hanbyeol", 8, "ch19_hanbyeol", Vector2(3.2, 6.2))
		10: # [10] 파수꾼 — 풍, 고리 예고
			if _frame == 1:
				_put(_target() + Vector3(0, 0, 8))
			if _frame == 12:
				var bosses := get_tree().get_nodes_in_group("go_story_boss")
				var b: Node3D = bosses[0] if not bosses.is_empty() else null
				_v = {"n": bosses.size(), "marks": 0, "kind": "", "region": ""}
				if b:
					_v.kind = String(b.get("kind"))
					_v.region = TestMap.region_at(b.global_position)
					b.call("_clear_marks")
					b.call("_set_tell", false)
					b.call("begin_skill", "halo", _p)
					_v.marks = (b.get("_marks") as Array).size()
					b.call("_clear_marks")
					b.call("_die")
			if _frame == 20:
				var ok: bool = int(_v.n) == 1 and String(_v.kind) == "time_warden" and String(_v.region) == R and int(_v.marks) >= 1 and int(_sq.call("st")) == 9
				_check("ch19_duel", ok, "n=%d kind=%s region=%s marks=%d st=%d" % [_v.n, _v.kind, _v.region, _v.marks, _sq.call("st")])
				_next()
		11: # [11] 선장 → 19장 끝 · 선장은 첫 정거장 곁 · 반디는 나루 착륙판 곁
			if _frame == 1:
				_v = {"mora": PartyState.count("mora")}
				_near_npc("hanbyeol")
			if _frame == 10:
				_sq.call("interact")
				_drain()
			if _frame < 16:
				return
			_dismiss_prompts()
			if _frame < 22:
				return
			_sq.call("toggle_journal")
			var jt: String = _sq.call("journal_text")
			_sq.call("toggle_journal")
			var cap: Vector3 = _sq.call("npc_pos", "hanbyeol")
			var bandi: Vector3 = _sq.call("npc_pos", "bandi")
			var ok: bool = int(_sq.call("ch")) == CH19 + 1 and jt.contains("✔ 제19장") and PartyState.count("mora") >= int(_v.mora) + 95000 \
				and bool(_sq.call("npc_visible", "hanbyeol")) and _flat(cap, _cell3(Vector2(4.8, 2.4))) < 1.0 \
				and _flat(bandi, _cell_any("skyport", Vector2(5.44, 1.8))) < 1.0 and Crossing.clock_running()
			_check("chapter19", ok, "ch=%d mora +%d cap=%s bandi=%s" % [_sq.call("ch"), PartyState.count("mora") - int(_v.mora), cap, bandi])
			_next()
		12: # 20장 준비 — 모험 등급 47
			PartyState.exp = maxf(PartyState.exp, 47.0 * PartyState.EXP_PER_LEVEL)
			PartyState.level = maxi(PartyState.level, 47)
			PartyState.ar_paid = maxi(PartyState.ar_paid, PartyState.level + 1)
			PartyState.story = {"ch": CH20, "step": 0}
			_sq.call("_enter_step")
			_next()
		13: # [12] 표·자리
			if _frame < 70:
				return
			var c := Story.chapter(CH20)
			var bad: Array = []
			if String(c.get("id", "")) != "ch20" or int(c.ar) <= int(Story.chapter(CH19).ar) or String(c.get("join", "")) != "story_hanbyeol" or bool(_sq.call("locked")):
				bad.append("chapter")
			var m: Dictionary = Story.MEMBERS.get("story_hanbyeol", {})
			if int(m.get("rarity", 0)) != 5 or Elements.element_of("story_hanbyeol") != "wind" or String(m.get("weapon", "")) != "bow" or not Kits.KITS.has("story_hanbyeol"):
				bad.append("member")
			var re := get_tree().get_first_node_in_group("go_rift_end")
			if re == null or not bool(re.call("tear_visible")) or absf(float(re.call("tear_scale")) - 1.0) > 0.01 or bool(re.call("anchors_lit")) or not bool(re.call("draft_active")):
				bad.append("rift_end state")
			var ctr := RiftEnd.center()
			var rise := ctr.y - TerrainBuilder.height_at(R, ctr)
			if rise < 35.0:
				bad.append("rise %.1f" % rise)
			## 섬 칸 — 단계·인물 자리가 섬 윗면 안(난간 3m 안쪽), 1.2m 위에 닻·난간 충돌 없음.
			var spots: Array = []
			for s in c.steps:
				if bool(s.get("rift_end", false)):
					spots.append(s.cell)
				if s.has("to") and bool(s.to.get("rift_end", false)):
					spots.append(s.to.cell)
			for w in Story.windows(Story.NPCS.hanbyeol.appear) + Story.windows(Story.STATIONS.bandi) + Story.windows(Story.STATIONS.dodam):
				if bool(w.get("rift_end", false)):
					spots.append(w.cell)
			for cell in spots:
				var sp := TestMap.world_pos(cell.x, cell.y, R)
				sp.y = RiftEnd.top_y()
				if _flat(sp, ctr) > RiftEnd.RADIUS - 3.0 or _isle_hits(sp) > 0:
					bad.append("spot %s" % cell)
			if spots.size() < 8 or Story.DEFEND_RING > RiftEnd.RADIUS - 1.5:
				bad.append("spots=%d" % spots.size())
			if _flat(_sq.call("npc_pos", "hanbyeol"), _cell3(Vector2(4.8, 2.4))) > 1.0 or _flat(_sq.call("npc_pos", "dodam"), _cell3(Vector2(4.85, 1.9))) > 1.0:
				bad.append("npcs at stop")
			var duel: Dictionary = c.steps[9]
			if String(duel.kind) != "rift_crow" or String(FieldEnemy.KINDS.rift_crow.element) != "ice" or Elements.shield_mul("ice", "fire") <= 1.0:
				bad.append("duel kind")
			_check("ch20_table", bad.is_empty(), "%s rise=%.1f spots=%d" % [bad, rise, spots.size()])
			_next()
		14: # [13] 선장 → 막차
			_talk("hanbyeol", 1, "ch20_hanbyeol", Vector2(4.85, 1.9))
		15: # [14] 막차 타기 — 섬 위에 내림
			if _frame == 1:
				_near_npc("dodam")
			if _frame == 10:
				_sq.call("interact")
				_drain()
			if _frame == 30:
				var ok: bool = int(_sq.call("st")) == 2 and RiftEnd.on_isle(_p.global_position) and _p.is_on_floor()
				_check("ch20_sail", ok, "st=%d pos=%s top=%.1f floor=%s" % [_sq.call("st"), _p.global_position, RiftEnd.top_y(), _p.is_on_floor()])
				_next()
		16: # [15] 반디(섬 위) → 한가운데
			if _frame == 1:
				var bp: Vector3 = _sq.call("npc_pos", "bandi")
				_v = RiftEnd.on_isle(bp, 0.1) and absf(bp.y - RiftEnd.top_y()) < 0.05
			_talk("bandi", 3, "ch20_bandi", Vector2(6.3, 2.6), "bandi_on_isle=%s" % _v, bool(_v), 1)
		17: # [16] 무리 다섯 — 섬 위에
			if _frame == 1:
				_put(RiftEnd.center() + Vector3(0, 0, 9))
			if _frame == 20:
				var es: Array = _sq.call("alive_quest_enemies")
				_v = {"n": es.size(), "on": es.filter(func(e: Node) -> bool: return RiftEnd.on_isle((e as Node3D).global_position, 1.0)).size()}
				for e in es:
					e.call("_die")
			if _frame == 26:
				_check("ch20_kill", int(_v.n) == 5 and int(_v.on) == 5 and int(_sq.call("st")) == 4, "n=%d on=%d st=%d" % [_v.n, _v.on, _sq.call("st")])
				_next()
		18: # [17] 선장(섬 위) → 매듭
			if _frame == 1:
				var hp: Vector3 = _sq.call("npc_pos", "hanbyeol")
				_v = RiftEnd.on_isle(hp, 0.1) and absf(hp.y - RiftEnd.top_y()) < 0.05
			_talk("hanbyeol", 5, "ch20_hanbyeol2", Vector2(6.3, 2.6), "cap_on_isle=%s" % _v, bool(_v), 1)
		19: # [18] 매듭 석등 — 섬 높이, 해 먼저(틀림) → 달 → 별 → 해, 다 켜지면 닻·틈
			if _frame == 1:
				_put(RiftEnd.center() + Vector3(0.0, 0.0, 3.0))
				_v = {"lit": [], "ys": []}
			if _frame == 6:
				for mk in ["moon", "star", "sun"]:
					_v.ys.append(snappedf((_sq.call("seal_lamp_pos", mk) as Vector3).y - RiftEnd.top_y(), 0.01))
				for mk in ["sun", "moon", "star", "sun"]:
					_sq.call("receive_element", _sq.call("seal_lamp_pos", mk), 0.5, "wind")
					_v.lit.append(int(_sq.call("seal_lit")))
			if _frame == 90:
				var re := get_tree().get_first_node_in_group("go_rift_end")
				var ys_ok := (_v.ys as Array).all(func(y: float) -> bool: return absf(y) < 0.2)
				var ok: bool = _v.lit == [0, 1, 2, 3] and int(_sq.call("st")) == 6 and ys_ok and bool(re.call("anchors_lit")) \
					and absf(float(re.call("tear_scale")) - 0.5) < 0.01 and bool(re.call("tear_visible"))
				_check("ch20_seal", ok, "lit=%s st=%d ys=%s anchors=%s tear=%.2f" % [_v.lit, _sq.call("st"), _v.ys, re.call("anchors_lit"), re.call("tear_scale")])
				_next()
		20: # [19] 선장 → 지키기
			_talk("hanbyeol", 7, "ch20_hanbyeol3", Vector2(6.3, 2.6))
		21: # [20] 매듭 제단 지키기 — 물결 셋이 섬 위에서
			if _frame == 1:
				_put(RiftEnd.center() + Vector3(2.5, 0.0, 2.5))
				_v = {"off": 0, "n": 0, "waves": 0, "label": ""}
			if _frame > 4 and _frame % 6 == 0 and int(_sq.call("st")) == 7:
				var lbl := _sq.get("_defend_label") as Label3D
				if lbl and String(_v.label) == "":
					_v.label = lbl.text
				for e in _sq.call("alive_quest_enemies"):
					_v.n += 1
					if not RiftEnd.on_isle((e as Node3D).global_position, 1.0):
						_v.off += 1
					e.call("_die")
				_v.waves = maxi(int(_v.waves), int(_sq.call("defend_wave")) + 1)
			if _frame > 4 and (int(_sq.call("st")) != 7 or _frame > 600):
				var ok: bool = int(_sq.call("st")) == 8 and int(_v.off) == 0 and int(_v.n) == 12 and int(_v.waves) == 3 and String(_v.label).begins_with("매듭 제단")
				_check("ch20_defend", ok, "st=%d off=%d n=%d waves=%d label='%s' frames=%d" % [_sq.call("st"), _v.off, _v.n, _v.waves, _v.label, _frame])
				_next()
		22: # [21] 선장 → 대결
			_talk("hanbyeol", 9, "ch20_hanbyeol4", Vector2(6.3, 2.6))
		23: # [22] 별까마귀 — 섬 위, 고리 예고
			if _frame == 1:
				_put(RiftEnd.center() + Vector3(0, 0, 9))
			if _frame == 12:
				var bosses := get_tree().get_nodes_in_group("go_story_boss")
				var b: Node3D = bosses[0] if not bosses.is_empty() else null
				_v = {"n": bosses.size(), "marks": 0, "kind": "", "on": false}
				if b:
					_v.kind = String(b.get("kind"))
					_v.on = RiftEnd.on_isle(b.global_position, 1.0)
					b.call("_clear_marks")
					b.call("_set_tell", false)
					b.call("begin_skill", "halo", _p)
					_v.marks = (b.get("_marks") as Array).size()
					b.call("_clear_marks")
					b.call("_die")
			if _frame == 20:
				var ok: bool = int(_v.n) == 1 and String(_v.kind) == "rift_crow" and bool(_v.on) and int(_v.marks) >= 1 and int(_sq.call("st")) == 10
				_check("ch20_duel", ok, "n=%d kind=%s on=%s marks=%d st=%d" % [_v.n, _v.kind, _v.on, _v.marks, _sq.call("st")])
				_next()
		24: # [23] 선장 → 20장 끝·동료 한별·틈 닫힘
			if _frame == 1:
				_v = {"mora": PartyState.count("mora")}
				_near_npc("hanbyeol")
			if _frame == 10:
				_sq.call("interact")
				_drain()
			if _frame < 16:
				return
			_dismiss_prompts()
			if _frame < 22:
				return
			_sq.call("toggle_journal")
			var jt: String = _sq.call("journal_text")
			_sq.call("toggle_journal")
			var re := get_tree().get_first_node_in_group("go_rift_end")
			var cap: Vector3 = _sq.call("npc_pos", "hanbyeol")
			var ok: bool = int(_sq.call("ch")) == CH20 + 1 and jt.contains("✔ 제20장") and PartyState.count("mora") >= int(_v.mora) + 100000 \
				and PartyState.members.has("story_hanbyeol") and not bool(re.call("tear_visible")) and bool(re.call("anchors_lit")) \
				and RiftEnd.tear_state() == 2 and _flat(cap, _cell_any("skyport", Vector2(5.2, 1.95))) < 1.0 # 106장 ㊿-2 — 20장 뒤(21장 처음)엔 은하 나루 별배 곁
			_check("chapter20", ok, "ch=%d mora +%d joined=%s tear=%s cap=%s" % [_sq.call("ch"), PartyState.count("mora") - int(_v.mora), PartyState.members.has("story_hanbyeol"),
				re.call("tear_visible"), cap])
			_next()
		25: # [24] 바람 기둥 — 공중이면 솟아 섬 윗면 위로
			var b := RiftEnd.draft_base()
			if _frame == 1:
				_put(b + Vector3(0.0, 3.0, 0.0))
				_p.set("stamina", float(_p.get("stamina_max")))
				_p.call("_set_mode", _p.Mode.AIR)
				_v = {"peak": -1e9, "glide": false}
			if _frame > 1:
				_v.glide = bool(_v.glide) or int(_p.get("mode")) == _p.Mode.GLIDE
				_v.peak = maxf(float(_v.peak), _p.global_position.y)
			if _frame == 700:
				var ok: bool = bool(_v.glide) and float(_v.peak) > RiftEnd.top_y() + 2.0
				_check("ch20_updraft", ok, "glide=%s peak=%.1f top=%.1f" % [_v.glide, _v.peak, RiftEnd.top_y()])
				_next()
		26:
			PartyState.story = _saved.story
			PartyState.members.assign(_saved.members)
			PartyState.exp = _saved.exp
			PartyState.level = _saved.level
			PartyState.bag = _saved.bag
			PartyState.ar_paid = _saved.ar_paid
			EventState.resolved.assign(_saved.resolved)
			PartyState.world_quests = _saved.wq
			_p.global_position = _saved.pos
			print("STORY5_PROBE_DONE fails=%d" % _fails)
			get_tree().quit()

func _cell_any(region: String, cell: Vector2) -> Vector3:
	var p := TestMap.world_pos(cell.x, cell.y, region)
	p.y = TerrainBuilder.height_at(region, p)
	return p

func _talk(npc: String, want_st: int, name: String, next_cell: Vector2, extra := "", extra_ok := true, from := 0) -> void:
	if _frame == 2 + from * 2:
		_near_npc(npc)
	if _frame == 10 + from * 2:
		_sq.call("interact")
		_drain()
	if _frame == 14 + from * 2:
		var tgt_ok := next_cell == Vector2.INF or _flat(_target(), TestMap.world_pos(next_cell.x, next_cell.y, _step_region(want_st))) < 0.5
		_check(name, int(_sq.call("st")) == want_st and tgt_ok and extra_ok, "st=%d target=%s %s" % [_sq.call("st"), _target(), extra])
		_next()

func _go(want_st: int, name: String, next_cell: Vector2) -> void:
	if _frame == 1:
		_put(_target())
	if _frame == 12:
		var tgt_ok := next_cell == Vector2.INF or _flat(_target(), TestMap.world_pos(next_cell.x, next_cell.y, _step_region(want_st))) < 0.5
		_check(name, int(_sq.call("st")) == want_st and tgt_ok, "st=%d" % _sq.call("st"))
		_next()

func _step_region(st: int) -> String:
	return String(Story.step_of(int(_sq.call("ch")), st).get("region", R))

func _target() -> Vector3:
	return _sq.call("target_pos")

func _cell3(cell: Vector2) -> Vector3:
	var p := TestMap.world_pos(cell.x, cell.y, R)
	p.y = TerrainBuilder.height_at(R, p)
	return p

## 그 자리 1.2m 위에 걸리는 은하 나루·틈새 갈림길 명소 충돌(지형은 뺀다).
func _hits(pos: Vector3) -> Array:
	var regs := [get_tree().get_first_node_in_group("go_skyport_region"), get_tree().get_first_node_in_group("go_crossing_region")]
	var q := PhysicsShapeQueryParameters3D.new()
	var sph := SphereShape3D.new()
	sph.radius = 0.6
	q.shape = sph
	q.collision_mask = 1
	q.exclude = [_p.get_rid()]
	q.transform = Transform3D(Basis(), pos + Vector3(0, 1.2, 0))
	var out: Array = []
	for hit in _p.get_world_3d().direct_space_state.intersect_shape(q, 4):
		var c: Object = hit.collider
		var pn := String((c as Node).get_parent().name) if c is Node else ""
		if c is Node and regs.any(func(r: Node) -> bool: return r and r.is_ancestor_of(c as Node)) and not pn.begins_with("Skyport") and not pn.begins_with("Crossing"):
			out.append(String((c as Node).get_parent().name))
	return out

## 그 자리 1.2m 위에 걸리는 갈림길 끝 섬 충돌(닻·난간 — 윗면 원판은 안 닿는다) 수.
func _isle_hits(pos: Vector3) -> int:
	var re := get_tree().get_first_node_in_group("go_rift_end")
	var q := PhysicsShapeQueryParameters3D.new()
	var sph := SphereShape3D.new()
	sph.radius = 0.6
	q.shape = sph
	q.collision_mask = 1
	q.exclude = [_p.get_rid()]
	q.transform = Transform3D(Basis(), pos + Vector3(0, 1.2, 0))
	var n := 0
	for hit in _p.get_world_3d().direct_space_state.intersect_shape(q, 4):
		if hit.collider is Node and re and re.is_ancestor_of(hit.collider as Node):
			n += 1
	return n

func _surface(p: Vector3) -> float:
	var q := PhysicsRayQueryParameters3D.create(Vector3(p.x, 80.0, p.z), Vector3(p.x, -20.0, p.z), 1)
	q.exclude = [_p.get_rid()]
	var hit := _p.get_world_3d().direct_space_state.intersect_ray(q)
	return (hit.position as Vector3).y if not hit.is_empty() else -99.0

var _pressed: Array = []

func _dismiss_prompts() -> void:
	for n in get_tree().get_nodes_in_group("ui_modal"):
		if n == _sq or n.get("visible") == false or _pressed.has(n):
			continue
		_pressed.append(n)
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

func _flat(a: Vector3, b: Vector3) -> float:
	return Vector2(a.x - b.x, a.z - b.z).length()

func _near_npc(id: String) -> void:
	_dismiss_prompts()
	_put(_sq.call("npc_pos", id) + Vector3(0.0, 0.3, 1.5))

func _put(pos: Vector3) -> void:
	_p.global_position = pos + Vector3(0.0, 0.3, 0.0)
	_p.velocity = Vector3.ZERO

func _check(name: String, ok: bool, detail: String) -> void:
	if not ok:
		_fails += 1
	print("STORY5_PROBE %s %s %s" % [name, "ok" if ok else "FAIL", detail])

func _next() -> void:
	_step += 1
	_frame = 0
