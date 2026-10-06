extends SceneTree

## G-0036 사가스토리 사냥터 쓰러짐(재미 표준 F — data/story_combat.gd fall_gold_lost·data/story_save_state.gd apply_fall·world/story_field.gd 관찰자) 자동 점검. 씨앗 고정(20260824).
##   godot --headless --path saga-godot --script res://tools/probe_story_fall.gd
## ① 규칙: 남기는 몫 0.5(side.js die() goldKept = round(run.gold*0.5)) · 0·음수 → 0 · 7 → 3 · 100 → 50
## ② apply_fall: 금 1000·들어온 때 800 → 100 잃음 · 상점에서 써서 들어온 때보다 적으면 0
## ③ 사냥터 노드(story_field.gd) + StoryPlayer: 들어온 때 금 기억 · hp>0 이면 안 쓰러짐 · hp=0 → 조작 없이 쓰러짐·주운 금 절반·플레이어 멈춤·귀환 타이머 1.5초 · 두 번 안 쓰러짐.
## 진짜 세이브는 안 건드린다(save_on_fall=false, 문 도착 경로로 띄워 try_load 를 안 탄다). 상태는 끝에 되돌린다. 끝에 "PROBE story_fall OK" 또는 "PROBE story_fall FAIL n".

var fails := 0


func check(cond: bool, msg: String) -> void:
	if cond:
		print("  ok   ", msg)
	else:
		fails += 1
		print("  FAIL ", msg)


func _initialize() -> void:
	await process_frame
	seed(20260824)
	var S: Node = root.get_node("StorySaveState")
	var Combat: GDScript = load("res://games/saga_story/data/story_combat.gd")
	var saved := {"gold": S.gold, "pending": S.has_pending_spawn, "pending_x": S.pending_spawn_x}

	# ① 규칙
	check(Combat.FALL_GOLD_KEEP == 0.5, "남기는 몫 0.5(side.js die())")
	check(Combat.fall_gold_lost(0) == 0 and Combat.fall_gold_lost(-40) == 0, "주운 금 0·음수 → 잃는 것 0")
	check(Combat.fall_gold_lost(7) == 3 and Combat.fall_gold_lost(100) == 50, "7 → 3 잃음(4 남김, 반올림) · 100 → 50")

	# ② apply_fall
	S.gold = 1000
	var lost: int = S.apply_fall(800)
	check(lost == 100 and S.gold == 900, "금 1000·들어온 때 800 → 100 잃고 900")
	S.gold = 300
	lost = S.apply_fall(800)
	check(lost == 0 and S.gold == 300, "들어온 때보다 적으면(상점에서 씀) 잃는 것 0")

	# ③ 사냥터 노드
	S.gold = 500
	S.set_pending_spawn(0.0)  # 문 도착 경로 — try_load 를 안 탄다
	var field := Node3D.new()
	field.set_script(load("res://games/saga_story/world/story_field.gd"))
	field.set("save_on_fall", false)
	var p: CharacterBody3D = (load("res://games/saga_story/player/StoryPlayer.tscn") as PackedScene).instantiate()
	field.add_child(p)
	root.add_child(field)
	await process_frame
	check(int(field.get("_start_gold")) == 500 and not field.get("_fallen"), "들어온 때 금 500 기억 · 아직 안 쓰러짐")
	S.gold = 800  # 사냥터에서 300 주움
	p.hp = 10.0
	p.set_physics_process(true)
	await process_frame
	await process_frame
	check(not field.get("_fallen") and S.gold == 800, "hp>0 이면 안 쓰러짐")
	p.hp = 0.0
	await process_frame
	await process_frame
	var t: Timer = field.get("_return_timer")
	check(field.get("_fallen") and S.gold == 650, "hp 0 → 조작 없이 쓰러짐 · 주운 300 의 절반 150 잃고 650")
	check(not p.is_physics_processing() and p.velocity == Vector3.ZERO, "쓰러지면 플레이어 멈춤")
	check(t != null and t.wait_time == 1.5 and not t.is_stopped(), "1.5초 뒤 허도로 돌아가는 타이머")
	await process_frame
	check(S.gold == 650, "두 번 안 쓰러짐(금 그대로)")
	field.free()  # 타이머째 지워 장면 전환은 안 일어난다

	S.gold = saved.gold
	S.has_pending_spawn = saved.pending
	S.pending_spawn_x = saved.pending_x
	print("PROBE story_fall ", "OK" if fails == 0 else "FAIL %d" % fails)
	quit(1 if fails > 0 else 0)
