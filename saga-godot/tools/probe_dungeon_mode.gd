extends SceneTree

## G-0247 사가나락 난도 평·험·절(data/dungeon_mode.gd) + 부적 던전 사망 규칙 — 화면 없는 규칙 점검. 씨앗 고정(20260824).
##   godot --headless --path saga-godot --script res://tools/probe_dungeon_mode.gd
## ① 1층 잡졸 hp 24·43·77(dmg 5·8·11) · 저항 +0·+10·+20 · 난입·월드 보스 자리(use_mode=false)는 평 ② 닫힌 난도 거절(문턱 3·6방)
## ③ 회차 중 고정(begin_run 뒤 set_mode 는 다음 회차) ④ 부적과 곱(험 × 티어 2 = 24×1.8 → ×1.7) ⑤ 금 ×gold · 등급 굴림 bias 가 좋은 등급을 늘림
## ⑥ 부적 켠 채 사망 → 꺼짐·소모(되돌림 없음, 최고 기록 그대로) · 정예 무리 4+min(3,⌊T/3⌋) ⑦ 저장 왕복·옛 세이브(칸 없음) = normal
## 진짜 세이브는 안 건드린다(path_override). 끝에 "PROBE dungeon_mode OK" 또는 "PROBE dungeon_mode FAIL n".

## autoload 를 쓰는 스크립트는 const preload 말고 load()(컴파일 때 autoload 이름이 아직 없다)
var Mode: GDScript
var Enemy: GDScript
var Loot: GDScript
var Items: GDScript

var fails := 0


func check(cond: bool, msg: String) -> void:
	if cond:
		print("  ok   ", msg)
	else:
		fails += 1
		print("  FAIL ", msg)


## 1층 잡졸 하나(정예 안 끼게 — 종 저항 없는 결로 재려고 fire 대신 비교는 차이로)
func _foe(use_mode: bool) -> Node:
	var e: Node = null
	for i in range(40):   # 정예가 끼면 다시(정예 배율이 섞이지 않게)
		e = Enemy.new(1, false, false, false, 1.0, 1.0, use_mode)
		if String(e.elite_key) == "":
			return e
		e.free()
	return e


