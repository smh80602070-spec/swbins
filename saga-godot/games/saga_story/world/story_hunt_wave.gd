extends Node

## G-0399 4종횡 사냥터 몰이 파도(디아블로·PoE 군단/몰이 — 구조만) — 웹 saga-story/js/hunt-wave.js(W-0437 ③) 짝, 수치 그대로.
##   같은 사냥터 잡몹 처치 EVERY(150, SAGA_HUNT_WAVE_N)마다 「몰이」: 파도 WAVES(5) — 파도마다 그 터 몹 BASE + STEP×i 마리가 주인공 양옆에서.
##   그 파도를 다 잡으면 다음 파도 · 마지막 파도엔 「몰이 대장」(스포너 미니보스 길 체력 ×8·피해 ×1.6, 전리품 굴림 LOOT)
##   · LIMIT(120)초 안 못 끝내면 남은 몰이 몹은 흩어짐. 몰이 중엔 셈 안 함 · 몰이 몹은 무리 수 밖(스포너 처치 알림에서 뗌 — 엘리트와 같음).
##   셈은 저장 안 함(이번 접속). 스포너(story_enemy_spawner)가 붙이고 처치마다 on_kill(). SAGA_HUNT_WAVE=0 이면 안 붙는다.

const EVERY := 150
const WAVES := 5
const BASE := 4
const STEP := 2
const LIMIT := 120.0
const LOOT := 2
const BOSS_BOOST := {"hp": 8.0, "dmg": 1.6}
const SIDE_M := 6.0     # 웹 300px × 0.02
const ROW_M := 0.8      # 웹 40px

var kills := 0
var active := false
var wave := 0           # 지금 파도(0 부터)
var time_left := 0.0
var finished := 0       # 끝낸 몰이 수(점검용)
var _alive: Array = []


static func on() -> bool:
	return OS.get_environment("SAGA_HUNT_WAVE") != "0"


static func every() -> int:
	var v := OS.get_environment("SAGA_HUNT_WAVE_N")
	return maxi(1, int(v)) if v.is_valid_int() else EVERY


static func attach(spawner: Node) -> Node:
	if not on():
		return null
	var n: Node = (load("res://games/saga_story/world/story_hunt_wave.gd") as GDScript).new()
	n.name = "StoryHuntWave"
	spawner.add_child(n)
	return n


## 파도 i 의 마리 수(대장 빼고) — 순수
static func wave_size(i: int) -> int:
	return BASE + STEP * i


## 잡몹 하나 쓰러짐(스포너 _on_died) — EVERY 마다 몰이 시작. 몰이 중엔 안 셈.
func on_kill() -> void:
	if active:
		return
	kills += 1
	if kills % every() == 0:
		start()


func start() -> void:
	active = true
	wave = 0
	time_left = LIMIT
	_spawn_wave()


func _spawn_wave() -> void:
	var sp := get_parent()
	if sp == null or not sp.has_method("spawn_at"):
		active = false
		return
	var map: Object = sp.get("_map")
	var width_m: float = float(map.call("width_m")) if map != null else 40.0
	var player := get_tree().get_first_node_in_group("player") as Node3D
	var px: float = (player.global_position.x - (sp as Node3D).global_position.x) if player != null else width_m * 0.5
	var n := wave_size(wave)
	var last := wave == WAVES - 1
	for k in n:
		var side := 1.0 if k % 2 == 1 else -1.0
		_add(sp, clampf(px + side * (SIDE_M + float(k >> 1) * ROW_M), 1.0, width_m - 1.0), {})
	if last:
		var b := _add(sp, clampf(px + SIDE_M * 1.2, 1.0, width_m - 1.0), BOSS_BOOST)
		if b != null:
			b.set_meta("wave_boss", true)
			b.set("elite_drops", LOOT)
			if b.has_method("_float_mark"):
				b.call("_float_mark", "몰이 대장", 0.0, Color(1.0, 0.7, 0.3))
	preload("res://saga_core/ui/toast.gd").show(sp, "📯 몰이 %d/%d — %s" % [wave + 1, WAVES, "대장이 나왔다" if last else "%d마리가 몰려온다" % n], 2.5)


func _add(sp: Node, x: float, boost: Dictionary) -> Node3D:
	var e: Node3D = sp.call("spawn_at", x, boost)
	if e == null:
		return null
	var cb := Callable(sp, "_on_died")
	if e.is_connected("died", cb):
		e.disconnect("died", cb)
	e.set_meta("wave", true)
	e.tree_exiting.connect(_on_gone.bind(e))
	_alive.append(e)
	return e


func _on_gone(e: Node3D) -> void:
	_alive.erase(e)


func alive_count() -> int:
	var n := 0
	for e: Variant in _alive:
		if is_instance_valid(e) and float((e as Node).get("hp")) > 0.0:
			n += 1
	return n


func _process(delta: float) -> void:
	tick(delta)


## 매 틱 — 파도를 다 잡으면 다음, 끝나면 띠 · 시간 다하면 흩어짐
func tick(delta: float) -> void:
	if not active:
		return
	time_left -= delta
	if time_left <= 0.0:
		for e: Variant in _alive.duplicate():
			if is_instance_valid(e):
				(e as Node).queue_free()
		_alive.clear()
		active = false
		preload("res://saga_core/ui/toast.gd").show(get_parent(), "💨 몰이가 흩어졌다", 2.5)
		return
	if alive_count() > 0:
		return
	wave += 1
	if wave >= WAVES:
		active = false
		finished += 1
		preload("res://saga_core/ui/toast.gd").show(get_parent(), "🏁 몰이 끝 — 대장의 전리품 %d" % LOOT, 3.0)
		return
	_spawn_wave()
