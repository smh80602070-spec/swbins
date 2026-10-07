extends Node
## G-0060 장비 외형(player/armor_visual.gd) 자동 점검 — 평소엔 안 붙는다. test_village.gd 가 SAGA_ARMOR_PROBE 가 있을 때만 단다.
##
##   SAGA_ARMOR_PROBE=1 "$GODOT" --headless --path saga-godot res://games/saga_go/world/TestVillage.tscn
##
## ① 지금 인물 성유물 0 → 조각 0 ② 꽃 하나 ★4 Lv0 → 가슴 등급 1 하나 ③ 다섯 ★5 Lv20 → 조각 10(머리·가슴 + 어깨·팔·다리·신 좌우)·전부 등급 3
## ④ 시대 표 세 갈래 ⑤ 관을 빼면 머리 조각이 사라짐 ⑥ 조각이 그 이름의 뼈(BoneAttachment3D)에 붙음 ⑦ ★4 는 Lv20 이어도 등급 2.
## 성유물·소유자는 점검 끝에 처음대로 되돌린다. 저장은 안 한다. 끝에 "ARMOR_PROBE_DONE fails=N".

const AV := preload("res://games/saga_go/player/armor_visual.gd")

var _p: Node3D
var _frame := 0
var _fails := 0
var _done := false


func _check(name: String, ok: bool, info := "") -> void:
	print("ARMOR_PROBE %s %s %s" % [name, "ok" if ok else "FAIL", info])
	if not ok:
		_fails += 1


func _worn() -> Array:
	return AV.worn(_p.get("visual") as Node3D)


func _physics_process(_delta: float) -> void:
	_frame += 1
	if _done or _frame < 20:
		return
	_done = true
	_p = get_tree().get_first_node_in_group("player") as Node3D
	var id := String(_p.get("_body_id")) if _p != null else ""
	_check("body", id != "" and _p.get("visual") != null, "id=%s" % id)
	if id == "":
		_finish()
		return
	var saved_arts: Dictionary = PartyState.artifacts.duplicate(true)
	var saved_seq: int = int(PartyState.get("artifact_seq"))

	# ① 지금 인물 것을 다 뺀다
	for slot in ["flower", "plume", "sands", "goblet", "circlet"]:
		PartyState.unequip_artifact(id, slot)
	_p.call("_refresh_armor")
	_check("none", _worn().is_empty(), "worn=%d" % _worn().size())

	# ② 꽃 ★4 Lv0
	var u := PartyState.add_artifact(4, "", "flower")
	PartyState.equip_artifact(id, u)
	var w := _worn()
	_check("flower_chest", w.size() == 1 and String(w[0].name) == "Armor_chest", "worn=%s" % [w.map(func(n): return n.name)])
	var pc: Array = AV.pieces_for(PartyState.equipped_artifacts(id), "삼국지")
	_check("flower_grade1", pc.size() == 1 and String(pc[0].path).ends_with("eq_past_1_chest.glb"), str(pc))
	# ⑦ ★4 Lv20 → 2
	PartyState.artifacts[u].lv = 20
	_check("r4_cap2", AV.grade_of(PartyState.artifacts[u]) == 2)

	# ③ 다섯 ★5 Lv20
	var uids := {}
	for slot in ["flower", "plume", "sands", "goblet", "circlet"]:
		var k := PartyState.add_artifact(5, "", slot)
		PartyState.artifacts[k].lv = 20
		uids[slot] = k
		PartyState.equip_artifact(id, k)
	w = _worn()
	var paths: Array = AV.pieces_for(PartyState.equipped_artifacts(id), "삼국지").map(func(x): return String(x.path))
	var all3 := paths.size() == 6 and paths.all(func(x): return String(x).contains("_3_"))
	_check("full_10", w.size() == 10, "worn=%d" % w.size())
	_check("full_grade3", all3, str(paths))

	# ⑥ 뼈
	var head: Node = null
	for n in w:
		if String(n.name) == "Armor_head":
			head = n
	var att := head.get_parent().get_parent() as BoneAttachment3D if head != null else null
	var skel := att.get_parent() as Skeleton3D if att != null else null
	var bname := skel.get_bone_name(att.bone_idx) if skel != null else ""
	_check("head_bone", bname in ["J_Bip_C_Head", "head"], bname)
	var k: float = AV.body_scale(skel) if skel != null else 0.0
	_check("body_scale", k > 0.6 and k < 1.4 and is_equal_approx(absf(head.scale.x), k), "k=%.3f" % k)

	# ④ 시대
	_check("era", AV.era_of("삼국지") == "past" and AV.era_of("세계사") == "present" and AV.era_of("균열(가상)") == "future" and AV.era_of("서역(가상)") == "past")

	# ⑤ 관 빼기
	PartyState.unequip_artifact(id, "circlet")
	w = _worn()
	_check("unequip_head", w.size() == 9 and not w.any(func(n): return String(n.name) == "Armor_head"), "worn=%d" % w.size())

	# 되돌리기
	PartyState.artifacts = saved_arts
	PartyState.set("artifact_seq", saved_seq)
	PartyState.artifact_changed.emit()
	_finish()


func _finish() -> void:
	print("ARMOR_PROBE_DONE fails=%d" % _fails)
	get_tree().quit()
