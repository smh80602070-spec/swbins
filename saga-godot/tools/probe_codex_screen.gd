extends Node
## G-0031 사가만리 도감 화면(ui/codex_screen.gd) 자동 점검 — 평소엔 안 붙는다. test_village.gd 가 SAGA_CODEXUI_PROBE 가 있을 때만 단다.
##
##   SAGA_CODEXUI_PROBE=1 "$GODOT" --headless --path saga-godot res://games/saga_go/world/TestVillage.tscn
##
## ① 도감 인물 105(시대 넷·rf_ 제외)·이름에 실명 블랙리스트 없음 ② 열림·플레이어 멈춤·ui_modal ③ 인물 탭 칸 105·모름은 "???"
## ④ 영입한 인물 칸 → 새 인물 몸(뼈대) 미리보기·이름 보임 ⑤ 모르는 인물 → 실루엣(검은 덮개)·"???" ⑥ 신수 탭 칸 11·잡은 신수 몸
## ⑦ 발견 탭 갈래 여섯·숫자가 CodexState 와 같음 ⑧ X 로 닫힘·멈춤 풀림. 영입·도감은 끝에 되돌린다. 저장은 안 한다.

const CodexScreen := preload("res://games/saga_go/ui/codex_screen.gd")
const Pets := preload("res://saga_core/data/pets.gd")
const REAL_NAMES := ["이순신", "제갈량", "관우", "조조", "유비", "세종", "나폴레옹", "카이사르", "노부나가"]

var _cs: Node
var _p: Node3D
var _frame := 0
var _step := 0
var _fails := 0
var _saved_members: Array = []
var _saved_book := {}
var _owned := ""
var _unknown := ""

func _ready() -> void:
	_p = get_tree().get_first_node_in_group("player")

func _check(name: String, ok: bool, info := "") -> void:
	print("CODEX_PROBE %s %s %s" % [name, "ok" if ok else "FAIL", info])
	if not ok:
		_fails += 1

