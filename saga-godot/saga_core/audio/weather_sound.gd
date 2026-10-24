extends Node

## G-0367 날씨 소리 — 빗소리·바람 소리를 에셋 없이 코드로(걸러낸 잡음, 비 입자 G-0349 처럼 실시간 생성).
##   비   = 가볍게 거른 잡음(쏴아) + 드문드문 빗방울 톡(짧은 감쇠 펄스)
##   바람 = 낮게 거른 잡음을 느린 일렁임(돌풍)으로 크게·작게
## weather_visual 이 set_weather(key) 로 알려 주고, 소리는 FADE_SEC 에 걸쳐 들어오고 빠진다. 손잡이 SAGA_WEATHER_SOUND=0 이면 안 붙음.
## 버스 "Ambience"(없으면 만든다 — bgm.gd 와 같은 길). 크기는 BASE_DB(배경 음악보다 낮게).

const BUS := "Ambience"
const MIX_RATE := 22050.0
const BASE_DB := -14.0
const SILENT_DB := -60.0
const FADE_SEC := 3.0
const LEVEL := {"rain": [1.0, 0.25], "wind": [0.0, 1.0], "snow": [0.0, 0.35]}   # 날씨 → [비 몫, 바람 몫]

var rain := 0.0
var wind := 0.0
var _want := [0.0, 0.0]
var _player: AudioStreamPlayer
var _pb: AudioStreamGeneratorPlayback
var _lp_r := 0.0
var _lp_w := 0.0
var _lp_w2 := 0.0
var _drop := 0.0
var _gust_t := 0.0
var _rng := RandomNumberGenerator.new()


static func enabled() -> bool:
	return OS.get_environment("SAGA_WEATHER_SOUND") != "0"


## 날씨 키 → [비, 바람] 목표(순수)
static func level_of(key: String) -> Array:
	return LEVEL.get(key, [0.0, 0.0])


func set_weather(key: String) -> void:
	_want = level_of(key)


func _init() -> void:
	_rng.seed = 20260824


func _ready() -> void:
	if AudioServer.get_bus_index(BUS) == -1:
		AudioServer.add_bus()
		AudioServer.set_bus_name(AudioServer.bus_count - 1, BUS)
	var gen := AudioStreamGenerator.new()
	gen.mix_rate = MIX_RATE
	gen.buffer_length = 0.25
	_player = AudioStreamPlayer.new()
	_player.stream = gen
	_player.bus = BUS
	_player.volume_db = BASE_DB
	add_child(_player)


func _process(delta: float) -> void:
	rain = move_toward(rain, float(_want[0]), delta / FADE_SEC)
	wind = move_toward(wind, float(_want[1]), delta / FADE_SEC)
	if rain <= 0.001 and wind <= 0.001:
		if _player.playing:
			_player.stop()
			_pb = null
		return
	if not _player.playing:
		_player.play()
		_pb = _player.get_stream_playback() as AudioStreamGeneratorPlayback
	if _pb == null:
		return
	_fill(_pb.get_frames_available())


func _fill(n: int) -> void:
	for i in n:
		var s := sample()
		_pb.push_frame(Vector2(s, s))


## 다음 표본 하나(-1~1) — 지금 rain·wind 세기로. 점검이 오디오 장치 없이 직접 부른다.
func sample() -> float:
	var w := _rng.randf() * 2.0 - 1.0
	## 비: 한 겹 저역 거름(밝은 쏴아) + 빗방울 톡(드물게 튀고 빨리 사라짐)
	_lp_r += (w - _lp_r) * 0.35
	if _rng.randf() < 0.0009:
		_drop = 0.6 + _rng.randf() * 0.4
	_drop *= 0.992
	var r := (_lp_r * 0.55 + w * _drop * 0.35) * rain
	## 바람: 두 겹 저역 거름(웅웅) × 느린 일렁임
	_lp_w += (w - _lp_w) * 0.02
	_lp_w2 += (_lp_w - _lp_w2) * 0.02
	_gust_t += 1.0 / MIX_RATE
	var gust := 0.55 + 0.45 * sin(_gust_t * 0.7) * sin(_gust_t * 0.23 + 1.3)
	var wd := _lp_w2 * 6.5 * gust * wind   # 9.0 은 비(RMS 0.17)보다 커(0.27) 낮춤
	return clampf(r + wd, -1.0, 1.0)
