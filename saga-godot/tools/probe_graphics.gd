extends SceneTree

## G-0054 설정 "화질/성능" 점검 — graphics_settings.gd 를 화면 없이 부른다.
##   godot --headless --path saga-godot --script res://tools/probe_graphics.gd
## ① 파일 없으면 화질, 화질 적용은 기본값(fps 0·배율 1·MSAA 프로젝트 값) ② 성능 → fps 30·배율 0.75·MSAA 끔·환경 SSAO/SSIL/SDFGI 끔
## ③ 파일 왕복(다시 읽어도 성능) ④ 화질로 → 환경 처음 값 되살림 ⑤ 메뉴 창 두 줄·고르면 모드 바뀜 ⑥ 사가고 메뉴 항목 go_graphics
## 설정 파일은 임시 폴더에 쓰고 지운다(user:// 의 graphics.cfg 는 안 만든다). 끝에 "PROBE graphics OK" 또는 실패 줄.

const Gfx := preload("res://saga_core/data/graphics_settings.gd")
const Menu := preload("res://saga_core/ui/graphics_menu.gd")
const HUD_MENU := "res://games/saga_go/world/hud_menu.gd" # 글로만 본다 — 미리 불러오면 오토로드(PartyState)가 없어 컴파일이 깨진다

var fails := 0


func check(cond: bool, msg: String) -> void:
	if not cond:
		fails += 1
		print("  FAIL ", msg)


func _initialize() -> void:
	var tmp := OS.get_temp_dir().path_join("saga_probe_graphics_%d.cfg" % OS.get_process_id())
	DirAccess.remove_absolute(tmp)
	Gfx.cfg_path = tmp
	Gfx.forget()
	var we := WorldEnvironment.new()
	var env := (load("res://assets/environment/env_pc.tres") as Environment).duplicate() as Environment
	we.environment = env
	we.add_to_group(Gfx.GROUP)
	root.add_child(we)
	await process_frame # 그룹·모달은 트리에 든 뒤에 잡힌다
	var msaa_default := int(ProjectSettings.get_setting_with_override("rendering/anti_aliasing/quality/msaa_3d"))

	check(Gfx.mode() == Gfx.QUALITY and Gfx.label() == "화질", "① 파일 없으면 화질 (%s)" % Gfx.mode())
	Gfx.apply(self)
	check(Engine.max_fps == 0 and is_equal_approx(root.scaling_3d_scale, 1.0) and int(root.msaa_3d) == msaa_default and env.ssao_enabled and env.ssil_enabled and env.sdfgi_enabled,
		"① 화질 적용 = 기본값 (fps %d 배율 %.2f msaa %d ssao %s)" % [Engine.max_fps, root.scaling_3d_scale, root.msaa_3d, env.ssao_enabled])

	Gfx.set_mode(Gfx.PERFORMANCE, self)
	check(Engine.max_fps == 30 and is_equal_approx(root.scaling_3d_scale, 0.75) and root.msaa_3d == Viewport.MSAA_DISABLED,
		"② 성능 fps·배율·MSAA (fps %d 배율 %.2f msaa %d)" % [Engine.max_fps, root.scaling_3d_scale, root.msaa_3d])
	check(not env.ssao_enabled and not env.ssil_enabled and not env.sdfgi_enabled, "② 성능 — 환경 SSAO/SSIL/SDFGI 끔")

	Gfx.forget()
	check(FileAccess.file_exists(tmp) and Gfx.mode() == Gfx.PERFORMANCE and Gfx.label() == "성능", "③ 파일 왕복 — 다시 읽어도 성능")

	Gfx.set_mode(Gfx.QUALITY, self)
	check(Engine.max_fps == 0 and is_equal_approx(root.scaling_3d_scale, 1.0) and env.ssao_enabled and env.ssil_enabled and env.sdfgi_enabled, "④ 화질로 — 처음 값 되살림")
	var mob := (load("res://assets/environment/env_mobile.tres") as Environment).duplicate() as Environment
	Gfx.apply_env(mob)
	check(not mob.ssao_enabled and not mob.sdfgi_enabled, "④ 모바일 환경은 화질이어도 처음처럼 꺼진 채")

	var menu := Menu.new()
	root.add_child(menu)
	check(bool(menu.call("open_screen")), "⑤ 메뉴 열림")
	var modal: Node = null
	for n in get_nodes_in_group("ui_modal"):
		modal = n
	var btns: Array = modal.find_children("*", "Button", true, false) if modal != null else []
	check(btns.size() == 2, "⑤ 메뉴 두 줄 (%d)" % btns.size())
	if btns.size() == 2:
		(btns[1] as Button).pressed.emit()
		check(Gfx.mode() == Gfx.PERFORMANCE, "⑤ 두 번째 줄 → 성능")
		Gfx.set_mode(Gfx.QUALITY, self)

	var has_entry := FileAccess.get_file_as_string(HUD_MENU).contains("[\"go_graphics\",")
	check(has_entry, "⑥ 사가고 메뉴 항목 go_graphics")

	DirAccess.remove_absolute(tmp)
	Engine.max_fps = 0
	print("PROBE graphics ", "OK" if fails == 0 else "FAIL %d" % fails)
	quit(1 if fails > 0 else 0)
