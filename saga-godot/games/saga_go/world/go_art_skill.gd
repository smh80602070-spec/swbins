extends Node

## G-0400 1만리 보패 세트 기술(디아블로 세트 스킬 결 — 구조만) — 웹 saga-web/saga-go/js/artifact-skill.js(W-0438 ①) 짝, 수치 그대로.
##   발동   싸우는 동안(둘레 r 안에 적) 앞에 선 인물이 네 점을 맞춘 세트마다 쿨(cd 초)이 돌면 둘레 r 안 들판 적 전부에
##          그 인물 공격력 × mul 피해(세트 원소, 없으면 그 인물 원소) · 둘레 고리 그림 하나
##   표     SKILL(세트 id → 기술) — K 생성기 표(W-0435: 세트 15)가 오면 줄만 늘린다. 세이브 안 바뀜(낀 보패에서 셈)
## 들판 전투(field_combat.gd 1499줄 — 상한이라 안 건드림)는 읽기만: active_id·char_atk·element. SAGA_ART_SKILL=0 이면 안 붙는다.
## 웹 r(×KDV) 은 고돗 들판 미터 그대로(1만리 들판 거리 눈금이 웹 칸과 같다 — field_combat 반경과 같은 자리수).

const SKILL := {
	"gladiator": {"name": "칼바람 베기", "emoji": "⚔️", "mul": 2.2, "r": 3.0, "cd": 9.0, "el": ""},
	"crimson": {"name": "불씨 터뜨림", "emoji": "🔥", "mul": 1.8, "r": 3.5, "cd": 10.0, "el": "fire"},
	"viridescent": {"name": "솔바람 회오리", "emoji": "🌪️", "mul": 1.6, "r": 4.0, "cd": 10.0, "el": "wind"},
	"emblem": {"name": "봉화 일제사", "emoji": "🚩", "mul": 2.0, "r": 3.0, "cd": 11.0, "el": ""},
	"depth": {"name": "나루 물결", "emoji": "🌊", "mul": 1.7, "r": 3.5, "cd": 10.0, "el": "water"},
}

var cds := {}      # 인물 id|세트 → 남은 쿨
var fired := 0     # 터진 수(점검용)


static func on() -> bool:
	return OS.get_environment("SAGA_ART_SKILL") != "0"


static func attach(host: Node) -> Node:
	if not on():
		return null
	var n: Node = (load("res://games/saga_go/world/go_art_skill.gd") as GDScript).new()
	n.name = "GoArtSkill"
	host.add_child(n)
	return n


## 그 인물이 네 점을 맞춘 세트들의 기술 [{set, ...}]
static func skills_of(id: String) -> Array:
	var out: Array = []
	if not on():
		return out
	var PS: Node = Engine.get_main_loop().root.get_node_or_null("PartyState")
	if PS == null:
		return out
	var c: Dictionary = PS.call("set_counts", id)
	for k: String in c:
		if int(c[k]) >= 4 and SKILL.has(k):
			var sk: Dictionary = (SKILL[k] as Dictionary).duplicate()
			sk["set"] = k
			out.append(sk)
	return out


func _process(delta: float) -> void:
	tick(delta)


## 쿨을 돌리고, 적이 둘레에 있으면 터뜨린다. 터진 수
func tick(delta: float) -> int:
	var fc := get_tree().get_first_node_in_group("go_field_combat")
	var pl := get_tree().get_first_node_in_group("player") as Node3D
	if fc == null or pl == null or not fc.has_method("active_id"):
		return 0
	var id := String(fc.call("active_id"))
	if id == "" or float(fc.get("hp")) <= 0.0:
		return 0
	var n := 0
	for sk: Dictionary in skills_of(id):
		var key := "%s|%s" % [id, String(sk.set)]
		cds[key] = float(cds.get(key, 0.0)) - delta
		if float(cds[key]) > 0.0:
			continue
		var foes: Array = []
		for e in get_tree().get_nodes_in_group("field_enemy"):
			var en := e as Node3D
			if en != null and en.visible and float(en.get("hp")) > 0.0 and en.global_position.distance_to(pl.global_position) <= float(sk.r):
				foes.append(en)
		if foes.is_empty():
			continue
		cds[key] = float(sk.cd)
		n += 1
		fired += 1
		var atk := float(fc.call("char_atk", id)) * float(sk.mul)
		var el := String(sk.el)
		for en: Node3D in foes:
			var dir := (en.global_position - pl.global_position)
			dir.y = 0.0
			en.call("apply_damage", atk, false, dir.normalized() if dir.length() > 0.01 else Vector3.FORWARD, el)
		_ring(pl.global_position, float(sk.r))
	return n


## 둘레 고리(0.5초 퍼졌다 사라짐) — 장면이 없으면(점검 무대) 안 그린다
func _ring(at: Vector3, r: float) -> void:
	var scene := get_tree().current_scene
	if scene == null:
		return
	var mi := MeshInstance3D.new()
	var tm := TorusMesh.new()
	tm.inner_radius = r - 0.12
	tm.outer_radius = r
	tm.rings = 24
	tm.ring_segments = 6
	mi.mesh = tm
	var m := StandardMaterial3D.new()
	m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	m.albedo_color = Color(1.0, 0.85, 0.4, 0.8)
	mi.material_override = m
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	scene.add_child(mi)
	mi.global_position = at + Vector3(0, 0.15, 0)
	var tw := mi.create_tween()
	tw.tween_property(m, "albedo_color:a", 0.0, 0.5)
	tw.tween_callback(mi.queue_free)
