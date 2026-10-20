extends CharacterBody3D

## VERTICAL_SLICE_FOREST.md 4절 "제외" 목록 마지막 항목("몬스터·퓨전
## 콘텐츠") 착수 1호 — 5절 "몬스터·퓨전 자유" 결정을 실제로 쓴 첫 콘텐츠다.
##
## 웹판 `data-village.js`의 ANIMALS 상태기계(idle→wander→flee, "새 상태·
## 전투는 안 만들었다" 원문 그대로)를 3D로 옮긴다 — 전투·포획·HP는 이번에도
## 안 만든다(몬스터라도 이 판의 정체성은 "돌아다니면 재미있다"이지 전투가
## 아니다, LEGACY_FEATURE_AUDIT.md 핵심 루프 문장 그대로).
##
## **재해석** — 웹판 mushnub(포자괴물)를 그대로 옮기지 않았다. 5절 결정 자체가
## "몬스터·다른 시대 요소를 넣어도 된다"는 자유이지 "포자괴물을 옮겨라"가
## 아니라서, 새 창작 몬스터로 짓는다 — 전부 실존 인물·원작사 캐릭터가 아닌
## 한국 설화의 일반명사("황건적"처럼 부류를 가리키는 이름) 계열이다.
##
## 종 셋(forest_creature_builder.gd CREATURES 참고, `kind`로 갈린다):
## - "dokkaebi"(숲도깨비, 어둑숲) — 구 몸통+원뿔 뿔, 짙은 보라.
## - "bawi"(바위도깨비, 바위 지대, 2026-09-12 추가) — 상자 몸통+상자 혹 둘,
##   돌빛 회갈색. 몸집이 크고 느린 대신(speed·flee_speed가 낮다) 잘 안
##   달아난다는 인상을 주려고 flee_radius도 좁게 잡았다(builder 쪽 수치).
## - "beoseot"(버섯정령, 버섯숲, 2026-09-12 추가) — 원기둥 대+구 갓, 청록빛.
##   웹판 mushnub(포자괴물)가 원래 살던 바이옴(버섯숲)을 이걸로 마저
##   채웠지만 이름·색·행동은 그대로 안 옮겼다(위 "재해석" 원칙 그대로) —
##   forest_biome_scatter.gd의 장식용 버섯(줄기+갓, 살구색 갓)과 갓 색을
##   달리해 "장식이 아니라 살아 움직이는 것"이 한눈에 갈리게 했다. 셋 중
##   가장 재빠르고(speed·flee_speed가 가장 높다) 대신 아주 가까이 가야만
##   놀란다(flee_radius가 가장 좁다) — 붙임성 있는 인상.
## - "kkot"(꽃정령, 꽃밭, 2026-09-12 추가) — 구 몸통+토러스(고리) 꽃관, 분홍.
##   네 바이옴 중 마지막으로 비워 뒀던 꽃밭을 채운다. 꽃밭이 이 마을에서
##   가장 밝고 트인 곳이라는 인상에 맞춰 넷 중 가장 넓게 돌아다니게
##   (wander_m 최댓값) 잡았다 — 앞선 셋(어둡거나 좁은 바이옴)과는 다른
##   축으로 갈랐다.
##
## **2026-09-14, 51장 "생태계" 축 — 바이옴마다 둘째 종을 보탰다.** 웹판
## `data-village.js` ANIMALS는 바이옴 하나에 여러 종이 같이 산다(green
## 바이옴만 해도 사슴·토끼·다람쥐·새 넷) — 이 슬라이스는 지금까지 바이옴당
## 하나뿐이었다. 새 종도 실존 동물이 아니라 창작 몬스터로 짓는다(위
## "재해석" 원칙 그대로, 기존 넷과 같은 결):
## - "nabi"(나비정령, 꽃밭 — kkot과 짝) — 구 몸통+날개 둘(얇은 상자), 라벤더+
##   주황. 넷 중 가장 재빠르고 가장 잘 놀란다(flee_m 최댓값) — kkot(가장
##   넓게 도는 느긋한 종)과 반대 축으로 갈랐다.
## - "bueong"(부엉도깨비, 어둑숲 — dokkaebi와 짝) — 캡슐 몸통+귀깃 원뿔 둘,
##   갈색조. 거의 안 돌아다니다(wander_m 최솟값급) 놀라면 아주 빠르게
##   튄다(flee_speed 최댓값) — "웅크렸다 순간에 난다"는 인상.
## - "dalpaeng"(달팽이정, 버섯숲 — beoseot과 짝) — 구 몸통(등딱지, 눌러
##   찌그러뜨림)+작은 구 머리, 흙빛. 다섯 종 중 가장 느리고(speed·
##   flee_speed 최솟값) 가장 안 놀란다(flee_m 최솟값) — beoseot(가장
##   재빠른 종)과 완전히 반대.
## - "yeomso"(염소도깨비, 바위 지대 — bawi와 짝) — 상자 몸통+뿔 원뿔 둘,
##   크림색. bawi(육중하고 느림)와 달리 재빠르고 넓게 돈다 — 같은
##   바이옴 안에서 "무겁게 버티는 놈"과 "가볍게 뛰어다니는 놈"으로 갈랐다.
##
## **2026-09-14, 51장 "생태계" 축 — 바이옴마다 셋째 종을 보탰다.** 웹판
## ANIMALS green 바이옴은 넷(사슴·토끼·다람쥐·새)까지도 있었으니 셋도
## 과하지 않다. den은 forest_biome_scatter.gd CLEAR_SPOTS(주민·채집물·
## 집·박물관·낚시터 17곳)와 기존 창작 몬스터 8곳까지 합쳐 25개 고정점
## 전부에서 격자거리(체비셰프) 3 이상인 자리만 스크립트로 걸러 골랐다
## (손으로 어림하지 않았다 — forest_creature_builder.gd 주석 참고).
## - "hangari"(항아리도깨비, 어둑숲 — dokkaebi·bueong과 함께) — 토러스
##   몸통+작은 구 머리, 지금까지 없던 "고리+구"다. 거의 안
##   움직이고(wander_m 최솟값급) 놀라도 느리게 피한다(flee_speed 낮음)
##   — dokkaebi(중간)·bueong(웅크렸다 순간에 남)과 다른 "묵직하고
##   태평한" 셋째 축.
## - "duduji"(두더지도깨비, 바위 지대 — bawi·yeomso와 함께) — 옆으로
##   누운 캡슐 몸통+원뿔 주둥이 하나(지금까지 뿔·귀는 늘 둘이었는데
##   처음으로 하나). 아주 좁게만 돌아다니지만(wander_m 최솟값, 굴 밖을
##   잘 안 나온다는 인상) 놀라면 가장 빠르게 파고들듯 튄다(flee_speed가
##   세 종 중 가장 높다).
## - "gaemi"(개미도깨비, 버섯숲 — beoseot·dalpaeng와 함께) — 구 셋(머리·
##   가슴·배)을 일렬로 잇고 더듬이 원기둥 둘을 얹는다, 지금까지 없던
##   "구 사슬"이다. beoseot(가장 재빠름)·dalpaeng(가장 느림)
##   사이 정확히 중간값으로 잡아 "평범한 축"을 채운다.
## - "gaeguri"(개구리도깨비, 꽃밭 — kkot·nabi와 함께) — 누른 구 몸통+
##   작은 구 눈 둘, "구+작은 구 둘" 조합은 처음이다(kkot은 구+토러스,
##   nabi는 구+상자 날개). duduji와 함께 wander_m 공동 최솟값(둘 다
##   0.8, 좁게만 움직인다)이면서 놀라면 폴짝 뛰듯 열두 종 통틀어 가장
##   빠르게 도망친다(flee_speed 최댓값, bueong의 5.0보다도 높다) —
##   "느긋하다 한 번에 튄다"는 개구리다운 인상.
##
## **2026-09-14, 같은 날 이어서 — 바이옴마다 넷째 종을 보태되, 이번엔
## 네 바이옴 전부가 아니라 둘만 골랐다.** 웹판 ANIMALS를 다시 세어 보니
## 바이옴별 종 수가 균일하지 않다(meadow·dark 4종, rocky 3종, mushroom
## 2종+희귀 1종) — 이 슬라이스는 지금까지 넷을 똑같이 3종씩 채워 와서,
## rocky는 이미 원작과 같은 수(3)에 닿았고 mush는 오히려 원작(2)보다도
## 많다. 그대로 넷째를 더하면 원작보다 붐비게 된다고 판단해, 아직 원작
## 수(4)에 못 닿은 **meadow·dark 둘에만** 넷째를 보탰다 — "바이옴마다
## 균등하게"가 아니라 "원작 밀도에 맞게"로 기준을 바꾼 첫 사례.
## - "bandi"(반딧불도깨비, 꽃밭 — kkot·nabi·gaeguri와 함께) — 원기둥
##   몸통+토러스 고리(지금까지 없던 조합, 토러스는 몸통으로만 쓰였다),
##   금빛. 꽃밭 넷 중 가장 예민하게(flee_m 6.5, 열두 종 통틀어 dokkaebi
##   6.0·nabi 7.0 다음으로 높다) 잡되 도망 속도는 낮게(flee_speed 2.0)
##   해 "빨리 알아채지만 도망은 굼뜨다"는, 지금까지 없던 조합의 성격을
##   줬다.
## - "geurimja"(그림자도깨비, 어둑숲 — dokkaebi·bueong·hangari와 함께) —
##   납작한 상자 몸통+작은 구 눈 하나(상자+구 조합도 지금까지 없었다),
##   거의 검정에 가까운 짙은 색. 어둑숲 넷 중 가장 안 겁내고(flee_m
##   2.0, dark 그룹 최저) 도망 속도도 평범해(flee_speed 2.8, 극단값이
##   아니다) 앞선 셋(다들 어느 한 축에서 극단값을 가진다)과 달리
##   "무난하고 둔감한" 축을 채운다.
##
## den은 이번에도 손으로 어림하지 않았다 — forest_biome_scatter.gd
## CLEAR_SPOTS(17)+기존 창작 몬스터 12곳=고정점 29개 전부와 biome_at()을
## Node.js로 대조해 meadow(9,8)·dark(22,8) 둘 다 체비셰프 거리 정확히
## 3(문턱값) 확인됨.
##
## 시각은 전부 primitive — 이 판의 몬스터 전용 GLB가 없다(버섯·가구가 이미
## 쓴 예외와 같은 이유). WorldCurveMaterial을 쓴다 — 이동하는 오브젝트도
## 구면 투영 대상이다(villager_builder.gd와 같은 결).

