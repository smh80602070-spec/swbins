extends Node

## G-0318 1만리 바람 길잡이(고스트 오브 쓰시마 — 구조만) — 고돗이 먼저(웹·유니티 짝 없음, 장부 go.md 우선 3 "HUD 덜기").
##   따라가는 목표(이야기·세계 임무 — story_quest target_pos)가 있을 때 STILL_SEC 가만히 서 있으면 바람 한 줄기(가는 빛줄 STREAKS 개)가
##   내 둘레에서 목표 쪽으로 흘러간다. 한 번 불면 GAP_SEC 쉰다. 새 키 없음(빈 키가 없고, 서서 둘러보는 몸짓이 곧 "길을 묻기").
##   HUD 덜기 — SAGA_WIND_ONLY=1 이면 금빛 기둥·거리 글자를 끄고(story_quest _refresh_marker) 움직이는 동안에도 MOVE_GAP_SEC 마다 분다.
##   그림은 코드 상자 줄(에셋 없음) — 빛 안 받는 흰 반투명, 나타났다 사라짐. SAGA_WIND_GUIDE=0 이면 끔.
## test_village.gd 가 붙인다(auto_quest_go 와 같은 자리). 점검 probe_go_wind.

const STILL_SEC := 1.5
const GAP_SEC := 6.0
const MOVE_GAP_SEC := 12.0
const STILL_SPEED := 0.4      # m/s 밑이면 "가만히"
const STREAKS := 7
const TRAVEL_M := 14.0
const LIFE_SEC := 1.6
const NEAR_M := 4.0           # 목표에 이만큼 가까우면 안 분다

var _still := 0.0
var _since := 99.0
var _last_pos := Vector3.INF
var gusts := 0                # 점검용 — 분 횟수
var last_dir := Vector3.ZERO


static func on() -> bool:
	return OS.get_environment("SAGA_WIND_GUIDE") != "0"


static func wind_only() -> bool:
	return on() and OS.get_environment("SAGA_WIND_ONLY") == "1"


static func attach(scene: Node) -> Node:
	var n := Node.new()
	n.name = "WindGuide"
	n.set_script(load("res://games/saga_go/world/wind_guide.gd"))
	scene.add_child(n)
	return n


## 목표 쪽 수평 방향 — 너무 가깝거나 목표가 없으면 ZERO
static func dir_to(from: Vector3, to: Vector3) -> Vector3:
	if to == Vector3.INF:
		return Vector3.ZERO
	var d := Vector3(to.x - from.x, 0.0, to.z - from.z)
	if d.length() < NEAR_M:
		return Vector3.ZERO
	return d.normalized()


## 불 때인가 — 가만히 선 시간·지난 뒤 시간·움직이는 중 바람만 모드
static func due(still: float, since: float, only: bool) -> bool:
	if since < GAP_SEC:
		return false
	return still >= STILL_SEC or (only and since >= MOVE_GAP_SEC)


func _process(delta: float) -> void:
	if not on() or delta <= 0.0:
		return
	_since += delta
	var pl := get_tree().get_first_node_in_group("player") as Node3D
	var sq := get_tree().get_first_node_in_group("go_story")
	if pl == null or sq == null or not sq.has_method("target_pos"):
		return
	var p := pl.global_position
	var speed := 0.0 if _last_pos == Vector3.INF else Vector2(p.x - _last_pos.x, p.z - _last_pos.z).length() / delta
	_last_pos = p
	_still = _still + delta if speed < STILL_SPEED else 0.0
	if not due(_still, _since, wind_only()):
		return
	var dir := dir_to(p, sq.call("target_pos"))
	if dir == Vector3.ZERO:
		return
	gust(p, dir)


func gust(at: Vector3, dir: Vector3) -> void:
	_since = 0.0
	_still = 0.0
	gusts += 1
	last_dir = dir
	var host := get_parent() as Node
	if host == null:
		return
	var side := dir.cross(Vector3.UP).normalized()
	var mat := StandardMaterial3D.new()
	mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	mat.albedo_color = Color(1.0, 1.0, 0.96, 0.0)
	mat.cull_mode = BaseMaterial3D.CULL_DISABLED
	var mesh := BoxMesh.new()
	mesh.size = Vector3(0.05, 0.05, 2.4)
	for i in STREAKS:
		var s := MeshInstance3D.new()
		s.name = "WindStreak"
		s.mesh = mesh
		s.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		var m := mat.duplicate() as StandardMaterial3D
		s.material_override = m
		host.add_child(s, true)
		var lateral := (float(i) / float(STREAKS - 1) - 0.5) * 7.0
		var start := at - dir * 2.5 + side * lateral + Vector3(0, 0.5 + fmod(float(i) * 0.37, 1.7), 0)
		s.global_transform = Transform3D(Basis.looking_at(dir, Vector3.UP), start)
		var tw := s.create_tween()
		var delay := float(i % 3) * 0.12
		tw.tween_interval(delay)
		tw.set_parallel(true)
		tw.tween_property(s, "global_position", start + dir * TRAVEL_M, LIFE_SEC)
		tw.tween_property(m, "albedo_color:a", 0.7, LIFE_SEC * 0.3)
		tw.tween_property(m, "albedo_color:a", 0.0, LIFE_SEC * 0.7).set_delay(LIFE_SEC * 0.3)
		tw.chain().tween_callback(s.queue_free)
