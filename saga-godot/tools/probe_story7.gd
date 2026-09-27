extends Node
## GO 이야기 7부(PLAN 106장 51, 24장~) 자동 점검 — 평소엔 안 붙는다. 6부 probe_story6.
## test_village.gd 가 SAGA_STORY7_PROBE 가 있을 때만 단다.
##
##   SAGA_STORY7_PROBE=1 "$GODOT" --headless --path saga-godot res://games/saga_go/world/TestVillage.tscn
##
## 24장 "하늘 사당의 바람 방울"(51-2, world/sky_route.gd shrine): [1] 표·자리(새벽 과거 · 별배 내리는 자리·인물 자리·졸개·석등 가운데가 사당 섬 윗면 ·
## 명소에 안 묻힘 · 항로 보임 · 사당 먹구름 · 선장·반디는 모래밭) [2] 선장 → 별배 [3] 별배 타기(사당 섬 윗면에 내림)
## [4] 새벽(섬 위) → 졸개 [5] 졸개 넷이 섬 위 [6] 새벽 → 석등 [7] 바람 방울 석등 — 섬 높이·섬 안·차례(틀리면 꺼짐) → 먹구름 걷힘
## [8] 새벽 → 24장 끝·보상·바람 기둥 둘(등대·사당) 서고 잔해 기둥은 아직.
## 25장 "멈춘 기상 비행선"(51-3, wreck): [9] 표·자리(하늬 현대·고글 · 하늬·반디·드론 길·기관이 잔해 섬 윗면·명소에 안 묻힘 · 물결 방향이 섬 안)
## [10] 새벽 → 잔해 섬 [11] 사당 바람 기둥을 실제로 타고 활공해 잔해 섬에 내려서면 넘어감(사당 위에선 안 넘어감) [12] 하늬 → 드론
## [13] 드론이 섬 위 길로 달아나다 따라잡힘 [14] 하늬 → 지키기 [15] 비행선 기관 지키기(물결 셋 섬 위) [16] 하늬 → 25장 끝·바람 기둥 셋.
## 26장 "궤도 조각의 그림자"(51-4, orbit, 7부 끝): [17] 표·자리(동료 하늬 ★4 빙·장병기·겹침 없음 · 가면 그림자 가면·처음엔 없음 · 하늬·반디·그림자·대결이
## 정거장 윗면·안 묻힘 · light 셋 = 남동·북·남서 장치 자리 · 대결 자리가 장치·안테나에서 떨어짐 · 그림자 임금 뇌·불이 방패를 깸 · 장치 켜짐)
## [18] 하늬 → 정거장 [19] 잔해 바람 기둥을 실제로 타고 활공해 정거장에 내려섬 [20] 하늬 → 장치 [21] 장치 셋(먼 원소 안 됨·끌 때마다 먹구름 꺼짐) → 가면 그림자
## [22] 가면 그림자 → 대결 [23] 먹구름 임금의 그림자(정거장 위) [24] 하늬 → 26장 끝·동료 하늬·그림자 사라짐.
## 이야기 상태·부대 경험·가방은 끝에 되돌린다. 저장은 안 한다.

const Story := preload("res://games/saga_go/data/story.gd")
const TestMap := preload("res://games/saga_go/data/test_map.gd")
const TerrainBuilder := preload("res://games/saga_go/world/terrain_builder.gd")
const SkyRoute := preload("res://games/saga_go/world/sky_route.gd")

const CH24 := 23 # 24장(0부터)
const CH25 := 24
const CH26 := 25
const FieldEnemy := preload("res://games/saga_go/combat/field_enemy.gd")
const Elements := preload("res://games/saga_go/combat/elements.gd")
const Kits := preload("res://games/saga_go/data/kits.gd")
const R := "sunken"

