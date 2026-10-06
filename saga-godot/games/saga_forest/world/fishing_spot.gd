extends Node3D

## VERTICAL_SLICE_FOREST.md 4절 "제외" 목록 2번 — 낚시(별도 미니게임).
## 웹판 village.js 조사 결과: 낚시터(`spot`, PROPS의 `reset: 0`)만 하루
## 몫이 없다 — "즉시 획득으로 두면 자동이 낚시터 하나를 무한히 반복한다"는
## 실제로 겪은 문제가 주석에 남아 있어, 원작(동물의숲)처럼 **찌를 던지고
## 입질을 기다렸다 당기는** 타이밍 미니게임으로 만들어 뒀다. 그 규칙을
## 상수 하나 안 바꾸고 그대로 옮긴다(duel_rules.gd·world_curve.gdshaderinc
## 등과 같은 "새로 설계하지 않는다" 원칙).
##
##   던진다 → CAST_MIN~CAST_MIN+CAST_VAR 뒤 입질 → BITE_WINDOW 안에
##   당기면 잡는다. 너무 이르면(성급) 놓치고, 너무 늦으면도 놓친다.
##   낚시터에서 REACH*1.4보다 멀어지면 줄이 끊긴다.
##
## 나무·소나무·바위·꽃(gatherable_builder.gd)과 달리 day 리셋이 없다 —
## ForestSaveState.can_gather()/mark_gathered()를 아예 안 부른다(reset:0).
## 입질 타이밍은 세계 배치가 아니라 순간의 반응 게임이라 결정적 해시를
## 안 쓴다 — 웹판도 여기만은 Math.random()을 그대로 쓴다.

const ForestMap := preload("res://games/saga_forest/data/village_map.gd")
const TerrainBuilder := preload("res://games/saga_forest/world/forest_terrain_builder.gd")
const WorldCurveMaterial := preload("res://saga_core/world/world_curve_material.gd")
const Toast := preload("res://saga_core/ui/toast.gd")
const GLBUtils := preload("res://saga_core/world/glb_utils.gd")

const GRID := Vector2i(22, 5)
const CAST_RADIUS := 3.5
## 웹판 REACH*1.4 — 2절이 정한 REACH≈3.45m 그대로 대입.
const FISH_RANGE := 4.8
const CAST_MIN_MS := 1200
const CAST_VAR_MS := 2300
const BITE_WINDOW_MS := 700
const LATE_GRACE_MS := 400
const FISH_ITEM_LABEL := "물고기"
const CURVE_AMOUNT := 0.004
## G-0046 — 못 모양·둘레(파란 네모 판이 도형 대역으로 보였다). 반지름 m·조각 수·가장자리 흔들림 비율.
const POND_R := 1.8
const POND_SEG := 28
const POND_WOBBLE := 0.1
const POND_DEEP := Color(0.02, 0.09, 0.2)
const POND_MID := Color(0.05, 0.18, 0.3)
const POND_EDGE := Color(0.18, 0.3, 0.27)
const RIM_ROCK_GLB := "res://assets/world/rock_small_01.glb"
const RIM_GRASS_GLB := "res://assets/world/grass_tuft_01.glb"

enum State { IDLE, LINE_OUT }

var _state := State.IDLE
var _bite_at_ms := 0
var _ends_at_ms := 0
var _bite_notified := false
var _in_range := false
var _player: Node3D = null


func _ready() -> void:
	var ground: float = TerrainBuilder.LEGEND["."].height
	position = ForestMap.world_pos(GRID.x, GRID.y) + Vector3(0, ground + 0.02, 0)
	add_to_group("codex_discoverable")

	## 연못은 primitive다 — 어울리는 CC0 GLB가 없어서가 아니라, 이번엔
	## "낚시터 하나"만 필요하지 아직 물가 바이옴 자체(§4 "제외" 목록 7번,
	## 별개 항목)를 짓는 게 아니라서다. terrain_builder.gd의 WaterSurface·
	## landmarks_builder.gd의 폭포 물웅덩이와 같은 결(장식 평면).
	var pond := MeshInstance3D.new()
	pond.name = "Pond"
	pond.mesh = pond_mesh()
	pond.material_override = WorldCurveMaterial.vertex_color_material(CURVE_AMOUNT, 0.5)
	add_child(pond)
	_build_rim()

	var area := Area3D.new()
	area.name = "CastArea"
	var cs := CollisionShape3D.new()
	var shape := SphereShape3D.new()
	shape.radius = CAST_RADIUS
	cs.shape = shape
	area.add_child(cs)
	add_child(area)
	area.body_entered.connect(_on_entered)
	area.body_exited.connect(_on_exited)


