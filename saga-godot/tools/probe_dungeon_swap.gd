extends SceneTree

## G-0236 2나락 무기 두 벌 바꿔 들기(웹 W-0281) 자동 점검 — 규칙 함수만 부른다(그림은 안 봄).
##   godot --headless --path saga-godot --script res://tools/probe_dungeon_swap.gd
## ① 한 벌이면 실패(single) ② 줍기로 을 채움(손 무기 → 을, 을에 있던 건 버림) · 무기 아닌 건 을 거부 · 을은 능력치에 안 셈
## ③ 창→활 바꾸면 직업·무예 자리 바뀜 · 되돌아옴 · weapon_changed 한 번 ④ 쿨 1초 ⑤ 첫 타 한 번만 ×1.15 · 첫 타 손맛 tune
## ⑥ 저장 왕복(weapon2) · 옛 세이브(칸 없음) = 한 벌 ⑦ 입력 Q · 단추·컴포넌트가 장면에 · press() 0.4초 자세.
## 상태는 끝에 되돌린다. 끝에 "PROBE dungeon_swap OK" 또는 "PROBE dungeon_swap FAIL n".

var fails := 0


func check(cond: bool, msg: String) -> void:
	if cond:
		print("  ok   ", msg)
	else:
		fails += 1
		print("  FAIL ", msg)


class FakePlayer extends CharacterBody3D:
	var dash_dir := Vector3.ZERO
	var dash_speed := 0.0