func _physics_process(_delta: float) -> void:
	_frame += 1
	if _cs == null:
		_cs = get_tree().get_first_node_in_group("go_codex")
		_frame = 0
		return
	if _frame < 5:
		return
	match _step:
		0:
			var heroes: Array = CodexScreen.dex_heroes()
			var real := []
			for h: Dictionary in heroes:
				for r in REAL_NAMES:
					if String(h.name).contains(r):
						real.append(String(h.id))
			_check("dex_105", heroes.size() == 105 and real.is_empty(), "n=%d real=%s" % [heroes.size(), real])
			## 영입 하나·모름 하나를 정해 둔다(끝에 되돌림).
			_saved_members = PartyState.members.duplicate()
			_saved_book = CodexState.book.duplicate()
			_owned = String((heroes[3] as Dictionary).id)
			_unknown = String((heroes[40] as Dictionary).id)
			if not PartyState.members.has(_owned):
				PartyState.members.append(_owned)
			PartyState.members.erase(_unknown)
			CodexState.book.erase("record:" + _unknown)
			CodexState.book["pet:" + String((Pets.PETS[0] as Dictionary).id)] = true
			_p.set("frozen", false)
			var opened: bool = _cs.call("open_screen")
			_check("open", opened and bool(_cs.get("is_open")) and bool(_p.get("frozen")) and _cs.is_in_group("ui_modal"))
			_step = 1
			_frame = 0
		1:
			_cs.call("show_tab", "hero")
			var grid := _cs.get("_grid") as GridContainer
			var unknown_cells := 0
			for b in grid.get_children():
				if (b as Button).text == "???":
					unknown_cells += 1
			_check("hero_cells", grid.get_child_count() == 105 and unknown_cells > 0, "cells=%d unknown=%d" % [grid.get_child_count(), unknown_cells])
			_cs.call("select", _owned)
			_step = 2
			_frame = 0
		2:
			var m: Node3D = _cs.call("preview_model")
			var skel := m.find_children("*", "Skeleton3D", true, false) if m else []
			var nm := String((_cs.get("_detail_name") as Label).text)
			var dark := false
			for mi in (m.find_children("*", "MeshInstance3D", true, false) if m else []):
				if (mi as MeshInstance3D).material_override != null:
					dark = true
			var vb := ResourceLoader.exists("res://assets/characters_dex/%s.gltf" % _owned)
			_check("owned_preview", m != null and (not vb or not skel.is_empty()) and not dark and nm != "???" and nm != "", "id=%s skel=%d name=%s dex=%s" % [_owned, skel.size(), nm, vb])
			_cs.call("select", _unknown)
			_step = 3
			_frame = 0
		3:
			var m: Node3D = _cs.call("preview_model")
			var dark := 0
			for mi in (m.find_children("*", "MeshInstance3D", true, false) if m else []):
				if (mi as MeshInstance3D).material_override != null:
					dark += 1
			var nm := String((_cs.get("_detail_name") as Label).text)
			var vb := ResourceLoader.exists("res://assets/characters_dex/%s.gltf" % _unknown)
			_check("unknown_silhouette", nm == "???" and (not vb or dark > 0), "id=%s dark=%d" % [_unknown, dark])
			_cs.call("show_tab", "pet")
			_step = 4
			_frame = 0
		4:
			var grid := _cs.get("_grid") as GridContainer
			var m: Node3D = _cs.call("preview_model")
			var first := String((Pets.PETS[0] as Dictionary).id)
			_check("pet_tab", grid.get_child_count() == Pets.PETS.size() and String(_cs.get("selected")) == first and m != null \
				and String((_cs.get("_detail_name") as Label).text) != "???", "cells=%d sel=%s" % [grid.get_child_count(), _cs.get("selected")])
			_cs.call("show_tab", "find")
			_step = 5
			_frame = 0
		5:
			var grid := _cs.get("_grid") as GridContainer
			var ok := grid.get_child_count() == CodexScreen.KIND_ORDER.size()
			for i in grid.get_child_count():
				var k: String = CodexScreen.KIND_ORDER[i]
				var lb := grid.get_child(i).get_child(0) as Label
				ok = ok and lb.text.contains("%d / %d" % [CodexScreen.kind_count(k), int(CodexState.TOTAL[k])])
			## G-0032 이름 목록 — 갈래마다 칸 수 = TOTAL, 찾은 칸만 이름(나머지 ???), 같은 id 두 번 없음.
			var cells := {}
			var bad := []
			for l in grid.find_children("*", "Label", true, false):
				if not l.has_meta("codex_kind"):
					continue
				var k := String(l.get_meta("codex_kind"))
				var id := String(l.get_meta("codex_id"))
				cells[k] = int(cells.get(k, 0)) + 1
				if CodexState.has(k, id) == ((l as Label).text == "???"):
					bad.append(k + ":" + id)
			for k in CodexScreen.KIND_ORDER:
				if int(cells.get(k, 0)) != int(CodexState.TOTAL[k]):
					bad.append("%s %d/%d" % [k, int(cells.get(k, 0)), int(CodexState.TOTAL[k])])
			## 장면의 발견 지점(Discover_<id>)이 이름표에 다 있다.
			var Catalog: GDScript = load("res://games/saga_go/data/codex_catalog.gd")
			var known := {}
			for k in ["place", "beast"]:
				for e: Array in Catalog.call("entries", k):
					known[String(e[0])] = true
			for n in get_tree().get_nodes_in_group("codex_discoverable"):
				var nm := String(n.name)
				if nm.begins_with("Discover_") and not known.has(nm.substr(9)):
					bad.append("scene:" + nm.substr(9))
			_check("find_tab", ok and bad.is_empty(), "rows=%d cells=%s bad=%s" % [grid.get_child_count(), cells, bad.slice(0, 6)])
			var ev := InputEventAction.new()
			ev.action = "go_codex"
			ev.pressed = true
			Input.parse_input_event(ev)
			_step = 6
			_frame = 0
		6:
			if _frame < 3:
				return
			_check("close", not bool(_cs.get("is_open")) and not bool(_p.get("frozen")) and not _cs.is_in_group("ui_modal") and _cs.call("preview_model") == null)
			PartyState.members.assign(_saved_members)
			CodexState.book = _saved_book
			print("CODEXUI_PROBE_DONE fails=%d" % _fails)
			get_tree().quit()
			_step = 7