const WorldCurveMaterial := preload("res://saga_core/world/world_curve_material.gd")

enum State { IDLE, WANDER, FLEE }

const CURVE_AMOUNT := 0.004
const COLOR_DOKKAEBI := Color(0.22, 0.12, 0.28)  # 신규 창작색 — 어둑숲 톤에 맞춘 짙은 보라
const COLOR_BAWI := Color(0.42, 0.38, 0.33)      # 신규 창작색 — 바위 지대 톤에 맞춘 돌빛 회갈색
const COLOR_BEOSEOT_STEM := Color(0.88, 0.85, 0.74)  # forest_biome_scatter.gd 장식 버섯 줄기와 같은 톤
const COLOR_BEOSEOT_CAP := Color(0.22, 0.55, 0.5)    # 장식 버섯(살구색 갓)과 갈리는 청록빛 신규 창작색
const COLOR_KKOT_BODY := Color(0.95, 0.93, 0.85)     # 신규 창작색 — 꽃받침을 연상시키는 아이보리
const COLOR_KKOT_CROWN := Color(0.86, 0.42, 0.55)    # 신규 창작색 — 꽃밭 톤에 맞춘 분홍
const COLOR_NABI_BODY := Color(0.78, 0.72, 0.88)     # 신규 창작색 — 라벤더
const COLOR_NABI_WING := Color(0.95, 0.72, 0.32)     # 신규 창작색 — 주황빛 날개
const COLOR_BUEONG := Color(0.36, 0.29, 0.24)        # 신규 창작색 — 어둑숲 톤의 짙은 갈색
const COLOR_DALPAENG_SHELL := Color(0.55, 0.42, 0.3) # 신규 창작색 — 흙빛 등딱지
const COLOR_DALPAENG_HEAD := Color(0.74, 0.77, 0.62) # 신규 창작색 — 옅은 풀빛 머리
const COLOR_YEOMSO := Color(0.78, 0.72, 0.6)         # 신규 창작색 — 크림빛
const COLOR_HANGARI_BODY := Color(0.24, 0.2, 0.14)   # 신규 창작색 — 어둑숲 톤의 짙은 항아리 갈색
const COLOR_HANGARI_HEAD := Color(0.4, 0.32, 0.2)    # 신규 창작색 — 몸통보다 옅은 흙빛
const COLOR_DUDUJI := Color(0.34, 0.28, 0.22)        # 신규 창작색 — 바위 지대 톤의 두더지 갈회색
const COLOR_GAEMI := Color(0.2, 0.12, 0.06)          # 신규 창작색 — 버섯숲 그늘에 묻히는 짙은 개미 갈색
const COLOR_GAEGURI_BODY := Color(0.3, 0.52, 0.26)   # 신규 창작색 — 꽃밭 톤의 개구리 초록
const COLOR_GAEGURI_EYE := Color(0.75, 0.78, 0.35)   # 신규 창작색 — 눈만 밝은 연두
const COLOR_BANDI_BODY := Color(0.68, 0.58, 0.3)     # 신규 창작색 — 꽃밭 톤의 옅은 황금빛
const COLOR_BANDI_RING := Color(0.95, 0.86, 0.4)     # 신규 창작색 — 반딧불처럼 밝은 노랑
const COLOR_GEURIMJA := Color(0.1, 0.08, 0.14)       # 신규 창작색 — 어둑숲 톤보다 더 짙은 그림자빛
const COLOR_GEURIMJA_EYE := Color(0.7, 0.85, 0.6)    # 신규 창작색 — 어둠 속에 홀로 빛나는 연둣빛 눈
const IDLE_TIME_MIN := 1.5
const IDLE_TIME_MAX := 3.5
const FLEE_TIME := 2.5
const ARRIVE_DIST := 0.3

