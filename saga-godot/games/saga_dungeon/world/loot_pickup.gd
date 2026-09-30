extends RefCounted

## VERTICAL_SLICE_DUNGEON.md 5절 — "노획". dungeon_enemy.gd가 죽을 때 이
## 정적 헬퍼로 하나 세운다(toast.gd·choice_prompt.gd와 같은 "여러 곳이
## 필요로 하면 공용 헬퍼로 뽑는다" 경계).
##
## "제외" 목록 3번(장비 등급+접사) 이후 — DungeonItems.roll()로 등급+접사가
## 있는 물건을 굴려 즉시 장착한다(가방이 없어 줍는 즉시 갈아 든다).
##
## "제외" 목록 2번(소켓+부문어·투장·내구) — roll()이 이제 무기·부적을
## 안 가리고 굴리므로(웹판 dropItem()과 같은 방식) **어느 부위가 나왔는지
## 보고** 장착한다(2026-09-14부터 갑주도 같은 풀에 섞여 나온다 —
## DungeonEquipmentState.equip(slot_name, it) 하나로 세 부위 다 받는다).
## 또 dungeon.js::dropMat()의 부문(룬) 갈래를 옮겨,
## 같은 킬에 독립된 확률로 부문 하나가 따로 떨어질 수 있다(재료는 즉시
## 주머니로 — 웹판과 같은 규칙, "노획물 정산"을 안 탄다).
##
## "제외" 목록 4번(원소 6결+저항) — dropMat()이 실은 부문 하나만이 아니라
## **주옥(4층부터)·부문·보석 셋 중 하나**를 낸다(DungeonItems.roll_material_drop()).
## 아래 MAT_DROP_CHANCE(옛 RUNE_DROP_CHANCE)는 그 바깥 확률(잡졸 12%) 그대로 —
## 이름만 실제로 나오는 세 갈래를 가리키게 바꿨다.
##
## "제외" 목록 3번(행상/투전/연단·단약/요대·감정·창고) — dungeon.js의
## 잡졸 킬 드롭 표(2481~2498줄)를 그대로 옮겨 **금·단약·감정서**를
## 더했다. 이때 발견한 오차 하나 — **"부문(룬)" 확률을 이전에 잘못
## 옮겼었다.** 원작은 이중 구조다: 먼저 dropMat() 자체가 불릴 확률
## (잡졸 12%)이 있고, dropMat() 안에서야 주옥(floor<4는 없음)·룬(22%)·
## 보석(나머지) 셋으로 갈린다 — 즉 실제 룬 드롭률은 0.12×0.22≈2.6%인데
## 이전 세션은 안쪽 22%만 보고 그걸 바깥 확률로 썼다(실제로는 8배 더
## 자주 나오고 있었다). 우리는 보석·주옥이 아예 없으니 "재료 드롭이
## 일어나면(12%) 늘 룬"으로 단순화해 고쳤다 — 안쪽 22%를 licensing 버리지
## 않고 "우리가 가진 유일한 재료로 수렴시킨다"는 뜻.
##
## 잡졸(정예·보스 아님) 기준 확률 그대로: 금은 확정, 룬 12%, 단약 16%,
## 감정서 7%. 장비 드롭은 이전 세션에서 이미 "매번 확정"으로 잡아 뒀던
## 것을 그대로 둔다(원작의 0.2~0.35 확률보다 후하지만, 이미 검증·커밋된
## 동작을 이번 범위 밖에서 바꾸지 않는다).
##
## "제외" 목록 7번(보스층) — dungeon.js kill()의 `e.boss` 갈래 그대로:
## 금 ×5(dropGold mul), 재료·단약·감정서 드롭 확률이 0.9/1/0.8로 뛰고,
## 장비·재료는 ilvl에 +30(dropItem/dropMat의 `e.boss?30:0`)이 붙어 같은
## 층에서도 훨씬 센 물건이 나온다.

const Toast := preload("res://saga_core/ui/toast.gd")
const GLBUtils := preload("res://saga_core/world/glb_utils.gd")
const OUTLINE_SHADER := preload("res://saga_core/shaders/cel_outline.gdshader")
const LEGENDARY_TIER_KEY := 4 # DungeonItems.TIERS[4] == "전설"

