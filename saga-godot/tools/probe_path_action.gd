extends Node
## G-0240 길 행동(games/saga_go/world/path_action.gd) 자동 점검 — 평소엔 안 붙는다. test_village.gd 가
## SAGA_PATH_ACTION_PROBE 가 있을 때만 단다.
##
##   SAGA_PATH_ACTION_PROBE=1 "$GODOT" --headless --path saga-godot res://games/saga_go/world/TestVillage.tscn
##
## 명단(PartyState.members)·촌장 사명/상인 제안 상태·날짜(Commissions.time_offset)를 잠깐 바꾸고 끝에 되돌린다.
## 세이브는 임시 파일(SaveState.path_override)로만 왕복한다.
## ① 성향 셋 갈림 ② 동료 없음 ③ 조사 = 열린 비경 입구 최근접 ④ 하루 한 번 ⑤ 거절 -1 ⑥ 날 바뀌면 풀림
## ⑦ 이끌기 = 40m 넘는 최근접 길목 · 주민·TalkArea 가 땅 따라 걸음 · 시간 지나면 집으로 ⑧ 도발 승 경험 +30
## ⑨ 도발 60초 넘김 → 거절 ⑩ 전멸 → 거절 ⑪ 결투 중엔 안 됨(소모 없음) ⑫ 저장 왕복·없으면 빈 것

const PathAction := preload("res://games/saga_go/world/path_action.gd")
const Characters := preload("res://saga_core/data/characters.gd")
const Commissions := preload("res://games/saga_go/data/commissions.gd")
const Domains := preload("res://games/saga_go/data/domains.gd")
const TerrainBuilder := preload("res://games/saga_go/world/terrain_builder.gd")
const TMP := "user://probe_path_action_save.json"

var _p: CharacterBody3D
var _pa: Node
var _npc: Node
var _frame := 0
var _step := 0
var _fails := 0
var _heroes := {} # 행동 key → hero id
var _elder := {}
var _merchant := {}
var _old := {}
var _home := Vector3.ZERO
var _exp0 := 0.0
var _enemy: Node = null

func _ready() -> void:
	Weather.force("clear")
	_p = get_tree().get_first_node_in_group("player")

