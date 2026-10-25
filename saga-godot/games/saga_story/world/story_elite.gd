extends Node

## G-0389 4종횡 사냥터 엘리트(메이플스토리 · 웹 W-0429 짝).
##   같은 사냥터에서 잡몹 처치 N(SAGA_ELITE_N, 기본 300)마다 그 터 몹 하나를 엘리트로 세운다 — 스포너 미니보스 길(spawn_at boost)
##   그대로 체력 ×15·피해 ×1.5·큰 몸, 이름 위 「엘리트」, 띠 「엘리트 몬스터가 나타났습니다」, 살아 있는 동안 화면 살짝 어둡게.
##   잡으면 경험치·금 ×10(미니 ×8 위에 ×1.25) · 장비 굴림 셋. 그 터 엘리트 셋째를 잡으면 엘리트 보스(체력 ×40·피해 ×2) —
##   ELITE_BOSS_SEC 안 못 잡으면 사라짐(덤 없음). 셈은 저장 안 함(이번 접속, 사냥터 떠나면 처음부터).
##   스포너(story_enemy_spawner)가 붙이고 처치마다 on_kill() 을 부른다. 골든 무대엔 스포너가 없어 안 생긴다. SAGA_ELITE=0 이면 안 붙는다.

const N_DEFAULT := 300
const ELITE_BOOST := {"hp": 15.0, "dmg": 1.5}
const BOSS_BOOST := {"hp": 40.0, "dmg": 2.0}
const ELITE_EXTRA_MUL := 1.25     # 미니 덤 ×8 위에 → ×10
const ELITE_DROPS := 3
const BOSS_EVERY := 3
const ELITE_BOSS_SEC := 60.0
const DIM_ALPHA := 0.22

var kills := 0
var elite_kills := 0
var _alive: Array = []          # 살아 있는 엘리트·보스
var _boss: Node3D = null
var _boss_t := 0.0
var _dim: CanvasLayer = null


static func on() -> bool:
	return OS.get_environment("SAGA_ELITE") != "0"


static func every() -> int:
	var v := OS.get_environment("SAGA_ELITE_N")
	return maxi(1, int(v)) if v.is_valid_int() else N_DEFAULT


static func attach(spawner: Node) -> Node:
	if not on():
		return null
	var n: Node = (load("res://games/saga_story/world/story_elite.gd") as GDScript).new()
	n.name = "StoryElite"
	spawner.add_child(n)
	return n


## 잡몹 하나 쓰러짐(스포너 _on_died) — N 마다 엘리트.
func on_kill() -> void:
	kills += 1
	if kills % every() == 0:
		spawn_elite(false)


func spawn_elite(boss: bool) -> Node3D:
	var sp := get_parent()
	if sp == null or not sp.has_method("spawn_at"):
		return null
	var map: Object = sp.get("_map")
	var width_m: float = float(map.call("width_m")) if map != null else 40.0
	var player := get_tree().get_first_node_in_group("player") as Node3D
	var x := width_m * 0.5
	for i in 8:
		x = 4.0 + randf() * maxf(1.0, width_m - 8.0)
		if player == null or absf(player.global_position.x - (sp.global_position.x + x)) >= 6.0:
			break
	var e: Node3D = sp.call("spawn_at", x, BOSS_BOOST if boss else ELITE_BOOST)
	if e == null:
		return null
	## 엘리트는 무리 수 밖(덧붙임) — 스포너 처치 알림(잡몹 셈·다시 남)에서 뗀다, 안 그러면 죽을 때마다 잡몹이 하나씩 는다.
	var cb := Callable(sp, "_on_died")
	if e.is_connected("died", cb):
		e.disconnect("died", cb)
	e.set_meta("elite", "boss" if boss else "elite")
	e.set("elite_mul", ELITE_EXTRA_MUL * (2.0 if boss else 1.0))
	e.set("elite_drops", ELITE_DROPS + (2 if boss else 0))
	if e.has_method("_float_mark"):
		e.call("_float_mark", "엘리트 보스" if boss else "엘리트", 0.0, Color(1.0, 0.45, 0.25) if boss else Color(0.95, 0.6, 1.0))
	e.connect("died", _on_elite_died.bind(e), CONNECT_ONE_SHOT)
	_alive.append(e)
	if boss:
		_boss = e
		_boss_t = ELITE_BOSS_SEC
	preload("res://saga_core/ui/toast.gd").show(sp, "엘리트 보스가 나타났습니다 — %d초 안에!" % int(ELITE_BOSS_SEC) if boss else "엘리트 몬스터가 나타났습니다", 3.0)
	_set_dim(true)
	return e


func _on_elite_died(e: Node3D) -> void:
	_alive.erase(e)
	if e == _boss:
		_boss = null
	elif String(e.get_meta("elite", "")) == "elite":
		elite_kills += 1
		if elite_kills % BOSS_EVERY == 0:
			spawn_elite(true)
	_set_dim(not _alive.is_empty())


func _process(delta: float) -> void:
	if _boss == null:
		return
	if not is_instance_valid(_boss):
		_boss = null
		return
	_boss_t -= delta
	if _boss_t <= 0.0:
		_alive.erase(_boss)
		_boss.queue_free()
		_boss = null
		preload("res://saga_core/ui/toast.gd").show(get_parent(), "엘리트 보스가 사라졌다", 2.5)
		_set_dim(not _alive.is_empty())


func _set_dim(on_: bool) -> void:
	if on_ and _dim == null:
		_dim = CanvasLayer.new()
		_dim.layer = -1
		var r := ColorRect.new()
		r.color = Color(0, 0, 0.03, DIM_ALPHA)
		r.set_anchors_preset(Control.PRESET_FULL_RECT)
		r.mouse_filter = Control.MOUSE_FILTER_IGNORE
		_dim.add_child(r)
		add_child(_dim)
	elif not on_ and _dim != null:
		_dim.queue_free()
		_dim = null


func is_dimmed() -> bool:
	return _dim != null
