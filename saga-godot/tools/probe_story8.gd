extends Node
## GO 이야기 8부(PLAN 106장 52, 27장~) 자동 점검 — 평소엔 안 붙는다. 7부 probe_story7 · 무대 probe_storm_eye.
## test_village.gd 가 SAGA_STORY8_PROBE 가 있을 때만 단다.
##
##   SAGA_STORY8_PROBE=1 "$GODOT" --headless --path saga-godot res://games/saga_go/world/TestVillage.tscn
##
## 27장 "풀리는 매듭"(52-2): [1] 표·자리(매듭 셋 = light·seal·light 칸 · 나그네·해솔 처음엔 없음 · 반디는 촌장 곁 · 매듭 모두 연기)
## [2] 촌장 → 은비 [3] 은비 → 졸개 [4] 첫째 매듭 졸개 넷(폐허) [5] 첫째 매듭 불 — 먼 원소 안 됨 → 매듭 0 불·줄
## [6] 둘째 매듭 석등 — 틀리면 꺼짐 · 달 → 별 → 해 → 매듭 1 불 [7] 나그네(보임) → 봉우리 [8] 봉우리 꼭대기(위에 서야 넘어감)
## [9] 셋째 매듭 → 매듭 2 불·넷째는 아직 연기 [10] 해솔 → 27장 끝·보상.
## 28장 "여섯째 매듭"(52-3): [11] 표·자리(매듭 셋 = light·seal·light(구름섬) 칸 · 가면 그림자 처음엔 없음 · 눈 안 보임) [12] 버들 → 곶
## [13] 넷째 매듭 지키기(물결 셋) [14] 넷째 매듭 불 [15] 버들의 배 → 바위섬(사공도 섬에) [16] 다섯째 매듭 석등 해 → 별 → 달
## [17] 구름섬에 서면 넘어감 [18] 구름섬 무리 다섯 [19] 여섯째 매듭 → 줄 여섯이 매듭 등불로 [20] 가면 그림자(가면) → 나그네
## [21] 나그네 → 28장 끝·먹구름 눈 보임·바람 기둥 섬.
## 29장 "먹구름의 근원"(52-4, 1차 결말): [22] 표·자리(동료마다 시대 · 편성·눈 오르기·지키기(bare)·대결 칸 · 임금 뇌·불이 방패를 깸 · 눈 위 인물 자리)
## [23] 촌장 → 편성 [24] 편성 시험 — 과거만 셋이면 안 넘어가고(목표 글 미래 ✗), 과거·현대·미래 하나씩이면 넘어감
## [25] 구름섬 서쪽 바람 기둥을 실제로 타고 활공해 눈에 내려섬 [26] 임금(가면) → 지키기 [27] 매듭 등불 지키기(물결 셋 눈 위·돌 안 보임)
## [28] 먹구름 임금 참몸(눈 위) → 소용돌이 걷힘 [29] 해솔 → 광장 [30] 광장에 닿음 [31] 촌장 → 29장 끝·보상·줄 거둠.
## 이야기 상태·부대 경험·가방은 끝에 되돌린다. 저장은 안 한다.

const Story := preload("res://games/saga_go/data/story.gd")
const TestMap := preload("res://games/saga_go/data/test_map.gd")
const TerrainBuilder := preload("res://games/saga_go/world/terrain_builder.gd")
const StormEye := preload("res://games/saga_go/world/storm_eye.gd")

const CH27 := 26 # 27장(0부터)
const CH28 := 27
const CH29 := 28
const FieldEnemy := preload("res://games/saga_go/combat/field_enemy.gd")
const Elements := preload("res://games/saga_go/combat/elements.gd")
const SkyIsle := preload("res://games/saga_go/world/sky_isle.gd")

