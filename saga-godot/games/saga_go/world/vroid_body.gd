extends RefCounted

## PLAN 106장 ④ — 역사 인물·주민·도적을 캡슐/Kenney 블록에서 VRoid 몸으로.
## 이 저장소에 있는 VRoid 셋(플레이어 몫 AvatarSample_A 는 빼고 둘)을 쓰고,
## 인물마다 머리·옷 색을 id 해시로 바꿔(셀 셰이더 albedo_tint) 같은 몸이라도
## 구별되게 한다. ★5 는 가장자리 빛(rim)을 금색으로 — 원신의 "전설 등급" 신호.
## 얼굴·피부는 건드리지 않는다. 주역 전용 조형은 사람 몫(VRoid Studio)이다.

const CelShaderApply := preload("res://saga_core/shaders/cel_shader_apply.gd")

## 2026-09-29 사용자 결정 "새 공방 몸으로 교체"(char-forge 2단계) — VRoid 둘 → 공방 몸(CC0, 동작 여덟이 몸에 들어 있어 lib 없음).
## 키는 옛 몸과 같게(여 1.57m·남 1.78m 원본 → 약 1.70m).
## 09-29 마을 사람 몸 여섯(tools/char-forge/recipes/npc_*.json — 농부 남 둘·노인·두건 나그네·농부 여·짧은 머리 순찰자 여, 조각을 한 메시로 합침).
## 플레이어 몸(cmp_*)은 여기 안 쓴다 — 조각 몸이라 여럿 세우면 draw call 이 크다. 레시피 키(1.60~1.78m) 그대로 — 사람마다 키가 다르게.
## boost = 옷빛 곱(어두운 가죽 순찰자 옷은 크게, 밝은 농부 옷은 조금).
const BODIES := [
	{"glb": "res://assets/characters_cf/npc_m_peasant_01.glb", "scale": 1.0, "lib": "", "boost": 1.3},
	{"glb": "res://assets/characters_cf/npc_m_peasant_02.glb", "scale": 1.0, "lib": "", "boost": 1.3},
	{"glb": "res://assets/characters_cf/npc_m_elder_01.glb", "scale": 1.0, "lib": "", "boost": 1.3},
	{"glb": "res://assets/characters_cf/npc_m_hood_01.glb", "scale": 1.0, "lib": "", "boost": 2.1},
	{"glb": "res://assets/characters_cf/npc_f_peasant_01.glb", "scale": 1.0, "lib": "", "boost": 1.3},
	{"glb": "res://assets/characters_cf/npc_f_ranger_01.glb", "scale": 1.0, "lib": "", "boost": 2.1},
]
const HEAD_BONES := ["J_Bip_C_Head", "Head"]
const NECK_BONES := ["J_Bip_C_Neck", "neck_01"]
const LOOP_CLIPS := ["idle", "walk", "sprint"]

const HAIR_TINTS := [
	Color(1, 1, 1), Color(0.55, 0.45, 0.4), Color(0.4, 0.42, 0.55), Color(1.0, 0.85, 0.7),
	Color(0.75, 0.55, 0.5), Color(0.6, 0.7, 0.85), Color(0.35, 0.33, 0.35), Color(0.9, 0.75, 0.95),
]
const CLOTH_TINTS := [
	Color(1, 1, 1), Color(0.85, 0.45, 0.4), Color(0.45, 0.6, 0.9), Color(0.5, 0.8, 0.55),
	Color(0.9, 0.8, 0.45), Color(0.65, 0.5, 0.85), Color(0.55, 0.55, 0.6), Color(0.95, 0.65, 0.4),
]
const GOLD_RIM := Color(1.0, 0.82, 0.35)