## 2026-09-20 — 101-3 G "성장 가시화". 무기 노획물은 등급색 박스 대신
## KayKit 무기 GLB(103-3 킷배싱, ASSET_GUIDE 해당 날짜)를 쓴다. dungeon_
## items.gd BASES의 `look` 값(sword/axe/club/spear/halberd/guandao/
## bow/fan/brush/scroll/staff)을 확보한 4종(sword_1handed·axe_1handed·
## dagger·staff)으로 근사 매핑한 첫 시안 — 정확한 1:1 대응은 아니고
## "무기라는 게 보인다" 수준. 등급은 DungeonItems TIERS.key(0~4)와 그대로
## 맞아떨어진다.
##
## **전부 `preload()`로 미리 싣는다** — `_spawn_chest()`처럼 굴림 결과에
## 따라 무기 종류·등급이 갈리는 자리에서 그때그때 `load(path)`를 부르면
## `--verbose` 헤드리스 로그에 실제로 읽은 파일명이 그대로 찍혀 굴림마다
## 로그가 달라지고 `godot_regress.sh`의 md5 비교가 깨진다(2026-09-20 발견
## — GLBUtils.extract_mesh_from_scene 헤더 참고). `preload`는 이 스크립트가
## (const로) 불릴 때 20개 전부 항상 같은 순서로 실리므로 로그가 결정적이다.
const WEAPON_GLB_SCENES := {
	"sword_1handed": [
		preload("res://assets/generated/variants/sword_1handed__g0.glb"),
		preload("res://assets/generated/variants/sword_1handed__g1.glb"),
		preload("res://assets/generated/variants/sword_1handed__g2.glb"),
		preload("res://assets/generated/variants/sword_1handed__g3.glb"),
		preload("res://assets/generated/variants/sword_1handed__g4.glb"),
	],
	"axe_1handed": [
		preload("res://assets/generated/variants/axe_1handed__g0.glb"),
		preload("res://assets/generated/variants/axe_1handed__g1.glb"),
		preload("res://assets/generated/variants/axe_1handed__g2.glb"),
		preload("res://assets/generated/variants/axe_1handed__g3.glb"),
		preload("res://assets/generated/variants/axe_1handed__g4.glb"),
	],
	"dagger": [
		preload("res://assets/generated/variants/dagger__g0.glb"),
		preload("res://assets/generated/variants/dagger__g1.glb"),
		preload("res://assets/generated/variants/dagger__g2.glb"),
		preload("res://assets/generated/variants/dagger__g3.glb"),
		preload("res://assets/generated/variants/dagger__g4.glb"),
	],
	"staff": [
		preload("res://assets/generated/variants/staff__g0.glb"),
		preload("res://assets/generated/variants/staff__g1.glb"),
		preload("res://assets/generated/variants/staff__g2.glb"),
		preload("res://assets/generated/variants/staff__g3.glb"),
		preload("res://assets/generated/variants/staff__g4.glb"),
	],
}
const WEAPON_LOOK_KIND := {
	"sword": "sword_1handed",
	"axe": "axe_1handed", "club": "axe_1handed", "guandao": "axe_1handed",
	"halberd": "staff", "spear": "staff", "staff": "staff",
	"bow": "dagger", "fan": "dagger", "brush": "dagger", "scroll": "dagger",
}
const WEAPON_PICKUP_LENGTH := 0.9 # 바닥에 눕혀 뜨는 목표 길이(m) — 원본 GLB는 손에 쥐는 비율(1.2~2.2m)이라 AABB 최장축 기준으로 역산해 맞춘다.
const TOAST_SEC := 4.0
const TRIGGER_RADIUS := 1.4
const MAT_DROP_CHANCE := 0.12 # dungeon.js "e.boss?0.9:0.12"(dropMat 호출 확률) 그대로
const POTION_DROP_CHANCE := 0.16 # dungeon.js "e.boss?1:(elK?0.34:0.16)" 그대로
const SCROLL_DROP_CHANCE := 0.07 # dungeon.js "e.boss?0.8:0.07" 그대로
const BOSS_MAT_DROP_CHANCE := 0.9
const BOSS_POTION_DROP_CHANCE := 1.0
const BOSS_SCROLL_DROP_CHANCE := 0.8
## "제외" 목록 7번(정예) — dungeon.js kill()의 elK 갈래 그대로: 금 2.2배,
## 장비 ilvl +14(보스는 +30), 단약 확률 34%(정예는 mat·감정서 확률·재료
## ilvl은 안 바뀐다 — 원작에 그 갈래가 없다, 새로 상상하지 않는다).
const ELITE_GOLD_MUL := 2.2
const ELITE_ILVL_BONUS := 14
const ELITE_POTION_DROP_CHANCE := 0.34
const RUNE_COLOR := Color(0.94, 0.65, 0.22) # dungeon.js take()의 룬 색('#f0a53a') 그대로
const JEWEL_COLOR := Color(0.94, 0.48, 0.75) # dungeon.js take()의 주옥 색('#f07ac0') 그대로
const GOLD_COLOR := Color(1.0, 0.84, 0.2)
const POTION_COLOR := Color(0.75, 0.22, 0.17) # potion.js KINDS.heal.color '#c0392b' 그대로
const SCROLL_COLOR := Color(0.56, 0.78, 1.0)
const GRAVE_COLOR := Color(0.35, 0.32, 0.42) # PLAN 101-2 DUNGEON ②(유품) — 직접 정함, 다른 노획과 안 헷갈리는 어두운 보라회색
const SIGIL_COLOR := Color(0.55, 0.18, 0.62) # PLAN 101-2 DUNGEON ④(부적 던전) — 직접 정함, 보라 계열(나이트메어 느낌)


