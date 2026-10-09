extends RefCounted

## saga-godot 2026-09-29 "그래픽 먼저" — 이야기 지역 건물 상자(각 region*_*.gd·era_sites.gd 의 _box)가 쓰는 공용 재질.
## 10-09 G-0144 "배경 전부 사실" — prop_toon(돌 결·검은 모서리 선·띠 명암) → saga_core/shaders/prop_real.gdshader(재질별 PBR).
## 재질 종류는 색(tint)으로 고른다(kind_for 표) — 색 표는 그대로 두고 색이 곧 재질 이름표.
## 같은 색은 재질 하나를 나눠 쓴다(색마다 캐시, 종류도 색에서 나오니 그리기 수 그대로) — 상자 크기는 MeshInstance 마다 instance uniform.
## 발광·유리·금속처럼 재질을 뒤에서 고쳐 쓰는 부품은 각 지역의 _mat()/_glow()/_glass() 를 그대로 쓴다.

const SHADER := preload("res://saga_core/shaders/prop_real.gdshader")
## 사진 PBR 세트(자체툴 K, tiles_real/)가 오면 재질 종류별로 갈아끼운다 — 그 전엔 돌 512 한 벌.
const DETAIL := preload("res://assets/generated/tiles/stone_512.png")
const DETAIL_N := preload("res://assets/generated/tiles/stone_512_n.png")

enum Kind { STONE, WOOD, PLASTER, PAINT, METAL }

static var _cache := {}

## 색 → 재질 종류. 회색=돌, 갈색(어두운 주황 계열)=나무, 희고 밝은=회벽, 짙은 무채색·살짝 푸른 무채색=쇠(푸른 빛 도는 돌은 돌), 진한 색=칠한 판.
static func kind_for(c: Color) -> int:
	var h := c.h * 360.0
	if c.v > 0.8 and c.s < 0.3:
		return Kind.PLASTER
	if c.s < 0.14:
		## 푸른 기만으론 STEEL(0.7,0.72,0.74)·STONE_DARK(0.36,0.38,0.4)가 같아(b−r 0.04) 밝기로 가른다 — 어두운 청회색은 돌(서리봉 문 들보가 쇠 광택이던 것).
		var blue := c.b - c.r
		if c.v < 0.3 or blue > 0.055 or (blue > 0.035 and c.v > 0.45):
			return Kind.METAL
		return Kind.STONE
	if h >= 15.0 and h <= 50.0 and c.s >= 0.25 and c.v < 0.6:
		return Kind.WOOD
	if c.s >= 0.4:
		return Kind.PAINT
	return Kind.STONE

static func for_color(c: Color) -> ShaderMaterial:
	var key := c.to_html(true)
	if _cache.has(key):
		return _cache[key]
	var m := ShaderMaterial.new()
	m.shader = SHADER
	m.set_shader_parameter("tint", c)
	m.set_shader_parameter("material_kind", kind_for(c))
	m.set_shader_parameter("detail_tex", DETAIL)
	m.set_shader_parameter("detail_normal", DETAIL_N)
	_cache[key] = m
	return m

## 상자 하나에 입힌다(모서리 닳음·때 자리를 위해 크기를 넘긴다).
static func apply_box(mi: MeshInstance3D, size: Vector3, c: Color) -> void:
	mi.material_override = for_color(c)
	mi.set_instance_shader_parameter("box_half", size * 0.5)