## G-0046 — 둥근 못: 가운데 한 점 + 가장자리 POND_SEG 점 부채꼴, 가운데 짙은 남색 → 가장자리 옅은 청록(정점색). 가장자리는 각도 해시로 ±POND_WOBBLE 흔들어 고르지 않게.
static func pond_mesh() -> ArrayMesh:
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	var ring_in: Array[Vector3] = []
	var ring_out: Array[Vector3] = []
	for i in POND_SEG:
		var a := TAU * float(i) / float(POND_SEG)
		var r := POND_R * (1.0 + POND_WOBBLE * sin(a * 3.0 + 0.7) * cos(a * 2.0))
		var d := Vector3(cos(a), 0.0, sin(a))
		ring_in.append(d * r * 0.6)
		ring_out.append(d * r)
	for i in POND_SEG:
		var j := (i + 1) % POND_SEG
		## 안쪽 부채꼴(가운데 → 중간 고리) — 위에서 봐 시계 방향이 앞면(각도가 +x→+z 로 늘어 i→j 순서가 그 방향)
		st.set_normal(Vector3.UP)
		st.set_color(POND_DEEP); st.add_vertex(Vector3.ZERO)
		st.set_color(POND_MID); st.add_vertex(ring_in[i])
		st.set_color(POND_MID); st.add_vertex(ring_in[j])
		## 바깥 띠(중간 고리 → 가장자리)
		st.set_color(POND_MID); st.add_vertex(ring_in[i])
		st.set_color(POND_EDGE); st.add_vertex(ring_out[j])
		st.set_color(POND_MID); st.add_vertex(ring_in[j])
		st.set_color(POND_MID); st.add_vertex(ring_in[i])
		st.set_color(POND_EDGE); st.add_vertex(ring_out[i])
		st.set_color(POND_EDGE); st.add_vertex(ring_out[j])
	return st.commit()

## G-0046 — 못 둘레 돌 여덟·풀 포기 다섯(이미 있는 world GLB, 곡률 텍스처 재질 — forest_biome_scatter.gd 와 같은 방식). 충돌 없음.
func _build_rim() -> void:
	var rock: Mesh = GLBUtils.extract_mesh(RIM_ROCK_GLB)
	var grass: Mesh = GLBUtils.extract_mesh(RIM_GRASS_GLB)
	for k in 13:
		var is_rock := k < 8
		var src: Mesh = rock if is_rock else grass
		if src == null:
			continue
		var a := TAU * (float(k) / 8.0 if is_rock else (float(k - 8) + 0.5) / 5.0) + 0.3
		var mi := MeshInstance3D.new()
		mi.name = ("RimRock%d" if is_rock else "RimGrass%d") % k
		mi.mesh = WorldCurveMaterial.textured_surfaces(src, CURVE_AMOUNT, 0.9)
		mi.scale = Vector3.ONE * (0.42 + 0.12 * float(k % 3) if is_rock else 0.8)
		mi.rotation.y = a * 2.3
		mi.position = Vector3(cos(a), 0.0, sin(a)) * POND_R * (1.08 if is_rock else 1.2)
		add_child(mi)

func _on_entered(body: Node3D) -> void:
	if not body.is_in_group("player"):
		return
	_in_range = true
	_player = body
	if _state == State.IDLE:
		Toast.show(self, "[G] 낚시터 — 찌를 던진다", 2.0)


func _on_exited(body: Node3D) -> void:
	if body.is_in_group("player"):
		_in_range = false


func _process(_delta: float) -> void:
	if _state == State.LINE_OUT:
		if _player != null and _player.global_position.distance_to(global_position) > FISH_RANGE:
			_state = State.IDLE
			Toast.show(self, "줄이 끊겼다 — 낚시터에서 너무 멀어졌다", 2.0)
		else:
			var now := Time.get_ticks_msec()
			if not _bite_notified and now >= _bite_at_ms:
				_bite_notified = true
				Toast.show(self, "🎣 입질이 왔다! [G]", 2.0)
			elif now > _ends_at_ms + LATE_GRACE_MS:
				_state = State.IDLE
				Toast.show(self, "🎣 입질을 놓쳤다", 2.0)

	if _in_range and Input.is_action_just_pressed("forest_gather"):
		_on_press()


func _on_press() -> void:
	if _state == State.IDLE:
		_cast()
	else:
		_hook()


func _cast() -> void:
	var now := Time.get_ticks_msec()
	_bite_at_ms = now + CAST_MIN_MS + (randi() % (CAST_VAR_MS + 1))
	_ends_at_ms = _bite_at_ms + BITE_WINDOW_MS
	_bite_notified = false
	_state = State.LINE_OUT
	Toast.show(self, "🎣 찌를 던졌다 — 입질을 기다린다", 2.0)


func _hook() -> void:
	var now := Time.get_ticks_msec()
	var early: bool = now < _bite_at_ms
	var late: bool = now > _ends_at_ms
	_state = State.IDLE
	if early:
		Toast.show(self, "성급했다 — 물고기가 달아났다", 2.0)
	elif late:
		Toast.show(self, "늦었다 — 놓쳤다", 2.0)
	else:
		ForestSaveState.add_item(FISH_ITEM_LABEL, 1)
		Toast.show(self, "🐟 낚았다 — %s +1" % FISH_ITEM_LABEL, 2.5)
		CombatFeel.pickup(self, "%s +1" % FISH_ITEM_LABEL)
