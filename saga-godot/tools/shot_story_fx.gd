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


## G-0203 — 촬영 4프레임 전에 맞는다(체력 27% 에서 — 가장자리 번쩍 + 붉은 숫자 + 맥박). 플레이어가 곧 체력 주인이다.
static func hurt(tree: SceneTree) -> void:
	for m in tree.get_nodes_in_group("ui_modal"):
		m.queue_free()
	var Belt: GDScript = load("res://tools/shot_dungeon_belt.gd")
	Belt.call("_hurt_at", tree, tree.get_first_node_in_group("player"))
