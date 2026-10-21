extends RefCounted
## G-0201 촬영 도우미 — 4종횡 무예 시전 그림. 사냥터 적 셋을 플레이어 앞뒤로 모으고(체력 넉넉히, 메모리에서만)
## 촬영 10프레임 전에 선풍(w_whirl, 금 원환) → 4프레임 뒤 전우(s_rain, 파랑 물보라)를 직접 시전한다(입력 분기·직업 확인은 건너뜀).

const CAST_AT := 80 # shot_scene 단계(30프레임째) 뒤 — 촬영(120프레임째) 10프레임 전


static func stage(tree: SceneTree) -> void:
	tree.root.get_node("StorySaveState").skills = {"w_whirl": 3, "s_rain": 3}
	for m in tree.get_nodes_in_group("ui_modal"):
		m.queue_free()
	var p := tree.get_first_node_in_group("player") as Node3D
	if p == null:
		return
	var offs := [1.4, 2.8, -1.6]
	var es := tree.get_nodes_in_group("story_enemy")
	for i in mini(es.size(), offs.size()):
		var e := es[i] as Node3D
		e.global_position = Vector3(p.global_position.x + float(offs[i]), p.global_position.y, e.global_position.z)
		e.set("hp", 99999.0)
		e.set("max_hp", 99999.0)
	var n := [0]
	var cb := [Callable()]
	cb[0] = func() -> void:
		n[0] += 1
		if not is_instance_valid(p):
			tree.process_frame.disconnect(cb[0])
			return
		if n[0] == CAST_AT or n[0] == CAST_AT + 4:
			p.set("mp", 999.0)
			p.call("_cast_warrior_whirl" if n[0] == CAST_AT else "_cast_sniper_rain")
		if n[0] >= CAST_AT + 4:
			tree.process_frame.disconnect(cb[0]) # 다음 컷에서 씬이 바뀌면 p 가 지워진다
	tree.process_frame.connect(cb[0])


## G-0283 — 무예 하나(method)를 촬영 POSE_AT 프레임 전에 — 공격·시전 몸짓(동작 구간 한가운데쯤)이 찍힌다. 손잡이 SAGA_STORY_ACTION=0 이면 옛 sprint.
const POSE_AT := 112
static func pose(tree: SceneTree, method: String) -> void:
	tree.root.get_node("StorySaveState").skills = {"w_cut": 3, "m_fire": 3, "a_shot": 3}
	for m in tree.get_nodes_in_group("ui_modal"):
		m.queue_free()
	var p := tree.get_first_node_in_group("player") as Node3D
	if p == null:
		return
	var n := [0]
	var cb := [Callable()]
	cb[0] = func() -> void:
		n[0] += 1
		if not is_instance_valid(p):
			tree.process_frame.disconnect(cb[0])
			return
		if n[0] == POSE_AT - 30:
			p.set("mp", 999.0)
			for prop in p.get_property_list():
				if String(prop.name).begins_with("_cd_") or prop.name == "_attack_cd_left":
					p.set(prop.name, 0.0)
			p.call(method)
			tree.process_frame.disconnect(cb[0])
	tree.process_frame.connect(cb[0])


## G-0203 — 촬영 4프레임 전에 맞는다(체력 27% 에서 — 가장자리 번쩍 + 붉은 숫자 + 맥박). 플레이어가 곧 체력 주인이다.
static func hurt(tree: SceneTree) -> void:
	for m in tree.get_nodes_in_group("ui_modal"):
		m.queue_free()
	var Belt: GDScript = load("res://tools/shot_dungeon_belt.gd")
	Belt.call("_hurt_at", tree, tree.get_first_node_in_group("player"))


## G-0205 — 사냥터 보스 곁에 서서 패턴 하나를 촬영 30프레임 전에 건다(내려찍기 원이 반쯤 찬 프레임 · 휩쓸기 초록 안전지대). 메모리에서만.
static func boss_slam(tree: SceneTree) -> void:
	_boss_kind(tree, "slam")


