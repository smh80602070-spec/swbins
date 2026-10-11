extends RefCounted
## G-0185 촬영 도우미 — shot_scene.gd 의 static 단계가 부른다. 출사표 창을 닫은 뒤 플레이어를 첫 방 가운데(z 0) 또는 첫 통로(z −10)에 세운다.

static func stage(tree: SceneTree, z: float) -> void:
	var p := tree.get_first_node_in_group("player") as Node3D
	if p == null:
		return
	p.global_position = Vector3(0.0, p.global_position.y, z)


## G-0193 — 둘째 방에서 적에게 맞아 쓰러진다(메모리에서만 — 금·장비는 촬영 뒤 씬과 함께 버려진다). 사망 카드와 은총 자리(첫 방 금빛 기둥)가 찍힌다.
static func die(tree: SceneTree) -> void:
	var p := tree.get_first_node_in_group("player") as Node3D
	var ph := tree.get_first_node_in_group("player_health")
	var g := tree.get_first_node_in_group("dungeon_grace")
	if p == null or ph == null or g == null:
		return
	p.global_position = Vector3(1.5, p.global_position.y, float(g.origins[1]) + 1.0)
	ph.call("take_damage", 9999.0, tree.get_first_node_in_group("dungeon_enemy"))


## G-0198 — 무장 무예 넷을 넉 자리(Z·X·C·V)에 건다(메모리에서만). 이야기 대화창은 뜨는 대로 닫는다 — 창이 게임을 멈추면 자리 단추가 새로 안 그려진다.
static func slots(tree: SceneTree) -> void:
	tree.root.get_node("DungeonSkillState").restore({}, {"w_whirl": 2, "w_dash": 1, "w_intimidate": 1, "w_chain": 1},
		{"warrior": ["w_whirl", "w_dash", "w_intimidate", "w_chain"]})
	for m in tree.get_nodes_in_group("ui_modal"):
		m.queue_free()
	tree.node_added.connect(func(n: Node) -> void:
		var s: Script = n.get_script()
		if s != null and s.resource_path.ends_with("talk_box.gd"):
			n.queue_free.call_deferred())


## G-0199 — 무장 전자 갈래(br7) 셋 + 화창(br6)을 넉 자리에 걸고(메모리에서만) 둘레 적에게 전자진(w_emp_nova)을 한 번 쏜다.
## G-0200 — 시전 그림(분홍 원환·지지직)이 0.55초라 시전을 촬영 직전(단계 뒤 CAST_AT 프레임)으로 미룬다.
static func emp(tree: SceneTree) -> void:
	_arena(tree, {"w_emp_swing": 1, "w_emp_dash": 1, "w_emp_nova": 3, "w_firelance": 1}, ["w_emp_nova", "w_emp_swing", "w_emp_dash", "w_firelance"], [0])


## G-0200 — 폭염진(w_blastfire, 주황 원환·불씨) 뒤에 화창(w_firelance, 궤적·불꽃) 두 자리를 잇달아.
static func fire(tree: SceneTree) -> void:
	_arena(tree, {"w_blastfire": 3, "w_firelance": 3}, ["w_blastfire", "w_firelance", "", ""], [0, 1])


const CAST_AT := 80 # shot_scene 단계(30프레임째) 뒤 — 촬영(120프레임째) 10프레임 전


static func _arena(tree: SceneTree, ranks: Dictionary, slots: Array, casts: Array) -> void:
	tree.root.get_node("DungeonSkillState").restore({}, ranks, {"warrior": slots})
	tree.root.get_node("DungeonEquipmentState").equip("weapon", {}) # 맨손 = 무장(세이브에 다른 직업 무기가 있어도)
	for m in tree.get_nodes_in_group("ui_modal"):
		m.queue_free()
	tree.node_added.connect(func(n: Node) -> void:
		var s: Script = n.get_script()
		if s != null and s.resource_path.ends_with("talk_box.gd"):
			n.queue_free.call_deferred())
	var p := tree.get_first_node_in_group("player") as Node3D
	var Enemy: GDScript = load("res://games/saga_dungeon/world/dungeon_enemy.gd")
	for off in [Vector3(2.0, 0, 0.5), Vector3(-1.8, 0, 1.2), Vector3(0.6, 0, -2.2)]:
		var e: Node3D = Enemy.new(3)
		tree.current_scene.add_child(e)
		e.global_position = p.global_position + off
		e.hp = 5000.0 # 촬영 동안 쓰러지지 않게
		e.max_hp = 5000.0
	var c := tree.get_first_node_in_group("skill_caster")
	var n := [0]
	var cb := [Callable()]
	cb[0] = func() -> void:
		n[0] += 1
		for k in casts.size():
			if n[0] == CAST_AT + 4 * k:
				c.try_slot(int(casts[k]))
		if n[0] >= CAST_AT + 4 * casts.size():
			tree.process_frame.disconnect(cb[0]) # 다음 컷에서 씬이 바뀌면 c 가 지워진다
	tree.process_frame.connect(cb[0])


