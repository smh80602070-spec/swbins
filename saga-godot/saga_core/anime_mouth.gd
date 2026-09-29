extends RefCounted

## 2026-09-29 공방(CC0) 사람 몸의 입 — 블렌드셰이프가 없고 입술이 살갗 텍스처에 그려져 있다(다물린 한 모양).
## 말할 때(talk_face) 입 모양을 못 바꾸던 자리에, 살갗 텍스처 복사본의 입 자리에 벌린 입을 덧그려 갈아 끼운다.
##   종류: open(ㅏㅔ — 크게 벌림·윗니·혀) · round(ㅗㅜ — 작고 동그란) · thin(ㅣ — 가로로 얇게 이를 드러냄)
## 머리 UV 배치는 Quaternius 몸 두 갈래(Superhero_Female / Superhero_Male)가 각각 같다 — 텍스처 파일 이름으로 가른다.
## 입술 가운데 선(입꼬리 이음선)의 UV 는 정점에서 쟀다(2048² 기준 여자 (0.1838, 0.2619)·남자 (0.1860, 0.2677)).

const KINDS := ["open", "round", "thin"]
const CENTER_FEMALE := Vector2(0.1838, 0.2622)
const CENTER_MALE := Vector2(0.1860, 0.2677)

static var _cache: Dictionary = {}

## 살갗 텍스처 파일 이름으로 입 자리(UV)를 돌려준다 — 이 배치가 아니면 Vector2(-1, -1).
static func center_for(tex_path: String) -> Vector2:
	var p := tex_path.to_lower()
	if p.contains("superhero_female"):
		return CENTER_FEMALE
	if p.contains("superhero_male"):
		return CENTER_MALE
	return Vector2(-1.0, -1.0)

## base 살갗 텍스처에 kind 입을 덧그린 복사본. 같은 (base, kind) 는 캐시. 세 종류를 한 번에 만든다(원본 읽기를 한 번만).
static func textures_for(base: Texture2D, center_uv: Vector2) -> Dictionary:
	var key := "%d_%s" % [base.get_rid().get_id(), str(center_uv)]
	if _cache.has(key):
		return _cache[key]
	var src := base.get_image()
	if src == null:
		return {}
	if src.is_compressed():
		src.decompress()
	src.convert(Image.FORMAT_RGBA8)
	var out := {}
	for kind in KINDS:
		var img := src.duplicate() as Image
		_paint(img, Vector2(center_uv.x * img.get_width(), center_uv.y * img.get_height()), kind)
		img.generate_mipmaps()
		out[kind] = ImageTexture.create_from_image(img)
	_cache[key] = out
	return out

static func _paint(img: Image, c: Vector2, kind: String) -> void:
	var scale := img.get_width() / 2048.0
	var upper := img.get_pixel(int(c.x), int(c.y - 12.0 * scale))
	var lower := img.get_pixel(int(c.x), int(c.y + 12.0 * scale))
	var rim := upper.lerp(lower, 0.5).darkened(0.45)
	var inner := Color(0.24, 0.04, 0.06)
	var deep := Color(0.13, 0.02, 0.04)
	var tongue := Color(0.78, 0.30, 0.34)
	var teeth := Color(0.95, 0.93, 0.9)
	var rx := 30.0
	var ry := 19.0
	match kind:
		"round":
			rx = 15.0
			ry = 17.0
		"thin":
			rx = 33.0
			ry = 8.0
	rx *= scale
	ry *= scale
	var pad := int(ceil(6.0 * scale))
	for y in range(int(c.y - ry) - pad, int(c.y + ry) + pad + 1):
		for x in range(int(c.x - rx) - pad, int(c.x + rx) + pad + 1):
			if x < 0 or y < 0 or x >= img.get_width() or y >= img.get_height():
				continue
			var d := Vector2((x + 0.5 - c.x) / rx, (y + 0.5 - c.y) / ry)
			var r := d.length()
			if r > 1.0 + 6.0 * scale / minf(rx, ry):
				continue
			var px := img.get_pixel(x, y)
			## 바깥 테두리(입술 안쪽 그늘)로 살갗과 이어지기.
			var rim_a := 1.0 - smoothstep(1.0, 1.0 + 5.0 * scale / minf(rx, ry), r)
			px = px.lerp(rim, rim_a)
			var in_a := 1.0 - smoothstep(0.86, 0.96, r)
			if in_a <= 0.0:
				img.set_pixel(x, y, px)
				continue
			var col := inner.lerp(deep, smoothstep(-0.2, 0.9, r))
			if kind != "round":
				## 윗니 — 입 위쪽 띠.
				var t := smoothstep(-0.78, -0.5, d.y) * (1.0 - smoothstep(-0.2, 0.0, d.y))
				col = col.lerp(teeth, t * (1.0 - smoothstep(0.55, 0.9, absf(d.x))))
			if kind == "open":
				## 혀 — 입 아래쪽.
				col = col.lerp(tongue, smoothstep(0.15, 0.5, d.y) * (1.0 - smoothstep(0.65, 0.95, r)) * (1.0 - smoothstep(0.5, 0.9, absf(d.x))))
			img.set_pixel(x, y, px.lerp(col, in_a))
