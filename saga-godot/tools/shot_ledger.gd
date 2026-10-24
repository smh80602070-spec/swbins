extends RefCounted
## G-0322 촬영 도우미 — 10-23 장부 기능(G-0308~0321) D1→D2 컷. shot_scene 의 static 단계가 부른다. 상태는 메모리에서만(저장 안 함).


static func _player(tree: SceneTree) -> Node3D:
	return tree.get_first_node_in_group("player") as Node3D


## 3마을 물약 달이기 창 — 기운 물약 하나는 찾은 뒤, 나머지는 ❔
static func brew(tree: SceneTree) -> void:
	var F: Node = tree.root.get_node("ForestSaveState")
	F.items = {"약초": 3, "과일": 1, "꽃": 1, "조개": 1}
	F.brew = {"found": ["과일"], "drunk": "", "day": -1}
	var bench := tree.current_scene.find_child("CraftBench", true, false)
	var p := _player(tree)
	if bench == null:
		return
	if p != null:
		p.global_position = (bench as Node3D).global_position + Vector3(0, 0.3, 2.2)
	bench.call("open_brew")


## 3마을 유적 — 옛 비석 전시대가 선 사고 앞(menu=true 면 복원 창도)
static func relics(tree: SceneTree, menu: bool) -> void:
	var F: Node = tree.root.get_node("ForestSaveState")
	F.relics = {"got": {"bowl": 4, "tile": 2}, "restored": ["stele"], "feast": -1}
	var m := tree.current_scene.find_child("Museum", true, false) as Node3D
	var p := _player(tree)
	if m == null:
		return
	m.call("_spawn_relic", "stele")
	if p != null:
		p.global_position = m.global_position + Vector3(0, 0.3, 5.5)
	if menu:
		m.call("_open_donate_menu")


## 5천하 법령 창 — 관직 2(법령 셋까지) · 상업령 시행 중 · 틈 3달 남음
static func laws(tree: SceneTree) -> void:
	var RS: Node = tree.root.get_node("RealmSaveState")
	RS.officer_growth = {"sg_zhugeliang": {"lv": 5, "rank": 2, "exp": 0, "feats": 0}}
	RS.laws = {"list": ["commerce"], "next": int(RS.year) * 12 + int(RS.month) + 3}
	var b := tree.current_scene.find_child("LawButton", true, false)
	if b != null:
		b.call("open_screen")


## 5천하 관계 줄 — 의형제 셋·원수가 한 세력인 승진 창(🔗 꼬리)
static func relation(tree: SceneTree) -> void:
	var RS: Node = tree.root.get_node("RealmSaveState")
	RS.roster = ["sg_guanyu", "sg_liubei", "sg_zhangfei", "sg_lubu"]
	for id: String in RS.roster:
		RS.officer_city[id] = RS.current_city
	var b := tree.current_scene.find_child("PromoteButton", true, false)
	if b != null:
		b.call("_on_pressed")


## 2나락 숙련 — 든 무기 3단·갑주 2단(「내 정보」 ★ 는 뒤 단계 open_me)
static func mastery(tree: SceneTree) -> void:
	var EQ: Node = tree.root.get_node("DungeonEquipmentState")
	var w: Dictionary = EQ.weapon if not (EQ.weapon as Dictionary).is_empty() else DungeonItems.roll(3, "weapon", 1, true)
	w["mxp"] = 60
	EQ.equip("weapon", w)
	var a: Dictionary = EQ.armor if not (EQ.armor as Dictionary).is_empty() else DungeonItems.roll(3, "armor", 1, true)
	a["mxp"] = 30
	EQ.equip("armor", a)


## 1만리 바람 길잡이 — 촬영(120프레임째) 40프레임 전에 바람 한 줄기(목표 쪽)
static func wind(tree: SceneTree) -> void:
	var n := [0]
	var cb := [Callable()]
	cb[0] = func() -> void:
		n[0] += 1
		if n[0] != 50:
			return
		tree.process_frame.disconnect(cb[0])
		var g := tree.current_scene.find_child("WindGuide", true, false)
		var p := _player(tree)
		var sq := tree.get_first_node_in_group("go_story")
		if g == null or p == null:
			print("SHOT_WIND 없음")
			return
		var dir := Vector3(0, 0, -1)
		if sq != null:
			var d: Vector3 = g.call("dir_to", p.global_position, sq.call("target_pos"))
			if d != Vector3.ZERO:
				dir = d
		g.call("gust", p.global_position, dir)
	tree.process_frame.connect(cb[0])


