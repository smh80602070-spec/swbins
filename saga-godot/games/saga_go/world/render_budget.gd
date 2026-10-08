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
##   · 해 그림자 최대 거리 100 → SHADOW_MAX_M(페이드 시작 0.8 이라 40m 안 그림자는 그대로, 그 너머만 일찍 사라진다)
##   SAGA_NO_SHADOW_TUNE=1 이면 이 조정을 건너뛴다(전후 촬영 비교용)
##   · 눈에 안 띄는 작은 식물·바위(키 1m 안팎)는 그림자를 드리우지 않는다 — 땅 그림자는 그대로고 이 덩어리들의 그림자만 빠진다
const SHADOW_MAX_M := 50.0
const NO_CAST_PREFIX := ["Understory", "MeadowHeads", "MeadowStems", "Crops", "Shrub", "Clutter", "RocksSmall", "Wildflowers",
		"VillageProps", "Dispatch", "Gather", "CookingPot"]   # 뒤 넷은 마을 소품(간판·게시판·채집물·솥) — 건물·좌판 그림자는 그대로

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
	if OS.get_environment("SAGA_NO_SHADOW_TUNE") != "":
		return
	for l in root.find_children("*", "DirectionalLight3D", true, false):
		var dl := l as DirectionalLight3D
		if dl.shadow_enabled and dl.directional_shadow_max_distance > SHADOW_MAX_M:
			dl.directional_shadow_max_distance = SHADOW_MAX_M
	for n in root.find_children("*", "Node3D", true, false):
		var nm := String(n.name)
		for p: String in NO_CAST_PREFIX:
			if nm.begins_with(p):
				if n is GeometryInstance3D:
					(n as GeometryInstance3D).cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
				for g in n.find_children("*", "GeometryInstance3D", true, false):
					(g as GeometryInstance3D).cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
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


## G-0114 ④ 같은 재질 조각 합치기 — 코드로 짠 소품(상자·솥)은 상자 하나가 도형 20여 개라 조각마다 draw call(+그림자)이 든다.
## parent 바로 밑 MeshInstance3D 중 자식·스크립트가 없고 재질이 같은(같은 물체, 또는 같은 셰이더·색·윤곽선) 것끼리
## 한 메시로 합친다 — 모양·색·그림자는 그대로라 화면이 같다. 혼자인 조각(불꽃처럼 따로 움직이는 것)은 안 건드린다.
## 조각을 변수로 붙잡아 두는 자리에는 부르지 않는다(합친 뒤 옛 노드는 지워진다). 합쳐 없앤 노드 수를 돌려준다.
static func merge_children(parent: Node3D) -> int:
	var groups := {}
	for c in parent.get_children():
		var mi := c as MeshInstance3D
		if mi == null or mi.get_child_count() > 0 or mi.get_script() != null or mi.mesh == null or mi.mesh.get_surface_count() != 1 \
				or mi.material_override == null or not mi.skeleton.is_empty() or not mi.visible \
				or mi.material_overlay != null or mi.visibility_range_end > 0.0 or mi.transparency > 0.0:   # 합친 노드가 못 물려받는 설정이 있으면 건너뜀(R-5)
			continue
		var k := "%s|%d|%d" % [_mat_key(mi.material_override), mi.cast_shadow, mi.layers]
		if not groups.has(k):
			groups[k] = []
		groups[k].append(mi)
	var removed := 0
	for k in groups:
		var arr: Array = groups[k]
		if arr.size() < 2:
			continue
		var st := SurfaceTool.new()
		for mi: MeshInstance3D in arr:
			st.append_from(mi.mesh, 0, mi.transform)
		var merged := MeshInstance3D.new()
		merged.name = "Merged"
		merged.mesh = st.commit()
		merged.material_override = (arr[0] as MeshInstance3D).material_override
		merged.cast_shadow = (arr[0] as MeshInstance3D).cast_shadow
		merged.layers = (arr[0] as MeshInstance3D).layers
		parent.add_child(merged)
		for mi: MeshInstance3D in arr:
			parent.remove_child(mi)
			mi.queue_free()
			removed += 1
		removed -= 1
	return removed


static func _mat_key(m: Material) -> String:
	var sm := m as ShaderMaterial
	if sm == null or sm.shader == null:
		return str(m.get_instance_id())
	## CreatureBuilder._mat 은 부를 때마다 새 재질이라 셰이더와 모든 셰이더 값(+ next_pass 도 같은 식)으로 같음을 본다.
	var key := "%d" % sm.shader.get_instance_id()
	for u in sm.shader.get_shader_uniform_list():
		var v: Variant = sm.get_shader_parameter(u.name)
		key += "|%s=%s" % [u.name, str(v.get_instance_id()) if v is Object else str(v)]
	return key + "|next:" + (_mat_key(sm.next_pass) if sm.next_pass != null else "-")