var den: Vector3
var wander_radius: float
var flee_radius: float
var speed: float
var flee_speed: float

var _kind := "dokkaebi"
var _state: State = State.IDLE
var _timer := 0.0
var _target: Vector3
var _player: Node3D
var _rng := RandomNumberGenerator.new()


## 웹판 ANIMALS 항목 하나를 그대로 옮기는 자리 — 씨앗은 den 좌표로 고정해
## 매번 같은 진단 결과가 나오게 한다(루트 CLAUDE.md 검증 습관 "세 번 돌려
## 출력이 같은지"). kind는 위 주석의 종 키("dokkaebi"·"bawi") — 안 주면
## 첫 종(숲도깨비) 그대로.
func setup(p_den: Vector3, p_wander: float, p_flee: float, p_speed: float,
		p_flee_speed: float, seed_salt: int, kind: String = "dokkaebi") -> void:
	den = p_den
	wander_radius = p_wander
	flee_radius = p_flee
	speed = p_speed
	flee_speed = p_flee_speed
	_rng.seed = seed_salt
	_kind = kind
	global_position = den


func _ready() -> void:
	_player = get_tree().get_first_node_in_group("player")
	_spawn_visual()
	_enter_idle()


func _spawn_visual() -> void:
	match _kind:
		"bawi":
			_spawn_visual_bawi()
		"beoseot":
			_spawn_visual_beoseot()
		"kkot":
			_spawn_visual_kkot()
		"nabi":
			_spawn_visual_nabi()
		"bueong":
			_spawn_visual_bueong()
		"dalpaeng":
			_spawn_visual_dalpaeng()
		"yeomso":
			_spawn_visual_yeomso()
		"hangari":
			_spawn_visual_hangari()
		"duduji":
			_spawn_visual_duduji()
		"gaemi":
			_spawn_visual_gaemi()
		"gaeguri":
			_spawn_visual_gaeguri()
		"bandi":
			_spawn_visual_bandi()
		"geurimja":
			_spawn_visual_geurimja()
		_:
			_spawn_visual_dokkaebi()


