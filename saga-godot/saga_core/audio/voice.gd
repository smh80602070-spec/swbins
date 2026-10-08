extends Node

## 대사 음성 재생기 (G-0111) — 다섯 판이 같이 쓴다. bgm.gd 와 같은 꼴: autoload 를 늘리지 않고 첫 호출이 `/root/SagaVoice` 를 만든다.
##   const Voice := preload("res://saga_core/audio/voice.gd")
##   Voice.say("shout", "sg_guanyu")   # 갈래 shout·pickup·greet — 그 인물 목소리(assign)로 무작위 한 줄
##   Voice.say("shout", id, true)      # sure = 확률 없이(필살처럼 꼭 외칠 때, 간격은 그대로)
##   Voice.say("pickup")               # id 를 안 주면 Voice.speaker(판이 정하는 말하는 이, "" 이면 해시 목소리)
##   Voice.system("save")              # 안내 = 해설 NA 의 system 줄. 키는 SYSTEM 표(짧은 음악 키와 같은 이름)
##   Voice.set_enabled(false) · Voice.set_volume(0.5)   # UI 없이 API 만 — user://audio.cfg [voice] enabled, volume
## 파일: `res://assets/audio/voice/voice_<목소리>_<줄 id>.ogg` + `voice_list.json`(lines·assign·missing — K-0036 산출, 고치지 않는다).
## 빠진 줄(missing)은 같은 갈래 다른 줄로, 그래도 없으면 조용히. 갈래마다 간격(GAP)·확률(CHANCE)로 매번 떠들지 않게 한다.
## 헤드리스(진단)에선 파일을 안 열고 last_path·count 만 남긴다(bgm.gd G-0013 — 재생 중 .ogg 가 종료를 막는다).

const NODE_NAME := "SagaVoice"
const BUS := "Voice"
const BASE_DB := -4.0
const SILENT_DB := -80.0
const SELF_PATH := "res://saga_core/audio/voice.gd"
const NARRATOR := "NA"
const HASH_VOICES := ["M1", "M2", "M3", "M4", "M5", "F1", "F2", "F3", "F4", "F5"]
## 갈래마다 다음 말까지 최소 간격(초)·말할 확률. 외침은 공격마다 부르므로 낮게.
const GAP := {"shout": 3.0, "pickup": 4.0, "greet": 1.5, "system": 2.0}
const CHANCE := {"shout": 0.35, "pickup": 0.6, "greet": 1.0, "system": 1.0}
## 안내 키 → system 줄. 짧은 음악(Bgm.stinger) 키는 그대로 여기 들어온다.
const SYSTEM := {
	"save": "system_01", "discover": "system_02", "bag_full": "system_03", "daily": "system_04",
	"levelup": "system_06", "gacha_rare": "system_07", "gacha_legend": "system_07", "join": "system_07",
	"quest": "system_08", "new_gear": "system_09", "danger": "system_10", "boss_appear": "system_11",
	"victory": "system_12", "defeat": "system_13", "load": "system_14", "settings": "system_15",
	"new_skill": "system_16", "time_low": "system_17", "door": "system_18", "secret": "system_19",
	"reward": "system_19", "login": "system_20",
}

static var dir := "res://assets/audio/voice/"
static var cfg_path := "user://audio.cfg"
## 판이 정하는 말하는 이(사가만리는 외침에 싸우는 인물 id 를 직접 넘긴다). "" 이면 해시 목소리.
static var speaker := ""
## 시험용 — true 면 확률을 무시하고 늘 말한다(간격은 그대로).
static var always := false

var enabled := true
var volume := 1.0
var last_path := ""   # 마지막으로 고른 파일(헤드리스여도 남는다 — 점검용)
var last_kind := ""
var count := 0
var lines := {}       # 갈래 → [줄 id]
var assign := {}      # 인물 id → 목소리
var missing := {}     # "목소리/줄 id" → true
var _at := {}         # 갈래 → 마지막으로 말한 ticks(ms)
var _p: AudioStreamPlayer
var _rng := RandomNumberGenerator.new()


static var _node: Node


static func _inst() -> Node:
	if is_instance_valid(_node):
		return _node
	var tree := Engine.get_main_loop() as SceneTree
	if tree == null:
		return null
	_node = (load(SELF_PATH) as GDScript).new()
	_node.name = NODE_NAME
	tree.root.add_child.call_deferred(_node)  # 씬 _ready 중에 불려도 "부모가 바쁨" 오류가 없게
	return _node


## 시험용 — 재생기를 지우고 다음 호출이 새로 만들게 한다(설정 파일 다시 읽기 확인).
static func reset_for_test() -> void:
	if is_instance_valid(_node):
		_node.queue_free()
	_node = null