## 2나락 지도 장치 — 티어 3 부적 하나에 변형자 하나를 새긴 뒤 켜기 전 고르기 창(✒️ 줄·금 배율)
static func atlas(tree: SceneTree) -> void:
	var S: Node = tree.root.get_node("DungeonSigilState")
	S.add_sigil(3)
	tree.root.get_node("DungeonGoldState").set("gold", 5000)
	S.inscribe(S.sigils.size() - 1)
	var b := tree.current_scene.find_child("SigilButton", true, false)
	if b != null:
		b.call("_on_pressed")


## 3마을 가축 우리 — 꼬꼬 둘·매매 하나(울타리 GLB·코드 몸), 우리 앞에 선다
static func pen(tree: SceneTree) -> void:
	var F: Node = tree.root.get_node("ForestSaveState")
	F.livestock = {"pen": true, "roll": -1, "list": [
		{"kind": "chick", "name": "꼬꼬", "fed": true, "petted": true, "heart": 3, "hungry": 0},
		{"kind": "chick", "name": "꼬순", "fed": false, "petted": false, "heart": 1, "hungry": 0},
		{"kind": "goat", "name": "매매", "fed": true, "petted": false, "heart": 2, "hungry": 0}]}
	var v := tree.current_scene.find_child("LivestockView", true, false) as Node3D
	var p := _player(tree)
	if v == null:
		print("SHOT_PEN 없음")
		return
	v.call("sync")
	if p != null:
		p.global_position = v.global_position + Vector3(0, 0.3, 6.0)


## 프레임 지연(창 모드는 프레임이 느리다 — 초 타이머 말고 프레임으로)
static func _later(tree: SceneTree, n: int, cb: Callable) -> void:
	var k := [0]
	var w := [Callable()]
	w[0] = func() -> void:
		k[0] += 1
		if k[0] >= n:
			tree.process_frame.disconnect(w[0])
			cb.call()
	tree.process_frame.connect(w[0])


## G-0325 4종횡 전직 발밑 표식 — 3차(장수 갈래) 테·별, 팔 가까이
static func story_job(tree: SceneTree) -> void:
	var S: Node = tree.root.get_node("StorySaveState")
	S.set("job", "marshal")
	var p := _player(tree)
	if p != null:
		p.call("_refresh_job_ring")


## G-0325 4종횡 쓰러짐 글(잃은 것·남은 것)
static func story_fall(tree: SceneTree) -> void:
	var f := tree.current_scene
	_later(tree, 20, func() -> void: (load("res://saga_core/ui/toast.gd") as GDScript).call("show", f, f.call("fall_text", 120), 6.0))


## G-0325 4종횡 달 사명 — 저장 카드 줄(저장은 안 함, 카드만)
static func story_monthly(tree: SceneTree) -> void:
	var M: GDScript = load("res://games/saga_story/data/story_monthly.gd")
	var key: String = M.call("now_key")
	var st := {"key": key, "n": 214, "badges": ["2026-09"]}
	var names: Dictionary = (load("res://games/saga_story/data/scenario.gd") as GDScript).get("STAGE_NAMES")
	(load("res://saga_core/ui/session_card.gd") as GDScript).call("show", tree.current_scene, "저장했다 — 이번 세션", ["처치 +38", "골드 +420", "Lv.12", M.call("line", st, key, names)])


## G-0325 4종횡 띄우기 — 가장 가까운 잡졸을 띄워 공중에 멈춘 순간
static func story_launch(tree: SceneTree) -> void:
	_later(tree, 25, func() -> void:
		var p := _player(tree)
		var L: GDScript = load("res://games/saga_story/data/story_launch.gd")
		var best: Node3D = null
		var bd := INF
		for e in tree.get_nodes_in_group("story_enemy"):
			if L.call("immune", e):
				continue
			var d := (e as Node3D).global_position.distance_to(p.global_position)
			if d < bd:
				bd = d
				best = e
		if best == null:
			print("SHOT_LAUNCH 적 없음")
			return
		p.global_position = best.global_position + Vector3(-1.4, 0.2, 0)
		print("SHOT_LAUNCH ", L.call("launch", best, 40.0))
		_later(tree, 8, func() -> void: Engine.time_scale = 0.02))