## G-0202 — 소환수 넷(군견·응사·토우·분신술)을 4프레임 간격으로(무예 키를 직접 — 직업 자리 확인은 건너뜀). 적은 3~4m 밖으로 옮겨 소환수가 흩어지게.
## 사람 몸 복제 비용을 보려고 시전 전후 그리기 수를 찍는다("SUMMON_DRAWS").
const SUMMON_AT := 40 # 촬영 50프레임 전 — 소환수가 떨어진 적에게 달려가 흩어지게
const SUMMON_KEYS := ["w_hound", "a_hawk", "y_golem", "y_shade"]


static func summon(tree: SceneTree) -> void:
	_arena(tree, {"w_hound": 1, "a_hawk": 1, "y_golem": 1, "y_shade": 1}, ["", "", "", ""], [])
	var p := tree.get_first_node_in_group("player") as Node3D
	var far := [Vector3(3.6, 0, 1.0), Vector3(-3.4, 0, 1.8), Vector3(0.8, 0, -3.6)]
	var es := tree.get_nodes_in_group("dungeon_enemy").slice(-3)
	for i in es.size():
		(es[i] as Node3D).global_position = p.global_position + far[i]
	var c := tree.get_first_node_in_group("skill_caster")
	var n := [0]
	var draws := [0]
	var cb := [Callable()]
	cb[0] = func() -> void:
		n[0] += 1
		if n[0] == SUMMON_AT - 1:
			draws[0] = int(Performance.get_monitor(Performance.RENDER_TOTAL_DRAW_CALLS_IN_FRAME))
		for k in SUMMON_KEYS.size():
			if n[0] == SUMMON_AT + 4 * k:
				c.try_cast(String(SUMMON_KEYS[k]))
		if n[0] >= SUMMON_AT + 28:
			print("SUMMON_DRAWS before=%d after=%d" % [draws[0], int(Performance.get_monitor(Performance.RENDER_TOTAL_DRAW_CALLS_IN_FRAME))])
			tree.process_frame.disconnect(cb[0])
	tree.process_frame.connect(cb[0])


## G-0203 — 촬영 4프레임 전에 맞는다(체력 27% 로 두고 3 피해 — 가장자리 번쩍 + 붉은 숫자 + 25% 근처 맥박). 메모리에서만.
static func hurt(tree: SceneTree) -> void:
	for m in tree.get_nodes_in_group("ui_modal"):
		m.queue_free()
	_hurt_at(tree, tree.get_first_node_in_group("player_health"))


static func _hurt_at(tree: SceneTree, ph: Node) -> void:
	if ph == null:
		return
	var n := [0]
	var cb := [Callable()]
	cb[0] = func() -> void:
		n[0] += 1
		if n[0] == 86:
			if is_instance_valid(ph):
				ph.set("hp", float(ph.get("max_hp")) * 0.27)
				ph.call("take_damage", 3.0)
			tree.process_frame.disconnect(cb[0])
	tree.process_frame.connect(cb[0])


