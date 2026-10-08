extends SceneTree

## 사가나락 방·정예·보스층·등용·결사(world/test_room.gd 방 표, world/dungeon_enemy.gd 정예·체력·공격 공식, data/dungeon_party_state.gd 부대, data/dungeon_hardcore_state.gd·dungeon_grave_state.gd 결사·무덤) 자동 점검 — 화면·씬 없이 표와 규칙만. 씨앗 고정(20260824).
##   godot --headless --path saga-godot --script res://tools/probe_dungeon_world.gd
## ① 방: ROOM_COUNT 7 = ROOM_KINDS 7 · 종류가 표 안 · 정예 소굴·상자·우물·미니보스·채광이 하나씩 · 보스층(3·6층)은 fight · 방 분위기 3종이 순환하고 방·문·복도 모델이 다 있음 · 등용 인물 둘이 도감에 있음
## ② 정예: 8종(키 유일·색·배율) · 확률 = min(0.30, 0.06+0.012×층) · 강제 정예는 항상 8종 중 하나 · 체력 1.35배·공격 1.15배(없는 배율의 기본값) 또는 그 종의 배율 · 저항 둘(철갑 물리 35·호신 기 45)
## ③ 체력·공격 공식(24×1.26^(층-1)·5×1.20^(층-1)) · 보스 ×7·×2.2 에 정예가 안 붙음 · 그림자 분신은 체력 0.34·공격 0.6 에 정예가 안 붙음 · 추가 배율(난입)과 체력 전용 배율(월드 보스)
## ④ 등용: 설득 규칙(세 번·상한 3 라운드·기질에 맞는 호소 3번이면 성공·틀린 호소만 3번이면 실패·끝나면 더 못 함) · DungeonPartyState 가 인원당 공격 +4%·체력 +5% 를 합산에 얹음
## ⑤ 결사: enable 은 한 번만 true · mark_fallen 은 처음 한 번만 기록 · restore · 무덤은 금·무기·부적을 되찾으면 비워짐(빈 무덤은 아무 일 없음). 상태는 끝에 되돌린다.
## 끝에 "PROBE dungeon_world OK" 또는 "PROBE dungeon_world FAIL n".

var fails := 0


func check(cond: bool, msg: String) -> void:
	if cond:
		print("  ok   ", msg)
	else:
		fails += 1
		print("  FAIL ", msg)


