extends Node3D

## VERTICAL_SLICE_REALM.md 2절 결정 — "렌더링 계층만 새로 얹는다". 웹판
## `city3d.js`를 실측(2026-09-12)한 뒤 그 핵심 개념을 옮겼다: "장식이 아니라
## 읽는 화면"(원문 그대로) — 성 숫자(개간·상업·군량·로스터)를 그대로 센
## 소품 개수로 디오라마를 짓는다. 새 판정은 없다, 숫자를 셀 뿐이다.
##
## **재해석 — 이 슬라이스가 안 가진 값은 뺐다.** 원작은 성벽 파손율(wall/
## maxWall)·인구(pop)까지 세는데, 이 슬라이스엔 축성·인구 명령이 없어(3·4절
## "제외") 그 값 자체가 없다. 그래서:
## - 성벽은 파손 없이 늘 꽉 찬 넷(기존 그대로 유지)
## - "집(인구)" 자리 대신 **로스터(무장) 깃발**을 세운다 — 이 슬라이스가
##   실제로 갖고 있는 값이라 더 정직하다
## - 시장(상업)·밭(개간)·곳간(군량)은 원작 그대로: 개수 = clamp(round(수치
##   /기준),최소,최대)
## - **2026-09-12 추가 — 치안(sec)이 명령으로 들어와 값이 생겼다.**
##   city3d.js "치안이 높으면 횃불 하나가 더 선다"(sec>=80)를 그대로
##   옮겨 셋째 횃불을 `_dyn` 아래로 옮겼다(값에 물리니 고정 소품이 아니다).
## - **2026-09-12 추가 — 여러 성(진류·복양·허창).** 디오라마는 여전히
##   하나뿐이다("성 하나를 3D로 조망한다", 1절) — `RealmSaveState.
##   current_city`가 가리키는 성의 값을 읽어 같은 자리에서 다시 짓는다.
##   성 버튼(`realm_city_button.gd`)으로 current_city가 바뀌면 sig()가
##   달라져 자동으로 다시 지어진다. 세 성을 동시에 한 지도 위에 띄우는
##   realm3d.js식 월드맵은 아직 안 만들었다(다음에 볼 자리).
##
## 대(기단)+누각(망루)+담장은 고정(전 세션에 지음, 안 바꿨다). 이 디오라마
## 링만 원작 `city3d.js` `build()`의 sig() 비교 방식(값이 바뀔 때만 다시
## 짓는다)을 그대로 옮겨 매 프레임 재생성을 피한다.

const WorldCurveMaterial := preload("res://saga_core/world/world_curve_material.gd")
const ChoicePrompt := preload("res://saga_core/ui/choice_prompt.gd")
const RealmCities := preload("res://games/saga_realm/data/realm_cities.gd")

const COLOR_BASE := Color(0.56, 0.5, 0.4)     # 흙빛 기단
const COLOR_TOWER := Color(0.68, 0.6, 0.46)   # 누각(망루)
const COLOR_WALL := Color(0.42, 0.38, 0.3)    # 담장
const COLOR_FARM := Color(0.42, 0.58, 0.24)   # 밭(개간)
const COLOR_MARKET := Color(0.74, 0.56, 0.28) # 시장(상업)
const COLOR_MARKET_ROOF := Color(0.6, 0.24, 0.2)
const COLOR_GRANARY := Color(0.5, 0.36, 0.2)  # 곳간 통나무(군량)
const COLOR_BANNER_POLE := Color(0.3, 0.28, 0.24)
const COLOR_WELL := Color(0.55, 0.55, 0.58)
const COLOR_TORCH_POLE := Color(0.25, 0.2, 0.15)
const COLOR_TORCH_FLAME := Color(0.95, 0.55, 0.15)

## city3d.js build()의 기준값 그대로 — 밭 90·시장 80·곳간 400 단위마다 하나.
const FARM_PER := 90.0
const MARKET_PER := 80.0
const GRANARY_PER := 400.0

var _dyn: Node3D
var _last_sig := ""


