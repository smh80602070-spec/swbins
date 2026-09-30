class_name SagaSaveBase
extends Node

## 다섯 판 세이브 상태(autoload)가 같이 쓰는 마이그레이션 계약 — 판마다 복사해 갖던 `_migrate` 한 벌.
## 각 판은 `extends SagaSaveBase` 하고 자기 상수 SAVE_VERSION·SAVE_PATH 를 `save_version()`·`save_path()` 로 돌려주며,
## 버전 사이 변환은 `_migrate_step()` 만 덮어쓴다(const 는 물려줄 수 없어 가상 함수로 받는다).
## 저장/불러오기 본문(필드 목록)은 판마다 달라 여기 없다. 실제 저장 파일 이름·SAVE_VERSION 값은 각 판이 정한다.


## 이 빌드의 세이브 버전. 판이 덮어쓴다.
func save_version() -> int:
	return 0


## 세이브 파일 경로. 판이 덮어쓴다(GO 는 점검용 path_override 도 본다).
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
