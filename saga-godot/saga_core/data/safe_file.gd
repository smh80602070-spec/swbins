extends RefCounted

## 저장 파일 안전 쓰기·읽기 (2026-09-30 자동 저장 도입과 함께) — 쓰는 도중 꺼져도 세이브가 반쪽이 되지 않게.
##   write_text: 임시 파일(.tmp)에 다 쓰고 → 직전 성공본을 .bak 으로 복사 → 원본을 지우고 → 임시를 원본 이름으로 바꾼다.
##   read_json: 원본을 읽어 사전이면 그것을, 없거나 깨졌으면 .bak 을 읽는다(둘 다 안 되면 null).
## 다섯 판 세이브가 같이 쓸 수 있는 자리라 saga_core 에 둔다(GO 는 save_state.gd 가 쓴다).


static func write_text(path: String, text: String) -> bool:
	var tmp := path + ".tmp"
	var f := FileAccess.open(tmp, FileAccess.WRITE)
	if f == null:
		return false
	f.store_string(text)
	f.flush()
	f.close()
	var a_main := ProjectSettings.globalize_path(path)
	var a_tmp := ProjectSettings.globalize_path(tmp)
	var a_bak := ProjectSettings.globalize_path(path + ".bak")
	if FileAccess.file_exists(path):
		DirAccess.copy_absolute(a_main, a_bak)
		DirAccess.remove_absolute(a_main)
	return DirAccess.rename_absolute(a_tmp, a_main) == OK


## 원본 → 실패하면 .bak. 사전이 아니면 null.
static func read_json(path: String) -> Variant:
	for p in [path, path + ".bak"]:
		if not FileAccess.file_exists(p):
			continue
		var f := FileAccess.open(p, FileAccess.READ)
		if f == null:
			continue
		var parsed: Variant = JSON.parse_string(f.get_as_text())
		if typeof(parsed) == TYPE_DICTIONARY:
			return parsed
	return null


static func exists(path: String) -> bool:
	return FileAccess.file_exists(path) or FileAccess.file_exists(path + ".bak")