## **2026-09-14 추가 — 새 게임 시나리오 고르기(REALM 4절 "제외" 마지막
## 후속 작업).** `try_load()`가 세이브를 못 찾으면(진짜 새 게임 — 파일이
## 아예 없거나 SAVE_VERSION이 안 맞는 옛 세이브, 둘 다 지금까지도 조용히
## 194로 부팅해 왔다) 시나리오를 고르게 한다. 고정 소품(기단·누각·담장,
## 시나리오·현재 성과 무관)은 고르는 동안에도 그대로 짓는다 — 고른
## 직후엔 새 함수가 따로 필요 없다, `_process()`의 `_rebuild_if_changed()`
## 가 이미 매 프레임 sig()로 "값이 바뀌었나"만 보고 있어 `start_scenario()`
## 가 바꾼 현재 성 값을 다음 프레임에 저절로 집어 든다.
func _ready() -> void:
	## 가로 화면이면 UI 기준 크기를 바꿔 글자가 깨알만 하지 않게(saga_core/ui/orientation_scale.gd).
	add_child(preload("res://saga_core/ui/orientation_scale.gd").new())
	preload("res://saga_core/audio/bgm_picker.gd").attach(self, func() -> String: return "realm-field" if RealmSaveState.viewing_map else "realm-town")  # 배경음(G-0013) — 지도 화면이면 들판, 성이면 마을
	## 자동 저장(saga_core/world/autosave_timer.gd) — 60초마다·앱 멈춤 때. 시나리오를 고르는 중에는 안 한다.
	preload("res://saga_core/world/autosave_timer.gd").attach(self, RealmSaveState.save, func() -> bool: return RealmSaveState.scenario_ready)
	if not RealmSaveState.try_load():
		RealmSaveState.scenario_ready = false
		_show_scenario_picker()
	RealmSaveState.begin_session()
	_build_base()
	_build_tower()
	_build_walls()
	_build_fixtures()
	_build_scenery()

	_dyn = Node3D.new()
	_dyn.name = "Diorama"
	add_child(_dyn)


func _show_scenario_picker() -> void:
	var layer_box := {}
	var choices: Array = [
		{"label": "194년 · 군웅할거 (패헌, 성 3곳)",
		 "cb": func() -> void: _pick_scenario("194", layer_box)},
		{"label": "200년 · 관도 (패헌, 성 8곳)",
		 "cb": func() -> void: _pick_scenario("200", layer_box)},
		{"label": "208년 · 적벽 (패헌, 성 19곳)",
		 "cb": func() -> void: _pick_scenario("208", layer_box)},
	]
	layer_box["layer"] = ChoicePrompt.build(self, "새 게임 — 시나리오를 고른다", choices)


func _pick_scenario(id: String, layer_box: Dictionary) -> void:
	(layer_box["layer"] as CanvasLayer).queue_free()
	RealmSaveState.start_scenario(id)


## **2026-09-12 추가 — 월드맵과 화면을 나눠 쓴다.** RealmSaveState.
## viewing_map이 켜지면(realm_map_button.gd) 이 디오라마를 숨기고 리빌드도
## 건너뛴다 — realm_worldmap.gd가 대신 보인다.
func _process(_delta: float) -> void:
	visible = not RealmSaveState.viewing_map
	if visible:
		_rebuild_if_changed()
	_refresh_goal_board()


## saga_core/ui/goal_board.gd는 RealmSaveState·RealmCities를 모른다(GO
## test_village.gd 헤더와 같은 경계). REALM엔 신호 배선이 없어(realm_
## status_label.gd 선례대로) goal_board도 _process() 폴링으로 갱신.
## "지금"은 "성 편입" 진행도(멸망시킨 적 성을 포함한 전체 지도 107 중
## 지금 내 것). "세션"은 골드+편입 델타(RealmSaveState.begin_session()/
## session_gold_gained()/session_cities_gained() 신규).
## **2026-09-17 추가 — PLAN 101-2 REALM ②후보(승리 조건 4) 웹판 §5-5 UI
## 메모 "셋째 줄이 가장 가까운 승리 조건 + 진척 %"를 채운다** — 다른
## 네 판의 "주간 축 없음"과 달리 REALM은 이미 승리 조건 진척이라는 실제
## 값이 생겨 "—"로 안 둔다. 정복·문화·외교 셋 중 가장 가까운(퍼센트가
## 가장 높은) 것만 보여준다(패권·생존은 이번 세션 범위 밖이라 안 낀다).
func _refresh_goal_board() -> void:
	var board := get_tree().get_first_node_in_group("goal_board")
	if board == null:
		return
	var total := RealmCities.CITIES.size() + RealmCities.ENEMY_CITIES.size()
	var now := "성 %d/%d 편입" % [RealmSaveState.cities.size(), total]
	var session := "골드 +%d · 편입 +%d" % [
		RealmSaveState.session_gold_gained(), RealmSaveState.session_cities_gained()]
	var week := _closest_victory_progress()
	board.set_goals(now, session, week)


