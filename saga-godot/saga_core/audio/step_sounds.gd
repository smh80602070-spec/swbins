extends Node

## G-0369 발소리(2나락·3마을·4종횡) — 1만리 move_sounds(G-0176)처럼 있는 발소리 sfx_step_<땅>_1·2 를 걸음마다.
## 1만리는 제 MoveSounds 가 있어 안 붙는다(player.gd 가 한 프레임 뒤 MoveSounds 없을 때만 붙임). 4종횡은 story_player 가 붙인다.
## 부모(CharacterBody3D) 속도·바닥만 **읽는다**: 바닥 위·평면 속도 > STEP_MIN_SPEED 면 STEP_SEC_WALK~RUN 간격, 1·2 번갈아·음 높이 ±6%.
## 땅: 씬 경로로 — 2나락 돌 · 3마을 풀(집 안 INTERIOR_X 넘으면 나무) · 4종횡 풀(굴·미궁은 돌). 젖은 땅(공용 weather_visual wet > 0.4)이면 물 튐 겹침(G-0368 과 같게).
## G-0370 점프·착지 — 1만리 move_sounds 처럼 sfx_jump·sfx_land: 위 속도가 한 프레임에 JUMP_RISE 넘게 오르고 JUMP_VY 위면 점프(코요테·되튐 포함, 나는 탈것 fly_on 은 뺌),
## 공중 → 바닥이고 직전 낙하 속도 < −LAND_VY 면 착지(바로 뒤 발소리 반 걸음 미룸). 점프는 지금 4종횡만 있고 2나락·3마을은 높은 데서 떨어질 때 착지만.
## 손잡이 SAGA_STEP_SOUND=0 이면 안 붙음. counts 는 점검(probe_step_sounds)용.

const DIR := "res://assets/audio/sfx/"
const STEP_MIN_SPEED := 1.0
const STEP_SEC_WALK := 0.42
const STEP_SEC_RUN := 0.3
const PITCH_JITTER := 0.06
const STEP_DB := -16.0
const SPLASH_DB := -26.0
const JUMP_DB := -10.0
const LAND_DB := -8.0
const JUMP_VY := 2.0
const JUMP_RISE := 6.0
const LAND_VY := 6.0
const WET_MIN := 0.4
const INTERIOR_X := 400.0   # 3마을 집 안은 먼 좌표(forest_house INTERIOR_ORIGIN 500)

var counts := {"step": 0, "splash": 0, "jump": 0, "land": 0}
var surface := "grass"
var _p: CharacterBody3D
var _streams := {}
var _step: AudioStreamPlayer
var _splash: AudioStreamPlayer
var _jump: AudioStreamPlayer
var _land: AudioStreamPlayer
var _was_floor := true
var _last_vy := 0.0
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
	for k in ["splash", "jump", "land"]:
		if ResourceLoader.exists(DIR + "sfx_%s.ogg" % k):
			_streams[k] = load(DIR + "sfx_%s.ogg" % k)
	_step = AudioStreamPlayer.new()
	_step.volume_db = STEP_DB
	add_child(_step)
	_splash = AudioStreamPlayer.new()
	_splash.volume_db = SPLASH_DB
	add_child(_splash)
	_jump = AudioStreamPlayer.new()
	_jump.volume_db = JUMP_DB
	add_child(_jump)
	_land = AudioStreamPlayer.new()
	_land.volume_db = LAND_DB
	add_child(_land)


func _physics_process(delta: float) -> void:
	if _p == null:
		return
	var v := _p.velocity
	var on_floor := _p.is_on_floor()
	if v.y > JUMP_VY and v.y - _last_vy > JUMP_RISE and _p.get("fly_on") != true:
		_play(_jump, "jump", "jump")
	elif on_floor and not _was_floor and _last_vy < -LAND_VY:
		_play(_land, "land", "land")
		_t = STEP_SEC_WALK * 0.5   # 착지 바로 뒤 발소리가 겹치지 않게
	_was_floor = on_floor
	_last_vy = v.y
	var speed := Vector2(v.x, v.z).length()
	if not on_floor or speed < STEP_MIN_SPEED or _p.get("mounted") == true:   # G-0405 탄 동안은 탈것 소리(mount_sounds)
		_t = 0.0
		return
	_t -= delta
	if _t > 0.0:
		return
	_t = lerpf(STEP_SEC_WALK, STEP_SEC_RUN, clampf((speed - 6.0) / 4.0, 0.0, 1.0))
	_alt = 1 - _alt
	var surf := surface_now()
	_play(_step, "%s_%d" % [surf, _alt + 1], "step")
	var w := _wet()
	if w > WET_MIN and surf != "wood":
		_splash.volume_db = SPLASH_DB + linear_to_db(w)
		_play(_splash, "splash", "splash")


## 지금 발밑 땅(3마을 집 안은 나무) — 탈것 소리(mount_sounds)도 묻는다.
func surface_now() -> String:
	return "wood" if (surface == "grass" and _p != null and _p.global_position.x > INTERIOR_X) else surface


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