func _spawn_visual_dokkaebi() -> void:
	var mat: ShaderMaterial = WorldCurveMaterial.vertex_color_material(CURVE_AMOUNT, 0.85, COLOR_DOKKAEBI)

	var body := MeshInstance3D.new()
	var body_mesh := SphereMesh.new()
	body_mesh.radial_segments = 16; body_mesh.rings = 8   # G-0260 기본 64×32 → creature_builder 값(반지름 ≤0.5m 라 눈엔 같음)
	body_mesh.radius = 0.32
	body_mesh.height = 0.58
	body.mesh = body_mesh
	body.position = Vector3(0, 0.32, 0)
	body.material_override = mat
	add_child(body)

	var horn := MeshInstance3D.new()
	var horn_mesh := CylinderMesh.new()
	horn_mesh.top_radius = 0.0
	horn_mesh.bottom_radius = 0.09
	horn_mesh.height = 0.3
	horn.mesh = horn_mesh
	horn.position = Vector3(0, 0.68, 0)
	horn.material_override = mat
	add_child(horn)

	var cs := CollisionShape3D.new()
	var shape := SphereShape3D.new()
	shape.radius = 0.32
	cs.position = Vector3(0, 0.32, 0)
	cs.shape = shape
	add_child(cs)


## 바위도깨비 — 몸집이 다부지다는 인상을 상자 셋(몸통+혹 둘)으로 준다.
func _spawn_visual_bawi() -> void:
	var mat: ShaderMaterial = WorldCurveMaterial.vertex_color_material(CURVE_AMOUNT, 0.95, COLOR_BAWI)

	var body := MeshInstance3D.new()
	var body_mesh := BoxMesh.new()
	body_mesh.size = Vector3(0.56, 0.5, 0.46)
	body.mesh = body_mesh
	body.position = Vector3(0, 0.3, 0)
	body.material_override = mat
	add_child(body)

	var bump_l := MeshInstance3D.new()
	var bump_mesh := BoxMesh.new()
	bump_mesh.size = Vector3(0.16, 0.16, 0.16)
	bump_l.mesh = bump_mesh
	bump_l.position = Vector3(-0.15, 0.62, 0)
	bump_l.rotation.y = 0.5
	bump_l.material_override = mat
	add_child(bump_l)

	var bump_r: MeshInstance3D = bump_l.duplicate()
	bump_r.position = Vector3(0.15, 0.62, 0)
	bump_r.rotation.y = -0.5
	add_child(bump_r)

	var cs := CollisionShape3D.new()
	var shape := BoxShape3D.new()
	shape.size = Vector3(0.56, 0.5, 0.46)
	cs.position = Vector3(0, 0.3, 0)
	cs.shape = shape
	add_child(cs)


## 버섯정령 — forest_biome_scatter.gd `_spawn_mushroom()`과 같은 2부(줄기+갓)
## 구성이되 갓 색만 달리해(청록 vs 장식의 살구색) "이건 움직인다"가
## 갈린다. 크기도 장식보다 한결 크게(갓 반지름 0.16→0.22) 해서 눈에 띈다.
func _spawn_visual_beoseot() -> void:
	var stem_mat: ShaderMaterial = WorldCurveMaterial.vertex_color_material(
		CURVE_AMOUNT, 0.9, COLOR_BEOSEOT_STEM)
	var cap_mat: ShaderMaterial = WorldCurveMaterial.vertex_color_material(
		CURVE_AMOUNT, 0.6, COLOR_BEOSEOT_CAP)

	var stem := MeshInstance3D.new()
	var stem_mesh := CylinderMesh.new()
	stem_mesh.top_radius = 0.07
	stem_mesh.bottom_radius = 0.08
	stem_mesh.height = 0.3
	stem.mesh = stem_mesh
	stem.position = Vector3(0, 0.15, 0)
	stem.material_override = stem_mat
	add_child(stem)

	var cap := MeshInstance3D.new()
	var cap_mesh := SphereMesh.new()
	cap_mesh.radial_segments = 16; cap_mesh.rings = 8   # G-0260 기본 64×32 → creature_builder 값(반지름 ≤0.5m 라 눈엔 같음)
	cap_mesh.radius = 0.22
	cap_mesh.height = 0.22
	cap.mesh = cap_mesh
	cap.position = Vector3(0, 0.33, 0)
	cap.material_override = cap_mat
	add_child(cap)

	var cs := CollisionShape3D.new()
	var shape := SphereShape3D.new()
	shape.radius = 0.22
	cs.position = Vector3(0, 0.24, 0)
	cs.shape = shape
	add_child(cs)