func _closest_victory_progress() -> String:
	if not RealmSaveState.result.is_empty():
		return "승리 달성"
	var total := RealmCities.CITIES.size() + RealmCities.ENEMY_CITIES.size()
	var conquer_pct := float(RealmSaveState.cities.size()) / float(total) * 100.0
	var culture_pct := float(RealmSaveState.quiz.get("correct", 0)) / float(RealmSaveState.CULTURE_VICTORY_CORRECT) * 100.0
	var diplo_pct := float(RealmSaveState.diplomacy_peace_streak) / float(RealmSaveState.DIPLOMACY_VICTORY_MONTHS) * 100.0
	var best_label := "천하통일"
	var best_pct := conquer_pct
	if culture_pct > best_pct:
		best_pct = culture_pct
		best_label = "문화"
	if diplo_pct > best_pct:
		best_pct = diplo_pct
		best_label = "외교"
	return "%s 진척 %d%%" % [best_label, mini(100, int(best_pct))]


## city3d.js sig()/render() 그대로 — 성이 다르거나(current_city) 숫자가
## 바뀌었을 때만 다시 짓는다(매 프레임 재생성 방지).
func _rebuild_if_changed() -> void:
	var city_id := RealmSaveState.current_city
	var c: Dictionary = RealmSaveState.cities.get(city_id, {})
	var sig := "%s:%d:%d:%d:%d:%s" % [
		city_id, int(c.get("agri", 0)), int(c.get("comm", 0)),
		int(c.get("food", 0)), int(c.get("sec", 0)),
		",".join(RealmSaveState.roster)]
	if sig == _last_sig:
		return
	_last_sig = sig

	for ch in _dyn.get_children():
		ch.queue_free()
	_build_farms(c)
	_build_markets(c)
	_build_granary(c)
	_build_roster_banners()
	_build_sec_torch(c)


## 2026-09-30 — 성 둘레가 하늘 아래 반구(빈 안개)였다(창 모드 TestCity). 풀밭 원반 + GO 마을 나무·바위 고리로 자리를 깐다.
const SCENERY_TREES := [
	"res://assets/world/tree_broadleaf_01.glb",
	"res://assets/world/tree_broadleaf_02.glb",
	"res://assets/world/tree_birch_01.glb",
	"res://assets/world/tree_pine_01.glb",
	"res://assets/world/tree_pine_02.glb",
]
## G-0017(10-04) 통일 툰 GLB — 배율은 옛과 비슷한 높이(나무 약 1.5m·바위 약 1m)로 그대로 둔다(활엽 6.6·소나무 8.3m 실측 ≈ 옛 7.3m).
const SCENERY_ROCK := "res://assets/world/rock_large_01.glb"


func _build_scenery() -> void:
	var root := Node3D.new()
	root.name = "Scenery"
	add_child(root)
	var ground := MeshInstance3D.new()
	var disc := CylinderMesh.new()
	disc.top_radius = 46.0
	disc.bottom_radius = 46.0
	disc.height = 0.4
	ground.mesh = disc
	ground.position = Vector3(0, -0.2, 0)
	ground.material_override = _mat(Color(0.34, 0.52, 0.24))
	root.add_child(ground)
	for i in 34:
		var ang := TAU * (float(i) + 0.5 * absf(sin(float(i) * 12.9898))) / 34.0
		var r := 9.5 + 9.0 * absf(fmod(sin(float(i) * 78.233) * 43758.5453, 1.0))
		var glb: String = SCENERY_ROCK if i % 7 == 3 else SCENERY_TREES[i % SCENERY_TREES.size()]
		var ps := load(glb) as PackedScene
		if ps == null:
			continue
		var n := ps.instantiate() as Node3D
		var sc := 0.16 + 0.1 * absf(fmod(sin(float(i) * 39.346) * 12345.6789, 1.0)) if glb != SCENERY_ROCK else 0.5
		n.scale = Vector3.ONE * sc
		n.rotation.y = float(i) * 2.4
		n.position = Vector3(cos(ang) * r, 0.0, sin(ang) * r)
		root.add_child(n)


func _build_base() -> void:
	var mi := MeshInstance3D.new()
	var mesh := CylinderMesh.new()
	mesh.top_radius = 4.2
	mesh.bottom_radius = 4.6
	mesh.height = 0.6
	mi.mesh = mesh
	mi.position = Vector3(0, 0.3, 0)
	mi.material_override = _mat(COLOR_BASE)
	add_child(mi)


