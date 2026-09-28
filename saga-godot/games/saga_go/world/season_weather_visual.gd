class_name SeasonWeatherVisual
extends Node

## 계절(season.gd)·천후(weather.gd)를 환경 분위기에 살짝 입힌다. 값 자체는
## env_pc.tres/env_mobile.tres에 그대로 두고(66-1장 "게임의 색 톤은 같아야
## 한다" — 두 프로파일의 기준값은 손 안 댐), 실행 시점에 그 기준값에 배수만
## 곱한다.
##
## environment_profile.gd가 environment를 먼저 골라 둬야 하니(TestVillage.tscn
## 에서 WorldEnvironment 다음 형제로 둔다 — 형제는 선언 순서대로 부모보다
## 먼저 ready된다, save_state.gd가 이미 의존하는 것과 같은 순서 규칙),
## 이 노드는 그 형제 뒤에 놓는다.
##
## 값이 바뀌는 주기가 느리므로(날씨 3시간·계절 1달) 매 프레임 계산하지
## 않는다 — Timer로 드문드문만 다시 본다(PLAN 29·30장 "AI 최적화"와 같은 절약).

@export var check_interval_sec: float = 60.0
@export var world_environment_path: NodePath = NodePath("../WorldEnvironment")

var _env: Environment
var _base_fog_density: float
var _base_fog_color: Color
var _base_volumetric_density: float
## 2026-09-28 밤 안개 색 배수 — night_visual.gd 가 넣고 apply() 를 부른다(날씨가 60초마다 안개 색을 다시 써도 밤빛이 남게).
var night_mul := Color(1, 1, 1)


func _ready() -> void:
	var world_env := get_node(world_environment_path) as WorldEnvironment
	if world_env == null or world_env.environment == null:
		return
	_env = world_env.environment
	_base_fog_density = _env.fog_density
	_base_fog_color = _env.fog_light_color
	_base_volumetric_density = _env.volumetric_fog_density
	_apply()
	var t := Timer.new()
	t.wait_time = check_interval_sec
	t.timeout.connect(_apply)
	add_child(t)
	t.start()


func apply() -> void:
	_apply()


func _apply() -> void:
	if _env == null:
		return
	var w: Dictionary = Weather.current()
	var s: Dictionary = Season.current()
	var fog_mul: float = w.get("fog_density_mul", 1.0)
	_env.fog_density = _base_fog_density * fog_mul
	if _env.volumetric_fog_enabled:
		_env.volumetric_fog_density = _base_volumetric_density * fog_mul
	var tint: Color = w.get("tint", Color.WHITE)
	var ambient_mul: Color = s.get("ambient_mul", Color.WHITE)
	_env.fog_light_color = Color(
		_base_fog_color.r * tint.r * ambient_mul.r * night_mul.r,
		_base_fog_color.g * tint.g * ambient_mul.g * night_mul.g,
		_base_fog_color.b * tint.b * ambient_mul.b * night_mul.b,
	)


## 헤드리스 검증·디버그 라벨이 같이 읽는 요약 문자열.
static func summary() -> String:
	var s: Dictionary = Season.current()
	var w: Dictionary = Weather.current()
	return "%s %s · %s %s" % [s["emoji"], s["name"], w["emoji"], w["name"]]
