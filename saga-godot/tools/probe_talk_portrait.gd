extends SceneTree

## G-0220 대화 초상(saga_core/ui/live_portrait.gd · talk_box.gd 셋째 칸 · 4종횡 감정 story_emotes.json) 자동 점검.
##   godot --headless --path saga-godot --script res://tools/probe_talk_portrait.gd
## 그림은 user:// 에 점검용으로 만들어 쓴다(에셋 아님, 끝나면 지움).
## ① 감정 변환 — 고돗 대사와 줄 수가 같고 글 앞이 95% 이상 맞다(고돗이 고쳐 쓴 안내 줄 넷은 감정 없음) · 첫 장 첫 줄 = worry ② available — 놓인 사람만 · 감정 짝
## ③ 깜빡임 결정적(같은 id 두 개 같은 차례)·간격 3~6초 ④ 말하는 동안만 입 ⑤ 한 사람 한 그림체 — 움직이는 초상이 있으면 그린 표정 카드는 안 씀, live.json expr 표정만(패치 없음) · 카드만 있는 사람은 카드
## ⑥ 대화창 — 셋째 칸 초상 · 없는 줄·없는 사람은 숨김 · 옛 두 칸 호출 그대로 ⑦ 놓인 주역 수(알림만 — 자체툴 배치 전 0).
## 끝에 "PROBE talk_portrait OK" 또는 "PROBE talk_portrait FAIL n".

const LP := preload("res://saga_core/ui/live_portrait.gd")
const TalkBox := preload("res://saga_core/ui/talk_box.gd")
const FIX := "user://probe_portraits"
const CAST := ["sg_lubu", "kr_gyebaek", "jp_musashi", "eu_leonidas", "sg_huangzhong", "sg_taishici", "jp_yoshitsune", "wd_genghis", "jp_hanzo",
	"sg_ganning", "jp_tomoegozen", "wd_shaka", "jp_himiko", "sg_zhugeliang", "wd_ibnsina", "eu_davinci", "fu_jongwang", "ru_geohae", "tb_baekgi",
	"sg_caocao", "sg_liubei", "sg_sunquan", "hl_mukhyang"]

var fails := 0


func check(cond: bool, msg: String) -> void:
	if cond:
		print("  ok   ", msg)
	else:
		fails += 1
		print("  FAIL ", msg)


func _img(w: int, h: int, c: Color) -> Image:
	var im := Image.create(w, h, false, Image.FORMAT_RGBA8)
	im.fill(c)
	return im


func _fixture() -> void:
	DirAccess.make_dir_recursive_absolute(FIX + "/live/pt_a")
	DirAccess.make_dir_recursive_absolute(FIX + "/expr")
	_img(75, 100, Color(0.6, 0.5, 0.4)).save_webp(FIX + "/live/pt_a/base.webp")
	for f in ["blink_half", "blink"]:
		_img(30, 10, Color(0.2, 0.2, 0.2)).save_webp(FIX + "/live/pt_a/%s.webp" % f)
	for f in ["mouth_half", "mouth_a", "mouth_o"]:
		_img(10, 6, Color(0.7, 0.2, 0.2)).save_webp(FIX + "/live/pt_a/%s.webp" % f)
	var live := {"id": "pt_a", "size": [75, 100], "base": "base.webp",
		"parts": {"eye": {"box": [22, 40, 52, 50], "frames": {"blink_half": "blink_half.webp", "blink": "blink.webp"}},
			"mouth": {"box": [33, 58, 43, 64], "frames": {"mouth_half": "mouth_half.webp", "mouth_a": "mouth_a.webp", "mouth_o": "mouth_o.webp"}}},
		"motion": LP.MOTION, "expr": {"anger": "anger.webp"}}
	_img(75, 100, Color(0.8, 0.3, 0.3)).save_webp(FIX + "/live/pt_a/anger.webp")
	var f := FileAccess.open(FIX + "/live/pt_a/live.json", FileAccess.WRITE)
	f.store_string(JSON.stringify(live))
	f.close()
	_img(30, 34, Color(0.9, 0.8, 0.3)).save_webp(FIX + "/expr/pt_a__joy_c.webp")
	_img(30, 34, Color(0.3, 0.8, 0.3)).save_webp(FIX + "/expr/pt_b__joy_c.webp")


func _cleanup() -> void:
	for p in ["live/pt_a/base.webp", "live/pt_a/blink_half.webp", "live/pt_a/blink.webp", "live/pt_a/mouth_half.webp", "live/pt_a/mouth_a.webp",
			"live/pt_a/mouth_o.webp", "live/pt_a/live.json", "live/pt_a/anger.webp", "expr/pt_a__joy_c.webp", "expr/pt_b__joy_c.webp", "live/pt_a", "expr", "live", ""]:
		DirAccess.remove_absolute(ProjectSettings.globalize_path(FIX + "/" + p))


