extends RefCounted

## G-0059 — 들판 적·보스 몸을 자체툴 몬스터 GLB(assets/world mon_<갈래>_01~04 · boss_01~12, K-0043)로.
## GLB 는 뼈 없이 MotionRoot 를 통째로 움직이는 애니 일곱(Idle·Walk·Run·Attack·Hit·Death·Special)이다.
## 갈래(모양 → 갈래): 네발(quad) · 날개(wing) · 긴 몸(serp) · 등딱지(cons) · 도깨비·정령(spir).
##   들판 적 — 같은 갈래 mon_ 변형 01~04 를 개체 이름 해시로(같은 종 무리도 몸이 갈린다).
##   보스 — hp ≥ BOSS_HP 이고 사람 몸(vroid)이 아닌 종. KINDS 순서대로 같은 갈래 boss_ 를 돌려 준다.
## 사람 몸(도적·vroid 보스)은 여기 안 온다.
## **기본은 꺼짐** — 환경 SAGA_GLB_MONSTERS=1 일 때만 GLB 몸(G-0059 촬영: 지금 GLB 는 원소색이 안 읽히고 이름과 모양이
## 어긋나 코드 짐승보다 못하다 — K 가 고친 뒤 기본을 켠다). SAGA_CODE_CREATURES=1 이면 켜 둬도 코드 짐승.

const GLBUtils := preload("res://saga_core/world/glb_utils.gd")

const DIR := "res://assets/world/"
const BOSS_HP := 3000.0
## 코드 짐승 모양(creature_builder.gd) → GLB 갈래. 모양이 없는 들늑대는 "wolf".
const FAMILY_BY_SHAPE := {"wolf": "quad", "cat": "quad", "fox9": "quad", "bear": "quad",
	"bird": "wing", "serpent": "serp", "turtle": "cons", "goblin": "spir"}
const BOSS_BY_FAMILY := {"quad": ["boss_01", "boss_02", "boss_03", "boss_12"], "wing": ["boss_04", "boss_05"],
	"serp": ["boss_06", "boss_07"], "cons": ["boss_08", "boss_09"], "spir": ["boss_10", "boss_11"]}
const VARIANTS := 4
## field_enemy 가 쓰는 소문자 이름 → GLB 애니 이름.
const ANIMS := {"idle": "Idle", "walk": "Walk", "run": "Run", "attack": "Attack", "hit": "Hit", "death": "Death", "special": "Special"}
const LOOPED := ["Idle", "Walk", "Run"]

static func enabled() -> bool:
	return OS.get_environment("SAGA_GLB_MONSTERS") != "" and OS.get_environment("SAGA_CODE_CREATURES") == ""

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
	GLBUtils.fit_height(v, height)
	var ap := v.get_node_or_null("AnimationPlayer") as AnimationPlayer
	if ap:
		for n in LOOPED:
			if ap.has_animation(n):
				ap.get_animation(n).loop_mode = Animation.LOOP_LINEAR
		if ap.has_animation("Idle"):
			ap.play("Idle")
	return v

static func anim_name(want: String) -> String:
	return String(ANIMS.get(want.to_lower(), want))