## 2026-09-30 — 원기둥+원뿔 대신 asset-forge 망루 GLB(폭 8.8·높이 18.8m → 0.36배).
func _build_tower() -> void:
	const OLD := "res://assets/generated/props/tower_s1_01.glb"
	var ps := WorldAsset.load_scene(OLD)
	if ps == null:
		return
	var n := ps.instantiate() as Node3D
	n.scale = Vector3.ONE * 0.36 * WorldAsset.k(OLD)
	n.position = Vector3(0, 0.6, 0)
	add_child(n)


## 담장 넷 — 기단 둘레에 상자를 사방으로 두른다(포위·공성은 이 슬라이스
## 밖이라 순전히 실루엣용, 충돌체 없음, 파손율도 없어 늘 꽉 차 있다).
func _build_walls() -> void:
	var offsets := [Vector3(0, 0, -3.6), Vector3(0, 0, 3.6), Vector3(-3.6, 0, 0), Vector3(3.6, 0, 0)]
	for off: Vector3 in offsets:
		var mi := MeshInstance3D.new()
		var mesh := BoxMesh.new()
		var along_x: bool = absf(off.x) > absf(off.z)
		mesh.size = Vector3(1.6, 1.2, 6.0) if along_x else Vector3(6.0, 1.2, 1.6)
		mi.mesh = mesh
		mi.position = off + Vector3(0, 0.9, 0)
		mi.material_override = _mat(COLOR_WALL)
		add_child(mi)


## city3d.js build() 끝자락 "우물·횃불 — 늘 있는 살림"을 그대로 — 이 둘은
## 값에 안 물려 한 번만 짓는다. 셋째 횃불(치안 조건부)은 `_build_sec_torch()`
## 로 따로 뺐다 — `_dyn`에 물려 값이 바뀔 때만 다시 짓는다.
func _build_fixtures() -> void:
	_well(Vector3(4.0, 0, -2.2))
	_torch(self, Vector3(2.4, 0, 3.8))
	_torch(self, Vector3(-2.4, 0, 3.8))


func _well(pos: Vector3) -> void:
	var mi := MeshInstance3D.new()
	var mesh := CylinderMesh.new()
	mesh.top_radius = 0.35
	mesh.bottom_radius = 0.4
	mesh.height = 0.5
	mi.mesh = mesh
	mi.position = pos + Vector3(0, 0.25, 0)
	mi.material_override = _mat(COLOR_WELL)
	add_child(mi)


func _torch(parent: Node3D, pos: Vector3) -> void:
	var pole := MeshInstance3D.new()
	var pole_mesh := CylinderMesh.new()
	pole_mesh.top_radius = 0.05
	pole_mesh.bottom_radius = 0.06
	pole_mesh.height = 1.1
	pole.mesh = pole_mesh
	pole.position = pos + Vector3(0, 0.55, 0)
	pole.material_override = _mat(COLOR_TORCH_POLE)
	parent.add_child(pole)

	var flame := MeshInstance3D.new()
	var flame_mesh := SphereMesh.new()
	flame_mesh.radius = 0.13
	flame_mesh.height = 0.26
	flame.mesh = flame_mesh
	flame.position = pos + Vector3(0, 1.18, 0)
	flame.material_override = _mat(COLOR_TORCH_FLAME)
	parent.add_child(flame)


## city3d.js "치안이 높으면 횃불 하나가 더 선다"(sec>=80) 그대로.
func _build_sec_torch(c: Dictionary) -> void:
	if int(c.get("sec", 0)) >= 80:
		_torch(_dyn, Vector3(0, 0, -4.6))


## 밭 — 개간(agri). city3d.js: clamp(round(agri/90), 2, 6).
func _build_farms(c: Dictionary) -> void:
	var n := clampi(roundi(float(c.get("agri", 0)) / FARM_PER), 2, 6)
	var wheat := load("res://assets/world/wheat_ripe_01.glb") as PackedScene
	for p: Vector2 in _ring(n, 6.4, -2.0):
		var mi := MeshInstance3D.new()
		var mesh := BoxMesh.new()
		mesh.size = Vector3(1.1, 0.12, 0.8)
		mi.mesh = mesh
		mi.position = Vector3(p.x, 0.06, p.y)
		mi.material_override = _mat(COLOR_FARM.darkened(0.45))
		_dyn.add_child(mi)
		## 2026-09-30 — 흙밭 위에 밀 포기. G-0020: 통일 툰 wheat_ripe_01(1.3m 폭 무리) 두 덩이를 0.42배로(폭 0.55m·높이 0.45m).
		if wheat != null:
			for ix in 2:
				var w := wheat.instantiate() as Node3D
				w.scale = Vector3.ONE * 0.42
				w.position = Vector3(p.x + (float(ix) - 0.5) * 0.5, 0.12, p.y)
				_dyn.add_child(w)