func _initialize() -> void:
	await process_frame
	Mode = load("res://games/saga_dungeon/data/dungeon_mode.gd")
	Enemy = load("res://games/saga_dungeon/world/dungeon_enemy.gd")
	Loot = load("res://games/saga_dungeon/world/loot_pickup.gd")
	Items = load("res://games/saga_dungeon/data/dungeon_items.gd")
	seed(20260824)
	var S: Node = root.get_node("DungeonSigilState")
	var Save: Node = root.get_node("DungeonSaveState")
	var Run: Node = root.get_node("DungeonRunState")
	var saved := {"sigils": S.sigils.duplicate(true), "active": S.active_index, "best": S.best_tier_cleared, "next": S._next_id,
		"rooms": Save.rooms_cleared.duplicate(), "boons": Run.boons.duplicate(), "chosen": Mode.chosen, "run": Mode.run_mode}
	Run.boons = {}
	S.restore([], -1, 0, 1)

	# ① 배율
	var hp := []
	var dmg := []
	var res := []
	for k in ["normal", "hard", "hell"]:
		Mode.chosen = k
		Mode.run_mode = k
		var e: Node = _foe(true)
		hp.append(int(e.max_hp))
		dmg.append(int(e.attack_damage))
		res.append(e.resist_pct("emp") - float(e.resist.get("emp", 0.0)))
		e.free()
	check(hp == [24, 43, 77], "1층 잡졸 hp 평·험·절 = %s (24·43·77)" % str(hp))
	check(dmg == [5, 8, 11], "1층 잡졸 dmg 평·험·절 = %s (5·8 round(7.5)·11)" % str(dmg))
	check(is_equal_approx(res[0], 0.0) and is_equal_approx(res[1], 10.0) and is_equal_approx(res[2], 20.0), "저항 +0·+10·+20 = %s" % str(res))
	var off: Node = _foe(false)   # 난입·월드 보스 자리(use_mode=false) — 절이어도 평
	check(int(off.max_hp) == 24 and is_equal_approx(off.resist_pct("emp"), float(off.resist.get("emp", 0.0))), "use_mode=false(난입·월드 보스)는 절이어도 hp 24·저항 그대로")
	off.free()

	# ② 문턱 — 험 3방 · 절 6방
	Mode.run_mode = ""
	Mode.chosen = "normal"
	check(Mode.open_modes(0).size() == 1 and Mode.open_modes(3).size() == 2 and Mode.open_modes(6).size() == 3, "열린 난도 0방 1개 · 3방 2개 · 6방 3개")
	check(not Mode.set_mode("hard", 2) and Mode.chosen == "normal", "닫힌 난도(2방에 험) 거절")
	check(not Mode.set_mode("hell", 5) and Mode.chosen == "normal", "닫힌 난도(5방에 절) 거절")
	check(not Mode.set_mode("nope", 7) and Mode.chosen == "normal", "모르는 키 거절")
	check(Mode.set_mode("hard", 3) and Mode.chosen == "hard", "3방이면 험 고름")

	# ③ 회차 중 고정
	Mode.begin_run(3)
	check(Mode.in_run() and String(Mode.mode().key) == "hard", "begin_run 이 험을 굳힘")
	check(Mode.set_mode("normal", 3) and Mode.chosen == "normal" and String(Mode.mode().key) == "hard", "회차 중 평으로 바꿔도 이번 회차는 험(고른 값만 바뀜)")
	Mode.end_run()
	Mode.begin_run(3)
	check(String(Mode.mode().key) == "normal", "다음 회차엔 고른 평")
	Mode.chosen = "hell"
	Mode.begin_run(2)
	check(String(Mode.mode().key) == "normal", "고른 절이 닫혀 있으면(세이브가 바뀜) 회차는 평")

	# ④ 부적과 곱 — 험 × 티어 2(1+0.35×2 = 1.7): round(round(43.2)... 웹은 한 식 안이라 round(24×1.8×1.7)=73 근처
	S.add_sigil(2)
	S.activate(0)
	Mode.run_mode = "hard"
	var e2: Node = _foe(true)
	check(int(e2.max_hp) == int(roundf(43.0 * 1.7)) and int(e2.max_hp) > 43, "험 × 부적 T2 = %d (43×1.7=73)" % int(e2.max_hp))
	e2.free()

	# ⑤ 금·등급 굴림
	Mode.run_mode = "hell"
	var g_norm: int = Loot.gold_amount(3, 1.0)
	var parent := Node3D.new()
	root.add_child(parent)
	Loot.spawn_at(parent, Vector3.ZERO, 3, false, false, 1.0, true)
	var gold_ok := false
	for c in parent.get_children():
		if String(c.name).begins_with("GoldPickup"):
			gold_ok = true
	parent.queue_free()
	check(gold_ok and g_norm > 0, "spawn_at(use_mode) 가 금을 낸다(절 금 ×2.4 는 gold_amount(mul×2.4))")
	check(Loot.gold_amount(3, 2.4) > Loot.gold_amount(3, 1.0) * 2, "절 금 %d > 평 %d ×2" % [Loot.gold_amount(3, 2.4), Loot.gold_amount(3, 1.0)])
	var good0 := 0
	var good26 := 0
	for i in range(4000):
		if Items.roll_tier(1.0, 0.0) >= 2:
			good0 += 1
		if Items.roll_tier(1.0, 26.0) >= 2:
			good26 += 1
	check(good26 > good0 * 1.2, "등급 굴림 bias 26 이 좋은 등급(2+)을 늘림 %d → %d /4000" % [good0, good26])
	S.deactivate()

	# ⑥ 부적 사망 — 꺼짐·소모
	S.restore([], -1, 0, 1)
	S.add_sigil(3)
	S.add_sigil(5)
	S.activate(1)
	var t: int = S.fail_run()
	check(t == 5 and not S.is_active() and S.sigils.size() == 1 and int(S.sigils[0].tier) == 3 and S.best_tier_cleared == 0, "부적 켠 채 사망: 티어 5 소모·꺼짐·남은 부적 1(티어 3)·최고 기록 0 그대로")
	check(S.fail_run() == 0 and S.sigils.size() == 1, "꺼져 있으면 사망해도 부적 그대로")
	check(S.pack_count(1) == 4 and S.pack_count(3) == 5 and S.pack_count(6) == 6 and S.pack_count(10) == 7, "정예 무리 4+min(3,⌊T/3⌋): T1 4·T3 5·T6 6·T10 7")
	var ph := FileAccess.get_file_as_string("res://games/saga_dungeon/player/player_health.gd")
	check(ph.contains("DungeonSigilState.fail_run()"), "player_health _die_and_respawn 이 fail_run 을 부른다(배선)")
	var tr := FileAccess.get_file_as_string("res://games/saga_dungeon/world/test_room.gd")
	check(tr.contains("DungeonMode.begin_run()") and tr.contains("_maybe_spawn_sigil_pack") and tr.contains("1.0, 1.0, true)"), "test_room: 적 세우기 전 begin_run · 정예 무리 · 방 적 use_mode(배선)")

	# ⑦ 저장 왕복·옛 세이브
	var old_path: String = Save.path_override
	Save.path_override = "user://probe_dungeon_mode_tmp.json"
	var body := Node3D.new()
	root.add_child(body)
	Mode.chosen = "hell"
	Save.save(body)
	Mode.chosen = "normal"
	check(Save.try_load() and Mode.chosen == "hell", "저장 왕복: 절 → 절")
	var txt := FileAccess.get_file_as_string(Save.save_path())
	var d: Dictionary = JSON.parse_string(txt)
	d.erase("mode")
	var f := FileAccess.open(Save.save_path(), FileAccess.WRITE)
	f.store_string(JSON.stringify(d))
	f.close()
	check(Save.try_load() and Mode.chosen == "normal" and Save.SAVE_VERSION == 2, "옛 세이브(mode 칸 없음) = normal · 버전 2 그대로")
	DirAccess.remove_absolute(ProjectSettings.globalize_path("user://probe_dungeon_mode_tmp.json"))
	DirAccess.remove_absolute(ProjectSettings.globalize_path("user://probe_dungeon_mode_tmp.json.bak"))
	Save.path_override = old_path
	body.queue_free()

	S.restore(saved.sigils, saved.active, saved.best, saved.next)
	Save.rooms_cleared.assign(saved.rooms)
	Run.boons = saved.boons
	Mode.chosen = saved.chosen
	Mode.run_mode = saved.run
	print("PROBE dungeon_mode ", "OK" if fails == 0 else "FAIL %d" % fails)
	quit(1 if fails > 0 else 0)