func _initialize() -> void:
	await process_frame
	# ① 감정 변환
	var Sc: GDScript = load("res://games/saga_story/data/scenario.gd")
	var ej: Dictionary = JSON.parse_string(FileAccess.get_file_as_string(Sc.EMOTES_PATH))
	var shared := 0
	var same_n := 0
	var lines_n := 0
	var hit := 0
	for k: String in ej:
		if k == "_from":
			continue
		var gl: Array = Sc.lines_of(k)
		if gl.is_empty():
			continue
		shared += 1
		if gl.size() == (ej[k] as Array).size():
			same_n += 1
		for i in gl.size():
			lines_n += 1
			if Sc.emote_at(k, i, String(gl[i][1])) != "":
				hit += 1
	var first: String = Sc.emote_at("sinya1", 0, String(Sc.lines_of("sinya1")[0][1]))
	check(shared >= 30 and same_n == shared and hit * 100 >= lines_n * 95 and first == "worry" and Sc.emote_at("sinya1", 0, "다른 글") == "",
		"① 감정 — 장면 %d 곳 줄 수 같음 %d · 줄 %d 중 감정 %d(나머지는 고돗이 고쳐 쓴 안내 글) · 첫 줄 %s · 글이 다르면 빈 칸" % [shared, same_n, lines_n, hit, first])

	# ② available·짝
	LP.root_dir = FIX
	_fixture()
	check(LP.available("pt_a") and LP.available("pt_a", "joy") and not LP.available("nobody") and not LP.available("") \
		and LP.expr_of("fire") == "anger" and LP.expr_of("worry") == "sorrow" and LP.expr_of("shock") == "surprise" and LP.expr_of("calm") == "",
		"② 놓인 사람만 · 감정 짝 fire→anger·worry→sorrow·shock→surprise·calm→기본")

	# ③ 깜빡임
	var p1: Control = LP.new()
	var p2: Control = LP.new()
	root.add_child(p1)
	root.add_child(p2)
	var s1: bool = p1.setup("pt_a")
	p2.setup("pt_a")
	var seq1: Array = []
	var seq2: Array = []
	var starts: Array = []
	var prev := ""
	for i in 2000:
		var t := i * 0.01
		var e1 := String(p1.frames_at(t).eye)
		seq1.append(e1)
		seq2.append(String(p2.frames_at(t).eye))
		if e1 != "" and prev == "":
			starts.append(t)
		prev = e1
	var gaps_ok := starts.size() >= 3
	for i in range(1, starts.size()):
		var g: float = starts[i] - starts[i - 1]
		gaps_ok = gaps_ok and g >= 2.95 and g <= 6.05
	check(s1 and seq1 == seq2 and gaps_ok and seq1.has("blink"), "③ 깜빡임 같은 차례 · 20초에 %d 번 · 간격 3~6초" % starts.size())

	# ④ 말하기
	p1.set("_t", 30.0)
	p1.talk(1.0)
	var m_in := String(p1.frames_at(30.05).mouth)
	var m_in2 := String(p1.frames_at(30.15).mouth)
	var m_out := String(p1.frames_at(31.2).mouth)
	check(m_in == "mouth_half" and m_in2 == "mouth_a" and m_out == "" and String(p1.frames_at(29.0).mouth) == "", "④ 말하는 동안만 입 %s→%s · 끝나면 빈 칸" % [m_in, m_in2])

	# ⑤ 한 사람 한 그림체
	var live_wins: bool = p1.setup("pt_a", "joy") and String(p1.expr) == ""
	var live_expr: bool = p1.setup("pt_a", "fire") and String(p1.expr) == "anger" and String(p1.frames_at(30.05).mouth) == "" and String(p1.frames_at(30.05).eye) == ""
	var fb_ok: bool = p1.setup("pt_a", "worry") and String(p1.expr) == ""
	var card_ok: bool = p1.setup("pt_b", "joy") and String(p1.expr) == "joy" and not p1.setup("pt_b", "calm") and not LP.available("pt_b")
	check(live_wins and live_expr and fb_ok and card_ok, "⑤ 움직이는 초상이 있으면 그린 카드 안 씀 · fire → live 분노 바탕(패치 없음) · 없는 표정 기본 · 카드만 있는 사람 = 기쁨 카드, 평온은 숨김")
	p1.queue_free()
	p2.queue_free()

	# ⑥ 대화창
	var done := [false]
	var box: CanvasLayer = TalkBox.open(root, "점검", [["갑", "안녕하신가", {"id": "pt_a", "emote": "joy"}], ["을", "두 칸 줄"], ["병", "없는 사람", {"id": "sg_nobody"}]],
		func(_a: String) -> void: done[0] = true)
	await process_frame
	var a1: String = box.portrait_id()
	box.next_line()
	var a2: String = box.portrait_id()
	box.next_line()
	var a3: String = box.portrait_id()
	box.next_line()
	var old: CanvasLayer = TalkBox.open(root, "옛", [["정", "두 칸만"]], func(_a: String) -> void: pass)
	await process_frame
	var a4: String = old.portrait_id()
	old.next_line()
	await process_frame
	check(a1 == "pt_a" and a2 == "" and a3 == "" and a4 == "" and done[0] and not paused, "⑥ 대화창 초상 %s → 두 칸 줄 숨김 → 없는 사람 숨김 · 옛 호출 그대로 · 닫으면 멈춤 풂" % a1)

	# ⑦ 놓인 주역(알림)
	_cleanup()
	LP.root_dir = "res://assets/portraits"
	var placed := CAST.filter(func(id): return LP.available(id))
	print("  info 놓인 주역 초상 %d/%d (자체툴 배치 전이면 0 — 초상 없이 지금 모양)" % [placed.size(), CAST.size()])

	print("PROBE talk_portrait OK" if fails == 0 else "PROBE talk_portrait FAIL %d" % fails)
	quit(1 if fails > 0 else 0)