## test_room.gd 'cave' 방(채광, POI: Cave) 전용 — dungeon.js dropMat()을
## 그대로 부르되 gold/item/potion/scroll 없이 재료 하나만 확정으로 내는
## 자리가 필요해 만들었다. `_spawn_mat()`(private)을 새로 안 베끼고
## 그대로 감싸기만 한다 — 이 파일 밖에서 드랍 확률 로직을 손대지 않는다.
static func spawn_mat_at(parent: Node, pos: Vector3, floor_num: int) -> void:
	_spawn_mat(parent, pos, floor_num)


## 101-3 G "등급 색 외곽선" — cel_outline.gdshader(102-3)의 outline_color만
## 등급 색으로 바꿔 그대로 재사용한다(주석에 적힌 예정대로). Player·NPC의
## next_pass 배선(cel_shader_apply.gd)과는 별개 경로 — 노획물은 텍스처가
## 없는 단색 재질이라 그쪽 함수가 아예 건너뛴다.
static func _outline_material(tier: Dictionary) -> ShaderMaterial:
	var outline := ShaderMaterial.new()
	outline.shader = OUTLINE_SHADER
	outline.set_shader_parameter("outline_color", Color(String(tier.color)))
	return outline


## 101-3 G "이펙트(전설 = 잔광 파티클 1)" — 이 저장소 최초의 파티클(다른
## 자리에 참고할 선례가 없어 값은 직접 정함, 실기로 밀도·속도 확인 필요).
## GPUParticles3D는 헤드리스 더미 렌더러의 컴퓨트 셰이더 지원이 불확실해
## 리스크를 낮추려 CPUParticles3D로 짠다(CPU 시뮬레이션이라 헤드리스에서도
## 안전). 전설 등급 노획물 하나에만 붙는다(잡졸·정예 드롭까지 번지면
## "색만 보고 줍는다"는 반사신경이 흐려진다).
static func _spawn_legendary_glow(area: Node3D, tier: Dictionary) -> void:
	var glow_mesh := SphereMesh.new()
	glow_mesh.radius = 0.035
	glow_mesh.height = 0.07
	var glow_mat := StandardMaterial3D.new()
	glow_mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	glow_mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	glow_mat.vertex_color_use_as_albedo = true
	glow_mat.emission_enabled = true
	glow_mat.emission = Color(String(tier.color))
	glow_mat.emission_energy_multiplier = 1.5
	glow_mesh.surface_set_material(0, glow_mat)

	var p := CPUParticles3D.new()
	p.name = "LegendaryGlow"
	p.position = Vector3(0, 0.5, 0)
	p.mesh = glow_mesh
	p.amount = 10
	p.lifetime = 1.4
	p.preprocess = 1.4 # 처음 보일 때부터 이미 도는 것처럼(빈 채로 시작 안 함)
	p.emission_shape = CPUParticles3D.EMISSION_SHAPE_SPHERE
	p.emission_sphere_radius = 0.12
	p.direction = Vector3(0, 1, 0)
	p.spread = 20.0
	p.gravity = Vector3(0, 0.15, 0) # 아래로 안 떨어지고 위로 살짝 떠오르는 "잔광"
	p.initial_velocity_min = 0.1
	p.initial_velocity_max = 0.25
	p.scale_amount_min = 0.5
	p.scale_amount_max = 1.0
	var glow_color := Color(String(tier.color))
	glow_color.a = 0.85
	p.color = glow_color
	area.add_child(p)


