extends Node

## 배경음 재생기 (G-0011) — 다섯 판이 같이 쓴다. autoload 를 늘리지 않는다: 첫 호출이 `/root/SagaBgm` 을 만든다.
##   const Bgm := preload("res://saga_core/audio/bgm.gd")
##   Bgm.play(self, "go-town")     # 곡 키 = <판>-<장면>. 같은 키를 다시 부르면 무시, 새 곡이면 FADE 초 크로스페이드
##   Bgm.stop(self)                # 페이드 아웃
##   Bgm.set_enabled(false) · Bgm.set_volume(0.5)   # UI 없이 API 만 — user://audio.cfg [bgm] enabled, volume 에 저장
## 곡 찾기: `res://assets/audio/bgm/<키>.ogg`(없으면 `.wav`). 없으면 아무 일도 안 한다(경고·로그 없음) — 곡은 K-0004 가 낸다.
##   Bgm.stinger(self, "levelup")  # G-0034 짧은 음악 `stinger-<키>` 한 번 — 배경음을 잠깐 낮췄다(덕킹) 끝나면 되돌린다. 같은 키 STINGER_GAP 초 안은 무시
## 전용 버스 "BGM" 을 런타임에 만들어 효과음(CombatFeel)과 섞이지 않는다. 시험용으로 dir·cfg_path·fade 를 덮어쓸 수 있다.

const Voice := preload("res://saga_core/audio/voice.gd")

const NODE_NAME := "SagaBgm"
const BUS := "BGM"
const BASE_DB := -10.0
const SILENT_DB := -80.0
const SELF_PATH := "res://saga_core/audio/bgm.gd"

static var dir := "res://assets/audio/bgm/"
static var cfg_path := "user://audio.cfg"
static var fade := 1.2

var enabled := true
var volume := 0.8
var current := ""   # 지금 실제로 나오는 곡 키("" = 조용)

var _want := ""     # 마지막으로 부탁받은 키(곡이 없어도 기억 — 같은 키 반복 호출을 무시)
var _a: AudioStreamPlayer
var _b: AudioStreamPlayer
var _live: AudioStreamPlayer
var _tween: Tween
## G-0034 스팅어 — 세 번째 재생기. last_stinger·stinger_count 는 곡이 없거나 헤드리스여도 남는다(점검용).
const DUCK_DB := -10.0
## 짧은 음악 파일은 8초(소리는 앞 1~2초, 뒤는 잔향)라 끝까지 낮추면 배경음이 오래 죽는다 — 앞 DUCK_HOLD 초만 낮추고 DUCK_BACK 초에 걸쳐 되돌린다(10-06 녹음 판정).
const DUCK_HOLD := 2.5
const DUCK_BACK := 0.8
const DUCK_DELAY := 0.4   # 짧은 음악 앞 0.4초쯤은 조용하다 — 바로 내리면 곡의 조용한 대목과 겹쳐 소리가 빈다(10-06 녹음 판정)
const DUCK_IN := 0.3
const STINGER_GAP := 1.5
var last_stinger := ""
var stinger_count := 0
var _s: AudioStreamPlayer
var _st_at := {}
var _duck: Tween


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


static func play(_ctx: Node, key: String) -> void:
	var n := _inst()
	if n != null:
		n._play(key)


static func stop(_ctx: Node = null) -> void:
	var n := _inst()
	if n != null:
		n._play("")


static func set_enabled(on: bool) -> void:
	var n := _inst()
	if n != null:
		n._set_enabled(on)


static func set_volume(v: float) -> void:
	var n := _inst()
	if n != null:
		n._set_volume(v)


static func stinger(_ctx: Node, key: String) -> void:
	Voice.system(key)   # G-0111 — 짧은 음악과 함께 해설 안내 한 줄(키가 Voice.SYSTEM 에 있을 때만)
	var n := _inst()
	if n != null:
		n._stinger(key)


static func current_key() -> String:
	var n := _inst()
	return "" if n == null else String(n.current)


func _init() -> void:
	_load_cfg()


func _ready() -> void:
	_ensure_bus()
	_a = _make_player()
	_b = _make_player()
	_live = _a
	_s = _make_player()
	_s.finished.connect(_unduck)


func _make_player() -> AudioStreamPlayer:
	var p := AudioStreamPlayer.new()
	p.bus = BUS
	p.volume_db = SILENT_DB
	add_child(p)
	return p


func _ensure_bus() -> void:
	if AudioServer.get_bus_index(BUS) == -1:
		AudioServer.add_bus()
		AudioServer.set_bus_name(AudioServer.bus_count - 1, BUS)


func _target_db() -> float:
	return SILENT_DB if volume <= 0.0 else clampf(BASE_DB + linear_to_db(volume), SILENT_DB, 0.0)


func _play(key: String) -> void:
	if key == _want:
		return
	_want = key
	_apply(key)