func _initialize() -> void:
	await process_frame
	seed(20260824)
	var Enemy: GDScript = load("res://games/saga_dungeon/world/dungeon_enemy.gd")
	var Caster: GDScript = load("res://games/saga_dungeon/player/skill_caster.gd")
	var Melee: GDScript = load("res://games/saga_dungeon/player/melee_attack.gd")
	var SwapIn: GDScript = load("res://games/saga_dungeon/player/weapon_swap_input.gd")
	var Run: Node = root.get_node("DungeonRunState")
	var Eq: Node = root.get_node("DungeonEquipmentState")
	var SS: Node = root.get_node("DungeonSkillState")
	var Save: Node = root.get_node("DungeonSaveState")
	var saved := [SS.points.duplicate(true), SS.ranks.duplicate(true), SS.slots.duplicate(true), Run.boons.duplicate(true), Eq.weapon2.duplicate(true)]
	var saved_equip := {}
	for s in Eq.SLOT_NAMES:
		saved_equip[s] = (Eq.item_for(s) as Dictionary).duplicate(true)
		Eq.equip(s, {})
	Eq.restore_weapon2({})
	Run.boons = {}
	Run._temp_buffs.clear()
	SS.restore({}, {"w_whirl": 1, "a_pierce": 1}, {"warrior": ["w_whirl"], "archer": ["a_pierce"]})

	var world := Node3D.new()
	root.add_child(world)
	current_scene = world
	var player := FakePlayer.new()
	player.add_to_group("player")
	world.add_child(player)
	var vis := Node3D.new()
	vis.name = "Visual"
	player.add_child(vis)
	var caster: Node = Caster.new()
	player.add_child(caster)
	var melee: Node = Melee.new()
	player.add_child(melee)
	var swap_in: Node = SwapIn.new()
	player.add_child(swap_in)
	await process_frame

	var sword := {"base": "w_changj", "tier": "common", "main": 11.0}   # 장창(무장) — 이름은 옛 칼 그대로
	var bow := {"base": "w_gakgung", "tier": "common", "main": 8.0}
	var bow2 := {"base": "w_cheoltae", "tier": "common", "main": 10.0}
	var armor := {"base": "a_jichap", "tier": "common", "main": 8.0}

	# ① 한 벌
	check(str(Eq.swap_weapons().get("reason", "")) == "single", "을이 없으면 바꾸기 실패(single)")
	Eq.pick_weapon(sword)
	check(Eq.weapon == sword and Eq.weapon2.is_empty() and str(Eq.swap_weapons().get("reason", "")) == "single", "맨손에 창을 주우면 을은 그대로 빔")

	# ② 줍기로 을
	var flat_one: float = Eq.atk_flat_bonus()
	Eq.pick_weapon(bow)
	check(Eq.weapon == bow and Eq.weapon2 == sword, "활을 주우면 손 창이 을로")
	check(is_equal_approx(Eq.atk_flat_bonus(), 8.0) and is_equal_approx(flat_one, 11.0), "을은 능력치에 안 셈(활 main 8 만) %.1f" % Eq.atk_flat_bonus())
	check(not Eq.set_weapon2(armor) and Eq.weapon2 == sword, "갑주는 을 거부")
	check(not Eq.SLOT_NAMES.has("weapon2"), "을은 SLOT_NAMES 밖")

	# ③ 바꾸기 — 직업·자리
	check(DungeonItems.class_key_for_weapon(Eq.weapon) == "archer" and caster.slot_key(0) == "a_pierce", "활 = 궁장 · 자리 a_pierce")
	var changed := [0]
	Eq.weapon_changed.connect(func(): changed[0] += 1)
	var r: Dictionary = Eq.swap_weapons()
	check(bool(r.ok) and Eq.weapon == sword and Eq.weapon2 == bow and changed[0] == 1, "Q: 창↔활 · weapon_changed 한 번")
	check(DungeonItems.class_key_for_weapon(Eq.weapon) == "warrior" and caster.slot_key(0) == "w_whirl", "창 = 무장 · 자리 w_whirl")

	# ④ 쿨 1초
	r = Eq.swap_weapons()
	check(not bool(r.ok) and str(r.reason) == "cd" and is_equal_approx(Eq.cd_left(), 1.0), "바로 또 누르면 쿨(1초)")
	Eq._process(0.6)
	check(not bool(Eq.swap_weapons().ok), "0.6초엔 아직 쿨")
	Eq._process(0.5)
	check(Eq.cd_left() == 0.0 and bool(Eq.swap_weapons().ok) and Eq.weapon == bow and caster.slot_key(0) == "a_pierce", "1초 뒤 다시 바꿔 활로 되돌아옴")

	# ⑤ 첫 타 ×1.15 한 번
	Eq.take_first_hit()
	Run.add_temp_buff("critPct", -1000.0, 60.0)
	var e: Node = Enemy.new(12)
	world.add_child(e)
	(e as Node3D).global_position = Vector3(1, 0, 0)
	e.resist = {}
	e._elite_def = {}
	var hit := func() -> float:
		e.hp = 5000.0
		e.max_hp = 5000.0
		melee._strike(e)
		return 5000.0 - e.hp
	var base_dmg: float = hit.call()
	Eq._process(2.0)
	Eq.swap_weapons()
	Eq.swap_weapons()   # 쿨 — 실패해도 첫 타 배율은 그대로 한 번
	var feel: Node = root.get_node("CombatFeel")
	var stops: Array = []
	feel.hitstop_triggered.connect(func(d): stops.append(d))
	var flat2: float = Eq.atk_flat_bonus()
	var d1: float = hit.call()
	var d2: float = hit.call()
	var want: float = (Melee.ATK_DAMAGE * Run.atk_mult() + flat2)
	check(is_equal_approx(d1, want * 1.15) and is_equal_approx(d2, want), "바꾼 뒤 첫 타 ×1.15, 둘째는 그대로 %.2f / %.2f (기준 %.2f, 바꾸기 전 %.2f)" % [d1, d2, want, base_dmg])
	check(Eq.take_first_hit() == 1.0, "첫 타 배율은 한 번 쓰면 꺼짐")
	check(stops.size() >= 1, "첫 타도 손맛(멈칫) 남 %s" % str(stops))
	check(Eq.FIRST_HIT_TUNE.has("stop_ms") and float(Eq.FIRST_HIT_TUNE.shake_mul) > 1.0, "첫 타 tune 이 기본보다 셈")
	Eq._process(2.0)
	Eq.swap_weapons()
	var sk_e: Node = e
	sk_e.hp = 5000.0
	caster._strike(sk_e, {"el": "phys"}, 1.0)
	var s1: float = 5000.0 - sk_e.hp
	sk_e.hp = 5000.0
	caster._strike(sk_e, {"el": "phys"}, 1.0)
	var s2: float = 5000.0 - sk_e.hp
	check(absf(s1 - roundf(s2 * 1.15)) <= 1.0 and s1 > s2, "무예 타격도 첫 타만 ×1.15 %.0f / %.0f" % [s1, s2])

	# 줍기 세 번 — 오래된 건 버림
	Eq.pick_weapon(bow2)
	check(Eq.weapon == bow2 and Eq.weapon2 != sword, "또 주우면 을에 있던 건 버림(손 → 을)")

	# ⑥ 저장 왕복
	Save.path_override = "user://probe_dungeon_swap.json"
	Eq.restore_weapon2(sword)
	Save.save(player)
	Eq.restore_weapon2({})
	check(Save.try_load() and Eq.weapon2.get("base", "") == "w_changj", "저장 왕복: weapon2 창")
	var f := FileAccess.open(Save.save_path(), FileAccess.READ)
	var data: Dictionary = JSON.parse_string(f.get_as_text())
	f.close()
	data.erase("weapon2")
	f = FileAccess.open(Save.save_path(), FileAccess.WRITE)
	f.store_string(JSON.stringify(data))
	f.close()
	check(Save.try_load() and Eq.weapon2.is_empty(), "옛 세이브(weapon2 없음) = 한 벌")
	DirAccess.remove_absolute(ProjectSettings.globalize_path(Save.save_path()))
	Save.path_override = ""

	# ⑦ 입력·장면·자세
	var evs := InputMap.action_get_events("weapon_swap") if InputMap.has_action("weapon_swap") else []
	check(evs.size() > 0 and (evs[0] as InputEventKey).physical_keycode == KEY_Q, "입력 weapon_swap = Q")
	var hud_txt := FileAccess.get_file_as_string("res://games/saga_dungeon/ui/DungeonHUD.tscn")
	var pl_txt := FileAccess.get_file_as_string("res://games/saga_dungeon/player/DungeonPlayer.tscn")
	check(hud_txt.contains("weapon_swap_button.gd") and pl_txt.contains("weapon_swap_input.gd"), "HUD 🔁 단추·Player 컴포넌트가 장면에")
	var hud: Node = (load("res://games/saga_dungeon/ui/DungeonHUD.tscn") as PackedScene).instantiate()
	world.add_child(hud)
	await process_frame
	var btn: Button = hud.get_node("WeaponSwapButton")
	Eq.restore_weapon2({})
	btn._refresh()
	check(btn.modulate.a < 0.5, "을 없으면 단추 흐림")
	Eq.restore_weapon2(sword)
	btn._refresh()
	check(btn.modulate.a == 1.0 and btn.text.contains("🔱"), "을 있으면 다음 무기 글자 %s" % btn.text)
	check(swap_in.press() and is_equal_approx(swap_in.pose_left, Eq.SWAP_SEC) and Eq.weapon == sword, "press(): 바꿔 듦 · 0.4초 자세")
	btn._refresh()
	check(btn.text.contains("1.0") or btn.text.contains("0.9"), "쿨 중 단추에 남은 초 %s" % btn.text)
	hud.queue_free()

	# 되돌림
	SS.restore(saved[0], saved[1], saved[2])
	Run.boons = saved[3]
	Run._temp_buffs.clear()
	for s in Eq.SLOT_NAMES:
		Eq.equip(s, saved_equip[s])
	Eq.restore_weapon2(saved[4])
	Eq.take_first_hit()
	print("PROBE dungeon_swap OK" if fails == 0 else "PROBE dungeon_swap FAIL %d" % fails)
	quit(0)
