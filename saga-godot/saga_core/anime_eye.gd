class_name AnimeEye
extends RefCounted

## 2026-09-30 "눈을 원신처럼" — 공방(CC0) 사람 몸의 눈은 실사 그림(작은 갈색 홍채·붉은 눈가)이라 얼굴만 실사로 남았다.
## 몸에 실린 눈 텍스처(256², 눈 하나가 한가운데 — 두 눈이 같은 UV) 위에 셀 화풍 눈을 다시 그린다:
##   커다란 세로 타원 홍채(위는 어둡고 아래는 밝은 그러데이션 + 짙은 테두리) · 큰 동공 · 겹친 하이라이트(큰 것 하나·작은 것 하나·아래 반사 초승달)
##   · 굵은 윗 속눈썹 선(바깥 꼬리는 살짝 올림) · 눈흰자는 위쪽에 눈꺼풀 그늘.
## 눈 주변 피부색(원본 텍스처 바깥)은 그대로 둬 얼굴과 이어진다. 홍채색은 몸마다 하나(같은 색이면 같은 텍스처를 나눠 쓴다).
## 눈 모양은 텍스처가 정한다(눈꺼풀 지오메트리는 없다) — 윤곽은 원본 눈보다 살짝 크게.

const SIZE := 256
const CENTER := Vector2(128.0, 128.0)
## 눈 윤곽(아몬드): 가로 반폭·위/아래 반높이. 안쪽 눈가는 텍스처 왼쪽, 바깥쪽은 오른쪽.
const HALF_W := 96.0
const HALF_UP := 56.0
const HALF_DOWN := 44.0
const IRIS_RX := 42.0
const IRIS_RY := 52.0
const IRIS_OFFSET := Vector2(8.0, 14.0) # 윗눈꺼풀 지오메트리가 텍스처 위쪽을 덮어서 홍채를 아래로 내려야 크게 드러난다

const IRIS_PALETTE := [
	Color(0.36, 0.62, 0.86), # 하늘
	Color(0.85, 0.55, 0.22), # 호박
	Color(0.32, 0.68, 0.45), # 초록
	Color(0.62, 0.36, 0.78), # 보라
	Color(0.9, 0.72, 0.25), # 금빛
	Color(0.30, 0.55, 0.60), # 청록
]

## 몸 파일 이름에 이 글자가 들어 있으면 그 색(주역 — 초록 옷에 맞춘 에메랄드).
const IRIS_BY_BODY := {"cmp_go_01": Color(0.2, 0.78, 0.5)}

static var _cache: Dictionary = {}

## 원본 눈 텍스처 base 위에 iris 색 눈을 그려 돌려준다. 같은 (base, iris) 는 캐시.
static func texture_for(base: Texture2D, iris: Color) -> Texture2D:
	var key := "%d_%s" % [base.get_rid().get_id() if base else 0, iris.to_html(false)]
	if _cache.has(key):
		return _cache[key]
	var img: Image = null
	if base != null:
		img = base.get_image()
	if img == null:
		img = Image.create(SIZE, SIZE, false, Image.FORMAT_RGBA8)
		img.fill(Color(0.8, 0.55, 0.5))
	if img.is_compressed():
		img.decompress()
	img.convert(Image.FORMAT_RGBA8)
	if img.get_width() != SIZE:
		img.resize(SIZE, SIZE, Image.INTERPOLATE_BILINEAR)
	_paint(img, iris)
	img.generate_mipmaps()
	var tex := ImageTexture.create_from_image(img)
	_cache[key] = tex
	return tex

static func iris_for(seed_text: String) -> Color:
	for k in IRIS_BY_BODY:
		if seed_text.contains(k):
			return IRIS_BY_BODY[k]
	var h := 7
	for i in seed_text.length():
		h = (h * 131 + seed_text.unicode_at(i)) & 0x7fffffff
	return IRIS_PALETTE[h % IRIS_PALETTE.size()]

