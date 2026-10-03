extends Node3D

## G-0015 — 지역 구경 장면. `SAGA_REGION=<지역>` 로 한 곳을 열고(기본 village), WASD·QE·마우스 오른쪽 드래그로 둘러본다.
## `SAGA_REGION_PROBE=1` 이면 화면 없이 지역 다섯을 차례로 짜서 계수를 찍고 끝낸다(`REGION_PROBE_DONE fails=N`).

var _cam: Camera3D
var _loader: RegionLoader
var _yaw := 0.0
var _pitch := 0.0


func _ready() -> void:
	if OS.get_environment("SAGA_REGION_PROBE") != "":
		_run_probe()
		return
	var id := OS.get_environment("SAGA_REGION")
	if id == "" or not RegionLoader.has_layout(id):
		id = "village"
	_open(id)


func _open(id: String) -> void:
	if _loader != null:
		_loader.queue_free()
	_loader = RegionLoader.new()
	add_child(_loader)
	_loader.build(id)
	_setup_light_and_sky()
	_setup_camera()


func _setup_light_and_sky() -> void:
	if int(_loader.stats.suns) == 0:   # 배치표에 해·달이 없으면(village) 기본 해
		var sun := DirectionalLight3D.new()
		sun.name = "Sun"
		sun.rotation_degrees = Vector3(-48, -35, 0)
		sun.light_color = Color(1.0, 0.95, 0.86)
		sun.light_energy = 1.2
		sun.shadow_enabled = true
		add_child(sun)
	var env := Environment.new()
	var fog: Variant = _loader.layout.get("fog")
	if fog is Dictionary:
		env.fog_enabled = true
		env.fog_density = float(fog.density)
		env.fog_light_color = Color(float(fog.color[0]), float(fog.color[1]), float(fog.color[2]))
		env.fog_sky_affect = 0.15
	var sky_info: Variant = _loader.layout.get("sky")
	var pano: Variant = sky_info.get("panorama") if sky_info is Dictionary else null
	if pano is Dictionary:
		var rel := String(pano.get("mobile" if OS.has_feature("mobile") else "full", ""))
		var tex := load(_loader.dir + rel) as Texture2D
		if tex != null:
			var mat := PanoramaSkyMaterial.new()
			mat.panorama = tex
			var sky := Sky.new()
			sky.sky_material = mat
			env.sky = sky
			env.background_mode = Environment.BG_SKY
			env.ambient_light_source = Environment.AMBIENT_SOURCE_SKY
	var we := WorldEnvironment.new()
	we.name = "WorldEnvironment"
	we.environment = env
	add_child(we)


func _setup_camera() -> void:
	_cam = Camera3D.new()
	_cam.name = "Camera"
	_cam.far = 600.0
	add_child(_cam)
	var cam: Variant = _loader.layout.get("camera")
	if cam is Dictionary:
		_cam.position = RegionLoader.conv(cam.pos as Array)
		_cam.look_at_from_position(_cam.position, RegionLoader.conv(cam.look as Array))
		_cam.keep_aspect = Camera3D.KEEP_WIDTH   # Blender 렌즈(mm, 36mm 센서)는 가로 시야각
		_cam.fov = rad_to_deg(2.0 * atan(18.0 / float(cam.get("lens", 35.0))))
	else:
		# 배치표에 카메라가 없으면(village) 길 입구에서 광장을 바라본다.
		var from := RegionLoader.conv([0.0, -8.0, _loader.height_at(0.0, -8.0) + 3.0])
		_cam.look_at_from_position(from, RegionLoader.conv([0.0, 40.0, 4.0]))
	_yaw = _cam.rotation.y
	_pitch = _cam.rotation.x


