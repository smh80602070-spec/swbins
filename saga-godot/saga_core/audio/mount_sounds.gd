extends Node

## G-0405 탈것 소리(K-0189 sfx_hoof_*·sfx_wing_*) — mount.gd 가 붙인다(다섯 판 공용, 탈것이 있는 판이면 어디나).
## 땅 탈것: 바닥 위·평면 속도 > MIN_SPEED 면 말발굽 — 땅이 돌·나무면 hard, 그 밖(풀·흙·모래·눈)은 soft, 1~3 돌려 쓰기·음 높이 ±6%,
##   간격 HOOF_SEC_SLOW(걷기)~HOOF_SEC_FAST(질주). 땅은 형제 발소리 노드(1만리 MoveSounds·나머지 StepSounds)의 surface_now() 를 묻는다.
## 나는 탈것: 공중이면 날갯짓 — 용(HEAVY)은 sfx_wing_heavy 1~2 느리게, 새는 sfx_wing_flap 1~3, 움직이면 잦게·떠 있으면 느리게. 나는 탈것이 땅을 걸을 땐 소리 없음.
## 탄 동안 발소리는 각 발소리 노드가 mounted 로 멈춘다. 손잡이 SAGA_MOUNT_SOUND=0 이면 안 붙음. counts 는 점검(probe_mount_sounds)용.

const DIR := "res://assets/audio/sfx/"
const MIN_SPEED := 1.0
const HOOF_SEC_SLOW := 0.36
const HOOF_SEC_FAST := 0.2
const WING_SEC := {"flap": [0.55, 0.9], "heavy": [0.9, 1.3]}   # [움직일 때, 떠 있을 때]
const HEAVY := ["pt_cheongryong"]
const HARD := ["stone", "wood"]
const N := {"hoof_soft": 3, "hoof_hard": 3, "wing_flap": 3, "wing_heavy": 2}
const DB := {"hoof": -14.0, "wing": -12.0}
const PITCH_JITTER := 0.06

var counts := {"hoof_soft": 0, "hoof_hard": 0, "wing_flap": 0, "wing_heavy": 0}
var last_key := ""
var _p: CharacterBody3D
var _mount: Node
var _streams := {}
var _ap: AudioStreamPlayer
var _t := 0.0
var _i := 0


static func enabled() -> bool:
	return OS.get_environment("SAGA_MOUNT_SOUND") != "0"


## 땅 이름 → 말발굽 묶음(순수)
static func hoof_set(surface: String) -> String:
	return "hoof_hard" if HARD.has(surface) else "hoof_soft"


## 다음 소리까지 간격(순수) — set 은 hoof_* · wing_flap · wing_heavy
static func interval(set_name: String, speed: float) -> float:
	if set_name.begins_with("hoof"):
		return lerpf(HOOF_SEC_SLOW, HOOF_SEC_FAST, clampf((speed - 6.0) / 10.0, 0.0, 1.0))
	var w: Array = WING_SEC["heavy" if set_name == "wing_heavy" else "flap"]
	return float(w[0]) if speed > MIN_SPEED * 2.0 else float(w[1])


## 지금 울릴 묶음(순수) — "" 면 소리 없음
static func set_for(kind: String, mount_id: String, on_floor: bool, speed: float, surface: String) -> String:
	if kind == "fly" and not on_floor:
		return "wing_heavy" if HEAVY.has(mount_id) else "wing_flap"
	if kind == "ground" and on_floor and speed >= MIN_SPEED:
		return hoof_set(surface)
	return ""


func _ready() -> void:
	name = "MountSounds"
	_mount = get_parent()
	_p = _mount.get_parent() as CharacterBody3D
	for s: String in N:
		for n in range(1, int(N[s]) + 1):
			var path := DIR + "sfx_%s_%d.ogg" % [s, n]
			if ResourceLoader.exists(path):
				_streams["%s_%d" % [s, n]] = load(path)
	_ap = AudioStreamPlayer.new()
	add_child(_ap)


func _surface() -> String:
	for nm in ["MoveSounds", "StepSounds"]:
		var n := _p.get_node_or_null(nm)
		if n != null and n.has_method("surface_now"):
			return String(n.call("surface_now"))
	return "grass"


func _physics_process(delta: float) -> void:
	if _p == null or _mount == null or not bool(_mount.call("is_riding")):
		_t = 0.0
		return
	var v := _p.velocity
	var speed := Vector2(v.x, v.z).length()
	var kind := "fly" if bool(_mount.call("is_flying_mount")) else "ground"
	tick(delta, kind, String(_mount.get("current")), _p.is_on_floor(), speed, _surface() if kind == "ground" else "")


## 한 틱 — 점검도 이것을 바로 부른다. 울렸으면 그 열쇠("hoof_soft_2" 따위), 아니면 "".
func tick(delta: float, kind: String, mount_id: String, on_floor: bool, speed: float, surface: String) -> String:
	var s := set_for(kind, mount_id, on_floor, speed, surface)
	if s == "":
		_t = 0.0
		return ""
	_t -= delta
	if _t > 0.0:
		return ""
	_t = interval(s, speed)
	_i = (_i + 1) % int(N[s])
	last_key = "%s_%d" % [s, _i + 1]
	counts[s] = int(counts[s]) + 1
	var st: AudioStream = _streams.get(last_key)
	if st != null and _ap != null:
		_ap.stream = st
		_ap.volume_db = float(DB["hoof" if s.begins_with("hoof") else "wing"])
		_ap.pitch_scale = 1.0 + randf_range(-PITCH_JITTER, PITCH_JITTER)
		_ap.play()
	return last_key
