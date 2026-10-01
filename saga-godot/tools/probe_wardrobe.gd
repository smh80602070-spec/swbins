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
	# 무늬 타일 64종(patterns.json, G-0013) — 시대 20/20/20/4, 고르기는 같은 열쇠면 늘 같은 무늬, 타일이 열림
	check(Wardrobe.patterns().size() == 64, "무늬 64종 — 실제 %d" % Wardrobe.patterns().size())
	for pair in [["past", 20], ["modern", 20], ["future", 20], ["crest", 4]]:
		check(Wardrobe.patterns_for_era(pair[0]).size() == pair[1], "시대 %s 무늬 %d" % [pair[0], pair[1]])
	var pk := Wardrobe.pick_pattern("past", "hero_x")
	check(pk != "" and pk == Wardrobe.pick_pattern("past", "hero_x") and Wardrobe.patterns_for_era("past").has(pk), "시대 안에서 같은 열쇠 = 같은 무늬(%s)" % pk)
	check(Wardrobe.pick_pattern("nowhere", "x") == "", "없는 시대는 빈 무늬")
	var missing := 0
	for id in Wardrobe.patterns():
		if Wardrobe.pattern_texture(id) == null:
			missing += 1
	check(missing == 0, "무늬 타일 64장 모두 열림(못 연 것 %d)" % missing)
	var body3 := packed.instantiate()
	get_root().add_child(body3)
	CelShaderApply.apply_to(body3)
	var np := Wardrobe.apply_patterns(body3, {"top": pk})
	check(np >= 1 and slot_tex(body3, "tops") == Wardrobe.pattern_texture(pk), "apply_patterns — 상의에 무늬 %s (표면 %d)" % [pk, np])
	check(slot_tex(body3, "shoes") == before_shoes, "무늬를 안 준 신발은 그대로")
	print("PROBE wardrobe ", "OK" if fails == 0 else "FAIL %d" % fails)
	quit(1 if fails > 0 else 0)