static func boss_sweep(tree: SceneTree) -> void:
	_boss_kind(tree, "sweep")


## G-0206 — 황건 두목 고유 기술(도넛 — 보스 곁 초록 원만 산다) · 그로기(머리 위 💫).
static func boss_sig(tree: SceneTree) -> void:
	_boss_kind(tree, "ring")


static func boss_groggy(tree: SceneTree) -> void:
	_boss_kind(tree, "groggy")


static func _boss_kind(tree: SceneTree, kind: String) -> void:
	for m in tree.get_nodes_in_group("ui_modal"):
		m.queue_free()
	var b := tree.get_first_node_in_group("story_boss") as Node3D
	var p := tree.get_first_node_in_group("player") as Node3D
	if b == null or p == null:
		return
	if b.get("boss_pattern") == null: # 이번 주 관문 대장이면 패턴이 없다 — 촬영만 하나 붙인다
		b.set("boss_pattern", (load("res://games/saga_story/world/story_boss_pattern.gd") as GDScript).new(1))
	b.get("boss_pattern").cd = 999.0
	b.get("boss_pattern").sig_cd = 999.0
	b.set("_charge_cd", 999.0) # 촬영 중 달려들지 않게
	p.global_position = Vector3(b.global_position.x - 2.6, p.global_position.y, p.global_position.z)
	var n := [0]
	var cb := [Callable()]
	cb[0] = func() -> void:
		n[0] += 1
		if n[0] == 60 and is_instance_valid(b) and is_instance_valid(p):
			p.set("hp", float(p.get("max_hp")))
			if kind == "groggy":
				b.get("boss_pattern").groggy = 5.0
			else:
				b.get("boss_pattern").begin(b, p, kind, b.call("_pattern_api", p))
		if n[0] >= 60:
			tree.process_frame.disconnect(cb[0])
	tree.process_frame.connect(cb[0])


## G-0209 — field 사냥터 잡몹 셋(서로 다른 종)이 플레이어 쪽으로 걸어온다(체력 넉넉히, 메모리에서만).
static func roster(tree: SceneTree) -> void:
	for m in tree.get_nodes_in_group("ui_modal"):
		m.queue_free()
	var p := tree.get_first_node_in_group("player") as Node3D
	if p == null:
		return
	var offs := [5.0, -4.4, 6.6]
	var es := tree.get_nodes_in_group("story_enemy").filter(func(e): return not (e.get("species") as Dictionary).is_empty())
	for i in mini(es.size(), offs.size()):
		var e := es[i] as Node3D
		e.global_position = Vector3(p.global_position.x + float(offs[i]), p.global_position.y, e.global_position.z)
		e.set("walk_dir", -signf(float(offs[i])))
		e.set("hp", 99999.0)
		e.set("max_hp", 99999.0)
		print("ROSTER %s x%+.1f" % [String(e.get("species").name), float(offs[i])])


## G-0210 — 역할: 오른쪽 돌진형이 "!" 띄우고 달려드는 중 · 왼쪽 마법형이 멈춰 서서 쏜 보라 구슬이 날아오는 중 · 멀리 희귀 ✨.
## 컷 단계는 30프레임째, 촬영은 120프레임째 — 쿨을 0.9·1.0초로 맞춰 찍을 때 둘 다 한창이게.
static func roles(tree: SceneTree) -> void:
	for m in tree.get_nodes_in_group("ui_modal"):
		m.queue_free()
	var p := tree.get_first_node_in_group("player") as Node3D
	if p == null:
		return
	var es := tree.get_nodes_in_group("story_enemy").filter(func(e): return not (e.get("species") as Dictionary).is_empty())
	p.global_position.x = 10.0   # 처음 자리(x 2)는 왼쪽 끝이라 마법형이 끝 여백에 붙는다
	var plan := [[5.0, "dash"], [-4.6, "magic"], [7.8, "rare"]]
	for i in mini(es.size(), plan.size()):
		var e := es[i] as Node3D
		var off: float = plan[i][0]
		e.global_position = Vector3(p.global_position.x + off, p.global_position.y, e.global_position.z)
		e.set("walk_dir", -signf(off))
		e.set("hp", 99999.0)
		e.set("max_hp", 99999.0)
		match String(plan[i][1]):
			"dash":
				e.set("is_ranged", false)
				e.set("role", "dash")
				e.set("_dash_cd", 0.9)
			"magic":
				e.set("is_ranged", false)
				e.set("role", "magic")
				e.set("_shot_cd_left", 1.0)
			"rare":
				e.set("is_rare", true)
				e.call("_float_mark", "✨", 0.0, Color(1.0, 0.9, 0.4))
		print("ROLES %s %s x%+.1f" % [plan[i][1], String(e.get("species").name), off])


