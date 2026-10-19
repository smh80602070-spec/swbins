extends SceneTree

## G-0245 4종횡 사냥 평가 등급 S~D(웹 runrank.js W-0289 짝) 자동 점검(games/saga_story/data/story_save_state.gd).
##   godot --headless --path saga-godot --script res://tools/probe_story_rank.gd
## ① 끝점: S(피격 0·연속 20·90초·처치 15) · D(20·0·900초·3) ② 급 1~5(enemy_lv 문턱 5·12·25·45) · 급 3 이면 시간·피격 여유
## ③ 처치 2 → 등급 없음 ④ S 덤: 금 +50%·기억 조각 +1·첫 기록 ⑤ 쓰러짐: 등급은 매기고 덤 없음 · 최고 유지
## ⑥ 최고 갱신(C → B)·유지(B 에 D) ⑦ 저장 왕복(rank_best) · 옛 21 세이브 → 빈 칸.
## 상태는 끝에 되돌린다. 끝에 "PROBE story_rank OK|FAIL n".

const SAVED_VARS := ["gold", "memory_fragments", "rank_best", "last_run", "run_t0_ms", "run_hits", "run_combo", "run_combo_max", "run_kills", "run_gold0", "run_stage", "run_tier_now", "path_override"]

var fails := 0
var S: Node


func check(cond: bool, msg: String) -> void:
	if cond:
		print("  ok   ", msg)
	else:
		fails += 1
		print("  FAIL ", msg)


## 한 판을 흉내 낸다 — 들어가서 금을 줍고(got) 처치·피격·연속을 정해 나온다
func _run(stage: String, lv: float, got: int, kills: int, hits: int, combo: int, dead: bool) -> Dictionary:
	S.begin_run(stage, lv)
	S.gold += got
	S.run_kills = kills
	S.run_hits = hits
	S.run_combo_max = combo
	return S.end_run(dead)


func _initialize() -> void:
	await process_frame
	S = root.get_node("StorySaveState")
	var saved := {}
	for v in SAVED_VARS:
		var cur: Variant = S.get(v)
		saved[v] = cur.duplicate(true) if (cur is Dictionary or cur is Array) else cur

	# ①
	check(S.rank_of(90.0, 0, 20, 15, 1) == "S" and S.rank_of(900.0, 20, 0, 3, 1) == "D", "끝점: S(0·20·90초·15) · D(20·0·900초·3)")
	# ②
	var tiers := [S.run_tier(1.0), S.run_tier(4.9), S.run_tier(6.0), S.run_tier(14.0), S.run_tier(26.0), S.run_tier(50.0)]
	check(tiers == [1, 1, 2, 3, 4, 5], "급: lv 1·4.9·6·14·26·50 → %s" % str(tiers))
	var r1: String = S.rank_of(300.0, 5, 0, 3, 1)
	var r3: String = S.rank_of(300.0, 5, 0, 3, 3)
	check(r1 == "C" and r3 == "B" and S.rank_of(250.0, 0, 0, 3, 3) == "A", "급 3 여유: (피격 5·300초) 급1 %s → 급3 %s · (0·250초) 급3 A" % [r1, r3])
	# ③
	S.rank_best = {}
	S.gold = 1000
	S.memory_fragments = 4
	var r0: Dictionary = _run("field", 1.0, 100, 2, 0, 20, false)
	check(r0.is_empty() and S.last_run.is_empty() and S.gold == 1100 and S.rank_best.is_empty(), "처치 2 → 등급 없음·덤 없음·기록 없음")
	# ④
	var rs: Dictionary = _run("field", 1.0, 100, 15, 0, 20, false)
	check(String(rs.get("rank", "")) == "S" and int(rs.bonus_gold) == 50 and S.gold == 1250 and S.memory_fragments == 5 and int(rs.shard) == 1 and bool(rs.best) and S.rank_best.get("field") == "S",
		"S 덤: 금 +50%%(+%d → %d) · 기억 조각 +1(%d) · 첫 기록 S · %s" % [int(rs.get("bonus_gold", 0)), S.gold, S.memory_fragments, S.run_line2(rs)])
	# ⑤
	var rd: Dictionary = _run("field", 1.0, 100, 15, 0, 20, true)
	check(String(rd.get("rank", "")) == "S" and int(rd.bonus_gold) == 0 and S.gold == 1350 and S.memory_fragments == 5 and not bool(rd.best) and "쓰러져 덤 없음" in S.run_line2(rd) and S.rank_best.get("field") == "S",
		"쓰러짐: 등급 S 매김 · 덤 없음 · 최고 S 유지 · %s" % S.run_line2(rd))
	# ⑥
	S.rank_best = {"forest": "C"}
	var rb: Dictionary = _run("forest", 6.0, 0, 5, 1, 4, false)   # 급2: 피격 1→2·연속 0·시간 2 = 4 → B
	var rdd: Dictionary = _run("forest", 6.0, 0, 3, 30, 0, false)   # 급2: 0·0·시간 2 = 2 → C (B 보다 낮음)
	check(String(rb.get("rank", "")) == "B" and bool(rb.best) and String(rb.prev_best) == "C" and "🏆 최고 기록 C → B" in S.run_line2(rb) and String(rdd.get("rank", "")) == "C" and not bool(rdd.best) and S.rank_best.get("forest") == "B",
		"최고 갱신 C → B · 낮은 판(%s)엔 유지 B" % String(rdd.get("rank", "")))
	check("⭐ 지난 사냥 등급" in S.run_text(rb) and "\n" in S.run_text(rb), "토스트 글 = 첫 줄 + 둘째 줄")
	# ⑦
	var dummy := Node3D.new()
	dummy.add_to_group("player")
	root.add_child(dummy)
	S.path_override = "user://probe_story_rank_rt.json"
	S.rank_best = {"field": "S", "forest": "B"}
	var sv: bool = S.save()
	S.rank_best = {}
	var ld: bool = S.try_load()
	check(sv and ld and S.rank_best == {"field": "S", "forest": "B"}, "저장 왕복: rank_best %s" % str(S.rank_best))
	DirAccess.remove_absolute(ProjectSettings.globalize_path(S.path_override))
	S.path_override = "user://probe_story_rank_old.json"
	var f := FileAccess.open(S.path_override, FileAccess.WRITE)
	f.store_string(JSON.stringify({"version": 21, "level": 5, "exp": 0, "gold": 10, "player_pos": [0.0, 0.1, 0.0]}))
	f.close()
	S.rank_best = {"x": "A"}
	var ld_old: bool = S.try_load()
	check(ld_old and S.rank_best.is_empty() and S.save_version() == 22, "옛 21 세이브 → rank_best 빈 칸 · 판 22")
	DirAccess.remove_absolute(ProjectSettings.globalize_path(S.path_override))
	dummy.queue_free()
	await process_frame

	for v in SAVED_VARS:
		S.set(v, saved[v])
	print("PROBE story_rank ", "OK" if fails == 0 else "FAIL %d" % fails)
	quit(1 if fails > 0 else 0)