## 같은 id 는 늘 같은 몸·색. rarity 5 면 금 테두리. cloth_override 가 있으면 옷색을 그걸로
## (도적 = 검붉은 옷처럼 무리 전체를 한 색으로 묶을 때).
static func build(id: String, rarity: int = 3, cloth_override: Variant = null) -> Node3D:
	var h := _hash(id)
	var body: Dictionary = BODIES[h % BODIES.size()]
	var v := (load(body.glb) as PackedScene).instantiate() as Node3D
	v.scale = Vector3.ONE * float(body.scale)
	## 2026-09-24 — saga_forest_avatar_01 은 뼈대 공간 앞이 -Z(VRM 1.0 식)라, 부르는 쪽이 모두 "앞 = +Z"로
	## 돌리던(atan2(x, z)) 인물·도적이 등을 보이며 걸었다. 안쪽 자식을 Y축 180° 돌려 돌려주는 몸은 늘 +Z 를 보게 한다
	## (애니 트랙은 "Skeleton3D:뼈" 경로라 안 바뀐다. 뼈대 공간 자체는 그대로 -Z 라 뼈에 뭘 붙일 땐 front_sign 을 본다).
	var skels := v.find_children("*", "Skeleton3D", true, false)
	if not skels.is_empty() and front_sign(skels[0]) < 0.0:
		for c in v.get_children():
			if c is Node3D:
				(c as Node3D).transform = Transform3D(Basis(Vector3.UP, PI), Vector3.ZERO) * (c as Node3D).transform
	CelShaderApply.apply_to(v)
	tune_lod(v)
	## 부르는 쪽이 또 apply_to 하면 얼굴 베이크가 두 번 덮여 단색이 된다(재질 감사 flat-tint).
	v.set_meta("cel_applied", true)
	var hair: Color = HAIR_TINTS[(h >> 3) % HAIR_TINTS.size()]
	var cloth: Color = cloth_override if cloth_override != null else CLOTH_TINTS[(h >> 7) % CLOTH_TINTS.size()]
	## 공방 몸 옷 그림은 어두운 가죽이라 곱하기만 하면 모두 검은 무리가 된다 — 옷빛을 밝혀(1 넘게) 색이 보이게.
	var boost := float(body.get("boost", 1.0))
	if boost != 1.0:
		cloth = Color(cloth.r * boost, cloth.g * boost, cloth.b * boost)
		hair = Color(hair.r * 1.3, hair.g * 1.3, hair.b * 1.3)
	_tint(v, hair, cloth, rarity >= 5)
	var ap: AnimationPlayer = v.get_node_or_null("AnimationPlayer") as AnimationPlayer
	if String(body.lib) != "" or ap == null:
		ap = AnimationPlayer.new()
		ap.name = "AnimationPlayer"
		v.add_child(ap)
		ap.add_animation_library("", load(body.lib))
	for c in LOOP_CLIPS:
		if ap.has_animation(c):
			ap.get_animation(c).loop_mode = Animation.LOOP_LINEAR
	if ap.has_animation("idle"):
		ap.play("idle")
		## 무리가 박자 맞춰 숨쉬지 않게 시작점을 어긋낸다.
		ap.seek(float(h % 100) / 100.0 * ap.current_animation_length, true)
	return v

## 뼈대 공간에서 몸 앞이 +Z 면 1, -Z 면 -1 — 오른발목 → 발끝 쉬는 자세 방향(뼈가 없으면 1).
static func front_sign(skel: Skeleton3D) -> float:
	var foot := find_bone_of(skel, ["J_Bip_R_Foot", "foot_r"])
	var toe := find_bone_of(skel, ["J_Bip_R_ToeBase", "ball_r"])
	if foot < 0 or toe < 0:
		return 1.0
	return -1.0 if skel.get_bone_global_rest(toe).origin.z < skel.get_bone_global_rest(foot).origin.z else 1.0

## 09-29 — 마을 사람 몸(조각을 한 메시로 합친 npc_*)은 한 덩어리라 자동 LOD 가 덜 걸린다 — LOD 를 당겨 쓴다.
## (플레이어 몸은 조각 그대로라 안 건다 — 합친 플레이어 몸은 PERF 포구·폐허 삼각형 +9만이었다.)
const BODY_LOD_BIAS := 0.1
static func tune_lod(root: Node) -> void:
	for mi in root.find_children("*", "MeshInstance3D", true, false):
		(mi as MeshInstance3D).lod_bias = BODY_LOD_BIAS

## 뼈 이름 후보 중 먼저 있는 것(VRoid J_Bip_* · 공방 몸 UE 식).
static func find_bone_of(skel: Skeleton3D, names: Array) -> int:
	for n in names:
		var i := skel.find_bone(String(n))
		if i >= 0:
			return i
	return -1