## G-0325 2나락 한 판 등급 알림(보기 값)
static func dg_rank(tree: SceneTree) -> void:
	var r := {"rank": "A", "sec": 154.0, "hits": 2, "combo": 11, "kills": 23, "bonus_gold": 84, "best": true, "prev_best": "B"}
	_later(tree, 20, func() -> void: (load("res://saga_core/ui/toast.gd") as GDScript).call("show", tree.current_scene, (load("res://games/saga_dungeon/data/dungeon_rank.gd") as GDScript).call("text", r), 6.0))


## G-0325 2나락 전설 무기 잔광 — 전설 무기를 들려 둔다(휘두름은 shot_action dg_attack)
static func dg_legend(tree: SceneTree) -> void:
	var EQ: Node = tree.root.get_node("DungeonEquipmentState")
	EQ.equip("weapon", DungeonItems.roll(20, "weapon", 4, true))


## G-0325 2나락 난입 등장 — 곁에 잡졸 셋이 땅에서 솟는 한가운데
static func dg_rise(tree: SceneTree) -> void:
	_later(tree, 20, func() -> void:
		var p := _player(tree)
		var E: GDScript = load("res://games/saga_dungeon/world/dungeon_enemy.gd")
		for i in 3:
			var e: Node3D = E.new()
			e.set("rise_in", true)
			e.set_physics_process(false)
			tree.current_scene.add_child(e)
			e.global_position = p.global_position + Vector3(-3.5 - 2.0 * i, 0.0, 3.0 + 0.5 * i)   # 문 곁에 선 나에게서 방 가운데(−x·+z)
		_later(tree, 3, func() -> void: Engine.time_scale = 0.02))


## G-0325 2나락 부서지는 통 — 첫 방 문 곁(나)에서 방 안쪽에 통·항아리 둘을 놓는다(가장 가까운 기존 통은 다른 방이라 어둡다)
static func dg_breakables(tree: SceneTree) -> void:
	var p := _player(tree)
	var bn := tree.current_scene.find_child("Breakables", true, false)
	if bn == null:
		for n in tree.get_nodes_in_group("dungeon_breakables"):
			bn = n
	if bn == null or p == null:
		print("SHOT_BREAK 없음")
		return
	var m0 := "barrel_01"
	var m1 := "jar_01"
	bn.call("_place", (bn as Node3D).to_local(p.global_position + Vector3(-3.5, 0, 3.0)), m0, 1, false)
	bn.call("_place", (bn as Node3D).to_local(p.global_position + Vector3(-5.0, 0, 3.8)), m1, 1, true)


## G-0331 4종횡 바꿔치기 — 버금 무기를 두고 연속 3 중에 바꾼 순간(알림)
static func story_wswap(tree: SceneTree) -> void:
	_later(tree, 20, func() -> void:
		var S: Node = tree.root.get_node("StorySaveState")
		S.set("weapon2", {"key": "sword2", "sb": {}, "sl": 0})
		S.set("run_combo", 3)
		S.set("_run_last_hit_ms", Time.get_ticks_msec())
		var p := _player(tree)
		if p != null:
			p.call("_swap_weapon"))


## G-0332 5천하 혼인 — 첫 적 성 세력과 우호 80·금 넉넉히, 외교 「누구와」 다음 고르기 창(혼인 줄) → 혼인 무장 고르기 창
static func realm_marry(tree: SceneTree) -> void:
	var RS: Node = tree.root.get_node("RealmSaveState")
	var b := tree.current_scene.find_child("DiploButton", true, false)
	if b == null:
		print("SHOT_MARRY 단추 없음")
		return
	var eid := ""
	for e: Dictionary in (load("res://games/saga_realm/data/realm_cities.gd") as GDScript).get("ENEMY_CITIES"):
		var id := String(e.id)
		if RS.enemies.has(id) and not bool(RS.enemies[id].get("captured", false)) and String(RS.call("force_of", id)) != "":
			eid = id
			break
	if eid == "":
		print("SHOT_MARRY 상대 없음")
		return
	var fid := String(RS.call("force_of", eid))
	RS.diplomacy[fid] = {"relation": 80, "truce_months": 0}
	RS.gold = 5000
	RS.roster = ["sg_zhugeliang", "sg_guanyu", "sg_zhangfei"]
	b.call("_pick_bride", eid, {"layer": CanvasLayer.new()})


