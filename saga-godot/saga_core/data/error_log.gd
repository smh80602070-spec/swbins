extends RefCounted
## G-0068 — 오류 기록(SAGA-BACKLOG §4.6, Unity SagaCrashLog 의 고돗 짝). 다섯 판 공용, 정적 함수만.
## Godot 이 남기는 로그 파일(user://logs — PC 는 기본, 폰은 project.godot enable_file_logging.mobile 로 켬, 최근 다섯 개를 돌려 씀) 중
## 지금 실행과 직전 실행 둘에서 ERROR·SCRIPT ERROR·WARNING 줄과 바로 뒤 "at:" 줄만 모은다. 같은 줄이 거듭되면 "×n".
## 앱이 통째로 죽는 네이티브 충돌은 로그가 거기서 끊겨 일부만 남는다(스토어 콘솔 몫 — Unity 쪽과 같은 한계).

const LOG_DIR := "user://logs"
const MAX_LINES := 40
const KEYS := ["SCRIPT ERROR", "ERROR", "WARNING"]


## 최근 수정 순 로그 파일 경로(최대 n 개).
static func log_files(n: int = 2) -> Array:
	var files: Array = []
	var da := DirAccess.open(LOG_DIR)
	if da == null:
		return files
	for f in da.get_files():
		if f.ends_with(".log"):
			var p := LOG_DIR.path_join(f)
			files.append([FileAccess.get_modified_time(p), p])
	files.sort_custom(func(a, b): return int(a[0]) > int(b[0]))
	return files.slice(0, n).map(func(x): return String(x[1]))


## 로그 글 → 오류 줄 목록. 오류 줄 바로 뒤의 "at:" 줄은 붙여 한 항목으로. 같은 항목이 잇달아 나오면 "×n", 마지막 max 개.
static func collect(text: String, max_lines: int = MAX_LINES) -> Array:
	var out: Array = []
	var counts: Array = []
	var lines := text.split("\n")
	var i := 0
	while i < lines.size():
		var ln := lines[i].strip_edges()
		var hit := false
		for k in KEYS:
			if ln.begins_with(k):
				hit = true
				break
		if hit:
			var item := ln
			if i + 1 < lines.size() and lines[i + 1].strip_edges().begins_with("at:"):
				item += "  " + lines[i + 1].strip_edges()
				i += 1
			var j := out.find(item)
			if j >= 0:
				counts[j] += 1
			else:
				out.append(item)
				counts.append(1)
		i += 1
	var res: Array = []
	for k in out.size():
		res.append(out[k] + ("  ×%d" % counts[k] if counts[k] > 1 else ""))
	return res.slice(maxi(0, res.size() - max_lines))


## 복사해 보낼 글 — 머리줄(버전·OS·시각) + 파일마다 오류 줄. 없으면 "오류 없음".
static func report() -> String:
	var ver := String(ProjectSettings.get_setting("application/config/version", ""))
	var head := "사가 고돗%s · %s · %s" % [(" " + ver) if ver != "" else "", OS.get_name(), Time.get_datetime_string_from_system()]
	var parts: Array = [head]
	var any := false
	for p: String in log_files():
		var items := collect(FileAccess.get_file_as_string(p))
		if items.is_empty():
			continue
		any = true
		parts.append("— %s" % p.get_file())
		parts.append_array(items)
	if not any:
		parts.append("오류 없음(최근 실행 둘)")
	return "\n".join(PackedStringArray(parts))
