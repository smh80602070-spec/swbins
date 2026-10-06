extends Node
## G-0034 사가고 보스·엔딩 곡·짧은 음악(world/go_bgm.gd · saga_core/audio/bgm.gd 스팅어) 자동 점검 — 평소엔 안 붙는다.
## test_village.gd 가 SAGA_MUSIC_PROBE 가 있을 때만 단다.
##
##   SAGA_MUSIC_PROBE=1 "$GODOT" --headless --path saga-godot res://games/saga_go/world/TestVillage.tscn
##
## 헤드리스는 곡을 안 연다(bgm.gd 규칙) — 걸어 달라고 한 키(Bgm last_stinger·_want)로 본다.
## ① 레벨업 → levelup, 1.5초 안 다시 → 무시 ② 도감 수 늘면 → discover ③ 장 완료 → quest ④ 비경 cleared → victory ⑤ 전멸 → defeat
## ⑥ 알 ★5 → gacha_legend · ★4 → gacha_rare ⑦ 화려 상자 → secret ⑧ 체력 25% 밑 → danger(한 번), 50% 위로 다시 장전
## ⑨ 들판 보스와 싸움 → boss_appear·go-boss, 쓰러지면 victory ⑩ 결말 장(28) 뒤 go-ending. 바꾼 것은 끝에 되돌린다. 저장은 안 한다.

const Bgm := preload("res://saga_core/audio/bgm.gd")
const FieldEnemy := preload("res://games/saga_go/combat/field_enemy.gd")

var _m: Node
var _bg: Node
var _p: Node3D
var _frame := 0
var _step := 0
var _fails := 0
var _saved := {}

func _ready() -> void:
	_p = get_tree().get_first_node_in_group("player")

func _check(name: String, ok: bool, info := "") -> void:
	print("MUSIC_PROBE %s %s %s" % [name, "ok" if ok else "FAIL", info])
	if not ok:
		_fails += 1

func _last() -> String:
	return String(_bg.get("last_stinger"))

## 같은 키 간격(1.5초)에 안 걸리게 기록을 비운다.
func _clear_gap() -> void:
	(_bg.get("_st_at") as Dictionary).clear()

func _physics_process(_delta: float) -> void:
	_frame += 1
	if _m == null:
		_m = get_tree().get_first_node_in_group("go_music")
		_frame = 0
		return
	if not bool(_m.get("_hooked")) or float(_m.get("_age")) < 3.2:
		return
	if _bg == null:
		Bgm.stinger(self, "_probe_warm")
		_bg = get_tree().root.get_node_or_null("SagaBgm")
		return
	match _step:
		0:
			_clear_gap()
			var c0 := int(_bg.get("stinger_count"))
			PartyState.level_up.emit(99)
			var a := _last()
			PartyState.level_up.emit(99)
			_check("levelup_gap", a == "levelup" and int(_bg.get("stinger_count")) == c0 + 1, "last=%s n=%d→%d" % [a, c0, int(_bg.get("stinger_count"))])
			_saved.book = CodexState.book.duplicate()
			CodexState.book["place:__music_probe__"] = true
			CodexState.codex_changed.emit()
			_check("discover", _last() == "discover", _last())
			var sq := get_tree().get_first_node_in_group("go_story")
			sq.emit_signal("chapter_done", 3)
			_check("quest", _last() == "quest", _last())
			get_tree().get_first_node_in_group("go_domains").emit_signal("state_changed", "cleared")
			_check("victory_domain", _last() == "victory", _last())
			get_tree().get_first_node_in_group("go_field_combat").emit_signal("party_wiped")
			_check("defeat", _last() == "defeat", _last())
			var eg := get_tree().get_first_node_in_group("go_eggs")
			eg.emit_signal("hatched", "pt_baekho", false)
			var leg := _last()
			eg.emit_signal("hatched", "pt_gumiho", false)
			_check("gacha", leg == "gacha_legend" and _last() == "gacha_rare", "%s/%s" % [leg, _last()])
			var chest := get_tree().get_first_node_in_group("treasure_chest")
			if chest != null:
				var g0 = chest.get("grade")
				chest.set("grade", "luxurious")
				chest.emit_signal("opened", chest)
				chest.set("grade", g0)
			_check("secret", chest != null and _last() == "secret", _last())
			## 체력 — field_combat 대신 hp·max_hp 만 가진 가짜로.
			var fake_s := GDScript.new()
			fake_s.source_code = "extends Node\nvar hp := 20.0\nvar max_hp := 100.0\n"
			fake_s.reload()
			var fake: Node = fake_s.new()
			_clear_gap()
			_m.call("_watch_danger", fake)
			var d1 := _last()
			_bg.set("last_stinger", "")
			_clear_gap()
			_m.call("_watch_danger", fake)
			var d2 := _last()
			fake.set("hp", 80.0)
			_m.call("_watch_danger", fake)
			fake.set("hp", 10.0)
			_clear_gap()
			_m.call("_watch_danger", fake)
			_check("danger", d1 == "danger" and d2 == "" and _last() == "danger", "%s/%s/%s" % [d1, d2, _last()])
			fake.free()
			_step = 1
			_frame = 0
		1:
			## 들판 보스 하나를 깨워 곁에 선다.
			var boss: Node3D = null
			for e in get_tree().get_nodes_in_group("field_enemy"):
				var s: Script = e.get_script()
				if s != null and s.resource_path.ends_with("field_boss.gd") and not e.call("is_dead"):
					boss = e
					break
			if boss == null:
				_check("boss", false, "들판 보스 없음")
				_step = 3
				return
			_saved.boss = boss
			_saved.boss_ai = int(boss.get("ai"))
			_saved.pos = _p.global_position
			_p.global_position = boss.global_position + Vector3(6, 0.5, 0)
			boss.set_physics_process(false)
			boss.set("ai", FieldEnemy.AI.CHASE)
			_clear_gap()
			_m.set("_danger_armed", false)   # 실제 체력이 낮으면 같은 주기에 위험 음악이 기록을 덮는다
			_m.set("_t", 1.0)   # 다음 프레임에 바로 살핀다
			_step = 2
			_frame = 0
		2:
			if _frame < 20:   # 물리 프레임이 화면 프레임보다 앞서 돌 수 있다
				return
			var boss: Node = _saved.boss
			var appear := _last()
			var want := String(_bg.get("_want"))
			boss.set("ai", FieldEnemy.AI.DEAD)
			_clear_gap()
			_m.call("_watch_boss", _p)
			_check("boss", appear == "boss_appear" and want == "go-boss" and _last() == "victory" and _m.get("_boss") == null,
				"appear=%s want=%s after=%s" % [appear, want, _last()])
			boss.set("ai", _saved.boss_ai)
			boss.set_physics_process(true)
			_p.global_position = _saved.pos
			_step = 3
			_frame = 0
		3:
			get_tree().get_first_node_in_group("go_story").emit_signal("chapter_done", 28)
			_m.set("_t", 1.0)
			_step = 4
			_frame = 0
		4:
			if _frame < 20:
				return
			var want := String(_bg.get("_want"))
			_check("ending", want == "go-ending" and float(_m.get("_ending_left")) > 100.0, "want=%s left=%.0f" % [want, float(_m.get("_ending_left"))])
			_m.set("_ending_left", 0.0)
			CodexState.book = _saved.book
			print("MUSIC_PROBE_DONE fails=%d" % _fails)
			get_tree().quit()
			_step = 5
