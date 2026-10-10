extends Node

## G-0176 — 이동 소리. `assets/audio/sfx/` 에 발소리(땅 여섯 × 둘)·점프·착지·대시 소리가 가져와져 있었는데 아무도 안 불러
## 걷고 뛰고 굴러도 조용했다. 플레이어(부모, go_player.gd) 상태를 매 물리 프레임 **읽기만** 해서 소리를 낸다 — 플레이어 코드는 안 고친다.
##   발소리: 땅 위(mode GROUND)·평면 속도 > STEP_MIN_SPEED·탈것 아님 — 걸음 간격 STEP_SEC_WALK(6m/s)~STEP_SEC_RUN(10m/s), 지역마다 땅 소리, 1·2 번갈아·음 높이 ±6%
##   점프: GROUND → AIR 이고 위로 JUMP_VY 넘게 · 착지: AIR/GLIDE → GROUND 이고 직전 낙하 속도 < −LAND_VY · 대시: _dodge_t 가 0 에서 오름
## 소리는 처음 한 번 load 해 두고, 종류마다 AudioStreamPlayer 하나를 돌려 쓴다(매번 만들지 않음). counts 는 점검(probe_move_sounds.gd)용.

const TestMap := preload("res://games/saga_go/data/test_map.gd")

const STEP_MIN_SPEED := 1.0
const STEP_SEC_WALK := 0.42
const STEP_SEC_RUN := 0.3
const JUMP_VY := 2.0
const LAND_VY := 6.0
const PITCH_JITTER := 0.06
const DB := {"step": -16.0, "jump": -10.0, "land": -8.0, "dodge": -10.0}
const DIR := "res://assets/audio/sfx/"
## 지역 → 땅 소리(없는 지역은 풀)
const SURFACE := {"frost": "snow", "coast": "sand", "ruins": "stone", "vault": "stone", "amber": "stone", "fork": "stone"}

var counts := {"step": 0, "jump": 0, "land": 0, "dodge": 0}
var _p: CharacterBody3D
var _streams := {}
var _players := {}
var _step_t := 0.0
var _step_alt := 0
var _last_mode := -1
var _last_vy := 0.0
var _last_dodge := 0.0


func _ready() -> void:
	_p = get_parent() as CharacterBody3D
	for k in DB:
		var ap := AudioStreamPlayer.new()
		ap.volume_db = float(DB[k])
		add_child(ap)
		_players[k] = ap
	for s in ["dirt", "grass", "sand", "snow", "stone", "wood"]:
		for n in [1, 2]:
			_load("step_%s_%d" % [s, n])
	for k in ["jump", "land", "dodge"]:
		_load(k)


func _load(key: String) -> void:
	var path := DIR + "sfx_%s.ogg" % key
	if ResourceLoader.exists(path):
		_streams[key] = load(path)


func _physics_process(delta: float) -> void:
	if _p == null:
		return
	var mode := int(_p.get("mode"))
	var v := _p.velocity
	var dodge := float(_p.get("_dodge_t"))
	if _last_mode == 0 and mode == 1 and v.y > JUMP_VY:
		_play("jump", "jump")
	elif (_last_mode == 1 or _last_mode == 2) and mode == 0 and _last_vy < -LAND_VY:
		_play("land", "land")
		_step_t = STEP_SEC_WALK * 0.5   # 착지 바로 뒤 발소리가 겹치지 않게
	if dodge > 0.0 and _last_dodge <= 0.0:
		_play("dodge", "dodge")
	_last_mode = mode
	_last_vy = v.y
	_last_dodge = dodge
	var speed := Vector2(v.x, v.z).length()
	if mode != 0 or speed < STEP_MIN_SPEED or bool(_p.get("mounted")) or dodge > 0.0:
		_step_t = 0.0
		return
	_step_t -= delta
	if _step_t <= 0.0:
		var k := clampf((speed - 6.0) / 4.0, 0.0, 1.0)
		_step_t = lerpf(STEP_SEC_WALK, STEP_SEC_RUN, k)
		_step_alt = 1 - _step_alt
		var surf := String(SURFACE.get(TestMap.region_at(_p.global_position), "grass"))
		_play("step", "step_%s_%d" % [surf, _step_alt + 1])


func _play(kind: String, key: String) -> void:
	counts[kind] = int(counts[kind]) + 1
	var st: AudioStream = _streams.get(key)
	var ap: AudioStreamPlayer = _players[kind]
	if st == null or ap == null:
		return
	ap.stream = st
	ap.pitch_scale = 1.0 + randf_range(-PITCH_JITTER, PITCH_JITTER)
	ap.play()
