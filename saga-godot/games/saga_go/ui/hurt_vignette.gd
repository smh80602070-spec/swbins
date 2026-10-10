extends CanvasLayer

## G-0171 — 내가 맞았을 때 화면 신호. 예전엔 적이 맞을 때와 같은 흰 숫자·몸 번쩍뿐이라 "내가 맞았다"·"위험하다"가 안 보였다.
##   flash()        — 화면 가장자리가 FLASH_SEC 동안 붉게 번쩍(field_combat.take_damage 가 부름)
##   set_low(bool)  — 지금 인물 체력이 낮으면 가장자리가 PULSE_SEC 주기로 옅게 맥박(field_combat._refresh_hud 가 부름)
## 가운데(INNER) 는 늘 투명 — 싸우는 자리를 가리지 않는다. test_village.gd 가 단다, 그룹 go_hurt_vignette.

const FLASH_SEC := 0.3
const FLASH_A := 0.42
const PULSE_SEC := 1.0
const PULSE_A := 0.3
const INNER := 0.72

const SHADER := """
shader_type canvas_item;
uniform float strength = 0.0;
uniform float inner = 0.72;
void fragment() {
	vec2 d = abs(UV - vec2(0.5)) * 2.0;
	float e = max(d.x, d.y);
	float a = smoothstep(inner, 1.0, e);
	a = a * a;   // 가장자리에 몰리게
	COLOR = vec4(0.85, 0.05, 0.04, a * strength);
}
"""

var _rect: ColorRect
var _mat: ShaderMaterial
var _flash_t := 0.0
var _low := false
var _pulse_t := 0.0


func _ready() -> void:
	layer = 3
	add_to_group("go_hurt_vignette")
	_rect = ColorRect.new()
	_rect.set_anchors_preset(Control.PRESET_FULL_RECT)
	_rect.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var sh := Shader.new()
	sh.code = SHADER
	_mat = ShaderMaterial.new()
	_mat.shader = sh
	_mat.set_shader_parameter("inner", INNER)
	_rect.material = _mat
	_rect.visible = false
	add_child(_rect)
	set_process(false)


func flash() -> void:
	_flash_t = FLASH_SEC
	_wake()


func set_low(on: bool) -> void:
	if on == _low:
		return
	_low = on
	_wake()


func _wake() -> void:
	_rect.visible = true
	set_process(true)
	_apply()


func _process(delta: float) -> void:
	_flash_t = maxf(_flash_t - delta, 0.0)
	_pulse_t = fmod(_pulse_t + delta, PULSE_SEC)
	_apply()
	if _flash_t <= 0.0 and not _low:
		_rect.visible = false
		set_process(false)   # 평소엔 아무것도 안 셈


func _apply() -> void:
	var a := FLASH_A * (_flash_t / FLASH_SEC)
	if _low:
		a = maxf(a, PULSE_A * (0.55 + 0.45 * sin(_pulse_t / PULSE_SEC * TAU)))
	_mat.set_shader_parameter("strength", a)
