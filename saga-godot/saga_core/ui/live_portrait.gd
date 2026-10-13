extends Control
## G-0220 대화 초상 — 자체툴 K-0049 움직이는 초상(live.json)·K-0047 표정 초상을 대화창(talk_box.gd)에서 재생한다(다섯 판 공용).
## 규격(tools/ai-art/split_portrait_layers.py 머리말): base 위 parts[eye|mouth].box 자리에 frames 패치를 얹는다 —
##   깜빡임 = motion.blink.seq 를 frame_ms 씩, every_s 범위 간격(씨앗 = 인물 id, 전역 randf 안 씀) · 말하기 = talk.seq 되풀이(talk() 동안) ·
##   숨쉬기 = 아래 끝 기준 세로 1+amp 배 period_s · 고개 = pivot_y 기준 ±deg period_s.
## 표정(joy·anger·sorrow·surprise) — **한 사람 한 그림체**: 움직이는 초상(3D 렌더)이 있으면 그것만 쓰고, 표정은 live.json "expr" {표정: 파일}(같은 렌더의
##   표정 바탕)이 있을 때만 바꾼다(패치 없음 — 숨·고개만). K-0047 표정 카드(그린 그림 — 얼굴이 딴사람처럼 보인다)는 움직이는 초상이 없는 사람만.
## 둘 다 없으면 setup() 이 false(창은 초상을 숨긴다).
## 그림은 자체툴이 assets/portraits/{live/<id>/, expr/<id>__<표정>_c.webp} 에 놓는다 — .import 가 없어도 파일에서 바로 읽는다.

## 웹 4종횡 EMOTES 짝(calm·없음 = 기본 초상)
const EMOTE := {"joy": "joy", "anger": "anger", "fire": "anger", "worry": "sorrow", "shock": "surprise"}
const MOTION := {"blink": {"seq": ["blink_half", "blink", "blink_half"], "frame_ms": 60, "every_s": [3, 6]},
	"talk": {"seq": ["mouth_half", "mouth_a", "mouth_half", "mouth_o"], "frame_ms": 110},
	"breath": {"amp": 0.006, "period_s": 3.6}, "sway": {"deg": 1.2, "period_s": 5.0, "pivot_y": 0.78}}
const ZOOM := 1.04   # 고개 기울임에 모서리가 비지 않게 살짝 크게(clip)

static var root_dir := "res://assets/portraits"   # 점검이 user:// 로 바꾼다

var id := ""
var expr := ""
var _live: Dictionary = {}
var _tex: Dictionary = {}
var _t := 0.0
var _talk_from := 0.0
var _talk_until := 0.0
var _rng := RandomNumberGenerator.new()
var _blinks: Array = []


static func live_path(pid: String) -> String:
	return "%s/live/%s/live.json" % [root_dir, pid]


static func expr_path(pid: String, e: String) -> String:
	return "%s/expr/%s__%s_c.webp" % [root_dir, pid, e]


static func expr_of(emote: String) -> String:
	return String(EMOTE.get(emote, ""))


static func _exists(p: String) -> bool:
	return ResourceLoader.exists(p) or FileAccess.file_exists(p)


## 이 사람(과 감정)의 초상이 놓여 있나
static func available(pid: String, emote: String = "") -> bool:
	if pid == "":
		return false
	var e := expr_of(emote)
	return _exists(live_path(pid)) or (e != "" and _exists(expr_path(pid, e)))


static func load_tex(p: String) -> Texture2D:
	if ResourceLoader.exists(p):
		return load(p) as Texture2D
	if not FileAccess.file_exists(p):
		return null
	var img := Image.new()
	var buf := FileAccess.get_file_as_bytes(p)
	var err := img.load_webp_from_buffer(buf) if p.ends_with(".webp") else img.load_png_from_buffer(buf)
	return ImageTexture.create_from_image(img) if err == OK else null


func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS   # 대화창이 게임을 멈춰도 돈다
	clip_contents = true
	mouse_filter = Control.MOUSE_FILTER_IGNORE


