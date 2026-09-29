extends Node3D

## PLAN.md 25장 "동물 시스템"(Idle/Wander/Flee/Group)의 GO 첫 이식 —
## VERTICAL_SLICE.md §26이 "짐승 생태(사슴·늑대·까치 등 관찰용 동물)"로
## 미뤄 뒀던 것. §37 재미 평가 체크리스트의 "NPC/동물/몬스터가 살아
## 움직이는가?"에 지금까지 동물 쪽이 답이 없었다.
##
## 웹판 js/animal.js의 KINDS 다섯 종(사슴·늑대·까치·잉어·소) 중
## **늑대만 빼고 넷 다** 옮겼다 — 웹판 그대로:
##   - 늑대는 이미 `bandit_encounter.gd`(night_only)의 "늑대 무리" 전투
##     사건으로 있다. 걸어 다니는(전투 없는) 늑대까지 더하면 "이 늑대는
##     싸우는 늑대인가 아닌가" 혼란이 생겨 뺐다.
## 잉어(2026-09-12⑤)는 웹판 KINDS.carp에 `only:'day'`가 없다 — 사슴·까치와
## 달리 밤에도 강에 있다(TimeOfDay로 안 가린다). 강(~) 타일 위, 수면
## (WaterSurface, terrain_builder.gd)보다 살짝 아래서 헤엄친다.
## 소(2026-09-12⑥)는 웹판 KINDS.ox가 `act:null`(사람을 봐도 그대로다) —
## 배회·도주가 아예 없는 유일한 종이라 완전히 정지해 있다. 웹판 HERDS의
## `{kind:'ox', from:'farm', to:'farm'}`(제자리) 그대로 논밭(F) 타일에
## 세웠다. 웹판은 "짐승 카드를 직접 열 때" 발견을 찍지만(js/talk.js
## openBeast) 이 판엔 그 탭-열람 UI가 없어, 다른 동물처럼 **가까이 오면**
## 찍는 것으로 대체했다(사슴·까치·잉어는 "알아채는" 행동에 자연히 묻어
## 가지만, 소는 반응이 없어 이 규칙이 필요했다).
## 웹판 HERDS(이름난 자리 둘 사이를 사인 곡선으로 오가는 무리 이동)는 이
## 판에 "이름난 자리" 개념이 없어 그대로 못 옮긴다 — 대신 각자 집 자리
## 근처를 맴돈다(같은 감각, 다른 구현). 어울리는 GLB가 없어(동물 킷을
## 새로 안 받음) 이번엔 primitive로 남긴다 — ASSET_GUIDE.md "다음에 GLB
## 교체할 자리"에 적어 둔다.

const TestMap := preload("res://games/saga_go/data/test_map.gd")
const TerrainBuilder := preload("res://games/saga_go/world/terrain_builder.gd")

## 웹판 animal.js KINDS.deer/magpie의 sense(감지 거리)를 그대로 옮겼다.
const DEER_HOME := Vector2i(1, 4)
const DEER_COUNT := 3
const DEER_WANDER_RADIUS := 5.0
const DEER_SENSE_RADIUS := 30.0
const DEER_FLEE_SPEED := 6.0
const DEER_COLOR := Color(0.765, 0.604, 0.416) # 웹판 #c39a6a

const MAGPIE_HOMES := [Vector2i(9, 4), Vector2i(9, 6)]
const MAGPIE_SENSE_RADIUS := 18.0
const MAGPIE_FLY_COOLDOWN_SEC := 20.0
const MAGPIE_COLOR := Color(0.184, 0.2, 0.251) # 웹판 #2f3340

## 웹판 animal.js KINDS.carp의 sense(12)·move(9)를 그대로 옮겼다(다른
## 종보다 둘 다 작다 — 좁은 강 안에서만 움직이니 그게 맞다). 다리(격자
## (5,7))에서 떨어진 강 타일 (2,7)을 집으로 삼았다.
const CARP_HOME := Vector2i(2, 7)
const CARP_COUNT := 3
const CARP_WANDER_RADIUS := 4.0
const CARP_SENSE_RADIUS := 12.0
const CARP_FLEE_SPEED := 4.0
const CARP_COLOR := Color(0.851, 0.541, 0.353) # 웹판 #d98a5a