func _process(delta: float) -> void:
	if _cam == null:
		return
	var v := Vector3.ZERO
	if Input.is_key_pressed(KEY_W): v.z -= 1.0
	if Input.is_key_pressed(KEY_S): v.z += 1.0
	if Input.is_key_pressed(KEY_A): v.x -= 1.0
	if Input.is_key_pressed(KEY_D): v.x += 1.0
	if Input.is_key_pressed(KEY_E): v.y += 1.0
	if Input.is_key_pressed(KEY_Q): v.y -= 1.0
	var speed := 16.0 if Input.is_key_pressed(KEY_SHIFT) else 6.0
	_cam.position += _cam.global_transform.basis * v * speed * delta


func _unhandled_input(ev: InputEvent) -> void:
	if _cam != null and ev is InputEventMouseMotion and Input.is_mouse_button_pressed(MOUSE_BUTTON_RIGHT):
		_yaw -= (ev as InputEventMouseMotion).relative.x * 0.004
		_pitch = clampf(_pitch - (ev as InputEventMouseMotion).relative.y * 0.004, -1.5, 1.5)
		_cam.rotation = Vector3(_pitch, _yaw, 0.0)


# ---------------------------------------------------------------- 진단

func _count_layout(id: String) -> Dictionary:
	var f := FileAccess.open("%s%s/layout.json" % [RegionLoader.REGION_DIR, id], FileAccess.READ)
	var l := JSON.parse_string(f.get_as_text()) as Dictionary
	var n := {}
	for k in ["pieces", "trees", "flowers", "roads"]:
		n[k] = (l[k] as Array).size() if l.get(k) is Array else 0
	return n


## 지형·광장·길 삼각형 중 위에서 볼 때 앞면(시계 방향 = 위로 향한 면 법선이 -y 로 계산됨)이 아닌 것의 수.
func _flipped_tris(ld: RegionLoader) -> int:
	var n := 0
	for c in ld.get_children():
		if not (c is MeshInstance3D) or not (c.name == "Terrain" or c.name == "Plaza" or String(c.name).begins_with("Road")):
			continue
		var arrays := ((c as MeshInstance3D).mesh as ArrayMesh).surface_get_arrays(0)
		var v: PackedVector3Array = arrays[Mesh.ARRAY_VERTEX]
		var idx: PackedInt32Array = arrays[Mesh.ARRAY_INDEX]
		for i in range(0, idx.size(), 3):
			var cr := (v[idx[i + 1]] - v[idx[i]]).cross(v[idx[i + 2]] - v[idx[i]])
			if cr.y >= 0.0:
				n += 1
	return n


func _run_probe() -> void:
	var fails := 0
	for id: String in RegionLoader.REGIONS:
		if not RegionLoader.has_layout(id):
			print("REGION_PROBE ", id, " 배치표 없음")
			fails += 1
			continue
		var want := _count_layout(id)
		var ld := RegionLoader.new()
		add_child(ld)
		var ok := ld.build(id)
		var bad: Array[String] = []
		if not ok:
			bad.append("build")
		for k in ["pieces", "trees", "flowers", "roads"]:
			if int(ld.stats[k]) != int(want[k]):
				bad.append("%s %d≠%d" % [k, int(ld.stats[k]), int(want[k])])
		if ld.layout.has("scenery") and int(ld.stats.scenery) == 0:
			bad.append("scenery 0")
		if ld.layout.has("water") and int(ld.stats.water) != 1:
			bad.append("water")
		if ld.layout.has("terrain") and int(ld.stats.terrain_tris) == 0:
			bad.append("terrain 0")
		var flipped := _flipped_tris(ld)
		if flipped > 0:
			bad.append("뒤집힌 삼각형 %d" % flipped)
		var budget := RegionLoader.LIGHT_BUDGET_MOBILE if OS.has_feature("mobile") else RegionLoader.LIGHT_BUDGET_PC
		if int(ld.stats.lights) > budget:
			bad.append("lights %d>%d" % [int(ld.stats.lights), budget])
		print("REGION_PROBE ", id, " ", JSON.stringify(ld.stats), " 나쁜것=", bad)
		if not bad.is_empty():
			fails += 1
		ld.queue_free()
	print("REGION_PROBE_DONE fails=", fails)
	get_tree().quit()