static func _paint(img: Image, iris: Color) -> void:
	## 눈꺼풀 그늘·속눈썹에 쓸 피부 어두운 색: 윤곽 바깥 가장자리 픽셀에서 잰다.
	var skin: Color = (img.get_pixel(20, 128) + img.get_pixel(236, 128) + img.get_pixel(128, 20) + img.get_pixel(128, 236)) * 0.25
	var lash_col := Color(0.09, 0.05, 0.06)
	var lid_shadow := skin.darkened(0.28)
	var white := Color(0.97, 0.96, 0.97)
	var white_shade := Color(0.78, 0.8, 0.9)
	var iris_dark := iris.darkened(0.62)
	var iris_mid := iris
	var iris_light := iris.lightened(0.45)
	var ic := CENTER + IRIS_OFFSET
	for y in SIZE:
		for x in SIZE:
			var p := Vector2(x + 0.5, y + 0.5)
			var d := p - CENTER
			## 아몬드 윤곽 부호 거리(안쪽이 음수, 근사) — 위/아래 반높이가 가로 위치에 따라 줄어든다.
			var t := clampf(absf(d.x) / HALF_W, 0.0, 1.0)
			var shape := pow(1.0 - t * t, 0.75) # 눈가로 갈수록 뾰족하게
			var hh := (HALF_UP if d.y < 0.0 else HALF_DOWN) * shape
			## 바깥 꼬리(오른쪽)는 살짝 위로 올려 치켜뜬 눈매.
			var lift := 11.0 * smoothstep(0.2, 1.0, d.x / HALF_W)
			var dy := d.y + lift
			var edge := (absf(dy) / maxf(hh, 0.001)) if absf(d.x) < HALF_W else 9.0
			var inside := 1.0 - smoothstep(0.94, 1.04, edge)
			var px := img.get_pixel(x, y)
			if inside <= 0.0:
				## 윗 속눈썹 선 — 윤곽 위쪽 가장자리 바로 바깥에 굵게. 아래는 얇게.
				var out_up := smoothstep(0.98, 1.06, edge) * (1.0 - smoothstep(1.3, 1.5, edge))
				var w_up := (1.0 - smoothstep(0.0, 1.0, t * 0.6)) * (1.0 if dy < 0.0 else 0.0)
				var flick := smoothstep(0.55, 1.0, d.x / HALF_W) * (1.0 if dy < 0.0 else 0.0)
				var lash := out_up * (w_up + flick * 0.6)
				px = px.lerp(skin, (1.0 - smoothstep(1.0, 2.1, edge)) * 0.8)   # 원본 눈의 허연 눈가 자국을 피부색으로 덮는다
				px = px.lerp(lid_shadow, smoothstep(1.02, 1.5, edge) * (1.0 - smoothstep(1.5, 1.9, edge)) * 0.22 * (1.0 if dy < 0.0 else 0.0))
				px = px.lerp(lash_col, clampf(lash, 0.0, 1.0))
				img.set_pixel(x, y, px)
				continue
			## 눈흰자 — 위쪽은 눈꺼풀 그늘로 푸르스름하게.
			var col := white.lerp(white_shade, smoothstep(-0.2, -0.95, dy / maxf(hh, 1.0)) * 0.9)
			## 홍채 — 세로 타원 + 아래로 갈수록 밝은 그러데이션.
			var q := p - ic
			var r := Vector2(q.x / IRIS_RX, q.y / IRIS_RY).length()
			var iris_a := 1.0 - smoothstep(0.96, 1.02, r)
			var grad := clampf(q.y / IRIS_RY * 0.5 + 0.5, 0.0, 1.0)
			var ic_col := iris_dark.lerp(iris_mid, smoothstep(0.0, 0.55, grad)).lerp(iris_light, smoothstep(0.55, 1.0, grad) * 0.85)
			## 테두리(림): 가장자리 짙게, 안쪽에 방사 결.
			ic_col = ic_col.lerp(iris_dark, smoothstep(0.78, 1.0, r) * 0.75)
			var ang := atan2(q.y, q.x)
			ic_col = ic_col.lerp(iris_light, (0.5 + 0.5 * sin(ang * 14.0)) * smoothstep(0.3, 0.75, r) * (1.0 - smoothstep(0.75, 0.95, r)) * 0.18)
			## 동공.
			var pr := Vector2(q.x / (IRIS_RX * 0.36), q.y / (IRIS_RY * 0.36)).length()
			ic_col = ic_col.lerp(Color(0.04, 0.03, 0.05), 1.0 - smoothstep(0.85, 1.05, pr))
			col = col.lerp(ic_col, iris_a)
			## 윗눈꺼풀이 홍채 윗부분을 덮는 그늘.
			col = col.lerp(col.darkened(0.55), (1.0 - smoothstep(-0.98, -0.55, dy / maxf(hh, 1.0))) * iris_a * 0.2)
			## 하이라이트 — 큰 것(위 안쪽)·작은 것(아래 바깥)·아래 반사 초승달.
			var h1 := 1.0 - smoothstep(0.85, 1.05, (p - (ic + Vector2(-13.0, -20.0))).length() / 13.0)
			var h2 := 1.0 - smoothstep(0.8, 1.05, (p - (ic + Vector2(14.0, 17.0))).length() / 6.0)
			var crescent := iris_a * smoothstep(0.55, 0.9, grad) * (1.0 - smoothstep(0.9, 1.0, r)) * 0.28
			col = col.lerp(Color(1, 1, 1), clampf(h1 + h2, 0.0, 1.0))
			col = col.lerp(iris_light.lightened(0.5), crescent)
			## 윤곽 안쪽 가장자리 부드럽게 피부와 이어지기.
			px = px.lerp(col, inside)
			img.set_pixel(x, y, px)