## G-0204 — 첫 방에 보스(강타)를 세우고 예고가 반쯤 찬 프레임을 찍는다(촬영 0.35초 전에 예고 시작). 메모리에서만.
static func boss_tell(tree: SceneTree) -> void:
	_arena(tree, {}, ["", "", "", ""], [])
	for e in tree.get_nodes_in_group("dungeon_enemy"):
		e.queue_free() # 잡몹은 치운다 — 촬영 전에 쓰러지지 않게
	var p := tree.get_first_node_in_group("player") as Node3D
	var Enemy: GDScript = load("res://games/saga_dungeon/world/dungeon_enemy.gd")
	var BossPattern: GDScript = load("res://games/saga_dungeon/world/boss_pattern.gd")
	var b: Node3D = Enemy.new(3, true)
	b.set("boss_pattern", BossPattern.new(3, "club"))
	b.get("boss_pattern").cd = 999.0
	tree.current_scene.add_child(b)
	b.global_position = p.global_position + Vector3(3.6, 0, -1.4) # 평타(3.4m) 밖·강타 반경(4.46m) 안
	b.set("hp", 99999.0)
	var n := [0]
	var cb := [Callable()]
	cb[0] = func() -> void:
		n[0] += 1
		if n[0] == 69 and is_instance_valid(b):
			b.get("boss_pattern").cd = 0.001
			var ph := tree.get_first_node_in_group("player_health")
			if ph != null:
				ph.call("heal_by", 999.0)
		if n[0] >= 69:
			tree.process_frame.disconnect(cb[0])
	tree.process_frame.connect(cb[0])


## G-0207 — 잡몹 명단: 왼쪽에 1층 셋·오른쪽에 13층 셋을 세워(움직이지 않게) 종마다 다른 색·몸을 찍는다. 메모리에서만.
static func roster(tree: SceneTree) -> void:
	for e in tree.get_nodes_in_group("dungeon_enemy"):
		e.queue_free()
	for m in tree.get_nodes_in_group("ui_modal"):
		m.queue_free()
	tree.node_added.connect(func(n: Node) -> void:
		var s: Script = n.get_script()
		if s != null and s.resource_path.ends_with("talk_box.gd"):
			n.queue_free.call_deferred())
	var p := tree.get_first_node_in_group("player") as Node3D
	var Enemy: GDScript = load("res://games/saga_dungeon/world/dungeon_enemy.gd")
	var spots := [[1, Vector3(-3.2, 0, -1.0)], [1, Vector3(-2.0, 0, 1.4)], [1, Vector3(-3.6, 0, 2.6)],
		[13, Vector3(2.6, 0, -1.2)], [13, Vector3(3.4, 0, 1.2)], [13, Vector3(1.8, 0, 2.6)]]
	for sp in spots:
		var e: Node3D = Enemy.new(int(sp[0]))
		tree.current_scene.add_child(e)
		e.global_position = p.global_position + (sp[1] as Vector3)
		e.set_physics_process(false) # 서 있기만
		print("ROSTER %d층 %s" % [int(sp[0]), e.call("who_label")])


## G-0208 — 원거리 잡몹 둘(독 궁수·불 조총병)이 멀찍이 서서 쏜다. 쿨을 맞춰 찍는 프레임에 화살·탄환이 날아가는 중이게.
static func ranged(tree: SceneTree) -> void:
	for e in tree.get_nodes_in_group("dungeon_enemy"):
		e.queue_free()
	for m in tree.get_nodes_in_group("ui_modal"):
		m.queue_free()
	tree.node_added.connect(func(n: Node) -> void:
		var s: Script = n.get_script()
		if s != null and s.resource_path.ends_with("talk_box.gd"):
			n.queue_free.call_deferred())
	var p := tree.get_first_node_in_group("player") as Node3D
	var Enemy: GDScript = load("res://games/saga_dungeon/world/dungeon_enemy.gd")
	var DE: GDScript = load("res://games/saga_dungeon/data/dungeon_enemies.gd")
	var picks := [["오랑캐 궁수", Vector3(-3.0, 0, 2.6), 1.30], ["왜군 조총병", Vector3(-2.8, 0, -3.4), 1.40]]
	for pk in picks:
		var e: Node3D = Enemy.new(6)
		for sp: Dictionary in DE.ENEMIES:
			if sp.name == pk[0]:
				e.species = sp
		e.elite_key = ""
		e._elite_def = {}
		e._scale_mul = 1.0
		e._attack_cd_left = float(pk[2])
		tree.current_scene.add_child(e)
		e.global_position = p.global_position + (pk[1] as Vector3)
