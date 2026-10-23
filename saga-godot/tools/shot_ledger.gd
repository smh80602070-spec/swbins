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