var _p: CharacterBody3D
var _sq: Node
var _se: Node
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
		_se = get_tree().get_first_node_in_group("go_storm_eye")
		_frame = 0
		return
	if _frame < 3 and _step == 0:
		return
	match _step:
		0: # 준비 — 27장 처음, 모험 등급 61
			_saved = {"story": PartyState.story.duplicate(true), "members": PartyState.members.duplicate(), "exp": PartyState.exp, "level": PartyState.level,
				"bag": PartyState.bag.duplicate(true), "ar_paid": PartyState.ar_paid, "resolved": EventState.resolved.duplicate(), "pos": _p.global_position,
				"wq": PartyState.world_quests.duplicate(true), "party_size": PartyState.party_size}
			PartyState.exp = maxf(PartyState.exp, 61.0 * PartyState.EXP_PER_LEVEL)
			PartyState.level = maxi(PartyState.level, 61)
			PartyState.ar_paid = maxi(PartyState.ar_paid, PartyState.level + 1)
			PartyState.story = {"ch": CH27, "step": 0}
			_sq.call("set_track", "")
			_sq.call("_enter_step")
			_next()
		1: # [1] 표·자리
			if _frame < 40: # 매듭은 30프레임마다 본다
				return
			var c := Story.chapter(CH27)
			var steps: Array = c.steps
			var bad: Array = []
			if String(c.get("id", "")) != "ch27" or int(c.ar) <= int(Story.chapter(CH27 - 1).ar) or int(_sq.call("ch")) != CH27 or bool(_sq.call("locked")) or steps.size() != 9:
				bad.append("chapter ch=%d locked=%s steps=%d" % [_sq.call("ch"), _sq.call("locked"), steps.size()])
			## 매듭 셋 = 폐허 light(3) · 옛길 seal(4) · 봉우리 light(7) 칸, 묶이는 단계 = 그다음
			for pair in [[0, 3, "light"], [1, 4, "seal"], [2, 7, "light"]]:
				var k: int = pair[0]
				var sd: Dictionary = steps[pair[1]]
				var kr: Array = StormEye.KNOTS[k]
				if String(sd.type) != String(pair[2]) or String(sd.region) != String(kr[0]) or sd.cell != kr[1] or int(kr[4]) != CH27 or int(kr[5]) != int(pair[1]) + 1:
					bad.append("knot %d" % k)
			if bool(_sq.call("npc_visible", "wanderer")) or bool(_sq.call("npc_visible", "haesol_free")):
				bad.append("wanderer/haesol at st0")
			if _flat(_sq.call("npc_pos", "bandi"), _sq.call("npc_pos", "elder")) > 12.0:
				bad.append("bandi not by elder %s" % _sq.call("npc_pos", "bandi"))
			if not range(6).all(func(k: int) -> bool: return bool(_se.call("knot_smoking", k))):
				bad.append("knots not smoking")
			_check("ch27_table", bad.is_empty(), str(bad))
			_next()
		2: # [2] 촌장 → 은비
			_talk("elder", 1, "ch27_elder", "ruins", Vector2(3.1, 2.35))
		3: # [3] 은비 → 졸개
			_talk("scholar", 2, "ch27_scholar", "ruins", Vector2(2.75, 2.7))
		4: # [4] 첫째 매듭 졸개 넷
			if _frame == 1:
				_put(_target() + Vector3(0, 0, 6))
			if _frame == 10:
				var es: Array = _sq.call("alive_quest_enemies")
				_v = es.size()
				for e in es:
					e.call("_die")
			if _frame == 16:
				_check("ch27_kill", int(_v) == 4 and int(_sq.call("st")) == 3, "n=%d st=%d" % [_v, _sq.call("st")])
				_next()
		5: # [5] 첫째 매듭 불 — 먼 원소는 안 됨
			var tp := _cell("ruins", Vector2(2.75, 2.7))
			if _frame == 1:
				_put(tp + Vector3(0, 0, 2.5))
			if _frame == 4:
				_sq.call("receive_element", tp + Vector3(15, 0, 0), 3.0, "fire")
			if _frame == 8:
				_v = int(_sq.call("st"))
				_sq.call("receive_element", tp + Vector3(0.4, 0, 0.4), 3.0, "fire")
			if _frame == 110:
				var ok: bool = int(_v) == 3 and int(_sq.call("st")) == 4 and bool(_se.call("knot_lit", 0)) and bool(_se.call("beam_visible", 0)) and bool(_se.call("knot_smoking", 1))
				_check("ch27_light1", ok, "far_st=%d st=%d lit0=%s beam0=%s" % [_v, _sq.call("st"), _se.call("knot_lit", 0), _se.call("beam_visible", 0)])
				_next()
		6: # [6] 둘째 매듭 석등 — 해 먼저(틀림) → 달 → 별 → 해
			if _frame == 1:
				_put(_target() + Vector3(0.0, 0.0, 3.0))
				_v = {"lit": []}
			if _frame == 6:
				for mk in ["sun", "moon", "star", "sun"]:
					_sq.call("receive_element", _sq.call("seal_lamp_pos", mk), 0.5, "wind")
					_v.lit.append(int(_sq.call("seal_lit")))
			if _frame == 120:
				var ok: bool = _v.lit == [0, 1, 2, 3] and int(_sq.call("st")) == 5 and bool(_se.call("knot_lit", 1))
				_check("ch27_seal", ok, "lit=%s st=%d lit1=%s" % [_v.lit, _sq.call("st"), _se.call("knot_lit", 1)])
				_next()
		7: # [7] 나그네(둘째 매듭 곁) → 봉우리
			if _frame == 1:
				_v = bool(_sq.call("npc_visible", "wanderer")) and _flat(_sq.call("npc_pos", "wanderer"), _cell("village", Vector2(1.15, 1.3))) < 9.0
			_talk("wanderer", 6, "ch27_wanderer", "village", Vector2(7.1, 1.5), "near=%s" % _v, bool(_v), 1)
		8: # [8] 봉우리 — 밑에선 안 넘어가고 꼭대기에 서면 넘어간다
			var top := _cell("village", Vector2(7.1, 1.5))
			if _frame == 1:
				_put(_cell("village", Vector2(6.5, 2.2)))
			if _frame == 20:
				_v = int(_sq.call("st"))
				_put(top + Vector3(0, 0.5, 0))
			if _frame == 40:
				_check("ch27_climb", int(_v) == 6 and int(_sq.call("st")) == 7, "below_st=%d st=%d" % [_v, _sq.call("st")])
				_next()
		9: # [9] 셋째 매듭 → 해솔
			var tp := _cell("village", Vector2(7.0, 1.3))
			if _frame == 1:
				_put(tp + Vector3(0, 0, 2.0))
			if _frame == 6:
				_sq.call("receive_element", tp + Vector3(0.3, 0, 0.3), 3.0, "fire")
			if _frame == 110:
				var ok: bool = int(_sq.call("st")) == 8 and bool(_se.call("knot_lit", 2)) and bool(_se.call("knot_smoking", 3)) and bool(_sq.call("npc_visible", "haesol_free"))
				_check("ch27_light3", ok, "st=%d lit2=%s smoke3=%s haesol=%s" % [_sq.call("st"), _se.call("knot_lit", 2), _se.call("knot_smoking", 3), _sq.call("npc_visible", "haesol_free")])
				_next()
		10: # [10] 해솔 → 27장 끝
			if _frame == 1:
				_v = {"mora": PartyState.count("mora")}
				_near_npc("haesol_free")
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
			var ok: bool = int(_sq.call("ch")) == CH27 + 1 and jt.contains("✔ 제27장") and PartyState.count("mora") >= int(_v.mora) + 135000
			_check("chapter27", ok, "ch=%d mora +%d" % [_sq.call("ch"), PartyState.count("mora") - int(_v.mora)])
			_next()
		11: # [11] 28장 표·자리 — 모험 등급 63
			if _frame == 1:
				PartyState.exp = maxf(PartyState.exp, 63.0 * PartyState.EXP_PER_LEVEL)
				PartyState.level = maxi(PartyState.level, 63)
				PartyState.ar_paid = maxi(PartyState.ar_paid, PartyState.level + 1)
				_sq.call("_enter_step")
			if _frame < 40:
				return
			var c := Story.chapter(CH28)
			var steps: Array = c.steps
			var bad: Array = []
			if String(c.get("id", "")) != "ch28" or int(c.ar) <= int(Story.chapter(CH27).ar) or int(_sq.call("ch")) != CH28 or bool(_sq.call("locked")) or steps.size() != 10:
				bad.append("chapter ch=%d locked=%s steps=%d" % [_sq.call("ch"), _sq.call("locked"), steps.size()])
			for pair in [[3, 2, "light"], [4, 4, "seal"], [5, 7, "light"]]:
				var k: int = pair[0]
				var sd: Dictionary = steps[pair[1]]
				var kr: Array = StormEye.KNOTS[k]
				if String(sd.type) != String(pair[2]) or String(sd.region) != String(kr[0]) or sd.cell != kr[1] or bool(sd.get("sky", false)) != bool(kr[2]) \
						or int(kr[4]) != CH28 or int(kr[5]) != int(pair[1]) + 1:
					bad.append("knot %d" % k)
			if bool(_sq.call("npc_visible", "gamyeon")) or bool(_se.call("is_shown")):
				bad.append("gamyeon=%s eye=%s at st0" % [_sq.call("npc_visible", "gamyeon"), _se.call("is_shown")])
			var lit := range(6).filter(func(k: int) -> bool: return bool(_se.call("knot_lit", k)))
			if lit != [0, 1, 2]:
				bad.append("lit %s" % [lit])
			## 구름섬 인물 자리 — 윗면·섬 안
			var ch28w := func(v: Variant) -> Dictionary: return Story.windows(v).filter(func(x: Dictionary) -> bool: return int(x.ch) == CH28).back()
			for w in [ch28w.call(Story.NPCS.gamyeon.appear), ch28w.call(Story.NPCS.wanderer.appear)]:
				var d: Dictionary = w
				var sp := TestMap.world_pos(d.cell.x, d.cell.y, "village")
				sp.y = SkyIsle.top_y()
				if int(d.ch) != CH28 or not bool(d.get("sky", false)) or not SkyIsle.on_isle(sp) or _flat(sp, SkyIsle.center()) > SkyIsle.RADIUS - 2.0:
					bad.append("isle spot %s" % [d.cell])
			_check("ch28_table", bad.is_empty(), str(bad))
			_next()
		12: # [12] 버들 → 곶
			_talk("ferryman", 1, "ch28_ferryman", "coast", Vector2(3.0, 4.5))
		13: # [13] 넷째 매듭 지키기 — 물결 셋
			if _frame == 1:
				_put(_target() + Vector3(2.5, 0.0, -2.5))
				_v = {"n": 0, "waves": 0, "label": ""}
			if _frame > 4 and _frame % 6 == 0 and int(_sq.call("st")) == 1:
				var lbl := _sq.get("_defend_label") as Label3D
				if lbl and String(_v.label) == "":
					_v.label = lbl.text
				for e in _sq.call("alive_quest_enemies"):
					_v.n += 1
					e.call("_die")
				_v.waves = maxi(int(_v.waves), int(_sq.call("defend_wave")) + 1)
			if _frame > 4 and (int(_sq.call("st")) != 1 or _frame > 600):
				var ok: bool = int(_sq.call("st")) == 2 and int(_v.n) == 12 and int(_v.waves) == 3 and String(_v.label).begins_with("넷째 매듭")
				_check("ch28_defend", ok, "st=%d n=%d waves=%d label='%s' frames=%d" % [_sq.call("st"), _v.n, _v.waves, _v.label, _frame])
				_next()
		14: # [14] 넷째 매듭 불
			var tp := _cell("coast", Vector2(3.0, 4.5))
			if _frame == 1:
				_put(tp + Vector3(0, 0, 2.5))
			if _frame == 6:
				_sq.call("receive_element", tp + Vector3(0.3, 0, 0.3), 3.0, "water")
			if _frame == 110:
				var ok: bool = int(_sq.call("st")) == 3 and bool(_se.call("knot_lit", 3)) and bool(_se.call("knot_smoking", 4))
				_check("ch28_light4", ok, "st=%d lit3=%s" % [_sq.call("st"), _se.call("knot_lit", 3)])
				_next()
		15: # [15] 버들의 배 → 바위섬
			if _frame == 1:
				_near_npc("ferryman")
			if _frame == 10:
				_sq.call("interact")
				_drain()
			if _frame == 40:
				var isle := _cell("coast", Vector2(6.03, 2.3))
				var ok: bool = int(_sq.call("st")) == 4 and _flat(_p.global_position, isle) < 6.0 and _flat(_sq.call("npc_pos", "ferryman"), isle) < 1.0
				_check("ch28_sail", ok, "st=%d pos=%s ferry=%s" % [_sq.call("st"), _p.global_position, _sq.call("npc_pos", "ferryman")])
				_next()
		16: # [16] 다섯째 매듭 석등 — 달 먼저(틀림) → 해 → 별 → 달
			if _frame == 1:
				_put(_target() + Vector3(0.0, 0.0, 3.0))
				_v = {"lit": []}
			if _frame == 6:
				for mk in ["moon", "sun", "star", "moon"]:
					_sq.call("receive_element", _sq.call("seal_lamp_pos", mk), 0.5, "fire")
					_v.lit.append(int(_sq.call("seal_lit")))
			if _frame == 120:
				var ok: bool = _v.lit == [0, 1, 2, 3] and int(_sq.call("st")) == 5 and bool(_se.call("knot_lit", 4))
				_check("ch28_seal", ok, "lit=%s st=%d lit4=%s" % [_v.lit, _sq.call("st"), _se.call("knot_lit", 4)])
				_next()
		17: # [17] 구름섬 — 서면 넘어간다
			if _frame == 1:
				_v = int(_sq.call("st"))
				_put(SkyIsle.center() + Vector3(3.0, 0.3, 3.0))
			if _frame == 20:
				_check("ch28_sky", int(_v) == 5 and int(_sq.call("st")) == 6 and bool(_sq.call("npc_visible", "wanderer")), "st0=%d st=%d" % [_v, _sq.call("st")])
				_next()
		18: # [18] 구름섬 무리 다섯 — 섬 위
			if _frame == 1:
				_put(SkyIsle.center() + Vector3(0, 0, 7))
			if _frame == 10:
				var es: Array = _sq.call("alive_quest_enemies")
				_v = {"n": es.size(), "on": es.filter(func(e: Node) -> bool: return SkyIsle.on_isle((e as Node3D).global_position, 2.0)).size()}
				for e in es:
					e.call("_die")
			if _frame == 16:
				_check("ch28_kill", int(_v.n) == 5 and int(_v.on) == 5 and int(_sq.call("st")) == 7, "%s st=%d" % [_v, _sq.call("st")])
				_next()
		19: # [19] 여섯째 매듭 → 줄 여섯이 매듭 등불로
			var tp := SkyIsle.center()
			if _frame == 1:
				_put(tp + Vector3(0, 0, 2.5))
			if _frame == 6:
				_sq.call("receive_element", tp + Vector3(0.3, 0, 0.3), 3.0, "wind")
			if _frame == 110:
				var lp := StormEye.lantern_pos()
				var conv := range(6).all(func(k: int) -> bool: return bool(_se.call("beam_visible", k)) and (_se.call("beam_end", k) as Vector3).distance_to(lp) < 0.2)
				var ok: bool = int(_sq.call("st")) == 8 and bool(_se.call("knot_lit", 5)) and conv and bool(_sq.call("npc_visible", "gamyeon")) and not bool(_se.call("is_shown"))
				_check("ch28_light6", ok, "st=%d lit5=%s conv=%s gamyeon=%s eye=%s" % [_sq.call("st"), _se.call("knot_lit", 5), conv, _sq.call("npc_visible", "gamyeon"), _se.call("is_shown")])
				_next()
		20: # [20] 가면 그림자 → 나그네
			if _frame == 1:
				var g := _sq.find_child("StoryNpc_gamyeon", true, false)
				_v = g != null and g.find_child("Mask", true, false) != null
			_talk("gamyeon", 9, "ch28_gamyeon", "village", Vector2.INF, "mask=%s" % _v, bool(_v), 1)
		21: # [21] 나그네 → 28장 끝 · 먹구름 눈
			if _frame == 1:
				_v = {"mora": PartyState.count("mora")}
				_near_npc("wanderer")
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
			var ok: bool = int(_sq.call("ch")) == CH28 + 1 and jt.contains("✔ 제28장") and PartyState.count("mora") >= int(_v.mora) + 140000 \
				and bool(_se.call("is_shown")) and bool(_se.call("vortex_visible")) and bool(_se.call("draft_active")) and not bool(_sq.call("npc_visible", "gamyeon"))
			_check("chapter28", ok, "ch=%d mora +%d eye=%s draft=%s" % [_sq.call("ch"), PartyState.count("mora") - int(_v.mora), _se.call("is_shown"), _se.call("draft_active")])
			_next()
		22: # [22] 29장 표·자리 — 모험 등급 65
			if _frame == 1:
				PartyState.exp = maxf(PartyState.exp, 65.0 * PartyState.EXP_PER_LEVEL)
				PartyState.level = maxi(PartyState.level, 65)
				PartyState.ar_paid = maxi(PartyState.ar_paid, PartyState.level + 1)
				_sq.call("_enter_step")
			if _frame < 40:
				return
			var c := Story.chapter(CH29)
			var steps: Array = c.steps
			var bad: Array = []
			if String(c.get("id", "")) != "ch29" or int(c.ar) <= int(Story.chapter(CH28).ar) or int(_sq.call("ch")) != CH29 or bool(_sq.call("locked")) or steps.size() != 9:
				bad.append("chapter ch=%d locked=%s steps=%d" % [_sq.call("ch"), _sq.call("locked"), steps.size()])
			for id in Story.MEMBERS:
				if not ["과거", "현대", "미래"].has(String(Story.MEMBERS[id].get("era", ""))):
					bad.append("era %s" % id)
			var types: Array = steps.map(func(d: Dictionary) -> String: return String(d.type))
			if types != ["talk", "party", "climb", "talk", "defend", "duel", "talk", "go", "talk"]:
				bad.append("types %s" % [types])
			if steps[1].eras != ["과거", "현대", "미래"] or not bool(steps[2].get("eye", false)) or not bool(steps[4].get("eye", false)) or not bool(steps[4].get("bare", false)):
				bad.append("party/climb/defend flags")
			var ec := StormEye.center()
			## 눈 위 자리 — 지키기·대결·임금·해솔
			var spots: Array = [steps[4], steps[5], Story.windows(Story.NPCS.gamyeon.appear).back(), Story.windows(Story.NPCS.haesol_free.appear).back()]
			for d in spots:
				var sp := TestMap.world_pos(d.cell.x, d.cell.y, String(d.region))
				if not bool(d.get("eye", false)) or _flat(sp, ec) > StormEye.EYE_R - 2.0:
					bad.append("eye spot %s r=%.1f" % [d.cell, _flat(sp, ec)])
			if _flat(TestMap.world_pos(steps[4].cell.x, steps[4].cell.y, "village"), ec) > 0.3:
				bad.append("defend not at lantern")
			if Story.DEFEND_RING > StormEye.EYE_R - 1.2:
				bad.append("wave ring outside rail")
			var du := TestMap.world_pos(steps[5].cell.x, steps[5].cell.y, "village")
			if String(steps[5].kind) != "storm_king_true" or String(FieldEnemy.KINDS.storm_king_true.element) != "thunder" or Elements.shield_mul("thunder", "fire") <= 1.0 or _flat(du, ec) < 5.0:
				bad.append("duel")
			if bool(_sq.call("npc_visible", "gamyeon")) or bool(_sq.call("npc_visible", "haesol_free")) or not bool(_se.call("draft_active")) or not bool(_se.call("vortex_visible")):
				bad.append("st0 gamyeon=%s haesol=%s draft=%s vortex=%s" % [_sq.call("npc_visible", "gamyeon"), _sq.call("npc_visible", "haesol_free"), _se.call("draft_active"), _se.call("vortex_visible")])
			_check("ch29_table", bad.is_empty(), str(bad))
			_next()
		23: # [23] 촌장 → 편성
			_talk("elder", 1, "ch29_elder", "village", Vector2.INF)
		24: # [24] 편성 시험
			if _frame == 1:
				PartyState.members.assign(["story_elder", "story_ferryman", "story_mulsae", "story_wanderer", "story_haesol", "story_hanbyeol"])
				PartyState.party_size = 3
			if _frame == 10:
				_v = {"st": int(_sq.call("st")), "text": String(_sq.call("step_text"))}
				PartyState.members.assign(["story_wanderer", "story_haesol", "story_hanbyeol", "story_elder", "story_ferryman", "story_mulsae"])
			if _frame == 20:
				var ok: bool = int(_v.st) == 1 and String(_v.text).contains("미래 ✗") and String(_v.text).contains("과거 ✔") and int(_sq.call("st")) == 2
				_check("ch29_party", ok, "st_before=%d text='%s' st=%d" % [_v.st, _v.text, _sq.call("st")])
				_next()
		25: # [25] 구름섬 서쪽 바람 기둥 → 먹구름 눈
			var b := StormEye.draft_base()
			if _frame == 1:
				_v = {"isle_st": int(_sq.call("st")), "go_at": 0}
				Input.action_release("move_forward")
				_put(b + Vector3(0.0, 2.7, 0.0))
				_p.call("_set_mode", _p.Mode.AIR)
			if _frame > 1:
				_p.set("stamina", float(_p.get("stamina_max")))
				var c0 := StormEye.center()
				var dir := Vector3(c0.x - _p.global_position.x, 0.0, c0.z - _p.global_position.z).normalized()
				var rig := get_tree().get_first_node_in_group("camera_rig") as Node3D
				if rig:
					rig.global_rotation = Vector3(rig.global_rotation.x, atan2(-dir.x, -dir.z), 0.0)
				if int(_v.go_at) == 0 and _p.global_position.y >= StormEye.top_y() + StormEye.DRAFT_OVER - 1.5:
					_v.go_at = _frame
					Input.action_press("move_forward")
			if _frame > 1 and (int(_sq.call("st")) == 3 or _frame > 1500):
				Input.action_release("move_forward")
				var ok: bool = int(_v.isle_st) == 2 and int(_sq.call("st")) == 3 and StormEye.on_eye(_p.global_position)
				_check("ch29_climb", ok, "isle_st=%d st=%d go_at=%d frames=%d pos=%s" % [_v.isle_st, _sq.call("st"), _v.go_at, _frame, _p.global_position])
				_next()
		26: # [26] 임금(가면) → 지키기
			if _frame == 1:
				var g := _sq.find_child("StoryNpc_gamyeon", true, false)
				_v = g != null and g.find_child("Mask", true, false) != null and StormEye.on_eye(_sq.call("npc_pos", "gamyeon"), 0.5)
			_talk("gamyeon", 4, "ch29_gamyeon", "village", Vector2(6.3396, 1.0), "mask_on_eye=%s" % _v, bool(_v), 1)
		27: # [27] 매듭 등불 지키기 — 물결 셋이 눈 위, 제단 돌은 안 보임
			if _frame == 1:
				_put(StormEye.center() + Vector3(2.5, 0.0, -2.5))
				_v = {"off": 0, "n": 0, "waves": 0, "label": "", "stone": true}
				var alt := _sq.get("_altar") as Node3D
				if alt:
					_v.stone = alt.get_children().any(func(n: Node) -> bool: return n is MeshInstance3D and (n as Node3D).visible)
			if _frame > 4 and _frame % 6 == 0 and int(_sq.call("st")) == 4:
				var lbl := _sq.get("_defend_label") as Label3D
				if lbl and String(_v.label) == "":
					_v.label = lbl.text
				for e in _sq.call("alive_quest_enemies"):
					_v.n += 1
					if not StormEye.on_eye((e as Node3D).global_position, 2.0):
						_v.off += 1
					e.call("_die")
				_v.waves = maxi(int(_v.waves), int(_sq.call("defend_wave")) + 1)
			if _frame > 4 and (int(_sq.call("st")) != 4 or _frame > 600):
				var ok: bool = int(_sq.call("st")) == 5 and int(_v.off) == 0 and int(_v.n) == 12 and int(_v.waves) == 3 and String(_v.label).begins_with("매듭 등불") and not bool(_v.stone)
				_check("ch29_defend", ok, "st=%d off=%d n=%d waves=%d label='%s' stone=%s frames=%d" % [_sq.call("st"), _v.off, _v.n, _v.waves, _v.label, _v.stone, _frame])
				_next()
		28: # [28] 먹구름 임금 참몸 — 눈 위, 쓰러뜨리면 소용돌이가 걷힘
			if _frame == 1:
				_put(StormEye.center() + Vector3(0, 0, -5))
			if _frame == 12:
				var bosses := get_tree().get_nodes_in_group("go_story_boss")
				var bo: Node3D = bosses[0] if not bosses.is_empty() else null
				_v = {"n": bosses.size(), "kind": "", "y": 0.0}
				if bo:
					_v.kind = String(bo.get("kind"))
					_v.y = bo.global_position.y
					bo.call("_die")
			if _frame == 60:
				var ok: bool = int(_v.n) == 1 and String(_v.kind) == "storm_king_true" and absf(float(_v.y) - StormEye.top_y()) < 1.5 and int(_sq.call("st")) == 6 \
					and not bool(_se.call("vortex_visible")) and bool(_sq.call("npc_visible", "haesol_free"))
				_check("ch29_duel", ok, "%s st=%d vortex=%s" % [_v, _sq.call("st"), _se.call("vortex_visible")])
				_next()
		29: # [29] 해솔 → 광장
			_talk("haesol_free", 7, "ch29_haesol", "village", Vector2(5.8, 3.3))
		30: # [30] 광장에 닿음
			if _frame == 1:
				_put(_cell("village", Vector2(5.8, 3.6)))
			if _frame == 10:
				_check("ch29_go", int(_sq.call("st")) == 8, "st=%d" % _sq.call("st"))
				_next()
		31: # [31] 촌장 → 29장 끝 · 줄 거둠
			if _frame == 1:
				_v = {"mora": PartyState.count("mora")}
				_near_npc("elder")
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
			var beams := range(6).any(func(k: int) -> bool: return bool(_se.call("beam_visible", k)))
			var lit := range(6).all(func(k: int) -> bool: return bool(_se.call("knot_lit", k)))
			var ok: bool = int(_sq.call("ch")) == CH29 + 1 and jt.contains("✔ 제29장") and PartyState.count("mora") >= int(_v.mora) + 300000 and not beams and lit
			_check("chapter29", ok, "ch=%d mora +%d beams=%s lit=%s" % [_sq.call("ch"), PartyState.count("mora") - int(_v.mora), beams, lit])
			_next()
		32:
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
	print("STORY8_PROBE_DONE fails=%d" % _fails)
	get_tree().quit()

func _talk(npc: String, want_st: int, name: String, next_region: String, next_cell: Vector2, extra := "", extra_ok := true, from := 0) -> void:
	if _frame == 2 + from * 2:
		_near_npc(npc)
	if _frame == 10 + from * 2:
		_sq.call("interact")
		_drain()
	if _frame == 14 + from * 2:
		var tgt_ok := next_cell == Vector2.INF or _flat(_target(), TestMap.world_pos(next_cell.x, next_cell.y, next_region)) < 0.5
		_check(name, int(_sq.call("st")) == want_st and tgt_ok and extra_ok, "st=%d target=%s %s" % [_sq.call("st"), _target(), extra])
		_next()

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
	print("STORY8_PROBE %s %s %s" % [name, "ok" if ok else "FAIL", detail])

func _next() -> void:
	_step += 1
	_frame = 0
