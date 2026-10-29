extends Node3D

## VERTICAL_SLICE_REALM.md가 "다음에 볼 자리"로 여러 번 미뤄 온 realm3d.js식
## 월드맵의 첫 슬라이스(2026-09-12, "응 진행해") — 성 셋을 한 지도에 동시에
## 띄워 한눈에 본다. realm3d.js 전체(1006줄: 성 서른 곳·heightmap 지형·
## 해협·드래그 궤도 카메라)를 옮기지 않았다 — **재해석**: 이 슬라이스는
## 성이 셋뿐이라 지형 기복·바다 같은 지리적 디테일이 아직 값도 없다(축성
## 파손율처럼 없는 값은 안 그린다는 realm_city.gd와 같은 원칙). 그래서
## 이번엔 평평한 바닥 + 성마다 표지(marker) 하나 + 지금 조망 중인 성
## 강조만 옮겼다.
##
## 좌표는 data-city.js의 x·y(0~100, 지도 비율, `realm_cities.gd` CITIES)를
## 실측해 그대로 썼다 — 성 위치의 방향·비율은 원작 그대로, 축척(WORLD_SCALE)
## 만 성 셋짜리 슬라이스에 맞게 새로 골랐다(realm3d.js의 4.5는 성 서른 곳이
## 지도 전체에 퍼진 걸 가정한 값이라 그대로 쓰면 마커 셋이 한 덩어리로
## 겹친다).
##
## **2026-09-12 추가 — 성표 탭으로 조망 대상 바꾸기.** realm3d.js의
## "성을 탭하면 그 성을 연다"는 핵심 상호작용을 옮겼다(`ui.openCity()`
## 대신 이 슬라이스가 가진 것 — `current_city`를 바꾸는 것 — 을 부른다,
## 재해석). Area3D 물리 피킹(`get_viewport().physics_object_picking`)을
## 쓴다 — 이 프로젝트에 3D 오브젝트 탭 판정이 처음이라 새 패턴이지만,
## project.godot에 새 입력 액션·물리 레이어를 안 늘려도 되는 가장 가벼운
## 길이다(마우스·터치 둘 다 커버 — Godot 기본값이 터치를 마우스로도
## 흉내 낸다). 성 하나뿐인 디오라마 화면(realm_city.gd)에도 같은 좌표계
## 공간이 있지만 그 카메라의 시야가 원점 근처(반경 6~16)뿐이라 실수로
## 안 겹친다 — 그래도 숨어 있는 동안은 `input_ray_pickable`을 꺼서
## 확실히 막는다.
##
## **하지 않은 것(다음에 볼 자리)** — 지형 기복·해협
## (드래그 궤도 카메라는 realm_worldmap_camera.gd에서 옮겼다).
##
## **2026-09-12 추가 — 정복 성 편입.** 함락하면(`RealmSaveState.
## enemies[id].captured`) `_process()`가 그걸 보고 마커 색을 바꾼다 —
## 매 프레임 가볍게 폴링한다(FOREST gather_label.gd와 같은 폴링 결).
## **2026-09-14 정정 — "마커를 하나 더 짓는다"에서 바뀌었다.** 아래
## 항목이 104개 적 성 마커를 `_ready()`에서 전부 미리 세워 두게 되며,
## 함락 시엔 이제 그 마커의 색만 우호색으로 바꾼다(`_check_annexed()`
## 참고) — 마커 자체는 이미 있다.
##
## **2026-09-14 추가 — 미정복 적 성도 지도에 세운다(REALM 4절 "제외"
## "3D 몬스터 자산"의 첫 걸음).** 이전엔 CITIES(우리 성) + 함락한 성만
## 마커가 있어 미정복 104개는 지도에서 통째로 안 보였다. 실제 3D 몬스터
## 모델은 아직 없으니(66-2장 카툰 셰이더/에셋 파이프라인이 REALM까지
## 안 왔다) 색으로만 구분한 자리표시자를 세운다 — 보통 적 성은 붉은색,
## 보스급 수비 무장(균열·폐허·묘역 등 지역 허브 여섯)이 있는 성은 보라색.
## 탭하면(아직 우리 성이 아니므로) 이름만 토스트로 보여주고 조망 대상은
## 안 바뀐다 — `realm_city.gd`/명령 실행이 전제하는 "current_city는 항상
## `cities`에 있다"를 안 깬다.
##
## **2026-09-14 추가 — 적/보스 성은 깃발 대신 몬스터 실루엣.** 위 항목이
## 색만으로 적/보스를 구분했는데, 이번엔 그 자리에 실제 "몬스터가 지키고
## 있다"는 형태를 얹는다 — 실제 CC0 몬스터 GLB는 여전히 없으니(66-2장
## 카툰 파이프라인이 REALM까지 안 왔다) GO `animal_builder.gd`(사슴·소를
## 어울리는 킷이 없어 box 조합으로 대신한 것)와 같은 결로 코드가 그리는
## primitive 몸통+뿔이다. 보스는 몸통이 크고 뿔이 셋, 일반 적은 몸통이
## 작고 뿔이 하나 — 색뿐 아니라 형태로도 구분된다. 함락되면(`_check_
## annexed()`) 이 실루엣을 지우고 원래 깃발로 되돌린다(이제 우리 성이니).