## G-0211 — 우연 사건: 왼쪽에 붙잡힌 사람 + 지키는 둘(먼저 발동) · 오른쪽에 큰 미니보스(나중에 발동 — 토스트가 위에 남게).
## 사건은 플레이어 자리에서 발동시킨 뒤 자리만 옮기고 멈춰 세운다(그 자리를 지난 셈 — 걸어와 플레이어를 덮지 않게). 처음 셋은 멀리 치운다.
static func events(tree: SceneTree) -> void:
	for m in tree.get_nodes_in_group("ui_modal"):
		m.queue_free()
	var p := tree.get_first_node_in_group("player") as Node3D
	var sp := tree.current_scene.get_node_or_null("EnemySpawner")
	if p == null or sp == null:
		return
	p.global_position.x = 14.0
	for e in tree.get_nodes_in_group("story_enemy"):
		if not (e.get("species") as Dictionary).is_empty():
			e.global_position.x = 38.0
	sp.set("ambush", {})
	sp.set("miniboss", {})
	sp.set("rescue", {"x": 14.0, "spawned": false, "done": false})
	var step := [0]   # 0 = 지키는 둘 기다림 · 1 = 미니 기다림 — 사건은 물리 틱에 나오니 프레임 수 말고 나올 때까지
	var cb := [Callable()]
	cb[0] = func() -> void:
		if not is_instance_valid(sp) or not is_instance_valid(p):
			tree.process_frame.disconnect(cb[0])
			return
		if step[0] == 0 and (sp.get("_guards") as Array).size() == 2:
			step[0] = 1
			var cx := p.global_position.x - 3.0
			var cap := sp.get("_captive") as Node3D
			if cap != null:
				cap.position.x = cx
			var gs: Array = sp.get("_guards")
			for i in gs.size():
				gs[i].global_position.x = cx + (float(i) - 0.5) * 2.2
				gs[i].process_mode = Node.PROCESS_MODE_DISABLED
				gs[i].set("hp", 99999.0)
				gs[i].set("max_hp", 99999.0)
			sp.set("miniboss", {"x": p.global_position.x, "triggered": false})
		elif step[0] == 1 and sp.get("mini_enemy") != null:
			var mb := sp.get("mini_enemy") as Node3D
			mb.global_position.x = p.global_position.x + 3.2
			mb.process_mode = Node.PROCESS_MODE_DISABLED
			var body := mb.get("_creature") as Node3D
			if body != null:
				body.rotation.y = -PI * 0.5   # 플레이어 쪽(왼쪽)을 본다
			mb.set("hp", 99999.0)
			mb.set("max_hp", 99999.0)
			print("EVENTS mini %s x%.1f · player x%.1f" % [String(mb.get("species").name), mb.global_position.x, p.global_position.x])
			tree.process_frame.disconnect(cb[0])
	tree.process_frame.connect(cb[0])