func _initialize() -> void:
	await process_frame  # 던전 autoload 가 올라온 뒤에 불러야 test_room·dungeon_enemy 가 컴파일된다
	seed(20260824)
	var Room: GDScript = load("res://games/saga_dungeon/world/test_room.gd")
	var Enemy: GDScript = load("res://games/saga_dungeon/world/dungeon_enemy.gd")
	var Persuade: GDScript = load("res://games/saga_go/data/persuade_rules.gd")
	var Characters: GDScript = load("res://saga_core/data/characters.gd")
	var Items: GDScript = load("res://games/saga_dungeon/data/dungeon_items.gd")
	check(Room != null and Enemy != null, "test_room·dungeon_enemy 를 불러옴")
	if Room == null or Enemy == null:
		print("PROBE dungeon_world FAIL ", fails)
		quit(1)
		return

	# ① 방
	var kinds: Array = Room.ROOM_KINDS
	var allowed := ["fight", "trove", "well", "shrine", "elite", "miniboss", "cave", "merchant", "puzzle", "event", "forage"]
	var kinds_ok: bool = kinds.size() == int(Room.ROOM_COUNT) and int(Room.ROOM_COUNT) == 7
	for k in kinds:
		kinds_ok = kinds_ok and allowed.has(String(k))
	check(kinds_ok, "방 7: ROOM_KINDS 개수 = ROOM_COUNT · 종류가 다 표 안 %s" % str(kinds))
	var count := {}
	for k in kinds:
		count[k] = int(count.get(k, 0)) + 1
	check(count.get("elite", 0) == 1 and count.get("trove", 0) == 1 and count.get("well", 0) == 1 and count.get("miniboss", 0) == 1 and count.get("cave", 0) == 1 and count.get("fight", 0) == 2, "방 종류: 정예 소굴·상자·우물·미니보스·채광이 하나씩 · 싸움 둘")
	var boss_rooms: Array = []
	for i in int(Room.ROOM_COUNT):
		if (i + 1) % 3 == 0:
			boss_rooms.append(i)
	var boss_kind_ok := true
	for i in boss_rooms:
		boss_kind_ok = boss_kind_ok and kinds[i] == "fight"
	check(boss_rooms == [2, 5] and boss_kind_ok, "보스층: 3층·6층(방 2·5)은 싸움 방(floor %% 3 == 0 → 보스 둘)")
	var moods: Array = Room.ROOM_MOODS
	var mood_ok: bool = moods.size() == 3 and Room.MOOD_ROOM_GLB.size() == 3 and Room.MOOD_GATE_GLB.size() == 3 and Room.MOOD_CORRIDOR_GLB.size() == 3
	for m in moods:
		for tbl in [Room.MOOD_ROOM_GLB, Room.MOOD_GATE_GLB, Room.MOOD_CORRIDOR_GLB]:
			mood_ok = mood_ok and (tbl as Dictionary).has(m) and ResourceLoader.exists(String(tbl[m]))
	check(mood_ok, "방 분위기 3종(흙·석회·용암): 방·문·복도 모델이 표에 있고 파일이 있음")
	var room_inst: Node = Room.new()
	var cyc: bool = room_inst._mood_for_room(0) == "dirt" and room_inst._mood_for_room(1) == "limestone" and room_inst._mood_for_room(2) == "lava" and room_inst._mood_for_room(3) == "dirt" and room_inst._mood_for_room(6) == "dirt"
	room_inst.free()
	check(cyc, "분위기는 방 번호대로 순환(0 흙·1 석회·2 용암·3 흙) — 채광 방(6)도 흙")
	var hero_ok := true
	for id in Room.ROOM_HERO_IDS:
		var h: Variant = Characters.find(String(id))
		hero_ok = hero_ok and h != null and int(h.rarity) == 5 and ["might", "wisdom", "virtue"].has(String(h["trait"]))
	check(hero_ok and Room.ROOM_HERO_IDS.size() == 2 and Room.STARTER_PICK_COUNT <= Room.STARTER_POOL_SIZE, "방 등용 인물 둘: 도감에 있고 5성·기질 유효 · 출사표 3택 ≤ 후보 5")

	# ② 정예
	var ek := {}
	var el_ok: bool = Enemy.ELITES.size() == 8
	for e: Dictionary in Enemy.ELITES:
		ek[e.key] = true
		el_ok = el_ok and String(e.name) != "" and String(e.color).begins_with("#")
	check(el_ok and ek.size() == 8, "정예 8종: 키 유일·이름·색")
	check(absf(float(Enemy._elite_chance(1)) - 0.072) < 1e-6 and absf(float(Enemy._elite_chance(10)) - 0.18) < 1e-6 and float(Enemy._elite_chance(20)) == 0.30 and float(Enemy._elite_chance(99)) == 0.30, "정예 확률 = min(0.30, 0.06+0.012×층): 1층 7.2%% · 10층 18%% · 20층 이후 30%%")
	var seen := {}
	var el_stats_ok := true
	for n in 400:
		var en = Enemy.new(3, false, false, true)
		var base_hp: float = roundf(24.0 * pow(1.26, 2.0))
		var base_dmg: float = roundf(5.0 * pow(1.20, 2.0))
		var def: Dictionary = {}
		for e: Dictionary in Enemy.ELITES:
			if e.key == en.elite_key:
				def = e
		if def.is_empty():
			el_stats_ok = false
		else:
			seen[en.elite_key] = true
			el_stats_ok = el_stats_ok and en.max_hp == roundf(base_hp * float(def.get("hp", 1.35))) and en.attack_damage == roundf(base_dmg * float(def.get("dmg", 1.15))) and en.hp == en.max_hp \
				and en.resist == def.get("resist", {})
		en.free()
	check(el_stats_ok and seen.size() == 8, "강제 정예 400번: 항상 8종 중 하나 · 체력·공격이 그 종의 배율(없으면 1.35·1.15) · 8종이 다 나옴")
	var pl_ok := false
	var wd_ok := false
	for n in 300:
		var e2 = Enemy.new(1, false, false, true)
		pl_ok = pl_ok or (e2.elite_key == "plated" and e2.resist == {"phys": 35.0})
		wd_ok = wd_ok or (e2.elite_key == "warded" and e2.resist == {"chi": 45.0})
		e2.free()
	check(pl_ok and wd_ok, "철갑 두른은 물리 저항 35 · 호신 두른은 기 저항 45")

	# ③ 체력·공격 공식
	var form_ok := true
	var plain_hp: float = 0.0
	for f in range(1, 11):
		var e3 = Enemy.new(f, false, false, false, 1.0, 1.0)
		var bhp: float = roundf(24.0 * pow(1.26, f - 1))
		var bdm: float = roundf(5.0 * pow(1.20, f - 1))
		var hp_plain: bool = e3.max_hp == bhp and e3.attack_damage == bdm
		var hp_elite: bool = e3.elite_key != "" and e3.max_hp > bhp
		form_ok = form_ok and (hp_plain or hp_elite)
		if f == 1:
			plain_hp = e3.max_hp
		e3.free()
	check(form_ok, "체력·공격: 층 1~10 이 24×1.26^(층-1) · 5×1.20^(층-1) (정예면 더 큼)")
	var boss_ok := true
	for f in [3, 6, 9]:
		for n in 40:
			var b = Enemy.new(f, true)
			boss_ok = boss_ok and b.is_boss and b.elite_key == "" and b.max_hp == roundf(24.0 * pow(1.26, f - 1) * 7.0) and b.attack_damage == roundf(5.0 * pow(1.20, f - 1) * 2.2) and b.resist.is_empty()
			b.free()
	check(boss_ok, "보스(3·6·9층): 체력 ×7 · 공격 ×2.2 · 정예가 안 붙음")
	## G-0118 — 배경음: 층 보스가 서 있어도 곁(한 방 안)이 아니면 들판곡, 곁이거나 난입이면 전투곡
	var far_boss := Vector3(0, 0, -2.0 * Room.ROOM_SPACING)
	check(Room.pick_bgm(false, Vector3.ZERO, [far_boss]) == "dungeon-field" and Room.pick_bgm(false, far_boss + Vector3(0, 0, 3), [far_boss]) == "dungeon-battle"
		and Room.pick_bgm(true, Vector3.ZERO, []) == "dungeon-battle" and Room.pick_bgm(false, Vector3.INF, [far_boss]) == "dungeon-field", "배경음: 먼 층 보스는 들판곡 · 보스 곁·난입은 전투곡")
	var shade_ok := true
	for n in 60:
		var sh = Enemy.new(5, false, true, true)
		shade_ok = shade_ok and sh.elite_key == "" and sh.max_hp == maxf(1.0, roundf(roundf(24.0 * pow(1.26, 4)) * 0.34)) and sh.attack_damage == roundf(roundf(5.0 * pow(1.20, 4)) * 0.6)
		sh.free()
	check(shade_ok, "그림자 분신: 체력 ×0.34 · 공격 ×0.6 · 강제 정예도 안 붙음")
	var mults = Enemy.new(4, false, false, false, 2.0, 1.0)
	var hp_only = Enemy.new(4, false, false, false, 1.0, 8.0)
	var plain4 = Enemy.new(4, false, false, false)
	var m_ok: bool = (mults.elite_key != "" or (mults.max_hp == roundf(roundf(24.0 * pow(1.26, 3)) * 2.0) and mults.attack_damage == roundf(roundf(5.0 * pow(1.20, 3)) * 2.0))) \
		and (hp_only.elite_key != "" or (hp_only.max_hp == roundf(24.0 * pow(1.26, 3)) * 8.0 and hp_only.attack_damage == roundf(5.0 * pow(1.20, 3)))) and plain4.max_hp > 0.0
	mults.free()
	hp_only.free()
	plain4.free()
	check(m_ok, "추가 배율(난입)은 체력·공격에 · 체력 전용 배율(월드 보스 ×8)은 체력에만")
	var rate := 0
	for n in 4000:
		var rn = Enemy.new(10)
		if rn.elite_key != "":
			rate += 1
		rn.free()
	check(absf(float(rate) / 4000.0 - 0.18) < 0.03, "10층 잡졸 4000마리 중 정예 %.1f%% (기대 18%%)" % (float(rate) / 40.0))

	# ④ 등용
	var wise: Variant = Persuade.create("wisdom")
	var r1: Dictionary = wise.appeal("wisdom")
	wise.appeal("wisdom")
	var r3: Dictionary = wise.appeal("wisdom")
	check(Persuade.MAX_ROUND == 3 and r1.ok and r1.hit and float(r1.gained) >= 34.0 and float(r1.gained) <= 48.0 and r3.done and r3.succeeded and not wise.appeal("wisdom").ok, "설득: 기질에 맞는 호소 3번이면 성공 · 끝나면 더 못 함")
	var stubborn: Variant = Persuade.create("might")
	var s1: Dictionary = stubborn.appeal("wisdom")
	stubborn.appeal("virtue")
	var s3: Dictionary = stubborn.appeal("wisdom")
	check(not s1.hit and float(s1.gained) >= 8.0 and float(s1.gained) <= 18.0 and s3.done and not s3.succeeded and float(stubborn.favor) < 100.0, "틀린 호소만 3번이면 실패(호감 %.0f < 100)" % float(stubborn.favor))
	var mix: Variant = Persuade.create("virtue")
	mix.appeal("virtue")
	mix.appeal("virtue")
	mix.appeal("might")
	check(mix.done and float(mix.favor) >= 34.0 * 2.0 + 8.0 - 0.001, "맞는 호소 둘 + 틀린 하나는 호감이 쌓이되(%.0f) 세 라운드에서 끝남" % float(mix.favor))
	var Party: Node = root.get_node("DungeonPartyState")
	var Run: Node = root.get_node("DungeonRunState")
	var saved_members: Array[String] = []
	saved_members.assign(Party.members)
	var saved_boons: Dictionary = Run.boons.duplicate()
	Party.restore([] as Array[String])
	Run.boons = {}
	var atk0: float = Run.atk_mult()
	var hp0: float = Run.hp_mult()
	Party.recruit("sg_zhaoyun")
	Party.recruit("sg_zhugeliang")
	check(Party.members == ["sg_zhaoyun", "sg_zhugeliang"] and Party.world_eff_sum("atkPct") == 8.0 and Party.world_eff_sum("hpPct") == 10.0 and Party.world_eff_sum("critPct") == 0.0 and absf(Run.atk_mult() - atk0 - 0.08) < 1e-6 and absf(Run.hp_mult() - hp0 - 0.10) < 1e-6,
		"등용 둘: 공격 +8%% · 체력 +10%%(인원당 4·5)가 은사 합산(atk_mult·hp_mult)에 얹힘")
	Party.restore(saved_members)
	Run.boons = saved_boons

	# ⑤ 결사·무덤
	var H: Node = root.get_node("DungeonHardcoreState")
	var Gr: Node = root.get_node("DungeonGraveState")
	var Gold: Node = root.get_node("DungeonGoldState")
	var Eq: Node = root.get_node("DungeonEquipmentState")
	var saved_hc: bool = H.hardcore
	var saved_fallen: Dictionary = H.fallen.duplicate()
	var saved_grave: Dictionary = Gr.grave.duplicate(true)
	var saved_gold: int = Gold.gold
	var saved_w: Dictionary = (Eq.item_for("weapon") as Dictionary).duplicate(true)
	var saved_c: Dictionary = (Eq.item_for("charm") as Dictionary).duplicate(true)
	H.restore(false, {})
	check(H.enable() and H.hardcore and not H.enable(), "결사: 켜기는 한 번만 true")
	H.mark_fallen(4)
	var at1: Variant = H.fallen.get("at")
	H.mark_fallen(9)
	check(H.fallen.floor == 4 and H.fallen.at == at1, "스러짐은 처음 한 번만 기록(4층 · 다시 불러도 안 덮음)")
	H.restore(true, {"floor": 7, "at": 5})
	check(H.hardcore and H.fallen.floor == 7, "restore 가 결사·스러짐을 통째로 갈아 끼움")
	Gr.restore({})
	Gold.gold = 10
	Gr.claim()
	check(not Gr.has_grave() and Gold.gold == 10, "빈 무덤을 열어도 아무 일 없음")
	var w: Dictionary = Items.roll(6, "weapon", 2, true)
	var c: Dictionary = Items.roll(6, "charm", 2, true)
	Gr.set_grave(Vector3(1.0, 0.0, -2.5), 77, w, c)
	var pos_ok: bool = Gr.has_grave() and Gr.grave_position() == Vector3(1.0, 0.0, -2.5)
	Gr.claim()
	check(pos_ok and not Gr.has_grave() and Gold.gold == 87 and Eq.item_for("weapon") == w and Eq.item_for("charm") == c, "무덤: 자리를 기억하고 · 되찾으면 금 77·무기·부적이 돌아오고 비워짐")
	H.restore(saved_hc, saved_fallen)
	Gr.restore(saved_grave)
	Gold.gold = saved_gold
	Eq.equip("weapon", saved_w)
	Eq.equip("charm", saved_c)

	print("PROBE dungeon_world ", "OK" if fails == 0 else "FAIL %d" % fails)
	quit(1 if fails > 0 else 0)
