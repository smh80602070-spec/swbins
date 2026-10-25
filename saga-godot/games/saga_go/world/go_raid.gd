extends Node

## G-0400 1만리 들판 무리 습격(디아블로·PoE 군단/몰이 — 구조만) — 웹 saga-web/saga-go/js/field-raid.js(W-0438 ③) 짝, 수치 그대로.
##   들판 처치 EVERY(60, SAGA_RAID_N)마다 「무리 습격」 — 주인공 둘레 RING m 에 무리가 둥글게 선다:
##   파도   WAVES(3) — 파도마다 BASE + STEP×i 마리(들판 무리 종 KINDS 를 돌려 씀), 처음부터 둘레(aggro 안)라 곧바로 쫓아옴. 다 잡으면 다음
##   끝     셋 다 잡으면 냥 KILL_DROPS(늑대) × REWARD 와 띠 「습격을 막았다」 · LIMIT(150)초 넘으면 남은 습격 무리는 흩어짐
##   셈     이번 접속만 · 습격 무리 처치는 안 셈 · 습격 무리는 다시 안 서고 전리품 없음(보상은 끝 냥)
## 처치는 들판 적의 died 신호(들판 적 노드는 되살아나도 같은 노드라 한 번만 잇는다). SAGA_RAID=0 이면 안 붙는다.

const FieldEnemy := preload("res://games/saga_go/combat/field_enemy.gd")
const Growth := preload("res://games/saga_go/data/growth.gd")
const Adventure := preload("res://games/saga_go/data/adventure.gd")

const EVERY := 60
const WAVES := 3
const BASE := 4
const STEP := 2
const LIMIT := 150.0
const REWARD := 12
const RING := 7.0
const KINDS := ["wolf", "bandit", "wolf", "bandit"]

var kills := 0
var pending := false
var active := false
var wave := 0
var time_left := 0.0
var finished := 0
var _alive: Array = []
var _seen := {}
var _seq := 0
var _scan := 0.0


## 헤드리스(자동 점검)에선 기본 끔 — 앞 점검들의 처치가 쌓여 습격이 끼어들지 않게(웹 W-0438 함정과 같음). SAGA_RAID=1 이면 켬.
static func on() -> bool:
	var v := OS.get_environment("SAGA_RAID")
	if v == "1":
		return true
	return v != "0" and DisplayServer.get_name() != "headless"


static func every() -> int:
	var v := OS.get_environment("SAGA_RAID_N")
	return maxi(1, int(v)) if v.is_valid_int() else EVERY


static func wave_size(i: int) -> int:
	return BASE + STEP * i


static func reward() -> int:
	return int(Growth.KILL_DROPS.wolf.mora) * REWARD


static func attach(host: Node) -> Node:
	if not on():
		return null
	var n: Node = (load("res://games/saga_go/world/go_raid.gd") as GDScript).new()
	n.name = "GoRaid"
	host.add_child(n)
	return n


func _process(delta: float) -> void:
	_scan -= delta
	if _scan <= 0.0:
		_scan = 1.0
		watch()
	tick(delta)


## 새 들판 적에 처치 신호를 잇는다
func watch() -> void:
	for e in get_tree().get_nodes_in_group("field_enemy"):
		var id := e.get_instance_id()
		if _seen.has(id) or e.has_meta("raid"):
			continue
		_seen[id] = true
		e.connect("died", _on_kill)


func _on_kill(e: Node) -> void:
	if active or e.has_meta("raid"):
		return
	kills += 1
	if kills % every() == 0:
		pending = true


func tick(delta: float) -> void:
	if not active and pending:
		pending = false
		active = true
		wave = 0
		time_left = LIMIT
		_seq += 1
		_spawn_wave()
		return
	if not active:
		return
	time_left -= delta
	if time_left <= 0.0:
		for e: Variant in _alive.duplicate():
			if is_instance_valid(e):
				(e as Node).queue_free()
		_alive.clear()
		active = false
		preload("res://saga_core/ui/toast.gd").show(self, "💨 습격 무리가 흩어졌다", 2.5)
		return
	if alive_count() > 0:
		return
	wave += 1
	if wave >= WAVES:
		active = false
		finished += 1
		var PS: Node = get_tree().root.get_node_or_null("PartyState")
		if PS != null:
			PS.call("add_items", {"mora": reward()})
		preload("res://saga_core/ui/toast.gd").show(self, "🏁 습격을 막았다 — 냥 +%d" % reward(), 3.0)
		return
	_spawn_wave()


func _spawn_wave() -> void:
	var pl := get_tree().get_first_node_in_group("player") as Node3D
	var host := get_parent()
	if pl == null or host == null:
		active = false
		return
	var n := wave_size(wave)
	var wl := Adventure.world_level()
	for k in n:
		var a := TAU * float(k) / float(n)
		var e := FieldEnemy.new()
		e.name = "GoRaid_%d_%d_%d" % [_seq, wave, k]
		e.setup(String(KINDS[(wave + k) % KINDS.size()]), pl.global_position + Vector3(cos(a), 0.3, sin(a)) * RING, 20260824 + 5000 + _seq * 100 + wave * 10 + k)
		e.respawns = false
		e.drops = false
		e.set_meta("raid", true)
		e.apply_world_level(wl)
		host.add_child(e)
		e.tree_exiting.connect(_on_gone.bind(e))
		_alive.append(e)
	preload("res://saga_core/ui/toast.gd").show(self, "📯 무리 습격 %d/%d — %d마리" % [wave + 1, WAVES, n], 2.5)


func _on_gone(e: Node) -> void:
	_alive.erase(e)


func alive_count() -> int:
	var c := 0
	for e: Variant in _alive:
		if is_instance_valid(e) and float((e as Node).get("hp")) > 0.0:
			c += 1
	return c