## 꽃정령 — 구 몸통 위에 토러스(고리) 하나를 꽃관처럼 얹는다. 앞선 셋
## (구+원뿔·상자+상자·원기둥+구)과 겹치지 않는 새 조합.
func _spawn_visual_kkot() -> void:
	var body_mat: ShaderMaterial = WorldCurveMaterial.vertex_color_material(
		CURVE_AMOUNT, 0.7, COLOR_KKOT_BODY)
	var crown_mat: ShaderMaterial = WorldCurveMaterial.vertex_color_material(
		CURVE_AMOUNT, 0.5, COLOR_KKOT_CROWN)

	var body := MeshInstance3D.new()
	var body_mesh := SphereMesh.new()
	body_mesh.radial_segments = 16; body_mesh.rings = 8   # G-0260 기본 64×32 → creature_builder 값(반지름 ≤0.5m 라 눈엔 같음)
	body_mesh.radius = 0.26
	body_mesh.height = 0.48
	body.mesh = body_mesh
	body.position = Vector3(0, 0.26, 0)
	body.material_override = body_mat
	add_child(body)

	var crown := MeshInstance3D.new()
	var crown_mesh := TorusMesh.new()
	crown_mesh.inner_radius = 0.08
	crown_mesh.outer_radius = 0.22
	crown.mesh = crown_mesh
	crown.position = Vector3(0, 0.5, 0)
	crown.material_override = crown_mat
	add_child(crown)

	var cs := CollisionShape3D.new()
	var shape := SphereShape3D.new()
	shape.radius = 0.26
	cs.position = Vector3(0, 0.26, 0)
	cs.shape = shape
	add_child(cs)


## 나비정령 — 작은 구 몸통에 얇은 상자 둘을 좌우로 벌려 날개처럼 얹는다.
## 다섯 종 중 처음 쓰는 3부 조합(몸통+날개 둘).
func _spawn_visual_nabi() -> void:
	var body_mat: ShaderMaterial = WorldCurveMaterial.vertex_color_material(
		CURVE_AMOUNT, 0.6, COLOR_NABI_BODY)
	var wing_mat: ShaderMaterial = WorldCurveMaterial.vertex_color_material(
		CURVE_AMOUNT, 0.45, COLOR_NABI_WING)

	var body := MeshInstance3D.new()
	var body_mesh := SphereMesh.new()
	body_mesh.radial_segments = 16; body_mesh.rings = 8   # G-0260 기본 64×32 → creature_builder 값(반지름 ≤0.5m 라 눈엔 같음)
	body_mesh.radius = 0.16
	body_mesh.height = 0.3
	body.mesh = body_mesh
	body.position = Vector3(0, 0.5, 0)
	body.material_override = body_mat
	add_child(body)

	var wing_l := MeshInstance3D.new()
	var wing_mesh := BoxMesh.new()
	wing_mesh.size = Vector3(0.32, 0.24, 0.03)
	wing_l.mesh = wing_mesh
	wing_l.position = Vector3(-0.2, 0.52, 0)
	wing_l.rotation.y = 0.5
	wing_l.material_override = wing_mat
	add_child(wing_l)

	var wing_r: MeshInstance3D = wing_l.duplicate()
	wing_r.position = Vector3(0.2, 0.52, 0)
	wing_r.rotation.y = -0.5
	add_child(wing_r)

	var cs := CollisionShape3D.new()
	var shape := SphereShape3D.new()
	shape.radius = 0.2
	cs.position = Vector3(0, 0.5, 0)
	cs.shape = shape
	add_child(cs)


## 부엉도깨비 — 캡슐 몸통(웅크린 인상)에 귀깃 원뿔 둘. 다섯 종 중 처음
## 쓰는 캡슐 몸통(다른 종은 구·상자·원기둥뿐이었다).
func _spawn_visual_bueong() -> void:
	var mat: ShaderMaterial = WorldCurveMaterial.vertex_color_material(CURVE_AMOUNT, 0.85, COLOR_BUEONG)

	var body := MeshInstance3D.new()
	var body_mesh := CapsuleMesh.new()
	body_mesh.radius = 0.26
	body_mesh.height = 0.5
	body.mesh = body_mesh
	body.position = Vector3(0, 0.3, 0)
	body.material_override = mat
	add_child(body)

	var ear_l := MeshInstance3D.new()
	var ear_mesh := CylinderMesh.new()
	ear_mesh.top_radius = 0.0
	ear_mesh.bottom_radius = 0.06
	ear_mesh.height = 0.16
	ear_l.mesh = ear_mesh
	ear_l.position = Vector3(-0.1, 0.56, 0)
	ear_l.material_override = mat
	add_child(ear_l)

	var ear_r: MeshInstance3D = ear_l.duplicate()
	ear_r.position = Vector3(0.1, 0.56, 0)
	add_child(ear_r)

	var cs := CollisionShape3D.new()
	var shape := CapsuleShape3D.new()
	shape.radius = 0.26
	shape.height = 0.5
	cs.position = Vector3(0, 0.3, 0)
	cs.shape = shape
	add_child(cs)


