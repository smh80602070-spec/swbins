extends RefCounted
## G-0183·G-0191 촬영 도우미 — shot_scene.gd 의 static 단계가 부른다. 새 판 194 에 장수 둘(하후·장료 — 메모리에서만, 저장 안 함)을 허창에 더하고
## 병력 3000 으로 소패 전술판을 연다. pick 이 참이면 앞장 장수를 골라 이동 칸(파랑)·명중률 글을 띄운다.
## cover 가 참이면(G-0191) 판을 열기 전에 앞장 장수 옆 두 칸을 숲·성벽으로 바꿔(메모리에서만) 반·온 방패가 찍히게 한다.
## cut 이 참이면 고르지 않고 카메라를 바로 공격 컷 구도(어깨 너머)로 놓는다 — 고르기 카메라 당김이 덮어쓰지 않게.

const TacticsView := preload("res://games/saga_realm/world/realm_tactics_view.gd")
const RealmTactics := preload("res://games/saga_realm/data/realm_tactics.gd")


static func stage(tree: SceneTree, pick := true, cut := false, cover := false) -> void:
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
		tb.board.cells[int(me.y) * RealmTactics.COLS + int(me.x) + 1] = "forest"
		tb.board.cells[(int(me.y) + 1) * RealmTactics.COLS + int(me.x) + 1] = "wall"
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
		view._cam.global_transform = TacticsView._cut_transform(an.position, tn.position)
	elif pick:
		view.call("pick_cell", int(me.x), int(me.y))
