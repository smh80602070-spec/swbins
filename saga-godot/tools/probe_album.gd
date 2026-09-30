extends Node
## GO 사진 도감(data/album.gd · world/photo_album.gd) 자동 점검 — 평소엔 안 붙는다.
## test_village.gd 가 SAGA_ALBUM_PROBE 가 있을 때만 단다.
##
##   SAGA_ALBUM_PROBE=1 "$GODOT" --headless --path saga-godot res://games/saga_go/world/TestVillage.tscn
##
## ① 표(대상 id 풀이·보상 갈래·마일스톤 오름) ② 구도 점수(가운데·크기) ③ 기록: 처음=보상 · 다시=보상 없음 · 최고 갱신 · 마일스톤 받기
## ④ 화면 안 찾기: 앞 8m 에 세운 적은 잡히고 뒤·너무 먼 곳·가림 뒤는 안 잡힌다 ⑤ 촬영 한 장(shoot) → 기록·보상·점수 ⑥ 세이브 JSON ⑦ 화면.
## 도감·가방·적 자리는 끝에 되돌린다.

const Album := preload("res://games/saga_go/data/album.gd")

var _p: Node3D
var _n: Node
var _fails := 0
var _saved := {}


func _ready() -> void:
	Weather.force("clear")
	_p = get_tree().get_first_node_in_group("player")
	_run.call_deferred()


func _frames(n: int) -> void:
	for i in n:
		await get_tree().physics_frame


func _check(name: String, ok: bool, detail: String) -> void:
	if not ok:
		_fails += 1
	print("ALBUM_PROBE %s %s %s" % ["ok  " if ok else "FAIL", name, detail])


func _has(subs: Array, id: String) -> bool:
	for s in subs:
		if String(s.id) == id:
			return true
	return false


