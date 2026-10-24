extends Node

## G-0369 발소리(2나락·3마을·4종횡) — 1만리 move_sounds(G-0176)처럼 있는 발소리 sfx_step_<땅>_1·2 를 걸음마다.
## 1만리는 제 MoveSounds 가 있어 안 붙는다(player.gd 가 한 프레임 뒤 MoveSounds 없을 때만 붙임). 4종횡은 story_player 가 붙인다.
## 부모(CharacterBody3D) 속도·바닥만 **읽는다**: 바닥 위·평면 속도 > STEP_MIN_SPEED 면 STEP_SEC_WALK~RUN 간격, 1·2 번갈아·음 높이 ±6%.
## 땅: 씬 경로로 — 2나락 돌 · 3마을 풀(집 안 INTERIOR_X 넘으면 나무) · 4종횡 풀(굴·미궁은 돌). 젖은 땅(공용 weather_visual wet > 0.4)이면 물 튐 겹침(G-0368 과 같게).
## 손잡이 SAGA_STEP_SOUND=0 이면 안 붙음. counts 는 점검(probe_step_sounds)용.

const DIR := "res://assets/audio/sfx/"
const STEP_MIN_SPEED := 1.0
const STEP_SEC_WALK := 0.42
const STEP_SEC_RUN := 0.3
const PITCH_JITTER := 0.06
const STEP_DB := -16.0
const SPLASH_DB := -26.0
const WET_MIN := 0.4
const INTERIOR_X := 400.0   # 3마을 집 안은 먼 좌표(forest_house INTERIOR_ORIGIN 500)

var counts := {"step": 0, "splash": 0}
var surface := "grass"
var _p: CharacterBody3D
var _streams := {}
var _step: AudioStreamPlayer
var _splash: AudioStreamPlayer
var _t := 0.0
var _alt := 0
var _wv: Node = null


static func enabled() -> bool:
	return OS.get_environment("SAGA_STEP_SOUND") != "0"


## 씬 경로 → 기본 땅(순수)
static func surface_of(scene_path: String) -> String:
	if scene_path.begins_with("res://games/saga_dungeon/"):   # check_refs:allow — 경로 판별 문자열
		return "stone"
	if scene_path.begins_with("res://games/saga_story/"):   # check_refs:allow
		return "stone" if (scene_path.contains("Cave") or scene_path.contains("Labyrinth")) else "grass"
	return "grass"


func _ready() -> void:
	_p = get_parent() as CharacterBody3D
	var sc := get_tree().current_scene
	surface = surface_of(sc.scene_file_path if sc else "")
	for s in ["grass", "stone", "wood", "dirt"]:
		for n in [1, 2]:
			var path := DIR + "sfx_step_%s_%d.ogg" % [s, n]
			if ResourceLoader.exists(path):
				_streams["%s_%d" % [s, n]] = load(path)
	if ResourceLoader.exists(DIR + "sfx_splash.ogg"):
		_streams["splash"] = load(DIR + "sfx_splash.ogg")
	_step = AudioStreamPlayer.new()
	_step.volume_db = STEP_DB
	add_child(_step)
	_splash = AudioStreamPlayer.new()
	_splash.volume_db = SPLASH_DB
	add_child(_splash)


func _physics_process(delta: float) -> void:
	if _p == null:
		return
	var v := _p.velocity
	var speed := Vector2(v.x, v.z).length()
	if not _p.is_on_floor() or speed < STEP_MIN_SPEED:
		_t = 0.0
		return
	_t -= delta
	if _t > 0.0:
		return
	_t = lerpf(STEP_SEC_WALK, STEP_SEC_RUN, clampf((speed - 6.0) / 4.0, 0.0, 1.0))
	_alt = 1 - _alt
	var surf := "wood" if (surface == "grass" and _p.global_position.x > INTERIOR_X) else surface
	_play(_step, "%s_%d" % [surf, _alt + 1], "step")
	var w := _wet()
	if w > WET_MIN and surf != "wood":
		_splash.volume_db = SPLASH_DB + linear_to_db(w)
		_play(_splash, "splash", "splash")


func _play(ap: AudioStreamPlayer, key: String, kind: String) -> void:
	counts[kind] = int(counts[kind]) + 1
	var st: AudioStream = _streams.get(key)
	if st == null:
		return
	ap.stream = st
	ap.pitch_scale = 1.0 + randf_range(-PITCH_JITTER, PITCH_JITTER)
	ap.play()


func _wet() -> float:
	if _wv == null or not is_instance_valid(_wv):
		var sc := get_tree().current_scene
		_wv = sc.find_child("WeatherVisual", true, false) if sc else null
	return float(_wv.get("wet")) if _wv else 0.0
