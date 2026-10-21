extends RefCounted

## G-0059 — 들판 적·보스 몸을 자체툴 몬스터 GLB(assets/world mon_<갈래>_01~04 · boss_01~12, K-0043)로.
## GLB 는 뼈 없이 MotionRoot 를 통째로 움직이는 애니 일곱(Idle·Walk·Run·Attack·Hit·Death·Special)이다.
## 갈래(모양 → 갈래): 네발(quad) · 날개(wing) · 긴 몸(serp) · 등딱지(cons) · 도깨비·정령(spir).
##   들판 적 — 같은 갈래 mon_ 변형 01~04 를 개체 이름 해시로(같은 종 무리도 몸이 갈린다).
##   보스 — hp ≥ BOSS_HP 이고 사람 몸(vroid)이 아닌 종. KINDS 순서대로 같은 갈래 boss_ 를 돌려 준다.
## 사람 몸(도적·vroid 보스)은 여기 안 온다.
## G-0082 — 종마다 몸 하나(mon_sp_<종 id>.glb, K-0080: 종 색·꼴 맞춤)가 있으면 그것을 먼저 쓴다. 없는 종만 위 갈래 길.
## G-0274 — 들판 보통 종 일곱은 세 트랙 공용 자체 몸(assets/creatures/<id>.glb, K-0128·K-0166 고돗 엔진판 — 동작 일곱 이름 같음)을
##   mon_sp_ 보다 먼저(CREATURE_BY_KIND). 짝 없는 종(물거북)·보스는 mon_sp_ 그대로. SAGA_MONSTER_CREATURE=0 이면 mon_sp_ 로.
##   creatures 몸은 스킨 바인드 포즈에 배율이 있어(늑대 0.57·고양이 0.27) 메시 원본 크기 ≠ 그려지는 크기 — build 가 바인드를
##   곱한 상자(_posed_box)로 키를 맞추고 발을 0 에(그려지는 몸은 이미 발 0 이라 보통 그대로).
## G-0281 — creatures 몸은 원본 동물 색이라 원소가 안 읽혀(번개살쾡이 = 주황 고양이) TINT_BY_KIND 종은 tint() 가 밝기 지키는
##   색조 덧칠(creature_tint.gdshader, 종마다 재질 한 벌 — 무리가 공유). 끄기 SAGA_MONSTER_TINT=0.
## **기본은 켜짐.** 끄는 스위치: SAGA_CODE_CREATURES=1 이면 코드 짐승(creature_builder). SAGA_GLB_MONSTERS 는 옛 켜기(무시해도 켜짐).

const GLBUtils := preload("res://saga_core/world/glb_utils.gd")

const DIR := "res://assets/world/"
const BOSS_HP := 3000.0
## 코드 짐승 모양(creature_builder.gd) → GLB 갈래. 모양이 없는 들늑대는 "wolf".
const FAMILY_BY_SHAPE := {"wolf": "quad", "cat": "quad", "fox9": "quad", "bear": "quad",
	"bird": "wing", "serpent": "serp", "turtle": "cons", "goblin": "spir"}
const BOSS_BY_FAMILY := {"quad": ["boss_01", "boss_02", "boss_03", "boss_12"], "wing": ["boss_04", "boss_05"],
	"serp": ["boss_06", "boss_07"], "cons": ["boss_08", "boss_09"], "spir": ["boss_10", "boss_11"]}
const VARIANTS := 4
const CREATURE_DIR := "res://assets/creatures/"
const CREATURE_BY_KIND := {"wolf": "wolf", "fire_imp": "demon_red", "thunder_cat": "cat", "wind_hawk": "owl",
	"ice_fox": "fox", "rock_bear": "bear", "grass_snake": "snake"}
## 종 → [KINDS colors 몇 번째, 덧칠 양, 밝기]. 덩굴뱀은 흰 뱀이라 초록. 나머지 넷은 몸 색이 이름과 맞아 그대로(G-0281 촬영).
const TINT_BY_KIND := {"thunder_cat": [0, 0.85, 1.0], "ice_fox": [1, 0.9, 1.35], "grass_snake": [0, 0.8, 1.0]}
const TINT_SHADER := "res://saga_core/shaders/creature_tint.gdshader"
static var _tint_mats := {}   # 종 → ShaderMaterial(같은 종 무리 한 벌)
## field_enemy 가 쓰는 소문자 이름 → GLB 애니 이름.
const ANIMS := {"idle": "Idle", "walk": "Walk", "run": "Run", "attack": "Attack", "hit": "Hit", "death": "Death", "special": "Special"}
const LOOPED := ["Idle", "Walk", "Run"]

static func enabled() -> bool:
	return OS.get_environment("SAGA_CODE_CREATURES") == ""

static func family_of(def: Dictionary) -> String:
	if def.get("vroid", false):
		return ""
	return String(FAMILY_BY_SHAPE.get(String(def.get("shape", "wolf")), ""))

static func is_boss(def: Dictionary) -> bool:
	return float(def.get("hp", 0.0)) >= BOSS_HP and not def.get("vroid", false)

## 그 종·개체의 GLB 경로. 도적·사람 몸·모르는 모양·꺼짐이면 "".
static func path_for(kinds: Dictionary, kind: String, enemy_name: String) -> String:
	if not enabled() or kind == "bandit" or not kinds.has(kind):
		return ""
	var def: Dictionary = kinds[kind]
	if def.get("vroid", false):
		return ""
	var cr := creature_path(kind)
	if cr != "":
		return cr
	var sp := species_path(kind)
	if sp != "":
		return sp
	var fam := family_of(def)
	if fam == "":
		return ""
	if is_boss(def):
		var i := 0
		for k in kinds:
			if k == kind:
				break
			if is_boss(kinds[k]) and family_of(kinds[k]) == fam:
				i += 1
		var list: Array = BOSS_BY_FAMILY[fam]
		return DIR + String(list[i % list.size()]) + ".glb"
	return DIR + "mon_%s_%02d.glb" % [fam, variant_of(enemy_name) + 1]