const RealmCities := preload("res://games/saga_realm/data/realm_cities.gd")
const RealmCampaign := preload("res://games/saga_realm/data/realm_campaign.gd")
const WorldCurveMaterial := preload("res://saga_core/world/world_curve_material.gd")
const Toast := preload("res://saga_core/ui/toast.gd")
const Characters := preload("res://saga_core/data/characters.gd")

## **2026-09-14 정정 — WORLD_SCALE은 realm_cities.gd로 옮겼다.** 여기 있던
## 상수(14.0, 값은 그대로)를 `realm_worldmap_camera.gd`도 같이 봐야 해서
## 옮겼다(자세한 사정은 `RealmCities.WORLD_SCALE` 머리말 참고).
##
## **GROUND_SPAN 260 → 6000 — "월드맵 좌표계 몰아서 말고 지금 바로
## 확인해줘"로 발견된 문제.** 260은 성 셋(반경 130)만 가정한 값이라, 16·
## 17절에서 107성을 다 채운 지금은 어긋난다 — 실제로 확인해 보니 107개
## 중 103개(하비 포함, xiapi도 이미 260 밖이었다)의 마커가 이 평면
## 바깥에 떴다(임시 스크립트로 좌표를 다 뽑아 확인, 가장 먼 성 jinhon이
## 원점에서 2679 단위 — 260의 절반 130을 훌쩍 넘는다). **GROUND_SPAN만
## 6000으로 키운다** — 평면 메시는 세분(subdivide) 없이 사각형 하나라
## 커져도 비용이 없다. `WORLD_SCALE`은 그대로 둔다(줄이면 처음 3성
## 클러스터가 다닥다닥 붙어 보이는 문제가 되돌아온다 — 근접한 세 성과
## 저 먼 107성을 동시에 "적당한 크기"로 보여줄 하나의 축척은 없다,
## 카메라 쪽 정정과 짝을 이룬다).
const GROUND_SPAN := 6000.0
const COLOR_GROUND := Color(0.42, 0.48, 0.32)
const MAP_TILE_SCALE := 0.04   # G-0252 지도는 높이 떠서 보므로 사진 결을 크게(기본 0.4 는 멀리서 자글자글) · G-0259 0.1 → 0.04(0.06·0.04 컷 비교 — 0.1 은 중간부터 밉맵에 녹아 민 초록)
const COLOR_FLAG := Color(0.85, 0.8, 0.7)
const COLOR_CURRENT := Color(0.95, 0.75, 0.2)
const LAND_COLOR := {"plain": Color(0.74, 0.62, 0.4), "river": Color(0.42, 0.58, 0.66)}
## **2026-09-14 추가 — 미정복 적 성(REALM 4절 "제외" "3D 몬스터 자산"의
## 첫 걸음).** 이 슬라이스엔 GLB 몬스터 모델이 없어(위 66-2장 참고) 실제
## 몬스터를 세우는 대신, 지금까지 지도에서 아예 안 보이던 미정복 104개
## 성을 색으로만 구분해 세운다 — 코드가 그리는 자리표시자(다른 다섯 판의
## Enemy/Boss 캡슐과 같은 결). 보스급 수비 무장(균열·폐허·묘역 등 여섯
## 지역 허브)이 있는 성만 따로 도드라진 색을 쓴다.
const COLOR_ENEMY := Color(0.55, 0.18, 0.16)
const COLOR_BOSS := Color(0.7, 0.12, 0.62)
const TOAST_SEC := 2.0
const TAP_RADIUS := 2.6  # 기둥(반경 0.7)보다 훨씬 넉넉하게 — 손가락 탭 판정
const TAP_HEIGHT := 4.5

