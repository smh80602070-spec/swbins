extends RefCounted
## G-0071 촬영 도우미 — shot_scene.gd 의 static 단계가 부른다. 명단을 [나(화)·수·뇌·빙] 으로(메모리에서만,
## 저장 안 함) 바꾸고, 가장 가까운 늑대 앞 4m(카메라가 보는 -z 쪽)에 플레이어를 세운 뒤, 찍기 직전(1.4초 뒤)
## 적에 화를 붙이고 협공을 한 번 부른다 — 빛줄기·"<이름> 협공"·반응 글자가 찍히게.

const Elements := preload("res://games/saga_go/combat/elements.gd")
const Characters := preload("res://saga_core/data/characters.gd")
const Kits := preload("res://games/saga_go/data/kits.gd")

static func stage(tree: SceneTree) -> void:
	var p := tree.get_first_node_in_group("player") as Node3D
	var fc := tree.get_first_node_in_group("go_field_combat")
	if p == null or fc == null:
		return
	var ids: Array[String] = []
	for el in ["water", "thunder", "ice"]:
		for h in Characters.HEROES:
			if Elements.element_of(h.id) == el and not Kits.has_kit(h.id):
				ids.append(h.id)
				break
	PartyState.party_size = PartyState.PARTY_MAX
	PartyState.members.assign(ids)
	fc.set("active", 0)
	fc.call("revive_all")
	var assist: Node = fc.get("assist")
	assist.set("beam_sec", 3.0) # 찍힐 때까지 빛줄기가 남게
	assist.set("enabled", false) # 찍기 직전 한 번만 — 그 전에 저절로 나가 GAP 에 막히지 않게
	var e := _nearest_plain(tree, p.global_position)
	if e == null:
		return
	p.global_position = e.global_position + Vector3(3.5, 0.3, 4.0)
	p.set("velocity", Vector3.ZERO)
	p.call("face_toward", e.global_position)
	tree.create_timer(1.4).timeout.connect(func() -> void:
		if not is_instance_valid(e) or e.call("is_dead"):
			return
		p.call("face_toward", e.global_position)
		e.call("set_aura", "fire")
		fc.set("since_hit", 0.0)
		fc.set("last_target", e)
		assist.set("_gap", 0.0)
		print("SHOT_ASSIST pick=%s at=%s p=%s" % [assist.call("try_assist"), e.global_position, p.global_position]))

static func _nearest_plain(tree: SceneTree, pos: Vector3) -> Node3D:
	var best: Node3D = null
	var best_d := 1e9
	for e in tree.get_nodes_in_group("field_enemy"):
		if e.call("is_dead") or e.call("is_shielded"):
			continue
		var d := (e as Node3D).global_position.distance_to(pos)
		if d < best_d:
			best_d = d
			best = e
	return best
