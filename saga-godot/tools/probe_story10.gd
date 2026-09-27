extends Node
## GO 이야기 10부(PLAN 106장 54, 33장~) 자동 점검 — 평소엔 안 붙는다. 9부 probe_story9 · 무대 probe_vault.
## test_village.gd 가 SAGA_STORY10_PROBE 가 있을 때만 단다.
##
##   SAGA_STORY10_PROBE=1 "$GODOT" --headless --path saga-godot res://games/saga_go/world/TestVillage.tscn
##
## 33장 "지도 가장자리 너머"(54-2): [1] 표·자리(단계 여섯 talk·talk·go·kill·chase·talk · CH33 · 고개 울타리 꺼짐 ·
##   반디는 굳은 거리 · 하람은 고원 관측소 앞 · 마루는 창고 앞(보임) · 드론 길 점·야적장·마루 자리가 갈무리 벌 안·명소에 안 걸림)
## [2] 반디 → 하람(반디는 고원으로) [3] 하람 → 벌 어귀(반디는 갈무리 벌로) [4] 벌 어귀에 들어섬 [5] 야적장 결정 짐승 넷
## [6] 운반 드론 쫓기(드론 몸·갈무리 벌 안) [7] 마루 → 33장 끝·보상.
## 34장 "곳간의 씨앗"(54-3): [8] 표·자리(단계 일곱 talk·seal·talk·defend·light·light·talk · seal = 곳간 GRANARY_OPEN_STEP ·
##   light = 동력 기둥 PYLON_OFF_FROM · 문 = DOOR_OPEN_STEP · 곳간 지키기 자리·물결 나오는 자리·인물 자리가 명소에 안 걸림 ·
##   소담 아직 없음·곳간 잠김·기둥 켜짐·금고 문 닫힘) [9] 마루 → 석등(마루는 곳간 앞으로) [10] 석등 — 해 먼저(틀림) → 별 → 해 → 달 → 곳간 문 열림
## [11] 소담(보임) → 곳간 지키기 [12] 곳간 지키기(물결 셋) [13] 서쪽 기둥 — 먼 원소는 안 됨 → 꺼짐·소담은 금고 문 앞
## [14] 동쪽 기둥 → 금고 문 열림 [15] 소담 → 34장 끝·보상.
## 35장 "갈무리"(54-4, 10부 끝): [16] 표·자리(단계 일곱 talk·go·talk·climb·talk·duel·talk · 기둥 = 금고 칸·PILLAR_H ·
##   핵 꺼짐 = CORE_DIM_STEP(갈무리 대화 뒤) · 진열장 깨짐 = HAEMI_FREE_STEP(대결 뒤) · 여왕 풍·암이 방패를 깸 · 동료 해미 초·한손검·고유 ·
##   해미 자리 = 해미 진열장 · 핵 켜짐·진열장 그대로·문 열림) [17] 소담 → 금고 안 [18] 문 밖에선 안 넘어감 → 안(해미 보임·소담 문 안쪽)
## [19] 해미 → 기둥 [20] 기둥 — 발치에선 안 넘어가고 윗면에서 넘어감(갈무리 보임) [21] 갈무리 → 핵 꺼짐
## [22] 파수 드론 여왕(광장, 밀물 줄 예고) → 진열장 깨짐 [23] 해미 → 35장 끝·동료 해미.
## 이야기 상태·부대 경험·가방은 끝에 되돌린다. 저장은 안 한다.

const Story := preload("res://games/saga_go/data/story.gd")
const TestMap := preload("res://games/saga_go/data/test_map.gd")
const TerrainBuilder := preload("res://games/saga_go/world/terrain_builder.gd")
const Vault := preload("res://games/saga_go/world/region9_vault.gd")
const FieldEnemy := preload("res://games/saga_go/combat/field_enemy.gd")
const Elements := preload("res://games/saga_go/combat/elements.gd")
const Kits := preload("res://games/saga_go/data/kits.gd")

const CH33 := 32 # 33장(0부터)
const CH34 := 33
const CH35 := 34