## 세 트랙 공용 자체 몸(G-0274) 경로. 짝 없음·꺼짐·파일 없음이면 "".
static func creature_path(kind: String) -> String:
	if OS.get_environment("SAGA_MONSTER_CREATURE") == "0" or not CREATURE_BY_KIND.has(kind):
		return ""
	var p := CREATURE_DIR + String(CREATURE_BY_KIND[kind]) + ".glb"
	return p if ResourceLoader.exists(p) else ""


## 종 전용 몸(K-0080) 경로. 없으면 "".
static func species_path(kind: String) -> String:
	var p := DIR + "mon_sp_%s.glb" % kind
	return p if ResourceLoader.exists(p) else ""

## 개체 이름 → 변형 0~3(문자 해시, 실행마다 같다).
static func variant_of(enemy_name: String) -> int:
	var h := 0
	for i in enemy_name.length():
		h = (h * 31 + enemy_name.unicode_at(i)) & 0x7fffffff
	return h % VARIANTS

## GLB 몸 하나 — 키(세로)를 height 에 맞추고(균일 배율, 발 0 그대로) 걷기·서기·달리기를 되풀이로.
## 못 불러오면 null(부르는 쪽이 코드 짐승으로 되돌린다).
static func build(path: String, height: float) -> Node3D:
	var ps := load(path) as PackedScene
	if ps == null:
		return null
	var v := ps.instantiate() as Node3D
	if v == null:
		return null
	v.name = "MonsterBody"
	var box := _posed_box(v)
	if box.size.y > 0.0001:
		v.scale = Vector3.ONE * (height / box.size.y)
		if absf(box.position.y) > 0.01 and not v.find_children("*", "Skeleton3D", true, false).is_empty():   # 뼈 없는 옛 몸(떠 있는 보스 등)은 그대로
			_lift(v, -box.position.y)
	var ap := v.get_node_or_null("AnimationPlayer") as AnimationPlayer
	if ap:
		for n in LOOPED:
			if ap.has_animation(n):
				ap.get_animation(n).loop_mode = Animation.LOOP_LINEAR
		if ap.has_animation("Idle"):
			ap.play("Idle")
	return v

## 그려지는 몸 상자(v 기준, v 배율 빼고) — 스킨 메시는 뼈 쉼 자세 × 바인드 포즈(첫 뼈)를 곱한다. 스킨 없으면 GLBUtils.fit_height 와 같은 상자.
static func _posed_box(v: Node3D) -> AABB:
	var box := AABB()
	var first := true
	for mi in GLBUtils.find_all_mesh_instances(v):
		if mi.mesh == null:
			continue
		var xf := GLBUtils._relative_transform(v, mi)
		var sk := mi.get_node_or_null(mi.skeleton) as Skeleton3D if mi.skin != null else null
		if sk != null and mi.skin.get_bind_count() > 0:
			var bone := mi.skin.get_bind_bone(0)
			if bone < 0:
				bone = sk.find_bone(mi.skin.get_bind_name(0))
			if bone >= 0:
				xf = GLBUtils._relative_transform(v, sk) * sk.get_bone_global_rest(bone) * mi.skin.get_bind_pose(0)
		var b: AABB = xf * mi.mesh.get_aabb()
		box = b if first else box.merge(b)
		first = false
	return box


## 위 자식(뼈대 CreatureArmature 등)을 dy(v 배율 전 단위)만큼 올린다. MotionRoot 는 애니가 위치를 쥐어 덮으므로 건너뛴다.
static func _lift(v: Node3D, dy: float) -> void:
	for c in v.get_children():
		if c is Node3D and c.name != "MotionRoot":
			(c as Node3D).position.y += dy


## creatures 몸이면 종 원소 색을 덧칠한다(표에 있는 종만). 바꾼 표면 수.
static func tint(v: Node3D, kind: String, def: Dictionary) -> int:
	if v == null or OS.get_environment("SAGA_MONSTER_TINT") == "0" or not TINT_BY_KIND.has(kind) or creature_path(kind) == "":
		return 0
	var n := 0
	for mi in GLBUtils.find_all_mesh_instances(v):
		if mi.mesh == null:
			continue
		for i in mi.mesh.get_surface_count():
			var base := mi.get_active_material(i) as StandardMaterial3D
			if base == null or base.albedo_texture == null:
				continue
			var key := "%s/%d" % [kind, i]
			if not _tint_mats.has(key):
				var t: Array = TINT_BY_KIND[kind]
				var cols: Array = def.get("colors", [])
				var sm := ShaderMaterial.new()
				sm.shader = load(TINT_SHADER) as Shader
				sm.set_shader_parameter("albedo_texture", base.albedo_texture)   # 이름은 material_audit 이 그림으로 읽는 것
				sm.set_shader_parameter("tint", cols[int(t[0])] if cols.size() > int(t[0]) else Color.WHITE)
				sm.set_shader_parameter("amount", float(t[1]))
				sm.set_shader_parameter("bright", float(t[2]))
				sm.set_shader_parameter("roughness_v", base.roughness)
				_tint_mats[key] = sm
			mi.set_surface_override_material(i, _tint_mats[key])
			n += 1
	return n


static func anim_name(want: String) -> String:
	return String(ANIMS.get(want.to_lower(), want))
