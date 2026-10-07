extends Node
## G-0059 들판 적·보스 몸(saga_core/world/monster_body.gd) 자동 점검 — 평소엔 안 붙는다. test_village.gd 가
## SAGA_MONSTER_BODY_PROBE 가 있을 때만 단다.
##
##   SAGA_MONSTER_BODY_PROBE=1 "$GODOT" --headless --path saga-godot res://games/saga_go/world/TestVillage.tscn
##
## ① 짝 표 — 들판 여덟 종이 정한 갈래 mon_, 보스 다섯이 정한 boss_, 도적·사람 몸 보스는 "" ② 실제로 세운 여덟 종·보스 다섯이
## GLB 몸(glb_path)이고 AnimationPlayer 에 Idle·Walk·Attack·Hit·Death ③ 키가 def.height(늑대 1.05) ±10%
## ④ 같은 종 넷을 세우면 변형이 둘 이상 ⑤ 예고 → Attack, 맞으면 Hit, 쓰러지면 쓰러진 몸이 장면에 남아 Death·새 몸은 GLB
## ⑥ 기본(SAGA_GLB_MONSTERS 없음)·SAGA_CODE_CREATURES=1 이면 "" (코드 짐승). 점검 동안만 SAGA_GLB_MONSTERS=1 을 켠다. 세운 적은 플레이어에게서 150m 밖(잠듦)에 두고 끝에 치운다. 저장 안 함.

const FieldEnemy := preload("res://games/saga_go/combat/field_enemy.gd")
const MonsterBody := preload("res://saga_core/world/monster_body.gd")

## 짝(정함, G-0059 티켓) — 종 → 갈래.
const FIELD := {"wolf": "quad", "thunder_cat": "quad", "ice_fox": "quad", "rock_bear": "quad",
	"wind_hawk": "wing", "grass_snake": "serp", "fire_imp": "spir", "water_turtle": "cons"}
const BOSSES := {"storm_serpent": "boss_06", "gale_roc": "boss_04", "tide_turtle": "boss_08", "ember_king": "boss_10", "snow_bear_king": "boss_01"}

var _p: Node3D
var _frame := 0
var _step := 0
var _fails := 0
var _made: Array = []
var _base := Vector3.ZERO

func _ready() -> void:
	_p = get_tree().get_first_node_in_group("player")
	OS.set_environment("SAGA_GLB_MONSTERS", "1")

