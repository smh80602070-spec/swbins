extends RefCounted

## GO 그리기 부담 줄이기 — 화면에 보이는 것은 그대로 두고 헛그리는 것만 걷는다(폰 발열, 2026-09-24 사용자 "그래픽을 낮추라는 게 아니다").
##   ① 지도 전체에 걸친 MultiMesh(나무·풀·바위·담)를 CHUNK_M 칸으로 쪼갠다 — 한 덩어리면 경계 상자가 늘 카메라 곁에 걸려
##      화면 밖·그림자 범위 밖 인스턴스까지 전부 그리고, 먼 인스턴스도 가장 자세한 LOD 로 그린다(LOD 는 덩어리 거리로 고른다).
##      칸으로 나누면 칸마다 시야 밖은 빠지고 먼 칸은 저절로 낮은 LOD(엔진 기본 — 화면 1px 오차 기준이라 눈엔 같다).
##   ② 카메라 far 4000m → FAR_M. 가장 맑은 날 안개(0.012 × 0.6)로도 1000m 너머는 0.07% 만 비쳐 화면이 같다.
## test_village.gd 가 씬을 다 지은 뒤 한 번 부른다. 헤드리스(더미 렌더러)는 인스턴스 위치를 못 읽어 쪼개지 않는다 — 그대로 둔다.

const CHUNK_M := 112.0
## 이만큼(삼각형 × 인스턴스) 무거운 덩어리만 쪼갠다 — 작은 풀·꽃 덩어리까지 쪼개면 넓게 보일 때 조각 수만큼 draw call 이 는다
## (96m·전부 쪼갰을 때 포구에서 한 프레임 887).
const MIN_TRIS := 50000
const FAR_M := 1000.0
## G-0023 ③ 그림자 패스 — 마을 신상 곁 삼각형의 약 72%·draw 80여 개가 해 그림자(4분할)가 물체를 다시 그리는 몫이다(측정, G-0023 메모).
##   · 해 그림자 최대 거리 100 → SHADOW_MAX_M(페이드 시작 0.8 이라 56m 안 그림자는 그대로, 그 너머만 일찍 사라진다)
##   · 눈에 안 띄는 작은 식물·바위(키 1m 안팎)는 그림자를 드리우지 않는다 — 땅 그림자는 그대로고 이 덩어리들의 그림자만 빠진다
const SHADOW_MAX_M := 70.0
const NO_CAST_PREFIX := ["Understory", "MeadowHeads", "MeadowStems", "Crops", "Shrub", "Clutter", "RocksSmall"]

## 쪼갠 MultiMesh 수를 돌려준다.
static func apply(root: Node) -> int:
	var cam := root.get_viewport().get_camera_3d()
	if cam and cam.far > FAR_M:
		cam.far = FAR_M
	var split := 0
	for n in root.find_children("*", "MultiMeshInstance3D", true, false):
		if _split(n as MultiMeshInstance3D):
			split += 1
	_tune_shadows(root)
	return split


static func _tune_shadows(root: Node) -> void:
	for l in root.find_children("*", "DirectionalLight3D", true, false):
		var dl := l as DirectionalLight3D
		if dl.shadow_enabled and dl.directional_shadow_max_distance > SHADOW_MAX_M:
			dl.directional_shadow_max_distance = SHADOW_MAX_M
	for n in root.find_children("*", "MultiMeshInstance3D", true, false):
		var nm := String(n.name)
		for p: String in NO_CAST_PREFIX:
			if nm.begins_with(p):
				(n as GeometryInstance3D).cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
				break

static func _split(mmi: MultiMeshInstance3D) -> bool:
	var mm := mmi.multimesh
	if mm == null or mm.mesh == null or mm.instance_count < 2 or mm.transform_format != MultiMesh.TRANSFORM_3D:
		return false
	var box := mm.get_aabb()
	if maxf(box.size.x, box.size.z) <= CHUNK_M * 1.5:
		return false
	if mm.mesh.get_faces().size() / 3 * mm.instance_count < MIN_TRIS:
		return false
	## 칸 = 인스턴스 자리(MMI 기준 좌표)를 CHUNK_M 로 나눈 격자.
	var buckets: Dictionary = {}
	for i in mm.instance_count:
		var o := mm.get_instance_transform(i).origin
		var key := Vector2i(floori(o.x / CHUNK_M), floori(o.z / CHUNK_M))
		if not buckets.has(key):
			buckets[key] = []
		(buckets[key] as Array).append(i)
	if buckets.size() <= 1:
		return false
	var parent := mmi.get_parent()
	var at := mmi.get_index()
	for key in buckets:
		var ids: Array = buckets[key]
		var part := MultiMesh.new()
		part.transform_format = MultiMesh.TRANSFORM_3D
		part.use_colors = mm.use_colors
		part.use_custom_data = mm.use_custom_data
		part.mesh = mm.mesh
		part.instance_count = ids.size()
		for j in ids.size():
			var src: int = ids[j]
			part.set_instance_transform(j, mm.get_instance_transform(src))
			if mm.use_colors:
				part.set_instance_color(j, mm.get_instance_color(src))
			if mm.use_custom_data:
				part.set_instance_custom_data(j, mm.get_instance_custom_data(src))
		var piece := MultiMeshInstance3D.new()
		piece.name = "%s_%d_%d" % [mmi.name, key.x, key.y]
		piece.multimesh = part
		piece.transform = mmi.transform
		piece.material_override = mmi.material_override
		piece.material_overlay = mmi.material_overlay
		piece.cast_shadow = mmi.cast_shadow
		piece.layers = mmi.layers
		piece.visibility_range_begin = mmi.visibility_range_begin
		piece.visibility_range_end = mmi.visibility_range_end
		piece.gi_mode = mmi.gi_mode
		parent.add_child(piece)
		parent.move_child(piece, at)
	parent.remove_child(mmi)
	mmi.queue_free()
	return true