## G-0335 2나락 신의 가호 — 신마다 은사를 겹쳐 둔 채 첫 방 출구 3택(카드 끝 신 계보 글)
static func dg_bless(tree: SceneTree) -> void:
	tree.root.get_node("DungeonRunState").set("boons", {"fury": 3, "crit": 1, "wall": 2, "dash": 1, "reach": 1, "skillamp1": 2, "greed": 1})
	_later(tree, 20, func() -> void:
		(tree.current_scene.get("_exit_used") as Array)[0] = false   # 세이브에서 깬 방이면 출구가 닫혀 있다
		tree.current_scene.call("_on_exit_entered", _player(tree), 0))


## G-0337 1만리 쉼터(G-0305) — 마을 쉼터 곁에 세워 앉힌다 · 늦게 뜨는 길 위 사건 창(ui_modal)은 뜬 뒤 닫는다
static func go_rest(tree: SceneTree) -> void:
	var close := func() -> void:
		for m in tree.get_nodes_in_group("ui_modal"):
			if m is CanvasLayer and (m as CanvasLayer).visible:   # 숨은 확인창(봉화대 등)은 두고
				m.remove_from_group("ui_modal")
				m.queue_free()
	_later(tree, 25, close)
	_later(tree, 45, close)


## G-0337 1만리 말 위 전투(G-0306) — 절영에 태워 앞 적에게 돌진(E). 태우기가 user://mount.cfg 에 마지막 탈것을 쓰므로 읽어 두었다 되돌린다.
static func go_mount_fight(tree: SceneTree) -> void:
	const CFG := "user://mount.cfg"
	var had := FileAccess.file_exists(CFG)
	var old := FileAccess.get_file_as_string(CFG) if had else ""
	var pl := _player(tree)
	var m: Node = null
	for c in pl.get_children():
		if c.has_method("dismount") and c.has_method("is_riding"):
			m = c
	if m == null:
		return
	m.call("mount", "pt_jeolyeong")
	if had:
		var f := FileAccess.open(CFG, FileAccess.WRITE)
		f.store_string(old)
		f.close()
	else:
		DirAccess.remove_absolute(ProjectSettings.globalize_path(CFG))
	_later(tree, 84, func() -> void:   # 촬영(120프레임) 바로 앞 — 일찍 치면 밀침 9 로 적이 화면 밖
		var fm := tree.get_first_node_in_group("go_field_mount")
		for e in tree.get_nodes_in_group("field_enemy"):
			if not e.call("is_dead") and not e.call("is_shielded"):
				var fwd: Vector3 = pl.call("facing")
				(e as Node3D).global_position = pl.global_position + fwd * 2.5
				e.set("max_hp", 9999.0)
				e.set("hp", 9999.0)
				break
		if fm != null:
			fm.call("charge"))


## G-0338 1만리 보스 등장 컷 — 촬영 바로 앞(화면 밖 창은 한 프레임이 길어 일찍 틀면 컷이 끝난 뒤 찍힌다)에 가장 가까운 들판 보스 8m 곁으로(보스 바가 고르면 컷이 돈다)
static func go_boss_intro(tree: SceneTree) -> void:
	_later(tree, 78, func() -> void:
		var pl := _player(tree)
		var best: Node3D = null
		for b in tree.get_nodes_in_group("go_boss"):
			if not b.call("is_dead") and (best == null or (b as Node3D).global_position.distance_to(pl.global_position) < best.global_position.distance_to(pl.global_position)):
				best = b
		if best != null:
			pl.global_position = best.global_position + Vector3(8.0, 0.5, 0.0))


## G-0339 2나락 우두머리 등장 띠 — 촬영 직전에 우두머리 6m 곁으로
static func dg_boss_banner(tree: SceneTree) -> void:
	_later(tree, 66, func() -> void:
		for e in tree.get_nodes_in_group("dungeon_boss"):
			if not e.is_in_group("world_boss"):
				_player(tree).global_position = (e as Node3D).global_position + Vector3(-4.0, 0.0, 0.0)
				return)