var _markers: Dictionary = {}    # city_id -> MeshInstance3D(성표(城標) 기둥, 강조 대상)
var _monsters: Dictionary = {}   # eid -> Node3D(적/보스 성 위 몬스터 실루엣, 함락되면 지운다)
var _areas: Dictionary = {}      # city_id -> Area3D(탭 판정)
var _base_color: Dictionary = {} # city_id -> Color(강조 아닐 때 되돌아갈 색 — 우호/적/보스)
var _annexed_seen: Dictionary = {} # eid -> true(색을 이미 우호색으로 한 번 바꿨다)
var _last_current := ""
var _last_visible := false
var _flags: Dictionary = {}     # G-0347 city_id -> 깃발(지역 거르기가 같이 숨긴다)
var _markers_built := false  # RealmSaveState.scenario_ready가 false인 동안 미룬다


## **2026-09-14 정정 — 우호 마커는 이제 `RealmCities.CITIES`(194 고정 셋)가
## 아니라 `RealmSaveState.cities.keys()`를 돈다.** 시나리오가 194가
## 아니면(예: 200) 처음부터 우리 것인 성이 세 곳보다 많아지는데,
## `RealmCities.CITIES`는 여전히 194의 세 곳으로 고정된 상수라 이걸로
## 도는 한 시나리오 200의 낙양·장안 등은 우호 마커를 못 받는다. 실제
## "지금 우리 성이 뭔가"의 출처는 언제나 `RealmSaveState.cities`다.
var _world_env: WorldEnvironment
var _env_original: Environment
var _env_no_fog: Environment


func _ready() -> void:
	get_viewport().physics_object_picking = true
	_build_ground()
	var supply_lines := Node3D.new()   # G-0239 진 보급 선(초록 이어짐·빨강 끊김)
	supply_lines.name = "SupplyLines"
	supply_lines.set_script(preload("res://games/saga_realm/world/realm_supply_lines.gd"))
	add_child(supply_lines)
	var wonder_towers := Node3D.new()   # G-0243 완공 불가사의 탑(우리 금빛·남 잿빛)
	wonder_towers.name = "WonderTowers"
	wonder_towers.set_script(preload("res://games/saga_realm/world/realm_wonder_towers.gd"))
	add_child(wonder_towers)
	_world_env = get_parent().get_node("WorldEnvironment")
	_env_original = _world_env.environment
	if RealmSaveState.scenario_ready:
		_build_all_markers()
	preload("res://games/saga_realm/world/realm_region_view.gd").attach(self)   # G-0347 지역 단위 지도(SAGA_REALM_SRPG=0 이면 없음)


## **실기로 발견(2026-09-22)** — env_pc.tres의 안개(fog_density 0.012)는
## 걸어다니는 인간 스케일(수십 m)에 맞춘 값이라, 월드맵 카메라~성 거리
## (수백 단위, WORLD_SCALE=14)에서는 `exp(-density*distance)`가 거의 0이
## 돼 화면 전체가 안개색으로 덮인다 — 성표·바닥이 다 계산대로 자리해
## 있어도(좌표·마커 개수 다 정상) 안개에 먹혀 안 보였다. 지도를 보는
## 동안만 안개 끈 사본으로 바꾸고, 나갈 때 원래 환경(디오라마용)으로
## 되돌린다 — env_pc.tres 원본은 손 안 댄다(다섯 판이 같이 쓰는 리소스).
func _apply_fog_override(showing_map: bool) -> void:
	if _world_env == null or _env_original == null:
		return
	if showing_map:
		if _env_no_fog == null:
			_env_no_fog = _env_original.duplicate()
			_env_no_fog.fog_enabled = false
		_world_env.environment = _env_no_fog
	else:
		_world_env.environment = _env_original