## 달팽이정 — 눌러 찌그러뜨린 구(등딱지)+작은 구(머리). 다섯 종 중 처음
## 쓰는 "구 둘" 조합(kkot은 구+토러스였다).
func _spawn_visual_dalpaeng() -> void:
	var shell_mat: ShaderMaterial = WorldCurveMaterial.vertex_color_material(
		CURVE_AMOUNT, 0.9, COLOR_DALPAENG_SHELL)
	var head_mat: ShaderMaterial = WorldCurveMaterial.vertex_color_material(
		CURVE_AMOUNT, 0.6, COLOR_DALPAENG_HEAD)

	var shell := MeshInstance3D.new()
	var shell_mesh := SphereMesh.new()
	shell_mesh.radial_segments = 16; shell_mesh.rings = 8   # G-0260 기본 64×32 → creature_builder 값(반지름 ≤0.5m 라 눈엔 같음)
	shell_mesh.radius = 0.24
	shell_mesh.height = 0.3
	shell.mesh = shell_mesh
	shell.scale = Vector3(1.0, 0.6, 1.0)
	shell.position = Vector3(0, 0.16, -0.05)
	shell.material_override = shell_mat
	add_child(shell)

	var head := MeshInstance3D.new()
	var head_mesh := SphereMesh.new()
	head_mesh.radial_segments = 16; head_mesh.rings = 8   # G-0260 기본 64×32 → creature_builder 값(반지름 ≤0.5m 라 눈엔 같음)
	head_mesh.radius = 0.09
	head_mesh.height = 0.18
	head.mesh = head_mesh
	head.position = Vector3(0, 0.1, 0.22)
	head.material_override = head_mat
	add_child(head)

	var cs := CollisionShape3D.new()
	var shape := SphereShape3D.new()
	shape.radius = 0.22
	cs.position = Vector3(0, 0.14, 0)
	cs.shape = shape
	add_child(cs)


## 염소도깨비 — 상자 몸통+뿔 원뿔 둘(뒤로 젖힌 각). bawi(상자+상자 혹)와
## 같은 상자 몸통이지만 원뿔 뿔로 "재빠른 축"임을 시각으로도 가른다.
func _spawn_visual_yeomso() -> void:
	var mat: ShaderMaterial = WorldCurveMaterial.vertex_color_material(CURVE_AMOUNT, 0.75, COLOR_YEOMSO)

	var body := MeshInstance3D.new()
	var body_mesh := BoxMesh.new()
	body_mesh.size = Vector3(0.42, 0.4, 0.36)
	body.mesh = body_mesh
	body.position = Vector3(0, 0.26, 0)
	body.material_override = mat
	add_child(body)

	var horn_l := MeshInstance3D.new()
	var horn_mesh := CylinderMesh.new()
	horn_mesh.top_radius = 0.0
	horn_mesh.bottom_radius = 0.05
	horn_mesh.height = 0.24
	horn_l.mesh = horn_mesh
	horn_l.position = Vector3(-0.1, 0.52, -0.05)
	horn_l.rotation.x = -0.4
	horn_l.material_override = mat
	add_child(horn_l)

	var horn_r: MeshInstance3D = horn_l.duplicate()
	horn_r.position = Vector3(0.1, 0.52, -0.05)
	add_child(horn_r)

	var cs := CollisionShape3D.new()
	var shape := BoxShape3D.new()
	shape.size = Vector3(0.42, 0.4, 0.36)
	cs.position = Vector3(0, 0.26, 0)
	cs.shape = shape
	add_child(cs)


## 항아리도깨비 — 토러스(고리) 몸통 위에 작은 구 머리. 지금까지 없던
## "고리+구" 조합(kkot은 구+토러스로 순서가 반대다).
func _spawn_visual_hangari() -> void:
	var body_mat: ShaderMaterial = WorldCurveMaterial.vertex_color_material(
		CURVE_AMOUNT, 0.9, COLOR_HANGARI_BODY)
	var head_mat: ShaderMaterial = WorldCurveMaterial.vertex_color_material(
		CURVE_AMOUNT, 0.6, COLOR_HANGARI_HEAD)

	var body := MeshInstance3D.new()
	var body_mesh := TorusMesh.new()
	body_mesh.inner_radius = 0.14
	body_mesh.outer_radius = 0.32
	body.mesh = body_mesh
	body.position = Vector3(0, 0.22, 0)
	body.material_override = body_mat
	add_child(body)

	var head := MeshInstance3D.new()
	var head_mesh := SphereMesh.new()
	head_mesh.radial_segments = 16; head_mesh.rings = 8   # G-0260 기본 64×32 → creature_builder 값(반지름 ≤0.5m 라 눈엔 같음)
	head_mesh.radius = 0.14
	head_mesh.height = 0.26
	head.mesh = head_mesh
	head.position = Vector3(0, 0.42, 0)
	head.material_override = head_mat
	add_child(head)

	var cs := CollisionShape3D.new()
	var shape := SphereShape3D.new()
	shape.radius = 0.28
	cs.position = Vector3(0, 0.26, 0)
	cs.shape = shape
	add_child(cs)


## 두더지도깨비 — 옆으로 누운 캡슐 몸통+원뿔 주둥이 하나. 지금까지 뿔·귀·
## 날개는 늘 둘이었는데 처음으로 하나만 단다("파고드는 주둥이" 인상).
func _spawn_visual_duduji() -> void:
	var mat: ShaderMaterial = WorldCurveMaterial.vertex_color_material(CURVE_AMOUNT, 0.85, COLOR_DUDUJI)

	var body := MeshInstance3D.new()
	var body_mesh := CapsuleMesh.new()
	body_mesh.radius = 0.22
	body_mesh.height = 0.5
	body.mesh = body_mesh
	body.rotation.z = deg_to_rad(90.0)
	body.position = Vector3(0, 0.22, 0)
	body.material_override = mat
	add_child(body)

	var snout := MeshInstance3D.new()
	var snout_mesh := CylinderMesh.new()
	snout_mesh.top_radius = 0.0
	snout_mesh.bottom_radius = 0.08
	snout_mesh.height = 0.2
	snout.mesh = snout_mesh
	snout.rotation.x = deg_to_rad(90.0)
	snout.position = Vector3(0, 0.2, 0.25)
	snout.material_override = mat
	add_child(snout)

	var cs := CollisionShape3D.new()
	var shape := CapsuleShape3D.new()
	shape.radius = 0.22
	shape.height = 0.5
	cs.rotation.z = deg_to_rad(90.0)
	cs.position = Vector3(0, 0.22, 0)
	cs.shape = shape
	add_child(cs)


