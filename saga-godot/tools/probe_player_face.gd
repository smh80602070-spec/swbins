extends SceneTree

## G-0287 주인공 얼굴 자동 점검 —
##   godot --headless --path saga-godot --script res://tools/probe_player_face.gd   → "PROBE player_face OK" / "FAIL n"
## 네 판(1만리·2나락·3마을·4종횡) 씬마다: ① 주인공 몸에 TalkFace ② 깜박임 거리(Fcl_EYE_Close 또는 눈 재질)가 있고 한 번 돎
## ③ CombatFeel.hit(주인공 몸) → surprised 무게 > 0 · HURT_FACE_SEC 뒤 표정이 앞 표정으로 ④ 1만리·4종횡 level_up 신호 → joy
## ⑤ SAGA_PLAYER_FACE=0 이면 player_attach 가 null. SAGA_FACE_GAME=<판> 이면 그 판만.
## autoload 는 SceneTree 스크립트 컴파일 때 없어 이름(/root/<이름>)으로 부른다.

const TalkFace := preload("res://saga_core/world/talk_face.gd")

const SCENES := {"go": "res://games/saga_go/world/TestVillage.tscn", "dungeon": "res://games/saga_dungeon/world/TestRoom.tscn",
	"forest": "res://games/saga_forest/world/TestVillageForest.tscn", "story": "res://games/saga_story/world/SinyaField.tscn"}
const LEVEL_SIGNAL := {"go": "PartyState", "story": "StorySaveState"}

var fails := 0
var game := "go"


func _fail(msg: String) -> void:
	fails += 1
	print("  FAIL ", game, " ", msg)


func _init() -> void:
	await process_frame
	var only := OS.get_environment("SAGA_FACE_GAME")
	for g in SCENES:
		if only == "" or only == g:
			game = g
			await _one()
	OS.set_environment("SAGA_PLAYER_FACE", "0")
	if TalkFace.player_attach(Node3D.new()) != null:
		_fail("⑤ 손잡이 0 인데 붙음")
	OS.set_environment("SAGA_PLAYER_FACE", "")
	print("PROBE player_face ", "OK" if fails == 0 else "FAIL %d" % fails)
	quit(1 if fails > 0 else 0)


func _one() -> void:
	var f0 := fails
	var sc := (load(SCENES[game]) as PackedScene).instantiate()
	root.add_child(sc)
	current_scene = sc
	for _i in 30:
		await process_frame
	var pl := get_first_node_in_group("player")
	var vis: Node = pl.get("visual") if pl != null else null
	var face: Node = TalkFace.face_of(vis)
	if face == null:
		_fail("① 주인공 몸에 TalkFace 없음")
		sc.queue_free()
		await process_frame
		return
	## ②
	var shapes: Dictionary = face.get("_shapes")
	var eyes: Array = face.get("_eye_mats")
	if not shapes.has(TalkFace.BLINK_SHAPE) and eyes.is_empty():
		## 10-22 — 이 PC _out 이 10-04 옛 변환(targets 0)이었음. 없으면 engine_characters.sh 다시 변환·설치 뒤 임포트(PROJECT_STATE 설치 줄)
		_fail("② 깜박임 거리 없음 — dex 몸에 Fcl 모프 targets 없음(옛 변환·옛 임포트 캐시)")
	else:
		face.set("_blink_t", 0.0)
		face.call("_process", 0.02)
		face.call("_process", 0.02)
		if face.call("blink_weight") <= 0.0 and not bool(face.get("_eye_shut")):
			_fail("② 깜박임이 안 돎")
	face.call("_process", 0.3)
	## ③
	var feel := root.get_node("/root/CombatFeel")
	feel.call("hit", vis, 1.0, false, {"shake_mul": 0.0, "stop_ms": 0, "quiet": true})
	face.call("_process", 0.1)
	var w: float = face.call("mood_weight", "surprised")
	if w <= 0.0:
		_fail("③ 맞아도 놀란 얼굴 없음")
	for _k in 10:
		face.call("_process", 0.1)
	if String(face.get("_mood")) == "surprised" or float(face.call("mood_weight", "surprised")) >= w:
		_fail("③ %.2f초 뒤에도 놀람이 안 풀림" % feel.get("HURT_FACE_SEC"))
	## ④
	if LEVEL_SIGNAL.has(game):
		root.get_node("/root/" + LEVEL_SIGNAL[game]).emit_signal("level_up", 99)
		face.call("_process", 0.1)
		if float(face.call("mood_weight", "joy")) <= 0.0:
			_fail("④ 레벨업에 웃음 없음")
	print("FACE %s shapes=%d eyes=%d surprised=%.2f fails=%d" % [game, shapes.size(), eyes.size(), w, fails - f0])
	sc.queue_free()
	for _k in 3:
		await process_frame