var _p: CharacterBody3D
var _sq: Node
var _vr: Node
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
		_vr = get_tree().get_first_node_in_group("go_vault_region")
		_frame = 0
		return
	if _frame < 3 and _step == 0:
		return
	match _step:
		0: # 준비 — 33장 처음, 모험 등급 73
			_saved = {"story": PartyState.story.duplicate(true), "members": PartyState.members.duplicate(), "exp": PartyState.exp, "level": PartyState.level,
				"bag": PartyState.bag.duplicate(true), "ar_paid": PartyState.ar_paid, "resolved": EventState.resolved.duplicate(), "pos": _p.global_position,
				"wq": PartyState.world_quests.duplicate(true), "party_size": PartyState.party_size}
			PartyState.exp = maxf(PartyState.exp, 72.0 * PartyState.EXP_PER_LEVEL)
			PartyState.level = maxi(PartyState.level, 72)
			PartyState.ar_paid = maxi(PartyState.ar_paid, PartyState.level + 1)
			PartyState.story = {"ch": CH33, "step": 0}
			_sq.call("set_track", "")
			_sq.call("_enter_step")
			_next()
		1: # [1] 표·자리
			if _frame < 80: # 갈무리 벌은 1초마다 이야기 상태를 본다
				return
			var c := Story.chapter(CH33)
			var steps: Array = c.steps
			var bad: Array = []
			if String(c.get("id", "")) != "ch33" or int(c.ar) <= int(Story.chapter(CH33 - 1).ar) or int(_sq.call("ch")) != CH33 or bool(_sq.call("locked")):
				bad.append("chapter ch=%d locked=%s" % [_sq.call("ch"), _sq.call("locked")])
			var types := steps.map(func(s: Dictionary) -> String: return String(s.type))
			if types != ["talk", "talk", "go", "kill", "chase", "talk"]:
				bad.append("types %s" % [types])
			if Vault.CH33 != CH33 or not bool(_vr.call("is_gate_open")):
				bad.append("CH33 %d gate=%s" % [Vault.CH33, _vr.call("is_gate_open")])
			if TestMap.region_at(_sq.call("npc_pos", "bandi")) != "amber":
				bad.append("bandi %s" % _sq.call("npc_pos", "bandi"))
			if _flat(_sq.call("npc_pos", "haram"), _cell("frost", Vector2(3.85, 1.7))) > 0.5:
				bad.append("haram %s" % _sq.call("npc_pos", "haram"))
			if not bool(_sq.call("npc_visible", "maru")) or _flat(_sq.call("npc_pos", "maru"), _cell("vault", Vector2(6.2, 5.2))) > 0.5:
				bad.append("maru %s" % _sq.call("npc_pos", "maru"))
			var spots: Array = (steps[4].path as Array).duplicate()
			spots.append_array([steps[2].cell, steps[3].cell, Vector2(6.2, 5.2), Vector2(6.0, 5.3)])
			for pt in spots:
				var wp := _cell("vault", pt)
				if TestMap.region_at(wp) != "vault" or not _hits(wp).is_empty():
					bad.append("spot %s %s" % [pt, _hits(wp)])
			_check("ch33_table", bad.is_empty(), str(bad))
			_next()
		2: # [2] 반디 → 하람 — 반디는 고원 관측소로 먼저
			_talk("bandi", 1, "ch33_bandi", "frost", Vector2(3.85, 1.7))
		3: # [3] 하람 → 벌 어귀 — 반디는 갈무리 벌로
			if _frame == 1:
				_v = TestMap.region_at(_sq.call("npc_pos", "bandi")) == "frost"
			if _frame == 32: # 하람과 이야기를 마친 뒤(interact 는 30)
				_v = bool(_v) and TestMap.region_at(_sq.call("npc_pos", "bandi")) == "vault"
			_talk("haram", 2, "ch33_haram", "vault", Vector2(0.9, 3.0), 10, "bandi_moved=%s" % _v, _v == true)
		4: # [4] 벌 어귀
			if _frame == 1:
				_put(_target() + Vector3(0, 0, -2))
			if _frame == 20:
				var ok: bool = int(_sq.call("st")) == 3 and _flat(_target(), _cell("vault", Vector2(5.6, 4.6))) < 0.5
				_check("ch33_pass", ok, "st=%d target=%s" % [_sq.call("st"), _target()])
				_next()
		5: # [5] 야적장 결정 짐승 넷
			if _frame == 1:
				_put(_target() + Vector3(0, 0, 6))
			if _frame == 10:
				var es: Array = _sq.call("alive_quest_enemies")
				_v = {"n": es.size(), "vault": es.all(func(e: Node3D) -> bool: return TestMap.region_at(e.global_position) == "vault")}
				for e in es:
					e.call("_die")
			if _frame == 16:
				_check("ch33_kill", int(_v.n) == 4 and bool(_v.vault) and int(_sq.call("st")) == 4, "%s st=%d" % [_v, _sq.call("st")])
				_next()
		6: # [6] 운반 드론 쫓기 — 달아나다 따라잡힘
			if _frame == 1:
				var th := _sq.get("_thief") as Node3D
				if th:
					_put(th.global_position + Vector3(0.0, 0.0, 6.0))
			if _frame == 40:
				var cs: Dictionary = _sq.call("chase_state")
				var th := _sq.get("_thief") as Node3D
				_v = {"run": bool(cs.run), "vault": th != null and TestMap.region_at(th.global_position) == "vault", "drone": th != null and th.find_child("Mask", true, false) == null}
				_put(Vector3(cs.pos) + Vector3(0.0, 0.5, 1.0))
			if _frame == 52:
				var ok: bool = bool(_v.run) and bool(_v.vault) and bool(_v.drone) and int(_sq.call("st")) == 5 and _sq.get("_thief") == null
				_check("ch33_chase", ok, "%s st=%d thief=%s" % [_v, _sq.call("st"), _sq.get("_thief") != null])
				_next()
		7: # [7] 마루 → 33장 끝
			if _frame == 1:
				_v = {"mora": PartyState.count("mora")}
				_near_npc("maru")
			if _frame == 10:
				_sq.call("interact")
				_drain()
			if _frame < 16:
				return
			_dismiss_prompts()
			if _frame < 60:
				return
			_sq.call("toggle_journal")
			var jt: String = _sq.call("journal_text")
			_sq.call("toggle_journal")
			var ok: bool = int(_sq.call("ch")) == CH33 + 1 and jt.contains("✔ 제33장") and PartyState.count("mora") >= int(_v.mora) + 150000 \
				and bool(_sq.call("npc_visible", "maru")) and TestMap.region_at(_sq.call("npc_pos", "bandi")) == "vault"
			_check("chapter33", ok, "ch=%d mora +%d bandi=%s" % [_sq.call("ch"), PartyState.count("mora") - int(_v.mora), TestMap.region_at(_sq.call("npc_pos", "bandi"))])
			_next()
		8: # [8] 34장 표·자리
			if _frame < 80:
				return
			var c := Story.chapter(CH34)
			var steps: Array = c.steps
			var bad: Array = []
			if String(c.get("id", "")) != "ch34" or int(c.ar) <= int(Story.chapter(CH33).ar) or int(_sq.call("ch")) != CH34 or bool(_sq.call("locked")):
				bad.append("chapter ch=%d locked=%s" % [_sq.call("ch"), _sq.call("locked")])
			var types := steps.map(func(sd: Dictionary) -> String: return String(sd.type))
			if types != ["talk", "seal", "talk", "defend", "light", "light", "talk"]:
				bad.append("types %s" % [types])
			var sl: Dictionary = steps[Vault.GRANARY_OPEN_STEP - 1]
			if Vault.CH34 != CH34 or String(sl.type) != "seal" or sl.cell != Vault.GRANARY_CELL or not bool(sl.get("bare", false)):
				bad.append("seal/granary")
			for k in 2:
				var lt: Dictionary = steps[int(Vault.PYLON_OFF_FROM[k]) - 1]
				if String(lt.type) != "light" or lt.cell != Vault.PYLONS[k][1] or not bool(lt.get("bare", false)):
					bad.append("pylon %d" % k)
			if Vault.DOOR_OPEN_STEP != steps.size() - 1:
				bad.append("door step %d" % Vault.DOOR_OPEN_STEP)
			var df: Dictionary = steps[3]
			var dc := _cell("vault", df.cell)
			if String(df.type) != "defend" or not _hits(dc).is_empty():
				bad.append("defend spot %s" % [_hits(dc)])
			for d in df.dirs: # 물결이 나오는 자리 — 갈무리 벌 안, 명소에 안 걸림
				var a := deg_to_rad(float(d))
				var wp := dc + Vector3(sin(a), 0.0, -cos(a)) * Story.DEFEND_RING
				wp.y = TerrainBuilder.height_at("vault", wp)
				if TestMap.region_at(wp) != "vault" or not _hits(wp).is_empty():
					bad.append("wave dir %d %s" % [d, _hits(wp)])
			for pt in [Vector2(1.15, 5.5), Vector2(1.62, 5.62), Vector2(4.0, 2.3)]:
				if not _hits(_cell("vault", pt)).is_empty():
					bad.append("npc spot %s %s" % [pt, _hits(_cell("vault", pt))])
			if bool(_sq.call("npc_visible", "sodam")) or not bool(_vr.call("granary_locked")) or not bool(_vr.call("pylon_lit", 0)) \
					or not bool(_vr.call("pylon_lit", 1)) or bool(_vr.call("is_door_open")):
				bad.append("world at st0 sodam=%s" % _sq.call("npc_visible", "sodam"))
			if _flat(_sq.call("npc_pos", "maru"), _cell("vault", Vector2(6.2, 5.2))) > 0.5:
				bad.append("maru %s" % _sq.call("npc_pos", "maru"))
			_check("ch34_table", bad.is_empty(), str(bad))
			_next()
		9: # [9] 마루 → 석등 — 마루는 곳간 앞으로
			if _frame == 12:
				_v = _flat(_sq.call("npc_pos", "maru"), _cell("vault", Vector2(1.62, 5.62))) < 0.5
			_talk("maru", 1, "ch34_maru", "vault", Vault.GRANARY_CELL, 0, "maru_at_granary=%s" % _v, _v == true)
		10: # [10] 곳간 석등 — 해 먼저(틀림) → 별 → 해 → 달 → 곳간 문 열림
			if _frame == 1:
				_put(_target() + Vector3(0.0, 0.0, 9.0))
			if _frame == 6:
				_v = {"lit": []}
				for mk in ["sun", "star", "sun", "moon"]:
					_sq.call("receive_element", _sq.call("seal_lamp_pos", mk), 0.5, "fire")
					_v.lit.append(int(_sq.call("seal_lit")))
			if _frame == 150:
				var ok: bool = _v.lit == [0, 1, 2, 3] and int(_sq.call("st")) == 2 and not bool(_vr.call("granary_locked"))
				_check("ch34_seal", ok, "lit=%s st=%d locked=%s" % [_v.lit, _sq.call("st"), _vr.call("granary_locked")])
				_next()
		11: # [11] 소담(곳간 문 앞) → 곳간 지키기
			if _frame == 1:
				_v = bool(_sq.call("npc_visible", "sodam")) and _flat(_sq.call("npc_pos", "sodam"), _cell("vault", Vector2(1.15, 5.5))) < 0.5
			_talk("sodam", 3, "ch34_sodam", "vault", Vector2(1.4, 5.55), 0, "sodam=%s" % _v, _v == true)
		12: # [12] 곳간 지키기 — 물결 셋
			if _frame == 1:
				_put(_target() + Vector3(0.0, 0.0, 3.0))
				_v = {"n": 0, "waves": 0, "label": "", "vault": true}
			if _frame > 4 and _frame % 6 == 0 and int(_sq.call("st")) == 3:
				var lbl := _sq.get("_defend_label") as Label3D
				if lbl and String(_v.label) == "":
					_v.label = lbl.text
				for e in _sq.call("alive_quest_enemies"):
					_v.n += 1
					_v.vault = bool(_v.vault) and TestMap.region_at(e.global_position) == "vault"
					e.call("_die")
				_v.waves = maxi(int(_v.waves), int(_sq.call("defend_wave")) + 1)
			if _frame > 4 and (int(_sq.call("st")) != 3 or _frame > 600):
				var ok: bool = int(_sq.call("st")) == 4 and int(_v.n) == 12 and int(_v.waves) == 3 and String(_v.label).begins_with("씨앗 곳간") and bool(_v.vault)
				_check("ch34_defend", ok, "st=%d n=%d waves=%d label='%s' vault=%s frames=%d" % [_sq.call("st"), _v.n, _v.waves, _v.label, _v.vault, _frame])
				_next()
		13: # [13] 서쪽 동력 기둥 — 먼 원소는 안 됨 → 꺼짐(동쪽·문은 그대로), 소담은 금고 문 앞
			var tp := Vault.pylon_pos(0)
			if _frame == 1:
				_put(tp + Vector3(0, 0, 3.0))
			if _frame == 4:
				_sq.call("receive_element", tp + Vector3(15, 0, 0), 3.0, "fire")
			if _frame == 8:
				_v = int(_sq.call("st"))
				_sq.call("receive_element", tp + Vector3(0.4, 0, 0.4), 3.0, "thunder")
			if _frame == 150:
				var ok: bool = int(_v) == 4 and int(_sq.call("st")) == 5 and not bool(_vr.call("pylon_lit", 0)) and bool(_vr.call("pylon_lit", 1)) \
					and not bool(_vr.call("is_door_open")) and _flat(_sq.call("npc_pos", "sodam"), _cell("vault", Vector2(4.0, 2.3))) < 0.5
				_check("ch34_pylon_w", ok, "far_st=%d st=%d lit=%s/%s door=%s" % [_v, _sq.call("st"), _vr.call("pylon_lit", 0), _vr.call("pylon_lit", 1), _vr.call("is_door_open")])
				_next()
		14: # [14] 동쪽 동력 기둥 → 금고 문 열림
			var tp := Vault.pylon_pos(1)
			if _frame == 1:
				_put(tp + Vector3(0, 0, 3.0))
			if _frame == 6:
				_sq.call("receive_element", tp + Vector3(0.4, 0, 0.4), 3.0, "water")
			if _frame == 150:
				var ok: bool = int(_sq.call("st")) == 6 and not bool(_vr.call("pylon_lit", 1)) and bool(_vr.call("is_door_open"))
				_check("ch34_pylon_e", ok, "st=%d lit=%s door=%s" % [_sq.call("st"), _vr.call("pylon_lit", 1), _vr.call("is_door_open")])
				_next()
		15: # [15] 소담(금고 문 앞) → 34장 끝
			if _frame == 1:
				_v = {"mora": PartyState.count("mora")}
				_near_npc("sodam")
			if _frame == 10:
				_sq.call("interact")
				_drain()
			if _frame < 16:
				return
			_dismiss_prompts()
			if _frame < 60:
				return
			_sq.call("toggle_journal")
			var jt: String = _sq.call("journal_text")
			_sq.call("toggle_journal")
			var ok: bool = int(_sq.call("ch")) == CH34 + 1 and jt.contains("✔ 제34장") and PartyState.count("mora") >= int(_v.mora) + 155000 \
				and bool(_vr.call("is_door_open")) and bool(_sq.call("npc_visible", "sodam")) and _flat(_sq.call("npc_pos", "sodam"), _cell("vault", Vector2(4.0, 2.3))) < 0.5
			_check("chapter34", ok, "ch=%d mora +%d door=%s" % [_sq.call("ch"), PartyState.count("mora") - int(_v.mora), _vr.call("is_door_open")])
			_next()
		16: # [16] 35장 표·자리
			if _frame < 80:
				return
			var c := Story.chapter(CH35)
			var steps: Array = c.steps
			var bad: Array = []
			if String(c.get("id", "")) != "ch35" or int(c.ar) <= int(Story.chapter(CH34).ar) or int(_sq.call("ch")) != CH35 or bool(_sq.call("locked")) \
					or String(c.get("join", "")) != "story_haemi":
				bad.append("chapter ch=%d locked=%s" % [_sq.call("ch"), _sq.call("locked")])
			var types := steps.map(func(sd: Dictionary) -> String: return String(sd.type))
			if types != ["talk", "go", "talk", "climb", "talk", "duel", "talk"]:
				bad.append("types %s" % [types])
			var cl: Dictionary = steps[3]
			if Vault.CH35 != CH35 or cl.cell != Vault.VAULT_CELL or not is_equal_approx(float(cl.above), Vault.PILLAR_H):
				bad.append("climb")
			if String(steps[Vault.CORE_DIM_STEP - 1].get("npc", "")) != "garmuri":
				bad.append("core step")
			var du: Dictionary = steps[Vault.HAEMI_FREE_STEP - 1]
			if String(du.type) != "duel" or String(du.kind) != "vault_queen" or String(FieldEnemy.KINDS.vault_queen.element) != "wind" \
					or Elements.shield_mul("wind", "rock") <= 1.0 or not _hits(_cell("vault", du.cell)).is_empty():
				bad.append("duel %s" % [_hits(_cell("vault", du.cell))])
			var m: Dictionary = Story.MEMBERS.get("story_haemi", {})
			if String(m.get("era", "")) != "미래" or Elements.element_of("story_haemi") != "grass" or String(m.get("weapon", "")) != "sword" or not Kits.KITS.has("story_haemi"):
				bad.append("member %s" % m)
			var hp := Vault.case_pos(Vault.HAEMI_CASE_DEG)
			if _flat(_cell("vault", Story.NPCS.haemi.cell), hp) > 0.3 or bool(_sq.call("npc_visible", "haemi")) or bool(_sq.call("npc_visible", "garmuri")):
				bad.append("haemi cell/visible")
			for pt in [Vector2(4.0, 1.6667), steps[1].cell]:
				if not _hits(_cell("vault", pt)).is_empty():
					bad.append("spot %s %s" % [pt, _hits(_cell("vault", pt))])
			if not bool(_vr.call("core_lit")) or not bool(_vr.call("haemi_sealed")) or not bool(_vr.call("is_door_open")):
				bad.append("world at st0")
			_check("ch35_table", bad.is_empty(), str(bad))
			_next()
		17: # [17] 소담(금고 문 앞) → 금고 안
			_talk("sodam", 1, "ch35_sodam", "vault", Vector2(4.0, 1.6))
		18: # [18] 금고 안 — 문 밖에선 안 넘어가고, 안에 들어서면 넘어감(해미 보임·소담은 문 안쪽)
			if _frame == 1:
				_put(Vault.cell_pos(Vault.VAULT_CELL) + Vector3(0, 0, Vault.VAULT_R + 3.0))
			if _frame == 20:
				_v = int(_sq.call("st"))
				_put(_target())
			if _frame == 110:
				var ok: bool = int(_v) == 1 and int(_sq.call("st")) == 2 and bool(_sq.call("npc_visible", "haemi")) \
					and _flat(_sq.call("npc_pos", "sodam"), _cell("vault", Vector2(4.0, 1.6667))) < 0.5
				_check("ch35_enter", ok, "out_st=%d st=%d haemi=%s sodam=%s" % [_v, _sq.call("st"), _sq.call("npc_visible", "haemi"), _sq.call("npc_pos", "sodam")])
				_next()
		19: # [19] 해미(진열장 속) → 기록 기둥
			_talk("haemi", 3, "ch35_haemi", "vault", Vault.VAULT_CELL, 0, "sealed=%s" % _vr.call("haemi_sealed"), bool(_vr.call("haemi_sealed")))
		20: # [20] 기록 기둥 — 발치에선 안 넘어가고 윗면에 서면 넘어감 · 갈무리가 핵 곁에
			if _frame == 1:
				_put(_cell("vault", Vault.VAULT_CELL + Vector2(0.0, 2.5 / TestMap.TILE_SIZE)))
			if _frame == 20:
				_v = int(_sq.call("st"))
				_put(Vault.pillar_top() + Vector3(0.6, 0.3, 0.6))
			if _frame == 60:
				var ok: bool = int(_v) == 3 and int(_sq.call("st")) == 4 and absf(_p.global_position.y - Vault.pillar_top().y) < 0.6 and bool(_sq.call("npc_visible", "garmuri"))
				_check("ch35_climb", ok, "base_st=%d st=%d y=%.2f/%.2f garmuri=%s" % [_v, _sq.call("st"), _p.global_position.y, Vault.pillar_top().y, _sq.call("npc_visible", "garmuri")])
				_next()
		21: # [21] 갈무리(기둥 윗면에서 말이 닿음) → 핵이 꺼지고 갈무리는 사라짐
			if _frame == 4:
				_sq.call("interact")
				_drain()
			if _frame == 90:
				var ok: bool = int(_sq.call("st")) == 5 and not bool(_vr.call("core_lit")) and not bool(_sq.call("npc_visible", "garmuri")) \
					and _flat(_target(), _cell("vault", Vector2(4.0, 2.45))) < 12.0 # 목표 = 서 있는 보스 자리(돌아다님)
				_check("ch35_garmuri", ok, "st=%d core=%s garmuri=%s target=%s want=%s" % [_sq.call("st"), _vr.call("core_lit"), _sq.call("npc_visible", "garmuri"), _target(), _cell("vault", Vector2(4.0, 2.45))])
				_next()
		22: # [22] 금고 파수 드론 여왕 — 광장, 밀물 줄 예고 → 쓰러뜨리면 해미 진열장이 깨짐
			if _frame == 1:
				_put(_target() + Vector3(0, 0, 8))
			if _frame == 12:
				var bosses := get_tree().get_nodes_in_group("go_story_boss")
				var bo: Node3D = bosses[0] if not bosses.is_empty() else null
				_v = {"n": bosses.size(), "marks": 0, "kind": "", "vault": false}
				if bo:
					_v.kind = String(bo.get("kind"))
					_v.vault = TestMap.region_at(bo.global_position) == "vault"
					bo.call("_clear_marks")
					bo.call("_set_tell", false)
					bo.call("begin_skill", "tide", _p)
					_v.marks = (bo.get("_marks") as Array).size()
					bo.call("_clear_marks")
					bo.call("_die")
			if _frame == 150:
				var ok: bool = int(_v.n) == 1 and String(_v.kind) == "vault_queen" and bool(_v.vault) and int(_v.marks) >= 1 and int(_sq.call("st")) == 6 \
					and not bool(_vr.call("haemi_sealed"))
				_check("ch35_duel", ok, "n=%d kind=%s marks=%d st=%d sealed=%s" % [_v.n, _v.kind, _v.marks, _sq.call("st"), _vr.call("haemi_sealed")])
				_next()
		23: # [23] 해미(깨진 진열장 앞) → 35장 끝·동료 해미 = 10부 끝
			if _frame == 1:
				_v = {"mora": PartyState.count("mora")}
				_near_npc("haemi")
			if _frame == 10:
				_sq.call("interact")
				_drain()
			if _frame < 16:
				return
			_dismiss_prompts()
			if _frame < 60:
				return
			_sq.call("toggle_journal")
			var jt: String = _sq.call("journal_text")
			_sq.call("toggle_journal")
			var ok: bool = int(_sq.call("ch")) == CH35 + 1 and jt.contains("✔ 제35장") and PartyState.count("mora") >= int(_v.mora) + 175000 \
				and PartyState.members.has("story_haemi") and bool(_sq.call("npc_visible", "haemi"))
			_check("chapter35", ok, "ch=%d mora +%d joined=%s" % [_sq.call("ch"), PartyState.count("mora") - int(_v.mora), PartyState.members.has("story_haemi")])
			_next()
		24:
			_finish()