## PLAN 101-2 DUNGEON ⑥(월드 보스, 2026-09-17) — `legendary_mult`(기본
## 1.0)는 DungeonItems.roll()로 그대로 넘어간다(웹 5.4 "전설 확률×3").
static func spawn_at(parent: Node, pos: Vector3, ilvl: int, is_boss: bool = false, is_elite: bool = false, legendary_mult: float = 1.0) -> void:
	var ilvl_bonus := 30 if is_boss else (ELITE_ILVL_BONUS if is_elite else 0)
	var it := DungeonItems.roll(ilvl + ilvl_bonus, "", -1, false, legendary_mult)
	var tier: Dictionary = DungeonItems.TIERS[it.tier]
	var b := DungeonItems.base_by_key(str(it.base))
	var slot_name := str(b.get("slot", "weapon"))

	var area := Area3D.new()
	area.name = "LootPickup"
	area.position = pos

	var mi := MeshInstance3D.new()
	var weapon_kind: String = WEAPON_LOOK_KIND.get(str(b.get("look", "")), "")
	if slot_name == "weapon" and weapon_kind != "":
		var weapon_scene: PackedScene = WEAPON_GLB_SCENES[weapon_kind][it.tier]
		var weapon_mesh := GLBUtils.extract_mesh_from_scene(weapon_scene)
		if weapon_mesh != null:
			mi.mesh = weapon_mesh
			var longest: float = maxf(weapon_mesh.get_aabb().size.x, maxf(weapon_mesh.get_aabb().size.y, weapon_mesh.get_aabb().size.z))
			var s := WEAPON_PICKUP_LENGTH / longest
			## 원본은 손에 쥐는 자세(Y축이 날 방향)라 눕혀서(X축 90도) 바닥에
			## 뜬 노획물처럼 보이게 한다 — 다른 노획물과 같은 "hover" 자리.
			mi.transform = Transform3D(Basis(Vector3.RIGHT, PI * 0.5).scaled(Vector3.ONE * s), Vector3(0, 0.4, 0))
			## 101-3 G — GLB 자체에 이미 구운 등급색(tint-glb) 재질을 그대로 두고
			## 복제본에만 외곽선을 next_pass로 얹는다(공유 Mesh 리소스는 안 건드림).
			var base_mat := mi.get_active_material(0)
			if base_mat != null:
				var outlined := base_mat.duplicate() as Material
				outlined.next_pass = _outline_material(tier)
				mi.set_surface_override_material(0, outlined)
	if mi.mesh == null:
		var mesh := BoxMesh.new()
		mesh.size = Vector3(0.5, 0.5, 0.5)
		mi.mesh = mesh
		mi.position = Vector3(0, 0.4, 0)
		var mat := StandardMaterial3D.new()
		## 등급색 그대로(data-item.js 원작 색) — "색만 보고 줍는다"는 반사신경을
		## 이 슬라이스에서도 살린다. 무기는 GLB 자체가 이미 등급색으로 물들어
		## 있어(tint-glb) 이 material_override가 필요 없다.
		mat.albedo_color = Color(String(tier.color))
		mat.metallic = 0.4
		mat.next_pass = _outline_material(tier) # 101-3 G
		mi.material_override = mat
	area.add_child(mi)
	if it.tier == LEGENDARY_TIER_KEY:
		_spawn_legendary_glow(area, tier)

	var cs := CollisionShape3D.new()
	var shape := SphereShape3D.new()
	shape.radius = TRIGGER_RADIUS
	cs.shape = shape
	area.add_child(cs)

	parent.add_child(area)
	area.body_entered.connect(func(body: Node3D) -> void:
		if body.is_in_group("player"):
			DungeonEquipmentState.equip(slot_name, it)
			var lines := DungeonItems.item_lines(it)
			Toast.show(area, "🎁 %s · %s (%s)" % [tier.name, DungeonItems.item_name(it), " · ".join(lines)], TOAST_SEC)
			area.queue_free()
	)

	var gold_mul := 5.0 if is_boss else (ELITE_GOLD_MUL if is_elite else 1.0)
	_spawn_gold(parent, pos + Vector3(-0.6, 0, -0.6), ilvl, gold_mul)
	if randf() < (BOSS_MAT_DROP_CHANCE if is_boss else MAT_DROP_CHANCE):
		_spawn_mat(parent, pos + Vector3(0.6, 0, 0.6), ilvl + (30 if is_boss else 0))
	var potion_chance := BOSS_POTION_DROP_CHANCE if is_boss else (ELITE_POTION_DROP_CHANCE if is_elite else POTION_DROP_CHANCE)
	if randf() < potion_chance:
		_spawn_potion(parent, pos + Vector3(0.6, 0, -0.6), ilvl)
	if randf() < (BOSS_SCROLL_DROP_CHANCE if is_boss else SCROLL_DROP_CHANCE):
		_spawn_scroll(parent, pos + Vector3(-0.6, 0, 0.6))
	## PLAN 101-2 DUNGEON ④(부적 던전, 2026-09-17) — 웹 5.3 "층 10+ 보스"
	## 드랍을 옮기되, 이 슬라이스는 보스가 둘(3층·6층)뿐이라 층 문턱 없이
	## 보스마다 확률로 낸다(BOSS_SIGIL_DROP_CHANCE, 직접 정함). 티어는
	## floor_num을 그대로 쓴다(원작 "10+" 문턱이 이 슬라이스엔 안 맞아
	## 직접 정한 매핑 — dungeon_sigil_state.gd 헤더 참고).
	if is_boss and randf() < DungeonSigilState.BOSS_SIGIL_DROP_CHANCE:
		_spawn_sigil(parent, pos + Vector3(0, 0, -0.9), ilvl)