## 뼈에 붙이되 자식의 좌표축은 몸(뼈대 공간) 축 — 쉬는 자세 뼈 회전을 되돌린다.
## VRoid 뼈는 쉬는 자세 회전이 없어 예전과 같고, 공방 몸(뼈마다 축이 기운 UE 식)도 같은 오프셋이 같은 자리에 온다.
static func _bone_anchor(skel: Skeleton3D, bone: int) -> Node3D:
	var att := BoneAttachment3D.new()
	att.bone_idx = bone
	skel.add_child(att)
	var anchor := Node3D.new()
	anchor.name = "Anchor"
	anchor.transform = Transform3D(skel.get_bone_global_rest(bone).basis.orthonormalized().inverse(), Vector3.ZERO)
	att.add_child(anchor)
	return anchor

static func _tint(root: Node, hair: Color, cloth: Color, gold: bool) -> void:
	for mi in root.find_children("*", "MeshInstance3D", true, false):
		var m := (mi as MeshInstance3D).mesh
		if m == null:
			continue
		for i in m.get_surface_count():
			var src := m.surface_get_material(i)
			var over := (mi as MeshInstance3D).get_surface_override_material(i) as ShaderMaterial
			if src == null or over == null:
				continue
			var n := src.resource_name.to_upper() # VRoid "…HAIR…" · 공방 "hair_2"·"cloth_a"
			var base: Color = over.get_shader_parameter("albedo_tint")
			if n.contains("HAIR"):
				over.set_shader_parameter("albedo_tint", base * hair)
			elif n.contains("CLOTH"):
				over.set_shader_parameter("albedo_tint", base * cloth)
			if gold:
				over.set_shader_parameter("rim_color", GOLD_RIM)
				over.set_shader_parameter("rim_strength", 0.55)

static func _hash(id: String) -> int:
	var h := 7
	for i in id.length():
		h = (h * 131 + id.unicode_at(i)) & 0x7fffffff
	return h

## 가면 — 머리 뼈에 붙인다(뼈를 못 찾으면 몸 앞 얼굴 높이). 눈구멍 둘·줄 하나. 이야기 나그네(흰 가면·붉은 줄, world/story_quest.gd)·
## 검은 가면(field_enemy black_mask, 검은 가면·보랏빛 줄)이 쓴다.
## crack — 왼쪽 눈가에 흰 금(106장 ㉞ 7장 "금 간 검은 가면").
static func add_mask(body: Node3D, stripe: Color = Color(0.72, 0.12, 0.12), face_col: Color = Color(0.94, 0.92, 0.86), crack := false) -> void:
	var mask := Node3D.new()
	mask.name = "Mask"
	var skel := body.find_children("*", "Skeleton3D", true, false)
	var head := -1
	if not skel.is_empty():
		head = find_bone_of(skel[0], HEAD_BONES)
	if head >= 0:
		_bone_anchor(skel[0], head).add_child(mask)
		## 뼈대 공간 앞이 -Z 인 몸(saga_forest_avatar_01)이면 가면도 뒤집어 얼굴 쪽에.
		var front := front_sign(skel[0])
		mask.position = Vector3(0.0, 0.07, 0.085 * front)
		mask.rotation.y = 0.0 if front > 0.0 else PI
	else:
		body.add_child(mask)
		mask.position = Vector3(0.0, 1.52, 0.1)
	var face := MeshInstance3D.new()
	var sm := SphereMesh.new()
	sm.radius = 0.1
	sm.height = 0.24
	face.mesh = sm
	face.scale = Vector3(1.0, 1.0, 0.35)
	var white := StandardMaterial3D.new()
	white.albedo_color = face_col
	white.roughness = 0.6
	face.material_override = white
	mask.add_child(face)
	var dark := StandardMaterial3D.new()
	dark.albedo_color = Color(0.06, 0.05, 0.06)
	var red := StandardMaterial3D.new()
	red.albedo_color = stripe
	for i in 3:
		var dot := MeshInstance3D.new()
		var bm := BoxMesh.new()
		bm.size = Vector3(0.035, 0.014, 0.01) if i < 2 else Vector3(0.012, 0.12, 0.01)
		dot.mesh = bm
		dot.material_override = dark if i < 2 else red
		dot.position = Vector3(-0.04 + 0.08 * i, 0.03, 0.036) if i < 2 else Vector3(0.0, -0.01, 0.037)
		mask.add_child(dot)
	if crack:
		var pale := StandardMaterial3D.new()
		pale.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
		pale.albedo_color = Color(0.88, 0.84, 0.96)
		for k in 2:
			var cr := MeshInstance3D.new()
			var cm := BoxMesh.new()
			cm.size = Vector3(0.008, 0.075, 0.01)
			cr.mesh = cm
			cr.material_override = pale
			cr.name = "Crack%d" % k
			cr.position = Vector3(-0.055, 0.035, 0.037) if k == 0 else Vector3(-0.042, -0.035, 0.036)
			cr.rotation.z = 0.5 if k == 0 else -0.45
			mask.add_child(cr)

