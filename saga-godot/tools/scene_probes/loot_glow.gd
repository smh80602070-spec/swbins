extends Node
## R-3(gd.dg.loot-glow) 사가나락 노획물 등급 외곽선·전설 잔광 — scene_probe_host 로 돈다(오토로드 필요).
## ① 모든 노획물에 등급색 외곽선(next_pass cel_outline, outline_color = 그 등급 색) ② 전설(색이 TIERS[4])만 잔광 파티클(LegendaryGlow, 10개)이 붙고 다른 등급엔 없다
## ③ 전설·비전설 둘 다 실제로 표본에 나온다(전설 확률 배수 1000·1)
## G-0049 ④ 모든 장비 노획물 밑에 등급색 고리(TierRing) ⑤ 전설만 빛기둥(LegendaryBeam) ⑥ 외곽선 세계 두께(thickness × 메시 배율) ≥ 4cm

const LootPickup := preload("res://games/saga_dungeon/world/loot_pickup.gd")

var fails := 0


func _fail(msg: String) -> void:
	fails += 1
	print("  FAIL ", msg)


var _outline_scale := 1.0 # _outline_of 가 찾은 메시의 배율(세계 두께 셈용)


func _outline_of(area: Area3D) -> ShaderMaterial:
	for c in area.get_children():
		if c is MeshInstance3D:
			var mi := c as MeshInstance3D
			var base: Material = mi.material_override
			if base == null:
				base = mi.get_surface_override_material(0)
			if base != null and base.next_pass is ShaderMaterial:
				_outline_scale = mi.transform.basis.get_scale().x
				return base.next_pass as ShaderMaterial
	return null


func _spawn_and_collect(parent: Node3D, mult: float, n: int) -> Array:
	var out: Array = []
	for i in n:
		var before := parent.get_child_count()
		LootPickup.spawn_at(parent, Vector3(float(i) * 3.0, 0, 0), 5, false, false, mult)
		## 같은 이름 형제는 "@Area3D@N" 으로 바뀐다 — 이름 말고 "그 호출이 가장 먼저 붙인 Area3D"(= 장비 노획물, 금·재료는 그 뒤)로 고른다.
		for k in range(before, parent.get_child_count()):
			if parent.get_child(k) is Area3D:
				out.append(parent.get_child(k))
				break
	return out


func run() -> int:
	seed(20260824)
	var legend_color := Color(String(DungeonItems.TIERS[LootPickup.LEGENDARY_TIER_KEY].color))
	var parent := Node3D.new()
	add_child(parent)
	var seen_legend := 0
	var seen_plain := 0
	for mult in [1000.0, 1.0]:
		for area: Area3D in _spawn_and_collect(parent, mult, 24):
			var outline := _outline_of(area)
			if outline == null or outline.shader == null or not outline.shader.resource_path.ends_with("cel_outline.gdshader"):
				_fail("area %s has no cel_outline next_pass" % area.name)
				continue
			var color: Color = outline.get_shader_parameter("outline_color")
			var known := false
			for t in DungeonItems.TIERS:
				if Color(String(t.color)).is_equal_approx(color):
					known = true
			if not known:
				_fail("area %s outline color %s matches no tier" % [area.name, color])
			var world_t := float(outline.get_shader_parameter("thickness")) * _outline_scale
			if world_t < 0.04:
				_fail("area %s outline world thickness %.3f < 0.04" % [area.name, world_t])
			var ring := area.get_node_or_null("TierRing") as MeshInstance3D
			if ring == null or not ((ring.mesh.surface_get_material(0) as StandardMaterial3D).albedo_color.is_equal_approx(color)):
				_fail("area %s has no tier-colored ring" % area.name)
			var is_legend := color.is_equal_approx(legend_color)
			var glow := area.get_node_or_null("LegendaryGlow") as CPUParticles3D
			var beam := area.get_node_or_null("LegendaryBeam")
			if is_legend:
				seen_legend += 1
				if glow == null or glow.amount != LootPickup.LEGENDARY_GLOW_AMOUNT:
					_fail("전설 노획물에 잔광 파티클(%d개)이 없다" % LootPickup.LEGENDARY_GLOW_AMOUNT)
				if beam == null:
					_fail("전설 노획물에 빛기둥이 없다")
			else:
				seen_plain += 1
				if glow != null or beam != null:
					_fail("비전설 노획물에 잔광·빛기둥이 붙었다")
	if seen_legend == 0 or seen_plain == 0:
		_fail("sample shortage legend=%d plain=%d" % [seen_legend, seen_plain])
	parent.queue_free()
	return fails
