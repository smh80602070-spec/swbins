extends Node
## GO 들판 보스(106장 ㉓) 자동 점검 — 평소엔 안 붙는다. test_village.gd 가 SAGA_FIELD_BOSS_PROBE 가 있을 때만 단다.
##
##   SAGA_FIELD_BOSS_PROBE=1 "$GODOT" --headless --path saga-godot res://games/saga_go/world/TestVillage.tscn
##
## ① 돌파 2 단계부터 보스 재료(2·…·20, 첫 돌파엔 없음)·인물마다 셋 중 하나 ② 셋이 제자리에·세계 등급 체력
## ③ 다가가면 싸움 → 화면 위 보스 막대·먼 보스는 잠듦 ④ 체력 절반 → 2단계 보스 원소 방패(풍 ← 암 ×2.5)·세계 등급이 바뀌어도 방패 비율 그대로
## ⑤ 끌려 나갔다 집에 가면 1단계·체력 가득 ⑥ 쓰러뜨리면 보상 꽃·되살아나지 않음 ⑦ 원기 모자라면 못 받고 꽃이 남음
## ⑧ 원기 40 → 보스 재료·결정·★4·꽃 사라짐·150초 뒤 다시 섬 ⑨ 다시 서면 1단계 ⑩ 보스 재료가 있어야 돌파 2.
## 저장은 안 한다.

const FB := preload("res://games/saga_go/data/field_bosses.gd")
const Growth := preload("res://games/saga_go/data/growth.gd")
const Domains := preload("res://games/saga_go/data/domains.gd")
const Adventure := preload("res://games/saga_go/data/adventure.gd")
const Elements := preload("res://games/saga_go/combat/elements.gd")
const FieldBoss := preload("res://games/saga_go/combat/field_boss.gd")
const FieldEnemy := preload("res://games/saga_go/combat/field_enemy.gd")

var _p: CharacterBody3D
var _fb: Node
var _fc: Node
var _boss: Node = null
var _frame := 0
var _step := 0
var _fails := 0
var _v: Variant = null

func _ready() -> void:
	Weather.force("clear")
	_hide_probe_modals()

## 세이브의 주민 퀘스트 창이 측정 대상과 무관하게 보상 단추를 가리는 일을 막는다.
## 노드는 ui_modal 그룹에 둔 채 숨겨, 숨은 창이 입력/버튼을 막지 않는 동작은 그대로 검사한다.
func _hide_probe_modals() -> void:
	for modal in get_tree().get_nodes_in_group("ui_modal"):
		if modal is CanvasLayer:
			(modal as CanvasLayer).hide()
		elif modal is CanvasItem:
			(modal as CanvasItem).hide()
	_p = get_tree().get_first_node_in_group("player")

