## 무기·재료·소모품·성유물 세트 → 아이콘 그림(K-0035). 자동 생성 — 손으로 고치지 않는다.
## 만든 도구: tools/gen_item_icons.mjs (정본 assets/icons/map.json). 값 = [그림 키, 등급(틀 0~4)].
## 그림 파일: res://assets/icons/icon128/<키>_g<등급>.png (등급 틀이 합성된 128px). 표에 없거나 파일이 없으면 null — 화면은 글자만 보인다.
extends RefCounted

const DIR := "res://assets/icons/icon128/"

const WEAPON := {
	"w_sword_0": ["gw_sword_0", 0],
	"w_claymore_0": ["gw_claymore_0", 0],
	"w_polearm_0": ["gw_polearm_0", 0],
	"w_catalyst_0": ["gw_catalyst_0", 0],
	"w_bow_0": ["gw_bow_0", 0],
	"w_sword_3": ["gw_sword_3", 1],
	"w_claymore_3": ["gw_claymore_3", 1],
	"w_polearm_3": ["gw_polearm_3", 1],
	"w_catalyst_3": ["gw_catalyst_3", 1],
	"w_bow_3": ["gw_bow_3", 1],
	"w_sword_4": ["gw_sword_4", 2],
	"w_claymore_4": ["gw_claymore_4", 2],
	"w_polearm_4": ["gw_polearm_4", 2],
	"w_catalyst_4": ["gw_catalyst_4", 2],
	"w_bow_4": ["gw_bow_4", 2],
	"w_polearm_catch": ["gw_polearm_catch", 2],
}

const MATERIAL := {
	"mint": ["mint", 0],
	"honey_flower": ["honey_flower", 0],
	"apple": ["go_apple", 0],
	"mushroom": ["mushroom", 0],
	"clam": ["clam", 0],
	"orchid": ["go_orchid", 0],
	"conch": ["conch", 0],
	"ash_flower": ["ash_flower", 0],
	"snow_bloom": ["snow_bloom", 0],
	"meat": ["meat", 0],
}

const CONSUMABLE := {
	"scroll": ["go_scroll", 0],
	"feed": ["feed", 0],
	"shard": ["shard", 0],
	"seal": ["seal", 0],
	"treat": ["treat", 0],
	"incense": ["incense", 0],
	"prayer": ["prayer", 0],
}

const ARTIFACT_SET := {
	"gladiator": ["af_gladiator", 3],
	"crimson": ["af_crimson", 3],
	"viridescent": ["af_viridescent", 3],
	"emblem": ["af_emblem", 3],
	"depth": ["af_depth", 3],
}

static var _cache: Dictionary = {}


static func _entry(kind: String, id: String) -> Array:
	var t: Dictionary
	match kind:
		"weapon": t = WEAPON
		"material": t = MATERIAL
		"consumable": t = CONSUMABLE
		"artifact_set": t = ARTIFACT_SET
		_: return []
	return t.get(id, []) as Array


## 아이콘 한 장(없으면 null). kind = weapon·material·consumable·artifact_set.
static func icon_for(kind: String, id: String) -> Texture2D:
	var e := _entry(kind, id)
	if e.is_empty():
		return null
	var path := "%s%s_g%d.png" % [DIR, String(e[0]), int(e[1])]
	if _cache.has(path):
		return _cache[path]
	var tex: Texture2D = load(path) as Texture2D if ResourceLoader.exists(path) else null
	_cache[path] = tex
	return tex


## 화면에 붙일 TextureRect(px 정사각). 아이콘이 없으면 null.
static func make_rect(kind: String, id: String, px: int) -> TextureRect:
	var tex := icon_for(kind, id)
	if tex == null:
		return null
	var r := TextureRect.new()
	r.texture = tex
	r.custom_minimum_size = Vector2(px, px)
	r.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	r.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	r.mouse_filter = Control.MOUSE_FILTER_IGNORE
	return r


## 빈 TextureRect(px 정사각, 숨김) — 화면을 만들 때 자리만 잡고 _refresh 에서 apply 로 채운다.
static func blank_rect(px: int) -> TextureRect:
	var r := TextureRect.new()
	r.custom_minimum_size = Vector2(px, px)
	r.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	r.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	r.mouse_filter = Control.MOUSE_FILTER_IGNORE
	r.visible = false
	return r


## 이미 만든 TextureRect 의 그림을 바꾼다 — 없으면 숨긴다(자리는 비움).
static func apply(rect: TextureRect, kind: String, id: String) -> void:
	if rect == null:
		return
	var tex := icon_for(kind, id)
	rect.texture = tex
	rect.visible = tex != null
