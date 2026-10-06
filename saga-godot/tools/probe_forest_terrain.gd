extends SceneTree
## R-3(gd.fs.triplanar) 숲 지형 트라이플레이너 점검 — godot --headless --path saga-godot --script res://tools/probe_forest_terrain.gd → "PROBE forest_terrain OK" / "FAIL n"
## ① 땅(Ground) 메시가 있고 칸 수×6 정점·정점색이 있다 ② 곡률 트라이플레이너 재질(풀·흙·돌 알베도·노멀·러프 아홉 장 전부 열림)이 물려 있다
## ③ 충돌 바닥이 지도 전체를 덮는다 ④ 구면 곡률 유니폼(curve_amount)이 켜져 있다

const FTB := preload("res://games/saga_forest/world/forest_terrain_builder.gd")
const ForestMap := preload("res://games/saga_forest/data/village_map.gd")
const TEXTURES := ["grass_albedo", "grass_normal", "grass_rough", "dirt_albedo", "dirt_normal", "dirt_rough", "stone_albedo", "stone_normal", "stone_rough"]

var fails := 0


func _fail(msg: String) -> void:
	fails += 1
	print("  FAIL ", msg)


func _initialize() -> void:
	await process_frame
	var b := FTB.new()
	root.add_child(b)
	await process_frame
	var ground := b.get_node_or_null("Ground") as MeshInstance3D
	if ground == null or ground.mesh == null:
		_fail("Ground 메시 없음")
	else:
		var tiles: int = 0
		for row in ForestMap.ROWS:
			tiles += String(row).length()
		var arrays := ground.mesh.surface_get_arrays(0)
		var verts: PackedVector3Array = arrays[Mesh.ARRAY_VERTEX]
		if verts.size() != tiles * 6:
			_fail("정점 수 %d (기대 칸 %d × 6)" % [verts.size(), tiles])
		if arrays[Mesh.ARRAY_COLOR] == null:
			_fail("정점색(지형 종류·바이옴 tint) 없음")
		else:
			## G-0042 — 같은 자리 정점은 같은 색(칸 경계가 섞여 네모 얼룩이 없다) · 이웃 칸 색이 다른 경계가 실제로 있다
			var cols: PackedColorArray = arrays[Mesh.ARRAY_COLOR]
			var at := {}
			var seams := 0
			for i in verts.size():
				var key := Vector2i(roundi(verts[i].x * 10.0), roundi(verts[i].z * 10.0))
				if at.has(key) and not (at[key] as Color).is_equal_approx(cols[i]):
					seams += 1
				at[key] = cols[i]
			if seams > 0:
				_fail("칸 경계 이음새 %d곳 — 같은 자리 정점 색이 다름(네모 얼룩)" % seams)
			var distinct := {}
			for c in cols:
				distinct[c.to_html()] = true
			if distinct.size() < 8:
				_fail("정점색이 %d가지뿐 — 경계 섞임이 없다" % distinct.size())
		var mat := ground.material_override as ShaderMaterial
		if mat == null or mat.shader == null or not mat.shader.resource_path.ends_with("curved_triplanar.gdshader"):
			_fail("곡률 트라이플레이너 재질이 아님")
		else:
			for t: String in TEXTURES:
				if not (mat.get_shader_parameter(t) is Texture2D):
					_fail("텍스처 %s 안 열림" % t)
			if float(mat.get_shader_parameter("curve_amount")) <= 0.0:
				_fail("curve_amount 가 0 — 구면 곡률이 꺼짐")
	var col := b.get_node_or_null("TerrainCollision") as StaticBody3D
	if col == null or col.get_child_count() == 0:
		_fail("충돌 바닥 없음")
	else:
		var box := (col.get_child(0) as CollisionShape3D).shape as BoxShape3D
		var s := ForestMap.size()
		if box == null or box.size.x < s.x * ForestMap.TILE_SIZE - 0.01 or box.size.z < s.y * ForestMap.TILE_SIZE - 0.01:
			_fail("충돌 바닥이 지도 전체를 안 덮음")
	print("PROBE forest_terrain ", "OK" if fails == 0 else "FAIL %d" % fails)
	quit(1 if fails > 0 else 0)