## **2026-09-14 추가 — 새 게임 시나리오 고르기와 짝을 이룬다.**
## `realm_city.gd`가 시나리오 선택 패널을 띄우는 동안은 `RealmSaveState.
## scenario_ready`가 false라 `_ready()`가 마커 세우기를 건너뛴다(그
## 시점엔 "우리 성이 어디인가"가 아직 안 정해졌다) — 매 프레임 `_process()`
## 가 그 값이 true로 바뀌는 순간(선택 완료)을 잡아 한 번만 세운다.
func _build_all_markers() -> void:
	_markers_built = true
	for city_id: String in RealmSaveState.cities.keys():
		_build_marker(RealmCities.any_by_id(city_id), _land_color(city_id), false)
	for e: Dictionary in RealmCities.ENEMY_CITIES:
		var eid := String(e.id)
		## 시나리오가 우리 것으로 준 성은 건너뛴다(위 루프가 이미 우호
		## 마커를 세웠다) — `RealmSaveState.enemies`에 없으면 이 시나리오
		## 에서 애초에 적이 아니다(`_init_enemies()` 참고).
		if not RealmSaveState.enemies.has(eid):
			continue
		if bool(RealmSaveState.enemies[eid].get("captured", false)):
			_annexed_seen[eid] = true
			_build_marker(e, _land_color(eid), false)
		else:
			_build_marker(e, COLOR_BOSS if _is_boss_city(eid) else COLOR_ENEMY, true)


## realm_city.gd/realm_camera.gd와 같은 손잡이(RealmSaveState.viewing_map)를
## 폴링한다(FOREST gather_label.gd 폴링 패턴과 같은 결) — 숨어 있는 동안은
## 강조 갱신도, 탭 판정도 건너뛴다.
func _process(_delta: float) -> void:
	## G-0259 — 보이기·안개 사본 토글은 시나리오 확정 전에도 한다(전엔 아래 return 이 먼저라 세이브 없는 첫 판에선
	## 지도가 성 화면에서도 보인 채였고, 지도를 켜도 안개 사본이 안 걸려 rk_map_wide 컷이 안개에 먹혔다 — probe_realm_map_fog).
	visible = RealmSaveState.viewing_map and not RealmCampaign.enabled()
	if visible != _last_visible:
		_last_visible = visible
		_apply_fog_override(visible)
		for city_id: String in _areas:
			(_areas[city_id] as Area3D).input_ray_pickable = visible and (_areas[city_id] as Area3D).is_visible_in_tree()   # G-0347 다른 지역 성표는 숨어 있음
	if not _markers_built:
		if not RealmSaveState.scenario_ready:
			return  # 아직 시나리오를 안 골랐다 — 이번 프레임엔 할 일이 없다
		_build_all_markers()
		for city_id: String in _areas:   # 방금 세운 성표도 지금 보이기에 맞춘다
			(_areas[city_id] as Area3D).input_ray_pickable = visible
	_check_annexed()
	if not visible:
		return

	var cur: String = RealmSaveState.current_city
	if cur == _last_current:
		return
	_last_current = cur
	for city_id: String in _markers:
		var marker: MeshInstance3D = _markers[city_id]
		marker.material_override = _mat(COLOR_CURRENT if city_id == cur else _base_color.get(city_id, _land_color(city_id)))


## **2026-09-14 추가 — 미정복 성은 current_city가 될 수 없다.** 실기(diorama,
## `realm_city.gd`)·명령 실행이 전부 `RealmSaveState.cities`에 있는 성만
## 전제하고 있어(3절 "포함"), 정복 전 적 성을 조망 대상으로 넘기면 그
## 전제가 깨진다 — 탭해도 정보만 토스트로 보여주고 상태는 안 바꾼다.
func _on_marker_input(_camera: Node, event: InputEvent, _pos: Vector3, _normal: Vector3,
		_shape_idx: int, city_id: String) -> void:
	var pressed := false
	if event is InputEventMouseButton:
		var mb := event as InputEventMouseButton
		pressed = mb.pressed and mb.button_index == MOUSE_BUTTON_LEFT
	elif event is InputEventScreenTouch:
		var st := event as InputEventScreenTouch
		pressed = st.pressed and st.index == 0
	if not pressed:
		return
	var city_def := RealmCities.any_by_id(city_id)
	if RealmSaveState.cities.has(city_id):
		RealmSaveState.current_city = city_id
		Toast.show(self, "%s 조망" % String(city_def.get("name", "")), TOAST_SEC)
		return
	var label := String(city_def.get("name", city_id))
	if _is_boss_city(city_id):
		label += " — 보스급 수비"
	Toast.show(self, "%s (아직 우리 성이 아닙니다)" % label, TOAST_SEC)


