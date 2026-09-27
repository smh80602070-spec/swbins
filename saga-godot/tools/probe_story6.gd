extends Node
## GO 이야기 6부(PLAN 106장 ㊿, 21장~) 자동 점검 — 평소엔 안 붙는다. 5부 probe_story5.
## test_village.gd 가 SAGA_STORY6_PROBE 가 있을 때만 단다.
##
##   SAGA_STORY6_PROBE=1 "$GODOT" --headless --path saga-godot res://games/saga_go/world/TestVillage.tscn
##
## 21장 "바다 밑 등불"(㊿-2, world/region7_sunken.gd): [1] 표·자리(여울 현대·잠수 마스크 · 선착장 칸 = dock_pos · 판 위·기단 위 자리 높이 ·
## 무리 칸이 모래 · 자리가 명소에 안 묻힘 · 물속 불빛이 20장 뒤에 켜짐 · 선장은 은하 나루 별배 곁) [2] 선장 → 별배
## [3] 별배 타기(잠긴 도읍 모래밭에 내림) [4] 반디(모래밭) → 기지 앞 [5] 물짐승 넷이 모래 위 [6] 잔교 끝 선착장 판에 서면 넘어간다(헤엄 아님)
## [7] 여울(판 위) → 잠수정 [8] 잠수정 타기(궁궐 기단 위에 내려 섬) [9] 여울(기단 위) → 21장 끝·보상·✔ 제21장·자리(ch_to).
## 22장 "잠긴 궁궐의 해녀"(㊿-3): [10] 표·자리(물새 과거·석등·자물쇠 자리가 받침 위 · 물결 방향이 고리 위 · 대결 둘레가 돔 안 마른 바닥 ·
## 등불아귀 수·뇌가 방패를 깸 · 받침·돔 안 자리가 명소에 안 묻힘 · 문 잠김) [11] 여울 → 곁채 지붕 [12] 물새(지붕 윗면) → 바지락
## [13] 바지락 셋 [14] 물새(받침 위) → 석등 [15] 물길 석등 — 받침 높이·고리 위·차례(틀리면 꺼짐) [16] 물새 → 지키기
## [17] 자물쇠 지키기(물결 셋 모두 고리 위) [18] 문이 열림 → 여울 → 대결 [19] 등불아귀(돔 바닥, 고리 예고) [20] 물새(돔 안) → 22장 끝.
## 이야기 상태·부대 경험·가방은 끝에 되돌린다. 저장은 안 한다.

const Story := preload("res://games/saga_go/data/story.gd")
const TestMap := preload("res://games/saga_go/data/test_map.gd")
const TerrainBuilder := preload("res://games/saga_go/world/terrain_builder.gd")
const Sunken := preload("res://games/saga_go/world/region7_sunken.gd")
const FieldEnemy := preload("res://games/saga_go/combat/field_enemy.gd")
const Elements := preload("res://games/saga_go/combat/elements.gd")
const Gathering := preload("res://games/saga_go/world/gathering.gd")

