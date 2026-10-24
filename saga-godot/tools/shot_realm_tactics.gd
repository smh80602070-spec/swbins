extends RefCounted
## G-0183·G-0191 촬영 도우미 — shot_scene.gd 의 static 단계가 부른다. 새 판 194 에 장수 둘(하후·장료 — 메모리에서만, 저장 안 함)을 허창에 더하고
## 병력 3000 으로 소패 전술판을 연다. pick 이 참이면 앞장 장수를 골라 이동 칸(파랑)·명중률 글을 띄운다.
## cover 가 참이면(G-0191) 판을 열기 전에 앞장 장수 옆 두 칸을 숲·성벽으로 바꿔(메모리에서만) 반·온 방패가 찍히게 한다.
## G-0253 hit_at ≥ 0 이면(cut 과 함께) 그 장수가 바로 친다(맞음·큰 피해, 화면 hp 만) — 궤적이 나오고 hit_at 초 뒤 트리를 멈춰 궤적·불꽃이 찍히게. 판이 닫히면(다음 컷) 멈춤 풂.
## cut 이 참이면 고르지 않고 카메라를 바로 공격 컷 구도(어깨 너머)로 놓는다 — 고르기 카메라 당김이 덮어쓰지 않게.

const TacticsView := preload("res://games/saga_realm/world/realm_tactics_view.gd")
const RealmTactics := preload("res://games/saga_realm/data/realm_tactics.gd")


static func stage(tree: SceneTree, pick := true, cut := false, cover := false, hit_at := -1.0) -> void:
	var S: Node = tree.root.get_node("RealmSaveState")
	S.start_scenario("194")
	for id in ["sg_xiahoudun", "sg_zhangliao"]:
		if not (id in S.roster):
			S.roster.append(id)
		S.officer_city[id] = "xuchang"
	S.cities.xuchang.troops = 3000
	S.cities.xuchang.food = maxi(int(S.cities.xuchang.food), 30000)
	var btn := tree.current_scene.get_node_or_null("RealmHUD/AttackButton")
	if btn == null:
		return
	var tb: Dictionary = S.tactics_board("xiaopei")
	if not bool(tb.get("ok", false)):
		return
	var me: Dictionary = {}
	for u: Dictionary in tb.board.units:
		if u.side == "me":
			me = u
			break
	if cover and not me.is_empty():
		tb.board.cells[int(me.y) * int(tb.board.cols) + int(me.x) + 1] = "forest"
		tb.board.cells[(int(me.y) + 1) * int(tb.board.cols) + int(me.x) + 1] = "wall"
	var view: Node = TacticsView.open(btn, "xiaopei", tb, func(_g: Dictionary) -> void: pass)
	if me.is_empty():
		return
	if cut:
		var best: Dictionary = {}
		for u: Dictionary in tb.board.units:
			if u.side == "foe" and (best.is_empty() or absi(int(u.x) - int(me.x)) + absi(int(u.y) - int(me.y)) < absi(int(best.x) - int(me.x)) + absi(int(best.y) - int(me.y))):
				best = u
		var an: Node3D = view._units[String(me.uid)].node
		var tn: Node3D = view._units[String(best.uid)].node
		if hit_at >= 0.0:   # 친다면 몸만 대상 옆 칸으로(화면에서만 — 실제 공격 거리 1~2칸)
			var d := Vector3(an.position.x - tn.position.x, 0, an.position.z - tn.position.z)
			an.position = tn.position + d.normalized() * TacticsView.CELL
		view._cam.global_transform = TacticsView._cut_transform(an.position, tn.position)
		if hit_at >= 0.0:
			_strike(tree, view, String(me.uid), String(best.uid), hit_at)
	elif pick:
		view.call("pick_cell", int(me.x), int(me.y))


static func _strike(tree: SceneTree, view: Node, a: String, t: String, hit_at: float) -> void:
	view.set("_auto_mode", true)   # 컷 tween 안 함 — 카메라는 위에서 놓은 어깨 너머 그대로
	view.tree_exiting.connect(func() -> void: tree.paused = false)
	var u: Dictionary = RealmTactics.unit(view.board, t)
	var scene := tree.current_scene
	## 첫 궤적·불꽃 셰이더는 씬이 뜰 때 CombatFx.warm 이 데운다(G-0255) — 데우는 한 대 지움.
	var before := scene.get_children()
	view.call("_anim_hit", {"a": a, "to": t, "hit": true, "dmg": int(float(u.get("max", 100)) * 0.35)})
	var t0 := Time.get_ticks_msec()
	while not scene.get_children().any(func(c: Node) -> bool: return not before.has(c) and _is_slash(c)) and Time.get_ticks_msec() - t0 < 2000:
		await tree.process_frame
	t0 = Time.get_ticks_msec()
	while Time.get_ticks_msec() - t0 < int(hit_at * 1000.0):
		await tree.process_frame
	tree.paused = true


static func _is_slash(c: Node) -> bool:
	return c is MeshInstance3D and (c as MeshInstance3D).material_override is ShaderMaterial and ((c as MeshInstance3D).material_override as ShaderMaterial).shader == TacticsView.CombatFx.SLASH_SHADER


## G-0194 — 영내 소식 카드(허창 풍년, 태수 = 시작 무장). 메모리에서만.
static func news(tree: SceneTree) -> void:
	var S: Node = tree.root.get_node("RealmSaveState")
	S.start_scenario("194")
	S.news = [{"id": "harvest", "city": "xuchang", "gov": "sg_zhugeliang", "year": 194, "month": 8}]
	var btn := tree.current_scene.get_node_or_null("RealmHUD/EventButton")
	if btn == null:
		for n in tree.current_scene.find_children("*", "Button", true, false):
			if n.has_method("_open_news"):
				btn = n
				break
	if btn != null:
		btn.call("_open_news", 0, {"layer": CanvasLayer.new()})