## G-0339 4종횡 사냥터 보스 등장 띠 — 촬영 직전에 보스 곁으로
static func st_boss_banner(tree: SceneTree) -> void:
	_later(tree, 66, func() -> void:
		for e in tree.current_scene.find_children("*", "", true, false):
			if e.get("boss_pattern") != null and bool(e.get("is_boss")):
				_player(tree).global_position = (e as Node3D).global_position + Vector3(-1.5, 0.0, 0.0)
				return)


## G-0340 1만리 동료 우정 — 명운(관우 id)을 명단에 두고 우정 Lv.7(신뢰) 로, 인물 창(C)에서 고른다
static func go_bond(tree: SceneTree) -> void:
	var PS: Node = tree.root.get_node("PartyState")
	if not (PS.get("members") as Array).has("sg_guanyu"):
		(PS.get("members") as Array).push_front("sg_guanyu")
	PS.set("bond", {"sg_guanyu": 380.0})
	_later(tree, 5, func() -> void:
		var c := tree.get_first_node_in_group("go_character_screen")
		if c != null:
			c.call("open_screen")
			c.call("select", "sg_guanyu"))


## G-0341 2나락 부대 우정 — 부대 둘(명운 신뢰 6·뇌호 친근 3)을 두고 HUD 부대 줄을 다시 그린다
static func dg_bond(tree: SceneTree) -> void:
	tree.root.get_node("DungeonPartyState").set("members", ["sg_guanyu", "sg_zhangfei"] as Array[String])
	tree.root.get_node("DungeonSaveState").set("bond", {"sg_guanyu": 300.0, "sg_zhangfei": 95.0})
	_later(tree, 3, func() -> void: tree.call_group("dungeon_party_label", "_refresh"))


## G-0342 1만리 보스 약점 표식 — 등장 컷은 끄고 가까운 들판 보스를 대화 구도로 잡아 둔다(표식이 몸에 묻히는지)
static func go_weakpart(tree: SceneTree) -> void:
	OS.set_environment("SAGA_BOSS_INTRO", "0")
	_later(tree, 40, func() -> void:
		var pl := _player(tree)
		var best: Node3D = null
		for b in tree.get_nodes_in_group("go_boss"):
			if not b.call("is_dead") and (best == null or (b as Node3D).global_position.distance_to(pl.global_position) < best.global_position.distance_to(pl.global_position)):
				best = b
		if best == null:
			return
		pl.global_position = best.global_position + Vector3(9.0, 0.5, 0.0)
		var rig := tree.get_first_node_in_group("camera_rig")
		if rig != null:
			rig.call("talk_shot", best.global_position, pl.global_position))


## G-0343 1만리 대치 — 가까운 무리 곁에 세워 맞서게 하고, 찍기 직전 가장 가까운 놈이 달려드는 중간(예고 빛)에서 멈춘다
static func go_standoff(tree: SceneTree) -> void:
	OS.set_environment("SAGA_BOSS_INTRO", "0")
	_later(tree, 75, func() -> void:
		var pl := _player(tree)
		var so := tree.get_first_node_in_group("go_field_standoff")
		if pl == null or so == null:
			return
		var list: Array = []
		var bd := INF
		var camps := {}
		for e in tree.get_nodes_in_group("field_enemy"):
			if e.has_meta("go_camp") and not e.call("is_dead"):
				var id := String(e.get_meta("go_camp"))
				if not camps.has(id):
					camps[id] = []
				camps[id].append(e)
		for id in camps:
			var d := ((camps[id][0]) as Node3D).global_position.distance_to(pl.global_position)
			if (camps[id] as Array).size() >= 2 and d < bd:
				bd = d
				list = camps[id]
		if list.is_empty():
			return
		var m0 := list[0] as Node3D
		for e in list:
			e.set("asleep", false)
			e.set("ai", 0)
		var c := Vector3.ZERO
		for e in list:
			c += (e as Node3D).global_position
		c /= float(list.size())
		var dir := Vector3(m0.global_position.x - c.x, 0.0, m0.global_position.z - c.z).normalized()
		pl.global_position = m0.global_position + dir * 9.0 + Vector3.UP * 0.5
		so.set_physics_process(false)
		so.call("begin", "shot", list)
		_later(tree, 8, func() -> void:
			so.call("_lunge", so.call("_nearest", pl, list))
			so.call("tick", 0.25)))