## dungeon.js dropGold() 공식 그대로 — 은사+장비 goldPct까지
## DungeonRunState.gold_mult()가 이미 합산해 준다. PLAN 101-2 DUNGEON ④
## (부적 던전) — 부적이 켜져 있으면 DungeonSigilState.gold_mult()(티어
## 배율+"treasure" 모드)까지 한 번 더 곱한다. PLAN 101-2 DUNGEON ⑥(월드
## 보스, 2026-09-17) — dungeon_worldboss_state.gd의 "도망 시 30%" 보상이
## 같은 계산을 재사용하려고 `_spawn_gold()`에서 뽑아냈다(동작 그대로).
static func gold_amount(floor_num: int, mul: float = 1.0) -> int:
	return int(roundf(5.0 * pow(1.19, float(floor_num) - 1.0) * DungeonRunState.gold_mult() * mul * DungeonSigilState.gold_mult()))


## dungeon.js dropGold()의 mul 인자 그대로(잡졸 1·보스 5).
static func _spawn_gold(parent: Node, pos: Vector3, floor_num: int, mul: float = 1.0) -> void:
	var amount := gold_amount(floor_num, mul)
	if amount <= 0:
		return

	var area := _pickup_area("GoldPickup", pos, GOLD_COLOR, BoxMesh.new())
	(area.get_node("Mesh").mesh as BoxMesh).size = Vector3(0.35, 0.35, 0.35)
	parent.add_child(area)
	area.body_entered.connect(func(body: Node3D) -> void:
		if body.is_in_group("player"):
			DungeonGoldState.add(amount)
			Toast.show(area, "💰 금 +%d" % amount, 2.0)
			area.queue_free()
	)