## 개미도깨비 — 구 셋(머리·가슴·배)을 일렬로 잇고 더듬이 원기둥 둘을
## 얹는다. 지금까지 없던 "구 사슬" 조합(dalpaeng은 구 둘뿐이었다).
func _spawn_visual_gaemi() -> void:
	var mat: ShaderMaterial = WorldCurveMaterial.vertex_color_material(CURVE_AMOUNT, 0.6, COLOR_GAEMI)

	var abdomen := MeshInstance3D.new()
	var abdomen_mesh := SphereMesh.new()
	abdomen_mesh.radial_segments = 16; abdomen_mesh.rings = 8   # G-0260 기본 64×32 → creature_builder 값(반지름 ≤0.5m 라 눈엔 같음)
	abdomen_mesh.radius = 0.14
	abdomen_mesh.height = 0.26
	abdomen.mesh = abdomen_mesh
	abdomen.position = Vector3(0, 0.14, -0.2)
	abdomen.material_override = mat
	add_child(abdomen)

	var thorax := MeshInstance3D.new()
	var thorax_mesh := SphereMesh.new()
	thorax_mesh.radial_segments = 16; thorax_mesh.rings = 8   # G-0260 기본 64×32 → creature_builder 값(반지름 ≤0.5m 라 눈엔 같음)
	thorax_mesh.radius = 0.1
	thorax_mesh.height = 0.2
	thorax.mesh = thorax_mesh
	thorax.position = Vector3(0, 0.14, 0.0)
	thorax.material_override = mat
	add_child(thorax)

	var head := MeshInstance3D.new()
	var head_mesh := SphereMesh.new()
	head_mesh.radial_segments = 16; head_mesh.rings = 8   # G-0260 기본 64×32 → creature_builder 값(반지름 ≤0.5m 라 눈엔 같음)
	head_mesh.radius = 0.09
	head_mesh.height = 0.18
	head.mesh = head_mesh
	head.position = Vector3(0, 0.14, 0.18)
	head.material_override = mat
	add_child(head)

	var ant_l := MeshInstance3D.new()
	var ant_mesh := CylinderMesh.new()
	ant_mesh.top_radius = 0.015
	ant_mesh.bottom_radius = 0.02
	ant_mesh.height = 0.18
	ant_l.mesh = ant_mesh
	ant_l.position = Vector3(-0.05, 0.26, 0.25)
	ant_l.rotation.x = deg_to_rad(-40.0)
	ant_l.material_override = mat
	add_child(ant_l)

	var ant_r: MeshInstance3D = ant_l.duplicate()
	ant_r.position = Vector3(0.05, 0.26, 0.25)
	add_child(ant_r)

	var cs := CollisionShape3D.new()
	var shape := SphereShape3D.new()
	shape.radius = 0.2
	cs.position = Vector3(0, 0.14, 0)
	cs.shape = shape
	add_child(cs)


## 개구리도깨비 — 누른(스케일 낮춘) 구 몸통+작은 구 눈 둘. "구+작은 구
## 둘" 조합은 처음이다(kkot은 구+토러스, nabi는 구+상자 날개).
func _spawn_visual_gaeguri() -> void:
	var body_mat: ShaderMaterial = WorldCurveMaterial.vertex_color_material(
		CURVE_AMOUNT, 0.55, COLOR_GAEGURI_BODY)
	var eye_mat: ShaderMaterial = WorldCurveMaterial.vertex_color_material(
		CURVE_AMOUNT, 0.3, COLOR_GAEGURI_EYE)

	var body := MeshInstance3D.new()
	var body_mesh := SphereMesh.new()
	body_mesh.radial_segments = 16; body_mesh.rings = 8   # G-0260 기본 64×32 → creature_builder 값(반지름 ≤0.5m 라 눈엔 같음)
	body_mesh.radius = 0.3
	body_mesh.height = 0.34
	body.mesh = body_mesh
	body.scale = Vector3(1.0, 0.7, 1.0)
	body.position = Vector3(0, 0.16, 0)
	body.material_override = body_mat
	add_child(body)

	var eye_l := MeshInstance3D.new()
	var eye_mesh := SphereMesh.new()
	eye_mesh.radial_segments = 16; eye_mesh.rings = 8   # G-0260 기본 64×32 → creature_builder 값(반지름 ≤0.5m 라 눈엔 같음)
	eye_mesh.radius = 0.07
	eye_mesh.height = 0.14
	eye_l.mesh = eye_mesh
	eye_l.position = Vector3(-0.12, 0.32, 0.12)
	eye_l.material_override = eye_mat
	add_child(eye_l)

	var eye_r: MeshInstance3D = eye_l.duplicate()
	eye_r.position = Vector3(0.12, 0.32, 0.12)
	add_child(eye_r)

	var cs := CollisionShape3D.new()
	var shape := SphereShape3D.new()
	shape.radius = 0.26
	cs.position = Vector3(0, 0.16, 0)
	cs.shape = shape
	add_child(cs)