func _apply(key: String) -> void:
	if _a == null:
		await ready
	if _tween != null and _tween.is_valid():
		_tween.kill()
	if not enabled or key == "":
		_fade_out_live()
		return
	var stream := _find(key)
	if stream == null:
		_fade_out_live()
		return
	var next := _b if _live == _a else _a
	next.stream = stream
	next.volume_db = SILENT_DB
	next.play()
	_tween = create_tween().set_parallel(true)
	_tween.tween_property(next, "volume_db", _target_db(), fade)
	if _live.playing:
		var old := _live
		_tween.tween_property(old, "volume_db", SILENT_DB, fade)
		_tween.chain().tween_callback(old.stop)
	_live = next
	current = key


func _stinger(key: String) -> void:
	var now := Time.get_ticks_msec()
	if now - int(_st_at.get(key, -100000)) < int(STINGER_GAP * 1000.0):
		return
	_st_at[key] = now
	last_stinger = key
	stinger_count += 1
	if not enabled:
		return
	if _s == null:
		await ready
	var stream := _find("stinger-" + key)
	if stream == null:
		return
	if stream is AudioStreamOggVorbis:
		(stream as AudioStreamOggVorbis).loop = false   # 배경음과 달리 한 번만
	elif stream is AudioStreamWAV:
		(stream as AudioStreamWAV).loop_mode = AudioStreamWAV.LOOP_DISABLED
	_s.stop()
	_s.stream = stream
	_s.volume_db = _target_db()
	_s.play()
	if _live != null and _live.playing:
		if _duck != null and _duck.is_valid():
			_duck.kill()
		_duck = create_tween()
		_duck.tween_interval(DUCK_DELAY)
		_duck.tween_property(_live, "volume_db", maxf(_target_db() + DUCK_DB, SILENT_DB), DUCK_IN)
		_duck.tween_interval(maxf(minf(DUCK_HOLD, stream.get_length()) - DUCK_DELAY - DUCK_IN, 0.0))
		_duck.tween_callback(_unduck)


func _unduck() -> void:
	if _live == null or not _live.playing or current == "":
		return
	if _duck != null and _duck.is_valid():
		_duck.kill()
	_duck = create_tween()
	_duck.tween_property(_live, "volume_db", _target_db(), DUCK_BACK)


func _fade_out_live() -> void:
	current = ""
	if _live == null or not _live.playing:
		return
	var old := _live
	_tween = create_tween()
	_tween.tween_property(old, "volume_db", SILENT_DB, fade)
	_tween.tween_callback(old.stop)


func _find(key: String) -> AudioStream:
	for ext in ["ogg", "wav"]:
		var s := _load_file(dir.path_join(key + "." + ext), ext)
		if s != null:
			return s
	return null


func _load_file(path: String, ext: String) -> AudioStream:
	var s: AudioStream = null
	if path.begins_with("res://"):
		## 헤드리스(소리 없는 진단·godot_regress)에선 진짜 곡을 안 연다 — 재생 중인 .ogg 가 종료 때 "쓰이는 자원"으로 남아 점검이 막힌다(G-0013).
		if DisplayServer.get_name() == "headless":
			return null
		if ResourceLoader.exists(path):
			s = load(path) as AudioStream
	elif FileAccess.file_exists(path):
		s = AudioStreamOggVorbis.load_from_file(path) if ext == "ogg" else AudioStreamWAV.load_from_file(path)
	if s is AudioStreamOggVorbis:
		(s as AudioStreamOggVorbis).loop = true
	elif s is AudioStreamWAV:
		var w := s as AudioStreamWAV
		var frame := (2 if w.stereo else 1) * (2 if w.format == AudioStreamWAV.FORMAT_16_BITS else 1)
		w.loop_mode = AudioStreamWAV.LOOP_FORWARD
		w.loop_begin = 0
		@warning_ignore("integer_division")
		w.loop_end = w.data.size() / maxi(frame, 1)
	return s


func _set_enabled(on: bool) -> void:
	enabled = on
	_save_cfg()
	_apply(_want)  # 켜면 마지막으로 부탁받은 곡을, 끄면 조용히


func _set_volume(v: float) -> void:
	volume = clampf(v, 0.0, 1.0)
	_save_cfg()
	if _live != null and _live.playing:
		_live.volume_db = _target_db()


func _load_cfg() -> void:
	var c := ConfigFile.new()
	if c.load(cfg_path) == OK:
		enabled = bool(c.get_value("bgm", "enabled", true))
		volume = clampf(float(c.get_value("bgm", "volume", 0.8)), 0.0, 1.0)


func _save_cfg() -> void:
	var c := ConfigFile.new()
	c.load(cfg_path)   # G-0111 — 같은 파일의 [voice] 절을 지우지 않게
	c.set_value("bgm", "enabled", enabled)
	c.set_value("bgm", "volume", volume)
	c.save(cfg_path)
