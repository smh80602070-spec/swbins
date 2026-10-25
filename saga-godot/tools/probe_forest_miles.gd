extends SceneTree

## G-0409 3마을 마을 마일 자동 점검 —
##   godot --headless --path saga-godot --script res://tools/probe_forest_miles.gd   → "PROBE forest_miles OK" / "FAIL n"
## ① 다 된 줄만 받기 가능 · 받기 = 줄마다 +100 · 같은 날 다시 받기 0 · 새로 다 된 줄은 또 받음 · 날이 바뀌면 처음부터
## ② 「오늘」 창 받기 칸(goals_adapter.model claim) — ready/done·take 가 마일을 늘림
## ③ 바꾸기 — 모자라면 안 됨(마일·물건 그대로) · 되면 마일 −값·물건 +n
## ForestSaveState 는 메모리에서만 바꾸고 끝에 되돌린다(저장 안 함). 세이브 왕복은 probe_save_forest 의 miles 칸.

var fails := 0


func _fail(msg: String) -> void:
	fails += 1
	print("  FAIL ", msg)


func _initialize() -> void:   # autoload 이름은 _init 뒤에야 등록된다
	await process_frame
	var M: GDScript = load("res://games/saga_forest/data/forest_miles.gd")
	var F: Node = root.get_node("ForestSaveState")
	var old_miles: Dictionary = (F.get("miles") as Dictionary).duplicate(true)
	var old_items: Dictionary = (F.get("items") as Dictionary).duplicate(true)
	F.set("miles", {})
	var rows := [{"label": "주민과 이야기", "done": true}, {"label": "주민에게 선물", "done": false}]
	# ①
	if M.claimable(F, rows, 10) != ["주민과 이야기"]:
		_fail("① claimable %s" % [M.claimable(F, rows, 10)])
	var a: int = M.take(F, rows, 10)
	var b: int = M.take(F, rows, 10)
	rows[1].done = true
	var c: int = M.take(F, rows, 10)
	var d: int = M.take(F, rows, 11)
	print("MILES take %d · 다시 %d · 새 줄 %d · 다음 날 %d · 모은 %d" % [a, b, c, d, M.pts(F)])
	if a != 100 or b != 0 or c != 100 or d != 200 or M.pts(F) != 400:
		_fail("① 받기")
	# ② 오늘 주민 모두와 이야기한 것으로(메모리만)
	F.set("miles", {})
	var old_talked: Dictionary = (F.get("talked") as Dictionary).duplicate(true)
	var tk: Dictionary = {}
	for v: Dictionary in load("res://games/saga_forest/world/villager_builder.gd").VILLAGERS:
		tk[String(v.id)] = ForestDay.today_key()
	F.set("talked", tk)
	var G: GDScript = load("res://games/saga_forest/ui/goals_adapter.gd")
	var m: Dictionary = G.model(null)
	var cl: Dictionary = m.get("claim", {})
	if cl.is_empty() or not cl.has("take"):
		_fail("② claim 칸 없음")
	else:
		var ready := bool(cl.ready)
		(cl.take as Callable).call()
		var cl2: Dictionary = G.model(null).claim
		print("CLAIM %s ready=%s → 모은 %d · 다시 ready=%s done=%s" % [cl.label, ready, M.pts(F), cl2.ready, cl2.done])
		if not ready or M.pts(F) != 100 or bool(cl2.ready) or not bool(cl2.done):
			_fail("② 받기 단추")
	F.set("talked", old_talked)
	# ③
	F.set("miles", {"pts": 100, "day": 0, "got": []})
	var fr0 := int(F.call("item_count", "과일"))
	var r1: Dictionary = M.buy(F, 0)
	if bool(r1.ok) or M.pts(F) != 100 or int(F.call("item_count", "과일")) != fr0:
		_fail("③ 모자란데 바꿈 %s" % [r1])
	F.set("miles", {"pts": 700, "day": 0, "got": []})
	var r2: Dictionary = M.buy(F, 0)
	var r3: Dictionary = M.buy(F, 3)
	print("BUY %s · %s · 남은 %d" % [r2.text, r3.text, M.pts(F)])
	if not bool(r2.ok) or int(F.call("item_count", "과일")) != fr0 + 5:
		_fail("③ 과일 바꿈")
	if bool(r3.ok) or M.pts(F) != 550:   # 550 < 600 이라 별 조각은 안 됨
		_fail("③ 별 조각 %s 남은 %d" % [r3, M.pts(F)])
	F.set("miles", old_miles)
	F.set("items", old_items)
	print("PROBE forest_miles ", "OK" if fails == 0 else "FAIL %d" % fails)
	quit(1 if fails > 0 else 0)