func _physics_process(_delta: float) -> void:
	_frame += 1
	if _frame < 5 and _step == 0:
		return
	match _step:
		0: # ① 짝 표
			var bad: Array = []
			for k in FIELD:
				var path := MonsterBody.path_for(FieldEnemy.KINDS, k, "x")
				if not path.begins_with("res://assets/world/mon_%s_0" % FIELD[k]):
					bad.append("%s→%s" % [k, path])
			for k in BOSSES:
				var path := MonsterBody.path_for(FieldEnemy.KINDS, k, "x")
				if path != "res://assets/world/%s.glb" % BOSSES[k]:
					bad.append("%s→%s" % [k, path])
			for k in ["bandit", "black_mask", "storm_king"]:
				if MonsterBody.path_for(FieldEnemy.KINDS, k, "x") != "":
					bad.append(k)
			## 모든 몬스터·보스 종이 실제 있는 파일을 가리키나
			for k in FieldEnemy.KINDS:
				for nm in ["a", "b", "c", "d", "e"]:
					var path := MonsterBody.path_for(FieldEnemy.KINDS, k, nm)
					if path != "" and not ResourceLoader.exists(path):
						bad.append("없음 " + path)
			_check("table", bad.is_empty(), "bad=%s" % [bad])
			_next()
		1: # ②③ 여덟 종 + 보스 다섯을 세운다
			if _frame == 1:
				_base = _p.global_position + Vector3(160.0, 0.0, 160.0)
				var i := 0
				for k in FIELD.keys() + BOSSES.keys():
					_made.append(_spawn(k, "MB_%s" % k, _base + Vector3(float(i % 5) * 9.0, 0.0, float(i / 5) * 9.0)))
					i += 1
			elif _frame == 10:
				var bad: Array = []
				var tall: Array = []
				for e in _made:
					var path := String(e.get("glb_path"))
					var ap := e.get("_anim") as AnimationPlayer
					var want: String = ("mon_" + FIELD[e.kind]) if FIELD.has(e.kind) else String(BOSSES.get(e.kind, "?"))
					if not path.contains(want) or ap == null:
						bad.append("%s path=%s ap=%s" % [e.kind, path, ap])
						continue
					for a in ["Idle", "Walk", "Attack", "Hit", "Death"]:
						if not ap.has_animation(a):
							bad.append("%s 애니 %s 없음" % [e.kind, a])
					var h := _height(e.get("_visual") as Node3D)
					var target := float(e.def.get("height", FieldEnemy.WOLF_HEIGHT))
					tall.append("%s %.2f/%.2f" % [e.kind, h, target])
					if absf(h - target) > target * 0.1:
						bad.append("%s 키 %.2f ≠ %.2f" % [e.kind, h, target])
				_check("bodies", bad.is_empty(), "bad=%s" % [bad])
				_check("height", bad.filter(func(s: String) -> bool: return s.contains("키")).is_empty(), " ".join(tall))
				_next()
		2: # ④ 같은 종 넷 — 변형이 갈린다
			if _frame == 1:
				for n in 4:
					_made.append(_spawn("wolf", "FieldEnemy_probe_%d" % n, _base + Vector3(float(n) * 4.0, 0.0, -20.0)))
			elif _frame == 5:
				var seen := {}
				for e in _made.slice(_made.size() - 4):
					seen[String(e.get("glb_path"))] = true
				_check("variants", seen.size() >= 2, "paths=%s" % [seen.keys()])
				_next()
		3: # ⑤ 예고 → Attack · 맞기 → Hit · 쓰러짐 → 장면에 쓰러진 몸(Death)·새 몸
			var e: Node = _made[0] # wolf
			if _frame == 1:
				e.call("_set_tell", true)
				var a1 := (e.get("_anim") as AnimationPlayer).current_animation
				e.call("_set_tell", false)
				e.set("_anim_lock", 0)
				e.set("ai", FieldEnemy.AI.CHASE)
				e.call("apply_damage", 1.0, false, Vector3.FORWARD)
				var a2 := (e.get("_anim") as AnimationPlayer).current_animation
				_check("attack_hit", a1 == "Attack" and a2 == "Hit", "tell=%s hit=%s" % [a1, a2])
				var old_visual: Node3D = e.get("_visual")
				e.set("drops", false)
				e.call("apply_damage", 99999.0, false, Vector3.FORWARD)
				var ap := old_visual.get_node_or_null("AnimationPlayer") as AnimationPlayer
				var fresh: Node3D = e.get("_visual")
				_check("death", old_visual.get_parent() == get_tree().current_scene and ap != null and ap.current_animation == "Death"
					and fresh != old_visual and fresh.get_parent() == e and String(e.get("glb_path")) != "",
					"corpse_parent=%s anim=%s fresh=%s" % [old_visual.get_parent(), ap.current_animation if ap else "-", fresh])
				_next()
		4: # ⑥ SAGA_CODE_CREATURES=1 → 코드 짐승
			OS.set_environment("SAGA_CODE_CREATURES", "1")
			var e := _spawn("fire_imp", "MB_code", _base + Vector3(0.0, 0.0, -40.0))
			var code_ok := MonsterBody.path_for(FieldEnemy.KINDS, "wolf", "x") == "" and String(e.get("glb_path")) == "" and e.get("_visual") != null
			OS.unset_environment("SAGA_CODE_CREATURES")
			OS.unset_environment("SAGA_GLB_MONSTERS")
			code_ok = code_ok and MonsterBody.path_for(FieldEnemy.KINDS, "wolf", "x") == ""
			OS.set_environment("SAGA_GLB_MONSTERS", "1")
			_made.append(e)
			_check("code_creatures", code_ok and MonsterBody.path_for(FieldEnemy.KINDS, "wolf", "x") != "", "glb=%s" % e.get("glb_path"))
			_next()
		5:
			OS.unset_environment("SAGA_GLB_MONSTERS")
			for e in _made:
				if is_instance_valid(e):
					e.queue_free()
			print("MONSTER_BODY_PROBE_DONE fails=%d" % _fails)
			get_tree().quit()

func _spawn(kind: String, nm: String, pos: Vector3) -> Node:
	var e := FieldEnemy.new()
	e.name = nm
	e.setup(kind, pos, 20260824)
	e.respawns = false
	get_tree().current_scene.add_child(e)
	return e

## 몸의 메시 전체 세로 크기(장면 좌표).
func _height(v: Node3D) -> float:
	var box := AABB()
	var first := true
	for mi in v.find_children("*", "MeshInstance3D", true, false):
		var m := mi as MeshInstance3D
		if m.mesh == null:
			continue
		var b: AABB = m.global_transform * m.mesh.get_aabb()
		box = b if first else box.merge(b)
		first = false
	return box.size.y

func _check(name: String, ok: bool, detail: String) -> void:
	if not ok:
		_fails += 1
	print("MONSTER_BODY_PROBE %s %s %s" % [name, "ok" if ok else "FAIL", detail])

func _next() -> void:
	_step += 1
	_frame = 0