## 반딧불도깨비 — 원기둥 몸통(가늘고 낮음) 위에 토러스 고리를 띄운다,
## "원기둥+토러스"는 지금까지 없던 조합(원기둥은 beoseot의 줄기로만,
## 토러스는 kkot·hangari의 몸통으로만 쓰였다). 고리를 몸통보다 밝은
## 노랑으로 갈라 "빛나는 고리를 달고 있다"는 인상을 준다.
func _spawn_visual_bandi() -> void:
	var body_mat: ShaderMaterial = WorldCurveMaterial.vertex_color_material(
		CURVE_AMOUNT, 0.7, COLOR_BANDI_BODY)
	var ring_mat: ShaderMaterial = WorldCurveMaterial.vertex_color_material(
		CURVE_AMOUNT, 0.25, COLOR_BANDI_RING)

	var body := MeshInstance3D.new()
	var body_mesh := CylinderMesh.new()
	body_mesh.top_radius = 0.16
	body_mesh.bottom_radius = 0.2
	body_mesh.height = 0.32
	body.mesh = body_mesh
	body.position = Vector3(0, 0.18, 0)
	body.material_override = body_mat
	add_child(body)

	var ring := MeshInstance3D.new()
	var ring_mesh := TorusMesh.new()
	ring_mesh.inner_radius = 0.05
	ring_mesh.outer_radius = 0.14
	ring.mesh = ring_mesh
	ring.position = Vector3(0, 0.42, 0)
	ring.material_override = ring_mat
	add_child(ring)

	var cs := CollisionShape3D.new()
	var shape := CapsuleShape3D.new()
	shape.radius = 0.2
	shape.height = 0.4
	cs.position = Vector3(0, 0.18, 0)
	cs.shape = shape
	add_child(cs)


## 그림자도깨비 — 납작한 상자 몸통(땅에 붙듯 낮음) 위에 눈 하나만 작은
## 구로 띄운다, "상자+구"는 지금까지 없던 조합(상자는 bawi·yeomso가
## 상자끼리만, 구는 여럿이 달려 온 조합만 있었다). 색은 열둘 중 가장
## 짙게(거의 검정에 가까운 보랏빛) 잡아 "그림자에 파묻혀 눈만 보인다"는
## 인상을 준다.
func _spawn_visual_geurimja() -> void:
	var body_mat: ShaderMaterial = WorldCurveMaterial.vertex_color_material(
		CURVE_AMOUNT, 0.95, COLOR_GEURIMJA)
	var eye_mat: ShaderMaterial = WorldCurveMaterial.vertex_color_material(
		CURVE_AMOUNT, 0.15, COLOR_GEURIMJA_EYE)

	var body := MeshInstance3D.new()
	var body_mesh := BoxMesh.new()
	body_mesh.size = Vector3(0.5, 0.2, 0.42)
	body.mesh = body_mesh
	body.position = Vector3(0, 0.1, 0)
	body.material_override = body_mat
	add_child(body)

	var eye := MeshInstance3D.new()
	var eye_mesh := SphereMesh.new()
	eye_mesh.radial_segments = 16; eye_mesh.rings = 8   # G-0260 기본 64×32 → creature_builder 값(반지름 ≤0.5m 라 눈엔 같음)
	eye_mesh.radius = 0.06
	eye_mesh.height = 0.12
	eye.mesh = eye_mesh
	eye.position = Vector3(0, 0.24, 0.16)
	eye.material_override = eye_mat
	add_child(eye)

	var cs := CollisionShape3D.new()
	var shape := BoxShape3D.new()
	shape.size = Vector3(0.5, 0.2, 0.42)
	cs.position = Vector3(0, 0.1, 0)
	cs.shape = shape
	add_child(cs)


func _physics_process(delta: float) -> void:
	if _player == null or not is_instance_valid(_player):
		_player = get_tree().get_first_node_in_group("player")

	if _state != State.FLEE and _player != null and \
			global_position.distance_to(_player.global_position) <= flee_radius:
		_enter_flee()

	match _state:
		State.IDLE:
			_timer -= delta
			velocity = Vector3.ZERO
			if _timer <= 0.0:
				_enter_wander()
		State.WANDER:
			_step_toward(_target, speed)
			if global_position.distance_to(_target) <= ARRIVE_DIST:
				_enter_idle()
		State.FLEE:
			_timer -= delta
			if _player != null:
				var away: Vector3 = global_position - _player.global_position
				away.y = 0
				if away.length() > 0.01:
					_target = global_position + away.normalized() * 3.0
			_step_toward(_target, flee_speed)
			if _timer <= 0.0:
				_enter_idle()

	move_and_slide()


func _step_toward(target: Vector3, spd: float) -> void:
	var to_target: Vector3 = target - global_position
	to_target.y = 0
	if to_target.length() <= ARRIVE_DIST:
		velocity = Vector3.ZERO
		return
	velocity = to_target.normalized() * spd
	look_at(global_position + Vector3(velocity.x, 0, velocity.z), Vector3.UP)


func _enter_idle() -> void:
	_state = State.IDLE
	_timer = _rng.randf_range(IDLE_TIME_MIN, IDLE_TIME_MAX)


func _enter_wander() -> void:
	_state = State.WANDER
	var angle := _rng.randf_range(0.0, TAU)
	var dist := _rng.randf_range(wander_radius * 0.3, wander_radius)
	_target = den + Vector3(cos(angle), 0.0, sin(angle)) * dist


func _enter_flee() -> void:
	_state = State.FLEE
	_timer = FLEE_TIME