## G-0212 — 2차 사건: 오른쪽 보물상자(닫힘) · 발밑 초록 채집 판 · 왼쪽 이동 상인(지나간 뒤 — 할인 토스트).
## 상인은 플레이어 자리에서 발동시키고 몸(그 자리 상점)은 미리 왼쪽에 둔다. 채집 🍀 토스트는 미리 끈다(상인 토스트가 남게).
static func events2(tree: SceneTree) -> void:
	for m in tree.get_nodes_in_group("ui_modal"):
		m.queue_free()
	var p := tree.get_first_node_in_group("player") as Node3D
	var sp := tree.current_scene.get_node_or_null("EnemySpawner")
	if p == null or sp == null:
		return
	p.global_position.x = 14.0
	for e in tree.get_nodes_in_group("story_enemy"):
		if not (e.get("species") as Dictionary).is_empty():
			e.global_position.x = 38.0
	for k in ["ambush", "miniboss", "rescue"]:
		sp.set(k, {})
	sp.set("chest", {"x": 16.4, "opened": false})
	sp.set("forage", {"x1": 10.6, "x2": 15.8, "notified": true})
	sp.set("merchant", {"x": 14.0, "triggered": false})
	sp.call("_build_props")
	var mbody := sp.get("_merchant_body") as Node3D
	if mbody != null:
		mbody.position.x = 11.4   # 발동 자리(플레이어)에서 비켜 둔다 — 그 자리 상점 안내가 할인 토스트를 덮지 않게
	var cb := [Callable()]
	cb[0] = func() -> void:
		if not is_instance_valid(sp):
			tree.process_frame.disconnect(cb[0])
			return
		if bool((sp.get("merchant") as Dictionary).get("triggered", false)):
			print("EVENTS2 상인 할인 · 상자 x16.4 · 채집 10.6~15.8")
			tree.process_frame.disconnect(cb[0])
	tree.process_frame.connect(cb[0])


## G-0213 — 공용 패시브 그물 화면: 4종횡 정의로 열고 무사 시작 → 이름난 마디까지 찍은 뒤 규칙 마디(비연) 카드를 연 상태(주황 테 = 찍을 길).
static func passive(tree: SceneTree) -> void:
	for m in tree.get_nodes_in_group("ui_modal"):
		m.queue_free()
	var PW: GDScript = load("res://saga_core/data/passive_web.gd")
	var d: Dictionary = PW.call("load_def", "res://games/saga_story/data/passive_def.json")
	var st := {}
	var api: RefCounted = PW.new(d, st, func() -> int: return 60)
	api.call("take", "o_warrior")
	api.call("take_path", "n_war_rhythm")
	var scr: CanvasLayer = (load("res://saga_core/ui/passive_web_screen.gd") as GDScript).call("open", tree.current_scene, api, {"title": "✨ 사방 성좌(점검)"})
	scr.call("select", "k_biyeon")
	print("PASSIVE 찍음 %d · 남은 %d" % [(st.taken as Array).size(), int(api.call("left"))])


## G-0214 — 4종횡 사방 성좌도: HUD 「✨ 성좌」 단추로 연 화면(무사·Lv.40 — 무사의 별에서 이름난 마디까지 찍고 비연 카드를 연 상태). 메모리만, 저장 안 함.
static func constellation(tree: SceneTree) -> void:
	for m in tree.get_nodes_in_group("ui_modal"):
		m.queue_free()
	var S: Node = tree.root.get_node("StorySaveState")
	S.set("level", 40)
	S.set("job", "warrior")
	S.set("passive", {"start": null, "taken": []})
	var api: RefCounted = S.call("passive_api")
	api.call("take", "o_warrior")
	api.call("take_path", "n_war_rhythm")
	var btn := tree.current_scene.find_child("ConstellationButton", true, false)
	if btn == null:
		print("CONSTELLATION 단추 없음")
		return
	var scr: CanvasLayer = btn.call("open_screen")
	if scr != null:
		scr.call("select", "k_biyeon")
	print("CONSTELLATION 단추 「%s」 · 찍음 %d · 남은 %d" % [btn.get("text"), (S.get("passive").taken as Array).size(), int(api.call("left"))])
