extends RefCounted

## G-0252 — 2나락 방·문·통로 GLB(K-0063 dungeon_*_<mood>.glb, license.json 자체 굽기)의 굽은 toon jpg 표면을
## 자체 PBR(tiles_real 법선·거칠기·높이)로 바꾼다. 원본 재질 resource_name 으로 세트를 고르고(".001" 꼬리 뗌),
## 빛깔은 원본 toon 그림 평균에 맞춘다(photo_color 0 · gain = 원본 평균 / 세트 평균, 선형) — G-0224 어둠·mood 색(흙·석회·용암)이
## 그대로 남고 결·법선만 횃불에 읽힌다. 표 밖 재질은 원본 그대로(용암 방 white_stucco 는 이름과 달리 빛나는 용암 줄 — 회반죽으로
## 바꾸면 용암이 하얘진다). SAGA_DUNGEON_OLD=1 이면 아무것도 안 바꾼다(환경 G-0224 과 같은 손잡이).
## 재질은 (mood, 원본 재질 이름)마다 하나를 만들어 방·문·통로가 공유한다(_cache). 매 틱 셈 없음 — 세울 때 한 번.

const WorldCurveMaterial := preload("res://saga_core/world/world_curve_material.gd")

const OLD_ENV := "SAGA_DUNGEON_OLD"
## 원본 재질 이름 → tiles_real 세트. cliff_side·castle_wall_slates 는 지금 glb 에 없지만 티켓 표대로 둔다(K 가 갈아도 맞물리게).
const SET_OF := {
	"brown_mud": "mud_gravel",   # G-0404 K-0193 흙·자갈 섞음(임포트 안 된 PC 는 set_for 가 dirt)
	"coast_sand_rocks_02": "rock",
	"cliff_side": "rock",
	"concrete_wall_001": "concrete",
	"castle_wall_slates": "stonewall",
}
## 세트 _hi 그림 평균(sRGB, 1×1 축소로 잰 값 10-20).
const SET_AVG := {
	"dirt": Color("644a35"), "mud_gravel": Color("67513b"), "rock": Color("7b7979"), "concrete": Color("b9bcb9"), "stonewall": Color("afb1b3"),
}
## 원본 toon 그림 평균(sRGB) — "mood/재질 이름". 같은 mood 의 방·문·통로는 같은 그림 결이라 값이 같다(10-20 실측).
const ORIG_AVG := {
	"dirt/brown_mud": Color("24190b"),
	"dirt/coast_sand_rocks_02": Color("271d0a"),
	"limestone/coast_sand_rocks_02": Color("372f13"),
	"limestone/coast_sand_rocks_02.001": Color("3a3311"),
	"lava/concrete_wall_001": Color("141611"),
	"lava/coast_sand_rocks_02": Color("130f06"),
}

static var _cache := {}
static var _two_sided: Shader = null


## 원본 glb 재질은 cull 끔(양면) — 벽 일부 면이 안쪽을 등지고 있어 cull_back 이면 그 칸이 뚫려 바둑판 검은 칸(10-20 촬영).
## 공용 셰이더 파일을 늘리지 않고 같은 코드에서 render_mode 만 바꾼 변종을 한 번 만든다(3마을은 원래 셰이더 그대로).
static func two_sided_shader() -> Shader:
	if _two_sided == null:
		_two_sided = Shader.new()
		_two_sided.code = cutaway_code(WorldCurveMaterial.TRIPLANAR_SHADER.code.replace("cull_back", "cull_disabled"))
	return _two_sided


## G-0378 앞벽 걷어내기 — 양면 변종에 uniform 셋과 fragment 첫 줄 discard 를 끼운다(cut_on 0 이면 옛 그림). 값은 dungeon_cutaway.gd 가 매 프레임.
## 카메라→주인공 가로 선분에서 CUT_R 안 · 주인공보다 카메라 쪽(t > CUT_T0) · 바닥 위(y > CUT_Y).
const CUT_R := 4.0
const CUT_T0 := 0.08
const CUT_Y := 0.35


static func cutaway_code(code: String) -> String:
	var uni := "uniform float cut_on = 0.0;\nuniform vec3 cut_cam = vec3(0.0);\nuniform vec3 cut_player = vec3(0.0);\n"
	var body := "\tif (cut_on > 0.5 && world_pos.y > %.2f) {\n\t\tvec2 ca = cut_player.xz;\n\t\tvec2 cab = cut_cam.xz - ca;\n\t\tfloat ct = clamp(dot(world_pos.xz - ca, cab) / max(dot(cab, cab), 0.0001), 0.0, 1.0);\n\t\tif (ct > %.2f && length(world_pos.xz - (ca + cab * ct)) < %.2f) { discard; }\n\t}\n" % [CUT_Y, CUT_T0, CUT_R]
	return code.replace("varying vec3 world_pos;", uni + "varying vec3 world_pos;").replace("void fragment() {", "void fragment() {\n" + body)


## 지금까지 만든 PBR 재질들(앞벽 걷어내기가 값을 맞춘다).
static func materials() -> Array:
	return _cache.values()


static func enabled() -> bool:
	return OS.get_environment(OLD_ENV) == "" and ResourceLoader.exists(WorldCurveMaterial.REAL_DIR + "rock_hi.webp")


static func set_for(mat_name: String) -> String:
	var base := mat_name
	var dot := base.rfind(".")
	if dot > 0 and base.substr(dot + 1).is_valid_int():
		base = base.substr(0, dot)
	var s := String(SET_OF.get(base, ""))
	if s == "mud_gravel" and not ResourceLoader.exists(WorldCurveMaterial.REAL_DIR + s + "_hi.webp"):
		s = "dirt"
	return s


## mi 의 표면마다 표에 있는 재질이면 surface override 로 PBR 재질을 꽂는다. 바꾼 표면 수를 돌려준다.
static func apply(mi: MeshInstance3D, mood: String) -> int:
	if mi == null or mi.mesh == null or not enabled():
		return 0
	var n := 0
	for i in mi.mesh.get_surface_count():
		var orig := mi.mesh.surface_get_material(i)
		if orig == null:
			continue
		var set_name := set_for(orig.resource_name)
		if set_name == "":
			continue
		mi.set_surface_override_material(i, material(mood, orig.resource_name, set_name))
		n += 1
	return n


static func material(mood: String, mat_name: String, set_name: String) -> ShaderMaterial:
	var key := "%s/%s" % [mood, mat_name]
	if _cache.has(key):
		return _cache[key]
	var m := WorldCurveMaterial.triplanar_material(0.0, {"grass": set_name, "dirt": set_name, "stone": set_name}, OLD_ENV, 0.0)
	m.shader = two_sided_shader()
	var g := Vector3.ONE
	if ORIG_AVG.has(key) and SET_AVG.has(set_name):
		var o: Color = (ORIG_AVG[key] as Color).srgb_to_linear()
		var s: Color = (SET_AVG[set_name] as Color).srgb_to_linear()
		g = Vector3(o.r / maxf(s.r, 0.001), o.g / maxf(s.g, 0.001), o.b / maxf(s.b, 0.001))
	for k: String in ["grass", "dirt", "stone"]:
		m.set_shader_parameter(k + "_gain", g)
	m.set_shader_parameter("photo_color", 0.0)
	m.set_shader_parameter("world_space_normal", 1.0)   # glb 접선이 칸마다 뒤집혀 접선 공간 법선은 바둑판 검은 칸(10-20 촬영)
	_cache[key] = m
	return m