var _p: CharacterBody3D
var _sq: Node
var _sr: Node
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
		_sr = get_tree().get_first_node_in_group("go_sky_route")
		_frame = 0
		return
	if _frame < 3 and _step == 0:
		return
	match _step:
		0: # 준비 — 24장 처음, 모험 등급 55
			_saved = {"story": PartyState.story.duplicate(true), "members": PartyState.members.duplicate(), "exp": PartyState.exp, "level": PartyState.level,
				"bag": PartyState.bag.duplicate(true), "ar_paid": PartyState.ar_paid, "resolved": EventState.resolved.duplicate(), "pos": _p.global_position, "wq": PartyState.world_quests.duplicate(true)}
			PartyState.exp = maxf(PartyState.exp, 55.0 * PartyState.EXP_PER_LEVEL)
			PartyState.level = maxi(PartyState.level, 55)
			PartyState.ar_paid = maxi(PartyState.ar_paid, PartyState.level + 1)
			PartyState.story = {"ch": CH24, "step": 0}
			_sq.call("set_track", "")
			_sq.call("_enter_step")
			_next()
		1: # [1] 표·자리
			if _frame < 70: # 항로·먹구름은 30프레임마다 본다
				return
			var c := Story.chapter(CH24)
			var steps: Array = c.steps
			var bad: Array = []
			if String(c.get("id", "")) != "ch24" or int(c.ar) <= int(Story.chapter(CH24 - 1).ar) or int(_sq.call("ch")) != CH24 or bool(_sq.call("locked")) or steps.size() != 7:
				bad.append("chapter ch=%d locked=%s steps=%d" % [_sq.call("ch"), _sq.call("locked"), steps.size()])
			var info: Dictionary = Story.NPCS.saebyeok
			if String(info.get("era", "")) != "과거" or bool(_sq.call("npc_visible", "saebyeok")):
				bad.append("saebyeok info/visible at st0")
			## 사당 섬 윗면 자리 — 별배 내리는 자리·졸개·석등 가운데·새벽·선장·반디(섬 칸).
			var spots: Array = [steps[1].to, steps[3], steps[5]]
			spots += Story.windows(info.appear)
			spots += Story.windows(Story.NPCS.hanbyeol.appear).filter(func(w: Dictionary) -> bool: return w.has("isle"))
			spots += Story.windows(Story.STATIONS.bandi).filter(func(w: Dictionary) -> bool: return String(w.get("isle", "")) == "shrine")
			for d in spots:
				var sp := _spot(d)
				var cc := SkyRoute.center("shrine")
				if String(d.get("isle", "")) != "shrine" or absf(sp.y - SkyRoute.top_y("shrine")) > 0.01 or _flat(sp, cc) > SkyRoute.radius("shrine") - 2.0:
					bad.append("spot %s" % [d.cell])
				elif not _hits(sp).is_empty():
					bad.append("buried %s %s" % [d.cell, _hits(sp)])
			if not bool(_sr.call("is_shown")) or not bool(_sr.call("gloom_visible")):
				bad.append("route shown=%s gloom=%s" % [_sr.call("is_shown"), _sr.call("gloom_visible")])
			if TestMap.region_at(_sq.call("npc_pos", "hanbyeol")) != R or _flat(_sq.call("npc_pos", "bandi"), _cell_any(R, Vector2(3.1, 1.55))) > 1.0:
				bad.append("hanbyeol/bandi at beach")
			_check("ch24_table", bad.is_empty(), str(bad))
			_next()
		2: # [2] 선장(모래밭) → 별배
			_talk("hanbyeol", 1, "ch24_hanbyeol", Vector2.INF)
		3: # [3] 별배 타기 — 선장에게 F → 사당 섬 윗면
			if _frame == 1:
				_near_npc("hanbyeol")
			if _frame == 10:
				_sq.call("interact")
				_drain()
			if _frame == 30:
				var ok: bool = int(_sq.call("st")) == 2 and SkyRoute.on_isle("shrine", _p.global_position) and absf(_p.global_position.y - SkyRoute.top_y("shrine")) < 1.0
				_check("ch24_ship", ok, "st=%d pos=%s" % [_sq.call("st"), _p.global_position])
				_next()
		4: # [4] 새벽(섬 위) → 졸개
			if _frame == 1:
				var sp: Vector3 = _sq.call("npc_pos", "saebyeok")
				_v = bool(_sq.call("npc_visible", "saebyeok")) and absf(sp.y - SkyRoute.top_y("shrine")) < 0.1
			_talk("saebyeok", 3, "ch24_saebyeok", Vector2(6.4063, 7.2542), "on_isle=%s" % _v, bool(_v), 1)
		5: # [5] 졸개 넷 — 섬 위
			if _frame == 1:
				_put(_target() + Vector3(0, 0, 6))
			if _frame == 10:
				var es: Array = _sq.call("alive_quest_enemies")
				var on := es.filter(func(e: Node) -> bool: return SkyRoute.on_isle("shrine", (e as Node3D).global_position, 2.0)).size()
				_v = {"n": es.size(), "on": on}
				for e in es:
					e.call("_die")
			if _frame == 16:
				_check("ch24_kill", int(_v.n) == 4 and int(_v.on) == 4 and int(_sq.call("st")) == 4, "n=%d on=%d st=%d" % [_v.n, _v.on, _sq.call("st")])
				_next()
		6: # [6] 새벽 → 석등
			_talk("saebyeok", 5, "ch24_saebyeok2", Vector2(6.4063, 7.2542))
		7: # [7] 바람 방울 석등 — 섬 높이·섬 안, 해 먼저(틀림) → 별 → 해 → 달 → 먹구름 걷힘
			var cc := SkyRoute.center("shrine")
			if _frame == 1:
				_put(_target() + Vector3(0.0, 0.0, 3.0))
				_v = {"lit": [], "ys": [], "rs": []}
			if _frame == 6:
				for mk in ["sun", "star", "moon"]:
					var lp: Vector3 = _sq.call("seal_lamp_pos", mk)
					_v.ys.append(snappedf(lp.y - SkyRoute.top_y("shrine"), 0.01))
					_v.rs.append(snappedf(_flat(lp, cc), 0.1))
				for mk in ["sun", "star", "sun", "moon"]:
					_sq.call("receive_element", _sq.call("seal_lamp_pos", mk), 0.5, "wind")
					_v.lit.append(int(_sq.call("seal_lit")))
			if _frame == 150: # 다 켜진 뒤 넘어가고, 먹구름은 30프레임마다 본다
				var ys_ok := (_v.ys as Array).all(func(y: float) -> bool: return absf(y) < 0.2)
				var rs_ok := (_v.rs as Array).all(func(r: float) -> bool: return r < SkyRoute.radius("shrine") - 2.0)
				var ok: bool = _v.lit == [0, 1, 2, 3] and int(_sq.call("st")) == 6 and ys_ok and rs_ok and not bool(_sr.call("gloom_visible"))
				_check("ch24_seal", ok, "lit=%s st=%d ys=%s rs=%s gloom=%s" % [_v.lit, _sq.call("st"), _v.ys, _v.rs, _sr.call("gloom_visible")])
				_next()
		8: # [8] 새벽 → 24장 끝 · 바람 기둥
			if _frame == 1:
				_v = {"mora": PartyState.count("mora")}
				_near_npc("saebyeok")
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
			var drafts := range(3).filter(func(i: int) -> bool: return bool(_sr.call("draft_active", i)))
			var ok: bool = int(_sq.call("ch")) == CH24 + 1 and jt.contains("✔ 제24장") and PartyState.count("mora") >= int(_v.mora) + 120000 \
				and drafts == [0, 1] and bool(_sq.call("npc_visible", "saebyeok")) and not bool(_sr.call("gloom_visible"))
			_check("chapter24", ok, "ch=%d mora +%d drafts=%s" % [_sq.call("ch"), PartyState.count("mora") - int(_v.mora), drafts])
			_next()
		9: # [9] 25장 표·자리 — 모험 등급 57
			if _frame == 1:
				PartyState.exp = maxf(PartyState.exp, 57.0 * PartyState.EXP_PER_LEVEL)
				PartyState.level = maxi(PartyState.level, 57)
				PartyState.ar_paid = maxi(PartyState.ar_paid, PartyState.level + 1)
				_sq.call("_enter_step")
			if _frame < 70:
				return
			var c := Story.chapter(CH25)
			var steps: Array = c.steps
			var bad: Array = []
			if String(c.get("id", "")) != "ch25" or int(c.ar) <= int(Story.chapter(CH24).ar) or int(_sq.call("ch")) != CH25 or bool(_sq.call("locked")) or steps.size() != 7:
				bad.append("chapter ch=%d locked=%s steps=%d" % [_sq.call("ch"), _sq.call("locked"), steps.size()])
			var info: Dictionary = Story.NPCS.haneul
			if String(info.get("era", "")) != "현대" or not bool(info.get("goggles", false)) or not bool(_sq.call("npc_visible", "haneul")):
				bad.append("haneul info")
			var wc := SkyRoute.center("wreck")
			var wr := SkyRoute.radius("wreck")
			## 잔해 섬 윗면 자리 — 하늬·반디·오르기 칸·드론 길·기관(지키기).
			var spots: Array = Story.windows(info.appear).filter(func(w: Dictionary) -> bool: return String(w.get("isle", "")) == "wreck") + Story.windows(Story.STATIONS.bandi).filter(func(w: Dictionary) -> bool: return String(w.get("isle", "")) == "wreck")
			spots.append(steps[5])
			for pt in steps[3].path:
				spots.append({"region": R, "cell": pt, "isle": "wreck"})
			for d in spots:
				var sp := _spot(d)
				if String(d.get("isle", "")) != "wreck" or absf(sp.y - SkyRoute.top_y("wreck")) > 0.01 or _flat(sp, wc) > wr - 1.5:
					bad.append("spot %s" % [d.cell])
				elif not _hits(sp).is_empty():
					bad.append("buried %s %s" % [d.cell, _hits(sp)])
			var climb: Dictionary = steps[1]
			if String(climb.type) != "climb" or String(climb.get("isle", "")) != "wreck" or String(steps[3].get("isle", "")) != "wreck" or String(steps[3].get("body", "")) != "drone":
				bad.append("climb/chase isle")
			## 물결 — 기관 둘레 DEFEND_RING m 가 섬 안(난간 안쪽)·명소에 안 묻힘.
			var defend: Dictionary = steps[5]
			for dg in defend.dirs:
				var a := deg_to_rad(float(dg))
				var wp := _spot(defend) + Vector3(sin(a), 0.0, -cos(a)) * Story.DEFEND_RING
				if _flat(wp, wc) > wr - 1.2 or not _hits(wp).is_empty():
					bad.append("wave dir %d r=%.1f hits=%s" % [dg, _flat(wp, wc), _hits(wp)])
			_check("ch25_table", bad.is_empty(), str(bad))
			_next()
		10: # [10] 새벽(사당) → 잔해 섬
			_talk("saebyeok", 1, "ch25_saebyeok", Vector2(5.4688, 7.4209))
		11: # [11] 사당 섬에 서 있으면 안 넘어가고, 사당 바람 기둥을 실제로 타고 올라 활공해 잔해 섬에 내려서면 넘어간다
			var d: Array = SkyRoute.drafts()[1]
			var b: Vector3 = d[1]
			if _frame == 1:
				_v = {"shrine_st": int(_sq.call("st")), "peak": -1e9, "go_at": 0, "landed_st": -1}
				Input.action_release("move_forward")
				_put(b + Vector3(0.0, 3.0, 0.0))
				_p.call("_set_mode", _p.Mode.AIR)
			if _frame > 1:
				_p.set("stamina", float(_p.get("stamina_max")))
				var c0 := SkyRoute.center("wreck")
				var aim := c0 + Vector3(b.x - c0.x, 0.0, b.z - c0.z).normalized() * SkyRoute.radius("wreck") * 0.5
				var dir := Vector3(aim.x - _p.global_position.x, 0.0, aim.z - _p.global_position.z).normalized()
				var rig := get_tree().get_first_node_in_group("camera_rig") as Node3D
				if rig:
					rig.global_rotation = Vector3(rig.global_rotation.x, atan2(-dir.x, -dir.z), 0.0)
				if int(_v.go_at) == 0 and _p.global_position.y >= SkyRoute.top_y("wreck") + SkyRoute.DRAFT_OVER - 1.5:
					_v.go_at = _frame
					Input.action_press("move_forward")
				if int(_sq.call("st")) == 2 and int(_v.landed_st) < 0:
					_v.landed_st = 2
					Input.action_release("move_forward")
			if int(_v.landed_st) == 2 or _frame > 1500:
				Input.action_release("move_forward")
				var ok: bool = int(_v.shrine_st) == 1 and int(_sq.call("st")) == 2 and SkyRoute.on_isle("wreck", _p.global_position)
				_check("ch25_climb", ok, "shrine_st=%d st=%d go_at=%d frames=%d pos=%s" % [_v.shrine_st, _sq.call("st"), _v.go_at, _frame, _p.global_position])
				_next()
		12: # [12] 하늬(잔해 섬) → 드론
			_talk("haneul", 3, "ch25_haneul", Vector2(5.6355, 7.2542))
		13: # [13] 드론 쫓기 — 섬 위 길, 달아나다 따라잡힘
			if _frame == 1:
				var th := _sq.get("_thief") as Node3D
				if th:
					_put(th.global_position + Vector3(0.0, 0.0, 6.0))
			if _frame == 40:
				var cs: Dictionary = _sq.call("chase_state")
				var th := _sq.get("_thief") as Node3D
				_v = {"run": bool(cs.run), "on": th != null and absf(th.global_position.y - SkyRoute.top_y("wreck")) < 0.2 and SkyRoute.on_isle("wreck", th.global_position),
					"drone": th != null and th.find_child("Mask", true, false) == null}
				_put(Vector3(cs.pos) + Vector3(0.0, 0.5, 1.0))
			if _frame == 52:
				var ok: bool = bool(_v.run) and bool(_v.on) and int(_sq.call("st")) == 4 and _sq.get("_thief") == null
				_check("ch25_chase", ok, "%s st=%d thief=%s" % [_v, _sq.call("st"), _sq.get("_thief") != null])
				_next()
		14: # [14] 하늬 → 기관 지키기
			_talk("haneul", 5, "ch25_haneul2", Vector2(5.4063, 7.4834))
		15: # [15] 비행선 기관 지키기 — 물결 셋이 섬 위에서
			if _frame == 1:
				_put(_target() + Vector3(2.5, 0.0, -2.5))
				_v = {"off": 0, "n": 0, "waves": 0, "label": ""}
			if _frame > 4 and _frame % 6 == 0 and int(_sq.call("st")) == 5:
				var lbl := _sq.get("_defend_label") as Label3D
				if lbl and String(_v.label) == "":
					_v.label = lbl.text
				for e in _sq.call("alive_quest_enemies"):
					_v.n += 1
					if not SkyRoute.on_isle("wreck", (e as Node3D).global_position, 2.0):
						_v.off += 1
					e.call("_die")
				_v.waves = maxi(int(_v.waves), int(_sq.call("defend_wave")) + 1)
			if _frame > 4 and (int(_sq.call("st")) != 5 or _frame > 600):
				var ok: bool = int(_sq.call("st")) == 6 and int(_v.off) == 0 and int(_v.n) == 12 and int(_v.waves) == 3 and String(_v.label).begins_with("비행선 기관")
				_check("ch25_defend", ok, "st=%d off=%d n=%d waves=%d label='%s' frames=%d" % [_sq.call("st"), _v.off, _v.n, _v.waves, _v.label, _frame])
				_next()
		16: # [16] 하늬 → 25장 끝 · 잔해 기둥까지 셋
			if _frame == 1:
				_v = {"mora": PartyState.count("mora")}
				_near_npc("haneul")
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
			var drafts := range(3).filter(func(i: int) -> bool: return bool(_sr.call("draft_active", i)))
			var ok: bool = int(_sq.call("ch")) == CH25 + 1 and jt.contains("✔ 제25장") and PartyState.count("mora") >= int(_v.mora) + 125000 \
				and drafts == [0, 1, 2] and bool(_sq.call("npc_visible", "haneul"))
			_check("chapter25", ok, "ch=%d mora +%d drafts=%s" % [_sq.call("ch"), PartyState.count("mora") - int(_v.mora), drafts])
			_next()
		17: # [17] 26장 표·자리 — 모험 등급 59
			if _frame == 1:
				PartyState.exp = maxf(PartyState.exp, 59.0 * PartyState.EXP_PER_LEVEL)
				PartyState.level = maxi(PartyState.level, 59)
				PartyState.ar_paid = maxi(PartyState.ar_paid, PartyState.level + 1)
				_sq.call("_enter_step")
			if _frame < 70:
				return
			var c := Story.chapter(CH26)
			var steps: Array = c.steps
			var bad: Array = []
			if String(c.get("id", "")) != "ch26" or int(c.ar) <= int(Story.chapter(CH25).ar) or int(_sq.call("ch")) != CH26 or bool(_sq.call("locked")) \
					or steps.size() != 9 or String(c.get("join", "")) != "story_haneul":
				bad.append("chapter ch=%d locked=%s steps=%d" % [_sq.call("ch"), _sq.call("locked"), steps.size()])
			## 동료 하늬 — ★4 빙·장병기, 이야기 동료 가운데 겹치는 짝 없음.
			var m: Dictionary = Story.MEMBERS.get("story_haneul", {})
			if int(m.get("rarity", 0)) != 4 or Elements.element_of("story_haneul") != "ice" or String(m.get("weapon", "")) != "polearm" or not Kits.KITS.has("story_haneul"):
				bad.append("member %s" % m)
			for id in Story.MEMBERS:
				var o: Dictionary = Story.MEMBERS[id]
				if id != "story_haneul" and String(o.element) == "ice" and String(o.weapon) == "polearm":
					bad.append("overlap %s" % id)
			if bool(_sq.call("npc_visible", "gamyeon")) or not bool(Story.NPCS.gamyeon.get("mask", false)):
				bad.append("gamyeon at st0")
			var oc := SkyRoute.center("orbit")
			var orr := SkyRoute.radius("orbit")
			## 정거장 윗면 자리 — 하늬·반디·가면 그림자·대결.
			var spots: Array = Story.windows(Story.NPCS.haneul.appear).filter(func(w: Dictionary) -> bool: return String(w.get("isle", "")) == "orbit") \
				+ Story.windows(Story.STATIONS.bandi).filter(func(w: Dictionary) -> bool: return String(w.get("isle", "")) == "orbit") + Story.windows(Story.NPCS.gamyeon.appear)
			spots.append(steps[7])
			for d in spots:
				var sp := _spot(d)
				if String(d.get("isle", "")) != "orbit" or absf(sp.y - SkyRoute.top_y("orbit")) > 0.01 or _flat(sp, oc) > orr - 2.0:
					bad.append("spot %s" % [d.cell])
				elif not _hits(sp).is_empty():
					bad.append("buried %s %s" % [d.cell, _hits(sp)])
			## 장치 셋 — light 칸이 남동 → 북 → 남서 장치 자리.
			for i in 3:
				var lt: Dictionary = steps[3 + i]
				var k: int = [1, 0, 2][i]
				if String(lt.type) != "light" or not bool(lt.get("bare", false)) or _flat(_spot(lt), SkyRoute.seeder_pos(k)) > 0.5 or absf(_spot(lt).y - SkyRoute.top_y("orbit")) > 0.01:
					bad.append("light %d" % i)
			## 대결 — 먹구름 임금의 그림자(뇌, 불이 방패를 깸), 섬 남쪽 — 장치·안테나에서 5m 넘게, 가장자리에서 4m 안쪽.
			var du := _spot(steps[7])
			var near: float = range(3).map(func(k: int) -> float: return _flat(du, SkyRoute.seeder_pos(k))).min()
			if String(steps[7].kind) != "storm_shadow" or String(FieldEnemy.KINDS.storm_shadow.element) != "thunder" or Elements.shield_mul("thunder", "fire") <= 1.0 \
					or near < 5.0 or _flat(du, oc) < 5.0 or _flat(du, oc) > orr - 4.0:
				bad.append("duel %s near=%.1f" % [du, near])
			if not range(3).all(func(k: int) -> bool: return bool(_sr.call("seeder_lit", k))):
				bad.append("seeders off at st0")
			_check("ch26_table", bad.is_empty(), str(bad))
			_next()
		18: # [18] 하늬(잔해) → 정거장
			_talk("haneul", 1, "ch26_haneul", Vector2(4.573, 7.1709))
		19: # [19] 잔해 바람 기둥을 실제로 타고 활공해 정거장에 내려서면 넘어간다
			var b: Vector3 = SkyRoute.drafts()[2][1]
			if _frame == 1:
				_v = {"wreck_st": int(_sq.call("st")), "go_at": 0, "landed": false}
				Input.action_release("move_forward")
				_put(b + Vector3(0.0, 3.0, 0.0))
				_p.call("_set_mode", _p.Mode.AIR)
			if _frame > 1:
				_p.set("stamina", float(_p.get("stamina_max")))
				var c0 := SkyRoute.center("orbit")
				var aim := c0 + Vector3(b.x - c0.x, 0.0, b.z - c0.z).normalized() * SkyRoute.radius("orbit") * 0.5
				var dir := Vector3(aim.x - _p.global_position.x, 0.0, aim.z - _p.global_position.z).normalized()
				var rig := get_tree().get_first_node_in_group("camera_rig") as Node3D
				if rig:
					rig.global_rotation = Vector3(rig.global_rotation.x, atan2(-dir.x, -dir.z), 0.0)
				if int(_v.go_at) == 0 and _p.global_position.y >= SkyRoute.top_y("orbit") + SkyRoute.DRAFT_OVER - 1.5:
					_v.go_at = _frame
					Input.action_press("move_forward")
				if int(_sq.call("st")) == 2:
					_v.landed = true
			if bool(_v.landed) or _frame > 1500:
				Input.action_release("move_forward")
				var ok: bool = int(_v.wreck_st) == 1 and int(_sq.call("st")) == 2 and SkyRoute.on_isle("orbit", _p.global_position)
				_check("ch26_climb", ok, "wreck_st=%d st=%d go_at=%d frames=%d pos=%s" % [_v.wreck_st, _sq.call("st"), _v.go_at, _frame, _p.global_position])
				_next()
		20: # [20] 하늬(정거장) → 장치
			_talk("haneul", 3, "ch26_haneul2", Vector2(4.7353, 7.2647))
		21: # [21] 장치 셋 — 먼 원소는 안 되고, 차례로 끌 때마다 그 장치 먹구름이 꺼진다 → 가면 그림자가 선다
			if _frame == 1:
				_put(SkyRoute.seeder_pos(1) + Vector3(-2.5, 0.0, 0.0))
				_v = {"far": -1, "st": [], "off": []}
			if _frame == 4:
				_sq.call("receive_element", SkyRoute.seeder_pos(1) + Vector3(20.0, 0.0, 0.0), 3.0, "fire")
			if _frame == 6:
				_v.far = int(_sq.call("st"))
			for i in 3:
				var k: int = [1, 0, 2][i]
				if _frame == 8 + i * 90:
					_put(SkyRoute.seeder_pos(k) + (SkyRoute.center("orbit") - SkyRoute.seeder_pos(k)).normalized() * 2.5)
					_sq.call("receive_element", SkyRoute.seeder_pos(k) + Vector3(0.5, 0.0, 0.5), 3.0, "fire")
				if _frame == 95 + i * 90:
					_v.st.append(int(_sq.call("st")))
					_v.off.append(not bool(_sr.call("seeder_lit", k)))
			if _frame == 280:
				var ok: bool = int(_v.far) == 3 and _v.st == [4, 5, 6] and _v.off == [true, true, true] and bool(_sq.call("npc_visible", "gamyeon"))
				_check("ch26_seeders", ok, "far=%d st=%s off=%s gamyeon=%s" % [_v.far, _v.st, _v.off, _sq.call("npc_visible", "gamyeon")])
				_next()
		22: # [22] 가면 그림자 → 대결
			if _frame == 1:
				var g := _sq.find_child("StoryNpc_gamyeon", true, false)
				_v = g != null and g.find_child("Mask", true, false) != null
			_talk("gamyeon", 7, "ch26_gamyeon", Vector2(4.573, 7.3167), "mask=%s" % _v, bool(_v), 1)
		23: # [23] 먹구름 임금의 그림자 — 정거장 위, 고리 예고
			if _frame == 1:
				_put(_target() + Vector3(0, 0, -5))
			if _frame == 12:
				var bosses := get_tree().get_nodes_in_group("go_story_boss")
				var bo: Node3D = bosses[0] if not bosses.is_empty() else null
				_v = {"n": bosses.size(), "marks": 0, "kind": "", "y": 0.0}
				if bo:
					_v.kind = String(bo.get("kind"))
					_v.y = bo.global_position.y
					bo.call("_clear_marks")
					bo.call("_set_tell", false)
					bo.call("begin_skill", "halo", _p)
					_v.marks = (bo.get("_marks") as Array).size()
					bo.call("_clear_marks")
					bo.call("_die")
			if _frame == 20:
				var ok: bool = int(_v.n) == 1 and String(_v.kind) == "storm_shadow" and absf(float(_v.y) - SkyRoute.top_y("orbit")) < 1.5 and int(_v.marks) >= 1 and int(_sq.call("st")) == 8
				_check("ch26_duel", ok, "n=%d kind=%s y=%.1f marks=%d st=%d" % [_v.n, _v.kind, _v.y, _v.marks, _sq.call("st")])
				_next()
		24: # [24] 하늬 → 26장 끝·동료 하늬·가면 그림자는 사라짐
			if _frame == 1:
				_v = {"mora": PartyState.count("mora")}
				_near_npc("haneul")
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
			var ok: bool = int(_sq.call("ch")) == CH26 + 1 and jt.contains("✔ 제26장") and PartyState.count("mora") >= int(_v.mora) + 130000 \
				and PartyState.members.has("story_haneul") and not bool(_sq.call("npc_visible", "gamyeon")) and not range(3).any(func(k: int) -> bool: return bool(_sr.call("seeder_lit", k)))
			_check("chapter26", ok, "ch=%d mora +%d joined=%s" % [_sq.call("ch"), PartyState.count("mora") - int(_v.mora), PartyState.members.has("story_haneul")])
			_next()
		25:
			PartyState.story = _saved.story
			PartyState.members.assign(_saved.members)
			PartyState.exp = _saved.exp
			PartyState.level = _saved.level
			PartyState.bag = _saved.bag
			PartyState.ar_paid = _saved.ar_paid
			EventState.resolved.assign(_saved.resolved)
			PartyState.world_quests = _saved.wq
			_p.global_position = _saved.pos
			print("STORY7_PROBE_DONE fails=%d" % _fails)
			get_tree().quit()

