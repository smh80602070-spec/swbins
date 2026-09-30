extends SceneTree

## 의상 착용 교체 점검 — AvatarSample_A 에 장비·캐시 의상을 입혀 셰이더 질감이 실제로 바뀌는지 본다.
##   godot --headless --path saga-godot --script res://tools/probe_wardrobe.gd
## 끝에 "PROBE wardrobe OK" 또는 실패 줄. 화면·창은 안 띄운다.

const Wardrobe := preload("res://games/saga_go/world/wardrobe.gd")
const CelShaderApply := preload("res://saga_core/shaders/cel_shader_apply.gd")
const BASE := "AvatarSample_A"

var fails := 0

func check(cond: bool, msg: String) -> void:
	if cond:
		print("  ok   ", msg)
	else:
		fails += 1
		print("  FAIL ", msg)

func slot_tex(body: Node, key: String) -> Texture2D:
	for mi in body.find_children("*", "MeshInstance3D", true, false):
		var m := mi as MeshInstance3D
		if m.mesh == null:
			continue
		for si in m.mesh.get_surface_count():
			var src := m.mesh.surface_get_material(si)
			if src and src.resource_name.to_lower().contains(key):
				var mat := m.get_active_material(si)
				if mat is ShaderMaterial:
					return (mat as ShaderMaterial).get_shader_parameter("albedo_texture")
				if mat is BaseMaterial3D:
					return (mat as BaseMaterial3D).albedo_texture
	return null

func _init() -> void:
	var all := Wardrobe.items(BASE)
	check(all.size() == 96, "아이템 96 (상의·하의·신발 × 32) — 실제 %d" % all.size())
	for s in Wardrobe.SLOTS:
		check(Wardrobe.items_for_slot(BASE, s).size() == 32, "슬롯 %s 32종" % s)

	var gear := {"top": "cos_AvatarSample_A_top_floral_blue", "bottom": "cos_AvatarSample_A_bottom_floral_blue"}
	var cosmetic := {"top": "cos_AvatarSample_A_top_tartan_green"}
	var look := Wardrobe.visible_look(gear, cosmetic)
	check(look.get("top") == cosmetic.top, "캐시 의상이 장비를 덮음(상의)")
	check(look.get("bottom") == gear.bottom, "캐시가 없는 슬롯은 장비 그대로(하의)")
	check(not look.has("shoes"), "둘 다 없는 슬롯은 원래 옷(신발)")
	var rt := Wardrobe.look_from_dict(Wardrobe.look_to_dict(gear, cosmetic))
	check(rt.gear == gear and rt.cosmetic == cosmetic, "세이브 왕복")

	var packed := load("res://assets/characters_vroid/AvatarSample_A.glb") as PackedScene
	check(packed != null, "AvatarSample_A.glb 불러옴")
	var body := packed.instantiate()
	get_root().add_child(body)
	CelShaderApply.apply_to(body)
	var before_top := slot_tex(body, "tops")
	var before_shoes := slot_tex(body, "shoes")
	check(before_top != null, "상의 재질을 찾음")
	var n := Wardrobe.apply(body, BASE, look)
	check(n >= 2, "입힌 표면 %d (상의·하의)" % n)
	var want_top := Wardrobe.texture_of(BASE, cosmetic.top)
	check(want_top != null and slot_tex(body, "tops") == want_top, "상의 = 캐시 무늬 질감")
	check(slot_tex(body, "tops") != before_top, "상의 질감이 원래와 다름")
	check(slot_tex(body, "shoes") == before_shoes, "look 에 없는 신발은 그대로")
	# 같은 몸을 두 번째로 만들어도 첫 몸이 안 바뀌는지(재질 공유 번짐)
	var body2 := packed.instantiate()
	get_root().add_child(body2)
	CelShaderApply.apply_to(body2)
	check(slot_tex(body2, "tops") == before_top or slot_tex(body2, "tops") != want_top, "둘째 몸은 원래 옷(번짐 없음)")
	print("PROBE wardrobe ", "OK" if fails == 0 else "FAIL %d" % fails)
	quit(1 if fails > 0 else 0)
