extends Node
## G-0063 사가의숲 옷 머리·덧옷·겉옷 갑옷(forest_wear_visual.gd · saga_core/world/bone_gear.gd) — scene_probe_host 로 돈다(오토로드 필요).
## ① 머리 다섯마다 그 acc 하나, 맨머리·상투는 0 ② 덧옷 on → acc_cape_long, off → 없음 ③ 겉옷 갑옷 → 조각 3(가슴 + 어깨 좌우)
## ④ 옷 빛은 그대로 물듦(G-0051) ⑤ 바꾸면 옛 것이 사라짐 ⑥ 조각 배율 = 머리 뼈 높이/1.5. 옷(wear_on)은 끝에 처음대로 되돌린다. 저장 안 함.

const VroidBody := preload("res://saga_core/world/vroid_body.gd")
const BoneGear := preload("res://saga_core/world/bone_gear.gd")
const WearVisual := preload("res://games/saga_forest/world/forest_wear_visual.gd")

var fails := 0


func _fail(msg: String) -> void:
	fails += 1
	print("  FAIL ", msg)


func _names(body: Node3D) -> Array:
	return BoneGear.worn(body, WearVisual.TAG).map(func(n): return String(n.name))


func run() -> int:
	if not VroidBody.dex_available():
		_fail("인물 몸(dex) 없음")
		return fails
	var holder := Node3D.new()
	holder.name = "ProbePlayer"
	add_child(holder)
	var body := VroidBody.build_hero("dj_yuri")
	body.name = "Visual"
	holder.add_child(body)

	# ① 머리
	for head in ["braid", "scholar", "gat", "hairpin", "helmet"]:
		var n := WearVisual.apply_gear(holder, head, "off", "leather")
		var got := _names(holder)
		if n != 1 or got != ["Wear_" + String(WearVisual.HEAD_GLB[head])]:
			_fail("머리 %s → %s (n=%d)" % [head, got, n])
	for head in ["none", "topknot"]:
		if WearVisual.apply_gear(holder, head, "off", "leather") != 0 or not _names(holder).is_empty():
			_fail("머리 %s 는 비어야" % head)

	# ② 덧옷
	if WearVisual.apply_gear(holder, "none", "on", "leather") != 1 or _names(holder) != ["Wear_acc_cape_long"]:
		_fail("덧옷 on → %s" % [_names(holder)])
	WearVisual.apply_gear(holder, "none", "off", "leather")
	if not _names(holder).is_empty():
		_fail("덧옷 off 인데 %s" % [_names(holder)])

	# ③ 갑옷 + ⑤ 바꾸면 옛 것 사라짐
	var n3 := WearVisual.apply_gear(holder, "gat", "on", "plate")
	var all := _names(holder)
	if n3 != 5 or not ("Wear_eq_past_2_chest" in all and "Wear_eq_past_2_shoulder" in all and "Wear_eq_past_2_shoulder_R" in all):
		_fail("갓+덧옷+갑옷 → 5 조각이어야 (n=%d %s)" % [n3, all])
	WearVisual.apply_gear(holder, "braid", "off", "robe")
	if _names(holder) != ["Wear_acc_ribbon"]:
		_fail("바꾼 뒤 옛 것이 남음 %s" % [_names(holder)])

	# ⑥ 배율
	var skel := BoneGear.skeleton_of(holder)
	var k := BoneGear.body_scale(skel)
	var piece: Node3D = BoneGear.worn(holder, WearVisual.TAG)[0]
	if not (k > 0.6 and k < 1.4 and is_equal_approx(piece.scale.y, k)):
		_fail("배율 k=%.3f 조각 %.3f" % [k, piece.scale.y])

	# ④ 옷 빛 — 실제 노드로 한 바퀴(플레이어 그룹 + 폴링)
	var saved: Dictionary = ForestSaveState.wear_on.duplicate()
	holder.add_to_group("player")
	ForestSaveState.wear_on = {"coat": "plate", "head": "gat", "dye": "crimson", "cape": "on"}
	var wv: Node = WearVisual.new()
	add_child(wv)
	for i in 4:
		await get_tree().process_frame
	if _names(holder).size() != 5:
		_fail("폴링으로 붙인 조각 %s" % [_names(holder)])
	var tinted := false
	for mi in body.find_children("*", "MeshInstance3D", true, false):
		var m := mi as MeshInstance3D
		if m.mesh == null:
			continue
		for si in m.mesh.get_surface_count():
			var mat := m.get_surface_override_material(si) as ShaderMaterial
			if mat != null and mat.has_meta(WearVisual.BASE_TINT_META):
				tinted = true
	if not tinted:
		_fail("옷 빛이 안 물듦")
	ForestSaveState.wear_on = saved
	wv.queue_free()
	holder.queue_free()
	return fails