func _physics_process(_delta: float) -> void:
	_frame += 1
	if _pa == null:
		_pa = get_tree().get_first_node_in_group("go_path_action")
		return
	match _step:
		0:
			if _frame < 60:
				return
			_npc = _pa.get_parent()
			for v in _npc.VILLAGERS:
				if v.id == "npc_elder":
					_elder = v
				elif v.id == "npc_merchant":
					_merchant = v
			_old = {"members": PartyState.members.duplicate(), "size": PartyState.party_size, "offered": QuestState.offered.duplicate(),
				"resolved": EventState.resolved.duplicate(), "go_path": PartyState.go_path.duplicate(true)}
			if not QuestState.offered.has("village_ask"):
				QuestState.offered.append("village_ask")
			EventState.mark_resolved("offer_npc_merchant")
			PartyState.party_size = maxi(PartyState.party_size, 1)
			PartyState.go_path = {}
			Commissions.time_offset = 0.0
			# ① 성향 셋 — 축마다 그 축이 가장 높은 인물 하나
			for h in Characters.HEROES:
				var a: Dictionary = PathAction.path_of(h)
				if not a.is_empty() and not _heroes.has(a.key):
					_heroes[a.key] = h.id
			var tie: Dictionary = PathAction.path_of({"stats": {"might": 50, "wisdom": 50, "command": 50}})
			_check("three_paths", _heroes.size() == 3 and tie.key == "probe", "heroes=%s tie=%s" % [_heroes, tie.get("key", "")])
			# ② 동료 없음
			_lead("")
			var r0: Dictionary = _pa.call("act", _elder)
			_check("no_lead", not bool(r0.ok) and r0.why == "no_lead" and int(_pa.call("used", "npc_elder")) == 0, "r=%s" % [r0])
			# ③ 조사
			_near(_elder)
			_lead(_heroes.probe)
			_pa.set("test_roll", 0.9)
			var me := _p.global_position
			var want := ""
			var bd := INF
			var dm := get_tree().get_first_node_in_group("go_domains")
			var gates: Dictionary = dm.get("_gates")
			for id in gates:
				if Domains.domain_open(id):
					var d := Vector2(gates[id].x - me.x, gates[id].z - me.z).length()
					if d < bd:
						bd = d
						want = id
			var r1: Dictionary = _pa.call("act", _elder)
			_check("probe_nearest", bool(r1.ok) and r1.act == "probe" and r1.has("target") and r1.target.id == want, "r=%s want=%s" % [r1, want])
			# ④ 하루 한 번
			var r2: Dictionary = _pa.call("act", _elder)
			_check("once_a_day", not bool(r2.ok) and r2.why == "used" and int(_pa.call("used", "npc_elder")) == 1, "r=%s" % [r2])
			# ⑤ 거절
			_near(_merchant)
			_lead(_heroes.lead)
			_pa.set("test_roll", 0.1)
			var r3: Dictionary = _pa.call("act", _merchant)
			var r3b: Dictionary = _pa.call("act", _merchant)
			_check("refuse", not bool(r3.ok) and r3.why == "refused" and int(_pa.call("used", "npc_merchant")) == -1 and r3b.why == "used", "r=%s r2=%s" % [r3, r3b])
			# ⑥ 날 바뀜
			Commissions.time_offset = 86400.0
			_check("new_day", int(_pa.call("used", "npc_elder")) == 0 and int(_pa.call("used", "npc_merchant")) == 0, "go_path=%s" % [PartyState.go_path])
			# ⑦ 이끌기
			_pa.set("test_roll", 0.9)
			_near(_elder)
			_home = (_npc.roots["npc_elder"] as Node3D).global_position
			var me2 := _p.global_position
			var wp: Dictionary = get_tree().get_first_node_in_group("go_waypoints").get("_nodes")
			var wid := ""
			var wd := INF
			for id in wp:
				var d := Vector2(wp[id].pos.x - me2.x, wp[id].pos.z - me2.z).length()
				if d > PathAction.LEAD_MIN_M and d < wd:
					wd = d
					wid = id
			var r4: Dictionary = _pa.call("act", _elder)
			_check("lead_target", bool(r4.ok) and r4.act == "lead" and r4.target.id == wid and wd > 40.0, "r=%s want=%s %.0fm" % [r4, wid, wd])
			_next()
		1: # 걷는 중
			if _frame == 40:
				var r: Node3D = _npc.roots["npc_elder"]
				var moved := Vector2(r.global_position.x - _home.x, r.global_position.z - _home.z).length()
				var ground := TerrainBuilder.height_at("village", r.global_position)
				var area: Node3D = r.get_node("TalkArea")
				_check("lead_walk", moved > 0.5 and absf(r.global_position.y - ground) < 0.05 and area.global_position.is_equal_approx(r.global_position),
					"moved=%.2f dy=%.3f" % [moved, r.global_position.y - ground])
				var l: Dictionary = _pa.get("leading")
				var far := PathAction.lead_sec(146.0)
				_check("lead_far", far * PathAction.LEAD_SPEED > 146.0 + 0.5 and float(l.sec) >= PathAction.LEAD_SEC,
					"146m sec=%.1f sec=%.1f" % [far, float(l.sec)])
				l.t = float(l.sec) + 0.1
			elif _frame > 40:
				if (_pa.get("leading") as Dictionary).is_empty():
					var r: Node3D = _npc.roots["npc_elder"]
					_check("lead_home", r.global_position.distance_to(_home) < 0.05, "d=%.2f" % r.global_position.distance_to(_home))
					_next()
				elif _frame > 900:
					_check("lead_home", false, "timeout")
					_next()
		2: # ⑧ 도발 승
			if _frame == 1:
				Commissions.time_offset = 86400.0 * 2.0
				_near(_elder)
				_lead(_heroes.provoke)
				_pa.set("test_roll", 0.0) # 도발은 굴림 안 씀 — 0 이어도 거절 없음
				_exp0 = PartyState.exp
				var r: Dictionary = _pa.call("act", _elder)
				_enemy = (_pa.get("duel") as Dictionary).get("enemy", null)
				var want := PartyState.atk * PathAction.PROVOKE_HP_MUL
				_check("provoke_spawn", bool(r.ok) and r.act == "provoke" and is_equal_approx(float(r.foe_hp), want) and _enemy != null
					and absf(float(_enemy.get("max_hp")) - want) < 0.5 and int(_pa.call("used", "npc_elder")) == 1,
					"r=%s want=%.0f hp=%s" % [r, want, _enemy.get("max_hp") if _enemy else -1])
			elif _frame == 10:
				_enemy.call("apply_damage", 1e9, false)
			elif _frame == 14:
				var gain := PartyState.exp - _exp0
				_check("provoke_win", (_pa.get("duel") as Dictionary).is_empty() and gain >= PathAction.PROVOKE_EXP - 0.01 and int(_pa.call("used", "npc_elder")) == 1
					and bool((_pa.get("last") as Dictionary).get("won", false)), "gain=%.1f last=%s" % [gain, _pa.get("last")])
				# ⑨ 60초 넘김
				_near(_merchant)
				var r: Dictionary = _pa.call("act", _merchant)
				_enemy = (_pa.get("duel") as Dictionary).get("enemy", null)
				(_pa.get("duel") as Dictionary).t = PathAction.PROVOKE_SEC + 0.1
				_check("provoke_start2", bool(r.ok), "r=%s" % [r])
			elif _frame == 18:
				_check("provoke_timeout", (_pa.get("duel") as Dictionary).is_empty() and int(_pa.call("used", "npc_merchant")) == -1
					and String((_pa.get("last") as Dictionary).get("why", "")) == "time" and (not is_instance_valid(_enemy) or _enemy.is_queued_for_deletion()), "last=%s" % [_pa.get("last")])
				# ⑩ 전멸
				Commissions.time_offset = 86400.0 * 3.0
				_near(_elder)
				_pa.call("act", _elder)
				var fc := get_tree().get_first_node_in_group("go_field_combat")
				fc.emit_signal("party_wiped")
				_check("provoke_wipe", (_pa.get("duel") as Dictionary).is_empty() and int(_pa.call("used", "npc_elder")) == -1
					and String((_pa.get("last") as Dictionary).get("why", "")) == "wipe", "last=%s" % [_pa.get("last")])
				# ⑪ 결투 중엔 안 됨
				_near(_merchant)
				var dummy := Node.new()
				dummy.add_to_group("duel_active")
				add_child(dummy)
				var rb: Dictionary = _pa.call("act", _merchant)
				dummy.queue_free()
				_check("busy", not bool(rb.ok) and rb.why == "busy" and int(_pa.call("used", "npc_merchant")) == 0, "r=%s" % [rb])
				_next()
		3: # ⑫ 저장 왕복 — 명단·사명 등은 먼저 되돌린다
			if _frame < 5:
				return
			PartyState.members.assign(_old.members)
			PartyState.party_size = _old.size
			QuestState.offered.assign(_old.offered)
			EventState.resolved.assign(_old.resolved)
			var old_override := String(SaveState.path_override)
			SaveState.path_override = TMP
			var gp := {"day": Commissions.today(), "used": {"npc_elder": 1, "npc_merchant": -1}}
			PartyState.go_path = gp.duplicate(true)
			var saved: bool = SaveState.save()
			PartyState.go_path = {}
			var loaded: bool = SaveState.try_load()
			var round_ok := saved and loaded and int(PartyState.go_path.get("day", -1)) == int(gp.day) \
				and int(PartyState.go_path.used.get("npc_elder", 0)) == 1 and int(PartyState.go_path.used.get("npc_merchant", 0)) == -1
			var data: Variant = JSON.parse_string(FileAccess.get_file_as_string(TMP))
			(data as Dictionary).erase("go_path")
			var f := FileAccess.open(TMP, FileAccess.WRITE)
			f.store_string(JSON.stringify(data))
			f.close()
			PartyState.go_path = gp.duplicate(true)
			var loaded2: bool = SaveState.try_load()
			_check("save_roundtrip", round_ok and loaded2 and PartyState.go_path.is_empty(), "go_path=%s" % [PartyState.go_path])
			SaveState.path_override = old_override
			for suffix in ["", ".bak", ".tmp", ".before_import"]:
				DirAccess.remove_absolute(ProjectSettings.globalize_path(TMP + suffix))
			PartyState.go_path = _old.go_path
			Commissions.time_offset = 0.0
			_pa.set("test_roll", -1.0)
			print("PATH_ACTION_PROBE_DONE fails=%d" % _fails)
			get_tree().quit()

func _lead(id: String) -> void:
	var m: Array[String] = []
	if id != "":
		m.append(id)
		for x in _old.members:
			if x != id:
				m.append(x)
	PartyState.members = m

## 그 주민 3m 옆에 선다.
func _near(v: Dictionary) -> void:
	var r: Node3D = _npc.roots[v.id]
	_p.global_position = r.global_position + Vector3(3.0, 0.5, 0.0)
	_p.velocity = Vector3.ZERO

func _check(name: String, ok: bool, detail: String) -> void:
	if not ok:
		_fails += 1
	print("PATH_ACTION_PROBE %s %s %s" % [name, "ok" if ok else "FAIL", detail])

func _next() -> void:
	_step += 1
	_frame = 0
