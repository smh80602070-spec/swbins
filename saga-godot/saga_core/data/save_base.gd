class_name SagaSaveBase
extends Node

const SafeFileT := preload("res://saga_core/data/safe_file.gd")

## 다섯 판 세이브 상태(autoload)가 같이 쓰는 마이그레이션 계약 — 판마다 복사해 갖던 `_migrate` 한 벌.
## 각 판은 `extends SagaSaveBase` 하고 자기 상수 SAVE_VERSION·SAVE_PATH 를 `save_version()`·`save_path()` 로 돌려주며,
## 버전 사이 변환은 `_migrate_step()` 만 덮어쓴다(const 는 물려줄 수 없어 가상 함수로 받는다).
## 저장/불러오기 본문(필드 목록)은 판마다 달라 여기 없다. 세이브 옮기기(export_string·import_string)는 다섯 판 공통으로 여기. 실제 저장 파일 이름·SAVE_VERSION 값은 각 판이 정한다.


## 이 빌드의 세이브 버전. 판이 덮어쓴다.
func save_version() -> int:
	return 0


## 점검이 임시 파일로 돌릴 때만 채운다(진짜 세이브를 건드리지 않게) — 다섯 판 save_path() 가 먼저 본다(G-0120, 옛날엔 GO 만).
var path_override := ""


## 세이브 파일 경로. 판이 덮어쓴다(path_override 가 있으면 그것).
func save_path() -> String:
	return ""


## data 의 "version" 이 save_version() 보다 낮으면 `_migrate_step()` 을 한 단계씩 적용한다.
## 경로가 없어 단계가 null 을 주거나, 이 빌드보다 높은 버전(다운그레이드)이면 null — 호출자는 "읽지 않고 포기"로 다룬다.
func _migrate(data: Dictionary) -> Variant:
	var target := save_version()
	var version := int(data.get("version", 0))
	while version < target:
		var stepped: Variant = _migrate_step(version, data)
		if stepped == null:
			return null
		data = stepped
		version = int(data.get("version", version + 1))
	if version > target:
		return null
	return data


## from_version 에서 온 data 를 from_version+1 모양으로 바꿔 돌려준다. 등록된 경로가 없으면 null(기본).
func _migrate_step(_from_version: int, _data: Dictionary) -> Variant:
	return null


## G-0035 — 세이브 옮기기(SAGA-BACKLOG P0 #6 최소안). 지금 세이브 파일을 문자열 하나로 — `SAGA1|<판>|<base64(gzip(JSON))>`.
## 다른 기기·PC 에서 import_string 으로 넣는다. 서버 없음. 판 이름이 다르면 안 받는다.
const TRANSFER_HEAD := "SAGA1"

## 세이브 파일이 없으면 "".
func export_string(game_id: String) -> String:
	var parsed: Variant = SafeFileT.read_json(save_path())
	if parsed == null:
		return ""
	var raw := JSON.stringify(parsed).to_utf8_buffer()
	var packed := raw.compress(FileAccess.COMPRESSION_GZIP)
	return "%s|%s|%d|%s" % [TRANSFER_HEAD, game_id, raw.size(), Marshalls.raw_to_base64(packed)]

## 문자열을 세이브 파일로 쓴다(지금 파일은 <경로>.before_import 로 남긴다). 성공이면 "", 아니면 사람이 읽을 이유.
## 쓰기 전에 판 이름·압축·JSON·버전 맞추기(_migrate)를 다 통과해야 한다 — 하나라도 틀리면 지금 세이브를 안 건드린다.
func import_string(text: String, game_id: String) -> String:
	var parts := text.strip_edges().split("|")
	if parts.size() != 4 or parts[0] != TRANSFER_HEAD:
		return "세이브 문자열이 아니다"
	if parts[1] != game_id:
		return "다른 게임의 세이브다 (%s)" % parts[1]
	var packed := Marshalls.base64_to_raw(parts[3])
	if packed.is_empty():
		return "문자열이 깨졌다"
	var raw := packed.decompress(int(parts[2]), FileAccess.COMPRESSION_GZIP)
	if raw.size() != int(parts[2]):
		return "문자열이 깨졌다"
	var parsed: Variant = JSON.parse_string(raw.get_string_from_utf8())
	if not parsed is Dictionary:
		return "세이브 내용을 읽을 수 없다"
	if _migrate((parsed as Dictionary).duplicate(true)) == null:
		return "이 판보다 새 버전이거나 옮길 수 없는 세이브다"
	var path := save_path()
	if FileAccess.file_exists(path):   # .bak 은 다음 자동 저장 때 덮이니, 불러오기 직전 세이브는 따로 남긴다(되돌리기용)
		DirAccess.copy_absolute(ProjectSettings.globalize_path(path), ProjectSettings.globalize_path(path + ".before_import"))
	if not SafeFileT.write_text(path, JSON.stringify(parsed)):
		return "파일을 쓰지 못했다"
	return ""