func _talk(npc: String, want_st: int, name: String, next_cell: Vector2, extra := "", extra_ok := true, from := 0) -> void:
	if _frame == 2 + from * 2:
		_near_npc(npc)
	if _frame == 10 + from * 2:
		_sq.call("interact")
		_drain()
	if _frame == 14 + from * 2:
		var tgt_ok := next_cell == Vector2.INF or _flat(_target(), TestMap.world_pos(next_cell.x, next_cell.y, R)) < 0.5
		_check(name, int(_sq.call("st")) == want_st and tgt_ok and extra_ok, "st=%d target=%s %s" % [_sq.call("st"), _target(), extra])
		_next()

func _target() -> Vector3:
	return _sq.call("target_pos")

func _cell_any(region: String, cell: Vector2) -> Vector3:
	var p := TestMap.world_pos(cell.x, cell.y, region)
	p.y = TerrainBuilder.height_at(region, p)
	return p

## 단계·인물 칸 자리(isle 이면 섬 윗면).
func _spot(d: Dictionary) -> Vector3:
	if d.has("isle"):
		var p := TestMap.world_pos(d.cell.x, d.cell.y, String(d.region))
		p.y = SkyRoute.top_y(String(d.isle))
		return p
	return _cell_any(String(d.region), d.cell) + Vector3(0, float(d.get("lift", 0.0)), 0)

## 그 자리 1.2m 위에 걸리는 구름 위 항로 명소 충돌(섬 윗면 판은 그 아래라 안 걸린다).
func _hits(pos: Vector3) -> Array:
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
		if c is Node and _sr.is_ancestor_of(c as Node):
			out.append(String((c as Node).name))
	return out

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
	print("STORY7_PROBE %s %s %s" % [name, "ok" if ok else "FAIL", detail])

func _next() -> void:
	_step += 1
	_frame = 0