## dungeon.js dropMat() 전체 — 주옥(4층부터)·부문·보석 중 하나가 나온다
## (DungeonItems.roll_material_drop()이 그 셋 사이 확률을 가른다).
static func _spawn_mat(parent: Node, pos: Vector3, floor_num: int) -> void:
	var mat := DungeonItems.roll_material_drop(floor_num)
	match str(mat.get("kind", "")):
		"rune":
			var r := DungeonItems.rune_by_key(str(mat.key))
			if r.is_empty():
				return
			var mesh := SphereMesh.new()
			mesh.radius = 0.28
			mesh.height = 0.56
			var area := _pickup_area("RunePickup", pos, RUNE_COLOR, mesh)
			parent.add_child(area)
			area.body_entered.connect(func(body: Node3D) -> void:
				if body.is_in_group("player"):
					DungeonMaterialsState.add_rune(str(mat.key))
					Toast.show(area, "🪨 부문 획득 · %s(%s)" % [r.glyph, r.name], TOAST_SEC)
					area.queue_free()
			)
		"gem":
			var gd := DungeonItems.gem_by_key(str(mat.key))
			if gd.is_empty():
				return
			var grade_num := int(mat.get("g", 0))
			var gr := DungeonItems.grade(grade_num)
			var mesh := SphereMesh.new()
			mesh.radius = 0.3
			mesh.height = 0.6
			var area := _pickup_area("GemPickup", pos, Color(String(gr.color)), mesh)
			parent.add_child(area)
			area.body_entered.connect(func(body: Node3D) -> void:
				if body.is_in_group("player"):
					DungeonMaterialsState.add_gem(str(mat.key), grade_num)
					Toast.show(area, "💎 보석 획득 · %s %s" % [gr.name, gd.name], TOAST_SEC)
					area.queue_free()
			)
		"jewel":
			var mesh := SphereMesh.new()
			mesh.radius = 0.3
			mesh.height = 0.6
			var area := _pickup_area("JewelPickup", pos, JEWEL_COLOR, mesh)
			parent.add_child(area)
			area.body_entered.connect(func(body: Node3D) -> void:
				if body.is_in_group("player"):
					## 주머니가 차 있으면(JEWEL_MAX) 바닥에 남는다 — area는 안 지운다
					## (potion 벨트가 찼을 때와 같은 규칙, _spawn_potion 참고).
					var r := DungeonMaterialsState.add_jewel(mat.j)
					if bool(r.get("ok", false)):
						Toast.show(area, "◈ 주옥 획득 · %s" % DungeonItems.jewel_name(r.jewel), TOAST_SEC)
						area.queue_free()
			)


## potion.js rollDrop(floor)의 등급 갈래만(종류는 회복단 고정 — DungeonPotionState
## 헤더 참고). 벨트가 차 있으면 못 줍는다(원작과 같다, 바닥에 그대로 남는다
## — 이 슬라이스는 안 사라지고 그대로 있는 것으로 충분히 지킨다).
static func _spawn_potion(parent: Node, pos: Vector3, floor_num: int) -> void:
	var g := DungeonPotionState.roll_drop_grade(floor_num)
	var gd := DungeonPotionState.grade_of(g)

	var mesh := SphereMesh.new()
	mesh.radius = 0.26
	mesh.height = 0.52
	var area := _pickup_area("PotionPickup", pos, POTION_COLOR, mesh)
	parent.add_child(area)
	area.body_entered.connect(func(body: Node3D) -> void:
		if body.is_in_group("player"):
			var r := DungeonPotionState.add(g)
			if bool(r.get("ok", false)):
				Toast.show(area, "🍶 %s 회복단 획득" % gd.name, TOAST_SEC)
				area.queue_free()
			## 벨트가 차 있으면 못 줍는다 — area는 그대로 남아 다시 시도할 수 있다.
	)