const CH21 := 20 # 21장(0부터)
const CH22 := 21
const R := "sunken"

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
		0: # 준비 — 21장 처음, 모험 등급 49
			_saved = {"story": PartyState.story.duplicate(true), "members": PartyState.members.duplicate(), "exp": PartyState.exp, "level": PartyState.level,
				"bag": PartyState.bag.duplicate(true), "ar_paid": PartyState.ar_paid, "resolved": EventState.resolved.duplicate(), "pos": _p.global_position, "wq": PartyState.world_quests.duplicate(true)}
			PartyState.exp = maxf(PartyState.exp, 49.0 * PartyState.EXP_PER_LEVEL)
			PartyState.level = maxi(PartyState.level, 49)
			PartyState.ar_paid = maxi(PartyState.ar_paid, PartyState.level + 1)
			PartyState.story = {"ch": CH21, "step": 0}
			_sq.call("set_track", "")
			_sq.call("_enter_step")
			_next()
		1: # [1] 표·자리
			if _frame < 70: # 지역 파일은 1초마다 장을 본다
				return
			var c := Story.chapter(CH21)
			var steps: Array = c.steps
			var bad: Array = []
			if String(c.get("id", "")) != "ch21" or int(c.ar) <= int(Story.chapter(CH21 - 1).ar) or int(_sq.call("ch")) != CH21 or bool(_sq.call("locked")) or steps.size() != 8:
				bad.append("chapter ch=%d locked=%s steps=%d" % [_sq.call("ch"), _sq.call("locked"), steps.size()])
			var info: Dictionary = Story.NPCS.yeoul
			if String(info.region) != R or String(info.get("era", "")) != "현대" or not bool(info.get("goggles", false)):
				bad.append("yeoul info")
			var yo := _sq.find_child("StoryNpc_yeoul", true, false)
			if yo == null or yo.find_child("Goggles", true, false) == null:
				bad.append("yeoul body")
			## 선착장 — go 칸·여울 자리가 dock_pos 와 2m 안, 자리 높이가 판 윗면.
			var dock := Sunken.dock_pos()
			var go: Dictionary = steps[4]
			var yw: Array = Story.windows(Story.STATIONS.yeoul)
			if String(go.type) != "go" or _flat(_cell_any(R, go.cell), dock) > 2.0 or _flat(_spot(yw[0]), dock) > 2.0 or absf(_spot(yw[0]).y - Sunken.DECK_Y) > 0.1:
				bad.append("dock go=%s yeoul=%s dock=%s" % [_cell_any(R, go.cell), _spot(yw[0]), dock])
			## 잠수정 내리는 자리·기단 위 자리 높이 = 기단 윗면.
			var sub: Dictionary = steps[6]
			for d in [sub.to, yw[1], yw[2]]:
				if absf(_spot(d).y - Sunken.TERRACE_Y) > 0.1 or _surface(_spot(d)) < Sunken.TERRACE_Y - 0.1:
					bad.append("terrace spot %s y=%.2f surf=%.2f" % [d.cell, _spot(d).y, _surface(_spot(d))])
			var kill: Dictionary = steps[3]
			if TestMap.tile_at(roundi(kill.cell.x), roundi(kill.cell.y), R) != "D":
				bad.append("kill tile")
			## 자리가 명소 충돌에 안 묻힘(별배 내리는 자리·인물 칸 전부).
			var spots: Array = [_spot(steps[1].to), _spot(sub.to), _cell_any(R, info.cell)]
			for w in Story.windows(Story.NPCS.hanbyeol.appear).filter(func(w: Dictionary) -> bool: return int(w.ch) >= CH21) \
					+ Story.windows(Story.STATIONS.bandi).filter(func(w: Dictionary) -> bool: return int(w.ch) >= CH21) + yw:
				spots.append(_spot(w))
			for sp in spots:
				if not _hits(sp).is_empty():
					bad.append("buried %s %s" % [sp, _hits(sp)])
			var su := get_tree().get_first_node_in_group("go_sunken_region")
			var lights := su.find_child("SeaLights", true, false) as Node3D
			if lights == null or not lights.visible or not Sunken.sea_lights_on():
				bad.append("sea lights")
			if _flat(_sq.call("npc_pos", "hanbyeol"), _cell_any("skyport", Vector2(5.2, 1.95))) > 1.0 or not bool(_sq.call("npc_visible", "hanbyeol")):
				bad.append("hanbyeol at skyport %s" % _sq.call("npc_pos", "hanbyeol"))
			_check("ch21_table", bad.is_empty(), str(bad))
			_next()
		2: # [2] 선장(은하 나루) → 별배
			_talk("hanbyeol", 1, "ch21_hanbyeol", Vector2.INF)
		3: # [3] 별배 타기 — 선장에게 F → 잠긴 도읍 모래밭
			if _frame == 1:
				_near_npc("hanbyeol")
			if _frame == 10:
				_sq.call("interact")
				_drain()
			if _frame == 20:
				var here := TestMap.region_at(_p.global_position)
				var ok: bool = int(_sq.call("st")) == 2 and here == R and _flat(_p.global_position, _cell_any(R, Vector2(2.9, 1.7))) < 1.5
				_check("ch21_ship", ok, "st=%d region=%s pos=%s" % [_sq.call("st"), here, _p.global_position])
				_next()
		4: # [4] 반디(모래밭) → 기지 앞
			if _frame == 1:
				_v = _flat(_sq.call("npc_pos", "bandi"), _cell_any(R, Vector2(3.1, 1.55)))
			_talk("bandi", 3, "ch21_bandi", Vector2(6.0, 2.55), "bandi_at_beach=%.1f" % float(_v), float(_v) < 1.0, 1)
		5: # [5] 물짐승 넷 — 모래 위
			if _frame == 1:
				_put(_target() + Vector3(0, 0, -6))
			if _frame == 10:
				var es: Array = _sq.call("alive_quest_enemies")
				var dry := es.filter(func(e: Node) -> bool: return TestMap.region_at((e as Node3D).global_position) == R \
					and TerrainBuilder.height_at(R, (e as Node3D).global_position) > TerrainBuilder.WATER_LEVEL).size()
				_v = {"n": es.size(), "dry": dry}
				for e in es:
					e.call("_die")
			if _frame == 16:
				_check("ch21_kill", int(_v.n) == 4 and int(_v.dry) == 4 and int(_sq.call("st")) == 4, "n=%d dry=%d st=%d" % [_v.n, _v.dry, _sq.call("st")])
				_next()
		6: # [6] 잔교 끝 선착장 — 기지 갑판에선 안 넘어가고, 판 위에 서면 넘어간다. 서서 헤엄이 아니라 걷는다.
			var dock := Sunken.dock_pos()
			if _frame == 1:
				_put(Sunken.at(Sunken.BASE_CELL, Sunken.DECK_Y))
			if _frame == 12:
				_v = {"deck_st": int(_sq.call("st"))}
				_put(dock + Vector3(-1.5, 0, 0))
			if _frame == 50:
				var yp: Vector3 = _sq.call("npc_pos", "yeoul")
				var ok: bool = int(_v.deck_st) == 4 and int(_sq.call("st")) == 5 and _p.is_on_floor() and _p.mode == _p.Mode.GROUND \
					and absf(_p.global_position.y - Sunken.DECK_Y) < 0.3 and absf(yp.y - Sunken.DECK_Y) < 0.1 and _flat(yp, dock) < 2.0
				_check("ch21_dock", ok, "deck_st=%d st=%d floor=%s mode=%d y=%.2f yeoul=%s" % [_v.deck_st, _sq.call("st"), _p.is_on_floor(), _p.mode, _p.global_position.y, yp])
				_next()
		7: # [7] 여울(판 위) → 잠수정
			_talk("yeoul", 6, "ch21_yeoul", Vector2.INF)
		8: # [8] 잠수정 타기 — 여울에게 F → 궁궐 기단 위에 내려 선다
			if _frame == 1:
				_near_npc("yeoul")
			if _frame == 10:
				_sq.call("interact")
				_drain()
			if _frame == 60:
				var yp: Vector3 = _sq.call("npc_pos", "yeoul")
				var bp: Vector3 = _sq.call("npc_pos", "bandi")
				var ok: bool = int(_sq.call("st")) == 7 and TestMap.region_at(_p.global_position) == R and _p.is_on_floor() and _p.mode == _p.Mode.GROUND \
					and absf(_p.global_position.y - Sunken.TERRACE_Y) < 0.3 and _flat(_p.global_position, _cell_any(R, Vector2(2.3, 4.87))) < 1.5 \
					and absf(yp.y - Sunken.TERRACE_Y) < 0.1 and absf(bp.y - Sunken.TERRACE_Y) < 0.1
				_check("ch21_sub", ok, "st=%d pos=%s floor=%s mode=%d yeoul=%s bandi=%s" % [_sq.call("st"), _p.global_position, _p.is_on_floor(), _p.mode, yp, bp])
				_next()
		9: # [9] 여울(기단 위) → 21장 끝
			if _frame == 1:
				_v = {"mora": PartyState.count("mora")}
				_near_npc("yeoul")
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
			var yp: Vector3 = _sq.call("npc_pos", "yeoul")
			var ok: bool = int(_sq.call("ch")) == CH21 + 1 and jt.contains("✔ 제21장") and PartyState.count("mora") >= int(_v.mora) + 105000 \
				and _flat(cap, _cell_any(R, Vector2(3.3, 1.8))) < 1.0 and absf(yp.y - Sunken.TERRACE_Y) < 0.1
			_check("chapter21", ok, "ch=%d mora +%d cap=%s yeoul=%s" % [_sq.call("ch"), PartyState.count("mora") - int(_v.mora), cap, yp])
			_next()
		10: # [10] 22장 표·자리
			if _frame == 1:
				PartyState.exp = maxf(PartyState.exp, 51.0 * PartyState.EXP_PER_LEVEL)
				PartyState.level = maxi(PartyState.level, 51)
				PartyState.ar_paid = maxi(PartyState.ar_paid, PartyState.level + 1)
				_sq.call("_enter_step")
			if _frame < 70:
				return
			var c := Story.chapter(CH22)
			var steps: Array = c.steps
			var bad: Array = []
			if String(c.get("id", "")) != "ch22" or int(c.ar) <= int(Story.chapter(CH21).ar) or int(_sq.call("ch")) != CH22 or bool(_sq.call("locked")) or steps.size() != 10:
				bad.append("chapter ch=%d locked=%s steps=%d" % [_sq.call("ch"), _sq.call("locked"), steps.size()])
			var info: Dictionary = Story.NPCS.mulsae
			if String(info.get("era", "")) != "과거" or bool(_sq.call("npc_visible", "mulsae")):
				bad.append("mulsae info/visible")
			## 석등·지키기 자리 — 돔 가운데 북쪽 27.5m 받침 위.
			var dc := Sunken.dome_center()
			var seal: Dictionary = steps[4]
			var defend: Dictionary = steps[6]
			for d in [seal, defend]:
				var sp := _spot(d)
				if absf(sp.y - Sunken.DECK_Y) > 0.1 or absf(_flat(sp, dc) - 27.5) > 0.6:
					bad.append("%s spot %s r=%.1f" % [d.type, sp, _flat(sp, dc)])
			## 물결 방향 — 받침 고리 위(안 22.5 ~ 바깥 33.5).
			for dg in defend.dirs:
				var a := deg_to_rad(float(dg))
				var wp := _spot(defend) + Vector3(sin(a), 0.0, -cos(a)) * Story.DEFEND_RING
				if _flat(wp, dc) < Sunken.RING_IN + 0.5 or _flat(wp, dc) > Sunken.RING_OUT - 0.5:
					bad.append("wave dir %d r=%.1f" % [dg, _flat(wp, dc)])
			## 대결 — 돔 안 마른 바닥, 둘레 8m 가 평탄하고 유리 안.
			var duel: Dictionary = steps[8]
			var du := _cell_any(R, duel.cell)
			if absf(du.y + 10.0) > 0.05 or _flat(du, dc) + 8.0 > Sunken.RING_IN - 1.0:
				bad.append("duel spot %s r=%.1f" % [du, _flat(du, dc)])
			if String(duel.kind) != "abyss_angler" or String(FieldEnemy.KINDS.abyss_angler.element) != "water" or Elements.shield_mul("water", "thunder") <= 1.0:
				bad.append("duel kind")
			## 받침 위·돔 안 자리가 명소에 안 묻힘.
			var spots: Array = []
			for w in Story.windows(info.appear) + Story.windows(Story.STATIONS.yeoul).filter(func(w: Dictionary) -> bool: return int(w.ch) >= CH22) \
					+ Story.windows(Story.STATIONS.bandi).filter(func(w: Dictionary) -> bool: return int(w.ch) >= CH22 and String(w.region) == R):
				spots.append(_spot(w))
			for sp in spots:
				if not _hits(sp).is_empty():
					bad.append("buried %s %s" % [sp, _hits(sp)])
			var su := get_tree().get_first_node_in_group("go_sunken_region")
			if bool(su.call("is_dome_open")):
				bad.append("door open at st0")
			_check("ch22_table", bad.is_empty(), str(bad))
			_next()
		11: # [11] 여울(기단) → 곁채 지붕
			_talk("yeoul", 1, "ch22_yeoul", Vector2(3.5, 5.45))
		12: # [12] 물새(곁채 지붕 위) → 바지락
			if _frame == 1:
				var mp: Vector3 = _sq.call("npc_pos", "mulsae")
				_v = bool(_sq.call("npc_visible", "mulsae")) and absf(mp.y - 0.45) < 0.1 and absf(_surface(mp) - 0.45) < 0.1
			_talk("mulsae", 2, "ch22_mulsae", Vector2.INF, "on_roof=%s" % _v, bool(_v), 1)
		13: # [13] 바지락 셋
			if _frame == 3:
				var ga: Node = get_tree().get_first_node_in_group("go_gathering")
				var picked := 0
				for row in Gathering.all_nodes():
					if row[1] == "clam" and row[2] == R and picked < 3 and ga.call("node_pos", row[0]) != Vector3.INF:
						ga.call("pick", row[0])
						picked += 1
				_v = picked
			if _frame == 8:
				_check("ch22_gather", int(_v) == 3 and int(_sq.call("st")) == 3, "picked=%d st=%d" % [_v, _sq.call("st")])
				_next()
		14: # [14] 물새(돔 문 앞 받침 위) → 석등
			if _frame == 1:
				var mp: Vector3 = _sq.call("npc_pos", "mulsae")
				_v = absf(mp.y - Sunken.DECK_Y) < 0.1
			_talk("mulsae", 4, "ch22_mulsae2", Vector2(5.0, 5.427), "on_ring=%s" % _v, bool(_v), 1)
		15: # [15] 물길 석등 — 받침 높이·고리 위, 달 먼저(틀림) → 해 → 별 → 달
			var dc := Sunken.dome_center()
			if _frame == 1:
				_put(_target() + Vector3(0.0, 0.0, 3.0))
				_v = {"lit": [], "ys": [], "rs": []}
			if _frame == 6:
				for mk in ["sun", "star", "moon"]:
					var lp: Vector3 = _sq.call("seal_lamp_pos", mk)
					_v.ys.append(snappedf(lp.y - Sunken.DECK_Y, 0.01))
					_v.rs.append(snappedf(_flat(lp, dc), 0.1))
				for mk in ["moon", "sun", "star", "moon"]:
					_sq.call("receive_element", _sq.call("seal_lamp_pos", mk), 0.5, "water")
					_v.lit.append(int(_sq.call("seal_lit")))
			if _frame == 90: # 다 켜진 뒤 잠깐 뒤에 넘어간다
				var ys_ok := (_v.ys as Array).all(func(y: float) -> bool: return absf(y) < 0.2)
				var rs_ok := (_v.rs as Array).all(func(r: float) -> bool: return r > Sunken.RING_IN + 0.3 and r < Sunken.RING_OUT - 0.3)
				var ok: bool = _v.lit == [0, 1, 2, 3] and int(_sq.call("st")) == 5 and ys_ok and rs_ok
				_check("ch22_seal", ok, "lit=%s st=%d ys=%s rs=%s" % [_v.lit, _sq.call("st"), _v.ys, _v.rs])
				_next()
		16: # [16] 물새 → 지키기
			_talk("mulsae", 6, "ch22_mulsae3", Vector2(5.0, 5.427))
		17: # [17] 빛 돔 문 자물쇠 지키기 — 물결 셋이 받침 위에서
			var dc := Sunken.dome_center()
			if _frame == 1:
				_put(_target() + Vector3(2.5, 0.0, 2.5))
				_v = {"off": 0, "n": 0, "waves": 0, "label": ""}
			if _frame > 4 and _frame % 6 == 0 and int(_sq.call("st")) == 6:
				var lbl := _sq.get("_defend_label") as Label3D
				if lbl and String(_v.label) == "":
					_v.label = lbl.text
				for e in _sq.call("alive_quest_enemies"):
					_v.n += 1
					var ep := (e as Node3D).global_position
					if _flat(ep, dc) < Sunken.RING_IN or _flat(ep, dc) > Sunken.RING_OUT or ep.y < Sunken.DECK_Y - 1.0:
						_v.off += 1
					e.call("_die")
				_v.waves = maxi(int(_v.waves), int(_sq.call("defend_wave")) + 1)
			if _frame > 4 and (int(_sq.call("st")) != 6 or _frame > 600):
				var ok: bool = int(_sq.call("st")) == 7 and int(_v.off) == 0 and int(_v.n) == 12 and int(_v.waves) == 3 and String(_v.label).begins_with("빛 돔 문 자물쇠")
				_check("ch22_defend", ok, "st=%d off=%d n=%d waves=%d label='%s' frames=%d" % [_sq.call("st"), _v.off, _v.n, _v.waves, _v.label, _frame])
				_next()
		18: # [18] 문이 열렸다(지역 파일은 1초마다 본다) → 여울(받침 위) → 대결
			if _frame == 80:
				var su := get_tree().get_first_node_in_group("go_sunken_region")
				var veil := su.find_child("DoorVeil", true, false) as Node3D
				_v = bool(su.call("is_dome_open")) and not veil.visible
			if _frame > 80:
				_talk("yeoul", 8, "ch22_yeoul2", Vector2(4.792, 6.042), "door_open=%s" % _v, bool(_v), 40)
		19: # [19] 심해 등불아귀 — 돔 안 마른 바닥, 고리 예고
			if _frame == 1:
				_put(_target() + Vector3(0, 0, 9))
			if _frame == 12:
				var bosses := get_tree().get_nodes_in_group("go_story_boss")
				var b: Node3D = bosses[0] if not bosses.is_empty() else null
				_v = {"n": bosses.size(), "marks": 0, "kind": "", "y": 0.0}
				if b:
					_v.kind = String(b.get("kind"))
					_v.y = b.global_position.y
					b.call("_clear_marks")
					b.call("_set_tell", false)
					b.call("begin_skill", "halo", _p)
					_v.marks = (b.get("_marks") as Array).size()
					b.call("_clear_marks")
					b.call("_die")
			if _frame == 20:
				var ok: bool = int(_v.n) == 1 and String(_v.kind) == "abyss_angler" and absf(float(_v.y) + 10.0) < 1.5 and int(_v.marks) >= 1 and int(_sq.call("st")) == 9
				_check("ch22_duel", ok, "n=%d kind=%s y=%.1f marks=%d st=%d" % [_v.n, _v.kind, _v.y, _v.marks, _sq.call("st")])
				_next()
		20: # [20] 물새(돔 안) → 22장 끝
			if _frame == 1:
				_v = {"mora": PartyState.count("mora")}
				_near_npc("mulsae")
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
			var mp: Vector3 = _sq.call("npc_pos", "mulsae")
			var ok: bool = int(_sq.call("ch")) == CH22 + 1 and jt.contains("✔ 제22장") and PartyState.count("mora") >= int(_v.mora) + 110000 \
				and bool(_sq.call("npc_visible", "mulsae")) and absf(mp.y + 10.0) < 0.1
			_check("chapter22", ok, "ch=%d mora +%d mulsae=%s" % [_sq.call("ch"), PartyState.count("mora") - int(_v.mora), mp])
			_next()
		21:
			PartyState.story = _saved.story
			PartyState.members.assign(_saved.members)
			PartyState.exp = _saved.exp
			PartyState.level = _saved.level
			PartyState.bag = _saved.bag
			PartyState.ar_paid = _saved.ar_paid
			EventState.resolved.assign(_saved.resolved)
			PartyState.world_quests = _saved.wq
			_p.global_position = _saved.pos
			print("STORY6_PROBE_DONE fails=%d" % _fails)
			get_tree().quit()

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