func _finish() -> void:
	PartyState.story = _saved.story
	PartyState.members.assign(_saved.members)
	PartyState.party_size = int(_saved.party_size)
	PartyState.exp = _saved.exp
	PartyState.level = _saved.level
	PartyState.bag = _saved.bag
	PartyState.ar_paid = _saved.ar_paid
	EventState.resolved.assign(_saved.resolved)
	PartyState.world_quests = _saved.wq
	_p.global_position = _saved.pos
	print("STORY10_PROBE_DONE fails=%d" % _fails)
	get_tree().quit()

func _talk(npc: String, want_st: int, name: String, next_region: String, next_cell: Vector2, from := 0, extra := "", extra_ok := true) -> void:
	if _frame == 2 + from * 2:
		_near_npc(npc)
	if _frame == 10 + from * 2:
		_sq.call("interact")
		_drain()
	if _frame == 14 + from * 2:
		var tgt_ok := _flat(_target(), TestMap.world_pos(next_cell.x, next_cell.y, next_region)) < 0.5
		_check(name, int(_sq.call("st")) == want_st and tgt_ok and extra_ok, "st=%d target=%s %s" % [_sq.call("st"), _target(), extra])
		_next()

## 그 자리 1.6m 위 반지름 1.2 에 걸리는 충돌(집·금고·창고·컨테이너) — probe_story9 와 같다.
func _hits(pos: Vector3) -> Array:
	var q := PhysicsShapeQueryParameters3D.new()
	var sph := SphereShape3D.new()
	sph.radius = 1.2
	q.shape = sph
	q.collision_mask = 1
	q.exclude = [_p.get_rid()]
	q.transform = Transform3D(Basis(), pos + Vector3(0, 1.6, 0))
	var out: Array = []
	for hit in _p.get_world_3d().direct_space_state.intersect_shape(q, 4):
		out.append(String((hit.collider as Node).name))
	return out

func _target() -> Vector3:
	return _sq.call("target_pos")

func _cell(region: String, cell: Vector2) -> Vector3:
	var p := TestMap.world_pos(cell.x, cell.y, region)
	p.y = TerrainBuilder.height_at(region, p)
	return p

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
	print("STORY10_PROBE %s %s %s" % [name, "ok" if ok else "FAIL", detail])

func _next() -> void:
	_step += 1
	_frame = 0
	_v = null
	_pressed.clear() # 장 끝 카드는 같은 노드가 다시 뜬다 — 단계마다 다시 누를 수 있게