## 106장 ㊳ 왕관 — 머리 뼈 위(먹구름 임금). 금빛 테 하나 + 뿔 다섯. 뼈를 못 찾으면 몸 위 머리 높이.
static func add_crown(body: Node3D, gold: Color = Color(0.9, 0.74, 0.3)) -> void:
	var crown := Node3D.new()
	crown.name = "Crown"
	var skel := body.find_children("*", "Skeleton3D", true, false)
	var head := -1
	if not skel.is_empty():
		head = find_bone_of(skel[0], HEAD_BONES)
	if head >= 0:
		_bone_anchor(skel[0], head).add_child(crown)
		crown.position = Vector3(0.0, 0.17, 0.0)
	else:
		body.add_child(crown)
		crown.position = Vector3(0.0, 1.72, 0.0)
	var mat := StandardMaterial3D.new()
	mat.albedo_color = gold
	mat.metallic = 0.7
	mat.roughness = 0.35
	var band := MeshInstance3D.new()
	var tm := TorusMesh.new()
	tm.inner_radius = 0.085
	tm.outer_radius = 0.11
	band.mesh = tm
	band.material_override = mat
	crown.add_child(band)
	for i in 5:
		var a := TAU * i / 5.0
		var sp := MeshInstance3D.new()
		var cm := CylinderMesh.new()
		cm.top_radius = 0.0
		cm.bottom_radius = 0.022
		cm.height = 0.09
		cm.radial_segments = 6
		sp.mesh = cm
		sp.material_override = mat
		sp.position = Vector3(cos(a) * 0.098, 0.05, sin(a) * 0.098)
		crown.add_child(sp)

## 106장 ㊺-3 옛 장수 투구 — 머리 뼈 위(산성지기 바우, 과거). 쇠 사발 + 챙 + 꼭대기 붉은 술. 뼈를 못 찾으면 몸 위 머리 높이.
static func add_helmet(body: Node3D, iron: Color = Color(0.36, 0.35, 0.36), tassel: Color = Color(0.72, 0.16, 0.14)) -> void:
	var helm := Node3D.new()
	helm.name = "Helmet"
	var skel := body.find_children("*", "Skeleton3D", true, false)
	var head := -1
	if not skel.is_empty():
		head = find_bone_of(skel[0], HEAD_BONES)
	if head >= 0:
		_bone_anchor(skel[0], head).add_child(helm)
		helm.position = Vector3(0.0, 0.1, 0.0)
	else:
		body.add_child(helm)
		helm.position = Vector3(0.0, 1.66, 0.0)
	var mat := StandardMaterial3D.new()
	mat.albedo_color = iron
	mat.metallic = 0.6
	mat.roughness = 0.45
	var bowl := MeshInstance3D.new()
	var sm := SphereMesh.new()
	sm.radius = 0.14
	sm.height = 0.16
	sm.is_hemisphere = true
	bowl.mesh = sm
	bowl.material_override = mat
	helm.add_child(bowl)
	var brim := MeshInstance3D.new()
	var bm := CylinderMesh.new()
	bm.top_radius = 0.16
	bm.bottom_radius = 0.17
	bm.height = 0.018
	brim.mesh = bm
	brim.material_override = mat
	helm.add_child(brim)
	var spike := MeshInstance3D.new()
	var km := CylinderMesh.new()
	km.top_radius = 0.0
	km.bottom_radius = 0.018
	km.height = 0.08
	km.radial_segments = 6
	spike.mesh = km
	spike.material_override = mat
	spike.position = Vector3(0.0, 0.2, 0.0)
	helm.add_child(spike)
	var red := StandardMaterial3D.new()
	red.albedo_color = tassel
	var tuft := MeshInstance3D.new()
	var tm := SphereMesh.new()
	tm.radius = 0.04
	tm.height = 0.11
	tuft.mesh = tm
	tuft.material_override = red
	tuft.position = Vector3(0.0, 0.25, 0.0)
	helm.add_child(tuft)

