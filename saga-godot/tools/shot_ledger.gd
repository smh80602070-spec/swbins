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
			e.global_position = p.global_position + Vector3(-2.5 + 2.5 * i, 0.0, -3.0)
		_later(tree, 6, func() -> void: Engine.time_scale = 0.03))


## G-0325 2나락 부서지는 통 — 가장 가까운 통 곁에 선다
static func dg_breakables(tree: SceneTree) -> void:
	var p := _player(tree)
	var best: Node3D = null
	var bd := INF
	for b in tree.get_nodes_in_group("dungeon_breakable"):
		var d := (b as Node3D).global_position.distance_to(p.global_position)
		if d < bd:
			bd = d
			best = b
	if best != null:
		p.global_position = best.global_position + Vector3(1.6, 0.3, 1.6)
	else:
		print("SHOT_BREAK 없음")
