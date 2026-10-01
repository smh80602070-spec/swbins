extends SceneTree

## 다섯 판 공용 손맛(saga_core/combat_feel.gd — 히트스톱·화면 흔들림·피격 플래시·숫자 팝·타격음·채집 팝·UI 소리) 자동 점검 — 신호와 상태만 본다(실제 그림·소리는 안 봄). 실제 시계로 기다린다.
##   godot --headless --path saga-godot --script res://tools/probe_combat_feel.gd
## ① 표: 히트스톱 70/120ms·배율 0.05·흔들림 0.06m/120ms·플래시 80ms·팝 0.6초·소리 3종(타격·채집·UI 각 3개) ② hit(): 히트스톱·흔들림·플래시·팝·소리 신호가 한 번씩·치명타면 히트스톱 120ms·카메라 리그가 있으면 shake 호출·시간 배율 0.05 로 줄었다가 제때 1.0 으로 돌아옴·겹쳐 맞아도 더 긴 쪽으로
## ③ 플래시: 일반 재질이면 흰색 → 80ms 뒤 원래 색 · 깊은 자식 메시도 찾음 · 대상이 없어도 안 죽음 ④ 채집 손맛: pickup() 신호·소리 순환 0→1→2→0 · ui() 소리 순환. 끝에 "PROBE combat_feel OK" 또는 "PROBE combat_feel FAIL n".

var fails := 0


func check(cond: bool, msg: String) -> void:
	if cond:
		print("  ok   ", msg)
	else:
		fails += 1
		print("  FAIL ", msg)


class FakeRig extends Node:
	var shakes: Array = []

	func shake(amp: float, sec: float) -> void:
		shakes.append([amp, sec])


## 실제 시계로 기다린다(시간 배율이 줄어도 안 느려지게).
func _wait_ms(ms: int) -> void:
	await create_timer(float(ms) / 1000.0, true, false, true).timeout