static func say(kind: String, id: String = "", sure := false) -> String:
	var n := _inst()
	return "" if n == null else n._say(kind, speaker if id == "" else id, sure)


static func system(key: String) -> String:
	var n := _inst()
	return "" if n == null or not SYSTEM.has(key) else n._speak("system", NARRATOR, String(SYSTEM[key]))


static func set_enabled(on: bool) -> void:
	var n := _inst()
	if n != null:
		n._set_enabled(on)


static func set_volume(v: float) -> void:
	var n := _inst()
	if n != null:
		n._set_volume(v)


static func state() -> Node:
	return _inst()


func _init() -> void:
	_rng.randomize()
	_load_cfg()
	_load_table()


func _ready() -> void:
	if AudioServer.get_bus_index(BUS) == -1:
		AudioServer.add_bus()
		AudioServer.set_bus_name(AudioServer.bus_count - 1, BUS)
	_p = AudioStreamPlayer.new()
	_p.bus = BUS
	add_child(_p)


func _load_table() -> void:
	var f := FileAccess.open(dir.path_join("voice_list.json"), FileAccess.READ)
	if f == null:
		return
	var j: Variant = JSON.parse_string(f.get_as_text())
	if not (j is Dictionary):
		return
	for l in j.get("lines", []):
		var k := String(l.get("kind", ""))
		if not lines.has(k):
			lines[k] = []
		lines[k].append(String(l.get("id", "")))
	assign = j.get("assign", {})
	for m in j.get("missing", []):
		missing[String(m)] = true


## 인물 id → 목소리. 표에 없으면 id 해시로 열 목소리 중 하나(같은 id 는 늘 같은 목소리).
func voice_of(id: String) -> String:
	if assign.has(id):
		return String(assign[id])
	return HASH_VOICES[absi(hash(id)) % HASH_VOICES.size()]


## 그 목소리로 낼 수 있는 갈래 줄 하나(빠진 줄은 건너뜀). 없으면 "".
func pick(kind: String, voice: String) -> String:
	var ok := []
	for lid in lines.get(kind, []):
		if not missing.has(voice + "/" + lid):
			ok.append(lid)
	return "" if ok.is_empty() else String(ok[_rng.randi() % ok.size()])


func path_of(voice: String, line_id: String) -> String:
	return dir.path_join("voice_%s_%s.ogg" % [voice, line_id])


func _say(kind: String, id: String, sure := false) -> String:
	if kind == "system" or not GAP.has(kind):
		return ""
	if not (always or sure) and _rng.randf() > float(CHANCE[kind]):
		return ""
	var v := voice_of(id)
	return _speak(kind, v, pick(kind, v))


func _speak(kind: String, voice: String, line_id: String) -> String:
	if not enabled or line_id == "" or missing.has(voice + "/" + line_id):
		return ""
	var now := Time.get_ticks_msec()
	if now - int(_at.get(kind, -100000)) < int(float(GAP[kind]) * 1000.0):
		return ""
	_at[kind] = now
	last_path = path_of(voice, line_id)
	last_kind = kind
	count += 1
	_play(last_path)
	return last_path


func _play(path: String) -> void:
	if DisplayServer.get_name() == "headless" or not ResourceLoader.exists(path):
		return
	if _p == null:
		await ready
	var s := load(path) as AudioStream
	if s == null:
		return
	if s is AudioStreamOggVorbis:
		(s as AudioStreamOggVorbis).loop = false
	_p.stop()   # 한 번에 한 마디 — 새 말이 앞 말을 끊는다
	_p.stream = s
	_p.volume_db = _target_db()
	_p.play()


func _target_db() -> float:
	return SILENT_DB if volume <= 0.0 else clampf(BASE_DB + linear_to_db(volume), SILENT_DB, 0.0)


func _set_enabled(on: bool) -> void:
	enabled = on
	_save_cfg()
	if not on and _p != null:
		_p.stop()


func _set_volume(v: float) -> void:
	volume = clampf(v, 0.0, 1.0)
	_save_cfg()
	if _p != null and _p.playing:
		_p.volume_db = _target_db()


func _load_cfg() -> void:
	var c := ConfigFile.new()
	if c.load(cfg_path) == OK:
		enabled = bool(c.get_value("voice", "enabled", true))
		volume = clampf(float(c.get_value("voice", "volume", 1.0)), 0.0, 1.0)


## 같은 파일의 [bgm] 절을 지우지 않게 읽어서 고친다.
func _save_cfg() -> void:
	var c := ConfigFile.new()
	c.load(cfg_path)
	c.set_value("voice", "enabled", enabled)
	c.set_value("voice", "volume", volume)
	c.save(cfg_path)
