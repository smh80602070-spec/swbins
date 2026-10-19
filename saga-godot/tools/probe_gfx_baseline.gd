extends SceneTree

## G-0249 그래픽 기준선 자동 점검(다섯 판) — 웹 pw-gfx 와 짝. 헤드리스(더미 렌더러)라 "그려진 것"은 못 보고 노드·재질 값만 본다(그림은 shot_baseline 컷 비교).
##   godot --headless --path saga-godot --script res://tools/probe_gfx_baseline.gd [-- res://<씬>.tscn …]
## 씬 인자가 없으면 godot_regress.sh 의 다섯 대표 씬을 차례로. 씬마다 싣고 SETTLE 프레임 뒤:
## ① WorldEnvironment env glow·adjustment·tonemap ACES(3)·SSAO(성능 모드면 건너뜀) ② 그림자 켠 DirectionalLight3D ≥1(2나락은 횃불 OmniLight 그림자로 대신)
## ③ cel_applied meta 몸 ≥1(vroid_body 툰) ④ 하늘 셰이더 sky_real(2나락·동굴/미궁 씬 제외 — environment_profile 과 같은 표)
## 씬마다 "GFX <판> ok|FAIL <틀린 칸>", 끝에 "PROBE gfx_baseline OK" 또는 "PROBE gfx_baseline FAIL n".
## 성능 모드 설정 파일(user://graphics.cfg)이 남아 있으면 SSAO 가 꺼져 거짓 FAIL — 설정 경로를 없는 임시 파일로 돌려 화질로 본다(probe_graphics 와 같은 식, 파일은 안 만든다).
## 점검만 한다 — env_*.tres·씬 값은 안 바꾼다. 어긋나면 FAIL 로 보고, 고치는 건 다음 티켓.

const Gfx := preload("res://saga_core/data/graphics_settings.gd")
const SETTLE := 20
const DEFAULT_SCENES := {
	"GO": "res://games/saga_go/world/TestVillage.tscn",
	"DUNGEON": "res://games/saga_dungeon/world/TestRoom.tscn",
	"FOREST": "res://games/saga_forest/world/TestVillageForest.tscn",
	"STORY": "res://games/saga_story/world/SinyaField.tscn",
	"REALM": "res://games/saga_realm/world/TestCity.tscn",
}
const DUNGEON_PREFIX := "res://games/saga_dungeon/"   # check_refs:allow — 경로 판별 문자열

var fails := 0


func _label(path: String) -> String:
	for k in DEFAULT_SCENES:
		if DEFAULT_SCENES[k] == path:
			return k
	return path.get_file().get_basename()


## environment_profile._pick_environment 과 같은 표: 나락 방은 하늘 없음, 종횡 동굴·미궁도 없음.
func _expects_sky(path: String) -> bool:
	if path.begins_with(DUNGEON_PREFIX):
		return false
	if path.begins_with("res://games/saga_story/"):   # check_refs:allow
		return not (path.contains("Cave") or path.contains("Labyrinth"))
	return true


func _check_scene(path: String) -> void:
	var label := _label(path)
	var ps := load(path) as PackedScene
	if ps == null:
		fails += 1
		print("GFX %s FAIL 씬 못 읽음 %s" % [label, path])
		return
	var scene := ps.instantiate()
	root.add_child(scene)
	current_scene = scene
	for _i in SETTLE:
		await process_frame
	var bad: Array[String] = []
	var info: Array[String] = []
	# ① 후처리
	var env: Environment = null
	for we in scene.find_children("*", "WorldEnvironment", true, false):
		if (we as WorldEnvironment).environment != null:
			env = (we as WorldEnvironment).environment
			break
	if env == null:
		bad.append("env 없음")
	else:
		if not env.glow_enabled:
			bad.append("glow")
		if not env.adjustment_enabled:
			bad.append("adjustment")
		if env.tonemap_mode != Environment.TONE_MAPPER_ACES:
			bad.append("tonemap=%d" % env.tonemap_mode)
		if Gfx.mode() == Gfx.PERFORMANCE:
			info.append("ssao 건너뜀(성능)")
		elif not env.ssao_enabled:
			bad.append("ssao")
	# ② 그림자
	var dir_shadow := 0
	var omni_shadow := 0
	for l in scene.find_children("*", "Light3D", true, false):
		var lt := l as Light3D
		if not lt.shadow_enabled:
			continue
		if lt is DirectionalLight3D:
			dir_shadow += 1
		elif lt is OmniLight3D or lt is SpotLight3D:
			omni_shadow += 1
	info.append("해 그림자 %d·등 그림자 %d" % [dir_shadow, omni_shadow])
	if path.begins_with(DUNGEON_PREFIX):
		if dir_shadow + omni_shadow < 1:
			bad.append("그림자(횃불)")
	elif dir_shadow < 1:
		bad.append("해 그림자")
	# ③ 툰 몸
	var cel := 0
	for n in scene.find_children("*", "Node3D", true, false):
		if n.has_meta("cel_applied"):
			cel += 1
	info.append("툰 몸 %d" % cel)
	if cel < 1:
		bad.append("cel_applied")
	# ④ 하늘
	var sky_real := false
	if env != null and env.sky != null and env.sky.sky_material is ShaderMaterial:
		var sh := (env.sky.sky_material as ShaderMaterial).shader
		sky_real = sh != null and sh.resource_path.ends_with("sky_real.gdshader")
	if _expects_sky(path):
		if not sky_real:
			bad.append("sky_real")
	else:
		info.append("하늘 예외")
	if bad.is_empty():
		print("GFX %s ok (%s)" % [label, ", ".join(info)])
	else:
		fails += bad.size()
		print("GFX %s FAIL %s (%s)" % [label, " ".join(bad), ", ".join(info)])
	scene.queue_free()
	await process_frame
	await process_frame


func _initialize() -> void:
	create_timer(290.0).timeout.connect(func() -> void:
		print("PROBE gfx_baseline FAIL 1 (시간 초과)")
		quit(3))
	var tmp := OS.get_temp_dir().path_join("saga_probe_gfx_baseline_%d.cfg" % OS.get_process_id())
	DirAccess.remove_absolute(tmp)
	Gfx.cfg_path = tmp
	Gfx.forget()
	var scenes: Array = []
	for a in OS.get_cmdline_user_args():
		if a.begins_with("res://"):
			scenes.append(a)
	if scenes.is_empty():
		scenes = DEFAULT_SCENES.values()
	for p in scenes:
		await _check_scene(String(p))
	print("PROBE gfx_baseline OK" if fails == 0 else "PROBE gfx_baseline FAIL %d" % fails)
	quit(0 if fails == 0 else 1)