func _land_color(city_id: String) -> Color:
	var land := String(RealmCities.any_by_id(city_id).get("land", "plain"))
	return LAND_COLOR.get(land, LAND_COLOR["plain"])


## 이 적 성의 수비 명단(officers) 중 `boss:true`인 사람이 있는가 —
## `realm_save_state.gd attack()`의 bossBeaten 판정과 같은 기준이다(21절
## 보스전 보상 참고). 함락 전 지도 표시용으로 미리 살피는 것뿐, 새 판정은
## 아니다.
func _is_boss_city(eid: String) -> bool:
	var e := RealmCities.enemy_by_id(eid)
	for oid: String in (e.get("officers", []) as Array):
		var h = Characters.find(oid)
		if h != null and bool(h.get("boss", false)):
			return true
	return false


## **2026-09-14 갈아끼움 — 마커를 새로 짓는 대신 색만 우호색으로 바꾼다.**
## 이제 `_ready()`가 104개 적 성 마커를 전부(적/보스 색으로) 미리 세워 둬
## `_markers`에 이미 다 있다 — 예전엔 함락돼야 비로소 마커가 생겨 미정복
## 영토가 지도에서 통째로 안 보였다.
func _check_annexed() -> void:
	for e: Dictionary in RealmCities.ENEMY_CITIES:
		var eid := String(e.id)
		if _annexed_seen.has(eid):
			continue
		if not bool(RealmSaveState.enemies.get(eid, {}).get("captured", false)):
			continue
		_annexed_seen[eid] = true
		_base_color[eid] = _land_color(eid)
		(_markers[eid] as MeshInstance3D).material_override = _mat(_base_color[eid])
		if _monsters.has(eid):
			(_monsters[eid] as Node3D).queue_free()
			_monsters.erase(eid)
			_build_flag(_world_pos(e))


func _world_pos(c: Dictionary) -> Vector3:
	var center := RealmCities.map_center()
	return Vector3(
		(float(c.x) - center.x) * RealmCities.WORLD_SCALE, 0.0,
		(float(c.y) - center.y) * RealmCities.WORLD_SCALE)


func _build_ground() -> void:
	var mi := MeshInstance3D.new()
	var mesh := PlaneMesh.new()
	mesh.size = Vector2(GROUND_SPAN, GROUND_SPAN)
	mi.mesh = mesh
	mi.name = "MapGround"
	mi.material_override = real_ground_mat(COLOR_GROUND, MAP_TILE_SCALE, 1.0)   # G-0262 되풀이 섞기는 지도 땅에서만
	add_child(mi)


## 성표(城標) — 기둥(강조 대상, 성마다 다른 색)에 깃발(우리 성)이나 몬스터
## 실루엣(적/보스 성)을 얹은 표지 하나로 성 하나를 대신한다(디오라마 전체를
## 지도 위에 얹지 않는다 — 개관용이라 실루엣만 있으면 된다). **2026-09-14
## — `color`를 인자로 받는다**(우호/적/보스 셋 중 어느 걸 세울지는 호출부가
## 정한다, `_land_color()`로 안에서 다시 고르지 않는다 — 적 성엔 애초에
## "우호색" 개념이 안 맞는다). **`is_enemy` 추가 — 적/보스는 깃발 대신
## `_build_monster_body()`를 얹는다**(위 헤더 주석 참고).
func _build_marker(c: Dictionary, color: Color, is_enemy: bool) -> void:
	var pos := _world_pos(c)
	var city_id := String(c.id)
	_base_color[city_id] = color

	var pole := MeshInstance3D.new()
	var pole_mesh := CylinderMesh.new()
	pole_mesh.top_radius = 0.5
	pole_mesh.bottom_radius = 0.7
	pole_mesh.height = 3.0
	pole.mesh = pole_mesh
	pole.position = pos + Vector3(0, 1.5, 0)
	pole.material_override = _mat(color)
	add_child(pole)
	_markers[city_id] = pole

	if is_enemy:
		var monster := _build_monster_body(color, color == COLOR_BOSS)
		monster.position = pos + Vector3(0, 3.0, 0)
		add_child(monster)
		_monsters[city_id] = monster
	else:
		_flags[city_id] = _build_flag(pos)

	var area := Area3D.new()
	area.input_ray_pickable = false  # 처음엔 숨김 상태 — _process()가 보일 때 켠다
	area.position = pos + Vector3(0, TAP_HEIGHT * 0.5, 0)
	var shape := CollisionShape3D.new()
	var cyl := CylinderShape3D.new()
	cyl.radius = TAP_RADIUS
	cyl.height = TAP_HEIGHT
	shape.shape = cyl
	area.add_child(shape)
	area.input_event.connect(_on_marker_input.bind(city_id))
	add_child(area)
	_areas[city_id] = area


