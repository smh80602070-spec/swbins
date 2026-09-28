extends RefCounted

## saga-godot 2026-09-29 "그래픽 먼저" — 이야기 지역 건물 상자(각 region*_*.gd·era_sites.gd 의 _box)가 쓰는 공용 재질.
## 무늬 없는 한 빛 StandardMaterial3D 대신 saga_core/shaders/prop_toon.gdshader(돌 결·모서리 선·아래 그늘·띠 명암).
## 같은 색은 재질 하나를 나눠 쓴다(색마다 캐시) — 상자 크기(모서리 선 자리)는 MeshInstance 마다 instance uniform.
## 발광·유리·금속처럼 재질을 뒤에서 고쳐 쓰는 부품은 각 지역의 _mat()/_glow()/_glass() 를 그대로 쓴다.

const SHADER := preload("res://saga_core/shaders/prop_toon.gdshader")
const DETAIL := preload("res://assets/generated/tiles/stone_512.png")

static var _cache := {}

static func for_color(c: Color) -> ShaderMaterial:
	var key := c.to_html(true)
	if _cache.has(key):
		return _cache[key]
	var m := ShaderMaterial.new()
	m.shader = SHADER
	m.set_shader_parameter("tint", c)
	m.set_shader_parameter("detail_tex", DETAIL)
	_cache[key] = m
	return m

## 상자 하나에 입힌다(모서리 선 자리를 위해 크기를 넘긴다).
static func apply_box(mi: MeshInstance3D, size: Vector3, c: Color) -> void:
	mi.material_override = for_color(c)
	mi.set_instance_shader_parameter("box_half", size * 0.5)
