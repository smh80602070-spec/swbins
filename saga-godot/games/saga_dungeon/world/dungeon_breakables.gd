extends Node3D

## G-0307 부서지는 통·항아리(디아블로 — 구조만 · 웹 2나락·유니티 U-0158 짝) — 방마다 벽가에 항아리·꽃병·통·궤짝 둘(정예·중보스 방 셋).
## 평타(melee_attack.try_attack)가 사거리 안 소품을 함께 깬다. 깨지면 K-0174 조각 넷이 물리로 튀어 FADE_SEC 뒤 사라지고
## 금(LootPickup._spawn_gold, 그 방 층 수) · 다섯에 하나 약병(LootPickup._spawn_potion). 자리·종류·약병 = 씨앗(방 × 131 + 자리) — 다시 지어도 같다.
## 깬 것은 이번 판에서만 기억(세이브 안 함 — 방에 들어올 때마다 새로 놓이는 웹·유니티와 같다). SAGA_BREAKABLE=0 이면 안 놓는다.

const LootPickup := preload("res://games/saga_dungeon/world/loot_pickup.gd")

const MODELS := ["jar_01", "vase_tall_01", "barrel_01", "crate_small_01"]
const DIR := "res://assets/world/"
const SHARDS := 4
const FADE_SEC := 1.4
const POTION_EVERY := 5
const HIT_PAD := 0.6     # 사거리 + 소품 반지름
const BOX := Vector3(0.7, 1.0, 0.7)
## 벽가 자리 여덟(방 원점 기준 x·z, 방 반쪽 6m) — 문(북·남 가운데)과 들머리는 비킴
const SPOTS := [Vector2(-5.0, -4.6), Vector2(5.0, -4.6), Vector2(-5.0, 4.4), Vector2(5.0, 4.4),
	Vector2(-5.1, -1.5), Vector2(5.1, -1.5), Vector2(-5.1, 1.6), Vector2(5.1, 1.6)]

var broken := 0


static func attach(room: Node, origins: Array, kinds: Array) -> Node:
	if OS.get_environment("SAGA_BREAKABLE") == "0":
		return null
	var n: Node3D = load("res://games/saga_dungeon/world/dungeon_breakables.gd").new()
	n.name = "Breakables"
	room.add_child(n)
	n.call("build", origins, kinds)
	return n


static func _h(a: int, b: int) -> int:
	var x := (a * 131 + b) * 2654435761
	x = (x ^ (x >> 15)) & 0x7fffffff
	return x


func build(origins: Array, kinds: Array) -> void:
	add_to_group("dungeon_breakables")
	for i in origins.size():
		var kind := String(kinds[i]) if i < kinds.size() else "fight"
		if kind == "well":
			continue
		var n := 3 if kind in ["elite", "miniboss"] else 2
		var used := {}
		for k in n:
			var s := _h(i, k) % SPOTS.size()
			while used.has(s):
				s = (s + 1) % SPOTS.size()
			used[s] = true
			var spot: Vector2 = SPOTS[s]
			var model := String(MODELS[_h(i, k + 7) % MODELS.size()])
			_place(Vector3(spot.x, 0.0, float(origins[i]) + spot.y), model, i + 1, _h(i, k + 13) % POTION_EVERY == 0)


func _place(p: Vector3, model: String, floor_num: int, potion: bool) -> void:
	var body := StaticBody3D.new()
	body.name = "Prop_%s_%d" % [model, get_child_count()]
	body.add_to_group("dungeon_breakable")
	body.set_meta("model", model)
	body.set_meta("floor", floor_num)
	body.set_meta("potion", potion)
	add_child(body)
	body.position = p
	var cs := CollisionShape3D.new()
	var box := BoxShape3D.new()
	box.size = BOX
	cs.shape = box
	cs.position.y = BOX.y * 0.5
	body.add_child(cs)
	var ps := load(DIR + model + ".glb") as PackedScene
	if ps != null:
		var vis := ps.instantiate() as Node3D
		vis.name = "Visual"
		body.add_child(vis)
		vis.rotation.y = float(_h(int(p.x * 10.0), int(p.z * 10.0)) % 628) * 0.01