func _initialize() -> void:
	await process_frame
	var CF: Node = root.get_node("CombatFeel")
	var stops: Array = []
	var shakes: Array = []
	var flashes: Array = []
	var popups: Array = []
	var sounds: Array = []
	var picks: Array = []
	CF.hitstop_triggered.connect(func(d): stops.append(d))
	CF.shake_triggered.connect(func(a, d): shakes.append([a, d]))
	CF.flash_triggered.connect(func(t): flashes.append(t))
	CF.popup_triggered.connect(func(a, c): popups.append([a, c]))
	CF.sound_triggered.connect(func(i): sounds.append(i))
	CF.pickup_triggered.connect(func(l): picks.append(l))

	# ① 표
	check(CF.HITSTOP_MS == 70 and CF.HITSTOP_CRIT_MS == 120 and CF.HITSTOP_CRIT_MS > CF.HITSTOP_MS and CF.HITSTOP_SCALE == 0.05 and CF.SHAKE_AMP_M == 0.06 and CF.SHAKE_MS == 120 and CF.FLASH_MS == 80 and CF.POPUP_SEC == 0.6 and CF.POPUP_CRIT_SCALE > 1.0 and CF.SOUND_CUE_COUNT == 3, "손맛 상수: 히트스톱 70(치명 120)ms·배율 0.05 · 흔들림 0.06m·120ms · 플래시 80ms · 팝 0.6초 · 소리 3종")
	check(CF.HIT_SOUNDS.size() == 3 and CF.PICK_SOUNDS.size() == 3 and CF.UI_SOUNDS.size() == 3 and CF.HIT_SOUNDS.all(func(s): return s != null) and CF.PICK_SOUNDS.all(func(s): return s != null) and CF.UI_SOUNDS.all(func(s): return s != null), "타격·채집·UI 소리 각 3개가 다 있음")

	# ② hit()
	var rig := FakeRig.new()
	rig.add_to_group("camera_rig")
	root.add_child(rig)
	var body := MeshInstance3D.new()
	body.mesh = CapsuleMesh.new()
	var mat := StandardMaterial3D.new()
	mat.albedo_color = Color(0.2, 0.4, 0.8)
	body.material_override = mat
	root.add_child(body)
	await process_frame
	CF.hit(body, 37.4, false)
	check(stops == [70] and shakes == [[0.06, 120]] and flashes == [body] and popups == [[37.4, false]] and sounds.size() == 1 and rig.shakes == [[0.06, 0.12]], "hit(): 히트스톱 70ms · 흔들림 · 플래시 · 숫자 팝 · 타격음이 한 번씩 · 카메라 리그 shake(0.06, 0.12초)")
	check(Engine.time_scale == CF.HITSTOP_SCALE and mat.albedo_color == Color.WHITE, "맞는 순간: 시간 배율 0.05 · 대상이 흰색으로")
	await _wait_ms(140)
	check(Engine.time_scale == 1.0 and mat.albedo_color == Color(0.2, 0.4, 0.8), "140ms 뒤: 시간 배율 1.0 으로 돌아오고 원래 색으로 돌아옴")
	CF.hit(body, 90.0, true)
	check(stops[-1] == 120 and popups[-1] == [90.0, true], "치명타: 히트스톱 120ms · 팝에 치명 표시")
	var until_before: int = CF._hitstop_until_msec
	CF.hit(body, 1.0, false)
	check(CF._hitstop_until_msec >= until_before, "겹쳐 맞아도 히트스톱은 더 긴 쪽을 유지")
	await _wait_ms(200)
	check(Engine.time_scale == 1.0 and CF._hitstop_until_msec == 0 and CF._flash_state.is_empty(), "다 끝나면 시간 배율 1.0 · 상태 비움")
	# ③ 플래시 — 깊은 자식·대상 없음
	var holder := Node3D.new()
	var mid := Node3D.new()
	var deep := MeshInstance3D.new()
	deep.mesh = BoxMesh.new()
	var dmat := StandardMaterial3D.new()
	dmat.albedo_color = Color(0.9, 0.1, 0.1)
	deep.material_override = dmat
	holder.add_child(mid)
	mid.add_child(deep)
	root.add_child(holder)
	CF.hit(holder, 5.0, false)
	check(dmat.albedo_color == Color.WHITE, "깊은 자식 메시도 찾아 흰색으로")
	await _wait_ms(150)
	check(dmat.albedo_color == Color(0.9, 0.1, 0.1), "플래시 80ms 뒤 원래 색")
	var n_before := stops.size()
	CF.hit(null, 3.0, false)
	check(stops.size() == n_before + 1, "대상이 없어도(null) 히트스톱·흔들림·소리는 나가고 안 죽음")
	await _wait_ms(150)
	# ④ 소리 순환·채집
	sounds.clear()
	for i in 4:
		CF.hit(null, 1.0, false)
	var cyc: Array = sounds.duplicate()
	var diff_ok: bool = cyc.size() == 4 and cyc[0] != cyc[1] and cyc[1] != cyc[2] and cyc[3] == cyc[0]
	await _wait_ms(150)
	sounds.clear()
	CF.pickup(body, "과일 +1")
	CF.pickup(body, "꽃 +1")
	CF.pickup(null, "솔방울 +1")
	CF.pickup(body, "물고기 +1")
	check(picks == ["과일 +1", "꽃 +1", "솔방울 +1", "물고기 +1"] and sounds.size() == 4 and sounds[0] != sounds[1] and sounds[3] == sounds[0], "채집 손맛: 라벨 신호 · 소리가 세 가지를 돌아가며 · 대상이 없어도 됨(히트스톱·흔들림은 안 걸림)")
	check(diff_ok and stops.size() == n_before + 1 + 4, "타격음도 세 가지를 돌아감 %s · 채집은 히트스톱을 안 걸음" % str(cyc))
	var ui_before: int = CF._ui_sound_idx
	CF.ui()
	CF.ui()
	CF.ui()
	check(CF._ui_sound_idx == ui_before, "UI 소리: 세 번이면 한 바퀴")
	rig.queue_free()
	body.queue_free()
	holder.queue_free()
	Engine.time_scale = 1.0
	print("PROBE combat_feel ", "OK" if fails == 0 else "FAIL %d" % fails)
	quit(1 if fails > 0 else 0)
