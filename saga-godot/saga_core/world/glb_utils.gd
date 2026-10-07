class_name GLBUtils
extends RefCounted

## PLAN.md 41·45·46장 — primitive를 실제 GLB 에셋으로 교체하면서 여러 빌더
## (vegetation_builder.gd·landmarks_builder.gd)가 똑같이 필요로 하는 작업:
## 임포트된 GLB 씬을 한 번 인스턴스화해서 그 안의 Mesh 리소스만 뽑아내
## MultiMesh에 태운다(칸마다 노드를 만들지 않는다는 master.md 35장 원칙을
## GLB로 바꾼 뒤에도 그대로 지킨다).

## glb_path가 가리키는 씬의 메시를 Mesh 하나로 반환한다 — 뼈대가 있는
## 캐릭터(assets/characters/*)에는 쓰지 않는다. MeshInstance3D가 하나뿐이면
## (Kenney 소품·Quaternius 원본 gltf·바위 스냅본 등 대부분) 그 Mesh를 그대로
## 돌려주고, 여럿이면 `_merge_mesh_instances()`로 표면을 합친다.
##
## 2026-09-23 — 예전엔 "첫 MeshInstance3D 하나"만 돌려줬다. 그런데 팔레트
## 스냅(103-5 palette.py)을 거친 Quaternius GLB 일부는 원본 gltf의 한 메시·
## 두 프리미티브(줄기+잎, 꽃대+꽃송이)가 **노드 둘로 쪼개져** 나온다 — 그래서
## GO 마을 나무(CommonTree_1 스냅)는 09-20 교체 뒤로 잎 없이 줄기만, 들꽃
## (Flower_3/4_Single 스냅)은 꽃송이 없이 꽃대만 그려졌다. 에러 없이 "덜
## 그려질" 뿐이라 로그 회귀·재질 감사 어느 쪽도 못 잡았다.
static func extract_mesh(glb_path: String) -> Mesh:
	var scene: PackedScene = load(glb_path)
	if scene == null:
		push_warning("GLBUtils: 로드 실패 — %s" % glb_path)
		return null
	return extract_mesh_from_scene(scene)

## 2026-09-20 — loot_pickup.gd 무기 노획(101-3 G)처럼 "어느 GLB를 쓸지"가
## 런타임 RNG(등급·무기 종류 굴림)에 달린 자리는 `load(path)`를 굴림 뒤에
## 부르면 안 된다 — `--verbose` 헤드리스 로그가 실제로 디스크에서 읽은
## 리소스 경로를 그대로 찍어서, 굴림마다 다른 파일이 로드돼 회귀 스크립트
## (godot_regress.sh)의 md5 비교가 깨진다(2026-09-20 DUNGEON에서 실제로
## 발견). 대신 후보 전부를 스크립트 상단에서 `const ... := preload(...)`로
## 미리 다 실어 두고(항상 같은 순서로 실행되니 로그도 결정적이다), 굴림
## 뒤에는 이미 메모리에 있는 PackedScene에서 메시만 뽑는다 — 이 함수가
## 그 "이미 로드된 것에서 뽑기" 절반을 맡는다.
static func extract_mesh_from_scene(scene: PackedScene) -> Mesh:
	var inst := scene.instantiate()
	var mis: Array[MeshInstance3D] = []
	for mi in find_all_mesh_instances(inst):
		if mi.mesh != null:
			mis.append(mi)
	var mesh: Mesh = null
	if mis.size() == 1:
		mesh = mis[0].mesh
	elif mis.size() > 1:
		mesh = _merge_mesh_instances(inst, mis)
	inst.queue_free()
	return mesh

## 여러 MeshInstance3D의 표면을 root 기준 transform을 입혀 ArrayMesh 하나로
## 합친다(표면 순서 = 노드 순서, 재질은 원본 그대로). 트리 밖 노드라
## global_transform 대신 `_relative_transform()`을 쓴다(fit_height 주석 참고).
## 새 ArrayMesh라 호출 쪽이 표면 재질을 바꿔도(GO 나무 바람 셰이더) 임포트
## 원본 메시는 안 건드린다.
static func _merge_mesh_instances(root: Node, mis: Array[MeshInstance3D]) -> ArrayMesh:
	var out := ArrayMesh.new()
	for mi in mis:
		var xf := _relative_transform(root, mi)
		var nbasis := xf.basis.inverse().transposed()
		var src: Mesh = mi.mesh
		for s in src.get_surface_count():
			var arrays := src.surface_get_arrays(s)
			if not xf.is_equal_approx(Transform3D.IDENTITY):
				var verts: PackedVector3Array = arrays[Mesh.ARRAY_VERTEX]
				for i in verts.size():
					verts[i] = xf * verts[i]
				arrays[Mesh.ARRAY_VERTEX] = verts
				if arrays[Mesh.ARRAY_NORMAL] != null:
					var norms: PackedVector3Array = arrays[Mesh.ARRAY_NORMAL]
					for i in norms.size():
						norms[i] = (nbasis * norms[i]).normalized()
					arrays[Mesh.ARRAY_NORMAL] = norms
				if arrays[Mesh.ARRAY_TANGENT] != null:
					var tans: PackedFloat32Array = arrays[Mesh.ARRAY_TANGENT]
					for i in range(0, tans.size(), 4):
						var t := (xf.basis * Vector3(tans[i], tans[i + 1], tans[i + 2])).normalized()
						tans[i] = t.x
						tans[i + 1] = t.y
						tans[i + 2] = t.z
					arrays[Mesh.ARRAY_TANGENT] = tans
			var prim := Mesh.PRIMITIVE_TRIANGLES
			if src is ArrayMesh:
				prim = (src as ArrayMesh).surface_get_primitive_type(s)
			out.add_surface_from_arrays(prim, arrays)
			out.surface_set_material(out.get_surface_count() - 1, src.surface_get_material(s))
	return out