## 106장 ㊼-2 앞 시대 관측 바이저 — 머리 뼈 위(시간 틈 관측사 가온, 미래). 은빛 머리띠 + 눈앞 청록 빛 띠 + 한쪽 귀 안테나.
## 뼈대 앞이 -Z 인 몸이면 가면(add_mask)처럼 뒤집는다. 뼈를 못 찾으면 몸 위 눈 높이.
static func add_visor(body: Node3D, metal: Color = Color(0.78, 0.8, 0.84), glow: Color = Color(0.35, 0.95, 0.9)) -> void:
	var visor := Node3D.new()
	visor.name = "Visor"
	var skel := body.find_children("*", "Skeleton3D", true, false)
	var head := -1
	if not skel.is_empty():
		head = find_bone_of(skel[0], HEAD_BONES)
	if head >= 0:
		_bone_anchor(skel[0], head).add_child(visor)
		var front := front_sign(skel[0])
		visor.position = Vector3(0.0, 0.07, 0.0)
		visor.rotation.y = 0.0 if front > 0.0 else PI
	else:
		body.add_child(visor)
		visor.position = Vector3(0.0, 1.52, 0.0)
	var mat := StandardMaterial3D.new()
	mat.albedo_color = metal
	mat.metallic = 0.8
	mat.roughness = 0.3
	var band := MeshInstance3D.new()
	var tm := TorusMesh.new()
	tm.inner_radius = 0.1
	tm.outer_radius = 0.118
	band.mesh = tm
	band.material_override = mat
	band.scale = Vector3(1.0, 1.4, 1.1)
	visor.add_child(band)
	var lit := StandardMaterial3D.new()
	lit.albedo_color = glow
	lit.emission_enabled = true
	lit.emission = glow
	lit.emission_energy_multiplier = 1.6
	var shield := MeshInstance3D.new()
	var bm := BoxMesh.new()
	bm.size = Vector3(0.17, 0.035, 0.012)
	shield.mesh = bm
	shield.material_override = lit
	shield.position = Vector3(0.0, 0.0, 0.122)
	visor.add_child(shield)
	var ant := MeshInstance3D.new()
	var cm := CylinderMesh.new()
	cm.top_radius = 0.004
	cm.bottom_radius = 0.008
	cm.height = 0.12
	cm.radial_segments = 6
	ant.mesh = cm
	ant.material_override = mat
	ant.position = Vector3(0.115, 0.06, 0.0)
	ant.rotation.z = -0.25
	visor.add_child(ant)
	var tip := MeshInstance3D.new()
	var sm := SphereMesh.new()
	sm.radius = 0.014
	sm.height = 0.028
	tip.mesh = sm
	tip.material_override = lit
	tip.position = Vector3(0.13, 0.12, 0.0)
	visor.add_child(tip)

