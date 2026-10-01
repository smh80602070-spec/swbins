extends RefCounted

## 의상 착용 교체 — 얼굴·몸은 그대로, 옷(상의·하의·신발)의 바탕색 질감만 아이템에 따라 바꾼다.
## 설계 정본 tools/char-forge/COSTUME-SYSTEM.md (§1 층 세 겹, §8 VRM 방식). 아이템 표·질감은
## tools/char-forge/make_wardrobe_textures.py 가 만든 것을 assets/wardrobe/<몸>/ 에 둔 사본이다.
##
## 층: 장비(gear, 능력치) 위에 캐시 의상(cosmetic, 외형만)이 덮인다 → 보이는 옷 = 캐시 ?? 장비 ?? 원래 옷.
## 세이브는 look_to_dict/look_from_dict 꼴({"gear": {슬롯: id}, "cosmetic": {슬롯: id}})로 새 키 하나에 담는다(기존 키 안 건드림).
## 옷 모양(메시)은 그대로고 질감만 바꾸므로 같은 VRoid 몸(base)의 아이템끼리만 쓴다.

const ROOT := "res://assets/wardrobe/"
const SLOT_KEYS := {"top": "tops", "bottom": "bottoms", "shoes": "shoes"} # VRoid 재질 이름(…_Tops_01_CLOTH)에 들어 있는 글자
const SLOTS := ["top", "bottom", "shoes"]

const PATTERN_DIR := "res://assets/wardrobe/patterns/"
const ERAS := ["past", "modern", "future", "crest"] # 무늬 시대 — 20/20/20/4 (patterns.json)

static var _cache: Dictionary = {} # base → {id: item}
static var _patterns: Dictionary = {} # 무늬 id → {era, file, …} (patterns.json, G-0013)

## 무늬 타일 64종 표 — patterns/patterns.json 을 읽는다(K-0006). 없으면 빈 표(옷은 지금 그대로).
static func patterns() -> Dictionary:
	if not _patterns.is_empty():
		return _patterns
	var path := PATTERN_DIR + "patterns.json"
	if FileAccess.file_exists(path):
		var parsed = JSON.parse_string(FileAccess.get_file_as_string(path))
		if parsed is Dictionary:
			for p in parsed.get("patterns", []):
				_patterns[String(p.id)] = p
	return _patterns

## 시대(past·modern·future·crest)의 무늬 id 목록, id 순.
static func patterns_for_era(era: String) -> Array:
	var r: Array = []
	for id in patterns():
		if String(patterns()[id].get("era", "")) == era:
			r.append(String(id))
	r.sort()
	return r

## 시대 안에서 seed_key(예: 인물 id)로 늘 같은 무늬 하나를 고른다. 시대에 무늬가 없으면 "".
static func pick_pattern(era: String, seed_key: String) -> String:
	var list := patterns_for_era(era)
	return "" if list.is_empty() else String(list[absi(seed_key.hash()) % list.size()])

static func pattern_texture(pattern_id: String) -> Texture2D:
	var p: Dictionary = patterns().get(pattern_id, {})
	if p.is_empty():
		return null
	var path := PATTERN_DIR + String(p.get("file", ""))
	return load(path) as Texture2D if ResourceLoader.exists(path) else null

## base = "AvatarSample_A" 처럼 assets/wardrobe/ 아래 폴더 이름.
static func items(base: String) -> Dictionary:
	if _cache.has(base):
		return _cache[base]
	var out := {}
	var path := ROOT + base + "/items.json"
	if FileAccess.file_exists(path):
		var parsed = JSON.parse_string(FileAccess.get_file_as_string(path))
		if parsed is Dictionary:
			for it in parsed.get("items", []):
				out[String(it.id)] = it
	_cache[base] = out
	return out

static func items_for_slot(base: String, slot: String) -> Array:
	var r: Array = []
	for it in items(base).values():
		if it.slot == slot:
			r.append(it)
	r.sort_custom(func(a, b): return String(a.id) < String(b.id))
	return r

## 보이는 옷: 슬롯마다 캐시 ?? 장비. 값이 없는 슬롯은 결과에서 빠진다(=원래 옷 그대로).
static func visible_look(gear: Dictionary, cosmetic: Dictionary) -> Dictionary:
	var look := {}
	for s in SLOTS:
		var id = cosmetic.get(s, "")
		if id == "" or id == null:
			id = gear.get(s, "")
		if id != "" and id != null:
			look[s] = String(id)
	return look

static func texture_of(base: String, item_id: String) -> Texture2D:
	var it: Dictionary = items(base).get(item_id, {})
	if it.is_empty():
		return null
	var path := "%s%s/%s/%s.webp" % [ROOT, base, it.slot, it.pattern]
	if ResourceLoader.exists(path):
		return load(path) as Texture2D
	return pattern_texture(String(it.pattern)) # 슬롯별 사본이 없는 무늬는 공용 타일을 쓴다

## 몸(Node3D, 셀 셰이더가 이미 입혀진 것)에 look({슬롯: 아이템 id}) 을 입힌다. 바뀐 표면 수를 돌려준다.
## look 에 없는 슬롯은 건드리지 않는다(원래 옷 유지). 재질은 표면마다 새로 만든 것이라 다른 몸에 번지지 않는다.
static func apply(body: Node, base: String, look: Dictionary) -> int:
	var texs := {}
	for slot in look:
		var t := texture_of(base, look[slot])
		if t != null:
			texs[slot] = t
	return _paint(body, texs)

## 같은 일을 무늬 id 로 — {슬롯: 무늬 id} 를 옷 슬롯에 입힌다(아이템 표 없이, 시대별 무늬 고르기용).
static func apply_patterns(body: Node, slot_patterns: Dictionary) -> int:
	var texs := {}
	for slot in slot_patterns:
		var t := pattern_texture(String(slot_patterns[slot]))
		if t != null:
			texs[slot] = t
	return _paint(body, texs)

static func _paint(body: Node, texs: Dictionary) -> int:
	var changed := 0
	for mi in body.find_children("*", "MeshInstance3D", true, false):
		var m := mi as MeshInstance3D
		if m.mesh == null:
			continue
		for si in m.mesh.get_surface_count():
			var src := m.mesh.surface_get_material(si)
			var nm := (src.resource_name if src else "").to_lower()
			for slot in texs:
				if not SLOT_KEYS.has(slot) or not nm.contains(SLOT_KEYS[slot]):
					continue
				var tex: Texture2D = texs[slot]
				var mat := m.get_active_material(si)
				if mat is ShaderMaterial:
					(mat as ShaderMaterial).set_shader_parameter("albedo_texture", tex)
					changed += 1
				elif mat is BaseMaterial3D:
					(mat as BaseMaterial3D).albedo_texture = tex
					changed += 1
	return changed

static func look_to_dict(gear: Dictionary, cosmetic: Dictionary) -> Dictionary:
	return {"gear": gear.duplicate(), "cosmetic": cosmetic.duplicate()}

static func look_from_dict(d: Variant) -> Dictionary:
	var out := {"gear": {}, "cosmetic": {}}
	if d is Dictionary:
		for k in ["gear", "cosmetic"]:
			var v = (d as Dictionary).get(k, {})
			if v is Dictionary:
				for s in SLOTS:
					if v.has(s):
						out[k][s] = String(v[s])
	return out