## G-0344 2나락 피 구슬 — 체력 가득인 채 내 앞에 우두머리 몫 셋을 떨궈 둔다(가득이면 끌려오지 않고 남음)
static func dg_globe(tree: SceneTree) -> void:
	_later(tree, 40, func() -> void:
		var pl := _player(tree)
		if pl == null:
			return
		preload("res://games/saga_dungeon/world/health_globe.gd").drop(tree.current_scene, pl.global_position + Vector3(-2.4, 0.0, 0.4), true, false))


## G-0345 4종횡 콤보 킬 — 내 앞에서 열 번 이어 잡은 셈(글 "콤보 킬 n"·파란 경험치 구슬, 끌림 밖)
static func st_combo(tree: SceneTree) -> void:
	_later(tree, 80, func() -> void:
		var pl := _player(tree)
		if pl == null:
			return
		var C: GDScript = load("res://games/saga_story/world/story_combo_kill.gd")
		for i in 10:
			C.call("on_kill", tree.current_scene, pl.global_position + Vector3(4.5, 0.0, 0.0), 5.0, false))


## G-0346 3마을 벌집 — 내 옆에서 벌떼가 나와 쫓아오는 중(벌집 알림)
static func fs_bees(tree: SceneTree) -> void:
	_later(tree, 82, func() -> void:
		for n in tree.root.find_children("TalkBox*", "", true, false):
			n.queue_free()
		tree.paused = false
		var pl := _player(tree)
		if pl == null:
			return
		load("res://games/saga_forest/world/forest_bees.gd").call("spawn", tree.current_scene, pl.global_position + Vector3(3.5, 0.0, 1.5)))


## G-0347 ② 5천하 지역 단위 지도 — 시나리오를 확정해(성표가 서야 한다 — rk_map_wide 는 고르기 창 상태라 성표 0) 지도를 켠다
static func rk_region(tree: SceneTree) -> void:
	var rs: Node = tree.root.get_node("/root/RealmSaveState")
	rs.set("scenario_ready", true)
	rs.set("view_region", "")
	_later(tree, 5, func() -> void: rs.set("viewing_map", true))


## G-0347 ② 천하도 카드 창(지역 고르기) — 이야기 카드는 닫는다
static func rk_region_cards(tree: SceneTree) -> void:
	rk_region(tree)
	_later(tree, 40, func() -> void:
		for m in tree.get_nodes_in_group("ui_modal"):
			if m is CanvasItem or m is CanvasLayer:
				m.set("visible", false)
		var rv := tree.get_first_node_in_group("realm_region_view")
		if rv != null:
			rv.call("_fill_cards")
			(rv.get("_cards") as Control).visible = true)


## G-0347 ⑤ 5천하 전장 책략 — 장수를 고른 판에서 📜 를 한 번 눌러 첫 책략(화계) 칸을 띄운다
static func rk_plot(tree: SceneTree) -> void:
	load("res://tools/shot_realm_tactics.gd").call("stage", tree, true, false, false)
	_later(tree, 30, func() -> void:
		var v := tree.current_scene.find_child("TacticsView", true, false)
		if v != null:
			v.call("_on_fire_toggle"))


## G-0347 ⑤-c 5천하 전장 일기토 — 고른 내 장수를 적 장수 곁에 세워 ⚔️ 일기토 → 그 장수를 고른 첫 합 고르기 창
static func rk_duel(tree: SceneTree) -> void:
	load("res://tools/shot_realm_tactics.gd").call("stage", tree, true, false, false)
	_later(tree, 30, func() -> void:
		var v := tree.current_scene.find_child("TacticsView", true, false)
		if v == null:
			return
		var b: Dictionary = v.get("board")
		var sel := String(v.get("_sel"))
		var me: Dictionary = {}
		var foe: Dictionary = {}
		for u: Dictionary in b.units:
			if String(u.uid) == sel:
				me = u
			elif String(u.side) == "foe" and String(u.kind) == "officer" and foe.is_empty():
				foe = u
		if me.is_empty() or foe.is_empty():
			return
		var x := int(foe.x) - 1
		var y := int(foe.y)
		for u: Dictionary in b.units:
			if u != me and int(u.x) == x and int(u.y) == y:
				u.x = 0
				u.y = 0
		me.x = x
		me.y = y
		v.call("_place", sel, x, y)
		v.call("_on_cmd_toggle", "duel")
		v.call("pick_cell", int(foe.x), int(foe.y)))