## 시장 — 상업(comm). city3d.js: clamp(round(comm/80), 1, 5).
func _build_markets(c: Dictionary) -> void:
	var n := clampi(roundi(float(c.get("comm", 0)) / MARKET_PER), 1, 5)
	const OLD := "res://assets/generated/props/market_s1_01.glb"
	var ps := WorldAsset.load_scene(OLD)
	for p: Vector2 in _ring(n, 5.6, 1.1):
		if ps == null:
			continue
		## K-0057 통일 툰 좌판 GLB(옛 폭 4m 기준 0.3배 × WorldAsset 배율), 정면이 성 쪽을 보게.
		var stall := ps.instantiate() as Node3D
		stall.scale = Vector3.ONE * 0.3 * WorldAsset.k(OLD)
		stall.position = Vector3(p.x, 0.0, p.y)
		stall.rotation.y = atan2(-p.x, -p.y)
		_dyn.add_child(stall)


## 곳간 통나무 — 군량(food). city3d.js: clamp(round(food/400)+1, 1, 4).
func _build_granary(c: Dictionary) -> void:
	var n := clampi(roundi(float(c.get("food", 0)) / GRANARY_PER) + 1, 1, 4)
	## 2026-09-30 — 통나무 대신 작은 곳간채(asset-forge house_s2_02, 폭 10m → 0.15배)가 군량만큼 늘어선다.
	const OLD := "res://assets/generated/props/house_s2_02.glb"
	var ps := WorldAsset.load_scene(OLD)
	for i in n:
		var p := Vector3(-6.4, 0.0, -3.4 + float(i) * 2.0)
		var h := ps.instantiate() as Node3D
		h.scale = Vector3.ONE * 0.15 * WorldAsset.k(OLD)
		h.position = p
		h.rotation.y = atan2(-p.x, -p.z)
		_dyn.add_child(h)


## 로스터 깃발 — 원작에 없는, 이 슬라이스만의 값(무장 수). 등용에 성공할
## 때마다 깃발이 하나 는다.
func _build_roster_banners() -> void:
	for p: Vector2 in _ring(RealmSaveState.roster.size(), 4.9, 3.6):
		var pole := MeshInstance3D.new()
		var pole_mesh := CylinderMesh.new()
		pole_mesh.top_radius = 0.04
		pole_mesh.bottom_radius = 0.05
		pole_mesh.height = 1.4
		pole.mesh = pole_mesh
		pole.position = Vector3(p.x, 0.7, p.y)
		pole.material_override = _mat(COLOR_BANNER_POLE)
		_dyn.add_child(pole)

		var flag := MeshInstance3D.new()
		var flag_mesh := BoxMesh.new()
		flag_mesh.size = Vector3(0.5, 0.32, 0.02)
		flag.mesh = flag_mesh
		flag.position = Vector3(p.x + 0.27, 1.2, p.y)
		flag.material_override = _mat(COLOR_TOWER)
		_dyn.add_child(flag)


## city3d.js ring(n, r, startAng) 그대로 — 중심 기준 원 위에 n개를 고르게.
func _ring(n: int, r: float, start_ang: float) -> Array:
	var pts: Array = []
	for i in n:
		var a: float = start_ang + (float(i) / float(n)) * TAU
		pts.append(Vector2(cos(a) * r, sin(a) * r))
	return pts


func _mat(color: Color) -> ShaderMaterial:
	## REALM은 1절 결정에 구면 투영이 없다(월드맵 조망이지 걸어다니는 판이
	## 아니다) — 그래도 WorldCurveMaterial을 쓰는 건 curve_amount를 0으로
	## 둬 다른 네 판과 셰이더 하나를 공유하기 위해서다(saga_core 공용화
	## 경계, 새 머티리얼 종류를 안 늘린다).
	return WorldCurveMaterial.vertex_color_material(0.0, 0.9, color)
