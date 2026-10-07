extends RefCounted

## 원본 재질을 override로 덮으면서 원본이 가진 것을 잃는 사고를 일반 규칙으로
## 찾는다 — 2026-09-23 한 세션에 같은 부류가 셋 나왔다(FOREST 흰 바위·네모판
## 잎·Kenney 텍스처로 덮인 VRoid 플레이어). 전부 로그 md5 회귀로는 안 잡혔다
## (에러 없이 "다르게 그려질" 뿐이라). tools/material_audit_host.tscn 이 씬을
## 띄워 이걸 부르고, tools/godot_regress.sh 가 결과를 통과 조건에 넣는다.
##
## 비교 기준은 메시 자체에 박힌 임포트 원본 재질(surface_get_material)이다.
## 원본이 텍스처를 가진 BaseMaterial3D일 때만 본다 — primitive·단색 GLB
## (Kenney Nature Kit 등 baseColorFactor뿐)에 tint를 입히는 건 의도된 용법이다.
## 출력 문구에 regress의 오류 grep 단어(error·warn·missing·invalid·cannot)를
## 쓰지 않는다.

## cel_shader_apply.gd 얼굴 베이크 — 원본과 다른 텍스처를 일부러 입힌다.
const FOREIGN_TEXTURE_ALLOW := ["_Face_Baked"]


static func audit(root: Node) -> PackedStringArray:
	var issues := PackedStringArray()
	_walk(root, root, issues)
	return issues


static func _walk(root: Node, n: Node, issues: PackedStringArray) -> void:
	if n is MeshInstance3D:
		var mi := n as MeshInstance3D
		if mi.mesh != null and mi.visible:
			for i in mi.mesh.get_surface_count():
				_check(root, mi, mi.mesh, i, mi.get_active_material(i), issues)
	elif n is MultiMeshInstance3D:
		var mmi := n as MultiMeshInstance3D
		var mesh: Mesh = mmi.multimesh.mesh if mmi.multimesh else null
		if mesh != null and mmi.material_override != null:
			for i in mesh.get_surface_count():
				_check(root, mmi, mesh, i, mmi.material_override, issues)
	for c in n.get_children():
		_walk(root, c, issues)


static func _check(root: Node, node: Node, mesh: Mesh, i: int, active: Material, issues: PackedStringArray) -> void:
	var orig := mesh.surface_get_material(i) as BaseMaterial3D
	if orig == null or orig.albedo_texture == null or active == null or active == orig:
		return
	## G-0019 — 일부러 단색 실루엣으로 칠하는 먼 배경(story_background: 대기 원근 색 한 장)은 노드에 이 메타를 달아 flat-tint 감사에서 뺀다.
	if node.has_meta("flat_silhouette"):
		return
	## G-0083 — 갑옷이 일부러 숨긴 머리카락·신발 표면(bone_gear.hide_surfaces)도 뺀다.
	if active.has_meta("gear_hidden"):
		return
	var orig_tex := orig.albedo_texture.resource_path
	## surface_get_format()은 ArrayMesh에만 있다 — 그 밖(PrimitiveMesh 등)은 정점색 없음.
	var has_color := false
	if mesh is ArrayMesh:
		has_color = ((mesh as ArrayMesh).surface_get_format(i) & Mesh.ARRAY_FORMAT_COLOR) != 0
	var orig_cut := orig.transparency != BaseMaterial3D.TRANSPARENCY_DISABLED

	var samples_tex := false
	var writes_alpha := false
	var active_tex := ""
	if active is ShaderMaterial:
		var sm := active as ShaderMaterial
		writes_alpha = sm.shader != null and sm.shader.code.contains("ALPHA")
		for p in ["albedo_texture", "alpha_texture"]:
			var t: Variant = sm.get_shader_parameter(p)
			if t is Texture2D:
				samples_tex = true
				if p == "albedo_texture":
					active_tex = (t as Texture2D).resource_path
	elif active is BaseMaterial3D:
		var bm := active as BaseMaterial3D
		## 완전 투명으로 일부러 숨긴 표면 — cel_shader_apply.gd 얼굴 베이크가 입·
		## 눈썹·아이라인 데칼 표면을 베이크 한 장으로 합친 뒤 이렇게 끈다.
		if bm.transparency != BaseMaterial3D.TRANSPARENCY_DISABLED and bm.albedo_color.a <= 0.001 and bm.albedo_texture == null:
			return
		samples_tex = bm.albedo_texture != null
		active_tex = bm.albedo_texture.resource_path if samples_tex else ""
		writes_alpha = bm.transparency != BaseMaterial3D.TRANSPARENCY_DISABLED

	var where := "%s surf%d (%s)" % [root.get_path_to(node), i, orig_tex.get_file()]
	if not samples_tex and not has_color:
		issues.append("flat-tint %s — 원본 텍스처를 버렸는데 정점색도 없어 단색으로 그려진다" % where)
	if orig_cut and not writes_alpha:
		issues.append("alpha-dropped %s — 원본 알파 컷을 덮는 재질이 알파를 안 쓴다(카드가 네모판)" % where)
	if active_tex != "" and orig_tex != "" and active_tex != orig_tex:
		var allowed := false
		for key: String in FOREIGN_TEXTURE_ALLOW:
			if key in active_tex:
				allowed = true
		if not allowed:
			issues.append("foreign-texture %s — 원본과 다른 텍스처 %s" % [where, active_tex.get_file()])