## 106장 ㊼-3 파발꾼 벙거지 — 머리 뼈 위(파발꾼 달음, 과거). 검은 펠트 둥근 몸 + 넓고 처진 챙 + 붉은 띠 + 뒤로 늘어진 붉은 끈 둘.
## 뼈대 앞이 -Z 인 몸이면 뒤집는다(끈이 등 쪽에 오게). 뼈를 못 찾으면 몸 위 머리 높이.
static func add_hat(body: Node3D, felt: Color = Color(0.12, 0.11, 0.12), band: Color = Color(0.72, 0.14, 0.12)) -> void:
	var hat := Node3D.new()
	hat.name = "Hat"
	var skel := body.find_children("*", "Skeleton3D", true, false)
	var head := -1
	if not skel.is_empty():
		head = find_bone_of(skel[0], HEAD_BONES)
	if head >= 0:
		_bone_anchor(skel[0], head).add_child(hat)
		var front := front_sign(skel[0])
		hat.position = Vector3(0.0, 0.13, 0.0)
		hat.rotation.y = 0.0 if front > 0.0 else PI
	else:
		body.add_child(hat)
		hat.position = Vector3(0.0, 1.69, 0.0)
	var fm := StandardMaterial3D.new()
	fm.albedo_color = felt
	fm.roughness = 0.9
	var dome := MeshInstance3D.new()
	var sm := SphereMesh.new()
	sm.radius = 0.12
	sm.height = 0.14
	sm.is_hemisphere = true
	dome.mesh = sm
	dome.material_override = fm
	hat.add_child(dome)
	var brim := MeshInstance3D.new()
	var bm := CylinderMesh.new()
	bm.top_radius = 0.2
	bm.bottom_radius = 0.26
	bm.height = 0.03
	brim.mesh = bm
	brim.material_override = fm
	brim.position = Vector3(0.0, -0.01, 0.0)
	hat.add_child(brim)
	var red := StandardMaterial3D.new()
	red.albedo_color = band
	var ring := MeshInstance3D.new()
	var rm := CylinderMesh.new()
	rm.top_radius = 0.123
	rm.bottom_radius = 0.123
	rm.height = 0.025
	ring.mesh = rm
	ring.material_override = red
	ring.position = Vector3(0.0, 0.02, 0.0)
	hat.add_child(ring)
	for k in [-1.0, 1.0]:
		var tail := MeshInstance3D.new()
		var tm := BoxMesh.new()
		tm.size = Vector3(0.025, 0.2, 0.006)
		tail.mesh = tm
		tail.material_override = red
		tail.position = Vector3(k * 0.035, -0.08, -0.2)
		tail.rotation = Vector3(-0.35, 0.0, k * 0.12)
		hat.add_child(tail)

## 106장 ㊽-2 머리 위 빛 고리 — 머리 뼈 위(나루지기 아라, 미래). 머리 위 떠 있는 청백 빛 고리 + 양쪽 귀 옆 작은 빛 조각 둘.
## 뼈를 못 찾으면 몸 위 머리 높이. 고리는 몸 앞뒤와 무관(둥글다)이라 뒤집지 않는다.
static func add_halo(body: Node3D, glow: Color = Color(0.6, 0.85, 1.0)) -> void:
	var halo := Node3D.new()
	halo.name = "Halo"
	var skel := body.find_children("*", "Skeleton3D", true, false)
	var head := -1
	if not skel.is_empty():
		head = find_bone_of(skel[0], HEAD_BONES)
	if head >= 0:
		_bone_anchor(skel[0], head).add_child(halo)
		halo.position = Vector3(0.0, 0.0, 0.0)
	else:
		body.add_child(halo)
		halo.position = Vector3(0.0, 1.5, 0.0)
	var lit := StandardMaterial3D.new()
	lit.albedo_color = glow
	lit.emission_enabled = true
	lit.emission = glow
	lit.emission_energy_multiplier = 1.8
	var ring := MeshInstance3D.new()
	var tm := TorusMesh.new()
	tm.inner_radius = 0.11
	tm.outer_radius = 0.13
	ring.mesh = tm
	ring.material_override = lit
	ring.position = Vector3(0.0, 0.28, 0.0)
	halo.add_child(ring)
	for k in [-1.0, 1.0]:
		var bit := MeshInstance3D.new()
		var bm := BoxMesh.new()
		bm.size = Vector3(0.012, 0.05, 0.03)
		bit.mesh = bm
		bit.material_override = lit
		bit.position = Vector3(k * 0.1, 0.05, 0.0)
		halo.add_child(bit)

