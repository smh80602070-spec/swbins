extends SceneTree

## GO 패배 비용·회수(101-2 ③: data/drop_state.gd — autoload DropState) 자동 점검 — 화면 없는 순수 규칙.
##   godot --headless --path saga-godot --script res://tools/probe_defeat.gd
## ① 수치: 경험치의 15%·상한 15·회수 10분·동시 3개 ② drop_at: 15% 계산·상한·0이면 안 쌓음·같은 사건은 한 칸·넷째는 가장 오래된 것을 밀어냄
## ③ try_recover: 있으면 돌려주고 지움·없으면 0·10분 지났으면 0 이고 지움 ④ drops_changed 신호가 바뀔 때마다 ⑤ restore 가 깊은 복사.
## 끝에 "PROBE defeat OK" 또는 "PROBE defeat FAIL n". 상태는 끝에 되돌린다.

var fails := 0
var _signals := 0


func check(cond: bool, msg: String) -> void:
	if cond:
		print("  ok   ", msg)
	else:
		fails += 1
		print("  FAIL ", msg)


func _initialize() -> void:
	await process_frame  # autoload 가 올라온 뒤(스크립트가 DropState 이름을 직접 쓰면 --script 컴파일이 깨진다 — 노드로 받는다)
	var D: Node = root.get_node("DropState")
	var saved: Dictionary = D.drops.duplicate(true)
	D.restore({})
	D.drops_changed.connect(func() -> void: _signals += 1)

	# ① 수치
	check(is_equal_approx(D.DROP_PCT, 0.15) and is_equal_approx(D.DROP_CAP, 15.0) and is_equal_approx(D.RECOVER_SEC, 600.0) and D.MAX_DROPS == 3, "15% · 상한 15 · 10분 · 동시 3개")

	# ② drop_at
	var a: float = D.drop_at("e1", 50.0)
	var b: float = D.drop_at("e2", 1000.0)
	var z: float = D.drop_at("e3", 0.0)
	check(is_equal_approx(a, 7.5) and is_equal_approx(b, 15.0) and z == 0.0 and not D.drops.has("e3"), "50→7.5 · 1000→상한 15 · 0 은 안 쌓음")
	D.drop_at("e1", 100.0)
	check(D.drops.size() == 2 and is_equal_approx(float(D.drops["e1"].exp), 15.0), "같은 사건은 한 칸(새 값·새 시각)")
	var base := Time.get_unix_time_from_system() - 100.0
	D.drops["e1"].at = base + 1.0
	D.drops["e2"].at = base + 2.0
	D.drop_at("e4", 100.0)
	D.drops["e4"].at = base + 3.0
	D.drop_at("e5", 100.0)  # 넷째 — 가장 오래된 e1 을 밀어냄
	check(D.drops.size() == 3 and not D.drops.has("e1") and D.drops.has("e2") and D.drops.has("e4") and D.drops.has("e5"), "넷째가 오면 가장 오래된 것이 밀려난다")

	# ③ try_recover
	var got: float = D.try_recover("e5")
	check(is_equal_approx(got, 15.0) and not D.drops.has("e5"), "있으면 돌려주고 지운다")
	check(D.try_recover("nope") == 0.0, "없으면 0")
	D.drops["e2"].at = Time.get_unix_time_from_system() - 601.0
	D.drops["e4"].at = Time.get_unix_time_from_system() - 599.0
	var late: float = D.try_recover("e2")
	var ontime: float = D.try_recover("e4")
	check(late == 0.0 and not D.drops.has("e2") and is_equal_approx(ontime, 15.0), "10분(601초) 지나면 0 · 599초면 회수 · 둘 다 지운다")

	# ④ 신호
	check(_signals >= 7, "drops_changed %d번(쌓기·덮기·밀어내기·회수마다)" % _signals)

	# ⑤ restore 깊은 복사
	var src := {"x": {"exp": 3.0, "at": 1.0}}
	D.restore(src)
	src["x"]["exp"] = 99.0
	check(is_equal_approx(float(D.drops["x"].exp), 3.0), "restore 는 깊은 복사")

	D.restore(saved)
	print("PROBE defeat ", "OK" if fails == 0 else "FAIL %d" % fails)
	quit(1 if fails > 0 else 0)
