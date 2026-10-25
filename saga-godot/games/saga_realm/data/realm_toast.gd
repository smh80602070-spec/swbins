extends RefCounted

## G-0411 5천하 규칙 층 알림 — 공용 Toast(글자 칸 하나, 마지막 것이 이김)를 감싸 **같은 프레임**에 온 알림을 한 칸에 잇는다.
## 달 넘김(next_month)은 한 프레임에 달 끝 묶음(민란·천거·교역…)·전투·재해 알림을 차례로 띄워 앞의 것이 곧바로 덮였다(G-0410 촬영).
## 줄은 MAX_LINES 까지(넘치면 앞줄부터 버림) · 보이는 시간은 가장 긴 것. 다른 프레임이면 원래대로 갈아 끼운다. realm_state.gd 의 Toast 상수가 이것.

const BaseToast := preload("res://saga_core/ui/toast.gd")
const MAX_LINES := 8

static var _frame := -1
static var _text := ""
static var _sec := 0.0


static func show(node: Node, text: String, show_sec: float) -> void:
	var f := Engine.get_process_frames()
	if f == _frame and _text != "" and OS.get_environment("SAGA_REALM_TOAST_JOIN") != "0":
		var lines := (_text + "\n" + text).split("\n")
		if lines.size() > MAX_LINES:
			lines = lines.slice(lines.size() - MAX_LINES)
		_text = "\n".join(lines)
		_sec = maxf(_sec, show_sec)
	else:
		_frame = f
		_text = text
		_sec = show_sec
	BaseToast.show(node, _text, _sec)
	_fit(node, _text.count("\n") + 1)


## 줄 수만큼 위 글자 칸·바탕 높이를 늘린다(RealmHUD 는 한 줄 60px 고정이라 여러 줄이 자원 줄과 겹쳤다) · 여러 줄이면 자원 줄 위로 그린다. 한 줄이면 옛 높이·차례.
const LINE_PX := 36.0
const BASE_H := 60.0


static func _fit(node: Node, lines: int) -> void:
	if node == null or not node.is_inside_tree():
		return
	var h := maxf(BASE_H, LINE_PX * float(lines) + 24.0)
	for g in ["dialogue_label", "dialogue_panel"]:
		for c in node.get_tree().get_nodes_in_group(g):
			if c is Control:
				(c as Control).offset_bottom = (c as Control).offset_top + h
				(c as Control).z_index = 1 if lines > 1 else 0   # 여러 줄이면 아래 자원 줄 위로(글자 칸이 바탕보다 뒤 차례라 글자가 위)
