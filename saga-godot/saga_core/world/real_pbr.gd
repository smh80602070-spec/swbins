extends RefCounted

## G-0222 — 자체 PBR 세트(자체툴 K-0093, assets/generated/tiles_real/<세트>_hi*.webp)를 prop_real 재질로 입히는 공용 도우미.
## 판 파일이 서로 참조하지 않도록 saga_core 에 둔다(1만리 prop_material.gd 와 같은 결 — 빛깔은 tint 색, 사진은 밝기 결·법선·거칠기만).
## 재질 종류(kind)는 prop_real.gdshader 표: 0 돌 · 1 나무 · 2 회벽 · 3 칠한 판 · 4 쇠. 같은 (세트, 종류, 색)은 재질 하나를 나눠 쓴다.
## 세트가 놓여 있지 않으면 null — 부르는 쪽이 지금 재질을 그대로 쓴다.

const SHADER := preload("res://saga_core/shaders/prop_real.gdshader")
const DIR := "res://assets/generated/tiles_real/"

static var _cache := {}


static func available(set_name: String) -> bool:
	return ResourceLoader.exists(DIR + set_name + "_hi.webp")


static func material(set_name: String, kind: int, tint: Color, scale := 0.45) -> ShaderMaterial:
	if not available(set_name):
		return null
	var key := "%s|%d|%s|%.3f" % [set_name, kind, tint.to_html(true), scale]
	if _cache.has(key):
		return _cache[key]
	var m := ShaderMaterial.new()
	m.shader = SHADER
	m.set_shader_parameter("tint", tint)
	m.set_shader_parameter("material_kind", kind)
	m.set_shader_parameter("detail_tex", load(DIR + set_name + "_hi.webp"))
	m.set_shader_parameter("detail_normal", load(DIR + set_name + "_hi_n.webp"))
	m.set_shader_parameter("detail_rough", load(DIR + set_name + "_hi_r.webp"))
	m.set_shader_parameter("detail_scale", scale)
	m.set_shader_parameter("real_set", 1.0)
	_cache[key] = m
	return m


## 상자 하나에 입힌다(prop_real 의 모서리 닳음·아래 때 자리를 위해 크기를 넘긴다). 세트가 없으면 false.
static func apply_box(mi: MeshInstance3D, size: Vector3, set_name: String, kind: int, tint: Color, scale := 0.45) -> bool:
	var m := material(set_name, kind, tint, scale)
	if m == null:
		return false
	mi.material_override = m
	mi.set_instance_shader_parameter("box_half", size * 0.5)
	return true
