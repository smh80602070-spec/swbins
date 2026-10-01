extends SceneTree

## 배경음 재생기(saga_core/audio/bgm.gd) 점검 — 곡 파일 없이도 되고(조용히), 합성 wav 둘로 크로스페이드·설정 유지를 본다.
##   godot --headless --path saga-godot --script res://tools/probe_bgm.gd
## 끝에 "PROBE bgm OK" 또는 "PROBE bgm FAIL n". 임시 파일은 user://bgm_probe/ 에만 두고 끝에 지운다(진짜 설정 user://audio.cfg 는 안 건드림).

const Bgm := preload("res://saga_core/audio/bgm.gd")
const DIR := "user://bgm_probe/"

var fails := 0


func check(cond: bool, msg: String) -> void:
	if cond:
		print("  ok   ", msg)
	else:
		fails += 1
		print("  FAIL ", msg)


func _wav(path: String, seconds: float, hz: float) -> int:
	var rate := 22050
	var n := int(rate * seconds)
	var bytes := PackedByteArray()
	bytes.resize(n * 2)
	for i in n:
		bytes.encode_s16(i * 2, int(sin(TAU * hz * i / rate) * 8000.0))
	var w := AudioStreamWAV.new()
	w.format = AudioStreamWAV.FORMAT_16_BITS
	w.mix_rate = rate
	w.stereo = false
	w.data = bytes
	w.save_to_wav(path)
	return bytes.size()


func _live_streams() -> Array:
	var out := []
	var node := root.get_node_or_null("SagaBgm")
	if node == null:
		return out
	for c in node.get_children():
		var p := c as AudioStreamPlayer
		if p != null and p.playing and p.stream != null:
			out.append(p)
	return out


func _wait(sec: float) -> void:
	await create_timer(sec).timeout
	await process_frame


func _gd_files(dir: String) -> Array:
	var out := []
	for d in DirAccess.get_directories_at(dir):
		out.append_array(_gd_files(dir.path_join(d)))
	for f in DirAccess.get_files_at(dir):
		if f.ends_with(".gd"):
			out.append(dir.path_join(f))
	return out


func _initialize() -> void:
	await process_frame
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(DIR))
	Bgm.dir = DIR
	Bgm.cfg_path = DIR + "audio.cfg"
	Bgm.fade = 0.05
	Bgm.reset_for_test()
	if FileAccess.file_exists(Bgm.cfg_path):
		DirAccess.remove_absolute(ProjectSettings.globalize_path(Bgm.cfg_path))

	# ① 곡이 없는 키 — 조용히
	Bgm.play(null, "none")
	await _wait(0.1)
	check(Bgm.current_key() == "" and _live_streams().is_empty(), "곡 없는 키는 조용히(현재 키 \"\", 재생 0)")
	check(AudioServer.get_bus_index("BGM") != -1, "전용 버스 BGM 이 만들어짐")

	# ② 곡 a
	var size_a := _wav(DIR + "a.wav", 0.2, 440.0)
	var size_b := _wav(DIR + "b.wav", 0.3, 660.0)
	Bgm.play(null, "a")
	await _wait(0.2)
	var live := _live_streams()
	check(Bgm.current_key() == "a" and live.size() == 1 and (live[0].stream as AudioStreamWAV).data.size() == size_a, "a 재생 — 스트림이 a, 재생 1개")
	check((live[0].bus == &"BGM"), "BGM 버스로 나간다")

	# ③ 크로스페이드 a → b
	Bgm.play(null, "a")  # 같은 키 반복은 무시
	Bgm.play(null, "b")
	await _wait(0.25)
	live = _live_streams()
	check(Bgm.current_key() == "b" and live.size() == 1 and (live[0].stream as AudioStreamWAV).data.size() == size_b, "b 로 바뀜 — 이전 곡 정지, 재생 1개")

	# ④ 끄기·음량 — 새 인스턴스에서도 설정 유지
	Bgm.set_volume(0.5)
	Bgm.set_enabled(false)
	await _wait(0.2)
	check(Bgm.current_key() == "" and _live_streams().is_empty(), "끄면 조용해짐")
	Bgm.reset_for_test()
	await _wait(0.1)
	Bgm.current_key()  # 새 인스턴스를 만든다(설정 파일을 다시 읽음)
	await _wait(0.1)
	var n2 := root.get_node_or_null("SagaBgm")
	check(n2 != null and n2.enabled == false and absf(float(n2.volume) - 0.5) < 0.001, "다시 만들어도 끔·음량 0.5 유지")

	# ⑤ 진짜 곡 — 다섯 판 × 세 장면 15곡이 키 = 파일 이름으로 있고, 코드가 거는 키 문자열이 전부 그 15곡 안에 있다(G-0013)
	var games := ["go", "dungeon", "forest", "story", "realm"]
	var scenes := ["town", "field", "battle"]
	var real := {}
	for g in games:
		for sc in scenes:
			var key: String = "%s-%s" % [g, sc]
			real[key] = true
			check(FileAccess.file_exists("res://assets/audio/bgm/%s.ogg" % key), "곡 파일 %s.ogg" % key)
	var rx := RegEx.new()
	rx.compile('"((?:go|dungeon|forest|story|realm)-(?:town|field|battle|[a-z]+))"')
	var found := {}
	for f in _gd_files("res://games/") + _gd_files("res://saga_core/"):
		var txt := FileAccess.get_file_as_string(f)
		for m in rx.search_all(txt):
			found[m.get_string(1)] = f
	check(found.size() >= 8, "코드가 거는 곡 키 %d개를 찾음(8 이상)" % found.size())
	for k in found:
		check(real.has(k), "코드의 곡 키 \"%s\" 가 15곡 안에 있다(%s)" % [k, String(found[k]).get_file()])
	for old in ["dg-", "fs-", "st-", "rk-"]:
		var bad := false
		for f in _gd_files("res://games/"):
			if FileAccess.get_file_as_string(f).contains("play(self, \"" + old):
				bad = true
		check(not bad, "옛 짧은 키 \"%s…\" 가 안 남아 있다" % old)

	# ⑥ 정리
	Bgm.reset_for_test()
	await _wait(0.1)
	for f in ["a.wav", "b.wav", "audio.cfg"]:
		var p: String = DIR + f
		if FileAccess.file_exists(p):
			DirAccess.remove_absolute(ProjectSettings.globalize_path(p))
	DirAccess.remove_absolute(ProjectSettings.globalize_path(DIR))
	check(not DirAccess.dir_exists_absolute(ProjectSettings.globalize_path(DIR)), "임시 폴더 삭제")

	print("PROBE bgm ", "OK" if fails == 0 else "FAIL %d" % fails)
	quit(1 if fails > 0 else 0)