## 웹판 HERDS의 `{kind:'ox', from:'farm', to:'farm', n:2}` — 논밭(F) 타일
## 그대로. sense:0·move:0(act:null)이라 도주 로직이 없다 — 발견은
## 근접만으로 찍는다(위 헤더 주석 참고).
const OX_HOMES := [Vector2i(8, 9), Vector2i(9, 9)]
const OX_DISCOVER_RADIUS := 15.0
const OX_COLOR := Color(0.541, 0.478, 0.408) # 웹판 #8a7a68

var _deer: Array[Dictionary] = []
var _magpies: Array[Dictionary] = []
var _carps: Array[Dictionary] = []
var _oxen: Array[Dictionary] = []


func _ready() -> void:
	_spawn_deer()
	_spawn_magpies()
	_spawn_carps()
	_spawn_oxen()


static func _hash(i: int, salt: int) -> float:
	var h := (i * 374761393) ^ (salt * 2246822519)
	h = (h ^ (h >> 13)) * 1274126177
	h = h ^ (h >> 16)
	return float(h & 0x7fffffff) / float(0x7fffffff)


func _spawn_deer() -> void:
	var ground: float = TerrainBuilder.height_at("village", TestMap.world_pos(DEER_HOME.x, DEER_HOME.y))  # 09-30 평지 기복 — LEGEND 평탄 값이 아니라 실제 지면
	var home_pos := TestMap.world_pos(DEER_HOME.x, DEER_HOME.y) + Vector3(0, ground, 0)
	for i in DEER_COUNT:
		var body := _build_deer_body()
		body.position = home_pos
		add_child(body)
		_deer.append({"node": body, "home": home_pos, "phase": _hash(i, 11) * TAU})


func _build_deer_body() -> Node3D:
	var root := Node3D.new()
	root.name = "Deer"
	var mat := StandardMaterial3D.new()
	mat.albedo_color = DEER_COLOR

	var torso := MeshInstance3D.new()
	var tmesh := BoxMesh.new()
	tmesh.size = Vector3(1.6, 0.9, 0.7)
	torso.mesh = tmesh
	torso.position = Vector3(0, 0.6, 0)
	torso.material_override = mat
	root.add_child(torso)

	var head := MeshInstance3D.new()
	var hmesh := BoxMesh.new()
	hmesh.size = Vector3(0.5, 0.5, 0.6)
	head.mesh = hmesh
	head.position = Vector3(0, 0.95, 0.55)
	head.material_override = mat
	root.add_child(head)
	return root


func _spawn_magpies() -> void:
	for home in MAGPIE_HOMES:
		var ground: float = TerrainBuilder.height_at("village", TestMap.world_pos(home.x, home.y))
		var perch_pos := TestMap.world_pos(home.x, home.y) + Vector3(0, ground + 2.6, 0)
		var body := _build_magpie_body()
		body.position = perch_pos
		add_child(body)
		_magpies.append({"node": body, "home": perch_pos, "cooldown": 0.0})


func _build_magpie_body() -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	var mesh := BoxMesh.new()
	mesh.size = Vector3(0.3, 0.3, 0.45)
	mi.mesh = mesh
	var mat := StandardMaterial3D.new()
	mat.albedo_color = MAGPIE_COLOR
	mi.material_override = mat
	return mi


func _spawn_carps() -> void:
	## 강바닥(-1.0) 위, 수면(-0.45, terrain_builder.gd _build_water 참고)
	## 보다 살짝 아래서 헤엄친다 — 물 밖으로 튀어나와 보이지 않게.
	## 2026-09-23 강바닥을 -3.0 으로 팠다 — 수면 기준으로 예전과 같은 깊이(-0.725)에 둔다.
	var swim_y := TerrainBuilder.WATER_LEVEL - TerrainBuilder.WATER_HEIGHT_ABOVE_BED * 0.5
	var home_pos := TestMap.world_pos(CARP_HOME.x, CARP_HOME.y) + Vector3(0, swim_y, 0)
	for i in CARP_COUNT:
		var body := _build_carp_body()
		body.position = home_pos
		add_child(body)
		_carps.append({"node": body, "home": home_pos, "phase": _hash(i, 31) * TAU})


func _build_carp_body() -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	var mesh := BoxMesh.new()
	mesh.size = Vector3(0.5, 0.18, 0.16)
	mi.mesh = mesh
	var mat := StandardMaterial3D.new()
	mat.albedo_color = CARP_COLOR
	mi.material_override = mat
	return mi


