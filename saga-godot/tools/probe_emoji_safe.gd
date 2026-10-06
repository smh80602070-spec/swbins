extends SceneTree

## G-0053 — 윈도 10 글꼴(Segoe UI Emoji)에 없는 이모지 13판(2020) 이후 글자가 게임 문자열에 들어오면 실패.
##   godot --headless --path saga-godot --script res://tools/probe_emoji_safe.gd
## 끝에 "PROBE emoji_safe OK" 또는 실패 줄. 2026-10-07 이 PC 전수 조사에서 빠진 11자(🪙·🪨·🪖·🪧·🪭·🪵·🪶·🪷·🛖·🥷·🩻)가
## 모두 아래 범위에 든다 — 대체는 💰·🗿·🛡️·⚖️·📜 같은 옛판 글자로.

const ROOTS := ["res://games", "res://saga_core"]
## [시작, 끝] — 1FA70–1FAFF 블록에서 12판(🩰~🩳·🩸~🩺·🪀~🪂·🪐~🪕 — 윈도 10 에 있다)을 뺀 나머지와 다른 블록에 흩어진 13판+ 글자.
const BANNED := [
	[0x1FA74, 0x1FA77], [0x1FA7B, 0x1FA7F], [0x1FA83, 0x1FA8F], [0x1FA96, 0x1FAFF], [0x1F6D6, 0x1F6DF], [0x1F6FB, 0x1F6FF], [0x1F90C, 0x1F90C], [0x1F972, 0x1F972],
	[0x1F977, 0x1F979], [0x1F9A3, 0x1F9A4], [0x1F9AB, 0x1F9AD], [0x1F9CB, 0x1F9CC], [0x1F7F0, 0x1F7F0],
]

var fails := 0


func _banned(cp: int) -> bool:
	for r: Array in BANNED:
		if cp >= int(r[0]) and cp <= int(r[1]):
			return true
	return false


func _walk(d: String, files: Array) -> void:
	var da := DirAccess.open(d)
	if da == null:
		return
	for f in da.get_files():
		if f.ends_with(".gd") or f.ends_with(".tscn") or f.ends_with(".json"):
			files.append(d + "/" + f)
	for sub in da.get_directories():
		_walk(d + "/" + sub, files)


func _init() -> void:
	var files: Array = []
	for r in ROOTS:
		_walk(r, files)
	for path: String in files:
		var t := FileAccess.get_file_as_string(path)
		for i in t.length():
			var cp := t.unicode_at(i)
			if cp >= 0x1F000 and _banned(cp):
				fails += 1
				print("  FAIL %s — U+%X %s (윈도 10 글꼴에 없음)" % [path, cp, String.chr(cp)])
	if files.size() < 100:
		fails += 1
		print("  FAIL 훑은 파일 %d 개 — 경로가 틀렸다" % files.size())
	print("PROBE emoji_safe ", "OK" if fails == 0 else "FAIL %d" % fails)
	quit(1 if fails > 0 else 0)