## 2026-09-28 — 합친 메시(_merge_mesh_instances)는 임포트 때 만든 LOD 가 없다(add_surface_from_arrays 는 LOD 를 안 받는다).
## 숲을 짙게 하자(vegetation_builder 숲 칸 10그루) 먼 나무까지 가장 자세한 모양으로 그려 마을 삼각형 평균이 36만 → 63만이 됐다.
## ImporterMesh 로 다시 담아 LOD 를 만들어 돌려준다(재질·표면 순서 그대로). 뼈대 메시엔 쓰지 않는다.
static func with_lods(mesh: Mesh) -> Mesh:
	if mesh == null or not (mesh is ArrayMesh):
		return mesh
	var im := ImporterMesh.new()
	for s in mesh.get_surface_count():
		im.add_surface((mesh as ArrayMesh).surface_get_primitive_type(s), mesh.surface_get_arrays(s), [], {}, mesh.surface_get_material(s))
	im.generate_lods(25.0, 60.0, [])
	return im.get_mesh()

## 뼈대 있는 캐릭터(assets/characters/*)는 몸통·팔·다리·머리가 각각
## 별도 MeshInstance3D다 — 산적 강타 예고처럼 "몸 전체를 한 색으로
## 물들인다" 같은 연출은 이걸로 전부 찾아 material_override를 같이
## 바꿔야 한다(games/saga_go/world/bandit_encounter.gd 참고).
static func find_all_mesh_instances(node: Node) -> Array[MeshInstance3D]:
	var result: Array[MeshInstance3D] = []
	if node is MeshInstance3D:
		result.append(node)
	for c in node.get_children():
		result.append_array(find_all_mesh_instances(c))
	return result

## PLAN 102-1 — 임포트 직후 이 한 줄로 실측 높이를 맞춘다(문 2.2m·층 3m와
## 같은 스케일 표 기준, 사람 target_height 1.7m). node의 모든
## MeshInstance3D를 훑어 node 기준(자신은 제외한) 결합 AABB를 구하고, 그
## 높이가 target_height가 되게 node.scale을 한 번에 정한다 — 축마다
## 다르게 늘리지 않는다(102-1 "균일 스케일" 원칙).
##
## `global_transform`은 안 쓴다 — 이 함수는 `scene.instantiate()` 직후,
## 아직 트리에 안 붙은 상태로 부르는 게 정상 용법인데, Godot 4는 트리 밖
## 노드의 `global_transform`을 조용히 항등행렬로 반환한다(엔진 에러 로그만
## 남기고 계속 돈다 — 자가진단에서 실제로 잡아냈다). 그래서 `_relative_
## transform()`으로 node까지의 로컬 transform만 직접 곱해 구한다.
##
## G-0059 — 몬스터 GLB 몸(monster_body.gd)이 처음 쓴다(들판 적 키 = KINDS height).
## 사람 캐릭터엔 아직 안 쓴다. 지금 다섯 판은 캐릭터마다 임의
## 배율(플레이어·NPC 1.25배 등, 102-7 "스케일 뒤죽박죽")을 써 왔고, 그
## 결과 실측 캐릭터 키가 이미 3.4m 안팎(카메라·충돌·지역 크기 전부 이
## 키에 맞춰 튜닝됨 — GO/DUNGEON/FOREST는 사용자 실기 승인까지 받았다).
## 여기서 1.7m로 바로 되돌리면 승인받은 세 판의 카메라 거리·충돌 반경·
## 이동 체감이 한꺼번에 반토막 난다. 기존 배율을 이걸로 바꿔치기하는 건
## PLAN 105장 Q-h(2026-09-18 신설)로 결정이 나거나 새 캐릭터를 붙일 때
## 쓸 준비만 해 둔 것이다.
static func fit_height(node: Node3D, target_height: float) -> void:
	var combined := AABB()
	var has_any := false
	for mi in find_all_mesh_instances(node):
		if mi.mesh == null:
			continue
		var xform := _relative_transform(node, mi)
		var world_aabb: AABB = xform * mi.mesh.get_aabb()
		combined = world_aabb if not has_any else combined.merge(world_aabb)
		has_any = true
	if not has_any or combined.size.y <= 0.0001:
		push_warning("GLBUtils.fit_height: 메시를 찾지 못함 — %s" % node.name)
		return
	node.scale = Vector3.ONE * (target_height / combined.size.y)

## descendant의 로컬 transform들을 ancestor 바로 아래 기준까지만
## 곱해 합친다(ancestor 자신의 transform은 뺀다 — fit_height가 ancestor.
## scale을 정하기 전 상태를 보려는 것이므로).
static func _relative_transform(ancestor: Node, descendant: Node) -> Transform3D:
	var xform := Transform3D.IDENTITY
	var cur: Node = descendant
	while cur != null and cur != ancestor:
		if cur is Node3D:
			xform = (cur as Node3D).transform * xform
		cur = cur.get_parent()
	return xform