func _spawn_oxen() -> void:
	for home in OX_HOMES:
		var ground: float = TerrainBuilder.height_at("village", TestMap.world_pos(home.x, home.y))
		var pos := TestMap.world_pos(home.x, home.y) + Vector3(0, ground, 0)
		var body := _build_ox_body()
		body.position = pos
		add_child(body)
		_oxen.append({"node": body, "discovered": false})


func _build_ox_body() -> Node3D:
	var root := Node3D.new()
	root.name = "Ox"
	var mat := StandardMaterial3D.new()
	mat.albedo_color = OX_COLOR

	var torso := MeshInstance3D.new()
	var tmesh := BoxMesh.new()
	tmesh.size = Vector3(2.0, 1.1, 0.9)
	torso.mesh = tmesh
	torso.position = Vector3(0, 0.75, 0)
	torso.material_override = mat
	root.add_child(torso)

	var head := MeshInstance3D.new()
	var hmesh := BoxMesh.new()
	hmesh.size = Vector3(0.6, 0.6, 0.7)
	head.mesh = hmesh
	head.position = Vector3(0, 1.15, 0.7)
	head.material_override = mat
	root.add_child(head)
	return root


func _find_player() -> Node3D:
	var players := get_tree().get_nodes_in_group("player")
	return players[0] if not players.is_empty() else null


## 웹판 KINDS.deer/magpie 둘 다 `only:'day'` — 밤엔 TimeOfDay로 숨긴다
## (bandit_encounter.gd의 night_only와 같은 판정, 여긴 반대로 낮에만).
func _process(delta: float) -> void:
	var is_day := not TimeOfDay.is_night()
	var player := _find_player()
	var t := Time.get_ticks_msec() / 1000.0

	for d in _deer:
		var node: Node3D = d.node
		node.visible = is_day
		if not is_day:
			continue
		var home: Vector3 = d.home
		var phase: float = d.phase
		var desired := home + Vector3(sin(t * 0.4 + phase), 0.0, cos(t * 0.31 + phase * 1.3)) * DEER_WANDER_RADIUS
		if player != null:
			var dist := node.global_position.distance_to(player.global_position)
			if dist < DEER_SENSE_RADIUS:
				CodexState.discover("beast", "deer")
				var away: Vector3 = node.global_position - player.global_position
				away.y = 0.0
				if away.length() > 0.01:
					away = away.normalized()
				desired = node.global_position + away * DEER_WANDER_RADIUS
		node.position = node.position.move_toward(desired, DEER_FLEE_SPEED * delta)

	for m in _magpies:
		var mnode: MeshInstance3D = m.node
		var cooldown: float = m.cooldown
		if cooldown > 0.0:
			cooldown -= delta
			m.cooldown = cooldown
			mnode.visible = false
			continue
		mnode.visible = is_day
		if not is_day:
			continue
		if player != null and mnode.global_position.distance_to(player.global_position) < MAGPIE_SENSE_RADIUS:
			CodexState.discover("beast", "magpie")
			m.cooldown = MAGPIE_FLY_COOLDOWN_SEC
			mnode.visible = false

	## 웹판 KINDS.carp엔 only:'day'가 없다 — 밤에도 강에 있다(TimeOfDay로
	## 안 가림, 사슴·까치와 다른 유일한 차이).
	for c in _carps:
		var cnode: Node3D = c.node
		var chome: Vector3 = c.home
		var cphase: float = c.phase
		var cdesired := chome + Vector3(sin(t * 0.5 + cphase), 0.0, cos(t * 0.37 + cphase * 1.2)) * CARP_WANDER_RADIUS
		if player != null:
			var cdist := cnode.global_position.distance_to(player.global_position)
			if cdist < CARP_SENSE_RADIUS:
				CodexState.discover("beast", "carp")
				var caway: Vector3 = cnode.global_position - player.global_position
				caway.y = 0.0
				if caway.length() > 0.01:
					caway = caway.normalized()
				cdesired = cnode.global_position + caway * CARP_WANDER_RADIUS
		cnode.position = cnode.position.move_toward(cdesired, CARP_FLEE_SPEED * delta)

	## 소는 웹판 KINDS.ox처럼 `only:'day'`(밤엔 숨김) + `act:null`(위치 고정,
	## 도주 없음) — 다른 셋과 달리 근접만으로 발견을 찍는다(헤더 주석 참고).
	for o in _oxen:
		var onode: Node3D = o.node
		onode.visible = is_day
		if is_day and player != null and not o.discovered:
			if onode.global_position.distance_to(player.global_position) < OX_DISCOVER_RADIUS:
				CodexState.discover("beast", "ox")
				o.discovered = true
