extends Node
## G-0066 [R-3] 코드로 그린 몸 셋 — scene_probe_host 로 돈다(오토로드 필요). features gd.go.g1-pet-model · gd.fs.fusion-monsters · gd.rk.monster-sil.
## ① 사가고 신수: PETS 의 모든 신수가 PET_LOOKS 에 모양이 있고 build_pet 이 메시를 가진 몸·키가 목표의 0.6~2배(장식 포함)
## ② 사가의숲 괴물: 굴 표(CREATURES)의 종마다 몸에 메시·종 12 이상 ③ 사가국지 몬스터 실루엣: 보스가 일반보다 크고 메시가 더 많다.

const Pets := preload("res://saga_core/data/pets.gd")
const CreatureBuilder := preload("res://saga_core/world/creature_builder.gd")
const ForestCreature := preload("res://games/saga_forest/world/forest_creature.gd")
const ForestCreatureBuilder := preload("res://games/saga_forest/world/forest_creature_builder.gd")
const RealmWorldmap := preload("res://games/saga_realm/world/realm_worldmap.gd")

var fails := 0


func _fail(msg: String) -> void:
	fails += 1
	print("  FAIL ", msg)


func _meshes(n: Node) -> Array:
	return n.find_children("*", "MeshInstance3D", true, false)


func _height(n: Node3D) -> float:
	var lo := INF
	var hi := -INF
	for mi in _meshes(n):
		var m := mi as MeshInstance3D
		if m.mesh == null:
			continue
		var xf := n.global_transform.affine_inverse() * m.global_transform
		var a := xf * m.mesh.get_aabb()
		lo = minf(lo, a.position.y)
		hi = maxf(hi, a.end.y)
	return hi - lo if hi > lo else 0.0


func run() -> int:
	# ① 신수
	var missing: Array = []
	var bad: Array = []
	for p: Dictionary in Pets.PETS:
		var id := String(p.id)
		if not CreatureBuilder.PET_LOOKS.has(id):
			missing.append(id)
			continue
		var body := CreatureBuilder.build_pet(id, 1.2)
		add_child(body)
		var h := _height(body)
		if _meshes(body).is_empty() or h < 1.2 * 0.6 or h > 1.2 * 2.0:   # 뿔·갈기·불꽃 장식까지 재므로 넓게 — 맞추기가 깨졌는지(수 배)만 본다
			bad.append("%s(h=%.2f)" % [id, h])
		body.queue_free()
	if not missing.is_empty():
		_fail("PET_LOOKS 에 없는 신수 %s" % [missing])
	if not bad.is_empty():
		_fail("신수 몸 이상 %s" % [bad])

	# ② 사가의숲 괴물
	var kinds := {}
	for c: Dictionary in ForestCreatureBuilder.CREATURES:
		kinds[String(c.kind)] = true
	for k in kinds:
		var fc: Node3D = ForestCreature.new()
		fc.set("_kind", k)
		add_child(fc)
		if _meshes(fc).is_empty():
			_fail("숲 괴물 %s 몸에 메시 없음" % k)
		fc.queue_free()
	if kinds.size() < 12:
		_fail("숲 괴물 종 %d (12 이상)" % kinds.size())

	# ③ 사가국지 실루엣
	var wm: Node3D = RealmWorldmap.new()
	var small: Node3D = wm.call("_build_monster_body", Color(0.6, 0.2, 0.2), false)
	var big: Node3D = wm.call("_build_monster_body", Color(0.4, 0.1, 0.4), true)
	add_child(small)
	add_child(big)
	if not (_height(big) > _height(small) * 1.2 and _meshes(big).size() > _meshes(small).size()):
		_fail("보스 실루엣이 일반보다 크고 뿔이 많아야 (h %.2f/%.2f, 메시 %d/%d)" % [_height(big), _height(small), _meshes(big).size(), _meshes(small).size()])
	small.queue_free()
	big.queue_free()
	wm.free()
	print("  신수 %d · 숲 괴물 %d종" % [Pets.PETS.size(), kinds.size()])
	return fails