func _physics_process(_delta: float) -> void:
	_frame += 1
	if _fb == null:
		_fb = get_tree().get_first_node_in_group("go_field_bosses")
		_fc = get_tree().get_first_node_in_group("go_field_combat")
		return
	if _step == 6:
		_hide_probe_modals() # 장면 이동 중 NPC가 새 선택 창을 열면 매 틱 숨겨 측정 조건을 유지한다.
	match _step:
		0: # ① 표
			var c0 := Growth.ascend_cost("self", 0)
			var c1 := Growth.ascend_cost("self", 1)
			var c5 := Growth.ascend_cost("self", 5)
			var mats := {}
			for id in ["npc_01", "npc_02", "npc_03", "npc_04", "npc_05", "npc_06", "npc_07", "npc_08"]:
				mats[Growth.boss_of(id)] = true
			var ok: bool = not c0.has("gale_plume") and int(c1.get("gale_plume", 0)) == 2 and int(c5.get("gale_plume", 0)) == 20 \
				and Growth.boss_of("self") == "gale_plume" and mats.size() >= 2 and Growth.BOSS_MATS.size() == 3
			for i in Growth.BOSS_MATS.size():
				ok = ok and FB.BOSSES[FB.ORDER[i]].mat == Growth.BOSS_MATS[i] and Growth.ITEMS.has(Growth.BOSS_MATS[i])
			## 넷째(서리봉 고원)부터는 해시 밖 — 그 지역 인물만(BOSS_OF).
			ok = ok and FB.ORDER.size() == 4 and Growth.ITEMS.has(String(FB.BOSSES.snow_bear_king.mat)) \
				and Growth.boss_of("story_haram") == "frost_core" and int(Growth.ascend_cost("story_haram", 1).get("frost_core", 0)) == 2
			_check("table", ok, "c1=%s kinds=%d" % [c1, mats.size()])
			_next()
		1: # ② 셋이 제자리에
			if _frame == 1:
				for id in FB.ORDER:
					_fb.call("boss", id).set("skill_cd", 999.0) # 저절로 쓰는 패턴은 끈다 — 점검이 필요할 때만
			if _frame == 30:
				var wl := Adventure.world_level()
				var ok := true
				var detail := ""
				for id in FB.ORDER:
					var b: Node3D = _fb.call("boss", id)
					var home: Vector3 = _fb.call("home_of", id)
					var d := Vector2(b.global_position.x - home.x, b.global_position.z - home.z).length()
					var want: float = float(FieldEnemy.KINDS[FB.BOSSES[id].kind].hp) * Adventure.hp_mul(wl)
					ok = ok and b is FieldBoss and d < 7.0 and is_equal_approx(float(b.get("max_hp")), want) and int(b.get("world_lv")) == wl \
						and float(b.get("shield")) == 0.0 and not b.call("is_dead")
					detail += "%s d=%.1f hp=%.0f " % [id, d, b.get("max_hp")]
				_check("spawn", ok, detail)
				_boss = _fb.call("boss", "gale_roc")
				_next()
		2: # ③ 보스 막대
			if _frame == 1:
				_fc.call("revive_all")
				_near(5.0)
			if _frame == 40:
				var t: String = _fb.call("hud_text")
				_check("hud", _fb.call("engaged_boss") == "gale_roc" and t.contains("돌개바람 수리왕") and t.contains("체력"), "hud='%s'" % t)
				## 폰 발열 — 100m 밖에서 쉬는 적은 잠들고(포구 거북왕), 곁의 적은 깨어 있다(field_enemy SLEEP_M).
				var far_b: Node = _fb.call("boss", "tide_turtle")
				_check("sleep_far", bool(far_b.get("asleep")) and not bool(_boss.get("asleep")), "far=%s near=%s" % [far_b.get("asleep"), _boss.get("asleep")])
				_next()
		3: # ④ 2단계
			if _frame == 1:
				_boss.set("hp", float(_boss.get("max_hp")) * 0.49)
			if _frame == 4:
				var wl := Adventure.world_level()
				var want: float = 400.0 * Adventure.hp_mul(wl)
				var ok: bool = int(_boss.get("phase")) == 2 and is_equal_approx(float(_boss.get("shield")), want) and _boss.call("is_shielded") \
					and _boss.get("element") == "wind" and is_equal_approx(Elements.shield_mul("wind", "rock"), 2.5)
				_boss.set("shield", want * 0.5)
				_boss.call("apply_world_level", wl + 1)
				var ratio := float(_boss.get("shield")) / float(_boss.get("max_shield"))
				ok = ok and is_equal_approx(ratio, 0.5) and is_equal_approx(float(_boss.get("max_shield")), 400.0 * Adventure.hp_mul(wl + 1))
				_boss.call("apply_world_level", wl)
				_check("phase2", ok, "phase=%d shield=%.0f ratio=%.2f" % [_boss.get("phase"), _boss.get("shield"), ratio])
				_next()
		4: # ⑤ 집으로 돌아가면 1단계
			if _frame == 1:
				_p.global_position = _boss.global_position + Vector3(0.0, 0.3, 80.0)
				_p.velocity = Vector3.ZERO
				_boss.set("skill", "")
				_boss.set("ai", FieldEnemy.AI.RETURN)
			if _frame == 240:
				var ok: bool = int(_boss.get("phase")) == 1 and is_equal_approx(float(_boss.get("hp")), float(_boss.get("max_hp"))) \
					and float(_boss.get("shield")) == 0.0 and int(_boss.get("ai")) != FieldEnemy.AI.RETURN
				_check("leash_reset", ok, "phase=%d hp=%.0f/%.0f shield=%.0f ai=%d" % [_boss.get("phase"), _boss.get("hp"), _boss.get("max_hp"), _boss.get("shield"), _boss.get("ai")])
				_next()
		5: # ⑥ 쓰러뜨리면 보상 꽃
			if _frame == 1:
				_boss.call("_die")
			if _frame == 120:
				var ok: bool = _fb.call("has_bloom", "gale_roc") and _boss.call("is_dead") and float(_boss.get("_t")) > 1.0e8 \
					and get_tree().get_first_node_in_group("go_field_bosses").get_node_or_null("BossBloom_gale_roc") != null
				_check("bloom", ok, "bloom=%s dead=%s t=%.0f" % [_fb.call("has_bloom", "gale_roc"), _boss.call("is_dead"), _boss.get("_t")])
				_next()
		6: # ⑦ 원기 모자람(꽃 곁에선 "보상" 단추가 보여야 — 숨긴 선택지 창이 ui_modal 에 남아 있어도)
			if _frame == 1:
				var home0: Vector3 = _fb.call("home_of", "gale_roc")
				_p.global_position = home0 + Vector3(0.0, 0.4, 1.5)
				_p.velocity = Vector3.ZERO
				return
			if _frame < 5:
				return
			PartyState.resin = 10
			PartyState.resin_t = Domains.now()
			var btn := bool((_fb.get("_claim_btn") as Button).visible)
			var near: String = _fb.call("near_bloom")
			var got: bool = _fb.call("claim", "gale_roc")
			_check("no_resin", btn and near == "gale_roc" and not got and _fb.call("has_bloom", "gale_roc") and Domains.resin_now() == 10, "btn=%s near=%s got=%s resin=%d" % [btn, near, got, Domains.resin_now()])
			_next()
		7: # ⑧ 원기 40 → 보상
			if _frame == 1:
				PartyState.resin = Domains.RESIN_MAX
				PartyState.resin_t = Domains.now()
				var r := FB.reward_of("gale_roc", Adventure.world_level())
				_v = [PartyState.count("gale_plume"), PartyState.count("crystal_wind"), _fours(), int(r.gale_plume), int(r.crystal_wind)]
				var got: bool = _fb.call("claim", "gale_roc")
				_v.append(got)
			if _frame == 3:
				var ok: bool = bool(_v[5]) and Domains.resin_now() == Domains.RESIN_MAX - FB.RESIN_COST \
					and PartyState.count("gale_plume") == int(_v[0]) + int(_v[3]) and PartyState.count("crystal_wind") == int(_v[1]) + int(_v[4]) \
					and _fours() == int(_v[2]) + 1 and not _fb.call("has_bloom", "gale_roc") and _boss.call("is_dead") \
					and absf(float(_boss.get("_t")) - FB.RESPAWN_SEC) < 1.0
				_check("claim", ok, "resin=%d plume %d→%d t=%.1f" % [Domains.resin_now(), _v[0], PartyState.count("gale_plume"), _boss.get("_t")])
				_next()
		8: # ⑨ 다시 선다
			if _frame == 1:
				_p.global_position = _boss.get("home") + Vector3(0.0, 0.3, 80.0)
				_p.velocity = Vector3.ZERO
				_boss.call("hold_respawn", 0.05)
			if _frame == 10:
				var ok: bool = not _boss.call("is_dead") and int(_boss.get("phase")) == 1 and is_equal_approx(float(_boss.get("hp")), float(_boss.get("max_hp"))) \
					and float(_boss.get("shield")) == 0.0 and _boss.get("visible")
				_check("respawn", ok, "dead=%s phase=%d" % [_boss.call("is_dead"), _boss.get("phase")])
				_next()
		9: # ⑩ 돌파 2 는 보스 재료가 있어야
			PartyState.growth["self"] = {"lv": 40, "exp": 0.0, "asc": 1, "tn": 1, "ts": 1, "tb": 1, "con": 0}
			var cost := Growth.ascend_cost("self", 1)
			var give := cost.duplicate()
			give.erase("gale_plume")
			PartyState.bag.erase("gale_plume")
			PartyState.add_items(give)
			var blocked := not PartyState.ascend("self")
			PartyState.add_items({"gale_plume": 2})
			var ok := PartyState.ascend("self")
			_check("ascend_needs_mat", blocked and ok and PartyState.char_asc("self") == 2, "blocked=%s ok=%s" % [blocked, ok])
			_next()
		10:
			print("FIELD_BOSS_PROBE_DONE fails=%d" % _fails)
			get_tree().quit()

func _near(dist: float) -> void:
	var b: Vector3 = _boss.global_position
	_p.global_position = b + Vector3(0.0, 0.3, dist)
	_p.velocity = Vector3.ZERO

func _fours() -> int:
	var n := 0
	for uid in PartyState.artifacts:
		if int(PartyState.artifacts[uid].rarity) == 4:
			n += 1
	return n

func _check(name: String, ok: bool, detail: String) -> void:
	if not ok:
		_fails += 1
	print("FIELD_BOSS_PROBE %s %s %s" % [name, "ok" if ok else "FAIL", detail])

func _next() -> void:
	_step += 1
	_frame = 0