## 사람·감정을 정한다 — 그릴 것이 없으면 false. 같은 사람이면 그림을 다시 읽지 않는다.
func setup(pid: String, emote: String = "") -> bool:
	if not available(pid, emote):
		id = ""
		return false
	var e := expr_of(emote)
	if pid != id:
		id = pid
		_tex = {}
		_live = {}
		if _exists(live_path(pid)):
			var d: Variant = JSON.parse_string(FileAccess.get_file_as_string(live_path(pid)))
			if typeof(d) == TYPE_DICTIONARY:
				_live = d
				var dir := live_path(pid).get_base_dir()
				_tex["base"] = load_tex(dir + "/" + String(_live.get("base", "base.webp")))
				for part: String in (_live.get("parts", {}) as Dictionary):
					var fr: Dictionary = _live.parts[part].get("frames", {})
					for f: String in fr:
						_tex[f] = load_tex(dir + "/" + String(fr[f]))
		_rng.seed = hash(pid)
		_blinks = []
		_t = 0.0
		_talk_until = 0.0
	var src := ""
	if not _live.is_empty():
		var lx: Dictionary = _live.get("expr", {})
		if e != "" and lx.has(e):
			src = live_path(pid).get_base_dir() + "/" + String(lx[e])
	elif e != "" and _exists(expr_path(pid, e)):
		src = expr_path(pid, e)
	if src == "":
		e = ""
	elif not _tex.has("expr_" + e):
		_tex["expr_" + e] = load_tex(src)
	expr = e
	if expr == "" and _tex.get("base") == null:
		id = ""
		return false
	queue_redraw()
	return true


## 말하는 입 — 지금부터 sec 초
func talk(sec: float) -> void:
	_talk_from = _t
	_talk_until = _t + maxf(0.0, sec)


func motion(k: String) -> Dictionary:
	return (_live.get("motion", MOTION) as Dictionary).get(k, MOTION[k])


## t 초에 얹을 패치 — {eye: 프레임 이름 | "", mouth: …}. 같은 id 면 같은 차례(씨앗).
func frames_at(t: float) -> Dictionary:
	var out := {"eye": "", "mouth": ""}
	if expr != "" or _live.is_empty():
		return out
	var bl := motion("blink")
	var every: Array = bl.get("every_s", [3, 6])
	while _blinks.is_empty() or float(_blinks[-1]) <= t:
		var last: float = 0.0 if _blinks.is_empty() else float(_blinks[-1])
		_blinks.append(last + _rng.randf_range(float(every[0]), float(every[1])))
	var bseq: Array = bl.get("seq", [])
	var bms := float(bl.get("frame_ms", 60)) / 1000.0
	for b in _blinks:
		var dt := t - float(b)
		if dt >= 0.0 and dt < bms * bseq.size():
			out.eye = String(bseq[int(dt / bms)])
	if t >= _talk_from and t < _talk_until:
		var tk := motion("talk")
		var tseq: Array = tk.get("seq", [])
		var tms := float(tk.get("frame_ms", 110)) / 1000.0
		if not tseq.is_empty():
			out.mouth = String(tseq[int((t - _talk_from) / tms) % tseq.size()])
	return out


func _process(delta: float) -> void:
	if id == "" or not is_visible_in_tree():
		return
	_t += delta
	queue_redraw()


func _draw() -> void:
	var tex: Texture2D = _tex.get("expr_" + expr) if expr != "" else _tex.get("base")
	if tex == null:
		return
	var ts := tex.get_size()
	var s := maxf(size.x / ts.x, size.y / ts.y) * ZOOM   # 채우기(넘치는 쪽은 자름)
	var w := ts.x * s
	var h := ts.y * s
	var x0 := (size.x - w) * 0.5
	var y0 := (size.y - h) * 0.5
	var br := motion("breath")
	var sw := motion("sway")
	var sy := 1.0 + float(br.amp) * sin(TAU * _t / float(br.period_s))
	var ang := deg_to_rad(float(sw.deg)) * sin(TAU * _t / float(sw.period_s))
	var bottom := y0 + h
	var pivot := Vector2(x0 + w * 0.5, y0 + h * float(sw.pivot_y))
	var xf := Transform2D(0.0, Vector2(0, bottom)) * Transform2D(0.0, Vector2(1.0, sy), 0.0, Vector2.ZERO) * Transform2D(0.0, Vector2(0, -bottom))
	xf = Transform2D(ang, pivot) * Transform2D(0.0, -pivot) * xf
	draw_set_transform_matrix(xf)
	draw_texture_rect(tex, Rect2(x0, y0, w, h), false)
	if expr == "":
		var fr := frames_at(_t)
		for part: String in ["eye", "mouth"]:
			var f := String(fr[part])
			var pt: Texture2D = _tex.get(f)
			if f == "" or pt == null:
				continue
			var box: Array = (_live.parts[part] as Dictionary).box
			var k := w / ts.x
			draw_texture_rect(pt, Rect2(x0 + float(box[0]) * k, y0 + float(box[1]) * k, float(box[2] - box[0]) * k, float(box[3] - box[1]) * k), false)
	draw_set_transform_matrix(Transform2D.IDENTITY)