## 106장 ㊽-3 종지기 염주·가사 띠 — 목 뼈(종지기 한결, 과거). 목에 늘어진 굵은 나무 염주(앞이 처지게 기울임) +
## 왼 어깨에서 오른 옆구리로 가로지른 붉은 가사 띠. 뼈대 앞이 -Z 인 몸이면 뒤집는다. 뼈를 못 찾으면 몸 위 목 높이.
static func add_beads(body: Node3D, wood: Color = Color(0.36, 0.22, 0.12), sash: Color = Color(0.62, 0.2, 0.12)) -> void:
	var beads := Node3D.new()
	beads.name = "Beads"
	var skel := body.find_children("*", "Skeleton3D", true, false)
	var neck := -1
	if not skel.is_empty():
		neck = find_bone_of(skel[0], NECK_BONES)
	if neck >= 0:
		_bone_anchor(skel[0], neck).add_child(beads)
		beads.rotation.y = 0.0 if front_sign(skel[0]) > 0.0 else PI
	else:
		body.add_child(beads)
		beads.position = Vector3(0.0, 1.42, 0.0)
	var wm := StandardMaterial3D.new()
	wm.albedo_color = wood
	wm.roughness = 0.7
	var ring := Node3D.new()
	ring.position = Vector3(0.0, -0.02, 0.01)
	ring.rotation.x = 0.55 # 앞이 가슴 쪽으로 처지게
	beads.add_child(ring)
	for i in 16:
		var a := TAU * float(i) / 16.0
		var b := MeshInstance3D.new()
		var sm := SphereMesh.new()
		sm.radius = 0.02 if i != 0 else 0.03 # 앞 한가운데 큰 알
		sm.height = sm.radius * 2.0
		sm.radial_segments = 8
		sm.rings = 4
		b.mesh = sm
		b.material_override = wm
		b.position = Vector3(sin(a) * 0.11, 0.0, cos(a) * 0.1)
		ring.add_child(b)
	var sm2 := StandardMaterial3D.new()
	sm2.albedo_color = sash
	var band := MeshInstance3D.new()
	var bm := BoxMesh.new()
	bm.size = Vector3(0.07, 0.5, 0.012)
	band.mesh = bm
	band.material_override = sm2
	band.position = Vector3(0.0, -0.24, 0.1)
	band.rotation.z = 0.62
	beads.add_child(band)

## 106장 ㊽-4 기관사 고글 — 머리 뼈 이마 위(기관사 도담, 현대). 검은 끈에 둥근 렌즈 둘(구리 테·옅은 푸른 유리)을 이마에 올려 쓴다.
## 뼈대 앞이 -Z 인 몸이면 뒤집는다(렌즈가 이마 앞에 오게). 뼈를 못 찾으면 몸 위 머리 높이.
static func add_goggles(body: Node3D, rim: Color = Color(0.72, 0.45, 0.22), glass: Color = Color(0.55, 0.8, 0.9)) -> void:
	var gog := Node3D.new()
	gog.name = "Goggles"
	var skel := body.find_children("*", "Skeleton3D", true, false)
	var head := -1
	if not skel.is_empty():
		head = find_bone_of(skel[0], HEAD_BONES)
	if head >= 0:
		_bone_anchor(skel[0], head).add_child(gog)
		gog.position = Vector3(0.0, 0.12, 0.0)
		gog.rotation.y = 0.0 if front_sign(skel[0]) > 0.0 else PI
	else:
		body.add_child(gog)
		gog.position = Vector3(0.0, 1.68, 0.0)
	var strap_m := StandardMaterial3D.new()
	strap_m.albedo_color = Color(0.1, 0.1, 0.11)
	var strap := MeshInstance3D.new()
	var tm := TorusMesh.new()
	tm.inner_radius = 0.105
	tm.outer_radius = 0.118
	strap.mesh = tm
	strap.material_override = strap_m
	strap.rotation.x = 0.25 # 앞이 살짝 내려오게
	gog.add_child(strap)
	var rm := StandardMaterial3D.new()
	rm.albedo_color = rim
	rm.metallic = 0.8
	rm.roughness = 0.35
	var gm := StandardMaterial3D.new()
	gm.albedo_color = glass
	gm.metallic = 0.3
	gm.roughness = 0.1
	for k in [-1.0, 1.0]:
		var lens := MeshInstance3D.new()
		var cm := CylinderMesh.new()
		cm.top_radius = 0.034
		cm.bottom_radius = 0.034
		cm.height = 0.03
		lens.mesh = cm
		lens.material_override = rm
		lens.rotation.x = PI * 0.5 + 0.25
		lens.position = Vector3(k * 0.042, -0.02, 0.112)
		gog.add_child(lens)
		var g := MeshInstance3D.new()
		var sm := SphereMesh.new()
		sm.radius = 0.028
		sm.height = 0.02
		g.mesh = sm
		g.material_override = gm
		g.rotation.x = PI * 0.5 + 0.25
		g.position = Vector3(k * 0.042, -0.016, 0.127)
		gog.add_child(g)