func props() -> Array:
	var out: Array = []
	for c in get_children():
		if c.is_in_group("dungeon_breakable"):
			out.append(c)
	return out


## 평타가 부른다 — at 에서 reach 안 소품을 모두 깬다. 깬 수.
func hit_around(at: Vector3, reach: float) -> int:
	var n := 0
	for b: Node3D in props():
		var d := Vector2(b.global_position.x - at.x, b.global_position.z - at.z).length()
		if d <= reach + HIT_PAD:
			break_prop(b, b.global_position - at)
			n += 1
	return n


func break_prop(b: Node3D, push: Vector3) -> void:
	if not is_instance_valid(b) or not b.is_in_group("dungeon_breakable"):
		return
	b.remove_from_group("dungeon_breakable")
	broken += 1
	var bounty_nm: String = preload("res://games/saga_dungeon/data/dungeon_bounty.gd").prop()   # G-0372 현상금 — 통·항아리
	if bounty_nm != "":
		preload("res://saga_core/ui/toast.gd").show(self, "📜 현상금 채움 — " + bounty_nm, 2.5)
	var model := String(b.get_meta("model"))
	var at := b.global_position
	var dir := Vector3(push.x, 0.0, push.z).normalized() if Vector2(push.x, push.z).length() > 0.05 else Vector3.FORWARD
	var parts: Array = []
	for k in SHARDS:
		var ps := load(DIR + "%s_shard_%d.glb" % [model, k]) as PackedScene
		if ps == null:
			continue
		var rb := RigidBody3D.new()
		rb.collision_layer = 0
		rb.collision_mask = 1
		var src := ps.instantiate() as Node3D
		## 조각 노드 원점 = 무게중심(K-0174) — 몸을 그 자리에 두고 바깥 자리를 RigidBody 로
		var off := Vector3.ZERO
		for c in src.get_children():
			if c is Node3D:
				off = (c as Node3D).position
		src.position = -off
		rb.add_child(src)
		var cs := CollisionShape3D.new()
		var sh := SphereShape3D.new()
		sh.radius = 0.12
		cs.shape = sh
		rb.add_child(cs)
		add_child(rb)
		rb.global_position = at + off
		var side := Vector3(off.x, 0.0, off.z).normalized() if Vector2(off.x, off.z).length() > 0.01 else dir
		rb.apply_central_impulse((dir * 1.4 + side * 1.6 + Vector3.UP * 2.2) * rb.mass)
		rb.angular_velocity = Vector3(float(k) - 1.5, 2.0, 1.5 - float(k)) * 3.0
		parts.append(rb)
	b.queue_free()
	get_tree().create_timer(FADE_SEC).timeout.connect(func() -> void:
		for r in parts:
			if is_instance_valid(r):
				(r as Node).queue_free())
	var floor_num := int(b.get_meta("floor", 1))
	LootPickup._spawn_gold(self, at + Vector3(0.0, 0.0, 0.0), floor_num)
	if bool(b.get_meta("potion", false)):
		LootPickup._spawn_potion(self, at + Vector3(0.5, 0.0, 0.3), floor_num)
	_sound(at)


func _sound(at: Vector3) -> void:
	var path := "res://assets/audio/sfx/sfx_prop_break%s.ogg" % ("" if broken % 4 == 0 else "_%d" % (broken % 4))
	if not ResourceLoader.exists(path):
		return
	var sp := AudioStreamPlayer3D.new()
	sp.stream = load(path)
	sp.bus = "SFX" if AudioServer.get_bus_index("SFX") >= 0 else "Master"
	add_child(sp)
	sp.global_position = at
	sp.play()
	sp.finished.connect(sp.queue_free)