func _run() -> void:
	await _frames(6)
	_n = get_tree().get_first_node_in_group("go_album")
	_saved = {"album": PartyState.album.duplicate(true), "bag": PartyState.bag.duplicate()}
	PartyState.album = {}

	# ① 표
	var bad: Array = []
	for id in ["e:wolf", "e:storm_serpent", "b:pt_gumiho", "p:pt_haetae", "h:kr_yisunsin"]:
		var d := Album.describe(id)
		if d.is_empty() or not Album.FIRST_REWARD.has(d.kind):
			bad.append(id)
	for id in ["e:nothing", "x:wolf", "wolf", "h:nobody"]:
		if not Album.describe(id).is_empty():
			bad.append("should-be-empty " + id)
	for i in range(1, Album.MILESTONES.size()):
		if int(Album.MILESTONES[i][0]) <= int(Album.MILESTONES[i - 1][0]):
			bad.append("milestones")
	_check("tables", bad.is_empty() and _n != null and Album.describe("e:storm_serpent").kind == "boss" and Album.describe("e:wolf").kind == "enemy",
		"bad=%s" % [bad])

	# ② 점수
	_check("score", Album.score(0.0, 0.35) == 30 and Album.score(1.0, 0.0) == 10 and Album.score(0.0, 0.0) == 20 and Album.score(0.5, 0.175) == 20
		and Album.score(0.2, 0.2) > Album.score(0.8, 0.2), "%d %d %d %d" % [Album.score(0.0, 0.35), Album.score(1.0, 0.0), Album.score(0.0, 0.0), Album.score(0.5, 0.175)])

	# ③ 기록
	var mora0: int = PartyState.count("mora")
	var r1 := Album.record("e:wolf", 15)
	var mora1: int = PartyState.count("mora")
	var r2 := Album.record("e:wolf", 12)
	var r3 := Album.record("e:wolf", 25)
	var bad_r := Album.record("e:nothing", 30)
	_check("record", r1.result == "first" and mora1 == mora0 + int(Album.FIRST_REWARD.enemy.mora) and r2.result == "same" and PartyState.count("mora") == mora1
		and r3.result == "better" and int(Album.state().shots["e:wolf"].best) == 25 and int(Album.state().shots["e:wolf"].n) == 3 and bad_r.result == "unknown" and Album.kinds_count() == 1,
		"r=%s/%s/%s n=%d" % [r1.result, r2.result, r3.result, int(Album.state().shots["e:wolf"].n)])
	for id in ["e:bandit", "e:thunder_cat", "e:ice_fox", "e:rock_bear"]:
		Album.record(id, 15)
	var claim_early := Album.claim_milestone(1)
	var m0 := Album.claim_milestone(0)
	var m0_again := Album.claim_milestone(0)
	_check("milestone", Album.kinds_count() == 5 and claim_early.is_empty() and not m0.is_empty() and m0_again.is_empty() and Album.claimable_milestones() == 0,
		"kinds=%d m0=%s" % [Album.kinds_count(), m0])

	# ④ 화면 안 찾기
	PartyState.album = {}
	var cam := get_viewport().get_camera_3d()
	var enemies := get_tree().get_nodes_in_group("field_enemy")
	var e: Node3D = enemies[0] if not enemies.is_empty() else null
	var eid := "e:" + String(e.get("kind")) if e != null else ""
	var pos0 := e.global_position if e != null else Vector3.ZERO
	var fwd := -cam.global_transform.basis.z
	fwd.y = 0.0
	fwd = fwd.normalized()
	e.global_position = cam.global_position + fwd * 8.0 + Vector3(0, -cam.global_position.y + _p.global_position.y, 0)
	var in_front := _has(_n.call("subjects_in_frame", cam), eid)
	e.global_position = cam.global_position - fwd * 8.0 + Vector3(0, -cam.global_position.y + _p.global_position.y, 0)
	var behind := _has(_n.call("subjects_in_frame", cam), eid)
	e.global_position = cam.global_position + fwd * 80.0 + Vector3(0, -cam.global_position.y + _p.global_position.y, 0)
	var far := _has(_n.call("subjects_in_frame", cam), eid)
	e.global_position = cam.global_position + fwd * 1.0 + Vector3(0, -cam.global_position.y + _p.global_position.y, 0)
	var near := _has(_n.call("subjects_in_frame", cam), eid)
	var target := cam.global_position + fwd * 12.0 + Vector3(0, -cam.global_position.y + _p.global_position.y, 0)
	e.global_position = target
	var wall := StaticBody3D.new()
	var cs := CollisionShape3D.new()
	var box := BoxShape3D.new()
	box.size = Vector3(30, 30, 1)
	cs.shape = box
	wall.add_child(cs)
	add_child(wall)
	wall.global_position = cam.global_position + fwd * 6.0
	wall.look_at(cam.global_position + Vector3(0, 0, 0) + fwd * 7.0 * 0.0 + fwd, Vector3.UP)
	wall.global_position = cam.global_position + fwd * 6.0
	await _frames(3)
	e.global_position = target
	var occluded := _has(_n.call("subjects_in_frame", cam), eid)
	wall.queue_free()
	await _frames(3)
	e.global_position = target
	var clear := _has(_n.call("subjects_in_frame", cam), eid)
	_check("frame", e != null and in_front and not behind and not far and not near and not occluded and clear,
		"front=%s behind=%s far=%s near=%s occluded=%s clear=%s" % [in_front, behind, far, near, occluded, clear])

	# ⑤ 촬영 한 장
	e.global_position = cam.global_position + fwd * 8.0 + Vector3(0, -cam.global_position.y + _p.global_position.y, 0)
	var mora2: int = PartyState.count("mora")
	var shot: Dictionary = _n.call("shoot", null)
	var again: Dictionary = _n.call("shoot", null)
	var kind_reward: Dictionary = Album.FIRST_REWARD[Album.describe(eid).kind]
	_check("shoot", int(shot.subjects) >= 1 and (shot.firsts as Array).size() >= 1 and int(shot.total) >= 10 and (again.firsts as Array).is_empty()
		and PartyState.count("mora") >= mora2 + int(kind_reward.mora) and int(Album.state().shots[eid].n) == 2,
		"shot=%s again_firsts=%s n=%d" % [shot, again.firsts, int(Album.state().shots[eid].n)])
	e.global_position = pos0

	# ⑥ 세이브 JSON
	var js := JSON.stringify(PartyState.album)
	PartyState.album = (JSON.parse_string(js) as Dictionary).duplicate(true)
	_check("save_json", Album.kinds_count() >= 1 and int(Album.state().shots[eid].n) == 2 and String(Album.state().shots[eid].name) != "", "kinds=%d" % Album.kinds_count())

	# ⑦ 화면
	var opened := bool(_n.call("open_screen"))
	var frozen := bool(_p.get("frozen"))
	await _frames(2)
	var kids := (_n.get("_body") as Node).get_child_count()
	_n.call("close_screen")
	_check("screen", opened and frozen and kids >= 2 and not bool(_p.get("frozen")), "opened=%s frozen=%s kids=%d" % [opened, frozen, kids])

	PartyState.album = _saved.album
	PartyState.bag = _saved.bag
	print("ALBUM_PROBE_DONE fails=%d" % _fails)
	get_tree().quit()