static func _spawn_scroll(parent: Node, pos: Vector3) -> void:
	var mesh := BoxMesh.new()
	mesh.size = Vector3(0.3, 0.42, 0.06)
	var area := _pickup_area("ScrollPickup", pos, SCROLL_COLOR, mesh)
	parent.add_child(area)
	area.body_entered.connect(func(body: Node3D) -> void:
		if body.is_in_group("player"):
			DungeonMaterialsState.add_scroll(1)
			Toast.show(area, "📜 감정서 획득", TOAST_SEC)
			area.queue_free()
	)


## PLAN 101-2 DUNGEON ②(유품, 2026-09-17) — 비결사 사망 자리에 서는 표식.
## `player_health.gd::_die_and_respawn()`이 죽은 그 자리에서 곧바로 부른다
## (다른 픽업과 달리 몬스터가 아니라 죽음이 부른다). 웹 5.2 "1개만 유지" —
## 새 유품이 서기 전에 옛 마커(있다면)를 지운다(DungeonGraveState.grave
## 자체는 set_grave()가 이미 덮어쓰지만, 화면에 남은 옛 마커 노드는 따로
## 지워야 한다).
static func spawn_grave_at(parent: Node, pos: Vector3) -> void:
	for old in parent.get_tree().get_nodes_in_group("dungeon_grave_marker"):
		if is_instance_valid(old):
			old.queue_free()
	var mesh := BoxMesh.new()
	mesh.size = Vector3(0.55, 0.7, 0.55)
	var area := _pickup_area("GraveMarker", pos, GRAVE_COLOR, mesh)
	area.add_to_group("dungeon_grave_marker")
	parent.add_child(area)
	area.body_entered.connect(func(body: Node3D) -> void:
		if body.is_in_group("player"):
			var gold: int = int(DungeonGraveState.grave.get("gold", 0))
			DungeonGraveState.claim()
			Toast.show(area, "💀 유품 회수 — 금 +%d, 장비를 되찾았다." % gold, TOAST_SEC)
			area.queue_free()
	)


## PLAN 101-2 DUNGEON ④(부적 던전, 2026-09-17) — 보스 드랍 전용. `ilvl`은
## 호출부(spawn_at())에서 그대로 넘어온 floor_num — dungeon_sigil_state.gd
## 헤더가 적어 둔 대로 층 번호를 그대로 티어에 쓴다(add_sigil()이 1~10
## 으로 자체 clamp한다).
static func _spawn_sigil(parent: Node, pos: Vector3, tier: int) -> void:
	var mesh := SphereMesh.new()
	mesh.radius = 0.32
	mesh.height = 0.64
	var area := _pickup_area("SigilPickup", pos, SIGIL_COLOR, mesh)
	parent.add_child(area)
	area.body_entered.connect(func(body: Node3D) -> void:
		if body.is_in_group("player"):
			var s := DungeonSigilState.add_sigil(tier)
			Toast.show(area, "🔺 부적 획득 · 티어 %d(%s)" % [int(s.get("tier", tier)), ", ".join(s.get("mods", []) as Array)], TOAST_SEC)
			area.queue_free()
	)


## 네 가지 픽업(무기/부적·금·룬·단약·감정서)이 공유하는 뼈대 — Area3D +
## 색 있는 메시 + 트리거 반경. body_entered 연결은 호출 쪽이 각자 잇는다.
static func _pickup_area(node_name: String, pos: Vector3, color: Color, mesh: Mesh) -> Area3D:
	var area := Area3D.new()
	area.name = node_name
	area.position = pos

	var mi := MeshInstance3D.new()
	mi.name = "Mesh"
	mi.mesh = mesh
	mi.position = Vector3(0, 0.35, 0)
	var mat := StandardMaterial3D.new()
	mat.albedo_color = color
	mat.metallic = 0.5
	mi.material_override = mat
	area.add_child(mi)

	var cs := CollisionShape3D.new()
	var shape := SphereShape3D.new()
	shape.radius = TRIGGER_RADIUS
	cs.shape = shape
	area.add_child(cs)
	return area