func _build_flag(pos: Vector3) -> MeshInstance3D:
	var flag := MeshInstance3D.new()
	var flag_mesh := BoxMesh.new()
	flag_mesh.size = Vector3(1.6, 1.0, 0.1)
	flag.mesh = flag_mesh
	flag.position = pos + Vector3(0.9, 2.6, 0)
	flag.material_override = _mat(COLOR_FLAG)
	add_child(flag)
	return flag


## GO `animal_builder.gd`(사슴·소 — 어울리는 CC0 킷이 없어 box 조합으로
## 대신한 것)와 같은 결의 code-drawn primitive. 보스는 몸통이 크고 뿔이
## 셋, 일반 적은 몸통이 작고 뿔이 하나 — 색뿐 아니라 형태로도 구분된다.
func _build_monster_body(color: Color, is_boss: bool) -> Node3D:
	var root := Node3D.new()
	root.name = "Monster"
	var mat := StandardMaterial3D.new()
	mat.albedo_color = color
	var size_mul := 1.6 if is_boss else 1.0

	var torso := MeshInstance3D.new()
	var tmesh := BoxMesh.new()
	tmesh.size = Vector3(1.4, 1.4, 1.4) * size_mul
	torso.mesh = tmesh
	torso.material_override = mat
	root.add_child(torso)

	var horn_count := 3 if is_boss else 1
	var horn_radius := 0.22 * size_mul
	var horn_height := 1.1 * size_mul
	for i in horn_count:
		var horn := MeshInstance3D.new()
		var hmesh := CylinderMesh.new()
		hmesh.top_radius = 0.0
		hmesh.bottom_radius = horn_radius
		hmesh.height = horn_height
		horn.mesh = hmesh
		var offset_x := (float(i) - float(horn_count - 1) * 0.5) * 0.5 * size_mul
		horn.position = Vector3(offset_x, tmesh.size.y * 0.5 + horn_height * 0.5, 0)
		horn.material_override = mat
		root.add_child(horn)
	return root


func _mat(color: Color) -> ShaderMaterial:
	## realm_city.gd와 같은 이유로 WorldCurveMaterial을 쓴다(curve_amount
	## 0 — REALM은 걸어다니는 판이 아니라 구면 투영이 없다, saga_core 셰이더
	## 공유 경계를 유지한다).
	return WorldCurveMaterial.vertex_color_material(0.0, 0.9, color)


## G-0252 — 지도 땅·도읍 원반을 자체 PBR(tiles_real 풀·흙·자갈, 법선·거칠기·높이)로. SAGA_REALM_OLD=1 이면 옛 민색(vertex_color).
## realm_city.gd·realm_worldmap.gd 가 같은 함수를 하나씩 둔다(서로 참조 안 함 — 성 색 _land_color·성표는 그대로 _mat).
## G-0262 detile 1 = 셰이더 둘째 층(돌린 큰 결)으로 사진 타일 되풀이 격자를 지움(표본 ×2 — 높이 떠 한눈에 수백 m 인 지도에서만).
static func real_ground_mat(color: Color, tile_scale := -1.0, detile := 0.0) -> ShaderMaterial:
	if OS.get_environment("SAGA_REALM_OLD") != "" or not ResourceLoader.exists(WorldCurveMaterial.REAL_DIR + "gravel_hi.webp"):
		return WorldCurveMaterial.vertex_color_material(0.0, 0.9, color)
	var m := WorldCurveMaterial.triplanar_material(0.0, {"grass": "field_mix", "dirt": "dirt", "stone": "gravel"}, "SAGA_REALM_OLD")   # G-0404 들판 녹갈 섞음(없으면 grass)
	if tile_scale > 0.0:
		m.set_shader_parameter("tile_scale", tile_scale)
		m.set_shader_parameter("patch_scale", tile_scale * 0.3)
	if detile > 0.0:
		m.set_shader_parameter("detile", detile)
	return m