func _step_region(st: int) -> String:
	return String(Story.step_of(int(_sq.call("ch")), st).get("region", R))

func _target() -> Vector3:
	return _sq.call("target_pos")

func _cell_any(region: String, cell: Vector2) -> Vector3:
	var p := TestMap.world_pos(cell.x, cell.y, region)
	p.y = TerrainBuilder.height_at(region, p)
	return p

## 단계·인물 칸 자리(lift 포함).
func _spot(d: Dictionary) -> Vector3:
	return _cell_any(String(d.region), d.cell) + Vector3(0, float(d.get("lift", 0.0)), 0)

## 그 자리 1.2m 위에 걸리는 은하 나루·잠긴 도읍 명소 충돌(지형은 뺀다).
func _hits(pos: Vector3) -> Array:
	var regs := [get_tree().get_first_node_in_group("go_skyport_region"), get_tree().get_first_node_in_group("go_sunken_region")]
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
		if c is Node and regs.any(func(r: Node) -> bool: return r and r.is_ancestor_of(c as Node)) and not pn.begins_with("Skyport") and not pn.begins_with("Sunken"):
			out.append(pn)
	return out

func _surface(p: Vector3) -> float:
	var q := PhysicsRayQueryParameters3D.create(Vector3(p.x, p.y + 1.0, p.z), Vector3(p.x, -20.0, p.z), 1)
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
	print("STORY6_PROBE %s %s %s" % [name, "ok" if ok else "FAIL", detail])

func _next() -> void:
	_step += 1
	_frame = 0
